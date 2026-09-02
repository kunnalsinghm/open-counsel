import { describe, it, expect } from "vitest";
import { lintChoiceList } from "./linter";
import type { ChoiceListItem, StudentProfileInput } from "./types";

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
    historicalYearsAvailable: [2022, 2023, 2024],
    trendDirection: "STABLE",
    ...overrides,
  };
}

describe("lintChoiceList - duplicates", () => {
  it("flags two identical choices as a duplicate error", () => {
    const items = [
      makeItem({ preferenceNumber: 1 }),
      makeItem({ preferenceNumber: 2 }),
    ];
    const issues = lintChoiceList(items, makeProfile());
    const dup = issues.find((i) => i.code === "DUPLICATE_CHOICE");
    expect(dup).toBeDefined();
    expect(dup?.severity).toBe("ERROR");
    expect(dup?.affectedPreferenceNumbers).toEqual([1, 2]);
  });

  it("does not flag duplicates when institute or branch differs", () => {
    const items = [
      makeItem({ preferenceNumber: 1, instituteId: "inst_1" }),
      makeItem({ preferenceNumber: 2, instituteId: "inst_2" }),
    ];
    const issues = lintChoiceList(items, makeProfile());
    expect(issues.find((i) => i.code === "DUPLICATE_CHOICE")).toBeUndefined();
  });
});

describe("lintChoiceList - list length", () => {
  it("warns when list is shorter than the recommended minimum", () => {
    const items = [makeItem()];
    const issues = lintChoiceList(items, makeProfile());
    const warning = issues.find((i) => i.code === "LIST_TOO_SHORT");
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("WARNING");
  });

  it("does not warn when list meets the recommended minimum", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      makeItem({ preferenceNumber: i + 1, instituteId: `inst_${i}`, riskBand: "SAFE" })
    );
    const issues = lintChoiceList(items, makeProfile());
    expect(issues.find((i) => i.code === "LIST_TOO_SHORT")).toBeUndefined();
  });
});

describe("lintChoiceList - safe choice count", () => {
  it("warns when fewer than the recommended number of SAFE choices are present", () => {
    const items = [makeItem({ riskBand: "TARGET" })];
    const issues = lintChoiceList(items, makeProfile());
    const warning = issues.find((i) => i.code === "TOO_FEW_SAFE_CHOICES");
    expect(warning).toBeDefined();
  });

  it("does not warn when enough SAFE choices are present", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem({ preferenceNumber: i + 1, instituteId: `inst_${i}`, riskBand: "SAFE" })
    );
    const issues = lintChoiceList(items, makeProfile());
    expect(issues.find((i) => i.code === "TOO_FEW_SAFE_CHOICES")).toBeUndefined();
  });
});

describe("lintChoiceList - dominated choice order", () => {
  it("flags a lower-tier institute ranked above a higher-tier one for the same branch", () => {
    const items = [
      makeItem({ preferenceNumber: 1, instituteType: "NIT", branchShortCode: "CE", instituteName: "NIT X" }),
      makeItem({ preferenceNumber: 2, instituteType: "IIT", branchShortCode: "CE", instituteName: "IIT Y" }),
    ];
    const issues = lintChoiceList(items, makeProfile({ preferenceWeighting: "BALANCED" }));
    const warning = issues.find((i) => i.code === "DOMINATED_CHOICE_ORDER");
    expect(warning).toBeDefined();
    expect(warning?.affectedPreferenceNumbers).toEqual([1, 2]);
  });

  it("does not flag dominated order when weighting is BRANCH_OVER_COLLEGE", () => {
    const items = [
      makeItem({ preferenceNumber: 1, instituteType: "NIT", branchShortCode: "CE" }),
      makeItem({ preferenceNumber: 2, instituteType: "IIT", branchShortCode: "CE" }),
    ];
    const issues = lintChoiceList(items, makeProfile({ preferenceWeighting: "BRANCH_OVER_COLLEGE" }));
    expect(issues.find((i) => i.code === "DOMINATED_CHOICE_ORDER")).toBeUndefined();
  });

  it("does not flag when higher tier is already ranked first (correct order)", () => {
    const items = [
      makeItem({ preferenceNumber: 1, instituteType: "IIT", branchShortCode: "CE" }),
      makeItem({ preferenceNumber: 2, instituteType: "NIT", branchShortCode: "CE" }),
    ];
    const issues = lintChoiceList(items, makeProfile());
    expect(issues.find((i) => i.code === "DOMINATED_CHOICE_ORDER")).toBeUndefined();
  });

  it("does not flag when branches differ", () => {
    const items = [
      makeItem({ preferenceNumber: 1, instituteType: "NIT", branchShortCode: "CE" }),
      makeItem({ preferenceNumber: 2, instituteType: "IIT", branchShortCode: "ME" }),
    ];
    const issues = lintChoiceList(items, makeProfile());
    expect(issues.find((i) => i.code === "DOMINATED_CHOICE_ORDER")).toBeUndefined();
  });
});

describe("lintChoiceList - quota validity", () => {
  it("flags HS quota when domicile state does not match home state", () => {
    const profile = makeProfile({ quota: "HS", homeState: "Kerala", domicileState: "West Bengal" });
    const issues = lintChoiceList([makeItem()], profile);
    const error = issues.find((i) => i.code === "INVALID_QUOTA_CLAIM");
    expect(error).toBeDefined();
    expect(error?.severity).toBe("ERROR");
  });

  it("does not flag HS quota when domicile state matches home state", () => {
    const profile = makeProfile({ quota: "HS", homeState: "West Bengal", domicileState: "West Bengal" });
    const issues = lintChoiceList([makeItem()], profile);
    expect(issues.find((i) => i.code === "INVALID_QUOTA_CLAIM")).toBeUndefined();
  });

  it("does not flag non-HS quotas regardless of state mismatch", () => {
    const profile = makeProfile({ quota: "OS", homeState: "Kerala", domicileState: "West Bengal" });
    const issues = lintChoiceList([makeItem()], profile);
    expect(issues.find((i) => i.code === "INVALID_QUOTA_CLAIM")).toBeUndefined();
  });
});

describe("lintChoiceList - clean list", () => {
  it("returns no issues for a well-formed list meeting all recommendations", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      makeItem({
        preferenceNumber: i + 1,
        instituteId: `inst_${i}`,
        branchId: `branch_${i}`,
        riskBand: i < 10 ? "DREAM" : i < 20 ? "TARGET" : "SAFE",
      })
    );
    const issues = lintChoiceList(items, makeProfile());
    expect(issues).toEqual([]);
  });
});