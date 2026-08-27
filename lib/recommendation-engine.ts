import { CLASSIFICATION_THRESHOLDS as T } from "./config";
import type {
  ChoiceListItem,
  Confidence,
  CutoffRow,
  RiskBand,
  StudentProfileInput,
} from "./types";

/**
 * The recommendation pipeline is intentionally split into independently
 * testable stages, per the product spec:
 *
 *   EligibilityEngine -> CutoffEngine -> PreferenceEngine -> RiskEngine
 *   -> ChoiceOptimizer -> ExplanationEngine
 *
 * The LLM never touches this file. All ordering and classification here is
 * deterministic and fully explainable.
 */

// ---------- 1. EligibilityEngine ----------

export function isEligible(row: CutoffRow, profile: StudentProfileInput): boolean {
  if (row.quota !== profile.quota) return false;
  if (row.seatPool !== profile.seatPool) return false;
  if (row.category !== profile.category) return false;

  // Home-state quota sanity check: "HS" (Home State) quota is only valid
  // when the student's domicile matches the institute's state-linked quota.
  // (For central institutes like IITs this doesn't apply; NITs/state quota
  // seats do enforce this.)
  if (profile.quota === "HS" && profile.domicileState !== profile.homeState) {
    return false;
  }

  return true;
}

// ---------- 2. CutoffEngine ----------

export function getStudentRankForComparison(profile: StudentProfileInput): number {
  // Category rank is used when available (it's what actually determines
  // eligibility against category-specific cutoffs); fall back to CRL.
  return profile.categoryRank ?? profile.crlRank ?? Number.POSITIVE_INFINITY;
}

function rankGapPercent(closingRank: number, studentRank: number): number {
  if (closingRank <= 0) return -Infinity;
  return ((closingRank - studentRank) / closingRank) * 100;
}

// ---------- 3. RiskEngine ----------

export function classifyBand(gapPercent: number): RiskBand {
  if (gapPercent >= T.SAFE_MIN_GAP_PERCENT) return "SAFE";
  if (gapPercent >= T.TARGET_MIN_GAP_PERCENT) return "TARGET";
  return "DREAM";
}

export function classifyConfidence(historicalYears: number[], trend: string): Confidence {
  if (historicalYears.length >= 3 && trend !== "UNKNOWN") return "HIGH";
  if (historicalYears.length >= 2) return "MEDIUM";
  return "LOW";
}

function computeTrend(sameComboAcrossYears: CutoffRow[]): "TIGHTENING" | "LOOSENING" | "STABLE" | "UNKNOWN" {
  if (sameComboAcrossYears.length < 2) return "UNKNOWN";
  const sorted = [...sameComboAcrossYears].sort((a, b) => a.year - b.year);
  const first = sorted[0].closingRank;
  const last = sorted[sorted.length - 1].closingRank;
  const delta = ((last - first) / first) * 100;
  if (Math.abs(delta) < 5) return "STABLE";
  // Closing rank getting lower (numerically smaller) over years = tightening
  // (harder to get in). Getting larger = loosening (easier).
  return delta < 0 ? "TIGHTENING" : "LOOSENING";
}

// ---------- 4. PreferenceEngine ----------

function preferenceUtility(
  row: CutoffRow,
  profile: StudentProfileInput
): number {
  let score = 0;
  const branchMatch = profile.preferredBranches.includes(row.branchShortCode);
  const typeMatch = profile.preferredInstituteTypes.includes(row.instituteType);
  const nirfBoost = row.nirfRank ? Math.max(0, 100 - row.nirfRank) / 100 : 0;

  if (profile.preferenceWeighting === "BRANCH_OVER_COLLEGE") {
    score += branchMatch ? 3 : 0;
    score += typeMatch ? 1 : 0;
    score += nirfBoost * 0.5;
  } else if (profile.preferenceWeighting === "COLLEGE_OVER_BRANCH") {
    score += typeMatch ? 3 : 0;
    score += branchMatch ? 1 : 0;
    score += nirfBoost * 1.5;
  } else {
    score += branchMatch ? 2 : 0;
    score += typeMatch ? 2 : 0;
    score += nirfBoost;
  }
  return score;
}

// ---------- 5. ChoiceOptimizer + 6. ExplanationEngine ----------

