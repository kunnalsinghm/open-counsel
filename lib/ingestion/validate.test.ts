import { describe, it, expect } from "vitest";
import { validateRow, findDuplicatesInFile } from "./validate";
import type { CutoffCsvRow } from "./types";

const VALID_CATEGORIES = ["OPEN", "EWS", "OBC-NCL", "SC", "ST", "PwD"];
const VALID_QUOTAS = ["HS", "OS", "AI", "GO", "JK", "LA"];

function makeRawRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    year: "2024",
    round: "1",
    instituteName: "NIT Durgapur",
    instituteType: "NIT",
    state: "West Bengal",
    branchName: "Computer Science and Engineering",
    branchShortCode: "CSE",
    quota: "OS",
    seatPool: "Gender-Neutral",
    category: "OPEN",
    openingRank: "1000",
    closingRank: "2000",
    ...overrides,
  };
}

function validate(overrides: Record<string, string> = {}) {
  return validateRow(makeRawRow(overrides), 2, "JOSAA", VALID_CATEGORIES, VALID_QUOTAS);
}

describe("validateRow", () => {
  it("accepts a well-formed row with no issues", () => {
    const { row, issues } = validate();
    expect(issues).toHaveLength(0);
    expect(row).not.toBeNull();
    expect(row?.instituteName).toBe("NIT Durgapur");
  });

  it("errors on an implausible year", () => {
    const { row, issues } = validate({ year: "1999" });
    expect(row).toBeNull();
    expect(issues.some((i) => i.code === "INVALID_YEAR")).toBe(true);
  });

  it("errors on a round outside 1-10", () => {
    const { row, issues } = validate({ round: "15" });
    expect(row).toBeNull();
    expect(issues.some((i) => i.code === "INVALID_ROUND")).toBe(true);
  });

  it("errors when institute name is missing", () => {
    const { row, issues } = validate({ instituteName: "" });
    expect(row).toBeNull();
    expect(issues.some((i) => i.code === "MISSING_INSTITUTE")).toBe(true);
  });

  it("errors on an unrecognized institute type", () => {
    const { row, issues } = validate({ instituteType: "COLLEGE" });
    expect(row).toBeNull();
    expect(issues.some((i) => i.code === "INVALID_INSTITUTE_TYPE")).toBe(true);
  });

  it("SKIPS (not errors) a quota the exam system doesn't recognize", () => {
    const { row, issues } = validate({ quota: "ZZ" });
    expect(row).toBeNull();
    const issue = issues.find((i) => i.code === "INVALID_QUOTA");
    expect(issue?.severity).toBe("SKIPPED");
  });

  it("SKIPS (not errors) a category the exam system doesn't recognize", () => {
    const { row, issues } = validate({ category: "GENERAL" });
    expect(row).toBeNull();
    const issue = issues.find((i) => i.code === "INVALID_CATEGORY");
    expect(issue?.severity).toBe("SKIPPED");
  });

  it("errors on an invalid seat pool", () => {
    const { row, issues } = validate({ seatPool: "Everyone" });
    expect(row).toBeNull();
    expect(issues.some((i) => i.code === "INVALID_SEAT_POOL")).toBe(true);
  });

  it("errors when opening rank exceeds closing rank", () => {
    const { row, issues } = validate({ openingRank: "5000", closingRank: "1000" });
    expect(row).toBeNull();
    expect(issues.some((i) => i.code === "OPENING_EXCEEDS_CLOSING")).toBe(true);
  });

  it("warns (but still imports) on a suspicious rank gap over 50x", () => {
    const { row, issues } = validate({ openingRank: "3", closingRank: "238" });
    expect(row).not.toBeNull();
    const issue = issues.find((i) => i.code === "SUSPICIOUS_RANK_GAP");
    expect(issue?.severity).toBe("WARNING");
  });

  it("does not warn when the rank gap is under 50x", () => {
    const { issues } = validate({ openingRank: "1000", closingRank: "2000" });
    expect(issues.some((i) => i.code === "SUSPICIOUS_RANK_GAP")).toBe(false);
  });

  it("trims whitespace from string fields on a valid row", () => {
    const { row } = validate({ instituteName: "  NIT Durgapur  ", branchName: "  CSE Branch  " });
    expect(row?.instituteName).toBe("NIT Durgapur");
    expect(row?.branchName).toBe("CSE Branch");
  });
});

describe("findDuplicatesInFile", () => {
  function makeRow(overrides: Partial<CutoffCsvRow> = {}): CutoffCsvRow {
    return {
      examSystemCode: "JOSAA",
      year: 2024,
      round: 1,
      instituteName: "NIT Durgapur",
      instituteType: "NIT",
      state: "West Bengal",
      branchName: "Computer Science and Engineering",
      branchShortCode: "CSE",
      quota: "OS",
      seatPool: "Gender-Neutral",
      category: "OPEN",
      openingRank: 1000,
      closingRank: 2000,
      ...overrides,
    };
  }

  it("flags an exact duplicate as SKIPPED", () => {
    const rows = [
      { row: makeRow(), rowNumber: 2 },
      { row: makeRow(), rowNumber: 3 },
    ];
    const issues = findDuplicatesInFile(rows);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("SKIPPED");
    expect(issues[0].code).toBe("DUPLICATE_IN_FILE");
    expect(issues[0].rowNumber).toBe(3);
  });

  it("does not flag rows that differ by round as duplicates", () => {
    const rows = [
      { row: makeRow({ round: 1 }), rowNumber: 2 },
      { row: makeRow({ round: 2 }), rowNumber: 3 },
    ];
    expect(findDuplicatesInFile(rows)).toHaveLength(0);
  });

  it("does not flag rows that differ by category as duplicates", () => {
    const rows = [
      { row: makeRow({ category: "OPEN" }), rowNumber: 2 },
      { row: makeRow({ category: "EWS" }), rowNumber: 3 },
    ];
    expect(findDuplicatesInFile(rows)).toHaveLength(0);
  });

  it("returns no issues for an empty input", () => {
    expect(findDuplicatesInFile([])).toHaveLength(0);
  });
});