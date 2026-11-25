---
name: session-handoff
description: Close a session by writing an auditable, human-readable status with verified results, open risks, decisions and next steps.
---

# Hand off at the end of a session

1. Read `docs/STATUS_AND_HANDOFF.md`, the decision register, the active spec and `git status`.
2. Write the latest continuation: files changed, linked to their feature, spec and decision IDs, and why.
3. List each check with its exact command and PASS, FAIL or NOT RUN. Never invent a result.
4. List open risks: security, user experience, deployment, migrations, outside services.
5. Separate clearly: decisions the owner accepted, proposals, and open questions.
6. Give the next session up to three tasks, with starting files, how to reproduce known problems, the rollback, and what is uncommitted.
7. Update `docs/NEXT_CHAT.md` and the changelog.
8. No secrets or real personal data. Do not commit or deploy unless the owner asked.
