# OpenCounsel

A free, independent web app that helps Indian engineering-exam candidates build and check
their counseling choice list (JoSAA first). Not affiliated with JoSAA, CSAB, MCC or NTA.
Everything shown is a **historical-data estimate, never a guarantee**.

The app is 100% free: there are no payments, donations or paywalls.

## What it does

1. Student enters rank, category, home state, seat pool and preferred branches / institute types.
2. A deterministic engine sorts options into Dream / Target / Safe using historical cutoffs.
3. Drag-and-drop reordering with a linter (duplicates, bad ordering, invalid quota, too few safe choices).
4. CSV / PDF export, saved lists, college comparison, and a multi-round Freeze / Float / Slide simulator.
5. A grounded AI counselor: cutoffs come from SQL, rules come from stored counseling rules.
   The model only explains; eligibility and ordering are always deterministic code.

## Tech stack

Next.js 14 (App Router) Â· TypeScript Â· Tailwind Â· @dnd-kit Â· Drizzle ORM + postgres-js Â·
Supabase (Postgres + Auth) Â· Google Gemini (AI counselor) Â· Vitest. Deployed on Vercel.

**Postgres is required.** There is no SQLite mode.

## Run it locally

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL and the Supabase keys
npm run db:push             # create the tables
npm run db:seed             # OPTIONAL demo data (see warning below)
npm run dev
```

> **Warning: `db:seed` generates made-up cutoffs** (`data_version = seed-v1`). They exist only
> so the app has something to show on an empty database. Never leave them in production.
> `npm run db:check` tells you whether any are present; `npm run db:check -- --purge-mock`
> removes them (it refuses to run if there is no real data to fall back on).

## Real cutoff data

Cutoffs come from CSV files (see `data/sample-cutoffs-template.csv` for the columns).

- **Website:** log in as an admin, open `/admin/data`, upload a CSV (max 4 MB), review the
  validation report, then import. Use the dry run first.
- **Command line (any size):**
  ```bash
  npm run ingest -- data/your-file.csv --exam JOSAA --version josaa-2025-r6          # dry run
  npm run ingest -- data/your-file.csv --exam JOSAA --version josaa-2025-r6 --commit # import
  ```
  Add `--overwrite` to replace rows that already exist. Real rows always replace demo rows.

How rows are treated:

| Result | Meaning |
| --- | --- |
| ERROR | Malformed data (bad year/rank, missing field, opening > closing). Blocks the whole commit. |
| SKIPPED | Valid row we do not model (unknown quota/category, duplicate in file). Dropped and reported; the rest still imports. |
| WARNING | Imported, but worth a look. |

The import runs in a single transaction: it either fully succeeds or changes nothing.

Known gaps: "Preparatory" ranks have no field in the schema, so those rows are skipped.
Institute matching is by exact name, so spelling variants create duplicate institutes;
`scripts/merge_duplicate_institutes.ts` merges them afterwards.

## Admin access

Set `ADMIN_EMAIL` to your email. The first time that account logs in it is marked as an admin
and `/admin` opens (Data, Usage, Rules, Config).

## AI counselor

- Requires login; limited to 5 questions per student per rolling 24 hours (`lib/config.ts`).
- With `AI_API_KEY` set it calls the Gemini API; without it, it returns a clearly labelled mock reply.
- For cutoff questions it extracts the institute, branch, category, quota, year and round from
  the question and fetches only those rows. If the question names no institute or branch, the
  model is told to ask which one instead of guessing.
- Every question and answer is stored in `chat_messages` (the answer is saved before the
  response ends, so it works on serverless hosting).

## Project layout

```
app/            pages and API routes (profile, results, simulator, compare, my-lists, admin, api/*)
components/     ChoiceTable, ChatWidget, AuthStatus
lib/            recommendation-engine, linter, simulation, config, ai/*, ingestion/*, export
db/             Drizzle schema, client, seed
scripts/        ingest/import-cutoffs.ts, check-data.ts, merge_duplicate_institutes.ts
data/           sample CSV template and a real NIT Calicut 2024 round-1 file
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest unit tests |
| `npx tsc --noEmit` | Type check |
| `npm run db:push` | Sync the schema to the database |
| `npm run db:seed` | Demo data (mock) |
| `npm run db:check` | Report real vs mock cutoffs (`-- --purge-mock` to delete mock) |
| `npm run ingest -- <csv> --exam JOSAA --version <label> [--commit] [--overwrite]` | Import cutoffs |

CI (`.github/workflows/ci.yml`) runs type check, tests and build on every push.

## Status

| Area | Status |
| --- | --- |
| Recommendation engine, linter, simulator | Built, unit-tested |
| Auth, saved lists, admin (data, usage, rules, config), compare page | Built |
| CSV ingestion (web + CLI) | Built, batched, transactional |
| AI counselor | Built (Gemini); mock mode without a key |
| Payments / donations | **Removed on purpose**: the app is free |
| JoSAA round-PDF parser | Not built (CSV only) |
| Preparatory-rank modelling | Not built |
| API route / admin integration tests | Not built |

Notes: the payment tables (`orders`, `payments`, `donations`, `reports`) are still defined in
`db/schema.ts` but unused, so `db:push` never proposes a destructive change. `Dockerfile` and
`fly.toml` are leftovers from an earlier plan; production runs on Vercel.

## Disclaimer

OpenCounsel is an independent educational tool. Always verify against the official
counseling notification before making any irreversible decision.
