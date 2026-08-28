# Vercel deployment and rollback

Last verified: 2026-08-28

## Current state

- Vercel project: `the-reverse-watch` in the `alexisinworks-projects` team.
- Git source: `alexisinwork/the-reverse-watch`, with `main` connected to
  production deployments.
- Production deployment `dpl_HfvJDBdvDC7Ue1nt2qjJf1Ep72Ee` is the verified
  rollback target before the Phase 3/4 recommendation release. The repository
  pins `framework: react-router` in `vercel.json`; `/`, `/quiz`, and `/health`
  returned 200 on `https://the-reverse-watch.vercel.app/` on 2026-08-28. This
  resolves the earlier framework-null `NOT_FOUND` incident.
- The repository's canonical domain is `thereserve.watch` (`CNAME` and landing
  copy). The Vercel project currently lists `thereverse.watch` and
  `www.thereverse.watch` instead. Treat this mismatch as an unresolved
  production-routing issue and reconcile it toward the canonical repository
  domain with reversible, recorded changes.
- Encrypted variables named `DATABASE_URL` and `DIRECT_DATABASE_URL` exist in
  the Vercel project, but the production environment does not currently inject
  usable values. The recommendation route therefore uses the reviewed bundled
  seed until the Supabase server connection is configured and parity-tested.

## Preview procedure

1. Run `npm run check` locally. Do not run the deferred Playwright/E2E suite
   during Phases 1–4.
2. Push the reviewed commit to a non-production branch so the existing Git
   integration creates a preview deployment.
3. Confirm that the Vercel build reaches `READY`, then perform only short
   read-only checks of `/`, `/health`, and an unknown route. Do not submit the
   Beehiiv form.
4. Record the preview deployment ID and URL in the phase handoff.

Pushing `main` creates a production deployment and is the standard delivery path
for this owner-designated test project.

## Production migration

For a production deployment or domain reconciliation:

1. Record the current production deployment ID as the rollback target.
2. Confirm encrypted environment values in Vercel without copying their values
   into logs or documentation.
3. Promote the accepted preview or push the exact reviewed commit to `main`.
4. Confirm the new deployment is ready before changing domain routing.
5. Attach the canonical domain, verify both apex and `www` behavior, and record
   any DNS change before and after applying it.
6. Run the production smoke checks appropriate to the current testing cadence.

## Rollback

If the migrated application fails before a domain change, use Vercel's rollback
operation to restore the recorded production deployment. If DNS was changed,
restore the previous verified records as a separate reversible action.
Never delete the failed deployment during incident review; retain its build and
runtime logs for diagnosis.
