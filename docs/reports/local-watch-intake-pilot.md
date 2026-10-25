# Local watch intake pilot — 2026-10-25

Completed local normalization of Tissot, Seiko, Casio and Omega against a read-only
snapshot of all 3,109 current catalogue rows, including rejected rows. Existing
UUIDs are retained as candidate links only. No database mutation was performed.

| Brand | Source rows | New candidates | Exact candidates | Alias/format candidates | Ambiguous | Numeric conflicts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Tissot | 1,976 | 1,939 | 8 | 0 | 10 | 19 |
| Seiko | 138 | 136 | 1 | 1 | 0 | 0 |
| Casio | 122 | 122 | 0 | 0 | 0 | 0 |
| Omega | 3,835 | 3,772 | 25 | 0 | 0 | 38 |
| Total | 6,071 | 5,969 | 34 | 1 | 10 | 57 |

These are source-record counts, not counts of verified new watches. Exact
candidates are not approved merges. Unmatched references are new relative to
this conservative comparison, not proven absent under every catalogue alias.
Conflicts mean disagreement, not proof either source is wrong. Source identity
duplicates and multiple existing exact matches are held as ambiguous.

Only diameter, thickness and water resistance are compared numerically in this
pilot; null on either side is not a conflict. Material, movement descriptions,
names and other assertions remain source-declared evidence, not automatically
equivalent facts. No movement type is inferred from a calibre name. Neither
prices nor images are imported, and manufacturer confirmation remains false.

Example: Tissot `T101.410.11.051.00` has 39 mm in the source versus 40 mm in the
existing catalogue. `T122.410.11.033.00` disagrees in both thickness and water
resistance. Keep both assertions and verify against a primary source before
changing either value.

Source coverage is uneven: Seiko's 138 and Casio's 122 rows are far from a
comprehensive mass-market catalogue. Omega has 3,835 records but only 983 include
a strictly parseable thickness. A high row count does not mean complete facts.

## Reproduce

Source acquisition: [strategy](../local-watch-database-strategy.md).

```powershell
# Initial read-only refresh; credentials stay in ignored .env:
node --env-file=.env --import tsx scripts/local-watch-intake.ts --refresh-catalogue

# Subsequent runs are entirely local and require no credentials/network:
node --import tsx scripts/local-watch-intake.ts
```

Inputs must match the source commit AND audited per-file SHA-256. Malformed
source records fail validation rather than silently disappearing. Offline runs
reuse the same catalogue snapshot and reproduce the same report.

Ignored files under `data/watch-archive/pilot/`:

- `existing-catalogue.json`: validated read-only snapshot and retrieval date.
- `normalized.json`: 6,071 research-only records with raw references, explicit
  aliases, nullable normalized fields and source-file JSON pointers for evidence.
- `matches.json`: complete candidate/ambiguity/conflict list, preserving current IDs.

Committed [machine-readable report](local-watch-intake-pilot.json) records source
commit, content hashes, catalogue snapshot hash/date, field completeness and
conflict examples. Back up the ignored source and pilot folders separately.

Safety tests cover suffix preservation, alias review, strict units, missing
values, evidence, unchanged inputs, conflicting facts and duplicate identities.
The fast gate includes script tests alongside application tests: 515 tests in
85 files passed. Offline rerun report SHA-256 equality was verified.

Next checkpoint: extend permitted source intake and review conflicts against
primary evidence before any controlled catalogue promotion. HoroDB whole-site
crawling remains excluded; bulk export requires publisher coordination. No
external message or paid API request has been sent by this pilot.
