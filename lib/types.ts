export type RiskBand = "DREAM" | "TARGET" | "SAFE";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface StudentProfileInput {
  examSystemCode: string; // "JOSAA"
  year: number;
  round: number;
  crlRank?: number;
  categoryRank?: number;
  category: string; // "OPEN" | "EWS" | "OBC-NCL" | "SC" | "ST" | "PwD"
  gender: "MALE" | "FEMALE" | "OTHER";
  homeState: string;
  domicileState: string;
  quota: string; // "HS" | "OS" | "AI" | "GO"
  seatPool: "Gender-Neutral" | "Female-Only";
  preferredBranches: string[]; // short codes, e.g. ["CSE","ECE"]
  preferredInstituteTypes: string[]; // ["IIT","NIT","IIIT"]
  preferenceWeighting: "COLLEGE_OVER_BRANCH" | "BRANCH_OVER_COLLEGE" | "BALANCED";
}

// A single historical cutoff row, already resolved with institute/branch names.
export interface CutoffRow {
  instituteId: string;
  instituteName: string;
  instituteType: string;
  state: string;
  nirfRank: number | null;
  branchId: string;
  branchName: string;
  branchShortCode: string;
  year: number;
  round: number;
  quota: string;
  seatPool: string;
  category: string;
  openingRank: number;
  closingRank: number;
}

export interface ChoiceListItem {
  preferenceNumber: number;
  instituteId: string;
  instituteName: string;
  instituteType: string;
  branchId: string;
  branchName: string;
  branchShortCode: string;
  quota: string;
  category: string;
  historicalOpeningRank: number;
  historicalClosingRank: number;
  studentRank: number;
  rankGapPercent: number; // (closingRank - studentRank) / closingRank * 100
  riskBand: RiskBand;
  confidence: Confidence;
  reason: string;
  historicalYearsAvailable: number[];
  trendDirection: "TIGHTENING" | "LOOSENING" | "STABLE" | "UNKNOWN";
}

export interface LintIssue {
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  message: string;
  affectedPreferenceNumbers?: number[];
}
