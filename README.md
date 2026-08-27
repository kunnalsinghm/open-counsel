# OpenCounsel

Free, independent choice-list simulator for Indian entrance-exam admission counseling
(JoSAA-style architecture, extensible to CSAB / NEET-UG / State CETs via the
`exam_system` abstraction).

> **Scope note:** this is a working Phase 1–5 MVP (per the priority list below) — a real,
> runnable full-stack app with a deterministic recommendation engine, seeded historical
> data, a choice-list linter, drag-and-drop builder, CSV/PDF export, and a grounded AI
> counselor scaffold. Payment (Razorpay/Cashfree) and the AI provider are built as
> swappable abstractions with working *mock* implementations — wire in real credentials
> before a commercial launch. Admin dashboard, full auth, and data-ingestion pipelines
> are intentionally left as documented next steps (see "What's not built yet" below) so
> this stays something one developer can actually run and extend, per your own P0/P1/P2
> prioritization.

## Quick start

```bash
npm install
cp .env.example .env          # already done for you, edit as needed
npm run db:push               # creates local dev.db (SQLite) with all tables
npm run db:seed               # loads 20 institutes x 5 branches x 2 years x 6 rounds
npm run dev                   # http://localhost:3000
```

No Docker, no external services required for local development. This has been
**actually built, seeded, and run end-to-end** (not just written) — `npm run build`
compiles cleanly, `npm run start` serves all pages with HTTP 200, and
`POST /api/recommendations`, `GET /api/cutoffs`, and `POST /api/chat` all return real
data from the seeded SQLite database.

**ORM/driver note:** this uses Drizzle ORM + **sql.js** (a pure-WASM build of SQLite)
rather than Prisma or better-sqlite3. Two earlier iterations hit real-world friction that
motivated this:

1. Prisma's engine-binary download (`binaries.prisma.sh`) is blocked in some
   sandboxed/restricted-network environments.
2. better-sqlite3 is a *native* Node addon — it needs a matching prebuilt binary for your
   exact OS/Node version, or a full C++ build toolchain (Visual Studio Build Tools on
   Windows) to compile from source. On very new or uncommon Node versions (e.g. Node 26),
   no prebuilt binary exists yet, and compiling from source fails without Visual Studio
   installed — this is a common source of `node-gyp`/`EPERM`/"Could not find any Visual
   Studio installation" errors on Windows.

