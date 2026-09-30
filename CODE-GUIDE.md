# Code guide

A plain-English map of The Reserve's code: what each part does, how a
request flows through it, and where to go to change something. For the
rules the code must keep (privacy, price checks, what never gets deleted)
see `AGENTS.md`.

## The stack in one paragraph

A React Router 7 app (React on the page, TypeScript on the server) deployed
on Vercel. Data lives in Supabase Postgres; the server reaches it only
through small SQL functions ("RPCs") called with the service key, defined in
`db/migrations/`. Two AI providers are used: **Muse Spark** (Meta Model API)
and **Perplexity**. `WEB_SEARCH_PROVIDER=muse` makes Muse Spark do all web
searching itself; the default (`perplexity`) uses Perplexity for searching.

## Folders

| Folder | What is in it |
|---|---|
| `app/routes/` | One file per page or endpoint. `app/routes.ts` maps URLs to files. |
| `app/components/` | Reusable page parts. `components/quiz/` holds the quiz screens. |
| `app/domain/` | Everything that is not page layout: rules, searches, database calls. Files ending in `.server.ts` never reach the browser. |
| `app/styles/` | CSS. Colours and spacing live in `tokens.css`. |
| `db/migrations/` | Numbered SQL files, applied in order with `scripts/apply-migration.ts`. Additive only: tables are never dropped. |
| `scripts/` | Command-line jobs you run on your machine (catalogue build, reports, price passes). |
| `docs/` | Product history, plans and reports (`docs/reports/`). |

## Pages and endpoints

| URL | File | What it does |
|---|---|---|
| `/` | `routes/home.tsx` | Landing page and newsletter sign-up (which unlocks the quiz). |
| `/quiz` | `routes/quiz.tsx` | The six-question diagnostic and the shortlist. |
| `/watches/find` | `routes/watch-find.tsx` | Search box for watches in films, series and on people. |
| `/watches`, `/watches/stories/…`, `/watches/people/…`, `/watches/works/…` | `routes/watches.tsx`, `watch-story.tsx`, `watch-entity.tsx`, `watch-work.tsx` | Published, reviewed film and celebrity watch stories. |
| `/watches/archetype` | `routes/watch-archetype.tsx` | The signal/aesthetic archetype mini-quiz. |
| `/admin/catalogue` | `routes/admin-catalogue.tsx` | Password-protected catalogue review: Approve, Reject, Edit, price changes. |
| `/internal/catalogue/recheck-prices` | `routes/internal-catalogue-recheck-prices.ts` | Daily Vercel cron (see `vercel.json`): rechecks prices older than 90 days. |
| `/evaluation` | `routes/evaluation.tsx` | Funnel analytics summary. |
| `/health` | `routes/health.ts` | Uptime check. |
| Others | `quiz-analytics-start.ts`, `discovery-analytics.ts`, `watch-research-status.tsx`, `internal-discovery-research-*.ts` | Analytics pings and the older film-research intake (see "Older code"). |

## How a quiz answer is produced

1. **The page** (`routes/quiz.tsx`) walks the visitor through six screens
   (`components/quiz/question-screens.tsx`). Answers live in a draft
   (`components/quiz/quiz-draft.ts`) saved in the browser's sessionStorage.
   Step 2 turns the wrist size into an editable case-diameter range
   (`components/quiz/quiz-steps.tsx`).
2. **Submit** posts plain form fields. The action reads them
   (`domain/quiz-form.ts`) and validates them against the answer schema
   (`domain/questionnaire-v4.ts`: price ranges, wrist, diameter range).
3. **Search** (`domain/quiz-search.server.ts`):
   - filters the **watch catalogue** in code (`domain/watch-catalogue.ts`:
     style, price in the visitor's currency, diameter, water resistance,
     movement, nickel, functions). Answers are instant.
   - Above 10k, or when fewer than three confirmed watches fit, the **live
     search** runs (`domain/quiz-live-search.server.ts`) and its finds are
     added to the catalogue as pending.
   - Results already found for identical answers are served from the stored
     results (`domain/ai-watch-store.server.ts`).
4. **Live steps:** while a search runs, the server sends each step and
   each watch as soon as it is confirmed (`domain/progress-feed.ts`: a chain
   of promises React Router streams to the page). The page shows them in
   `components/watch-results.tsx`, so visitors see progress instead of a
   30-second wait.
5. **Show** (`components/watch-results.tsx`): main picks, "Also worth a look"
   (reference not confirmed), "Not yet reviewed" badges, prices converted
   with ECB rates (`domain/fx.ts`).
6. **Optional email** (`domain/quiz-email.server.ts`): Beehiiv newsletter and
   Resend dossier, only with explicit opt-in.

Only search constraints ever reach Muse Spark or Perplexity: never email,
cookies, IP or anything identifying.

## The watch catalogue

- **Table:** `private.watch_catalogue` (migrations 0071 and 0072). One row per
  brand + reference. Review status: pending, approved or rejected.
- **Reading and writing:** `domain/watch-catalogue.server.ts` (all RPC calls).
- **Rules and matching:** `domain/watch-catalogue.ts` (pure, no network).
- **Building it:** `scripts/build-catalogue.ts` runs the searches (price range
  × style × run) using `domain/catalogue-build.server.ts`. For every new watch
  it confirms the reference on a maker/retailer page, double-checks the price
  and keeps a photo URL. It is resumable and stops at a spend limit.
