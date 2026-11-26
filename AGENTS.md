# Repository agent instructions

Start with `CODE-GUIDE.md`: a plain-English map of the code and where to
change what.

Before commercial planning or partner-product work, read `docs/business-plan.md`.
Keep its evidence, assumptions and current next action updated after relevant
changes. Use the recorded baseline and subsequent diffs to avoid repeating a full
audit without cause; do not treat unverified business hypotheses as product facts.

## Delivery boundaries

- Work from `docs/implementation-roadmap.md` one phase at a time.
- Continue automatically from one completed phase into the next. Phase statuses
  are sequencing and evidence checkpoints, not owner-approval gates.
- Commit and push verified work directly to `main`; this repository and its
  connected deployment are an owner-designated test project.
- Keep the application and research pipeline in TypeScript/JavaScript.
- Never commit `.env`, credentials, raw authentication caches, or access tokens.
- Do not print secret values in commands, logs, tests, or responses.

## Documentation and research routing

- Before planning or implementing any phase, read
  `docs/original_context.md` from its first line through its final line. Never
  replace the complete read with `head`, `tail`, first/last-200-line excerpts,
  targeted searches, or the requirements ledger. The duplication is preserved
  product history and must not be used as a reason to skim.
- Use `docs/original-plan-requirements.md` as the traceability ledger and
  `docs/implementation-roadmap.md` as the controlling phase sequence. Reconcile
  superseded technical sketches explicitly; never silently discard original
  questionnaire, brand-history, psychology, perception, dossier, media, or
  funnel requirements.
- Use the `openai_docs` MCP server for OpenAI API, model, Codex, ChatGPT, or
  plugin questions before relying on memory.
- Use `context7` for current third-party package and framework documentation.
- Use `perplexity` for watch-market and horological research that needs current
  web sources. Retain citations and retrieval dates.
- Treat Perplexity results as research inputs. Validate them against schemas and
  primary sources before accepting them into the catalogue.

## External systems

- Use `github` and `vercel` MCP tools for inspection when connected.
- Roadmap-scoped external writes, additive database migrations, direct `main`
  pushes, deployments, and configuration changes are authorized without an
  additional approval prompt.
- Never perform risky Supabase removals or other critical destructive actions.
  Prohibited operations include dropping or truncating tables, bulk destructive
  deletes, resetting production data, deleting/resetting Supabase branches or
  projects, destructive migrations, and removing critical domains, credentials,
  repositories, or deployment history. Prefer additive, reversible changes.
- Use least-privilege tokens and project/service accounts rather than personal
  keys wherever the provider supports them.

## Watch catalogue direction (owner decision, 2026-09-30)

This overrides the SQL-first catalogue invariants below wherever they
conflict, and supersedes the 2026-09-29 "AI search only" direction for the
quiz.

- Quiz answers are filtered in code from the watch catalogue
  (`private.watch_catalogue`, migrations 0071–0072;
  `app/domain/watch-catalogue.ts`, `app/domain/quiz-search.server.ts`).
  Each watch has checked facts and a review status (pending / approved /
  rejected). Pending watches are public but marked "Not yet reviewed".
- The catalogue is built locally by `scripts/build-catalogue.ts`: 11 price
  ranges up to 10k × 6 wearing styles (dress, everyday, sport, dive, field,
  travel) × 10 runs, written to the production database.
- Above 10k, or where the catalogue has fewer than three confirmed fits, the
  live AI search (`app/domain/quiz-live-search.server.ts`, stored by
  `ai-watch-store.server.ts`, migration 0070) runs and adds its finds to the
  catalogue as pending.
- The wrist pre-fills an editable case-diameter range; the diameter range is
  what is enforced.
- A watch whose reference no manufacturer or authorised-retailer page
  confirms is shown only under "Also worth a look", tagged "Manufacturer
  reference not confirmed".
- Prices and photos come through Perplexity; Muse Spark's built-in web
  search makes the independent second price check (owner decision,
  2026-09-30). A price is stored only when that second lookup agrees within ±5% in the same currency and each
  source is under 90 days old or a live page showing the price and the
  reference (`app/domain/price-check.server.ts`). Grey-market and
  marketplace prices never count. The daily cron
  `/internal/catalogue/recheck-prices` rechecks prices older than 90 days
  and parks changes for review.
