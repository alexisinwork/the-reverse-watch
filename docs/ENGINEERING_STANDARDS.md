# Engineering standards

## 1. Code a junior can maintain

Every authored line must have a clear purpose. A junior developer who knows the stack's basics must be able to trace behaviour, reproduce a problem, make a bounded fix, test it and recover from a mistake, with or without AI.

1. **Name the purpose.** Descriptive English names. Booleans read as conditions, such as `isAccessDenied`. Durations carry their unit, such as `timeoutMs`.
2. **Make execution easy to follow.** Braces on every block, early returns for invalid input, plain branches. No nested ternaries, compressed multi-action lines, surprising mutation or long chained transformations.
3. **Keep responsibilities visible.** One coherent job per function or component. Extract a helper to name a concept or reuse real behaviour. No speculative abstractions, generic repositories, factories or extra layers.
4. **Make contracts explicit.** Types at every boundary, and runtime validation of anything untrusted. Errors, permissions, transactions and side effects stay visible where they happen.
5. **Explain reasons, not the obvious.** Comment business rules, security choices, workarounds and failure handling. Record architecture trade-offs in an ADR.
6. **Leave evidence.** Tests that read as arrange, act and assert, with synthetic data. A regression test for every real bug. No tests written only to raise coverage.
7. **Keep operations understandable.** Scripts and migrations have clear names, safe defaults, visible prerequisites and helpful failure messages. Explain any destructive step and how to recover.
8. **Own AI output.** Read every line, check official docs, run the checks. Whatever a maintainer needs lives in the repository, never only in a chat.

Lint enforces `curly` and `no-nested-ternary`. Naming, structure and comments need human review.

**Review gate.** A developer can explain what changed and why this is the simplest fit, the request flow, inputs, outputs, permissions and failure cases, which tests cover them, how to reproduce a failure and where to start debugging, and how to configure, roll back and recover.

Each feature documents its request flow as a table: step, file, responsibility. Example:

| Step | File | Responsibility |
|---|---|---|
| Page | `apps/web/src/app/[locale]/page.tsx` | Render, and decide what the user may see |
| Browser request | `apps/web/src/lib/store.ts` | RTK Query call to the web server |
| Web endpoint | `apps/web/src/app/api/.../route.ts` | Check the session, call the API |
| API endpoint | `apps/api/src/.../controller.ts` | Validate input, check membership and permission |
| Database | `apps/api/src/.../service.ts` | Query inside the organization's context |
| Contract | `packages/contracts/src/...` | Accept only known fields and codes |

## 2. Tests

| Layer | What it proves | Rule |
|---|---|---|
| Unit and contract | Rules and data shapes | Fast, synthetic data, readable steps |
| Real database | Queries, constraints, row security, migrations | Runs against a real PostgreSQL. Fails loudly if its address is missing |
| Isolation | One organization cannot read, change, count or export another's data | One negative test per organization-owned table |
| API | Validation, permissions, rate limits, error codes | Through HTTP, with Supertest |
| Browser | User journeys, success and failure | The standard viewports below, with axe accessibility checks |
| Production build | The security policy and anything else development mode relaxes | Fails on any policy violation, with a negative control that proves the check works |
| Worst-case data | Layout and limits | Long names, unbreakable emails, empty lists, huge counts, non-Latin text, every language |
| Live checks | The deployed system works | Never reset data, and never run once real users exist |
| Scale | Speed at expected volume | Measured p50 and p95 on a stated dataset, or NOT RUN |
| Page weight | What a visitor downloads before a page reacts | At most 150 KB of compressed JavaScript on the first load of each public page, measured on production by `scripts/measure-page-weight.ts`; scripts that load later on their own (Sentry once the page is idle, Vercel's analytics script) do not count |

Stand-ins replace outside services in automated tests, including timeouts, errors, duplicates and late or out-of-order events. Real checks against an outside service run only when the owner asks.

**Standard viewports**, used by every test, review and screenshot in the project:

| Name | Size | Why |
|---|---|---|
| Phone | 390×844 | A common modern phone |
| Tablet | 768×1024 | Where two-column layouts break first |
| Desktop | 1440×900 | A common laptop and desktop size |
| Narrowest | 320 wide | Overflow only: nothing may scroll sideways |

A design skill may check more widths. It never replaces these.

## 3. Evidence

- Every check is reported as PASS, FAIL or NOT RUN, with the exact command and numbers where they exist.
- Before saying "done" or "fixed", run the checks and read their output.
- If something cannot run locally, say so and rely on CI. Do not change a computer's security settings to make a tool run.
- A documentation check runs in CI: required files exist, local links and anchors resolve, decision IDs are consistent.
- Before committing documents, search the added lines for private values, comparing them with the private environment file and printing key names only.

## 4. Working with files

- Check `git status` before editing. Another tool may be editing the same checkout. If files are changing, work in a separate worktree with a short path, outside synced folders such as OneDrive.
- When a script edits documents, keep their line endings, and assert that the old text appears exactly once before replacing it.
- Never hand-edit generated files or lockfiles. Regenerate them with their tool.
