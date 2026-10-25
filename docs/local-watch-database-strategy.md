# Local watch catalogue: source audit and integration strategy

Verified/retrieved 2026-10-25. This is a source-intake follow-up to the existing
roadmap, not a replacement for its original questionnaire, history, psychology,
perception, dossier or media requirements. Replica remains deferred.

## Decision

Build an owned local master catalogue from versioned source snapshots. External
APIs populate staging; they must not be required to answer catalogue queries.
Start with reference identity and specifications. **Skip images entirely**:
no image downloading, searching, transformation or publication in this intake.
Raw source files may contain URL strings; later image enrichment stores URLs
only, through Muse/Perplexity after model identity is established.

Do not add source counts together. Listings, references, variants and auction
observations are different units; several providers share upstream material.
Public access is not automatically permission for bulk mirroring or redistribution.

## Sources and download paths

| Source | Evidence and access | Use / restriction |
| --- | --- | --- |
| [Timepiecepedia](https://github.com/timepiecepedia/timepiecepedia-data) | Downloadable CSV/JSON; project declares CC0. README claims 48,658 references and CSV 48,603; local detailed aggregates contain 42,590 records across 224 brands. | First local snapshot. Preserve upstream provenance; CC0 declaration does not establish every upstream right. Never combine aggregate, family and index files as extra watches. |
| [HoroDB](https://horodb.net/about) | Claims 290,588 references, 1,917 brands. [Terms](https://horodb.net/terms) grant CC BY 4.0 including database rights, but prohibit copying the entire catalogue request by request. [API docs](https://horodb.net/api-docs) do not yet provide a stable public contract. | Highest-priority bulk-export request. Do not implement a full-site crawler. Predominantly automated records require checking; published counts are not a verified unique-reference count. |
| [Dials](https://docs.dials.co/api/reference) | Live `/v1/models?page=1&pageSize=1` reported 41,996; `brand=tissot` reported 1,978. [OpenAPI](https://api.dials.co/openapi.json) uses `brand`, despite a documentation example using `brandSlug`. List responses are summaries; detailed specs require detail requests. | [Terms](https://docs.dials.co/api/terms) allow building with attribution and a model-page link. Not CC0. Clarify full bulk export/perpetual commercial mirror and distribution terms before wholesale ingestion. [Limits](https://docs.dials.co/api/rate-limits): 600/min/IP; respect Retry-After, no IP sharding. |
| [Space City Timepieces](https://spacecitytimepiece.com/api/v1/watches.json) | Actual JSON index declares CC BY 4.0 and totals 25,385 references / 885 models / 26 brands; follow its per-brand `api` links. Root response is an index, not the whole dataset. | Secondary-market observations, not primary specifications. Omega response contains conflicting sizes for the same ref. Preserve arrays/conflicts; never choose one silently. |
| [Chrono24 research dataset](https://github.com/philmorefkoung/Webscrapped-Watch-Dataset) | Roughly 280k listings, with full files linked on Kaggle; also the declared upstream of Space City. | Historical listing/price observations only. Do not count the two sources as independent corroboration. Repository MIT licensing alone does not settle underlying marketplace-data rights. |
| [WatchBase DataFeed](https://datafeed.watchbase.com/) | Published export/API offering, CSV/XML/JSON, $0.30 per entry, images excluded. Published count 41,956 is a vendor claim. DataFeed/API endpoints returned 403 from this environment. | Yes, licensed API/export is offered; no credentials or purchase made. Prefer contracted initial bulk export, then deltas. Exact routes and update/repeated-call billing remain unverified here. Confirm retention, publication, redistribution and termination rights in writing. |
| [Kello API](https://kellowatch.com/api-docs) | Bearer API for watches/brands/collections and market data. Sample counts are illustrative. [Terms](https://kellowatch.com/terms) restrict sharing/reselling raw data. | Contract first for permanent local storage and partner-facing use; do not treat an API subscription as a raw-data distribution licence. |
| [WatchCharts API](https://watchcharts.com/api) | PAYG and dedicated plans; dedicated Level 1 starts at $600/month. Default licence is internal use. | Price observations after a distribution agreement, not the initial reference master. The old blanket claim “API starts at $600” omitted PAYG. |
| [EveryWatch terms](https://everywatch.com/terms-condition) | No official public bulk API verified; terms restrict automated use/copying. | Contracted feed only. Third-party scrapers are not official access. |
| [ALT/FNDATA](https://docs.altfndata.com/) | Claims 823,037 watch auction records; authenticated API with plan quotas; bulk export requires institutional agreement. | Sales history in separate observations, not 823k distinct watches. |
| [TheWatchAPI](https://www.thewatchapi.com/documentation) | Authenticated search API; [terms](https://www.thewatchapi.com/tos) do not establish unrestricted permanent commercial mirroring. | Clarify agreement before importing; do not use search-result counts as catalogue coverage. |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Database_download) | [Structured data CC0](https://www.wikidata.org/wiki/Wikidata:Licensing), dumps and API. | Brand identities, ownership/history and external identifiers. Not a complete reference catalogue; avoid downloading the enormous complete dump for a narrow brand task. |

WatchBase's quoted per-entry rate would make 41,956 entries $12,586.80 before
any negotiated terms. This is arithmetic, not a purchase quote or budget approval.
No paid source was bought or authenticated for this investigation.

For broad coverage prioritize explicit gap reports for Casio, Seiko, Citizen,
Orient, Swatch, Timex, Soviet and discontinued brands. Seek official feeds,
archived catalogues and permitted historical extracts. Another luxury provider
alone will not close these gaps. Track coverage by brand, era, movement category
and verified fields, not just row count.

## Local snapshot already acquired

Ignored local folder: `data/watch-archive/timepiecepedia`.
Pinned upstream commit: `d37b781c12475cee5dc9a4f270037204590c1575`.

```powershell
git clone --depth 1 https://github.com/timepiecepedia/timepiecepedia-data.git data/watch-archive/timepiecepedia
node scripts/audit-timepiecepedia.mjs
```

Clone only when the folder does not already exist. Reproduce an older snapshot
by fetching/checking out the recorded commit in this dataset checkout, not in
the application repository. Do not execute upstream scripts/notebooks.

The audit writes `docs/reports/timepiecepedia-snapshot.json`: measured CSV/JSON
counts, exact brand/reference duplicates, per-brand counts and SHA-256 hashes
of all inspected files. It reads locally, does not fetch URLs, and has no DB
connection. Its exact duplicate count is diagnostic, not a canonical merge rule.
The source clone is kept off Git; back it up with its manifest on separate storage.

## Fit to this application

The current recommendation read model is `private.watch_catalogue` (migration
0071 onward), represented by `app/domain/watch-catalogue.ts`, queried by
`watch-catalogue.server.ts`, filtered in `quiz-search.server.ts`. Do not replace it
with the older SQL-first design or feed arbitrary source records directly into
it: pending rows are public, so pending is not a private import quarantine.

The existing normalized reference/variant tables, `sources`, `field_evidence`,
review queue and research dossiers provide useful provenance infrastructure.
Extend/reuse these after a schema mapping, rather than duplicating brand history,
traits, evidence and research eligibility. Preserve existing IDs and app relations.
Raw intake stays local and research-only until promotion is explicitly validated.

1. **Archive:** immutable source/commit or snapshot ID, fetched time, terms snapshot,
   SHA-256, upstream lineage, raw record ID and payload. Keep changes as new versions.
2. **Normalize locally:** brand aliases; original and normalized full reference;
   explicit alternate references; collection/model/variant distinctions; units;
   nullable facts. Each field keeps its source record/JSON pointer, retrieval and
   verification state. Conflicting assertions coexist until resolved.
3. **Match safely:** exact brand plus full reference produces candidates. Compare
   configuration and dimensions before linking; never erase suffixes such as
   SKX007J versus SKX007K1. Fuzzy titles propose review candidates only. The UI's
   title-based display deduper is deliberately unsuitable for catalogue merging.
4. **Verify and promote:** manufacturer/authorized-retailer confirmation is still
   required to mark a reference confirmed. Missing hard-filter facts cannot match.
   Source prices do not bypass independent current-price verification, provenance
   or review. Do not infer wearing-style tags or movement type from a brand name.
5. **Serve locally:** local PostgreSQL master and indexes, with backups and exports.
   Publish an approved read-model replica to the existing hosted app, preserving
   UUIDs and reversible source mappings. A Vercel deployment cannot read this PC's
   drive. Existing Supabase/provider/fallback/FX dependencies mean the application
   is not currently fully offline merely because a dataset was downloaded.

For true offline catalogue operation, use a local runtime/database and disable
network fallback explicitly; return insufficient coverage rather than silently
querying providers. Later online enrichment writes staged updates, never makes
requests necessary for serving existing verified catalogue entries.

## Sequenced delivery and acceptance

This follow-up starts with source audit, not a production migration.

1. **Source audit — completed:** primary-source terms/API inspection; pinned
   Timepiecepedia clone; reproducible counts/hashes; images excluded. No production
   data changes, cache scans, paid calls or full-site scraping.
2. **Local normalization pilot — completed:** Tissot, Casio/Seiko and Omega;
   see [measured results and commands](reports/local-watch-intake-pilot.md).
   6,071 research-only records; no automatic merges or production imports.
   Compare a read-only export of `watch_catalogue` by brand/full-reference;
   report linked/new/ambiguous/conflicting rows and field completeness. Retain
   original intake and do not auto-promote. Design any additive DB migration only
   after this mapping and the existing schema/research interfaces are reviewed.
3. **Downloaded-source expansion — completed:** all 224 Timepiecepedia brands
   and CSV coverage reconciled locally; [full report](reports/local-watch-intake-full.md).
   Owner defers factual checks and images. Further-source expansion: request
   HoroDB bulk snapshot and clarify Dials mirror
   terms; import allowed sources with resumable checkpoints, rate limits, retries,
   content hashes and no-op reruns. Keep listing observations separate.
4. **Verification/read model:** primary-source checks, conflict review and controlled
   batch promotion with rollback mappings; retain all original product requirements.
5. **Autonomy and partner inventory:** local serving/backup restore drill. A partner
   inventory then needs an explicit site-to-reference scope on every feature and
   cache key; provider fallback must not escape that scope. This is not implemented
   by the snapshot or by filtering one widget's first request.

Acceptance includes unchanged existing IDs/results, no false merges, null facts
remaining null, source-level attribution, measured brand/era gaps and repeatable
offline reads. No image work is a prerequisite for these steps.
