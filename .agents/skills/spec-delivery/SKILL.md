---
name: spec-delivery
description: Deliver a bounded, owner-approved feature through specification, plan, tasks, small slices, verification and handoff.
---

# Deliver a feature from its spec

1. Check that the owner approved the feature's scope, and read the accepted decisions. If scope is missing, do discovery only.
2. Write or refresh `spec.md`, `plan.md` and `tasks.md` from the feature template, or with GitHub Spec Kit if it is installed (`speckit-specify`, `speckit-clarify`, `speckit-plan`, `speckit-tasks`, `speckit-analyze`). Get the owner's approval before building.
3. Make the first task a check that can stop the feature, with an explicit stop point.
4. Plan tests first, including failures and access from another organization. Read the official docs for every new package.
5. Build **one small vertical slice at a time.** Do not expand the feature on your own.
6. Run the checks and report PASS, FAIL or NOT RUN with the commands. Review screens at the standard viewports, 390×844, 768×1024 and 1440×900, with synthetic data. For screens, name the surface's builder skill in the plan, as `AGENTS.md` section 5 says.
7. Update the spec, tasks, decisions, status, next chat and changelog. Stop and ask at any blocker.
