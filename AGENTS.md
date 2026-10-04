# Repository agent instructions

Start with `CODE-GUIDE.md`: a plain-English map of the code and where to
change what.

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

## Quality invariants

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
