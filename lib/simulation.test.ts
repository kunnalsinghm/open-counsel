import { describe, it, expect } from "vitest";
import { simulateRounds } from "./simulation";
import type { ChoiceListItem, CutoffRow, StudentProfileInput } from "./types";

function makeProfile(overrides: Partial<StudentProfileInput> = {}): StudentProfileInput {
  return {
    examSystemCode: "JOSAA",
    year: 2024,
    round: 1,
    categoryRank: 15000,
    category: "OPEN",
    gender: "MALE",
    homeState: "West Bengal",
    domicileState: "West Bengal",
    quota: "OS",
    seatPool: "Gender-Neutral",
    preferredBranches: ["CE"],
    preferredInstituteTypes: ["NIT"],
    preferenceWeighting: "BALANCED",
    ...overrides,
  };
}

function makeItem(overrides: Partial<ChoiceListItem> = {}): ChoiceListItem {
  return {
    preferenceNumber: 1,
    instituteId: "inst_1",
    instituteName: "NIT Durgapur",
    instituteType: "NIT",
    branchId: "branch_1",
    branchName: "Computer Science",
    branchShortCode: "CE",
    quota: "OS",
    seatPool: "Gender-Neutral",
    category: "OPEN",
    historicalOpeningRank: 10000,
    historicalClosingRank: 16000,
    studentRank: 15000,
    rankGapPercent: 6.25,
    riskBand: "TARGET",
    confidence: "HIGH",
    reason: "test reason",
    historicalYearsAvailable: [2024],
    trendDirection: "STABLE",
    ...overrides,
  };
}

function makeRow(overrides: Partial<CutoffRow> = {}): CutoffRow {
  return {
    instituteId: "inst_1",
    instituteName: "NIT Durgapur",
    instituteType: "NIT",
    state: "West Bengal",
    nirfRank: 50,
    branchId: "branch_1",
    branchName: "Computer Science",
    branchShortCode: "CE",
    year: 2024,
    round: 1,
    quota: "OS",
    seatPool: "Gender-Neutral",
    category: "OPEN",
    openingRank: 10000,
    closingRank: 16000,
    ...overrides,
  };
}

function comboKey(item: ChoiceListItem) {
  return `${item.instituteId}::${item.branchId}::${item.quota}::${item.category}::${item.seatPool}`;
}

describe("simulateRounds", () => {
  it("marks a round Unlikely when no choice is reachable", () => {
    const items = [makeItem()];
    const profile = makeProfile({ categoryRank: 50000 });
    const cutoffs = new Map([
      [comboKey(items[0]), new Map([[1, makeRow({ round: 1, closingRank: 16000 })]])],
    ]);
    const result = simulateRounds(items, profile, cutoffs, 1);
    expect(result).toHaveLength(1);
    expect(result[0].outcomeLabel).toBe("Unlikely");
    expect(result[0].likelyPreferenceNumber).toBeNull();
  });

  it("picks a reachable choice and reports its closing rank", () => {
    const items = [makeItem()];
    const profile = makeProfile({ categoryRank: 15000 });
    const cutoffs = new Map([
      [comboKey(items[0]), new Map([[1, makeRow({ round: 1, closingRank: 18000 })]])],
    ]);
    const result = simulateRounds(items, profile, cutoffs, 1);
    expect(result).toHaveLength(1);
    expect(result[0].likelyPreferenceNumber).toBe(1);
    expect(result[0].likelyClosingRank).toBe(18000);
  });

  it("prefers the highest-preference reachable choice, not just the first reachable one", () => {
    const items = [
      makeItem({ preferenceNumber: 1, instituteId: "inst_1", branchId: "branch_1", historicalClosingRank: 12000 }),
      makeItem({ preferenceNumber: 2, instituteId: "inst_2", branchId: "branch_2", historicalClosingRank: 20000 }),
    ];
    const profile = makeProfile({ categoryRank: 15000 });
    const cutoffs = new Map([
      [comboKey(items[0]), new Map([[1, makeRow({ instituteId: "inst_1", branchId: "branch_1", round: 1, closingRank: 12000 })]])],
      [comboKey(items[1]), new Map([[1, makeRow({ instituteId: "inst_2", branchId: "branch_2", round: 1, closingRank: 20000 })]])],
    ]);
    const result = simulateRounds(items, profile, cutoffs, 1);
    // pref #1 is not reachable (student rank 15000 > closing 12000), pref #2 is reachable
    expect(result[0].likelyPreferenceNumber).toBe(2);
  });

  it("produces one outcome entry per round up to maxRound", () => {
    const items = [makeItem()];
    const profile = makeProfile({ categoryRank: 15000 });
    const cutoffs = new Map([
      [
        comboKey(items[0]),
        new Map([
          [1, makeRow({ round: 1, closingRank: 16000 })],
          [2, makeRow({ round: 2, closingRank: 17000 })],
          [3, makeRow({ round: 3, closingRank: 18000 })],
        ]),
      ],
    ]);
    const result = simulateRounds(items, profile, cutoffs, 3);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.round)).toEqual([1, 2, 3]);
  });

  it("reflects closing rank movement across rounds for the same choice", () => {
    const items = [makeItem()];
    const profile = makeProfile({ categoryRank: 15500 });
    const cutoffs = new Map([
      [
        comboKey(items[0]),
        new Map([
          [1, makeRow({ round: 1, closingRank: 15579 })],
          [2, makeRow({ round: 2, closingRank: 15920 })],
          [3, makeRow({ round: 3, closingRank: 15959 })],
        ]),
      ],
    ]);
    const result = simulateRounds(items, profile, cutoffs, 3);
    const closingRanks = result.map((r) => r.likelyClosingRank);
    expect(closingRanks).toEqual([15579, 15920, 15959]);
  });

  it("skips a choice missing data for a given round without throwing", () => {
    const items = [makeItem()];
    const profile = makeProfile({ categoryRank: 15000 });
    const cutoffs = new Map([
      [comboKey(items[0]), new Map([[1, makeRow({ round: 1, closingRank: 16000 })]])],
      // no round 2 data for this combo
    ]);
    const result = simulateRounds(items, profile, cutoffs, 2);
    expect(result).toHaveLength(2);
    expect(result[0].outcomeLabel).not.toBe("Unlikely");
    expect(result[1].outcomeLabel).toBe("Unlikely");
  });
});