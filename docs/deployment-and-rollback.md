# Vercel deployment and rollback

Last verified: 2026-08-29

## Current state

- Vercel project: `the-reverse-watch` in the `alexisinworks-projects` team.
- Git source: `alexisinwork/the-reverse-watch`, with `main` connected to
  production deployments.
- Production deployment `dpl_FvEFUWbHRQrkGmDFAziEP6F5xP1o` is the verified
  live-Supabase Phase 4 release; `dpl_8ZLYQ66fc9VYcVmb6rZjWsG3kEor` is its
  recorded rollback target. The repository
  pins `framework: react-router` in `vercel.json`; `/`, `/quiz`, and `/health`
  returned 200 on `https://the-reverse-watch.vercel.app/` on 2026-08-28. This
  resolves the earlier framework-null `NOT_FOUND` incident.
- The repository's canonical domain is `thereserve.watch` (`CNAME` and landing
  copy). The Vercel project currently lists `thereverse.watch` and
  `www.thereverse.watch` instead. Treat this mismatch as an unresolved
  production-routing issue and reconcile it toward the canonical repository
  domain with reversible, recorded changes.
- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are configured for Production
  and Preview. The web runtime uses the narrow accepted-facts and hard-filter
  RPCs; it does not need a PostgreSQL password or management key. Invalid,
  incomplete, timed-out, or unavailable RPC responses trigger the visible
  reviewed-bundle fallback.
- Production currently exposes the verified v1 RPC pair. The application now
  targets the applicability-aware v3 pair created by migration `0018`; v3
  wraps the rectangular-aware v2 contracts from migration `0016`. On
  2026-08-29 the owner explicitly authorized pushing the complete branch before
  migrations `0010` through `0018` could be applied. This is operationally safe
  because an unavailable or invalid v3 catalogue prevents the SQL call and
  visibly selects the reviewed 18-row bundle; an incomplete hard-filter
  partition likewise falls back as one unit. The push does not waive the
  migration or 18-row parity requirement before Supabase is treated as active.
- The explicit push through repository commit `f505270` was observed in
  production on 2026-08-29. The deployed quiz asset matched the reviewed local
  build, `/`, `/quiz`, and `/health` returned 200, and a valid core POST
  reported `catalogueOrigin: bundled_seed` with the expected visible live
  catalogue validation-fallback notice. No domain, subscriber, or database
  mutation was performed during this smoke check.
- On the verified live release, `/`, `/quiz`, and `/health` returned 200. A
  valid core POST returned Grand Seiko and the explicit “accepted catalogue
  facts and hard-filter decisions loaded from Supabase” notice. Recent Vercel
  runtime error logs were empty.

## Preview procedure

1. Run `npm run check` locally. Do not run the deferred Playwright/E2E suite
   before Phase 7.
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