- `WEB_SEARCH_PROVIDER=muse` makes Muse Spark's built-in web_search do all
  web searching (no Perplexity calls); the default is `perplexity`. With
  Muse, a page Muse opened counts as "live" only when our own fetch of it is
  blocked (owner decision, 2026-09-30).
- Review happens on `/admin/catalogue` (ADMIN_PASSWORD plus a cookie signed
  with SESSION_SECRET): Approve, Reject, Edit, accept or dismiss price
  changes. `scripts/catalogue-report.ts` writes the `.md` report.
- Actor/movie watches and `/watches/find` are to use the same approach and
  publish immediately, with no editorial review step.
- Store image URLs only, never image files.
- Final watch-card rendering must remove repeated normalized brand/title or
  brand/reference matches across all result sections and streamed previews.
  Use `app/domain/watch-result-dedup.ts` after hard filtering; keep the first
  ranked card's reference facts intact and preserve raw cached/catalogue data.
  The owner requested display-time checking, not a cache-wide cleanup.
- Only search constraints may reach Muse Spark or Perplexity. Never send
  email, session, cookie, IP, or other identifying data. No visitor data is
  stored.

## Partner widgets direction (owner decision, 2026-10-04)

- Paying partners show The Reserve's features on their own websites:
  `public/embed.js` (one script tag), the WordPress plugin
  (`integrations/wordpress/`), Shopify, and the `/api/v1` JSON API. Every
  feature is included for every partner.
- Widgets (`/embed/:key/…`) reuse the site's route modules. Inside a widget:
  no subscription gate, no newsletter sign-up, no email collection, no
  dossier; provenance labels and "Powered by The Reserve" stay.
- Only a partner's registered origins may frame a widget or use its public
  key; secret keys are for servers only and are stored hashed. Partner sites
  are switched off, never deleted. Uses are counted per site, month and
  feature for invoicing.
- After changing the WordPress plugin, rerun
  `scripts/package-wordpress-plugin.ts` and commit the zip.
- `data-reserve="all"` is the shared five-tool advisor for native HTML,
  WordPress, Shopify and website builders. Keep `public/embed.js` and
  `public/embed.css` consistent with the plugin and theme section. Results in
  partner widgets must not contain cross-tool or outbound links; the Powered by
  credit is the only link on quiz/archetype result screens. Preserve source and
  review labels as text. Use the advisor tabs to switch tools.
- Onboarding roles and steps live in `docs/partner-onboarding.md`; builder
  installation files live in `integrations/`. Verify new channels on real
  platform runtimes where available; never claim marketplace publication or
  hosted builder testing from a generic HTML smoke check.
- Owner exception 2026-10-25: disposable, inactive fixtures named exactly
  `Local integration disabled check` / `Local integration quota check` may be
  removed with their synthetic counters by `removeLocalTestPartners`, whose
  guards must stay intact. Real partner sites and their history are still
  switched off, never deleted. Integration tests clean up their own fixture IDs.

## Speed, caching and relevance rebuild (owner decisions, 2026-11-25)

Audit and plan: https://claude.ai/artifact/X6DjxGiMJUZqJH2EEb3aX4 (measured
2026-11-25; summary in `docs/implementation-roadmap.md`). Every change in this
rebuild reports before/after numbers for the owner's three rules: relevance,
speed and cost.

- **Film and people search** (`/watches/find`, its widget and `/api/v1/find`)
  shows only confirmed sightings in the main list. Unconfirmed candidates go in
  a separate, collapsed "possible" block, and the ten-card requirement no longer
  applies to this tool. This supersedes the 2026-10-30 ten-option rule for film
  and people search only. The quiz, alternatives and archetype keep ten
  options, with exact matches shown separately from compromises.
- **Catalogue hard filters run in PostgreSQL** (an indexed SQL search function
  that returns a bounded candidate set), not by loading the whole catalogue into
  each server and filtering in code. This supersedes the "filtered in code"
  wording of the 2026-09-30 decision; the catalogue still answers first, and
  live AI search still runs only on a shortfall.
- **No Next.js version 2** (owner, 2026-11-26: "отмена перехода на next js").
  This cancels the 2026-11-25 plan for a new version on the EstateVanta
  starter-kit stack: the site stays on React Router 7, where phase 0 met the
  speed goals. The database (additive migrations only), page URLs, partner keys
  and the `embed.js` contract stay unchanged; the starter kit's skills and
  continuity documents stay.
