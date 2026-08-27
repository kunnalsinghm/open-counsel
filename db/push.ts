/**
 * Lightweight "push" for local/dev use: creates all tables directly via raw
 * DDL derived from db/schema.ts, using sql.js (pure WASM SQLite — no native
 * compilation needed on any platform). For production with Postgres, use
 * `drizzle-kit generate` + `drizzle-kit migrate` instead of this script.
 */
import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";

const DB_PATH = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");

async function main() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
  });

  const fileExists = fs.existsSync(DB_PATH);
  const db = new SQL.Database(fileExists ? fs.readFileSync(DB_PATH) : undefined);

  db.run(`
CREATE TABLE IF NOT EXISTS exam_systems (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  categories TEXT NOT NULL,
  quotas TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS institutes (
  id TEXT PRIMARY KEY,
  exam_system_id TEXT NOT NULL REFERENCES exam_systems(id),
  name TEXT NOT NULL,
  institute_type TEXT NOT NULL,
  state TEXT NOT NULL,
  nirf_rank INTEGER,
  website TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS institutes_exam_type_idx ON institutes(exam_system_id, institute_type);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  institute_id TEXT NOT NULL REFERENCES institutes(id),
  name TEXT NOT NULL,
  short_code TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS branches_institute_idx ON branches(institute_id);

CREATE TABLE IF NOT EXISTS cutoff_records (
  id TEXT PRIMARY KEY,
  exam_system_id TEXT NOT NULL REFERENCES exam_systems(id),
  institute_id TEXT NOT NULL REFERENCES institutes(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  year INTEGER NOT NULL,
  round INTEGER NOT NULL,
  quota TEXT NOT NULL,
  seat_pool TEXT NOT NULL,
  category TEXT NOT NULL,
  opening_rank INTEGER NOT NULL,
  closing_rank INTEGER NOT NULL,
  source_url TEXT,
  source_document TEXT,
  source_date INTEGER,
  data_version TEXT NOT NULL DEFAULT 'v1',
  is_unavailable INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS cutoffs_exam_year_round_idx ON cutoff_records(exam_system_id, year, round, category, quota);
CREATE INDEX IF NOT EXISTS cutoffs_branch_cat_quota_idx ON cutoff_records(branch_id, category, quota);
CREATE UNIQUE INDEX IF NOT EXISTS cutoffs_uniq_combo ON cutoff_records(exam_system_id, institute_id, branch_id, year, round, quota, seat_pool, category);

CREATE TABLE IF NOT EXISTS counseling_rules (
  id TEXT PRIMARY KEY,
  exam_system_id TEXT NOT NULL REFERENCES exam_systems(id),
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  official_url TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS rules_exam_topic_idx ON counseling_rules(exam_system_id, topic);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  phone TEXT,
  state TEXT,
  preferred_lang TEXT NOT NULL DEFAULT 'en',
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS student_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  exam_system_code TEXT NOT NULL,
  year INTEGER NOT NULL,
  round INTEGER NOT NULL,
  crl_rank INTEGER,
  category_rank INTEGER,
  percentile REAL,
  category TEXT NOT NULL,
  gender TEXT NOT NULL,
  home_state TEXT NOT NULL,
  domicile_state TEXT NOT NULL,
  quota TEXT NOT NULL,
  seat_pool TEXT NOT NULL,
  preferred_branches TEXT NOT NULL,
  preferred_institute_types TEXT NOT NULL,
  preference_weighting TEXT NOT NULL DEFAULT 'BALANCED',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS saved_choice_lists (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  profile_id TEXT NOT NULL REFERENCES student_profiles(id),
  items TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES student_profiles(id),
  is_paid INTEGER NOT NULL DEFAULT 0,
  pdf_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  amount_paise INTEGER NOT NULL,
  donation_paise INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  provider_order_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL,
  provider_payment_id TEXT,
  signature TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  raw_webhook TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_uniq ON payments(provider, provider_payment_id);

CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  donor_name TEXT,
  amount_paise INTEGER NOT NULL,
  transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_used TEXT,
  model TEXT,
  estimated_cost_paise INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages(session_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
`);

  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log(`Schema pushed to ${DB_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
