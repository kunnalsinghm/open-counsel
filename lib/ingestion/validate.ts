import type { CutoffCsvRow, IngestionIssue } from "./types";

const REQUIRED_COLUMNS = [
  "year",
  "round",
  "instituteName",
  "instituteType",
  "state",
  "branchName",
  "branchShortCode",
  "quota",
  "seatPool",
  "category",
  "openingRank",
  "closingRank",
];

const CURRENT_YEAR = new Date().getFullYear();
const VALID_INSTITUTE_TYPES = new Set(["IIT", "NIT", "IIIT", "GFTI", "MEDICAL"]);
const VALID_SEAT_POOLS = new Set(["Gender-Neutral", "Female-Only"]);

export { REQUIRED_COLUMNS };

export function validateRow(
  raw: Record<string, string>,
  rowNumber: number,
  examSystemCode: string,
  validCategories: string[],
  validQuotas: string[]
): { row: CutoffCsvRow | null; issues: IngestionIssue[] } {
  const issues: IngestionIssue[] = [];
  const err = (code: string, message: string) =>
    issues.push({ severity: "ERROR", rowNumber, code, message });
  const warn = (code: string, message: string) =>
    issues.push({ severity: "WARNING", rowNumber, code, message });

  const year = Number(raw.year);
  const round = Number(raw.round);
  const openingRank = Number(raw.openingRank);
  const closingRank = Number(raw.closingRank);

  if (!Number.isInteger(year) || year < 2015 || year > CURRENT_YEAR + 1) {
    err("INVALID_YEAR", `Year "${raw.year}" is not a plausible year.`);
  }
  if (!Number.isInteger(round) || round < 1 || round > 10) {
    err("INVALID_ROUND", `Round "${raw.round}" must be a whole number between 1 and 10.`);
  }
  if (!raw.instituteName?.trim()) {
    err("MISSING_INSTITUTE", "Institute name is required.");
  }
  if (!VALID_INSTITUTE_TYPES.has(raw.instituteType)) {
    err(
      "INVALID_INSTITUTE_TYPE",
      `Institute type "${raw.instituteType}" must be one of: ${Array.from(VALID_INSTITUTE_TYPES).join(", ")}.`
    );
  }
  if (!raw.state?.trim()) {
    err("MISSING_STATE", "State is required.");
  }
  if (!raw.branchName?.trim() || !raw.branchShortCode?.trim()) {
    err("MISSING_BRANCH", "Branch name and short code are both required.");
  }
  if (!validQuotas.includes(raw.quota)) {
    err(
      "INVALID_QUOTA",
      `Quota "${raw.quota}" is not recognized for ${examSystemCode}. Valid values: ${validQuotas.join(", ")}.`
    );
  }
  if (!VALID_SEAT_POOLS.has(raw.seatPool)) {
    err(
      "INVALID_SEAT_POOL",
      `Seat pool "${raw.seatPool}" must be one of: ${Array.from(VALID_SEAT_POOLS).join(", ")}.`
    );
  }
  if (!validCategories.includes(raw.category)) {
    err(
      "INVALID_CATEGORY",
      `Category "${raw.category}" is not recognized for ${examSystemCode}. Valid values: ${validCategories.join(", ")}.`
    );
  }
  if (!Number.isInteger(openingRank) || openingRank <= 0) {
    err("INVALID_OPENING_RANK", `Opening rank "${raw.openingRank}" must be a positive whole number.`);
  }
  if (!Number.isInteger(closingRank) || closingRank <= 0) {
    err("INVALID_CLOSING_RANK", `Closing rank "${raw.closingRank}" must be a positive whole number.`);
  }
  if (
    Number.isInteger(openingRank) &&
    Number.isInteger(closingRank) &&
    openingRank > closingRank
  ) {
    err(
      "OPENING_EXCEEDS_CLOSING",
      `Opening rank (${openingRank}) is greater than closing rank (${closingRank}) — impossible.`
    );
  }
  if (
    Number.isInteger(closingRank) &&
    closingRank > 0 &&
    Number.isInteger(openingRank) &&
    closingRank / Math.max(openingRank, 1) > 50
  ) {
    warn(
      "SUSPICIOUS_RANK_GAP",
      `Closing rank is more than 50x the opening rank (${openingRank} to ${closingRank}) - double check this isn't a data-entry error.`
    );
  }

  if (issues.some((i) => i.severity === "ERROR")) {
    return { row: null, issues };
  }

  return {
    row: {
      examSystemCode,
      year,
      round,
      instituteName: raw.instituteName.trim(),
      instituteType: raw.instituteType,
      state: raw.state.trim(),
      branchName: raw.branchName.trim(),
      branchShortCode: raw.branchShortCode.trim(),
      quota: raw.quota,
      seatPool: raw.seatPool,
      category: raw.category,
      openingRank,
      closingRank,
      sourceUrl: raw.sourceUrl?.trim() || undefined,
    },
    issues,
  };
}

export function findDuplicatesInFile(rows: { row: CutoffCsvRow; rowNumber: number }[]): IngestionIssue[] {
  const seen = new Map<string, number>();
  const issues: IngestionIssue[] = [];

  for (const { row, rowNumber } of rows) {
    const key = [
      row.instituteName,
      row.branchShortCode,
      row.year,
      row.round,
      row.quota,
      row.seatPool,
      row.category,
    ].join("::");

    const firstSeenAt = seen.get(key);
    if (firstSeenAt !== undefined) {
      issues.push({
        severity: "ERROR",
        rowNumber,
        code: "DUPLICATE_IN_FILE",
        message: `Duplicate of row ${firstSeenAt} (same institute, branch, year, round, quota, seat pool, and category).`,
      });
    } else {
      seen.set(key, rowNumber);
    }
  }

  return issues;
}