# Complete Timepiecepedia intake — 2026-10-25

Owner requested the entire downloaded dataset, deferring factual/manual checks
and images. HoroDB acquisition is deferred; no HoroDB requests were made here.

Processed all **224** detailed brand aggregate files: **42,590** source records,
42,584 distinct source page paths and 42,063 distinct normalized full
brand/reference identities with nonmissing identity. These are source counts,
not manufacturer-verified watches. Original duplicates and conflicting claims
remain available; none were silently merged or discarded.

Also read all **48,603 CSV rows**. Every CSV page path is already represented in
the detailed JSON, so there are **zero CSV-only records**. That is a coverage
comparison by page path, not a claim that overlapping CSV/JSON fields agree.
For shared pages the richer JSON representation is used; the original CSV and
its SHA-256 remain in the archive. Index and family files are overlapping
representations and are not added again as independent watches.

Compared against the existing read-only snapshot of **3,109** catalogue rows:

| Classification | Source records |
| --- | ---: |
| New candidate | 41,367 |
| Exact candidate | 239 |
| Alias/format candidate | 83 |
| Ambiguous | 605 |
| Numeric conflict | 292 |
| Missing identity | 4 |
| Total | 42,590 |

New means unmatched by the conservative comparison, not proven absent under all
possible aliases. Exact means a candidate link, not an approved merge. Conflicts
compare only nonnull diameter, thickness and water resistance; neither side is
declared correct. Existing IDs/rejected rows remain intact. Missing facts stay
null, and suffixes such as SKX007J/K1 are not removed. Source aliases are retained
separately. Other specifications remain source-declared field evidence.

## Local files and reproduction

```powershell
node --import tsx scripts/local-watch-intake.ts --all
```

This reuses the pilot's ignored `existing-catalogue.json` snapshot. It needs no
credentials or network. Source commit/file hashes are checked against the
previous acquisition manifest; these integrity checks are not factual review.
The optional `--refresh-catalogue` refreshes only the read-only catalogue snapshot,
using the same `.env` command documented in the pilot report.

Outputs in `data/watch-archive/full/`:

- `normalized.json`: all source records, nullable facts, original references,
  explicit aliases, source snapshot/file pointers and source-declared evidence.
- `matches.json`: complete candidate, ambiguity, missing-identity and conflict list.
- `csv-only.json`: supplemental CSV records; empty for this source snapshot.

Raw sources and full outputs remain local and ignored by Git. The committed
[machine-readable report](local-watch-intake-full.json) contains source/catalogue
hashes, per-brand counts, completeness and conflict examples.

The four-brand pilot remains reproducible without `--all`. This extension makes
no production writes, automatic promotions, image searches/downloads, external
research calls or paid requests. Factual verification, conflict resolution,
price checks and publication remain deferred at the owner's request.

Technical evidence: full local ingestion completed, including schema/hash
validation and CSV reconciliation. Formatting, lint and TypeScript passed. The
whole application test run passed 510/515 tests; five existing archetype sharing
tests failed while FX lookup logged timeouts (reproduced on a second run).
The intake safety tests passed. No unrelated application/test behavior was
changed to hide these failures; the aggregate gate is not claimed green and
manual/browser/factual review remains deferred by the owner.
