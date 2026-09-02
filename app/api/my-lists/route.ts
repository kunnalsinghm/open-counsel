import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const rows = await db
    .select({
      list: schema.savedChoiceLists,
      profile: schema.studentProfiles,
    })
    .from(schema.savedChoiceLists)
    .innerJoin(
      schema.studentProfiles,
      eq(schema.savedChoiceLists.profileId, schema.studentProfiles.id)
    )
    .where(eq(schema.savedChoiceLists.userId, user.id))
    .orderBy(desc(schema.savedChoiceLists.createdAt));

  return NextResponse.json({
    lists: rows.map((r) => ({
      id: r.list.id,
      createdAt: r.list.createdAt,
      itemCount: Array.isArray(r.list.items) ? r.list.items.length : 0,
      items: r.list.items,
      profile: {
        examSystemCode: r.profile.examSystemCode,
        category: r.profile.category,
        crlRank: r.profile.crlRank,
        categoryRank: r.profile.categoryRank,
        jeeAdvancedRank: r.profile.jeeAdvancedRank,
        jeeAdvancedCategoryRank: r.profile.jeeAdvancedCategoryRank,
        quota: r.profile.quota,
        homeState: r.profile.homeState,
        gender: r.profile.gender,
        domicileState: r.profile.domicileState,
        seatPool: r.profile.seatPool,
        year: r.profile.year,
        round: r.profile.round,
        preferredBranches: r.profile.preferredBranches,
        preferredInstituteTypes: r.profile.preferredInstituteTypes,
        preferenceWeighting: r.profile.preferenceWeighting,
      },
    })),
  });
}