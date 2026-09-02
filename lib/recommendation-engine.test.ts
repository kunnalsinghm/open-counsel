import { describe, it, expect } from "vitest";
import {
  isEligible,
  getStudentRankForComparison,
  classifyBand,
  classifyConfidence,
  generateChoiceList,
} from "./recommendation-engine";
import type { CutoffRow, StudentProfileInput } from "./types";

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

function makeCutoff(overrides: Partial<CutoffRow> = {}): CutoffRow {
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

describe("isEligible", () => {
  it("passes when quota, seatPool, and category all match", () => {
    expect(isEligible(makeCutoff(), makeProfile())).toBe(true);
  });

  it("fails when quota does not match", () => {
    expect(isEligible(makeCutoff({ quota: "HS" }), makeProfile({ quota: "OS" }))).toBe(false);
  });

  it("fails when seatPool does not match", () => {
    expect(
      isEligible(makeCutoff({ seatPool: "Female-Only" }), makeProfile({ seatPool: "Gender-Neutral" }))
    ).toBe(false);
  });

  it("fails when category does not match", () => {
    expect(isEligible(makeCutoff({ category: "OBC-NCL" }), makeProfile({ category: "OPEN" }))).toBe(
      false
    );
  });

  it("fails HS quota when domicile state does not match home state", () => {
    const profile = makeProfile({ quota: "HS", homeState: "Kerala", domicileState: "West Bengal" });
    expect(isEligible(makeCutoff({ quota: "HS" }), profile)).toBe(false);
  });

  it("passes HS quota when domicile state matches home state", () => {
    const profile = makeProfile({ quota: "HS", homeState: "West Bengal", domicileState: "West Bengal" });
    expect(isEligible(makeCutoff({ quota: "HS" }), profile)).toBe(true);
  });

  it("fails IIT rows when student has no JEE Advanced rank", () => {
    const row = makeCutoff({ instituteType: "IIT" });
    const profile = makeProfile({ jeeAdvancedRank: undefined, jeeAdvancedCategoryRank: undefined });
    expect(isEligible(row, profile)).toBe(false);
  });

  it("passes IIT rows when student has a JEE Advanced rank", () => {
    const row = makeCutoff({ instituteType: "IIT" });
    const profile = makeProfile({ jeeAdvancedRank: 5000 });
    expect(isEligible(row, profile)).toBe(true);
  });
});

describe("getStudentRankForComparison", () => {
  it("uses categoryRank over crlRank for non-IIT institutes", () => {
    const profile = makeProfile({ categoryRank: 12000, crlRank: 20000 });
    expect(getStudentRankForComparison(profile, "NIT")).toBe(12000);
  });

  it("falls back to crlRank when categoryRank is absent", () => {
    const profile = makeProfile({ categoryRank: undefined, crlRank: 20000 });
    expect(getStudentRankForComparison(profile, "NIT")).toBe(20000);
  });

  it("uses jeeAdvancedCategoryRank over jeeAdvancedRank for IIT", () => {
    const profile = makeProfile({ jeeAdvancedCategoryRank: 3000, jeeAdvancedRank: 8000 });
    expect(getStudentRankForComparison(profile, "IIT")).toBe(3000);
  });

  it("returns Infinity when no relevant rank is available", () => {
    const profile = makeProfile({ categoryRank: undefined, crlRank: undefined });
    expect(getStudentRankForComparison(profile, "NIT")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("classifyBand", () => {
  it("classifies a large positive gap as SAFE", () => {
    expect(classifyBand(20)).toBe("SAFE");
  });

  it("classifies a moderate positive gap as TARGET", () => {
    expect(classifyBand(8)).toBe("TARGET");
  });

  it("classifies a small or negative gap as DREAM", () => {
    expect(classifyBand(0)).toBe("DREAM");
    expect(classifyBand(-10)).toBe("DREAM");
  });
});

describe("classifyConfidence", () => {
  it("returns HIGH with 3+ years and a known trend", () => {
    expect(classifyConfidence([2022, 2023, 2024], "STABLE")).toBe("HIGH");
  });

  it("returns MEDIUM with exactly 2 years", () => {
    expect(classifyConfidence([2023, 2024], "STABLE")).toBe("MEDIUM");
  });

  it("returns LOW with fewer than 2 years", () => {
    expect(classifyConfidence([2024], "UNKNOWN")).toBe("LOW");
  });

  it("returns MEDIUM (not HIGH) with 3+ years but unknown trend", () => {
    expect(classifyConfidence([2022, 2023, 2024], "UNKNOWN")).toBe("MEDIUM");
  });
});

describe("generateChoiceList", () => {
  it("returns an empty list when the student has no usable rank", () => {
    const profile = makeProfile({ categoryRank: undefined, crlRank: undefined });
    const result = generateChoiceList([makeCutoff()], profile, { latestYear: 2024 });
    expect(result).toEqual([]);
  });

  it("excludes ineligible rows", () => {
    const row = makeCutoff({ quota: "HS" });
    const profile = makeProfile({ quota: "OS" });
    const result = generateChoiceList([row], profile, { latestYear: 2024 });
    expect(result).toEqual([]);
  });

  it("includes an eligible reachable choice and assigns preference numbers starting at 1", () => {
    const row = makeCutoff({ closingRank: 20000 });
    const profile = makeProfile({ categoryRank: 15000 });
    const result = generateChoiceList([row], profile, { latestYear: 2024 });
    expect(result).toHaveLength(1);
    expect(result[0].preferenceNumber).toBe(1);
    expect(result[0].instituteName).toBe("NIT Durgapur");
  });

  it("excludes a choice far outside reach (beyond the DREAM lower bound)", () => {
    const row = makeCutoff({ closingRank: 5000 });
    const profile = makeProfile({ categoryRank: 50000 });
    const result = generateChoiceList([row], profile, { latestYear: 2024 });
    expect(result).toEqual([]);
  });

  it("sorts DREAM before TARGET before SAFE", () => {
    const rows = [
      makeCutoff({ instituteId: "i1", branchId: "b1", closingRank: 15100 }), // near-DREAM
      makeCutoff({ instituteId: "i2", branchId: "b2", closingRank: 30000 }), // SAFE
      makeCutoff({ instituteId: "i3", branchId: "b3", closingRank: 17500 }), // TARGET
    ];
    const profile = makeProfile({ categoryRank: 15000 });
    const result = generateChoiceList(rows, profile, { latestYear: 2024 });
    const bands = result.map((r) => r.riskBand);
    const order = bands.map((b) => ({ DREAM: 0, TARGET: 1, SAFE: 2 }[b]));
    const sorted = [...order].sort((a, b) => a - b);
    expect(order).toEqual(sorted);
  });

  it("picks the row matching the latest year and highest round when multiple exist", () => {
    const rows = [
      makeCutoff({ year: 2023, round: 6, closingRank: 14000 }),
      makeCutoff({ year: 2024, round: 1, closingRank: 16000 }),
      makeCutoff({ year: 2024, round: 6, closingRank: 18000 }),
    ];
    const profile = makeProfile({ categoryRank: 15000 });
    const result = generateChoiceList(rows, profile, { latestYear: 2024 });
    expect(result).toHaveLength(1);
    expect(result[0].historicalClosingRank).toBe(18000);
  });
});