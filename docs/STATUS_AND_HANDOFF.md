# Status and handoff

The current state of the speed, caching and relevance rebuild, kept short so a
new chat can continue in minutes. Owner decisions: `AGENTS.md` ("Speed,
caching and relevance rebuild"). Detailed evidence: the roadmap section of the
same name in `docs/implementation-roadmap.md`. Audit:
https://claude.ai/artifact/X6DjxGiMJUZqJH2EEb3aX4.

Owner request, 2026-11-25: do every phase step by step, then give a full
report that proves with facts and tests that the output is excellent and the
code is sound, so the owner can verify everything independently.

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
| Phase 0 film search confirmed-only; quiz exact vs compromise | done, verified on production | `055f39d` |
| Phase 0 CDN for finished film answers | done, verified on production | `df78c6d`, `docs/reports/page-speed-after-finished-cache-2026-11-25.json` |
| Phase 0 episode short links | pending | |
| Phase 0 public portfolio demo | pending (needs the sibling `personal-website` deployment) | |
| Phase 1 eval harness, baselines, leakage checks | pending | |
| Phase 5 legacy archive, starter-kit skills, CI, fonts | pending (moved before v2: less code to port) | |
| Phases 2–4 Next.js v2 | pending | |
| One-command verification and final report | pending | |

## How to verify

```sh
npm run check
node --env-file=.env --import tsx scripts/check-quiz-window-equivalence.ts
node --env-file=.env --import tsx scripts/check-archetype-window-equivalence.ts
node --env-file=.env --import tsx scripts/check-alternatives-window-equivalence.ts
node --env-file=.env --import tsx scripts/test-quiz-window.ts
node --env-file=.env --import tsx scripts/test-archetype-window.ts
node --env-file=.env --import tsx scripts/test-alternatives-window.ts
node --env-file=.env --import tsx scripts/smoke-catalogue-windows.ts
node --import tsx scripts/measure-page-speed.ts --label check
node --env-file=.env --import tsx scripts/measure-quiz-api.ts --label check
```

Every database check is read-only or runs in a rolled-back transaction. None
makes a paid provider call. `measure-quiz-api.ts` counts against the owner's
test partner site allowance.

## Known limits

- Vercel Hobby forbids commercial use; upgrade to Pro before the first paying
  partner (owner action).
- Copying secrets into a new hosting project is an owner action; the agent
  never enters API keys or tokens.

## Next step

Phase 0: per-episode short links (`/e/:episode`) that count video traffic by
episode without cookies and lead to the matching tool; then phase 1 (eval).