- **Subscription gating stays as it is:** film search and the archetype quiz
  are free; the diagnostic and cheaper alternatives need the newsletter
  subscription, so that the site collects email addresses.
- **Unused legacy code** (the "Older code (kept on purpose)" list in
  `CODE-GUIDE.md`) moves to an archive branch and tag and is removed from
  `main`. This supersedes the 2026-09-30 keep-in-main instruction. Its database
  tables are not touched.
- **Functions run in `fra1`**, next to the Supabase database in eu-central-1.
  Whether to move the database closer to the audience is decided later from
  country-level visit data.
- The project is on Vercel **Pro** since 2026-11-26 (the owner upgraded; the
  team plan reads `pro`), so commercial use and paying partners are permitted.
  Visit data so far (Vercel Web Analytics, 27 August to 26 November: about 170
  visitors, mostly the United States and the owner's own checks from Poland)
  is too thin to move the database.

## Owner decisions, 2026-11-26

- **Sentry loads after the first paint.** `app/entry.client.tsx` imports
  `app/sentry.client.ts` once the page has loaded and the browser is idle, or
  at once when an error happens first; earlier errors wait in
  `app/client-errors.ts`. Keep every public page's first-load JavaScript within
  150 KB compressed (`scripts/measure-page-weight.ts`).
- **Episode short links open the tool each video's closing line names**
  (`docs/episode-links.md`).
- **The portfolio demo has its own production partner**, "Portfolio demo
  (oleksandr-kukhtin.dev)": that one origin, 1,000 uses a month, public key
  only. Later the same day the owner asked to ignore this test partner
  ("игнорируй партнера тестового"): it is not a launch step, so do not wait
  for or verify its Lovable publish unless the owner asks. Leave the partner
  in place; never delete it.
- **The independent film set** (`data/eval/film-labels-independent-2026-11-26.json`)
  is labelled from opened sources only, was committed before its first score,
  and is never edited to raise a score.
- **Paid re-checks back off** after each failure of the same saved search:
  5 minutes, 1 hour, 1 day, then 7 days (migration 0121).
- **One paid evaluation round, $60** ("Да, $60"):
  `scripts/run-evals-live.ts --budget 60` runs the labelled sets through the
  visitors' own search functions and reads the spend ledger before each case,
  so the round cannot pass the approved amount. A further paid round needs a
  new approval.
- **Database scripts verify the server** against Supabase's certificate
  authority (`certs/prod-ca-2021.crt`, supplied by the owner) through
  `scripts/database-tls.ts`; never go back to encrypting without verifying.
- **Relevance before cost** ("Нам важнее гарантировать релевантный ответ,
  чем влезть в бюджет … лучше качественный ответ и чуть дороже"): a paid
  check may spend more when that makes the answer more reliable, always
  inside the per-card ($0.025) and monthly ($100) ledger limits.
- **Film and people search rests on real articles** ("чтобы они всегда
  опирались на реальные статьи из реальных сайтов с фактами"). Discovery
  reads the articles and databases that catalogue a subject's watches (up
  to three web searches, social sites, forums and shops excluded). A
  sighting is confirmed only when two pages on different sites, each opened
  by our server, show the exact reference and a passage tying the watch to
  the subject: one sentence naming the brand, the watch and the subject, or,
  on a page whose title names the subject, one sentence naming the brand
  and the exact reference (stored as "heading … sentence"). The second check
  (Muse) may search once, open one page and think briefly, about $0.006.
  An actor's or a character's card keeps the role beside the film when the
  source names both ("yes, fix it"): the passage may then name the role or
  the actor, and must name the film.
- **Gemini: skipped, nothing connected** (owner asked "maybe we should
  exchange gemini for perplexity?", then "пропускаем"). Google's terms for
  Grounding with Google Search forbid caching, syndicating or analysing
  Grounded Results and using their links to build an index or crawl
  destination pages, which is how this site verifies and stores sightings.
  Add no Gemini call unless the owner reopens it.
- **A judge decides without the owner** ("добавь судью. Чтобы он умел
  грамотно решать сам — без моего участия"): `scripts/judge-cards.ts`,
  calibrated against the owner's 203 ratings. On film cards it agrees with
  the owner 90%; on quiz and alternatives cards it also checks facts, which
  the owner's ratings did not, and two judges of different model families
  named the same wrong fact on 69 cards the owner rated positively (67 of
  them quiz and alternatives cards); six of six checked against makers'
  pages were real errors. A judge's verdict is
  advice: a fact changes only from a page our server opened.
- **Catalogue repair, step by step** ("готов — скажи как сделать и заодно
  проверим судью. лучше — будем пошагово делать"): a fact of a watch an AI
  search added is corrected only from the maker's page for its exact
  reference (an authorised retailer's when the maker has none) that our
  server opened and that shows the reference and the passage giving the
  value (`scripts/fact-check-catalogue.ts`). Each step reports its numbers
  and is checked by the judge before the next; prices keep their own check.
- **Read-only evaluation in CI** ("да и как это сделать?"): the role
  `reserve_eval_reader` (migration 0123) may run only the functions in
  `READ_ONLY_RPC`, in read-only sessions; never grant it a table, a write
  function or the service key. The owner sets its password with
  `scripts/set-eval-reader-password.ts`; the agent never sets it.
- **Spend alerts by email** to the owner's address (`SPEND_ALERT_EMAIL` in
  Vercel): the monthly ledger at $5, 10, 25, 50, 75, 90 and 100, Perplexity
  alone at $5 and $10, and at once when the ledger halts; the hourly cron
  `/internal/spend-alert` sends one email per mark.

## Continuity and skills (EstateVanta starter kit, 2026-11-25)

- Start a session with `docs/STATUS_AND_HANDOFF.md`, `docs/NEXT_CHAT.md` and
  `docs/OWNER_QUESTIONS.md`; decisions are indexed in
  `docs/decisions/DECISION_REGISTER.md`.
- Project skills live in `.agents/skills/` (one copy for every agent);
  `node scripts/link-agent-skills.mjs` links `.claude/skills` to it.
- Follow `docs/ENGINEERING_STANDARDS.md` and `docs/SECURITY_AND_PRIVACY.md`:
  code a junior can maintain, every check reported as PASS, FAIL or NOT RUN
  with its command.
- Before changing search relevance, run
  `node --env-file=.env --import tsx scripts/run-evals.ts` and compare with
  `docs/eval-baseline.md`; never edit a labelled set to make a run pass.

## Quality invariants

### Ten-option completion (owner decision, 2026-10-30)

Film and people search is exempt from the ten-card requirement since the
2026-11-25 decision above.

- Every search/tool, widget and API checks for ten distinct display cards after
  all eligibility checks and deduplication. Five results are no longer enough.
- Below ten, continue with saved research and metered discovery for additional
  models. A saved short result must not suppress further discovery. Existing
  per-request, per-card and monthly spending limits remain in force.
- Exact quiz matches obey the chosen diameter boundaries without rounding.
  Labelled close fits may miss functions/specifications or sit up to 3 mm
  outside the range, while preserving known budget, requested movement and
  allergy requirements. List every compromise; unknown facts remain unknown.
- Only a final list of ten distinct options enters the completed-response
  cache. Partial source checks and candidate drafts remain research evidence,
  not completed answers. If research cannot reach ten, show an incomplete
  result and never invent padding or report it as a complete cached answer.
- The cheaper-alternative finder shows immediate loading activity and real
  streamed search/source-check progress, including on repeat searches.

- Exact watch constraints belong in PostgreSQL. The first subjective matcher is
  an explicit, versioned weighted score over reviewed tags; semantic retrieval
  is optional and must beat that baseline in evaluation before production use.
- Brands provide context, while materially and dimensionally homogeneous
  reference variants are the units of filtering and ranking. Do not score
  brand-level rollups as if they were reference facts.
- Price and wrist circumference are canonical numeric values. UI/analytics
  bands must be derived from the shared domain constants rather than duplicated
  string tags in catalogue records.
- Missing data cannot satisfy an active hard filter. Preserve field-level
  evidence, verification state, and staleness instead of document-level
  confidence dates.
- Missing facts remain `null`; never supply plausible-looking defaults.
- Every accepted mutable or factual claim retains source provenance.
- Until Phase 7 begins its documented integration verification, run only the
  fast development gate (`npm run check`). Do not run Playwright/E2E suites,
  install browser binaries, or start long-running background validation jobs
  unless the owner explicitly asks for them.
- Keep deferred browser and integration specs current as the application grows;
  execute the full suite in Phase 5 after the main AI work is complete.
- Run the phase's non-deferred documented checks before committing and pushing
  it.
