import { CLASSIFICATION_THRESHOLDS as T } from "./config";
import type {
  ChoiceListItem,
  Confidence,
  CutoffRow,
  RiskBand,
  StudentProfileInput,
} from "./types";

export function isEligible(row: CutoffRow, profile: StudentProfileInput): boolean {
  if (row.quota !== profile.quota) return false;
  if (row.seatPool !== profile.seatPool) return false;
  if (row.category !== profile.category) return false;

  if (profile.quota === "HS" && profile.domicileState !== profile.homeState) {
    return false;
  }

  if (row.instituteType === "IIT" && !profile.jeeAdvancedRank && !profile.jeeAdvancedCategoryRank) {
    return false;
  }

  return true;
}

export function getStudentRankForComparison(
  profile: StudentProfileInput,
  instituteType: string
): number {
  if (instituteType === "IIT") {
    return profile.jeeAdvancedCategoryRank ?? profile.jeeAdvancedRank ?? Number.POSITIVE_INFINITY;
  }
  return profile.categoryRank ?? profile.crlRank ?? Number.POSITIVE_INFINITY;
}

function rankGapPercent(closingRank: number, studentRank: number): number {
  if (closingRank <= 0) return -Infinity;
  return ((closingRank - studentRank) / closingRank) * 100;
}

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
  return delta < 0 ? "TIGHTENING" : "LOOSENING";
}

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

export interface GenerateChoiceListOptions {
  latestYear: number;
}

export function generateChoiceList(
  allCutoffs: CutoffRow[],
  profile: StudentProfileInput,
  options: GenerateChoiceListOptions
): ChoiceListItem[] {
  const hasJeeMain = Number.isFinite(getStudentRankForComparison(profile, "NIT"));
  const hasJeeAdvanced = Number.isFinite(getStudentRankForComparison(profile, "IIT"));
  if (!hasJeeMain && !hasJeeAdvanced) return [];

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
    const latest = rows
      .filter((r) => r.year === options.latestYear)
      .sort((a, b) => b.round - a.round)[0] ?? rows.sort((a, b) => b.year - a.year)[0];

    if (!latest) continue;

    const studentRank = getStudentRankForComparison(profile, latest.instituteType);
    if (!Number.isFinite(studentRank)) continue;

    const gap = rankGapPercent(latest.closingRank, studentRank);
    const band = classifyBand(gap);
    const trend = computeTrend(rows);
    const years = Array.from(new Set(rows.map((r) => r.year))).sort();
    const confidence = classifyConfidence(years, trend);
    const utility = preferenceUtility(latest, profile);

    if (gap < T.DREAM_MIN_GAP_PERCENT) continue;

    const rankTypeLabel = latest.instituteType === "IIT" ? "JEE Advanced" : "JEE Main";
    const reasonParts: string[] = [];
    reasonParts.push(
      `In ${latest.year} Round ${latest.round}, ${latest.instituteName} ${latest.branchShortCode} (${latest.quota}, ${latest.category}) closed at rank ${latest.closingRank.toLocaleString(
        "en-IN"
      )}.`
    );
    reasonParts.push(
      `Your ${rankTypeLabel} comparison rank of ${studentRank.toLocaleString("en-IN")} is ${
        gap >= 0 ? `${gap.toFixed(1)}% better` : `${Math.abs(gap).toFixed(1)}% worse`
      } than that closing rank.`
    );
    if (trend !== "UNKNOWN") {
      reasonParts.push(
        `Historical trend across ${years.length} year(s) is ${trend.toLowerCase()}.`
      );
    }

    items.push({
      preferenceNumber: 0,
      instituteId: latest.instituteId,
      instituteName: latest.instituteName,
      instituteType: latest.instituteType,
      branchId: latest.branchId,
      branchName: latest.branchName,
      branchShortCode: latest.branchShortCode,
      quota: latest.quota,
      seatPool: latest.seatPool,
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

    (items[items.length - 1] as any).__utility = utility;
  }

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