- **Prices:** `domain/price-check.server.ts`. Perplexity finds the price;
  Muse Spark's own web search double-checks it on other pages. It is stored
  only when the two agree within ±5% in the same currency (USD, EUR, GBP or
  CHF), each on a live page or a source under 90 days old. A page Muse
  opened counts as live only when our own fetch of it is blocked.
  Grey-market and marketplace sites never count.
- **Reviewing:** `/admin/catalogue`, signed in with `ADMIN_PASSWORD`.
- **Report:** `scripts/catalogue-report.ts` writes `docs/reports/…` and a copy
  to the Desktop.

## The AI providers

| File | What it does |
|---|---|
| `domain/ai-providers.server.ts` | All provider calls: Muse Spark chat, Muse Spark web research (built-in `web_search`), Perplexity Sonar and Search API, and the `WEB_SEARCH_PROVIDER` switch (`webResearchJson`, `findPages`). |
| `domain/source-pages.server.ts` | Opens maker and retailer pages: is the reference on the page, which photo does it declare. `safeHttpUrl` and `publicFetch` make sure the server only ever fetches public web addresses, even through redirects (URLs come from AI output). |
| `domain/ai-watch-guardrails.ts` | Hard rules in code: authorised sources, reference matching, water resistance, diameter, price range, movement, nickel. |
| `domain/film-search.server.ts` | The film/people search behind `/watches/find`. |
| `domain/quiz-live-search.server.ts` | The quiz's live search. |

Every provider call takes a `Deps` object (config, fetch, clock). Tests pass
a fake fetch, so no test ever calls a real provider.

## Where to change things

| To change… | Edit |
|---|---|
| Quiz questions or their wording | `components/quiz/question-screens.tsx`, titles in `routes/quiz.tsx` |
| Price ranges or wrist → diameter table | `domain/questionnaire-v4.ts` |
| Which quiz scenarios map to which wearing style | `SCENARIO_STYLES` in `domain/watch-catalogue.ts` |
| How catalogue watches are ranked | `pick()` in `domain/watch-catalogue.ts` |
| Price tolerance, age limit, allowed currencies, grey-market list | top of `domain/price-check.server.ts` |
| Authorised retailers | `AUTHORISED_RETAILER_HOSTS` in `domain/ai-watch-guardrails.ts` |
| Search prompts | `quiz-live-search.server.ts`, `film-search.server.ts`, `catalogue-build.server.ts` |
| Muse Spark model or search provider | env vars `MUSE_SPARK_FAST_MODEL`, `MUSE_SPARK_MODEL`, `WEB_SEARCH_PROVIDER` |
| Admin page | `routes/admin-catalogue.tsx`, login in `domain/admin-auth.server.ts` |
| Colours and fonts | `app/styles/tokens.css` |

## Security in one list

- Secrets live only in `.env` (never committed) and Vercel's environment.
- Only watch-search constraints are sent to the AI providers.
- `/quiz` needs the signed subscriber cookie; `/admin/catalogue` needs
  `ADMIN_PASSWORD` (cookie signed with `SESSION_SECRET`, HTTPS-only,
  same-site strict); the cron endpoint needs `CRON_SECRET`.
- Paid searches are rate-limited per visitor, shared across server
  instances through Upstash (`consumeSharedRateLimit`).
- Database: every table has row-level security; the server writes through
  service-role functions only.
- Security headers (CSP, HSTS, frame denial) are set in `app/entry.server.tsx`.

## Everyday commands

```sh
npm run dev                   # run the site locally
npx vitest run                # all tests (fast, no network)
npm run lint && npm run typecheck
npx tsx --env-file=.env scripts/apply-migration.ts 00NN_name.sql
node --env-file=.env --import tsx scripts/build-catalogue.ts --budget 30
node --env-file=.env --import tsx scripts/catalogue-report.ts
node --env-file=.env --import tsx scripts/recheck-catalogue-prices.ts --unconfirmed
node --env-file=.env --import tsx scripts/compare-search-providers.ts
git push origin main && vercel deploy --prod   # deploys are not triggered by git
```

## Older code (kept on purpose)

These parts are not used by the live site but are kept for now, on the
owner's instruction (2026-09-30). Their database tables stay regardless.

- **The first reviewed-catalogue recommender:** `domain/catalogue.ts`,
  `catalogue.server.ts`, `recommendation.ts`, `seed-catalogue.ts`,
  `coverage.ts`, `catalogue-parity.ts`, `evaluation-fixtures.ts`, and the
  `audit-*`, `evaluate-*`, `render-*-migration`, `project-seed-coverage`,
  `migrate-seed-catalogue-v3` scripts.
- **The knowledge-base and workbook research pipeline:** `domain/research*.ts`,
  `perplexity-research.ts`, `knowledge-base.ts`, `sheet-*.ts`, the Rolex and
  model workbook scripts, `run-research-worker.ts`, `data/knowledge base/`.
- **The film-research intake before the AI search box:** `domain/discovery-research*`,
  `discovery-review.server.ts`, `discovery-search.server.ts`, `movie-watch-*`,
  `perplexity-*-verification.server.ts`, `routes/watch-research-status.tsx`,
  `routes/internal-discovery-research-*.ts`, and the movie-intake scripts.
  The published story pages themselves are live.
