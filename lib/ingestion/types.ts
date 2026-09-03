export interface CutoffCsvRow {
  examSystemCode: string;
  year: number;
  round: number;
  instituteName: string;
  instituteType: string;
  state: string;
  branchName: string;
  branchShortCode: string;
  quota: string;
  seatPool: string;
  category: string;
  openingRank: number;
  closingRank: number;
  sourceUrl?: string;
}

export interface IngestionIssue {
  // ERROR: malformed data (bad year/rank/missing required field) - blocks the whole commit,
  //   because it usually signals the file itself is broken, not just one row.
  // SKIPPED: the row is well-formed but references a quota/category this exam system doesn't
  //   (yet) model (e.g. a state quota or rank-track not in exam_systems.quotas/categories) -
  //   the row is excluded from import, but does NOT block the rest of the file from committing.
  // WARNING: informational only - row is still imported as-is.
  severity: "ERROR" | "SKIPPED" | "WARNING";
  rowNumber: number;
  code: string;
  message: string;
}

export interface IngestionReport {
  totalRows: number;
  validRows: number;
  errors: IngestionIssue[];
  skipped: IngestionIssue[];
  warnings: IngestionIssue[];
  droppedByCode: Record<string, number>;
  newInstitutes: string[];
  newBranches: string[];
}