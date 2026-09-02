import { readFileSync } from "fs";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../../db/client";
import { parseCsv, csvRowsToObjects } from "../../lib/ingestion/csv";
import { validateRow, findDuplicatesInFile, REQUIRED_COLUMNS } from "../../lib/ingestion/validate";
import type { CutoffCsvRow, IngestionIssue } from "../../lib/ingestion/types";

function parseArgs(argv: string[]) {
  const filePath = argv[0];
  const flags: Record<string, string | boolean> = {};
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return { filePath, flags };
}

function printReport(
  totalRows: number,
  validCount: number,
  errors: IngestionIssue[],
  warnings: IngestionIssue[],
  newInstitutes: Set<string>,
  newBranches: Set<string>
) {
  console.log("\n=== Ingestion Report ===");
  console.log(`Total data rows: ${totalRows}`);
  console.log(`Valid rows: ${validCount}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);

  if (newInstitutes.size > 0) {
    console.log(`\nNew institutes that will be created (${newInstitutes.size}):`);
    for (const name of newInstitutes) console.log(`  + ${name}`);
  }
  if (newBranches.size > 0) {
    console.log(`\nNew branches that will be created (${newBranches.size}):`);
    for (const name of newBranches) console.log(`  + ${name}`);
  }

  if (errors.length > 0) {
    console.log(`\n--- ERRORS (must be fixed before import) ---`);
    for (const e of errors.slice(0, 50)) {
      console.log(`  Row ${e.rowNumber} [${e.code}]: ${e.message}`);
    }
    if (errors.length > 50) console.log(`  ... and ${errors.length - 50} more.`);
  }

  if (warnings.length > 0) {
    console.log(`\n--- WARNINGS (review, but won't block import) ---`);
    for (const w of warnings.slice(0, 50)) {
      console.log(`  Row ${w.rowNumber} [${w.code}]: ${w.message}`);
    }
    if (warnings.length > 50) console.log(`  ... and ${warnings.length - 50} more.`);
  }
}

async function main() {
  const { filePath, flags } = parseArgs(process.argv.slice(2));

  if (!filePath) {
    console.error("Usage: npm run ingest -- <path-to-csv> --exam JOSAA --version <label> [--commit]");
    process.exit(1);
  }

  const examSystemCode = (flags.exam as string) ?? "JOSAA";
  const dataVersion = (flags.version as string) ?? `import-${Date.now()}`;
  const sourceDocument = (flags.source as string) ?? filePath;
  const shouldCommit = flags.commit === true;
  const shouldOverwrite = flags.overwrite === true;

  const [examSystem] = await db
    .select()
    .from(schema.examSystems)
    .where(eq(schema.examSystems.code, examSystemCode))
    .limit(1);

  if (!examSystem) {
    console.error(
      `Exam system "${examSystemCode}" not found. Run the seed script first, or add it via a migration.`
    );
    process.exit(1);
  }

  const validCategories = examSystem.categories as string[];
  const validQuotas = examSystem.quotas as string[];

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (e) {
    console.error(`Could not read file: ${filePath}`);
    process.exit(1);
  }

  const parsed = parseCsv(content);
  const objectResult = csvRowsToObjects(parsed, REQUIRED_COLUMNS);
  if ("error" in objectResult) {
    console.error(`File structure problem: ${objectResult.error}`);
    process.exit(1);
  }

  const { records } = objectResult;
  const errors: IngestionIssue[] = [];
  const warnings: IngestionIssue[] = [];
  const validRows: { row: CutoffCsvRow; rowNumber: number }[] = [];

  records.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const { row, issues } = validateRow(raw, rowNumber, examSystemCode, validCategories, validQuotas);
    for (const issue of issues) {
      (issue.severity === "ERROR" ? errors : warnings).push(issue);
    }
    if (row) validRows.push({ row, rowNumber });
  });

  const duplicateIssues = findDuplicatesInFile(validRows);
  errors.push(...duplicateIssues);
  const duplicateRowNumbers = new Set(duplicateIssues.map((i) => i.rowNumber));
  const finalValidRows = validRows.filter((r) => !duplicateRowNumbers.has(r.rowNumber));

  const existingInstitutes = await db
    .select()
    .from(schema.institutes)
    .where(eq(schema.institutes.examSystemId, examSystem.id));
  const instituteByName = new Map(existingInstitutes.map((i) => [i.name, i]));

  const existingBranches = await db.select().from(schema.branches);
  const branchByKey = new Map(
    existingBranches.map((b) => [`${b.instituteId}::${b.shortCode}`, b])
  );

  const newInstitutes = new Set<string>();
  const newBranches = new Set<string>();
  for (const { row } of finalValidRows) {
    if (!instituteByName.has(row.instituteName)) newInstitutes.add(row.instituteName);
  }
  const branchNamePairs = new Set(
    finalValidRows.map((r) => `${r.row.instituteName} :: ${r.row.branchShortCode}`)
  );
  for (const pair of branchNamePairs) {
    const [instName, shortCode] = pair.split(" :: ");
    const inst = instituteByName.get(instName);
    if (!inst || !branchByKey.has(`${inst.id}::${shortCode}`)) {
      newBranches.add(pair);
    }
  }

  printReport(
    records.length,
    finalValidRows.length,
    errors,
    warnings,
    newInstitutes,
    newBranches
  );

  if (errors.length > 0) {
    console.log(`\nImport blocked: fix all ERROR rows above before importing.`);
    process.exit(1);
  }

  if (!shouldCommit) {
    console.log(`\nDry run passed with no errors. Re-run with --commit to actually import.`);
    process.exit(0);
  }

  console.log(`\nCommitting ${finalValidRows.length} rows (dataVersion="${dataVersion}")...`);

  let inserted = 0;
  let updated = 0;
  let skippedAsDuplicateOfPublished = 0;

  for (const { row } of finalValidRows) {
    let institute = instituteByName.get(row.instituteName);
    if (!institute) {
      const [created] = await db
        .insert(schema.institutes)
        .values({
          examSystemId: examSystem.id,
          name: row.instituteName,
          instituteType: row.instituteType,
          state: row.state,
        })
        .returning();
      institute = created;
      instituteByName.set(row.instituteName, institute);
    }

    let branch = branchByKey.get(`${institute.id}::${row.branchShortCode}`);
    if (!branch) {
      const [created] = await db
        .insert(schema.branches)
        .values({
          instituteId: institute.id,
          name: row.branchName,
          shortCode: row.branchShortCode,
        })
        .returning();
      branch = created;
      branchByKey.set(`${institute.id}::${row.branchShortCode}`, branch);
    }

    const [existingCutoff] = await db
      .select()
      .from(schema.cutoffRecords)
      .where(
        and(
          eq(schema.cutoffRecords.examSystemId, examSystem.id),
          eq(schema.cutoffRecords.instituteId, institute.id),
          eq(schema.cutoffRecords.branchId, branch.id),
          eq(schema.cutoffRecords.year, row.year),
          eq(schema.cutoffRecords.round, row.round),
          eq(schema.cutoffRecords.quota, row.quota),
          eq(schema.cutoffRecords.seatPool, row.seatPool),
          eq(schema.cutoffRecords.category, row.category)
        )
      )
      .limit(1);

    if (existingCutoff) {
      if (shouldOverwrite) {
        await db
          .update(schema.cutoffRecords)
          .set({
            openingRank: row.openingRank,
            closingRank: row.closingRank,
            sourceUrl: row.sourceUrl,
            sourceDocument,
            dataVersion,
          })
          .where(eq(schema.cutoffRecords.id, existingCutoff.id));
        updated++;
      } else {
        skippedAsDuplicateOfPublished++;
      }
      continue;
    }

    await db.insert(schema.cutoffRecords).values({
      examSystemId: examSystem.id,
      instituteId: institute.id,
      branchId: branch.id,
      year: row.year,
      round: row.round,
      quota: row.quota,
      seatPool: row.seatPool,
      category: row.category,
      openingRank: row.openingRank,
      closingRank: row.closingRank,
      sourceUrl: row.sourceUrl,
      sourceDocument,
      dataVersion,
    });
    inserted++;
  }

  console.log(`\nImport complete.`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Updated (overwritten): ${updated}`);
  console.log(`   Skipped (already published, use --overwrite to replace): ${skippedAsDuplicateOfPublished}`);
  console.log(`   New institutes created: ${newInstitutes.size}`);
  console.log(`   New branches created: ${newBranches.size}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Ingestion failed:", e);
  process.exit(1);
});