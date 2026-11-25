---
name: record-decision
description: Capture a new product or architecture choice as a Git-tracked proposal, compare alternatives and ask the owner to approve. Never silently change an accepted choice.
---

# Record a decision

1. Read `docs/decisions/DECISION_REGISTER.md` and the linked ADRs. Find the decisions this one affects.
2. State the evidence, assumptions and options. For each option: security, performance, operations, maintenance cost, how to reverse it, and effect on dependencies.
3. Draft an ADR from the template, and add a PROPOSED row to the register. Never mark it ACCEPTED yourself.
4. List what it changes: specs, code, tests, migrations, outside services, costs, and the rollback.
5. Give the owner one short question with your recommendation first. **Stop** before building if it conflicts with an accepted decision.
6. After the owner's explicit approval, mark it ACCEPTED with their exact words and the date, mark anything it replaces SUPERSEDED, and update documents and tests together.
