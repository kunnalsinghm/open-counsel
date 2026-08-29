import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { generateChoiceList } from "@/lib/recommendation-engine";
import { lintChoiceList } from "@/lib/linter";
import type { CutoffRow, StudentProfileInput } from "@/lib/types";

const ProfileSchema = z.object({
  examSystemCode: z.string(),
  year: z.number(),
  round: z.number(),
  crlRank: z.number().optional(),
  categoryRank: z.number().optional(),
  category: z.string(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  homeState: z.string(),
  domicileState: z.string(),
  quota: z.string(),
  seatPool: z.enum(["Gender-Neutral", "Female-Only"]),
  preferredBranches: z.array(z.string()),
  preferredInstituteTypes: z.array(z.string()),
  preferenceWeighting: z.enum([
    "COLLEGE_OVER_BRANCH",
    "BRANCH_OVER_COLLEGE",
    "BALANCED",
  ]),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const profile = parsed.data as StudentProfileInput;

  if (!profile.crlRank && !profile.categoryRank) {
    return NextResponse.json(
      { error: "At least one of crlRank or categoryRank is required." },
      { status: 400 }
    );
  }

  const [examSystem] = await db
    .select()
    .from(schema.examSystems)
    .where(eq(schema.examSystems.code, profile.examSystemCode))
    .limit(1);

  if (!examSystem) {
    return NextResponse.json(
      { error: `Unknown exam system "${profile.examSystemCode}".` },
      { status: 404 }
    );
  }

  const rawCutoffs = await db
    .select({
      cutoff: schema.cutoffRecords,
      institute: schema.institutes,
      branch: schema.branches,
    })
    .from(schema.cutoffRecords)
    .innerJoin(schema.institutes, eq(schema.cutoffRecords.instituteId, schema.institutes.id))
    .innerJoin(schema.branches, eq(schema.cutoffRecords.branchId, schema.branches.id))
    .where(
      and(
        eq(schema.cutoffRecords.examSystemId, examSystem.id),
        eq(schema.cutoffRecords.isUnavailable, false)
      )
    );

  if (rawCutoffs.length === 0) {
    return NextResponse.json(
      {
        error:
          "DATA_UNAVAILABLE: no cutoff data has been published yet for this exam. Run `npm run db:seed` for demo data or wait for the admin to publish a dataset.",
      },
      { status: 503 }
    );
  }

  const cutoffRows: CutoffRow[] = rawCutoffs.map((r) => ({
    instituteId: r.institute.id,
    instituteName: r.institute.name,
    instituteType: r.institute.instituteType,
    state: r.institute.state,
    nirfRank: r.institute.nirfRank,
    branchId: r.branch.id,
    branchName: r.branch.name,
    branchShortCode: r.branch.shortCode,
    year: r.cutoff.year,
    round: r.cutoff.round,
    quota: r.cutoff.quota,
    seatPool: r.cutoff.seatPool,
    category: r.cutoff.category,
    openingRank: r.cutoff.openingRank,
    closingRank: r.cutoff.closingRank,
  }));

  const latestYear = Math.max(...cutoffRows.map((r) => r.year));

  const items = generateChoiceList(cutoffRows, profile, { latestYear });
  const issues = lintChoiceList(items, profile);

  return NextResponse.json({
    dataDisclaimer:
      "These are historical-data-based estimates, not guarantees. Verify against the latest official counseling notification before making irreversible decisions.",
    latestYearUsed: latestYear,
    totalChoices: items.length,
    dream: items.filter((i) => i.riskBand === "DREAM"),
    target: items.filter((i) => i.riskBand === "TARGET"),
    safe: items.filter((i) => i.riskBand === "SAFE"),
    items,
    lintIssues: issues,
  });
}