# OpenCounsel

Free, independent choice-list simulator for Indian entrance-exam admission counseling
(JoSAA-style architecture, extensible to CSAB / NEET-UG / State CETs via the `exam_system` abstraction).

> **Scope note:** this is a working full-stack app with a deterministic recommendation
> engine, real ingested historical cutoff data, a choice-list linter, drag-and-drop
> builder, CSV/PDF export, multi-round simulator, real authentication, an admin
> dashboard, and a grounded AI counselor scaffold. Payment (Razorpay/Cashfree) and the
> AI provider are built as swappable abstractions with working *mock* implementations -
> wire in real credentials before a commercial launch.

## Quick start

npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev

No Docker, no external services required for local development. npm run build compiles
cleanly, npm run start serves all pages with HTTP 200, and the API routes return real
data from the database.

ORM/driver note: this uses Drizzle ORM. Local dev can run on SQLite via sql.js (a
pure-WASM build of SQLite, zero native compilation, runs identically on every OS and
Node version). Production runs on Postgres/Supabase - see drizzle.config.ts and
db/client.ts for the dialect switch, and use drizzle-kit generate + drizzle-kit migrate
for schema changes against Postgres.

## What's real vs. mocked in this build

| Feature | Status |
| --- | --- |
| Deterministic recommendation engine (Eligibility -> Cutoff -> Preference -> Risk -> Optimizer -> Explanation) | Real, fully implemented in lib/recommendation-engine.ts, covered by tests |
| Dream/Target/Safe classification with configurable thresholds | Real, lib/config.ts |
| Choice-list linter (duplicates, dominated ordering, quota validity, list-length/safety warnings) | Real, lib/linter.ts, covered by tests |
| Multi-round simulator (Freeze/Float/Slide) | Real, app/simulator + api/simulate-rounds, covered by tests |
| Real data ingestion pipeline | Real, lib/ingestion + scripts/ingest, with provenance/validation reporting and an institute-merge/dedup tool |
| Historical cutoff data | Real, sourced via the ingestion pipeline above (JoSAA cutoffs), replacing the earlier seeded mock dataset |
| Authentication (Supabase Auth) | Real, app/login, app/auth/callback |
| Admin dashboard (data upload/validation, usage metrics, pricing management) | Real, app/admin/data, app/admin/usage, app/admin/pricing + matching api/admin/* routes |
| Save/load choice lists | Real, app/my-lists + api/my-lists + api/save-list |
| Drag-and-drop choice builder, CSV/PDF export | Real, works fully client-side |
| Grounded AI counselor (intent router -> SQL tool / rules RAG -> LLM) | Real routing + grounding logic; LLM call itself is mocked until you set AI_API_KEY and implement the fetch in lib/ai/provider.ts |
| Payments (Razorpay/Cashfree) | Abstraction is real (lib/payments/provider.ts), implementation is a dev-mode mock - wire up real provider before enabling PAYMENTS_ENABLED=true |
| Donation modal | Real UI, uses the same mock payment flow |
| Legal pages (terms/privacy/disclaimer/contact) | Real, complete text - have it reviewed by a lawyer before commercial launch |
| Unit tests (recommendation engine, linter, simulation) | Real, lib/*.test.ts |
| College comparison, rules management UI | Not built yet - see below |

## Architecture

app/
  page.tsx                 landing page
  profile/                 student intake wizard -> POST /api/recommendations
  results/                 Dream/Target/Safe results, drag-and-drop, linter, export
  simulator/                multi-round Freeze/Float/Slide simulator
  my-lists/                 saved choice lists
  login/, auth/callback/    Supabase authentication
  admin/
    data/                   dataset upload/validation
    usage/                  usage metrics
    pricing/                pricing management
  api/
    recommendations/       runs the deterministic engine against real cutoffs
    lint/                  re-lints a reordered list
    cutoffs/                grounded read-only cutoff lookup (used by AI tool + admin)
    chat/                   AI counselor: intent routing -> grounded tool -> LLM
    rules/                  counseling rules lookup
    simulate-rounds/        multi-round simulation engine
    my-lists/, save-list/   saved choice list persistence
    health/                 GET /health
    admin/
      cutoffs/, cutoffs/summary/, cutoffs/upload/   dataset management
      usage/                                        usage metrics
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
  ingestion/                 real data ingestion pipeline with validation/provenance
  supabase/                  auth client helpers
  export.ts                  client-side CSV/PDF generation

scripts/
  ingest/                    CSV/PDF/HTML ingestion scripts for official cutoff sources
  seed/                      dev database seeding
  merge_duplicate_institutes.ts   institute de-duplication tool

db/
  schema (Drizzle)           normalized schema (users, profiles, exam_systems,
                              institutes, branches, cutoffs, rounds, rules, choice lists,
                              reports, orders, payments, donations, chat, audit logs)

## Classification logic

Dream/Target/Safe is computed from rankGapPercent = (closingRank - studentRank) / closingRank * 100 against the most recent year's closing rank for each
institute+branch+quota+category+seatPool combination, then adjusted for confidence
based on how many historical years are available and the observed trend direction.
Thresholds live in lib/config.ts - nothing is hard-coded inline, per the spec's
explainability requirement.

## What's not built yet (honest next steps)

1. Real LLM call in lib/ai/provider.ts - the grounding/routing logic around it is
   already real; only the actual model call is mocked.
2. Real payment provider implementation (Razorpay/Cashfree) against the existing
   PaymentProvider interface, plus webhook signature verification route.
3. College comparison page.
4. Rules management UI in the admin dashboard - the CounselingRule table and
   api/rules route exist; a UI to edit/publish rules is still missing.
5. Deployment configs (Vercel + Render/Railway + hosted Postgres) and CI.
6. Broader test coverage - engine/linter/simulation are tested; API routes and admin
   flows are not yet covered.

## Verified working

- npm install - installs cleanly, no native compilation step
- npm run db:push - creates all tables in dev.db
- npx tsc --noEmit - zero type errors
- npm run build - production build compiles and prerenders all pages/routes
- npm test - unit tests pass for the recommendation engine, linter, and simulation
- npm run start + live requests: /api/health, /api/recommendations,
  /api/cutoffs, /api/chat, /api/simulate-rounds, /api/my-lists all return real
  data from the database
