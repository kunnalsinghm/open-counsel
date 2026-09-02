export type RiskBand = "DREAM" | "TARGET" | "SAFE";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface StudentProfileInput {
  examSystemCode: string;
  year: number;
  round: number;
  crlRank?: number;
  categoryRank?: number;
  jeeAdvancedRank?: number;
  jeeAdvancedCategoryRank?: number;
  category: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  homeState: string;
  domicileState: string;
  quota: string;
  seatPool: "Gender-Neutral" | "Female-Only";
  preferredBranches: string[];
  preferredInstituteTypes: string[];
  preferenceWeighting: "COLLEGE_OVER_BRANCH" | "BRANCH_OVER_COLLEGE" | "BALANCED";
}

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
  seatPool: string;
  category: string;
  historicalOpeningRank: number;
  historicalClosingRank: number;
  studentRank: number;
  rankGapPercent: number;
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