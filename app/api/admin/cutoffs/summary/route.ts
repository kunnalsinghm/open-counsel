import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAdminApi } from "@/lib/admin-guard";

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({
      instituteId: schema.cutoffRecords.instituteId,
      instituteName: schema.institutes.name,
      branchId: schema.cutoffRecords.branchId,
      branchName: schema.branches.name,
      totalCount: sql<number>`count(*)::int`,
      realCount: sql<number>`count(*) filter (where ${schema.cutoffRecords.dataVersion} != 'seed-v1')::int`,
    })
    .from(schema.cutoffRecords)
    .leftJoin(schema.institutes, sql`${schema.cutoffRecords.instituteId} = ${schema.institutes.id}`)
    .leftJoin(schema.branches, sql`${schema.cutoffRecords.branchId} = ${schema.branches.id}`)
    .groupBy(
      schema.cutoffRecords.instituteId,
      schema.institutes.name,
      schema.cutoffRecords.branchId,
      schema.branches.name
    )
    .orderBy(schema.institutes.name, schema.branches.name);

  return NextResponse.json({ groups: rows });
}