import { eq, and, or, ilike, inArray, desc, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { escapeLike } from "@/lib/sql-utils";

export async function listInstituteNames(examSystemCode: string): Promise<string[]> {
  const rows = await db
    .select({ name: schema.institutes.name })
    .from(schema.institutes)
    .innerJoin(schema.examSystems, eq(schema.institutes.examSystemId, schema.examSystems.id))
    .where(eq(schema.examSystems.code, examSystemCode));
  return rows.map((r) => r.name);
}

export async function queryCutoffs(params: {
  examSystemCode: string;
  instituteName?: string;
  /** Exact institute names (as stored). Takes precedence over instituteName. */
  instituteNames?: string[];
  branchCode?: string;
  /** Matched against short_code (exact, case-insensitive) or branch name (contains). */
  branchTerms?: string[];
  category?: string;
  quota?: string;
  year?: number;
  round?: number;
  limit?: number;
}) {
  const [examSystem] = await db
    .select()
    .from(schema.examSystems)
    .where(eq(schema.examSystems.code, params.examSystemCode))
    .limit(1);
  if (!examSystem) return { result: "DATA_UNAVAILABLE", reason: "unknown_exam_system" };

  const conditions = [eq(schema.cutoffRecords.examSystemId, examSystem.id)];
  if (params.category) conditions.push(eq(schema.cutoffRecords.category, params.category));
  if (params.quota) conditions.push(eq(schema.cutoffRecords.quota, params.quota));
  if (params.year) conditions.push(eq(schema.cutoffRecords.year, params.year));
  if (params.round) conditions.push(eq(schema.cutoffRecords.round, params.round));
  if (params.branchCode) conditions.push(eq(schema.branches.shortCode, params.branchCode));

  if (params.branchTerms && params.branchTerms.length > 0) {
    const termConds = params.branchTerms.flatMap((t) => [
      sql`upper(${schema.branches.shortCode}) = ${t.toUpperCase()}`,
      ilike(schema.branches.name, `%${escapeLike(t)}%`),
    ]);
    conditions.push(or(...termConds)!);
  }

  if (params.instituteNames && params.instituteNames.length > 0) {
    conditions.push(inArray(schema.institutes.name, params.instituteNames));
  } else if (params.instituteName) {
    conditions.push(ilike(schema.institutes.name, `%${escapeLike(params.instituteName)}%`));
  }

  const rows = await db
    .select({ cutoff: schema.cutoffRecords, institute: schema.institutes, branch: schema.branches })
    .from(schema.cutoffRecords)
    .innerJoin(schema.institutes, eq(schema.cutoffRecords.instituteId, schema.institutes.id))
    .innerJoin(schema.branches, eq(schema.cutoffRecords.branchId, schema.branches.id))
    .where(and(...conditions))
    .orderBy(desc(schema.cutoffRecords.year), desc(schema.cutoffRecords.round))
    .limit(params.limit ?? 30);

  if (rows.length === 0) return { result: "DATA_UNAVAILABLE" };

  return {
    result: rows.map((r) => ({
      institute: r.institute.name,
      branch: r.branch.shortCode,
      year: r.cutoff.year,
      round: r.cutoff.round,
      quota: r.cutoff.quota,
      seatPool: r.cutoff.seatPool,
      category: r.cutoff.category,
      openingRank: r.cutoff.openingRank,
      closingRank: r.cutoff.closingRank,
      // Lets the AI warn when a row is generated demo data rather than official data.
      isDemoData: r.cutoff.dataVersion === "seed-v1",
    })),
  };
}

export async function queryCounselingRule(params: { examSystemCode: string; topic: string }) {
  const [examSystem] = await db
    .select()
    .from(schema.examSystems)
    .where(eq(schema.examSystems.code, params.examSystemCode))
    .limit(1);
  if (!examSystem) return { result: "DATA_UNAVAILABLE" };

  const [rule] = await db
    .select()
    .from(schema.counselingRules)
    .where(
      and(
        eq(schema.counselingRules.examSystemId, examSystem.id),
        eq(schema.counselingRules.topic, params.topic.toUpperCase())
      )
    )
    .limit(1);
  if (!rule) return { result: "DATA_UNAVAILABLE" };

  return {
    result: {
      title: rule.title,
      body: rule.body,
      officialUrl: rule.officialUrl,
    },
  };
}

// routeIntent lives in ./router (no db/client.ts import) so it can be
// imported and tested without a DATABASE_URL present. Re-exported here so
// existing `import { routeIntent } from "@/lib/ai/tools"` call sites are
// unaffected.
export { routeIntent } from "./router";