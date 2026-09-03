import { readFileSync } from "fs";
import { runIngestion } from "../../lib/ingestion/import-core";
import type { IngestionIssue } from "../../lib/ingestion/types";

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
  newInstitutes: string[],
  newBranches: string[]
) {
  console.log("\n=== Ingestion Report ===");
  console.log(`Total data rows: ${totalRows}`);
  console.log(`Valid rows: ${validCount}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);

  if (newInstitutes.length > 0) {
    console.log(`\nNew institutes that will be created (${newInstitutes.length}):`);
    for (const name of newInstitutes) console.log(`  + ${name}`);
  }
  if (newBranches.length > 0) {
    console.log(`\nNew branches that will be created (${newBranches.length}):`);
    for (const name of newBranches) console.log(`  + ${name}`);
  }
  if (errors.length > 0) {
    console.log(`\n--- ERRORS (must be fixed before import) ---`);
    for (const e of errors.slice(0, 50)) console.log(`  Row ${e.rowNumber} [${e.code}]: ${e.message}`);
    if (errors.length > 50) console.log(`  ... and ${errors.length - 50} more.`);
  }
  if (warnings.length > 0) {
    console.log(`\n--- WARNINGS (review, but won't block import) ---`);
    for (const w of warnings.slice(0, 50)) console.log(`  Row ${w.rowNumber} [${w.code}]: ${w.message}`);
    if (warnings.length > 50) console.log(`  ... and ${warnings.length - 50} more.`);
  }
}

async function main() {
  const { filePath, flags } = parseArgs(process.argv.slice(2));

  if (!filePath) {
    console.error("Usage: npm run ingest -- <path-to-csv> --exam JOSAA --version <label> [--commit] [--overwrite]");
    process.exit(1);
  }

  const examSystemCode = (flags.exam as string) ?? "JOSAA";
  const dataVersion = (flags.version as string) ?? `import-${Date.now()}`;
  const sourceDocument = (flags.source as string) ?? filePath;
  const shouldCommit = flags.commit === true;
  const shouldOverwrite = flags.overwrite === true;

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (e) {
    console.error(`Could not read file: ${filePath}`);
    process.exit(1);
  }

  const result = await runIngestion(content, {
    examSystemCode,
    dataVersion,
    sourceDocument,
    shouldCommit,
    shouldOverwrite,
  });

  if ("fileError" in result) {
    console.error(result.fileError);
    process.exit(1);
  }

  printReport(result.totalRows, result.validRows, result.errors, result.warnings, result.newInstitutes, result.newBranches);

  if (result.errors.length > 0) {
    console.log(`\nImport blocked: fix all ERROR rows above before importing.`);
    process.exit(1);
  }

  if (!shouldCommit) {
    console.log(`\nDry run passed with no errors. Re-run with --commit to actually import.`);
    process.exit(0);
  }

  console.log(`\nImport complete.`);
  console.log(`   Inserted: ${result.inserted}`);
  console.log(`   Updated (overwritten): ${result.updated}`);
  console.log(`   Skipped (already published, use --overwrite to replace): ${result.skippedAsDuplicateOfPublished}`);
  console.log(`   New institutes created: ${result.newInstitutes.length}`);
  console.log(`   New branches created: ${result.newBranches.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Ingestion failed:", e);
  process.exit(1);
});