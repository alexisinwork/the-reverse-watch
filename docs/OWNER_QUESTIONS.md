# Owner questions and actions

Open items only the owner can decide or do. Each says why it matters and what
happens once it is done. Closed items move to the decision register.

| # | Question or action | Why | When done |
| --- | --- | --- | --- |
| 1 | Upgrade the Vercel project from Hobby to Pro | Hobby does not permit commercial use; selling partner widgets is commercial | Before the first paying partner |
| 2 | Allow creating a production partner key for `https://oleksandr-kukhtin.dev`, and deploy the `personal-website` with it | The public demo (business plan next action) returns 404; a new access key needs explicit permission | The demo page can be verified on production |
| 3 | Download Supabase's CA certificate (Dashboard → Database → SSL configuration) | Database scripts encrypt but cannot verify the server without it | Pin it in every script; Semgrep stays clean without exceptions |
| 4 | Add read-only database credentials to GitHub secrets for the evaluation | `scripts/run-evals.ts` needs the database, so it runs locally only | Run the evaluation on every push and fail on a regression |
| 5 | Set a research budget for missing comparison specifications | 14 of 20 alternatives test watches lack styles, size or movement, so the finder cannot compare them (`docs/eval-baseline.md`) | Alternatives recall can be measured on all 60 cases |
| 6 | Review a set of film sightings that are not published stories | The film evaluation's labels come from the stories search now shows, so its 20 of 20 is circular | An independent film-search score |
| 7 | Decide whether Sentry may load after the first paint | It is most of the 105 KB entry script; loading it later would miss errors in the first second | Home page JavaScript under the 150 KB budget |
| 8 | Choose targets for episode short links | All 80 links lead home with campaign tags (`docs/episode-links.md`) | Each episode's viewers land on the matching tool |
| 9 | Confirm the version 2 plan (Next.js on the starter kit) still stands | Phase 0 met the speed goals without changing framework; the rewrite is now about maintainability | Start version 2 as its own branch and session |
