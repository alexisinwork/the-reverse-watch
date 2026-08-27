# Vercel deployment and rollback

Last verified: 2026-08-27

## Current state

- Vercel project: `the-reverse-watch` in the `alexisinworks-projects` team.
- Git source: `alexisinwork/the-reverse-watch`, with `main` connected to
  production deployments.
- The latest remote deployment is ready but still contains the pre-migration
  static site.
- The repository's canonical domain is `thereserve.watch` (`CNAME` and landing
  copy). The Vercel project currently lists `thereverse.watch` and
  `www.thereverse.watch` instead. Treat this mismatch as an unresolved
  production-routing issue; do not change either domain or DNS without explicit
  owner approval.

## Preview procedure

1. Run `npm run check` locally. Do not run the deferred Playwright/E2E suite
   during Phases 1–4.
2. Push the reviewed commit to a non-production branch so the existing Git
   integration creates a preview deployment.
3. Confirm that the Vercel build reaches `READY`, then perform only short
   read-only checks of `/`, `/health`, and an unknown route. Do not submit the
   Beehiiv form.
4. Record the preview deployment ID and URL in the phase handoff.

Pushing `main` currently creates a production deployment. It is not a preview
operation and requires explicit owner confirmation.

## Production migration

After the owner approves production deployment and confirms the intended
domain:

1. Record the current production deployment ID as the rollback target.
2. Confirm encrypted environment values in Vercel without copying their values
   into logs or documentation.
3. Promote the accepted preview or push the exact reviewed commit to `main`.
4. Confirm the new deployment is ready before changing domain routing.
5. Attach the confirmed canonical domain, verify both apex and `www` behavior,
   and update DNS only with explicit approval.
6. Run the production smoke checks appropriate to the current testing cadence.

## Rollback

If the migrated application fails before a domain change, use Vercel's rollback
operation to restore the recorded production deployment. If DNS was changed,
restore the previous verified records as a separate owner-approved action.
Never delete the failed deployment during incident review; retain its build and
runtime logs for diagnosis.
