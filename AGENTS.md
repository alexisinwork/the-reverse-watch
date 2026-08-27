# Repository agent instructions

## Delivery boundaries

- Work from `docs/implementation-roadmap.md` one phase at a time.
- Do not begin the next phase until the owner explicitly approves it.
- Keep the application and research pipeline in TypeScript/JavaScript.
- Never commit `.env`, credentials, raw authentication caches, or access tokens.
- Do not print secret values in commands, logs, tests, or responses.

## Documentation and research routing

- Use the `openai_docs` MCP server for OpenAI API, model, Codex, ChatGPT, or
  plugin questions before relying on memory.
- Use `context7` for current third-party package and framework documentation.
- Use `perplexity` for watch-market and horological research that needs current
  web sources. Retain citations and retrieval dates.
- Treat Perplexity results as research inputs. Validate them against schemas and
  primary sources before accepting them into the catalogue.

## External systems

- Use `github` and `vercel` MCP tools for inspection when connected.
- Require owner confirmation before production deployments, domain changes,
  credential changes, destructive actions, or external writes outside the
  already approved phase.
- Use least-privilege tokens and project/service accounts rather than personal
  keys wherever the provider supports them.

## Quality invariants

- Exact watch constraints belong in PostgreSQL; subjective matching belongs in
  semantic retrieval.
- Missing facts remain `null`; never supply plausible-looking defaults.
- Every accepted mutable or factual claim retains source provenance.
- Run the phase's documented checks before committing and pushing it.
