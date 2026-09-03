import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { parseCsv, csvRowsToObjects } from "./csv";
import { validateRow, findDuplicatesInFile, REQUIRED_COLUMNS } from "./validate";
import type { CutoffCsvRow, IngestionIssue } from "./types";

export interface RunIngestionOptions {
  examSystemCode: string;
  dataVersion: string;
  sourceDocument: string;
  shouldCommit: boolean;
  shouldOverwrite: boolean;
}

export interface RunIngestionResult {
  totalRows: number;
  validRows: number;
  errors: IngestionIssue[];
  warnings: IngestionIssue[];
  newInstitutes: string[];
  newBranches: string[];
  // Only populated when shouldCommit is true
  inserted: number;
  updated: number;
  skippedAsDuplicateOfPublished: number;
  committed: boolean;
}

/**
 * Shared core for CSV cutoff ingestion — validates, reports, and (if
 * shouldCommit) upserts into cutoff_records. Used by both the CLI script
 * (scripts/ingest/import-cutoffs.ts) and the admin upload API route
 * (app/api/admin/cutoffs/upload/route.ts) so there's one implementation of
 * the business logic, not two that can drift apart.
 */
export async function runIngestion(
  csvContent: string,
  options: RunIngestionOptions
): Promise<RunIngestionResult | { fileError: string }> {
  const { examSystemCode, dataVersion, sourceDocument, shouldCommit, shouldOverwrite } = options;

  const [examSystem] = await db
    .select()
    .from(schema.examSystems)
    .where(eq(schema.examSystems.code, examSystemCode))
    .limit(1);

  if (!examSystem) {
    return { fileError: `Exam system "${examSystemCode}" not found. Seed it first, or check the code.` };
  }

  const validCategories = examSystem.categories as string[];
  const validQuotas = examSystem.quotas as string[];

  const parsed = parseCsv(csvContent);
  const objectResult = csvRowsToObjects(parsed, REQUIRED_COLUMNS);
  if ("error" in objectResult) {
    return { fileError: objectResult.error };
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
  const branchByKey = new Map(existingBranches.map((b) => [`${b.instituteId}::${b.shortCode}`, b]));

  const newInstitutes = new Set<string>();
  const newBranches = new Set<string>();
  for (const { row } of finalValidRows) {
    if (!instituteByName.has(row.instituteName)) newInstitutes.add(row.instituteName);
  }
  const branchNamePairs = new Set(finalValidRows.map((r) => `${r.row.instituteName} :: ${r.row.branchShortCode}`));
  for (const pair of branchNamePairs) {
    const [instName, shortCode] = pair.split(" :: ");
    const inst = instituteByName.get(instName);
    if (!inst || !branchByKey.has(`${inst.id}::${shortCode}`)) newBranches.add(pair);
  }

  const baseResult = {
    totalRows: records.length,
    validRows: finalValidRows.length,
    errors,
    warnings,
    newInstitutes: Array.from(newInstitutes),
    newBranches: Array.from(newBranches),
  };

  // Errors block committing regardless of what the caller asked for.
  if (errors.length > 0 || !shouldCommit) {
    return { ...baseResult, inserted: 0, updated: 0, skippedAsDuplicateOfPublished: 0, committed: false };
  }

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
        .values({ instituteId: institute.id, name: row.branchName, shortCode: row.branchShortCode })
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

  return { ...baseResult, inserted, updated, skippedAsDuplicateOfPublished, committed: true };
}