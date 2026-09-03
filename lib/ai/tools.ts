import { eq, and, like } from "drizzle-orm";
import { db, schema } from "@/db/client";

export async function queryCutoffs(params: {
  examSystemCode: string;
  instituteName?: string;
  branchCode?: string;
  category?: string;
  quota?: string;
  year?: number;
  round?: number;
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
  if (params.instituteName)
    conditions.push(like(schema.institutes.name, `%${params.instituteName}%`));

  const rows = await db
    .select({ cutoff: schema.cutoffRecords, institute: schema.institutes, branch: schema.branches })
    .from(schema.cutoffRecords)
    .innerJoin(schema.institutes, eq(schema.cutoffRecords.instituteId, schema.institutes.id))
    .innerJoin(schema.branches, eq(schema.cutoffRecords.branchId, schema.branches.id))
    .where(and(...conditions))
    .limit(25);

  if (rows.length === 0) return { result: "DATA_UNAVAILABLE" };

  return {
    result: rows.map((r) => ({
      institute: r.institute.name,
      branch: r.branch.shortCode,
      year: r.cutoff.year,
      round: r.cutoff.round,
      quota: r.cutoff.quota,
      category: r.cutoff.category,
      openingRank: r.cutoff.openingRank,
      closingRank: r.cutoff.closingRank,
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