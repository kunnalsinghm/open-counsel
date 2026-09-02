import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { simulateRounds } from "@/lib/simulation";
import type { ChoiceListItem, CutoffRow, StudentProfileInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.profile || !Array.isArray(body?.items)) {
    return NextResponse.json(
      { error: "Expected { profile: StudentProfileInput, items: ChoiceListItem[] }" },
      { status: 400 }
    );
  }
  const profile = body.profile as StudentProfileInput;
  const items = body.items as ChoiceListItem[];

  if (items.length === 0) {
    return NextResponse.json({ error: "No choices to simulate." }, { status: 400 });
  }

  const [examSystem] = await db
    .select()
    .from(schema.examSystems)
    .where(eq(schema.examSystems.code, profile.examSystemCode))
    .limit(1);

  if (!examSystem) {
    return NextResponse.json({ error: "Unknown exam system." }, { status: 404 });
  }

  const instituteIds = Array.from(new Set(items.map((i) => i.instituteId)));
  const branchIds = Array.from(new Set(items.map((i) => i.branchId)));

  const rows = await db
    .select()
    .from(schema.cutoffRecords)
    .where(
      and(
        eq(schema.cutoffRecords.examSystemId, examSystem.id),
        eq(schema.cutoffRecords.isUnavailable, false),
        inArray(schema.cutoffRecords.instituteId, instituteIds),
        inArray(schema.cutoffRecords.branchId, branchIds)
      )
    );

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "DATA_UNAVAILABLE: no round-by-round data found for these choices." },
      { status: 503 }
    );
  }

  const latestYear = Math.max(...rows.map((r) => r.year));
  const maxRound = Math.max(...rows.filter((r) => r.year === latestYear).map((r) => r.round));

  const cutoffsByComboAndRound = new Map<string, Map<number, CutoffRow>>();
  for (const r of rows) {
    if (r.year !== latestYear) continue;
    const item = items.find(
      (i) =>
        i.instituteId === r.instituteId &&
        i.branchId === r.branchId &&
        i.quota === r.quota &&
        i.category === r.category
    );
    if (!item) continue;

    const comboKey = `${r.instituteId}::${r.branchId}::${r.quota}::${r.category}::${r.seatPool}`;
    const cutoffRow: CutoffRow = {
      instituteId: r.instituteId,
      instituteName: item.instituteName,
      instituteType: item.instituteType,
      state: "",
      nirfRank: null,
      branchId: r.branchId,
      branchName: item.branchName,
      branchShortCode: item.branchShortCode,
      year: r.year,
      round: r.round,
      quota: r.quota,
      seatPool: r.seatPool,
      category: r.category,
      openingRank: r.openingRank,
      closingRank: r.closingRank,
    };

    if (!cutoffsByComboAndRound.has(comboKey)) {
      cutoffsByComboAndRound.set(comboKey, new Map());
    }
    cutoffsByComboAndRound.get(comboKey)!.set(r.round, cutoffRow);
  }

  const outcomes = simulateRounds(items, profile, cutoffsByComboAndRound, maxRound);

  return NextResponse.json({
    disclaimer:
      "This is a HISTORICAL SIMULATION based on past years' round-by-round closing rank movement - it does not reproduce JoSAA's actual live seat allocation, which depends on real-time seat availability and every other candidate's choices. Always verify against the official portal.",
    latestYearUsed: latestYear,
    maxRound,
    outcomes,
  });
}