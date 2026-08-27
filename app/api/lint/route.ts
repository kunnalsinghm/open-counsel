import { NextRequest, NextResponse } from "next/server";
import { lintChoiceList } from "@/lib/linter";
import type { ChoiceListItem, StudentProfileInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || !body.profile) {
    return NextResponse.json(
      { error: "Expected { items: ChoiceListItem[], profile: StudentProfileInput }" },
      { status: 400 }
    );
  }
  const items = body.items as ChoiceListItem[];
  const profile = body.profile as StudentProfileInput;
  const issues = lintChoiceList(items, profile);
  return NextResponse.json({ issues });
}
