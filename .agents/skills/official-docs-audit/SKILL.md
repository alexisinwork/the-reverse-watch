---
name: official-docs-audit
description: Read current, version-specific official documentation and breaking changes before adopting a package, using a code pattern, calling an outside API or upgrading dependencies.
---

# Check the official docs first

1. Name the exact need and the accepted decisions. Do not add an alternative library unasked.
2. Open the maintainer's official documentation, release notes and migration guide at task time. For an outside API, open its reference.
3. Record the stable supported version, the versions it needs from the rest of the stack, its release date, breaking changes and security notes.
4. Flag advice from old tutorials or blog posts that conflicts with the docs. Where the docs are unclear, run a minimal test.
5. Write the links, the date, the pinned version and the chosen pattern into the feature plan. Never claim you checked something without having opened it or run it.
6. A major upgrade or a new core library goes through `record-decision`.