sql.js has neither problem: it's WASM, so it runs identically on every OS and Node
version with **zero native compilation, ever**. The trade-off is that sql.js keeps the
database in memory and we explicitly persist it to `dev.db` after writes (see
`db/client.ts`'s `persist()` and its use in `db/seed.ts`) rather than writing straight
through to disk on every query — a non-issue for this app since the live server is
read-only (all writes happen in the `db:push`/`db:seed` scripts).

For production Postgres, swap `dialect: "sqlite"` for `"postgresql"` in
`drizzle.config.ts`, point `DATABASE_URL` at your Postgres instance, switch
`db/client.ts` to `drizzle-orm/node-postgres`, and use `drizzle-kit generate` +
`drizzle-kit migrate` instead of `db/push.ts` (which is a dev-only raw-DDL shortcut).

If you added your own write endpoints (e.g. saving a choice list to `saved_choice_lists`,
processing a real payment webhook into `orders`/`payments`), call `persist()` from
`db/client.ts` after each write, or switch to a real embedded/hosted database before
handling concurrent production traffic — sql.js's file-per-write model doesn't scale to
concurrent writers.

## What's real vs. mocked in this build

| Feature | Status |
|---|---|
| Deterministic recommendation engine (Eligibility → Cutoff → Preference → Risk → Optimizer → Explanation) | **Real**, fully implemented in `lib/recommendation-engine.ts` |
| Dream/Target/Safe classification with configurable thresholds | **Real**, `lib/config.ts` |
| Choice-list linter (duplicates, dominated ordering, quota validity, list-length/safety warnings) | **Real**, `lib/linter.ts` |
| Seeded historical cutoff data (20 institutes × 5 branches × 2023–2024 × Rounds 1–6) | **Real but illustrative** — generated mock data tagged `SEED_MOCK_DATA`, not scraped official figures. Replace via a real ingestion pipeline before launch. |
| Drag-and-drop choice builder, CSV/PDF export | **Real**, works fully client-side |
| Grounded AI counselor (intent router → SQL tool / rules RAG → LLM) | **Real routing + grounding logic**; LLM call itself is mocked until you set `AI_API_KEY` and implement the fetch in `lib/ai/provider.ts` |
| Payments (Razorpay/Cashfree) | **Abstraction is real** (`lib/payments/provider.ts`), implementation is a dev-mode mock — wire up real provider before enabling `PAYMENTS_ENABLED=true` |
| Donation modal | **Real UI**, uses the same mock payment flow |
| Legal pages (terms/privacy/disclaimer/contact) | **Real, complete text** — have it reviewed by a lawyer before commercial launch |
| Auth, admin dashboard, data ingestion scripts, multi-round simulator UI, college comparison | **Not built in this pass** — see below |

## Architecture

```
app/
  page.tsx                 landing page
  profile/                 student intake wizard -> POST /api/recommendations
  results/                 Dream/Target/Safe results, drag-and-drop, linter, export
  api/
    recommendations/       runs the deterministic engine against seeded cutoffs
    lint/                  re-lints a reordered list
    cutoffs/                grounded read-only cutoff lookup (used by AI tool + admin)
    chat/                   AI counselor: intent routing -> grounded tool -> LLM
    health/                 GET /health
  terms/ privacy/ disclaimer/ contact/

lib/
  recommendation-engine.ts  EligibilityEngine, CutoffEngine, RiskEngine, PreferenceEngine,
                             ChoiceOptimizer, ExplanationEngine (as separate functions)
  linter.ts                 choice-list mistake checker
  config.ts                 documented, tunable thresholds
  types.ts                  shared domain types
  ai/tools.ts                grounded SQL + rules lookup, never hallucinated
  ai/provider.ts             pluggable LLM call, mocked without AI_API_KEY
  payments/provider.ts       PaymentProvider interface + MockPaymentProvider
  export.ts                  client-side CSV/PDF generation

prisma/
  schema.prisma             full normalized schema (users, profiles, exam_systems,
                             institutes, branches, cutoffs, rounds, rules, choice lists,
                             reports, orders, payments, donations, chat, audit logs)
  seed.ts                   generates realistic (mock) historical JoSAA data
```

## Classification logic

Dream/Target/Safe is computed from `rankGapPercent = (closingRank - studentRank) /
closingRank * 100` against the most recent year's closing rank for each
institute+branch+quota+category+seatPool combination, then adjusted for confidence
based on how many historical years are available and the observed trend direction.
Thresholds live in `lib/config.ts` — nothing is hard-coded inline, per the spec's
explainability requirement.

## What's not built yet (honest next steps)

Given the size of the full spec (60 sections), this pass focused on P0 items that make
the product actually work end-to-end for a student. Not yet implemented, in rough
priority order:

1. **Real authentication** (Supabase Auth / NextAuth) — currently the app works fully as
   a guest; `User`/`StudentProfile` tables exist and are ready to be linked once auth is
   wired up.
2. **Admin dashboard** (`/admin`) for dataset upload/validation/publish workflow,
   revenue/usage metrics, and rules management.
3. **Real data ingestion pipeline** (`scripts/ingest`) for official HTML/PDF/CSV
   sources with provenance tracking and validation reporting — the schema already has
   `sourceUrl`, `sourceDocument`, `dataVersion`, and `isUnavailable` fields ready for
   this.
4. **Multi-round simulator UI** (Freeze/Float/Slide interactive toggles) — the
   `CounselingRule` table and rules content already exist; only the round-by-round
   visual walkthrough UI is missing.
5. **College comparison** page.
6. **Real payment provider** implementation (Razorpay/Cashfree) against the existing
   `PaymentProvider` interface, plus webhook signature verification route.
7. **Real LLM call** in `lib/ai/provider.ts` (the grounding/routing logic around it is
   already real).
8. Tests (unit tests for the engine/linter are straightforward given how they're
   structured as pure functions — `classifyBand`, `lintChoiceList`, etc. — but weren't
   written in this pass).
9. Deployment configs (Vercel + Render/Railway + hosted Postgres) and CI.

## Verified working (run in this sandbox)

- `npm install` — installs cleanly, **no native compilation step at all**
- `npm run db:push` — creates all 15 tables in `dev.db`
- `npm run db:seed` — inserts 20 institutes × 5 branches × 3,600 cutoff records
- `npx tsc --noEmit` — zero type errors
- `npm run build` — production build compiles and prerenders all static pages
- `npm run start` + live requests:
  - `GET /api/health` → `{"status":"ok","database":"ok",...}`
  - `POST /api/recommendations` with a real profile → real Dream/Target/Safe classified
    list with correct rank-gap math and linter warnings
  - `GET /api/cutoffs?institute=NIT Durgapur&branch=CSE` → real historical rows across
    years/rounds/quotas
  - `POST /api/chat` → grounded reply that correctly injects the real DB rule/cutoff
    data as evidence (LLM call itself is mock until `AI_API_KEY` is set)
  - `GET /`, `/profile`, `/terms` → HTTP 200 with correct rendered content
