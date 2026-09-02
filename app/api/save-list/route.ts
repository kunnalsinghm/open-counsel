import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { createClient } from "@/lib/supabase/server";
import type { ChoiceListItem, StudentProfileInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in to save a list." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.profile || !Array.isArray(body?.items)) {
    return NextResponse.json(
      { error: "Expected { profile: StudentProfileInput, items: ChoiceListItem[] }" },
      { status: 400 }
    );
  }
  const profile = body.profile as StudentProfileInput;
  const items = body.items as ChoiceListItem[];

  const [existingUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  if (!existingUser) {
    await db.insert(schema.users).values({
      id: user.id,
      email: user.email ?? null,
    });
  }

  const [savedProfile] = await db
    .insert(schema.studentProfiles)
    .values({
      userId: user.id,
      examSystemCode: profile.examSystemCode,
      year: profile.year,
      round: profile.round,
      crlRank: profile.crlRank,
      categoryRank: profile.categoryRank,
      jeeAdvancedRank: profile.jeeAdvancedRank,
      jeeAdvancedCategoryRank: profile.jeeAdvancedCategoryRank,
      category: profile.category,
      gender: profile.gender,
      homeState: profile.homeState,
      domicileState: profile.domicileState,
      quota: profile.quota,
      seatPool: profile.seatPool,
      preferredBranches: profile.preferredBranches,
      preferredInstituteTypes: profile.preferredInstituteTypes,
      preferenceWeighting: profile.preferenceWeighting,
    })
    .returning();

  const [savedList] = await db
    .insert(schema.savedChoiceLists)
    .values({
      userId: user.id,
      profileId: savedProfile.id,
      items,
    })
    .returning();

  return NextResponse.json({ savedListId: savedList.id });
}