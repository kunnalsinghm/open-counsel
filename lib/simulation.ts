import { classifyBand, getStudentRankForComparison } from "./recommendation-engine";
import type { ChoiceListItem, CutoffRow, RiskBand, StudentProfileInput } from "./types";

export type OutcomeLabel = "Strong" | "Possible" | "Risky" | "Unlikely";

function bandToOutcomeLabel(band: RiskBand): OutcomeLabel {
  if (band === "SAFE") return "Strong";
  if (band === "TARGET") return "Possible";
  return "Risky";
}

export interface RoundOutcome {
  round: number;
  likelyPreferenceNumber: number | null;
  likelyInstituteName: string | null;
  likelyBranchShortCode: string | null;
  likelyClosingRank: number | null;
  outcomeLabel: OutcomeLabel;
  explanation: string;
}

export function simulateRounds(
  items: ChoiceListItem[],
  profile: StudentProfileInput,
  cutoffsByComboAndRound: Map<string, Map<number, CutoffRow>>,
  maxRound: number
): RoundOutcome[] {
  const outcomes: RoundOutcome[] = [];

  for (let round = 1; round <= maxRound; round++) {
    let picked: { item: ChoiceListItem; row: CutoffRow } | null = null;

    for (const item of items) {
      const comboKey = `${item.instituteId}::${item.branchId}::${item.quota}::${item.category}::${item.seatPool}`;
      const roundsForCombo = cutoffsByComboAndRound.get(comboKey);
      const row = roundsForCombo?.get(round);
      if (!row) continue;

      const studentRank = getStudentRankForComparison(profile, item.instituteType);
      if (!Number.isFinite(studentRank)) continue;

      if (studentRank <= row.closingRank) {
        picked = { item, row };
        break;
      }
    }

    if (!picked) {
      outcomes.push({
        round,
        likelyPreferenceNumber: null,
        likelyInstituteName: null,
        likelyBranchShortCode: null,
        likelyClosingRank: null,
        outcomeLabel: "Unlikely",
        explanation: `Based on Round ${round} historical closing ranks, none of your listed choices look reachable yet at this round. This can still change in later rounds as seats free up.`,
      });
      continue;
    }

    const studentRank = getStudentRankForComparison(profile, picked.item.instituteType);
    const gap = ((picked.row.closingRank - studentRank) / picked.row.closingRank) * 100;
    const band = classifyBand(gap);
    const label = bandToOutcomeLabel(band);

    outcomes.push({
      round,
      likelyPreferenceNumber: picked.item.preferenceNumber,
      likelyInstituteName: picked.item.instituteName,
      likelyBranchShortCode: picked.item.branchShortCode,
      likelyClosingRank: picked.row.closingRank,
      outcomeLabel: label,
      explanation: `At Round ${round}, your highest-preference reachable choice is #${picked.item.preferenceNumber} (${picked.item.instituteName} ${picked.item.branchShortCode}), based on that round's historical closing rank of ${picked.row.closingRank.toLocaleString(
        "en-IN"
      )}.`,
    });
  }

  return outcomes;
}