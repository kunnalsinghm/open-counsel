// Central, documented configuration for the recommendation engine.
// Admins can tune these without touching engine logic.
//
// Classification is based on the *rank gap percentage*:
//   rankGapPercent = (closingRank - studentRank) / closingRank * 100
//
// A positive gap means the student's rank is numerically better (lower)
// than the historical closing rank by that percentage margin.
// A negative gap means the student's rank is worse than the historical
// closing rank (i.e. the seat was out of reach in that historical round).

export const CLASSIFICATION_THRESHOLDS = {
  // DREAM: student's rank is worse than or only marginally better than the
  // closing rank — an ambitious, low-probability shot. Historically, ranks
  // within 15% *worse* than closing rank, up to exactly matching it.
  DREAM_MIN_GAP_PERCENT: -15,
  DREAM_MAX_GAP_PERCENT: 2,

  // TARGET: student's rank comfortably clears the closing rank by a modest,
  // realistic margin.
  TARGET_MIN_GAP_PERCENT: 2,
  TARGET_MAX_GAP_PERCENT: 15,

  // SAFE: student's rank clears the closing rank by a wide margin.
  SAFE_MIN_GAP_PERCENT: 15,
} as const;

export const PAYMENTS_ENABLED =
  (process.env.PAYMENTS_ENABLED ?? "false").toLowerCase() === "true";

export const APP_MODE = process.env.APP_MODE ?? "development";

export const PRICE_PAISE = 4900; // ₹49

export const DONATION_PRESETS_PAISE = [2000, 5000, 10000]; // ₹20, ₹50, ₹100

export const AI_DAILY_QUESTION_LIMIT_FREE = 5;
export const AI_DAILY_QUESTION_LIMIT_PAID = 15;

export const MIN_RECOMMENDED_CHOICES = 30;
export const MIN_RECOMMENDED_SAFE_CHOICES = 5;
