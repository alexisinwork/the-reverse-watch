---
name: release-readiness
description: Decide GO or NO-GO before a release, from actual evidence on tests, migrations, privacy, recovery, accessibility and monitoring.
---

# Release readiness

Collect **actual** CI and staging evidence, not promises. Group findings as blocking, warning, or accepted risk.

**Block on:** failing sign-in or isolation tests, no backup and restore evidence, an unapproved outside integration, secrets or real personal data where they should not be, an unreviewed destructive migration, an unknown rollback, missing privacy obligations for real customer data.

**Check:** types, lint, unit, integration and browser tests; dependency and secret scans; migrations on a test database; speed on staging; request and job traces; basic accessibility; monitoring alerts and who receives them; export and deletion; readable release notes.

**For a public website, also:** the performance budget on the production build, titles, canonical links, sitemap and `noindex` on previews, nothing that needs consent loading before it, the privacy notice and imprint where required, every stand-in photograph and `.example` contact replaced, and licences for every photograph, font and logo. The launch checklist in `docs/WEBSITE_GUIDE.md` lists them.

**Output:** GO or NO-GO, with owners, links to evidence, remaining risks, deploy order and the rollback command. Never approve a production release yourself, and never run a destructive action automatically.
