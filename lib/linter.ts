import {
  MIN_RECOMMENDED_CHOICES,
  MIN_RECOMMENDED_SAFE_CHOICES,
} from "./config";
import type { ChoiceListItem, LintIssue, StudentProfileInput } from "./types";

/**
 * Deterministic, explainable rule checks over a student's ordered choice
 * list. Never mutates the list — only reports issues for the student to
 * act on.
 */
export function lintChoiceList(
  items: ChoiceListItem[],
  profile: StudentProfileInput
): LintIssue[] {
  const issues: LintIssue[] = [];

  // 1. Duplicate choices
  const seen = new Map<string, number[]>();
  for (const item of items) {
    const key = `${item.instituteId}::${item.branchId}::${item.quota}::${item.category}`;
    const arr = seen.get(key) ?? [];
    arr.push(item.preferenceNumber);
    seen.set(key, arr);
  }
  for (const [, prefs] of seen) {
    if (prefs.length > 1) {
      issues.push({
        severity: "ERROR",
        code: "DUPLICATE_CHOICE",
        message: `Choices #${prefs.join(", #")} are identical (same institute, branch, quota and category). Remove duplicates.`,
        affectedPreferenceNumbers: prefs,
      });
    }
  }

  // 2. List length
  if (items.length < MIN_RECOMMENDED_CHOICES) {
    issues.push({
      severity: "WARNING",
      code: "LIST_TOO_SHORT",
      message: `Your list has only ${items.length} choices. Most counseling experts recommend at least ${MIN_RECOMMENDED_CHOICES} to avoid missing out on rounds where seats free up unexpectedly.`,
    });
  }

  // 3. Safe options present
  const safeCount = items.filter((i) => i.riskBand === "SAFE").length;
  if (safeCount < MIN_RECOMMENDED_SAFE_CHOICES) {
    issues.push({
      severity: "WARNING",
      code: "TOO_FEW_SAFE_CHOICES",
      message: `Only ${safeCount} Safe choices in your list. Consider adding at least ${MIN_RECOMMENDED_SAFE_CHOICES} to guarantee a backup seat.`,
    });
  }

  // 4. Dominated-choice check: a lower-ranked-by-institute-tier branch
  // placed above a higher-tier institute for the *same branch* is very
  // likely a mistake, unless the student's weighting explicitly favors
  // branch over college.
  const tierRank: Record<string, number> = { IIT: 0, NIT: 1, IIIT: 2, GFTI: 3, MEDICAL: 1 };
  if (profile.preferenceWeighting !== "BRANCH_OVER_COLLEGE") {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (a.branchShortCode !== b.branchShortCode) continue;
        const tierA = tierRank[a.instituteType] ?? 9;
        const tierB = tierRank[b.instituteType] ?? 9;
        // a is ranked above b (i < j) but a's institute tier is worse
        if (tierA > tierB) {
          issues.push({
            severity: "WARNING",
            code: "DOMINATED_CHOICE_ORDER",
            message: `Choice #${a.preferenceNumber} (${a.instituteName} ${a.branchShortCode}) is ranked above choice #${b.preferenceNumber} (${b.instituteName} ${b.branchShortCode}), but ${b.instituteName} is generally a higher-tier institute for the same branch. Review this ordering.`,
            affectedPreferenceNumbers: [a.preferenceNumber, b.preferenceNumber],
          });
        }
      }
    }
  }

  // 5. Quota validity
  if (profile.quota === "HS" && profile.domicileState !== profile.homeState) {
    issues.push({
      severity: "ERROR",
      code: "INVALID_QUOTA_CLAIM",
      message: `You selected the Home State (HS) quota, but your domicile state (${profile.domicileState}) does not match your declared home state (${profile.homeState}). This combination is not valid.`,
    });
  }

  // 6. Choices outside the selected counseling system are structurally
  // impossible in this data model (each row is generated from the same
  // examSystemCode), so no separate check is needed here — enforced
  // upstream by the recommendation engine's eligibility filter.

  return issues;
}
