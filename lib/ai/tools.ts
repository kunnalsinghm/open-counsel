import { eq, and, like } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

/**
 * Grounded tool functions for the AI counselor. The LLM is only allowed to
 * state cutoff-rank facts, eligibility facts, or counseling-rule facts that
 * came from one of these functions — never from its own training data. See
 * app/api/chat/route.ts for how tool results are injected before the
 * model's final answer.
 */

export async function queryCutoffs(params: {
  examSystemCode: string;
  instituteName?: string;
  branchCode?: string;
  category?: string;
  quota?: string;
  year?: number;
  round?: number;
}) {
  const db = await getDb();

  const examSystem = db
    .select()
    .from(schema.examSystems)
    .where(eq(schema.examSystems.code, params.examSystemCode))
    .get();
  if (!examSystem) return { result: "DATA_UNAVAILABLE", reason: "unknown_exam_system" };

  const conditions = [eq(schema.cutoffRecords.examSystemId, examSystem.id)];
  if (params.category) conditions.push(eq(schema.cutoffRecords.category, params.category));
  if (params.quota) conditions.push(eq(schema.cutoffRecords.quota, params.quota));
  if (params.year) conditions.push(eq(schema.cutoffRecords.year, params.year));
  if (params.round) conditions.push(eq(schema.cutoffRecords.round, params.round));
  if (params.branchCode) conditions.push(eq(schema.branches.shortCode, params.branchCode));
  if (params.instituteName)
    conditions.push(like(schema.institutes.name, `%${params.instituteName}%`));

  const rows = db
    .select({ cutoff: schema.cutoffRecords, institute: schema.institutes, branch: schema.branches })
    .from(schema.cutoffRecords)
    .innerJoin(schema.institutes, eq(schema.cutoffRecords.instituteId, schema.institutes.id))
    .innerJoin(schema.branches, eq(schema.cutoffRecords.branchId, schema.branches.id))
    .where(and(...conditions))
    .limit(25)
    .all();

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
  const db = await getDb();
  const examSystem = db
    .select()
    .from(schema.examSystems)
    .where(eq(schema.examSystems.code, params.examSystemCode))
    .get();
  if (!examSystem) return { result: "DATA_UNAVAILABLE" };

  const rule = db
    .select()
    .from(schema.counselingRules)
    .where(
      and(
        eq(schema.counselingRules.examSystemId, examSystem.id),
        eq(schema.counselingRules.topic, params.topic.toUpperCase())
      )
    )
    .get();
  if (!rule) return { result: "DATA_UNAVAILABLE" };

  return {
    result: {
      title: rule.title,
      body: rule.body,
      officialUrl: rule.officialUrl,
    },
  };
}

/** Very small keyword-based intent router — swap for a real LLM function-call
 * router once an AI provider key is configured (see lib/ai/provider.ts). */
export function routeIntent(message: string): "CUTOFF" | "RULE" | "RECOMMENDATION" | "GENERAL" {
  const m = message.toLowerCase();
  if (/(freeze|float|slide|withdraw|refund)/.test(m)) return "RULE";
  if (/(cutoff|closing rank|opening rank|can i get)/.test(m)) return "CUTOFF";
  if (/(my list|recommend|safer|reorder)/.test(m)) return "RECOMMENDATION";
  return "GENERAL";
}
