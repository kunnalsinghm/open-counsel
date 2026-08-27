import { NextRequest, NextResponse } from "next/server";
import { eq, and, like } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const examSystemCode = searchParams.get("exam") ?? "JOSAA";
  const instituteName = searchParams.get("institute") ?? undefined;
  const branchCode = searchParams.get("branch") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const quota = searchParams.get("quota") ?? undefined;
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
  const round = searchParams.get("round") ? Number(searchParams.get("round")) : undefined;

  const db = await getDb();

  const examSystem = db
    .select()
    .from(schema.examSystems)
    .where(eq(schema.examSystems.code, examSystemCode))
    .get();
  if (!examSystem) {
    return NextResponse.json({ error: "Unknown exam system." }, { status: 404 });
  }

  const conditions = [eq(schema.cutoffRecords.examSystemId, examSystem.id)];
  if (category) conditions.push(eq(schema.cutoffRecords.category, category));
  if (quota) conditions.push(eq(schema.cutoffRecords.quota, quota));
  if (year) conditions.push(eq(schema.cutoffRecords.year, year));
  if (round) conditions.push(eq(schema.cutoffRecords.round, round));
  if (branchCode) conditions.push(eq(schema.branches.shortCode, branchCode));
  if (instituteName) conditions.push(like(schema.institutes.name, `%${instituteName}%`));

  const rows = db
    .select({
      cutoff: schema.cutoffRecords,
      institute: schema.institutes,
      branch: schema.branches,
    })
    .from(schema.cutoffRecords)
    .innerJoin(schema.institutes, eq(schema.cutoffRecords.instituteId, schema.institutes.id))
    .innerJoin(schema.branches, eq(schema.cutoffRecords.branchId, schema.branches.id))
    .where(and(...conditions))
    .limit(100)
    .all();

  if (rows.length === 0) {
    return NextResponse.json({
      result: "DATA_UNAVAILABLE",
      message: "No matching cutoff records found for these filters.",
    });
  }

  return NextResponse.json({
    result: rows.map((r) => ({
      institute: r.institute.name,
      branch: r.branch.shortCode,
      year: r.cutoff.year,
      round: r.cutoff.round,
      quota: r.cutoff.quota,
      category: r.cutoff.category,
      openingRank: r.cutoff.openingRank,
      closingRank: r.cutoff.closingRank,
      source: r.cutoff.sourceDocument ?? "unspecified",
    })),
  });
}
