# Owner questions and actions

Open items only the owner can decide or do. Each says why it matters and what
happens once it is done. Closed items move to the decision register.

Closed on 2026-11-26: Vercel Pro (done by the owner, verified), the portfolio
partner key (created), Sentry after the first paint (done), episode link
targets (done), the Next.js version 2 (cancelled), the Supabase certificate
(supplied by the owner; every database script now verifies the server) and
the evaluation budget ($60 approved; the round's spend is in
`docs/evaluation-budget.md`) and the portfolio demo: the owner asked to
ignore the test partner ("игнорируй партнера тестового"), so its Lovable
publish is no longer a launch step. See `docs/decisions/DECISION_REGISTER.md`.

## Before launch

| # | Question or action | Why | When done |
| --- | --- | --- | --- |
| 1 | Done for the most part: 203 of 321 cards rated on 2026-11-26 (quiz 92%, alternatives 94% strong or acceptable, film 98% real sightings; `docs/eval-baseline.md`). Optional: rate about 20 archetype cards, the one tool with no human rating, or let a judge checked against your 203 ratings rate the rest; the film review page https://claude.ai/artifact/Nw4UBgkUU3ANz5Egrtr6Ze stays open | The ratings found the price labelling defect and a size error | Archetype and film cards get a measured share too |
| 2 | Move the Supabase project to the **Pro** plan ($25 a month) before the first paying partner. The project is **the-reverse-watch** (reference `osfqexnzgkksfvaocjvl`, Frankfurt) in the organization with the address `fektdonybhryzvxpwkgo`: billing at https://supabase.com/dashboard/org/fektdonybhryzvxpwkgo/billing, the project at https://supabase.com/dashboard/project/osfqexnzgkksfvaocjvl. Sign in with the account that owns that organization (the agent's Supabase connection sees only the EstateVanta organization) | The database has no backups today: Supabase backs up only Pro, Team and Enterprise projects (daily, kept 7 days on Pro). A lost database would lose the catalogue, the partners and their usage history | Backups appear under Database → Backups; `scripts/check-managed-backups.ts` reports them |
| 3 | Keep the Perplexity prepaid balance topped up (about $10–11 left on 2026-11-26 by the app's own counter) and set the usage alert in Meta's dashboard | The app stops paid checks at $100 a month and now emails you at $5, 10, 25, 50, 75, 90 and 100, Perplexity alone at $5 and $10 (`docs/production-readiness.md`); the provider accounts have no limit of their own, and an empty Perplexity balance makes every new film search fail until it is topped up | The balance and Meta's alert are noted in `docs/production-readiness.md` |
| 4 | Review the independent film set (`data/eval/film-labels-independent-2026-11-26.json`): open its sources, or a sample, and mark it reviewed | It is the honest measure of film search, but labels count only after a human check | Its review status says reviewed; later scores are compared with this baseline |
| 5 | Commercial groundwork from `docs/business-plan.md`: 8–10 conversations with possible partners, a short pilot agreement and invoice, and the open check of your employer's rules on paid side projects (`docs/original-plan-requirements.md`) | A paying pilot needs a buyer, terms and an invoice; no customer outreach is automated | The first bounded paid pilot is offered |

## Optional, improves results

| # | Question or action | Why | When done |
| --- | --- | --- | --- |
| 6 | Give the evaluation read-only database access in GitHub (steps below) | `scripts/run-evals.ts` needs the database, so it runs locally only | The evaluation runs on every push and fails on a regression |
| 7 | A budget to complete the catalogue, about $80–320 once | 15,901 of 25,014 searchable watches lack styles, size or movement, so the alternatives finder cannot compare them | More alternatives searches end in ten comparable watches |
| 8 | Gemini ("maybe we should exchange gemini for perplexity?", 2026-11-26): the agent advises **against replacing Perplexity with Gemini's Search grounding**, and offers Gemini 4 Hydrogen **without** Search as an advisory second reader of disputed film cards. If you want that reader, create a Gemini API key in Google AI Studio and put it in `.env` as `GEMINI_API_KEY` (never in chat or Git) | Google's terms for Grounding with Google Search (effective 2026-03-23, read 2026-11-26 at aistudio.google.com/docs/terms) allow it only in your own app, showing Grounded Results with their Search Suggestions to the person who asked, and forbid caching, syndicating, analysing or learning from them; using its links to build an index or to crawl destination pages is named a violation. The Reserve opens each cited page, keeps a catalogue and serves partner widgets. Without the Search tool, Gemini reads only text the server gives it (Gemini 4 Hydrogen: $1.50 / $7.50 per million tokens, a free tier exists; Search grounding needs billing: 5,000 searches a month included, then $14 per 1,000) | With a key, the agent runs the disputed cards through it and adds its verdict to the review page as advice; confirmations still need two opened pages |

## What read-only access for the evaluation needs (item 6)

The evaluation must not run in GitHub with the service-role key: that key can
change everything. Instead:

1. After your yes, the agent adds a migration with a database role,
   `reserve_eval_reader`, that can only call the read-only catalogue and story
   functions the evaluation uses: no tables, no writes, no visitor data. It
   cannot sign in until it has a password.
2. You give it a password in the Supabase SQL editor (you choose it; nobody
   else sees it):
   `alter role reserve_eval_reader with login password '…';`
3. You add a GitHub secret: repository → Settings → Secrets and variables →
   Actions → New repository secret, name `EVAL_DATABASE_URL`, value the
   **Session pooler** connection string from Supabase's **Connect** panel with
   the user `reserve_eval_reader.osfqexnzgkksfvaocjvl` and your password.
4. The agent switches the evaluation to that connection and adds it to the
   checks on every push.
