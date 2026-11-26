# Owner questions and actions

Open items only the owner can decide or do. Each says why it matters and what
happens once it is done. Closed items move to the decision register.

Answered on 2026-11-26 and closed: Vercel Pro (done by the owner, verified),
the portfolio partner key (created), Sentry after the first paint (done),
episode link targets (done), the Next.js version 2 (cancelled). See
`docs/decisions/DECISION_REGISTER.md`.

| # | Question or action | Why | When done |
| --- | --- | --- | --- |
| 1 | Publish the portfolio in Lovable: open the project, then **Publish → Update** | The demo page and its production key are pushed to GitHub (`personal-website` `9c99572`), but Lovable publishes only on that click; `https://oleksandr-kukhtin.dev/watch-advisor-demo` still returns 404 | The agent opens the live demo page and checks all five tools against the new partner |
| 2 | Download Supabase's CA certificate (steps below) | Database scripts encrypt their connection but cannot verify the server without it | Every script checks the server certificate (`verify-full`); Semgrep stays clean without exceptions |
| 3 | Give the evaluation read-only database access in GitHub (steps below) | `scripts/run-evals.ts` needs the database, so it runs locally only | The evaluation runs on every push and fails on a regression |
| 4 | Approve an evaluation budget: $60 for one round, or $150 for three, and say who rates relevance (you, about 4–6 hours, or a specialist for $250–600) | Hard rules are proven at no cost; whether the watches are good choices, and what paid research adds, needs paid calls and human ratings (`docs/evaluation-budget.md`) | A live round per tool with PASS, FAIL or NOT RUN and the money actually spent |
| 5 | Review the independent film set (`data/eval/film-labels-independent-2026-11-26.json`): open its sources, or a sample, and mark it reviewed | It is the honest measure of film search (0 of 19 confirmed today), but labels count only after a human check | Its review status says reviewed; later scores are compared with this baseline |
| 6 | Optional: a budget to complete the catalogue, about $80–320 once | 15,901 of 25,014 searchable watches lack styles, size or movement, so the alternatives finder cannot compare them | Alternatives recall can be measured on all 60 test cases, and visitors get comparable results |

## How to download the Supabase certificate (item 2)

1. Open https://supabase.com/dashboard/project/osfqexnzgkksfvaocjvl/database/settings
   (Project Settings → Database).
2. In **SSL Configuration**, click **Download certificate**. The file is
   `prod-ca-2021.crt`.
3. Put it in this repository as `certs/supabase-prod-ca-2021.crt`, or send it
   in the chat. It is a public certificate of Supabase's authority, not a
   secret, so it may be committed.

The agent then switches every database script from "encrypt only" to
"encrypt and verify the server" and removes the scanner exceptions. If you
prefer, say so and the agent downloads the file itself.

## What read-only access for the evaluation needs (item 3)

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
