# Plan: upgrading Next.js (14.2.35 -> 16.x)

## Why
`npm audit` still lists `next` (and `postcss`, which ships inside it) because every 14.x release is
inside the affected range; the fix is Next **16.4.6 or newer**. The advisories are mostly denial of
service, SSRF and cache-poisoning issues, plus three critical remote-code-execution issues in the
**Image Optimization API** and on **Windows-hosted servers**.

How exposed OpenCounsel is today:
- It does not use `next/image` and has no Server Actions, so the image-optimizer and Server-Action
  advisories do not apply to your code paths.
- On Vercel, image optimisation and the network edge are run by Vercel, not by your Next process.
- Residual risk is the generic ones (DoS in the React Server Components request handling). So this
  is worth doing soon, but it is not an emergency.

Already fixed in this patch (no Next upgrade needed): `jspdf` / `jspdf-autotable` (critical PDF
injection / path-traversal issues), `zod` (memory DoS), `source-map-js`, and the `dompurify` that
came with jspdf.

## What changes between 14 and 16 for this app

| Area | Change | Work needed here |
| --- | --- | --- |
| React | Next 15+ App Router needs React 19 | bump `react`, `react-dom`, `@types/react*`; check `@dnd-kit` and `lucide-react` versions support React 19 |
| `cookies()` | Async in Next 15+ | `lib/supabase/server.ts` calls it synchronously. Make `createClient()` async and add `await` at the 5 call sites: `app/api/chat`, `app/api/my-lists`, `app/api/save-list`, `app/auth/callback`, `lib/admin-guard.ts` |
| `middleware.ts` | Renamed `proxy.ts` in 16 (old name deprecated) | rename file and exported function; same Supabase session-refresh code |
| `next lint` | Removed in 16 | `npm run lint` already has no ESLint config or dependency. Either delete the script or add ESLint and run `eslint .` |
| `next.config.js` | `experimental.serverActions` is unused | remove it |
| Caching | GET route handlers are no longer cached by default (Next 15) | nothing; `/api/health` and the others are already `force-dynamic` or dynamic |
| Bundler | Turbopack is the default for `next build` in 16 | run a build; fall back with `--webpack` if a dependency misbehaves |
| Node | Needs Node 20.9+ | `.nvmrc` is `20`; set the Vercel project to Node 20 or 22 |
| `@supabase/ssr` | Newer versions track the async cookies API | upgrade together with Next; keep the existing `getAll`/`setAll` pattern |

## Steps (do them on a branch, one at a time)

1. Make sure the baseline is green: `npx tsc --noEmit`, `npm test`, `npm run build`.
2. `npm install next@15 react@19 react-dom@19 @types/react@19 @types/react-dom@19`
   (stepping through 15 first makes errors easier to read). Run the codemod:
   `npx @next/codemod@latest upgrade` (it converts `cookies()` and similar for you).
3. Fix the async `createClient()` call sites listed above. Run `npx tsc --noEmit`.
4. `npm install next@16`; rename `middleware.ts` -> `proxy.ts`; remove the dead config.
5. Verify by hand (there are no integration tests for these):
   - sign up / log in / log out, and reload (session cookie refresh)
   - save a list, open My Lists
   - ask the AI counselor a question while logged in, and while logged out (expect 401 message)
   - open `/admin` with the `ADMIN_EMAIL` account and with a normal account (expect redirect)
   - upload a small CSV in `/admin/data` (dry run, then import)
   - generate a recommendation, export CSV and PDF, run the simulator
6. Deploy to a Vercel **preview** first and repeat step 5 there before promoting to production.
7. `npm audit --omit=dev` should now show nothing for `next` and `postcss`.

Rollback: it is one branch; revert the merge and redeploy the previous Vercel deployment.

Estimated effort: 2 to 4 hours, most of it manual verification.
