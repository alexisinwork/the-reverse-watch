# Owner questions and actions

Open items only the owner can decide or do. Each says why it matters and what
happens once it is done. Closed items move to the decision register.

Closed on 2026-11-26: Vercel Pro (done by the owner, verified), the portfolio
partner key (created), Sentry after the first paint (done), episode link
targets (done), the Next.js version 2 (cancelled), the Supabase certificate
(supplied by the owner; every database script now verifies the server), the
evaluation budget ($60 approved; spend in `docs/evaluation-budget.md`), the
portfolio demo (the owner asked to ignore the test partner), the ratings
(item 1: "всё что мог уже оценил, там всё гуд"; archetypes checked by hand:
"я перепроверил руками архетипы и там всё гуд"), the Perplexity top-up (the
owner topped it up) and Gemini (item 8: "пропускаем", nothing connected).
Closed on 2026-11-27: Supabase Pro with Micro compute (item 2, done by the
owner; verified: daily backups, 9 kept, newest 10:27 UTC that day); Enforce
SSL (item 9, "1 - готово": the Management API reports `"database": true`);
the price of Exclusive Watch Selection (item 11, "2 - утверждено": $79, $49
for the first 25 founding orders; the process is `docs/exclusive-selection.md`);
the five price changes on `/admin/catalogue` (reviewed by the owner, "3 -
сделан"; none waiting); the local test partner (item 12, "4 - выключай":
"Owner test (local only)" switched off, not deleted).
See `docs/decisions/DECISION_REGISTER.md`.

## Before launch

| # | Question or action | Why | When done |
| --- | --- | --- | --- |
| 13 | Should a "confirmed" price that today's double check cannot reproduce be shown as approximate at once, instead of keeping its label until it is 90 days old? 13 prices the judge called wrong are in that state (Cartier WSSA0010, Jaeger-LeCoultre Q9008160, LIP 671530, TAG Heuer WAS2110.BA0732 and others; `docs/eval-baseline.md`, "Repair step 5") | A visitor reads "confirmed" as checked; the judge found wrong prices on 33 of 110 wrong cards | Your answer is recorded in `AGENTS.md`; the agent changes the recheck so (a code change, no paid call) |
| 3 | Set the usage alert in Meta's dashboard (Perplexity was topped up on 2026-11-26) | The app stops paid checks at $100 a month and emails you at $5, 10, 25, 50, 75, 90 and 100, Perplexity alone at $5 and $10; the provider accounts have no limit of their own | Meta's alert is noted in `docs/production-readiness.md` |
| 4 | Review the independent film set on its review page, https://claude.ai/artifact/4Br4SRgzRsFAGkN7vLEd5b ("кидай, я проверю"): 19 labels, each with the pages it rests on | It is the honest measure of film search, but labels count only after a human check | Your marks are on the page; the agent records them in `data/eval/` without editing the labels |
| 5 | Commercial groundwork from `docs/business-plan.md`: 8–10 conversations with possible partners, a short pilot agreement and invoice, and the open check of your employer's rules on paid side projects (`docs/original-plan-requirements.md`) | A paying pilot needs a buyer, terms and an invoice; no customer outreach is automated | The first bounded paid pilot is offered |

## Improves results

| # | Question or action | Why | When done |
| --- | --- | --- | --- |
| 6 | Read-only evaluation in GitHub: the agent's part is done (migration 0123, `.github/workflows/eval.yml`). Your part is one command in the project folder: `node --env-file=.env --import tsx scripts/set-eval-reader-password.ts` | The evaluation could run only on the agent's machine, because it needed the key that can change everything | The command prints three "Done" lines; the next run of "Search quality evaluation" in GitHub Actions shows PASS for every gate |
| 7 | Catalogue repair, step by step ("будем пошагово делать"). Steps 1–3 and 5 are done and judged (below; $61.25 of the $100 spent). **Step 6 needs your choice:** the AI-found watches without any maker's or shop's page (1,516 records, 65% of their cards wrong) shown only after verified watches, or only under "Also worth a look" | After step 5 the judge calls a fact wrong on 35% of cards (was 39%; database imports 15%); those page-less records are the largest group left | Each step reports its numbers and is checked by the judge before the next |
| 10 | Optional: set the database disk to 8 GB (Supabase → Database → Settings → Disk) | 8 GB is included in Pro. Today it is 2 GB, 41% used, and grows by itself at 90% with a six-hour pause between growths, so a long bulk write could fill it inside that pause | Disk shows 8 GB; it cannot be made smaller again |

