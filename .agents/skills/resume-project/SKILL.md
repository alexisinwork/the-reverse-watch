---
name: resume-project
description: Pick up the project in a new chat in a few minutes. Use at the start of a session, or when asked to continue, resume or check where the project stands.
---

# Resume the project

1. Run the status script (`pnpm status`) if it exists. It shows Git state, latest deploys, live health and which settings exist, without printing secrets.
2. Read the **Latest continuation** section of `docs/STATUS_AND_HANDOFF.md`, then `docs/NEXT_CHAT.md`.
3. Run `git status` and look at recently changed files before editing. Another tool may be working in the same checkout. If files are changing, use a separate worktree with a short path outside synced folders.
4. Read other documents only when the task needs them:

| Task | Read |
|---|---|
| A new feature | The feature's `spec.md`, `plan.md` and `tasks.md`, and the `spec-delivery` skill |
| Screens and pages | `PRODUCT.md`, `DESIGN.md` and `docs/DESIGN_WORKFLOW.md` |
| An open product question | `docs/OWNER_QUESTIONS.md` |
| A past decision | `docs/decisions/DECISION_REGISTER.md` and its ADR |
| Technology | `STACK.md` and the official docs for the installed version |
| Personal data | `docs/SECURITY_AND_PRIVACY.md` |
| Something broken | `docs/ENGINEERING_STANDARDS.md` and the `incident-investigation` skill |

5. Tell the owner in a few lines what is live, what is broken and what is next. Then continue.

## Rules that are easy to miss

- Secrets live in the private environment file. Print key names only.
- Commit, push, migrate and deploy only when the owner asks in that turn.
- No real personal data before its gate.

At the end of a task, update the latest continuation so the next chat can start from it.
