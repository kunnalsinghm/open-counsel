import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

function cuid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export const examSystems = pgTable("exam_systems", {
  id: text("id").primaryKey().$defaultFn(() => cuid("exam")),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  categories: jsonb("categories").notNull().$type<string[]>(),
  quotas: jsonb("quotas").notNull().$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const institutes = pgTable(
  "institutes",
  {
    id: text("id").primaryKey().$defaultFn(() => cuid("inst")),
    examSystemId: text("exam_system_id").notNull().references(() => examSystems.id),
    name: text("name").notNull(),
    instituteType: text("institute_type").notNull(),
    state: text("state").notNull(),
    nirfRank: integer("nirf_rank"),
    website: text("website"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    examTypeIdx: index("institutes_exam_type_idx").on(t.examSystemId, t.instituteType),
  })
);

export const branches = pgTable(
  "branches",
  {
    id: text("id").primaryKey().$defaultFn(() => cuid("branch")),
    instituteId: text("institute_id").notNull().references(() => institutes.id),
    name: text("name").notNull(),
    shortCode: text("short_code").notNull(),
  },
  (t) => ({
    instituteIdx: index("branches_institute_idx").on(t.instituteId),
  })
);

export const cutoffRecords = pgTable(
  "cutoff_records",
  {
    id: text("id").primaryKey().$defaultFn(() => cuid("cutoff")),
    examSystemId: text("exam_system_id").notNull().references(() => examSystems.id),
    instituteId: text("institute_id").notNull().references(() => institutes.id),
    branchId: text("branch_id").notNull().references(() => branches.id),
    year: integer("year").notNull(),
    round: integer("round").notNull(),
    quota: text("quota").notNull(),
    seatPool: text("seat_pool").notNull(),
    category: text("category").notNull(),
    openingRank: integer("opening_rank").notNull(),
    closingRank: integer("closing_rank").notNull(),
    sourceUrl: text("source_url"),
    sourceDocument: text("source_document"),
    sourceDate: timestamp("source_date", { withTimezone: true }),
    dataVersion: text("data_version").notNull().default("v1"),
    isUnavailable: boolean("is_unavailable").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    examYearRoundIdx: index("cutoffs_exam_year_round_idx").on(
      t.examSystemId,
      t.year,
      t.round,
      t.category,
      t.quota
    ),
    branchCatQuotaIdx: index("cutoffs_branch_cat_quota_idx").on(t.branchId, t.category, t.quota),
    uniqCombo: uniqueIndex("cutoffs_uniq_combo").on(
      t.examSystemId,
      t.instituteId,
      t.branchId,
      t.year,
      t.round,
      t.quota,
      t.seatPool,
      t.category
    ),
  })
);

export const counselingRules = pgTable(
  "counseling_rules",
  {
    id: text("id").primaryKey().$defaultFn(() => cuid("rule")),
    examSystemId: text("exam_system_id").notNull().references(() => examSystems.id),
    topic: text("topic").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    officialUrl: text("official_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    examTopicIdx: index("rules_exam_topic_idx").on(t.examSystemId, t.topic),
  })
);

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => cuid("user")),
  email: text("email").unique(),
  name: text("name"),
  phone: text("phone"),
  state: text("state"),
  preferredLang: text("preferred_lang").notNull().default("en"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentProfiles = pgTable("student_profiles", {
  id: text("id").primaryKey().$defaultFn(() => cuid("profile")),
  userId: text("user_id").references(() => users.id),
  examSystemCode: text("exam_system_code").notNull(),
  year: integer("year").notNull(),
  round: integer("round").notNull(),
  crlRank: integer("crl_rank"),
  categoryRank: integer("category_rank"),
  jeeAdvancedRank: integer("jee_advanced_rank"),
  jeeAdvancedCategoryRank: integer("jee_advanced_category_rank"),
  percentile: real("percentile"),
  category: text("category").notNull(),
  gender: text("gender").notNull(),
  homeState: text("home_state").notNull(),
  domicileState: text("domicile_state").notNull(),
  quota: text("quota").notNull(),
  seatPool: text("seat_pool").notNull(),
  preferredBranches: jsonb("preferred_branches").notNull().$type<string[]>(),
  preferredInstituteTypes: jsonb("preferred_institute_types").notNull().$type<string[]>(),
  preferenceWeighting: text("preference_weighting").notNull().default("BALANCED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedChoiceLists = pgTable("saved_choice_lists", {
  id: text("id").primaryKey().$defaultFn(() => cuid("list")),
  userId: text("user_id").references(() => users.id),
  profileId: text("profile_id").notNull().references(() => studentProfiles.id),
  items: jsonb("items").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: text("id").primaryKey().$defaultFn(() => cuid("report")),
  profileId: text("profile_id").notNull().references(() => studentProfiles.id),
  isPaid: boolean("is_paid").notNull().default(false),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey().$defaultFn(() => cuid("order")),
  userId: text("user_id").references(() => users.id),
  amountPaise: integer("amount_paise").notNull(),
  donationPaise: integer("donation_paise").notNull().default(0),
  status: text("status").notNull().default("PENDING"),
  providerOrderId: text("provider_order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey().$defaultFn(() => cuid("pay")),
    orderId: text("order_id").notNull().references(() => orders.id),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id"),
    signature: text("signature"),
    status: text("status").notNull().default("PENDING"),
    rawWebhook: jsonb("raw_webhook"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqProviderPayment: uniqueIndex("payments_provider_payment_uniq").on(
      t.provider,
      t.providerPaymentId
    ),
  })
);

export const donations = pgTable("donations", {
  id: text("id").primaryKey().$defaultFn(() => cuid("don")),
  userId: text("user_id").references(() => users.id),
  donorName: text("donor_name"),
  amountPaise: integer("amount_paise").notNull(),
  transactionId: text("transaction_id"),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: text("id").primaryKey().$defaultFn(() => cuid("sess")),
  userId: text("user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => cuid("msg")),
    sessionId: text("session_id").notNull().references(() => chatSessions.id),
    role: text("role").notNull(),
    content: text("content").notNull(),
    toolUsed: text("tool_used"),
    model: text("model"),
    estimatedCostPaise: integer("estimated_cost_paise").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("chat_messages_session_idx").on(t.sessionId),
  })
);

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => cuid("audit")),
  userId: text("user_id").references(() => users.id),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});