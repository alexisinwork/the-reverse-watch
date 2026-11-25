# Next chat

Paste into a new chat to continue:

> Continue The Reserve rebuild. Read `AGENTS.md` (owner decisions, including
> "Speed, caching and relevance rebuild"), then `docs/STATUS_AND_HANDOFF.md`
> and `docs/OWNER_QUESTIONS.md`. Run `npm run check` and
> `node --env-file=.env --import tsx scripts/run-evals.ts` before changing
> anything, and compare with `docs/eval-baseline.md`. Continue from the
> "Next step" in the status file, one verified step at a time, reporting
> PASS, FAIL or NOT RUN with the command for every check.

The `resume-project` and `session-handoff` skills in `.agents/skills/` describe
the same routine. Run `node scripts/link-agent-skills.mjs` once after cloning
so Claude Code sees the skills through `.claude/skills`.
