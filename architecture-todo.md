# Architecture status

The former Mastra/Ollama/vector-first sketch in this file has been superseded.
It is preserved in git history and in the owner's
[`original_context.md`](docs/original_context.md), but it is not an
implementation checklist.

The accepted direction is documented in:

- [`docs/sql-first-recommendation-architecture.md`](docs/sql-first-recommendation-architecture.md)
- [`docs/implementation-roadmap.md`](docs/implementation-roadmap.md)
- [`docs/original-plan-requirements.md`](docs/original-plan-requirements.md)

Current baseline: React Router + TypeScript + Zod + PostgreSQL, with SQL hard
filters, explicit weighted scoring, deterministic diversity, and cited
explanations. Chunking, embeddings, a vector database, Mastra, Ollama, and
RunPod are optional later experiments rather than launch dependencies.
