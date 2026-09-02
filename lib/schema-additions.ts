// Add to your existing schema.ts (wherever institutes/branches/cutoffs live)

export const instituteAliases = pgTable("institute_aliases", {
  id: uuid("id").defaultRandom().primaryKey(),
  rawName: text("raw_name").notNull(),        // exact string as it appears in a PDF
  instituteId: uuid("institute_id").notNull().references(() => institutes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const branchAliases = pgTable("branch_aliases", {
  id: uuid("id").defaultRandom().primaryKey(),
  rawName: text("raw_name").notNull(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id), // branch codes repeat across institutes
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ingestionBatches = pgTable("ingestion_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  filename: text("filename").notNull(),
  examSystemCode: text("exam_system_code").notNull(), // "JEE_MAIN" | "JEE_ADVANCED"
  year: integer("year").notNull(),
  round: integer("round").notNull(),
  status: text("status").notNull().default("PENDING_REVIEW"), // PENDING_REVIEW | COMMITTED | REJECTED
  rowsParsed: integer("rows_parsed").notNull(),
  rowsMatched: integer("rows_matched").notNull(),
  rowsUnmatched: integer("rows_unmatched").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});