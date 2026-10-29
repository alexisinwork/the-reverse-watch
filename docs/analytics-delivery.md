# Anonymous analytics delivery and widget journeys

Migration 0113 adds nullable delivery IDs to the existing event table. Historical
events and partner history stay intact. New browser events carry a fresh UUID;
the same UUID and payload survive a single bounded retry on a connection/server
failure. The server also retries a transient database outcome once. The v3 writer
atomically acknowledges an identical replay without counting it twice. A changed
payload with the same ID returns a conflict and cannot overwrite the original.
The first hosting-supplied country is retained when a retry has a different one.
Legacy clients receive a server-generated ID for their database retry.

The writer remains service-role only. POST, same-origin, schema and shared rate
limits still apply. Operations readiness v4 checks the new writer's privileges.
No paid research or visitor data goes to a watch-research provider in this flow.

Shared loader `embed.js` 1.1.1 generates one random parent-page nonce for all tool
frames it creates. It uses no cookie or browser storage. Each embedded tool uses
that nonce as its in-memory anonymous session, so the analytics journey can show
the visitor switching tools. First-party pages ignore injected nonce parameters.
Parent advisor tab/retry clicks are relayed to the active frame only after it is
ready; the receiver checks parent window, registered origin, partner key, tool
and a strict message schema. The nonce is not a search constraint, cache key or
research prompt input. A reload starts a new journey. Older separate frame
sessions cannot be reconstructed retrospectively.

This shared loader serves native HTML, WordPress, Shopify and builder snippets;
no WordPress plugin source or package changed in this phase. Installation on a
particular hosted platform still needs that platform's runtime verification.
The only link on quiz/archetype widget result screens remains the Powered by
credit. Source/review labels remain text.

This is bounded best-effort delivery while the browser is alive, with keepalive
on requests. It does not guarantee events blocked by a browser, an offline/closed
page, or deliberate client manipulation. It does not identify a person across
reloads or websites, record field values, or reconstruct earlier lost events.

Verification commands:

```powershell
node --env-file=.env --import tsx scripts/test-interaction-idempotency.ts --applied
node --env-file=.env --import tsx scripts/verify-interaction-delivery-production.ts --local
# Start the built app on localhost:4173; keep 127.0.0.1:8080 free for the fixture:
node --env-file=.env --import tsx scripts/verify-widget-analytics-local.ts
node --env-file=.env --import tsx scripts/verify-interaction-delivery-production.ts
```

The applied database check always rolls back its synthetic data, including the
real server adapter's lost-acknowledgement/retry path. The HTTP probe writes one
tagged synthetic page view twice, checks one row and removes only its exact
owned fixture ID with session/marker guards. The browser probe opens five real
production-bundle tool frames under the registered local origin; only its blank
host HTML is a fixture. It verifies five page-view features and five advisor-click
features under one session, without submitting searches or feedback votes. Its
cleanup requires exact event IDs, site, session and synthetic campaign/source.
Real partner records, counters and visitor history are not deleted.

Local verification passed the full 716-test gate, twelve desktop/mobile browser
checks and seven native/real WordPress scenarios. The built-bundle analytics
probe recorded exactly ten unique events (five views/five advisor tab clicks)
under one session, then removed them with all fixture guards. No feedback vote,
paid attempt or cost was added. Only Vercel's hosting-specific insights script
returns 404 on the local Node runtime; application interaction events succeeded.

Reports live in `docs/reports/interaction-delivery-production.json` and
`docs/reports/widget-analytics-local.json` after successful verification. Backup
rehearsal now compares original snapshot columns when an additive column is
introduced. The earlier 55-table/178,586-row/52-foreign-key snapshot restored and
passed hashes/constraints against the schema containing 0113 without replacing
production tables. This remains an application-data rehearsal, not proof of
managed Supabase backups or full project recovery.
