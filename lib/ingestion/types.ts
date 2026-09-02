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
  severity: "ERROR" | "WARNING";
  rowNumber: number;
  code: string;
  message: string;
}

export interface IngestionReport {
  totalRows: number;
  validRows: number;
  errors: IngestionIssue[];
  warnings: IngestionIssue[];
  newInstitutes: string[];
  newBranches: string[];
}