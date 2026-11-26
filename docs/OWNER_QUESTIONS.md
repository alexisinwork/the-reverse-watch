# Owner questions and actions

Open items only the owner can decide or do. Each says why it matters and what
happens once it is done. Closed items move to the decision register.

Closed on 2026-11-26: Vercel Pro (done by the owner, verified), the portfolio
partner key (created), Sentry after the first paint (done), episode link
targets (done), the Next.js version 2 (cancelled), the Supabase certificate
(supplied by the owner; every database script now verifies the server) and
the evaluation budget ($60 approved; the round's spend is in
`docs/evaluation-budget.md`). See `docs/decisions/DECISION_REGISTER.md`.

## Before launch

| # | Question or action | Why | When done |
| --- | --- | --- | --- |
| 1 | Publish the portfolio in Lovable: open the project, then **Publish → Update** | The demo page and its production key are in GitHub (`personal-website` `9c99572`), but Lovable publishes only on that click; on 2026-11-26 the live site still had no demo route (`/watch-advisor-demo` returns 404 and the live bundle does not contain it) | The agent opens the live demo and checks all five tools, mobile, a blocked origin and the usage counters; then the first paid pilot can be offered |
| 2 | Rate the cards on the rating page: https://claude.ai/artifact/HarGVRCT49WRcp5ervd4RC (one tap per card, about 4–6 hours in total; it can be done in parts) | The program proves the hard rules; whether a watch is a good recommendation needs a person who knows watches. To have a specialist rate instead, share the page with them as a Contributor | The agent reads the ratings and reports, per tool, the share of strong and acceptable picks and every card rated "wrong facts" |
| 3 | Move the Supabase project to the **Pro** plan ($25 a month) before the first paying partner | The database has no backups today: Supabase backs up only Pro, Team and Enterprise projects (daily, kept 7 days on Pro). A lost database would lose the catalogue, the partners and their usage history | Backups appear under Database → Backups; `scripts/check-managed-backups.ts` reports them |
| 4 | Set a spending limit or alert in the Perplexity and Meta (Muse Spark) dashboards | The app's own ledger refuses paid checks beyond $100 a month, but the provider accounts have no limit of their own; Meta documents its alert as a warning, not a hard cap. Where only alerts exist, keep a small prepaid balance | The limits are recorded in `docs/production-readiness.md` |
| 5 | Review the independent film set (`data/eval/film-labels-independent-2026-11-26.json`): open its sources, or a sample, and mark it reviewed | It is the honest measure of film search, but labels count only after a human check | Its review status says reviewed; later scores are compared with this baseline |
| 6 | Commercial groundwork from `docs/business-plan.md`: 8–10 conversations with possible partners, a short pilot agreement and invoice, and the open check of your employer's rules on paid side projects (`docs/original-plan-requirements.md`) | A paying pilot needs a buyer, terms and an invoice; no customer outreach is automated | The first bounded paid pilot is offered |

## Optional, improves results

| # | Question or action | Why | When done |
| --- | --- | --- | --- |
| 7 | Give the evaluation read-only database access in GitHub (steps below) | `scripts/run-evals.ts` needs the database, so it runs locally only | The evaluation runs on every push and fails on a regression |
| 8 | A budget to complete the catalogue, about $80–320 once | 15,901 of 25,014 searchable watches lack styles, size or movement, so the alternatives finder cannot compare them | More alternatives searches end in ten comparable watches |

## What read-only access for the evaluation needs (item 7)

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
