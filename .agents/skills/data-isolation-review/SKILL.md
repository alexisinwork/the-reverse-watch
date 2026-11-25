---
name: data-isolation-review
description: Review that one customer organization can never read, change, count or export another's data, across the API, database, files, imports, exports, jobs and integrations.
---

# Review isolation between organizations

Review only our own code and test environment.

For every new or changed read or write, trace: identity → membership → organization → record ownership → permission. Include background jobs, files and outside integrations.

**Test with two organizations** holding similar records:

- guessing or swapping IDs;
- leaks through sorting, filters, counts and pagination;
- export scope;
- attachments and signed links;
- a removed or inactive member, including jobs queued before the removal;
- credentials for an outside service swapped between organizations;
- error messages that reveal other records;
- spreadsheet formulas in exports, script injection in text fields, and requests to internal addresses from links users supply.

Do not rely on one guard or one query convention. Check joins and scoping in the queries, and that row security holds under the real runtime role. Report reproducible failures, impact and the fix. Block the release until every serious finding is fixed and has a regression test.
