# Status and handoff

The current state of the speed, caching and relevance rebuild, kept short so a
new chat can continue in minutes. Owner decisions: `AGENTS.md` ("Speed,
caching and relevance rebuild"). Detailed evidence: the roadmap section of the
same name in `docs/implementation-roadmap.md`. Audit:
https://claude.ai/artifact/X6DjxGiMJUZqJH2EEb3aX4. Final report with the
verification table (updated 2026-11-26 with the owner's answers, the paid
round, the fixes, the remaining budget and what launch needs; 16 of 16 PASS
on deployment `dpl_Ao4BDAaJHs8H7JSpfMcKVG8iTGmx` after the fixes):
https://claude.ai/artifact/7X4Lo6q2mcvgw6ZoHDG1Wn. Owner's rating page:
https://claude.ai/artifact/HarGVRCT49WRcp5ervd4RC (ratings are stored under
`ratings/<rater>/cards` in its database; read them with ArtifactData).

Owner request, 2026-11-25: do every phase step by step, then give a full
report that proves with facts and tests that the output is excellent and the
code is sound, so the owner can verify everything independently. Owner
answers, 2026-11-26: Pro is on, Sentry may load later, episode links as
advised, the portfolio key is allowed, the film set as honest as possible,
a budget for an honest check, no Next.js version 2 (`AGENTS.md`, "Owner
decisions, 2026-11-26"). Later the same day the owner supplied Supabase's
certificate and approved $60 for one paid evaluation round ("Да, $60"); the
round ran and cost $3.89.

## The three rules

Every change reports before/after numbers for each rule.

| Rule | Measured by |
| --- | --- |
| Relevance | Hard-constraint violations (must be 0), exact-match and verified share, eval scores against random baselines |
| Speed | First-byte medians from `scripts/measure-page-speed.ts`, quiz API timings, database read times |
| Cost | Paid provider calls per request (0 on repeats), application verification ledger |

## Progress

| Step | Status | Evidence |
| --- | --- | --- |
| Phase 0.1 functions in `fra1`, CDN for content pages | done, verified on production | `44c4e21`, `docs/reports/page-speed-*.json` |
| Phase 0.2a quiz database window (migration 0115) | done, verified on production | `fd27073`, `docs/reports/quiz-window-equivalence-2026-11-25.json` |
| Phase 0.2b archetype database window (migration 0116) | done, verified on production | `96e081c`, `docs/reports/archetype-window-equivalence-2026-11-25.json` |
| Phase 0.2c alternatives name index and window (migration 0117) | done, verified on production | `0698273`, `docs/reports/alternatives-window-equivalence-2026-11-25.json`, `docs/reports/catalogue-windows-smoke-2026-11-25.json` |
| Phase 0.2d alternatives name lookups through indexes (migrations 0118–0120) | done, verified on production | `e85f307`, `docs/reports/name-lookup-equivalence-2026-11-25.json`, `docs/reports/catalogue-windows-smoke-{before,after}-name-lookups-2026-11-25.json` |
| Phase 0 film search confirmed-only; quiz exact vs compromise | done, verified on production | `055f39d` |
| Phase 0 CDN for finished film answers | done, verified on production | `df78c6d`, `docs/reports/page-speed-after-finished-cache-2026-11-25.json` |
| Phase 0 episode short links | done, verified on production | `4be1572`, `docs/episode-links.md` |
| Phase 0 public portfolio demo | partner created and portfolio pushed (2026-11-26); the owner then asked to ignore this test partner, so its Lovable publish is not tracked | `personal-website` `9c99572`, `docs/decisions/DECISION_REGISTER.md` |
| Episode links open the tool each video names; campaign tags survive the sign-up gate | done, verified on production | `9e37eac`, `docs/episode-links.md` |
| Vercel Pro; Web Analytics | done (owner), verified | `vercel teams ls`: plan `pro` |
| Paid re-checks back off after failures (migration 0121) | done, applied to production | `216b9b5`, `scripts/test-validation-backoff.ts` |
| Independent film label set, scored without paid calls | done; awaits the owner's review | `e568a71`, `71d039c`, `docs/eval-baseline.md` |
| Database scripts verify the server against Supabase's certificate (supplied by the owner) | done | `5e41865`, `scripts/database-tls.ts`, `docs/production-readiness.md` |
| Paid evaluation round ($60 approved) | done 2026-11-26: $3.89 spent; 4 of 5 gates PASS, archetype rules FAIL on one card; defects found (Known limits) | `5e41865`, `docs/eval-baseline.md`, `docs/reports/eval-live-2026-11-26.json` |
| Fixes from the paid round: alternatives name resolution, archetype price and band, film passage rule, migration 0122 (photo conflict) | done 2026-11-26; measured without paid calls (alternatives 24 → 60 of 60 cases searched, archetype rule failures 1 → 0); film effect needs a paid re-check | `docs/eval-baseline.md`, "Fixes after the paid round" |
| Rating sheet, 321 cards | published; waiting for the owner's ratings | https://claude.ai/artifact/HarGVRCT49WRcp5ervd4RC, `docs/reports/rating-sheet-2026-11-26.json` |
| Phase 1 eval harness, baselines, leakage checks; stories as confirmed film sightings | done | `927bd63`, `docs/eval-baseline.md` |
| Phase 5 legacy archive | done | `c52ceba`, branch `archive/legacy-code`, tag `archive/legacy-2026-11-25` |
| Phase 5 security checks (gitleaks, Semgrep, npm audit), Dependabot | done, green on `3031e0d` | `.github/workflows/security.yml`, `docs/production-readiness.md` |
| Phase 5 self-hosted fonts | done, verified on production | `0474d57` |
| Phase 5 starter-kit skills, standards, continuity docs | done | `.agents/skills/`, `docs/NEXT_CHAT.md`, `docs/OWNER_QUESTIONS.md`, `docs/decisions/DECISION_REGISTER.md` |
| Phase 5 public pages under the 150 KB JS budget (Sentry after the first paint) | done, verified on production: home 168.4 → 122.2 KB | `35a4a77`, `docs/reports/page-weight-{before,after}-sentry.json` |
| Phases 2–4 Next.js v2 | cancelled by the owner, 2026-11-26 | `AGENTS.md`, `docs/decisions/DECISION_REGISTER.md` |
| One-command verification and final report | done | `scripts/verify-all.ts`, `docs/reports/verify-all-*.json` |

## How to verify

One command runs every check below in order and prints PASS, FAIL or NOT RUN
for each (about fifteen minutes; it writes `docs/reports/verify-all-<date>.json`):

```sh
node --import tsx scripts/verify-all.ts --production
```

Without `--production` it skips the four checks against the live site. The
individual checks:

```sh
npm run check
node --env-file=.env --import tsx scripts/test-quiz-window.ts
node --env-file=.env --import tsx scripts/test-archetype-window.ts
node --env-file=.env --import tsx scripts/test-alternatives-window.ts
node --env-file=.env --import tsx scripts/test-name-lookups.ts
node --env-file=.env --import tsx scripts/test-validation-backoff.ts --applied
node --env-file=.env --import tsx scripts/test-image-conflict-publish.ts --applied
node --env-file=.env --import tsx scripts/check-quiz-window-equivalence.ts
node --env-file=.env --import tsx scripts/check-archetype-window-equivalence.ts
node --env-file=.env --import tsx scripts/check-alternatives-window-equivalence.ts
node --env-file=.env --import tsx scripts/check-name-lookup-equivalence.ts
node --env-file=.env --import tsx scripts/run-evals.ts
node --import tsx scripts/measure-page-speed.ts --label check
node --import tsx scripts/measure-page-weight.ts --label check
node --env-file=.env --import tsx scripts/smoke-catalogue-windows.ts
node --env-file=.env --import tsx scripts/measure-quiz-api.ts --label check
node --env-file=.env --import tsx scripts/run-evals-live.ts --budget 60 --rounds 1 --dry-run
```

Every database check is read-only or runs in a rolled-back transaction. None
makes a paid provider call. The smoke and quiz API checks count a few uses
against the owner's test partner site allowance. The paid round itself
(`scripts/run-evals-live.ts --budget <usd>` without `--dry-run`) runs only
with the owner's approval of that amount.

## Known limits

- Copying secrets into a hosting project is an owner action; the agent never
  enters API keys or tokens.
- The first request to a new function instance takes 8–10 s (function start
  plus cold database buffers); not yet investigated.
- Film search: paid research finds 15 of 19 independent sightings (shown as
  possible, now saved for free) but confirmed none. The passage rule was
  fixed on 2026-11-26; whether confirmations follow needs a paid re-check.
- The database has no backups (zero available, PITR off): Supabase backs up
  only Pro, Team and Enterprise projects. Owner action before the first
  paying partner (`docs/OWNER_QUESTIONS.md` #2).
- A local production build (`npm start` with `.env`) writes real analytics
  rows; one test page view from 2026-11-26 (row 692, country empty) is in the
  analytics table.

## Next step

The fixes from the paid round are in (alternatives, archetype, film passage
rule, migration 0122). Next, with the owner's OK, a repeat paid round (about
$4, inside the unused part of the $60) to measure the film confirmations and
the alternatives on the live path. Meanwhile the owner's
items in `docs/OWNER_QUESTIONS.md`: the ratings, Supabase Pro for backups,
provider spending limits.
Run `scripts/verify-all.ts --production` before and after every change.
