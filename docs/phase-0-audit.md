# Phase 0 repository audit

Date: 2026-08-27

## Result

The repository is a clean, four-file static website on the `main` branch. It is
connected to `https://github.com/alexisinwork/the-reverse-watch.git`. Phase 0
adds documentation and secret-handling foundations only; it does not change the
landing page or subscription behavior.

## Evidence from the current repository

| Area | Observed state | Consequence |
| --- | --- | --- |
| Landing page | A single `index.html` with inline CSS | Must be preserved visually during the framework migration. |
| Subscription | Beehiiv loader with form ID `e0fc5991-3244-47f3-a4fd-1214039d9da7` | The current signup path can survive Phase 1 without exposing an API key. |
| Domain | `CNAME` contains `thereserve.watch` | Domain routing must be verified after the hosting migration. |
| Application framework | No `package.json`, build command, server route, or test runner | The repository is not currently a Remix/React Router or Vercel application. |
| Questionnaire | `questionnaire.js` imports React and contains TypeScript syntax | It cannot execute directly as browser JavaScript and is not linked from the landing page. |
| Question count | The prototype has eight independent questions | This conflicts with the seven-question wording in the product notes. |
| Recommendation API | The prototype calls `/api/recommend` | No such server endpoint exists. |
| Data layer | No catalogue, schema, database client, or vector index | Recommendations cannot yet be grounded in watch records. |
| AI integration | No installed Mastra, OpenAI, Perplexity, or Ollama client | The snippets in `architecture-todo.md` are proposals, not running code. |
| Secret management | No `.gitignore` or environment template existed | Phase 0 adds both before any credentials are introduced. |
| Deployment evidence | `CNAME` suggests GitHub Pages; the project context says Vercel | The active production provider must be confirmed in Phase 1. |

## Product decisions proposed for approval

### Keep eight diagnostic questions

The prototype separates wrist circumference from deployment environment. That
is preferable to combining them: wrist size constrains geometry, while use
environment constrains water resistance, shock tolerance, and thickness. They
should remain independently filterable.

The eight inputs are:

1. Budget ceiling.
2. Wrist circumference.
3. Maintenance tolerance.
4. Deployment environment.
5. Social signal.
6. Aesthetic DNA.
7. Corporate provenance preference.
8. Emotional objective.

### Store facts separately from semantic interpretation

PostgreSQL should be authoritative for exact values such as reference number,
price, diameter, thickness, lug-to-lug, water resistance, calibre, availability,
and source dates. `pgvector` should index narrative attributes such as design
character, social signal, collector appeal, and editorial summaries.

This avoids using similarity search for constraints that SQL can enforce exactly.

### Treat source provenance as required data

Every mutable or factual claim must retain its source URL, publisher, retrieval
date, source type, and verification state. Missing specifications remain `null`;
the ingestion system must never invent defaults.

### Make the model provider replaceable

The recommendation contract should not depend on one model vendor. OpenAI can
provide the production baseline, while Ollama can be selected for local or
RunPod inference after its output quality passes the same evaluation set.

## Risks already identified

- Perplexity output is research material, not automatically trusted catalogue
  data. It requires schema validation and a review queue.
- Prices, availability, ownership, and current catalogues change over time and
  require timestamps and refresh jobs.
- Wrist compatibility cannot be inferred reliably from diameter alone.
- A vector database by itself cannot enforce budget, dimensions, or service
  constraints.
- Email subscription must be an explicit opt-in and must not determine whether
  the user can see their result.
- Model-generated explanations must be grounded only in retrieved, cited records.

## Phase 0 acceptance checklist

- [x] Existing files and git state inspected.
- [x] Runtime gaps and contradictions recorded.
- [x] Incremental delivery plan added.
- [x] Secret-safe `.env.example` added.
- [x] `.env` files excluded from git.
- [x] No production behavior changed.
- [x] Owner approved Phase 1 and confirmed eight questions on 2026-08-27.
- [x] Owner confirmed Vercel as the active production host on 2026-08-27.