export interface GenerateChoiceListOptions {
  latestYear: number;
}

export function generateChoiceList(
  allCutoffs: CutoffRow[],
  profile: StudentProfileInput,
  options: GenerateChoiceListOptions
): ChoiceListItem[] {
  const studentRank = getStudentRankForComparison(profile);
  if (!Number.isFinite(studentRank)) return [];

  // Group historical rows by institute+branch+quota+category+seatPool combo
  const byCombo = new Map<string, CutoffRow[]>();
  for (const row of allCutoffs) {
    if (!isEligible(row, profile)) continue;
    const key = `${row.instituteId}::${row.branchId}::${row.quota}::${row.category}::${row.seatPool}`;
    const arr = byCombo.get(key) ?? [];
    arr.push(row);
    byCombo.set(key, arr);
  }

  const items: ChoiceListItem[] = [];

  for (const [, rows] of byCombo) {
    // Use the most recent year's closing rank as the primary reference point.
    const latest = rows
      .filter((r) => r.year === options.latestYear)
      .sort((a, b) => b.round - a.round)[0] ?? rows.sort((a, b) => b.year - a.year)[0];

    if (!latest) continue;

    const gap = rankGapPercent(latest.closingRank, studentRank);
    const band = classifyBand(gap);
    const trend = computeTrend(rows);
    const years = Array.from(new Set(rows.map((r) => r.year))).sort();
    const confidence = classifyConfidence(years, trend);
    const utility = preferenceUtility(latest, profile);

    // Exclude combos where the student's rank is far outside even a DREAM
    // shot (more than 15% worse than closing rank) — not realistically
    // worth listing.
    if (gap < T.DREAM_MIN_GAP_PERCENT) continue;

    const reasonParts: string[] = [];
    reasonParts.push(
      `In ${latest.year} Round ${latest.round}, ${latest.instituteName} ${latest.branchShortCode} (${latest.quota}, ${latest.category}) closed at rank ${latest.closingRank.toLocaleString(
        "en-IN"
      )}.`
    );
    reasonParts.push(
      `Your comparison rank of ${studentRank.toLocaleString("en-IN")} is ${
        gap >= 0 ? `${gap.toFixed(1)}% better` : `${Math.abs(gap).toFixed(1)}% worse`
      } than that closing rank.`
    );
    if (trend !== "UNKNOWN") {
      reasonParts.push(
        `Historical trend across ${years.length} year(s) is ${trend.toLowerCase()}.`
      );
    }

    items.push({
      preferenceNumber: 0, // assigned after sorting
      instituteId: latest.instituteId,
      instituteName: latest.instituteName,
      instituteType: latest.instituteType,
      branchId: latest.branchId,
      branchName: latest.branchName,
      branchShortCode: latest.branchShortCode,
      quota: latest.quota,
      category: latest.category,
      historicalOpeningRank: latest.openingRank,
      historicalClosingRank: latest.closingRank,
      studentRank,
      rankGapPercent: Number(gap.toFixed(2)),
      riskBand: band,
      confidence,
      reason: reasonParts.join(" "),
      historicalYearsAvailable: years,
      trendDirection: trend,
    });

    // stash utility for sorting without adding it to the public type
    (items[items.length - 1] as any).__utility = utility;
  }

  // Ordering rule: DREAM first, then TARGET, then SAFE (mathematically
  // optimal default per spec) — within each band, sort by preference
  // utility (branch/college fit) descending, then by tightest realistic
  // gap first (closest to the student's actual rank) so the most
  // "efficient" choices within a band come first.
  const bandOrder: Record<RiskBand, number> = { DREAM: 0, TARGET: 1, SAFE: 2 };
  items.sort((a, b) => {
    if (bandOrder[a.riskBand] !== bandOrder[b.riskBand]) {
      return bandOrder[a.riskBand] - bandOrder[b.riskBand];
    }
    const utilDiff = (b as any).__utility - (a as any).__utility;
    if (Math.abs(utilDiff) > 0.01) return utilDiff;
    return a.rankGapPercent - b.rankGapPercent;
  });

  items.forEach((item, idx) => {
    item.preferenceNumber = idx + 1;
    delete (item as any).__utility;
  });

  return items;
}