## What the read-only evaluation command does (item 6)

1. It makes a long random password for the database sign-in
   `reserve_eval_reader` and never shows it. The database receives only its
   SCRAM verifier, so the database logs never hold the password either.
2. It signs in as that role and checks what it can do: exactly the sixteen
   read-only functions the evaluation uses, in read-only sessions, no tables.
   If the check fails, nothing is stored.
3. It stores the connection string in your `.env` (as `EVAL_DATABASE_URL`)
   and as the GitHub Actions secret `EVAL_DATABASE_URL`, through your signed-in
   GitHub CLI. If the CLI cannot store it, the command says where to paste it
   by hand (repository → Settings → Secrets and variables → Actions).

Running it again replaces the password. To switch the access off, the agent
can revoke the role's grants (a new migration).

## The catalogue repair (item 7)

What the judge found: of the 146 quiz and alternatives cards both judges
read, 128 showed one of the 3,590 watches an AI search added to the
catalogue (14% of it, but with every field filled, so they win most places
in results), and 72 of those 128 cards (56%) have a wrong fact both judges
name: water resistance, case size, model, reference, movement or price.
Cards of watches imported from watch databases: 2 of 16 (13%). Six of six
checked against the makers' pages were real errors. The archetype cards
look the same to the judge: 34 of 78 wrong, 76 of them AI-found watches.

| Step | What | Cost | State |
| --- | --- | --- | --- |
| 1 | Pilot on 60 of those watches, nothing written: the judge model finds the maker's page for the exact reference and copies the passage for each fact; our server opens the page and keeps a value only when the page's text shows the reference and the passage | $2.92 | done: 12 watches with a verified correction (16 facts; one rejected under the stricter rule that followed), none on the 19 the judges had found clean; 9 references look invented (no maker page; 8 of their 9 stored pages are gone) |
| 2 | Write verified corrections with their page and passage through a log that can undo every run (migration 0124); take the "reference confirmed" mark off references no page gives; stop counting a page address that merely contains the reference as proof | inside step 3 | done 2026-11-27 |
| 3 | All 3,590 AI-found watches: the stored page first, then pages Perplexity names, read by Muse Spark (calibrated against Opus) | $19.94 (+ $2.6 calibration) | done 2026-11-27: the page was found for 2,074; 1,096 watches changed (293 diameters, 193 water resistances, 95 movements corrected); 67 references belong to another watch; 72 references newly confirmed, 9 marks dropped (`docs/eval-baseline.md`) |
| 4 | Complete the database-imported watches: wearing styles from their own facts (done: 15,458 of 15,724, $0.29), then water resistance, thickness and photos from makers' pages for the ones the tools show | styles $0.29; pages about $0.0055 a watch | styles done; pages not started |
| 5 | What the judge found after step 3: saved answers show the facts the repair read on a page; a second read of the 2,073 found pages (tables, "(mm) 42.00", the maker's own name); the prices the judge named rechecked; a live round of all four tools and the judge | $16.75 | done 2026-11-27: wrong share 39% → 35%, archetype 48% → 39%; two defects fixed on the way (`docs/eval-baseline.md`, "Repair step 5") |
| 6 (proposed) | The AI-found watches no maker's or shop's page gives (1,516 records): show them only after the verified ones, or only under "Also worth a look"; measured by the free evaluation, a live round and the judge | about $13 for the round and the judge | waits for the owner's choice |
