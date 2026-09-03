import { NextRequest, NextResponse } from "next/server";
import { eq, and, like } from "drizzle-orm";
import { db, schema } from "@/db/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const examSystemCode = searchParams.get("exam") ?? "JOSAA";
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ institutes: [] });
  }

  const [examSystem] = await db
    .select()
    .from(schema.examSystems)
    .where(eq(schema.examSystems.code, examSystemCode))
    .limit(1);

  if (!examSystem) {
    return NextResponse.json({ institutes: [] });
  }

  const rows = await db
    .select()
    .from(schema.institutes)
    .where(
      and(
        eq(schema.institutes.examSystemId, examSystem.id),
        like(schema.institutes.name, `%${q}%`)
      )
    )
    .limit(10);

  return NextResponse.json({
    institutes: rows.map((r) => ({
      id: r.id,
      name: r.name,
      instituteType: r.instituteType,
      state: r.state,
      nirfRank: r.nirfRank,
      website: r.website,
    })),
  });
}