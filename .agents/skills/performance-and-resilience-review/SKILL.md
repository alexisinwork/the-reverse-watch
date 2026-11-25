---
name: performance-and-resilience-review
description: Verify that workflows stay fast at realistic volumes and behave clearly when things fail, with measured evidence, before accepting a change.
---

# Review speed and resilience

1. Read the feature spec, its quality requirements and the official docs for the libraries involved.
2. Name the user action, data size, expected concurrency, success signal and failure paths. Never invent a passing benchmark.
3. Browser: cache design, server-rendering isolation, re-render hotspots. The browser never loads whole tables.
4. Database: filters, indexes, organization scoping, query plans, stable cursor pagination, no N+1 queries, only the fields needed.
5. Writes: transactions, permissions, conflicting edits, idempotency keys, retries and compensation. Confirm that a queue is really needed.
6. Failure: outside timeouts and errors, duplicate and out-of-order events, a worker crash, stale screens, lost network. Each shows a visible pending, failed or retry state, never a fake success.
7. Measure where possible: p50, p95 and p99, dataset size and conditions. If nothing ran, say NOT RUN.
8. Report expected and actual behaviour, evidence, risk and the smallest safe change.
