import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, ne, sql, type SQL } from "drizzle-orm";
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
  jeeAdvancedRank: z.number().optional(),
  jeeAdvancedCategoryRank: z.number().optional(),
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
      { error: "Invalid profile.", issues: z.flattenError(parsed.error) },
      { status: 400 }
    );
  }
  const profile = parsed.data as StudentProfileInput;

  if (
    !profile.crlRank &&
    !profile.categoryRank &&
    !profile.jeeAdvancedRank &&
    !profile.jeeAdvancedCategoryRank
  ) {
    return NextResponse.json(
      {
        error:
          "At least one rank is required: JEE Main (crlRank/categoryRank) and/or JEE Advanced (jeeAdvancedRank/jeeAdvancedCategoryRank).",
      },
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

  // The engine only ever keeps rows that match the student's quota, category and seat pool
  // (and, for HS/OS, the institute's state), so filter in SQL instead of loading the whole
  // table and discarding most of it in JavaScript. The engine still re-checks every rule.
  const filters: SQL[] = [
    eq(schema.cutoffRecords.examSystemId, examSystem.id),
    eq(schema.cutoffRecords.isUnavailable, false),
    eq(schema.cutoffRecords.quota, profile.quota),
    eq(schema.cutoffRecords.category, profile.category),
    eq(schema.cutoffRecords.seatPool, profile.seatPool),
  ];
  if (profile.quota === "HS") filters.push(eq(schema.institutes.state, profile.homeState));
  if (profile.quota === "OS") filters.push(ne(schema.institutes.state, profile.homeState));

  const rawCutoffs = await db
    .select({
      cutoff: schema.cutoffRecords,
      institute: schema.institutes,
      branch: schema.branches,
    })
    .from(schema.cutoffRecords)
    .innerJoin(schema.institutes, eq(schema.cutoffRecords.instituteId, schema.institutes.id))
    .innerJoin(schema.branches, eq(schema.cutoffRecords.branchId, schema.branches.id))
    .where(and(...filters));

  // Latest year available for this exam overall (not just the filtered rows), so the
  // answer does not change depending on which quota the student picked.
  const [{ latestYear: examLatestYear }] = await db
    .select({ latestYear: sql<number | null>`max(${schema.cutoffRecords.year})` })
    .from(schema.cutoffRecords)
    .where(
      and(
        eq(schema.cutoffRecords.examSystemId, examSystem.id),
        eq(schema.cutoffRecords.isUnavailable, false)
      )
    );

  if (examLatestYear === null) {
    return NextResponse.json(
      {
        error:
          "DATA_UNAVAILABLE: no cutoff data has been published yet for this exam. An admin needs to upload a cutoff CSV first.",
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

  const latestYear = Number(examLatestYear);

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