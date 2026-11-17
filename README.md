# OpenCounsel

**A free, independent choice-filling simulator for Indian engineering admission counselling.**

Enter your rank, category and preferences. OpenCounsel sorts colleges into **Dream, Target and Safe** using historical cutoff data, checks your list for common mistakes, simulates how it could play out across rounds, and lets you export the final list. It never guesses a cutoff.

> **Disclaimer.** OpenCounsel is an independent educational decision-support tool. It is not affiliated with or endorsed by JoSAA, CSAB, MCC, NTA, or any state counselling authority. Recommendations are estimates based on historical data, not guarantees of admission. Always verify against the latest official notification before making an irreversible decision.

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Loading cutoff data](#loading-cutoff-data)
- [Project structure](#project-structure)
- [Pages and API](#pages-and-api)
- [Admin area](#admin-area)
- [Database](#database)
- [UI and design system](#ui-and-design-system)
- [Testing and CI](#testing-and-ci)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [Credits](#credits)

---

## Features

| Feature | What it does |
| --- | --- |
| **Recommendations** | Builds an ordered choice list from your rank, category, quota, seat pool, home state and preferences. |
| **Dream / Target / Safe** | A deterministic rule classifies every option by how your rank compares with past closing ranks. The same input always gives the same output. |
| **Choice-list checker** | A linter flags duplicates, a list that is too short, too few Safe choices, badly ordered choices and invalid quota claims. |
| **Drag-and-drop ordering** | Reorder or remove choices on the results page. The checker re-runs as you edit. |
| **Multi-round simulator** | Shows a likely outcome for each round, and explains Freeze, Float and Slide using stored counselling rules. |
| **Compare colleges** | Compare up to four institutes side by side for a branch, quota and category. |
| **Grounded AI counsellor** | A chat assistant that answers from the database. Free for logged-in users, with a daily question limit. Runs in mock mode without an API key. |
| **Export** | One-click CSV and PDF export of your list. |
| **Accounts and saved lists** | Log in to save lists and reopen them later. |
| **Admin area** | Upload cutoff CSVs, tune rules, and see usage and data health. |

---

## Tech stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS 3 with `@tailwindcss/typography`; icons from `lucide-react`; animation with `framer-motion`
- **Database:** PostgreSQL through Drizzle ORM (built for Supabase, any Postgres works)
- **Auth:** Supabase Auth (`@supabase/ssr`)
- **Drag and drop:** `@dnd-kit`
- **Tables:** `@tanstack/react-table`
- **Export:** `jspdf` and `jspdf-autotable`
- **Validation:** `zod`
- **AI:** Google Gemini free tier, behind a provider abstraction in `lib/ai/provider.ts`
- **Tests:** Vitest
- **Node:** 20 (see `.nvmrc`)

---

## How it works

### 1. Classification

The recommendation engine (`lib/recommendation-engine.ts`) filters cutoff rows to the ones you are eligible for, then compares your rank with each historical closing rank:

```
rankGapPercent = (closingRank - yourRank) / closingRank * 100
```

A positive gap means your rank is better (numerically lower) than the closing rank.

| Band | Rank gap |
| --- | --- |
| **Dream** | below 2% (includes ranks somewhat worse than the closing rank) |
| **Target** | 2% to 15% |
| **Safe** | 15% or more |

The thresholds live in `lib/config.ts` (`CLASSIFICATION_THRESHOLDS`) so they can be tuned in one place.

**Eligibility rules** include: quota, seat pool and category must match; the **HS** quota only allows institutes in your home state; the **OS** quota only allows institutes outside it; **IIT** seats need a JEE Advanced rank. NIT, IIIT and GFTI seats use your JEE Main rank, while IIT seats use your JEE Advanced rank.

Each item also carries a **confidence** level (High, Medium or Low, based on how many years of data exist) and a **trend** (tightening, loosening, stable or unknown).

### 2. Choice-list checker

`lib/linter.ts` runs explainable rules over your ordered list:

- `DUPLICATE_CHOICE`: identical institute, branch, quota and category
- `LIST_TOO_SHORT`: fewer than 30 choices (`MIN_RECOMMENDED_CHOICES`)
- `TOO_FEW_SAFE_CHOICES`: fewer than 5 Safe choices (`MIN_RECOMMENDED_SAFE_CHOICES`)
- `DOMINATED_CHOICE_ORDER`: a lower-tier institute ranked above a higher-tier one for the same branch
- `INVALID_QUOTA_CLAIM`: Home State quota selected but domicile does not match home state

### 3. Round simulator

`lib/simulation.ts` replays your list against each round's historical cutoffs and gives a label per round: **Strong**, **Possible**, **Risky** or **Unlikely**. The simulator page also explains **Freeze**, **Float** and **Slide** from the `counseling_rules` table, with a link to the official source where one is stored.

### 4. AI counsellor

The chat widget calls `/api/chat`, which:

1. requires a logged-in user (the endpoint uses a rate-limited third-party API);
2. enforces a daily limit (`AI_DAILY_QUESTION_LIMIT`, currently 5 per rolling 24 hours);
3. routes the question by intent: `CUTOFF`, `RULE`, `RECOMMENDATION` or `GENERAL` (`lib/ai/router.ts`);
4. retrieves matching data from the database (`lib/ai/tools.ts`) and passes it to the model as grounded context;
5. streams the answer back and logs the conversation to `chat_sessions` and `chat_messages`.

Without `AI_API_KEY`, the counsellor runs in **mock mode**: it returns the retrieved data and a note instead of a model answer, so the whole app works with no AI account.

---

## Getting started

**Prerequisites:** Node.js 20+, and a Postgres database. A free [Supabase](https://supabase.com) project gives you both the database and auth.

```bash
# 1. Clone and install
git clone https://github.com/kunnalsinghm/open-counsel.git
cd open-counsel
npm install

# 2. Configure environment
cp .env.example .env        # on Windows PowerShell: Copy-Item .env.example .env
# then fill in the values (see the table below)

# 3. Create the tables
npm run db:push

# 4. Add data
npm run db:seed             # sample institutes and mock cutoffs, for development only
# or load real data, see "Loading cutoff data"

# 5. Run
npm run dev
```

Open <http://localhost:3000>.

> The seed script generates **made-up** cutoff numbers so the app is usable on day one. They are tagged `SEED_MOCK_DATA` and must never be shown to students next to real data. See [Loading cutoff data](#loading-cutoff-data).

---

## Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. With Supabase use the **Transaction pooler** string (Project Settings, Database, Connection string). Needed by the app, `db:push`, `db:seed` and ingestion. |
| `NEXT_PUBLIC_SUPABASE_URL` | For login, saved lists, chat, admin | Supabase project URL (Project Settings, API). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For login, saved lists, chat, admin | Supabase anon key. |
| `ADMIN_EMAIL` | Optional | The account with this email becomes an admin the first time it logs in. |
| `AI_API_KEY` | Optional | Free Gemini key from <https://aistudio.google.com/apikey>. Leave empty for mock mode. |
| `AI_MODEL` | Optional | Model name. Defaults to the value in `.env.example`. |
| `APP_MODE` | Optional | Label shown on the admin Config page (`development` or `production`). |

If the Supabase variables are missing, the middleware skips session refresh and the pages that need login will not work, but the public pages still load.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on port 3000. |
| `npm run build` | Production build. Needs `DATABASE_URL` and the two Supabase variables set (dummy values are fine for a build check). |
| `npm run start` | Serve the production build. |
| `npm run test` | Run the Vitest suite. |
| `npm run db:push` | Push the Drizzle schema to your database. |
| `npm run db:seed` | Seed institutes, branches, counselling rules and mock cutoffs. |
| `npm run ingest -- <file.csv>` | Import a cutoff CSV (see below). |
| `npm run db:check` | Report whether the database holds real or mock cutoffs. Add `-- --purge-mock` to delete the mock rows (refuses to run if there is no real data). |
| `npm run lint` | Currently a placeholder: the repo has no ESLint config yet. |

Type-check with `npx tsc --noEmit`.

---

## Loading cutoff data

Real cutoffs are imported from CSV, either with the command line or the admin upload page.

**Required columns** (see `data/sample-cutoffs-template.csv`):

```
year, round, instituteName, instituteType, state, branchName, branchShortCode,
quota, seatPool, category, openingRank, closingRank, sourceUrl
```

- `instituteType` must be one of `IIT`, `NIT`, `IIIT`, `GFTI`, `MEDICAL`.
- `seatPool` must be `Gender-Neutral` or `Female-Only`.
- Rows are validated in `lib/ingestion/validate.ts`. Invalid rows are reported, not silently imported.
- `sourceUrl` should point at the official page the numbers came from.

```bash
npm run ingest -- data/real-josaa-2024-round1-nitcalicut.csv
```

The repo ships one real file (`data/real-josaa-2024-round1-nitcalicut.csv`) as a worked example, and a template.

**Real vs mock data.** The Compare page labels each row **Real** or **Seeded / mock**. Before launching to students, load real data and run:

```bash
npm run db:check -- --purge-mock
```

If you have both old mock institutes and real imports, `scripts/merge_duplicate_institutes.ts` merges them (run with `--dry-run` first, then `--commit`).

---

## Project structure

```
app/
  page.tsx                  Landing page
  layout.tsx                Header, footer, fonts, chat widget
  template.tsx              Page fade-in on navigation
  globals.css               Design system (cards, fields, buttons, chips)
  profile/                  Student profile form
  results/                  Recommendations, checker, drag-and-drop list, export
  simulator/                Multi-round simulator
  compare/                  Side-by-side institute comparison
  my-lists/                 Saved lists (login required)
  login/                    Log in and sign up
  contact/, terms/, privacy/, disclaimer/
  admin/                    Overview, Data, Usage, Config, Rules
  api/                      Route handlers (see below)
  auth/callback/            Supabase auth redirect
components/
  ChatWidget.tsx            AI counsellor chat bubble
  ChoiceTable.tsx           Draggable choice list
  AuthStatus.tsx            Header login state
  landing/                  Hero, Features, Steps
  ui/CountUp.tsx            Animated counters
lib/
  recommendation-engine.ts  Eligibility and classification
  linter.ts                 Choice-list checker
  simulation.ts             Round simulator
  config.ts                 Thresholds and limits
  export.ts                 CSV and PDF export
  types.ts                  Shared types
  ai/                       Provider, router, tools, extraction, log streaming
  ingestion/                CSV parsing, validation, import
  supabase/                 Browser and server clients
  admin-guard.ts            Admin-only access check
db/
  schema.ts                 Drizzle schema
  client.ts                 Database client
  seed.ts                   Development seed
data/                       Sample and real cutoff CSVs
scripts/                    Ingestion, data check, duplicate merge
docs/UPGRADE_NEXT.md        Plan for upgrading Next.js 14 to 16
```

Aliases: `@/` maps to the repo root.

---

## Pages and API

### Pages

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/profile` | Enter rank, category, eligibility and preferences |
| `/results` | Your Dream / Target / Safe list, warnings, save and export |
| `/simulator` | Round-by-round outcomes and Freeze / Float / Slide help |
| `/compare` | Compare up to four institutes |
| `/my-lists` | Saved lists |
| `/login` | Log in or create an account |
| `/contact`, `/terms`, `/privacy`, `/disclaimer` | Support and legal |
| `/admin/*` | Admin only |

The profile and results pages pass data to each other through two `sessionStorage` keys: `opencounsel:profile` and `opencounsel:results`. Keep these names if you change either page.

### API

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/recommendations` | Public | Build the choice list from a profile |
| POST | `/api/lint` | Public | Run the choice-list checker |
| POST | `/api/simulate-rounds` | Public | Simulate outcomes per round |
| GET | `/api/cutoffs` | Public | Cutoff rows by institute, branch, quota, category |
| GET | `/api/institutes` | Public | Institute search (used by Compare) |
| GET | `/api/rules` | Public | Counselling rules for an exam |
| GET | `/api/health` | Public | Health check, returns 503 if the database is down |
| POST | `/api/chat` | Login | AI counsellor (streamed, rate limited) |
| POST | `/api/save-list` | Login | Save a choice list |
| GET | `/api/my-lists` | Login | List saved choice lists |
| GET, POST, DELETE | `/api/admin/rules` | Admin | Manage counselling rules |
| GET | `/api/admin/cutoffs`, `/api/admin/cutoffs/summary` | Admin | Browse cutoffs and a data summary |
| POST | `/api/admin/cutoffs/upload` | Admin | Upload a cutoff CSV |
| GET | `/api/admin/usage` | Admin | Usage figures |

---

## Admin area

Go to `/admin` while logged in as an admin. The account whose email matches `ADMIN_EMAIL` is promoted to admin on its first login. Non-admins are redirected to the login page.

- **Overview:** counts of institutes and cutoff records, split into real (official) and seeded/mock, with the percentage backed by real data
- **Data:** upload and inspect cutoff CSVs
- **Usage:** AI and app usage
- **Config:** read-only view of the current configuration
- **Rules:** add, edit and delete counselling rules (Freeze, Float, Slide, Withdrawal, Refund and so on)

---

## Database

Defined in `db/schema.ts` with Drizzle. Main tables:

| Table | Holds |
| --- | --- |
| `exam_systems` | Counselling systems, such as JoSAA |
| `institutes`, `branches` | Colleges and their branches |
| `cutoff_records` | Opening and closing ranks per year, round, quota, seat pool and category (unique per combination) |
| `counseling_rules` | Rule text and official links per exam and topic |
| `users`, `student_profiles` | Accounts and profile data |
| `saved_choice_lists` | Lists a user has saved |
| `chat_sessions`, `chat_messages` | AI counsellor history and limit tracking |
| `audit_logs` | Audit trail |

The schema also contains `reports`, `orders`, `payments` and `donations` tables from an early design. OpenCounsel is free and does not use them.

---

## UI and design system

The interface is built only with Tailwind classes plus a small set of shared component classes in `app/globals.css`:

- `card`, `field`, `btn-primary`, `btn-secondary`, `btn-ghost`, `chip` (`chip-on` / `chip-off`), `notice`, `page-title`, `step-badge`
- Brand colour: the `brand` indigo scale in `tailwind.config.js`
- Risk colours: Dream is purple, Target is amber, Safe is emerald (used consistently on the landing page, results and choice list)
- Motion: one fade-in per page, a self-building list on the landing hero, animated counters on results, and an animated chat panel. All of it respects `prefers-reduced-motion`.
- Accessibility: visible keyboard focus, `aria-pressed` on toggle chips, `role="alert"` on errors, labels on icon-only buttons
- Responsive down to phone width

To restyle the app, change the classes in `app/globals.css` and the colours in `tailwind.config.js`. Avoid touching `lib/*`, `app/api/*` and `db/*` for visual changes.

---

## Testing and CI

```bash
npm run test          # Vitest
npx tsc --noEmit      # type check
```

Tests cover the recommendation engine, linter, round simulation, CSV validation, AI intent routing, entity extraction and log streaming.

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request to `main`: install with `npm ci`, type check, tests, then a production build with dummy environment values. Because CI uses `npm ci`, always commit `package-lock.json` together with `package.json`.

---

## Deployment

**Recommended: Vercel + Supabase.**

1. Create a Supabase project and copy the connection string, project URL and anon key.
2. Import the GitHub repo into Vercel.
3. Add the environment variables from the table above in Vercel project settings.
4. From your machine, run `npm run db:push` and load data (`npm run db:seed` for a demo, or `npm run ingest` for real data) against the same database.
5. Set `ADMIN_EMAIL`, deploy, then log in with that email to become admin.
6. In Supabase, set the Auth site URL and redirect URLs to your deployed domain so email confirmation links work.

Each branch and pull request gets a Vercel preview URL, so you can check changes before merging to `main`.

**Docker and Fly.io.** The repo includes a `Dockerfile` and `fly.toml`. They were written for an earlier SQLite setup (`DATABASE_URL=file:/data/dev.db`) and do not match the current Postgres configuration. Update them before using that route.

---

## Known limitations

- **Data coverage.** Only one real cutoff file ships with the repo. Results are only as good as the data loaded, and the app clearly labels seeded data.
- **Seeded data is fake.** Do not launch to students on mock data.
- **Scope.** The data model and rules focus on JoSAA. Other systems (CSAB, NEET, state counselling) need their own data and rules.
- **AI limits.** The free Gemini tier is rate limited, so chat is capped per user per day and needs login.
- **Demo mode.** The landing page links to `/profile?demo=1`, but the profile page does not yet read that parameter, so it opens the normal form.
- **Next.js version.** The app is on Next 14. `docs/UPGRADE_NEXT.md` plans the move to 16.
- **Linting.** `npm run lint` has no ESLint setup yet.

---

## Contributing

1. Create a branch: `git checkout -b my-change`
2. Make your change. Keep `lib/*`, `app/api/*` and `db/*` logic changes separate from visual changes.
3. Run `npx tsc --noEmit` and `npm run test`.
4. Test at phone width, since many students use mobile.
5. Keep the disclaimers on the results page, the simulator page and the footer.
6. Save files as UTF-8 without BOM.
7. Open a pull request against `main`.

There is no licence file in the repository yet. Add one before accepting outside contributions.

---

## Credits

Developed and maintained by [Vidhi Sharma](https://www.linkedin.com/in/vidhi-sharma-prof/) and [Kunal.sm](https://www.linkedin.com/in/kunal-sm-41a055285/).
