import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAdminApi } from "@/lib/admin-guard";

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

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

  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const { examSystemCode, topic, title, ruleBody, officialUrl } = body ?? {};

  if (!examSystemCode || !topic?.trim() || !title?.trim() || !ruleBody?.trim()) {
    return NextResponse.json(
      { error: "examSystemCode, topic, title, and ruleBody are all required." },
      { status: 400 }
    );
  }

  const [examSystem] = await db
    .select()
    .from(schema.examSystems)
    .where(eq(schema.examSystems.code, examSystemCode))
    .limit(1);

  if (!examSystem) {
    return NextResponse.json({ error: "Unknown exam system." }, { status: 404 });
  }

  const [created] = await db
    .insert(schema.counselingRules)
    .values({
      examSystemId: examSystem.id,
      topic: topic.trim(),
      title: title.trim(),
      body: ruleBody.trim(),
      officialUrl: officialUrl?.trim() || null,
    })
    .returning();

  return NextResponse.json({ rule: created }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const { id, topic, title, ruleBody, officialUrl } = body ?? {};

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(schema.counselingRules)
    .where(eq(schema.counselingRules.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }

  const [updated] = await db
    .update(schema.counselingRules)
    .set({
      topic: topic?.trim() || existing.topic,
      title: title?.trim() || existing.title,
      body: ruleBody?.trim() || existing.body,
      officialUrl: officialUrl?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.counselingRules.id, id))
    .returning();

  return NextResponse.json({ rule: updated });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id query param is required." }, { status: 400 });
  }

  await db.delete(schema.counselingRules).where(eq(schema.counselingRules.id, id));

  return NextResponse.json({ ok: true });
}