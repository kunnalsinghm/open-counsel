import { and, eq, inArray } from "drizzle-orm";
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
  skipped: IngestionIssue[];
  warnings: IngestionIssue[];
  droppedByCode: Record<string, number>;
  newInstitutes: string[];
  newBranches: string[];
  // Only populated when shouldCommit is true
  inserted: number;
  updated: number;
  skippedAsDuplicateOfPublished: number;
  committed: boolean;
}

/**
 * Shared core for CSV cutoff ingestion - validates, reports, and (if
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
  const skipped: IngestionIssue[] = [];
  const warnings: IngestionIssue[] = [];
  const validRows: { row: CutoffCsvRow; rowNumber: number }[] = [];

  records.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const { row, issues } = validateRow(raw, rowNumber, examSystemCode, validCategories, validQuotas);
    for (const issue of issues) {
      if (issue.severity === "ERROR") errors.push(issue);
      else if (issue.severity === "SKIPPED") skipped.push(issue);
      else warnings.push(issue);
    }
    if (row) validRows.push({ row, rowNumber });
  });

  const duplicateIssues = findDuplicatesInFile(validRows);
  skipped.push(...duplicateIssues);
  const duplicateRowNumbers = new Set(duplicateIssues.map((i) => i.rowNumber));
  const finalValidRows = validRows.filter((r) => !duplicateRowNumbers.has(r.rowNumber));

  // Every row is now accounted for: totalRows === finalValidRows.length + errors.length +
  // skipped.length (a row can only land in exactly one bucket). droppedByCode makes that
  // auditable at a glance instead of requiring someone to re-derive it from raw counts.
  const droppedByCode: Record<string, number> = {};
  for (const issue of [...errors, ...skipped]) {
    droppedByCode[issue.code] = (droppedByCode[issue.code] ?? 0) + 1;
  }

  const existingInstitutes = await db
    .select()
    .from(schema.institutes)
    .where(eq(schema.institutes.examSystemId, examSystem.id));
  const instituteByName = new Map(existingInstitutes.map((i) => [i.name, i]));

  const existingBranches =
    existingInstitutes.length === 0
      ? []
      : await db
          .select()
          .from(schema.branches)
          .where(
            inArray(
              schema.branches.instituteId,
              existingInstitutes.map((i) => i.id)
            )
          );
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
    skipped,
    warnings,
    droppedByCode,
    newInstitutes: Array.from(newInstitutes),
    newBranches: Array.from(newBranches),
  };

  // Only real ERRORs (malformed data) block committing - SKIPPED rows (unrecognized but
  // anticipated quota/category values, in-file duplicates) are excluded from the import but
  // don't stop the rest of the file from landing. This is the fix for the earlier failure mode
  // where a handful of unmodeled quota codes anywhere in an 11k-row file blocked the entire
  // commit instead of just those rows.
  if (errors.length > 0 || !shouldCommit) {
    return { ...baseResult, inserted: 0, updated: 0, skippedAsDuplicateOfPublished: 0, committed: false };
  }

  // Everything below runs in ONE transaction using a handful of bulk statements instead of
  // ~3 queries per row. A failure part-way rolls the whole import back, so a file is never
  // left half-imported.
  const INSERT_CHUNK = 1000;
  const UPDATE_CHUNK = 50;
  const cutoffKey = (
    instituteId: string,
    branchId: string,
    r: { year: number; round: number; quota: string; seatPool: string; category: string }
  ) => [instituteId, branchId, r.year, r.round, r.quota, r.seatPool, r.category].join("::");

  const result = await db.transaction(async (tx) => {
    // 1. Institutes that do not exist yet.
    const instituteInfo = new Map<string, CutoffCsvRow>();
    for (const { row } of finalValidRows) {
      if (!instituteByName.has(row.instituteName) && !instituteInfo.has(row.instituteName)) {
        instituteInfo.set(row.instituteName, row);
      }
    }
    const instituteValues = Array.from(instituteInfo.values()).map((row) => ({
      examSystemId: examSystem.id,
      name: row.instituteName,
      instituteType: row.instituteType,
      state: row.state,
    }));
    for (let i = 0; i < instituteValues.length; i += INSERT_CHUNK) {
      const created = await tx
        .insert(schema.institutes)
        .values(instituteValues.slice(i, i + INSERT_CHUNK))
        .returning();
      for (const inst of created) instituteByName.set(inst.name, inst);
    }

    // 2. Branches that do not exist yet.
    const branchInfo = new Map<string, { instituteId: string; name: string; shortCode: string }>();
    for (const { row } of finalValidRows) {
      const inst = instituteByName.get(row.instituteName)!;
      const key = `${inst.id}::${row.branchShortCode}`;
      if (!branchByKey.has(key) && !branchInfo.has(key)) {
        branchInfo.set(key, { instituteId: inst.id, name: row.branchName, shortCode: row.branchShortCode });
      }
    }
    const branchValues = Array.from(branchInfo.values());
    for (let i = 0; i < branchValues.length; i += INSERT_CHUNK) {
      const created = await tx
        .insert(schema.branches)
        .values(branchValues.slice(i, i + INSERT_CHUNK))
        .returning();
      for (const br of created) branchByKey.set(`${br.instituteId}::${br.shortCode}`, br);
    }

    // 3. Existing cutoffs for the years in this file, loaded once.
    const years = Array.from(new Set(finalValidRows.map((r) => r.row.year)));
    const existingCutoffs = await tx
      .select({
        id: schema.cutoffRecords.id,
        instituteId: schema.cutoffRecords.instituteId,
        branchId: schema.cutoffRecords.branchId,
        year: schema.cutoffRecords.year,
        round: schema.cutoffRecords.round,
        quota: schema.cutoffRecords.quota,
        seatPool: schema.cutoffRecords.seatPool,
        category: schema.cutoffRecords.category,
        dataVersion: schema.cutoffRecords.dataVersion,
      })
      .from(schema.cutoffRecords)
      .where(
        and(
          eq(schema.cutoffRecords.examSystemId, examSystem.id),
          years.length > 0 ? inArray(schema.cutoffRecords.year, years) : undefined
        )
      );
    const existingByKey = new Map<string, { id: string; isMock: boolean }>();
    for (const c of existingCutoffs) {
      existingByKey.set(cutoffKey(c.instituteId, c.branchId, c), {
        id: c.id,
        isMock: c.dataVersion === "seed-v1",
      });
    }

    // 4. Split into inserts, updates and untouched duplicates.
    const toInsert: (typeof schema.cutoffRecords.$inferInsert)[] = [];
    const toUpdate: { id: string; row: CutoffCsvRow }[] = [];
    let duplicatesOfPublished = 0;

    for (const { row } of finalValidRows) {
      const inst = instituteByName.get(row.instituteName)!;
      const br = branchByKey.get(`${inst.id}::${row.branchShortCode}`)!;
      const existing = existingByKey.get(cutoffKey(inst.id, br.id, row));

      if (existing) {
        // A generated demo ("seed-v1") row is never "published" data: real data always
        // replaces it, even without --overwrite.
        if (shouldOverwrite || existing.isMock) toUpdate.push({ id: existing.id, row });
        else duplicatesOfPublished++;
        continue;
      }

      toInsert.push({
        examSystemId: examSystem.id,
        instituteId: inst.id,
        branchId: br.id,
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
    }

    // 5. Write.
    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
      await tx.insert(schema.cutoffRecords).values(toInsert.slice(i, i + INSERT_CHUNK));
    }
    for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK) {
      await Promise.all(
        toUpdate.slice(i, i + UPDATE_CHUNK).map(({ id, row }) =>
          tx
            .update(schema.cutoffRecords)
            .set({
              openingRank: row.openingRank,
              closingRank: row.closingRank,
              sourceUrl: row.sourceUrl,
              sourceDocument,
              dataVersion,
            })
            .where(eq(schema.cutoffRecords.id, id))
        )
      );
    }

    return { inserted: toInsert.length, updated: toUpdate.length, duplicatesOfPublished };
  });

  const inserted = result.inserted;
  const updated = result.updated;
  const skippedAsDuplicateOfPublished = result.duplicatesOfPublished;

  return { ...baseResult, inserted, updated, skippedAsDuplicateOfPublished, committed: true };
}