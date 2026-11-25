---
name: vertical-slice
description: Build one small, tested, end-to-end piece of a feature through every layer it touches, from the page to the database, with security, rollback and review.
---

# Build a vertical slice

**Before code,** write down: the user outcome, the request and response, the entities, the rules that keep organizations apart, any migration, the test categories, accessibility, and the rollback. Show the smallest plan. Add no infrastructure without a need. A static page has no API or database: skip those parts, not the rest.

**Test first:**

- the rule, as a unit test;
- the API against a real test database, where there is one;
- access from another organization, guessing IDs, which must fail, where organizations exist;
- a browser test of the success and the failure path, at the standard viewports 390×844, 768×1024 and 1440×900;
- a log line with the request ID.

**Look at it** in a browser at the same three viewports with `playwright-cli` before calling it done. Visual work is verified by looking and by its builder's checks, as `AGENTS.md` says; behaviour is verified by tests.

**Deliver:** changed files, commands run with their real results (PASS, FAIL or NOT RUN), the migration with its down script, what to watch in monitoring, risks, rollback, and the next smallest piece of work. Screenshots only from synthetic local data. Never claim a test you did not run.
