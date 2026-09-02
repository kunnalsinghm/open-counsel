import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const examSystemCode = searchParams.get("exam") ?? "JOSAA";

  const [examSystem] = await db
    .select()
    .from(schema.examSystems)
    .where(eq(schema.examSystems.code, examSystemCode))
    .limit(1);

  if (!examSystem) {
    return NextResponse.json({ error: "Unknown exam system." }, { status: 404 });
  }

  const rules = await db
    .select()
    .from(schema.counselingRules)
    .where(eq(schema.counselingRules.examSystemId, examSystem.id));

  return NextResponse.json({
    rules: rules.map((r) => ({
      topic: r.topic,
      title: r.title,
      body: r.body,
      officialUrl: r.officialUrl,
    })),
  });
}