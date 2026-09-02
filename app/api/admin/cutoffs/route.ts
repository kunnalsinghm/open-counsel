import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAdminApi } from "@/lib/admin-guard";

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = 50;
  const instituteId = searchParams.get("instituteId");
  const branchId = searchParams.get("branchId");
  const source = searchParams.get("source");

  const conditions = [];
  if (instituteId) conditions.push(eq(schema.cutoffRecords.instituteId, instituteId));
  if (branchId) conditions.push(eq(schema.cutoffRecords.branchId, branchId));
  if (source === "real") conditions.push(sql`${schema.cutoffRecords.dataVersion} != 'seed-v1'`);
  if (source === "mock") conditions.push(eq(schema.cutoffRecords.dataVersion, "seed-v1"));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.cutoffRecords)
    .where(whereClause);

  const rows = await db
    .select({
      id: schema.cutoffRecords.id,
      instituteId: schema.cutoffRecords.instituteId,
      instituteName: schema.institutes.name,
      branchId: schema.cutoffRecords.branchId,
      branchName: schema.branches.name,
      year: schema.cutoffRecords.year,
      round: schema.cutoffRecords.round,
      quota: schema.cutoffRecords.quota,
      seatPool: schema.cutoffRecords.seatPool,
      category: schema.cutoffRecords.category,
      openingRank: schema.cutoffRecords.openingRank,
      closingRank: schema.cutoffRecords.closingRank,
      dataVersion: schema.cutoffRecords.dataVersion,
      sourceUrl: schema.cutoffRecords.sourceUrl,
      isUnavailable: schema.cutoffRecords.isUnavailable,
    })
    .from(schema.cutoffRecords)
    .leftJoin(schema.institutes, eq(schema.cutoffRecords.instituteId, schema.institutes.id))
    .leftJoin(schema.branches, eq(schema.cutoffRecords.branchId, schema.branches.id))
    .where(whereClause)
    .orderBy(schema.institutes.name, schema.branches.name, schema.cutoffRecords.round)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return NextResponse.json({
    rows,
    page,
    pageSize,
    total: count,
    totalPages: Math.ceil(count / pageSize),
  });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body?.id || typeof body?.isUnavailable !== "boolean") {
    return NextResponse.json(
      { error: "Expected { id: string, isUnavailable: boolean }" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(schema.cutoffRecords)
    .set({ isUnavailable: body.isUnavailable })
    .where(eq(schema.cutoffRecords.id, body.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }

  return NextResponse.json({ updated });
}