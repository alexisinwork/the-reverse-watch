# Vercel deployment and rollback

Last verified: 2026-08-31

## Current state

### Current Phase 7 release

- Vercel project `the-reverse-watch` in the `alexisinworks-projects` team is
  sourced from `alexisinwork/the-reverse-watch`; pushes to `main` deploy to
  Production.
- Production deployment `dpl_GKjFNx8PNJmPoXpM8AMGm37RehA8` is `READY` from
  commit `ec7fa69`. Deployment `dpl_5bnj6MbdkCKD14RgW8qsnK3RcnYs` is the
  recorded rollback target; it contains the same verified application behavior
  before the latest documentation checkpoint.
- `https://www.thereserve.watch`, `/quiz`, `/health`, and `/evaluation` return
  200, as does the stable `https://the-reverse-watch.vercel.app` alias. The
  third-party apex DNS still publishes conflicting A records and its
  certificate is invalid. On 2026-08-31 the owner deferred apex reconciliation;
  do not change those records as part of application delivery.
- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are configured for Production
  and Preview. The runtime uses narrow read-only v3 catalogue/hard-filter RPCs
  and bounded Phase 7 evaluation RPCs. Migrations through
  `0033_add_quiz_funnel_evaluation.sql` are applied; browser roles retain no
  direct raw-event or catalogue table access.
- The production path includes the six-screen diagnostic, deterministic
  recommendations and source-backed dossier UI, explicit email consent,
  Upstash-backed delivery deduplication, privacy-safe funnel aggregation,
  Sentry instrumentation, and a production evaluation dashboard. The complete
  desktop/mobile Playwright matrix and the fast quality gate pass.
- Beehiiv production configuration and one consented live subscription are
  verified. Resend's adapter is tested, but its production variables remain
  empty and the sender domain remains unverified. The owner directed that this
  state be preserved; provider unavailability remains visible without hiding
  recommendations.
- The current deployment returned 200 from the verified surfaces, and Vercel
  reported no runtime errors in the surrounding production window.

### Historical Phase 5 checkpoints

The following records preserve earlier deployment and fallback evidence. They
are not the current release, rollback target, or domain instructions.

- Vercel project: `the-reverse-watch` in the `alexisinworks-projects` team.
- Git source: `alexisinwork/the-reverse-watch`, with `main` connected to
  production deployments.
- Production deployment `dpl_AVbxq6wNLVRYemwwoiXXfyVcHXDG` is the verified
  live-Supabase Phase 5 relational-parity release;
  `dpl_A2Qwi9ipFj7CaMSSSmPG5Jwut5CQ` is its recorded rollback target. The repository
  pins `framework: react-router` in `vercel.json`; `/`, `/quiz`, and `/health`
  returned 200 on `https://the-reverse-watch.vercel.app/` on 2026-08-30. This
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
- Production targets the applicability-aware v3 pair created by migration
  `0018`; v3 wraps the rectangular-aware v2 contracts from migration `0016`.
  Migrations `0010` through `0020` are now live, and the publishable-key audit
  proves exact 18-row catalogue plus six-profile SQL/TypeScript parity after
  RLS. An unavailable or invalid v3 catalogue still visibly selects the
  reviewed 18-row bundle; an incomplete hard-filter partition likewise falls
  back as one unit.
- The explicit push through repository commit `f505270` was observed in
  production on 2026-08-29. The deployed quiz asset matched the reviewed local
  build, `/`, `/quiz`, and `/health` returned 200, and a valid core POST
  reported `catalogueOrigin: bundled_seed` with the expected visible live
  catalogue validation-fallback notice. No domain, subscriber, or database
  mutation was performed during this smoke check.
- Applicability commit `c0ebca7` was then observed in production. `/`, `/quiz`,
  and `/health` again returned 200; a valid core POST evaluated catalogue
  version 2 across 18 variants and selected `bundled_seed` with the same visible
  notice. This is positive evidence that an unavailable v3 contract triggers
  the intended whole-unit fallback while live Supabase remains on v1.
- On the verified live release, `/`, `/quiz`, and `/health` returned 200. A
  valid core POST returned Grand Seiko and the explicit “accepted catalogue
  facts and hard-filter decisions loaded from Supabase” notice. Recent Vercel
  runtime error logs were empty.
- Commit `70ef32d` deployed as `dpl_AVbxq6wNLVRYemwwoiXXfyVcHXDG` on
  2026-08-30. The deployment reached `READY`; `/`, `/quiz`, and `/health`
  returned 200; and a valid questionnaire-version-2 core POST succeeded with
  the exact live Supabase facts-and-hard-filter notice and no bundled-fallback
  notice. Vercel reported no runtime errors in the surrounding 30-minute
  window.

## Preview procedure

1. Run `npm run check` locally. For Phase 7 and later user-visible integration
   changes, also run `npm run test:e2e`.
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
5. If the owner reopens domain work, verify both apex and `www` behavior and
   record any DNS change before and after applying it. DNS is otherwise outside
   the current application-delivery boundary.
6. Run the production smoke checks appropriate to the current testing cadence.

## Rollback

If the migrated application fails before a domain change, use Vercel's rollback
operation to restore the recorded production deployment. If DNS was changed,
restore the previous verified records as a separate reversible action.
Never delete the failed deployment during incident review; retain its build and
runtime logs for diagnosis.

### D2 discovery archive read rollback

The discovery archive has an independent, single-code fallback. Its server
loader requests only the versioned `discovery_published_stories_v1` RPC and
returns the checked-in 21-story reviewed corpus when the Supabase configuration
is absent, the request fails, or the response fails its runtime schema check.
To roll back the database read path, remove that RPC from the deployed reader
or omit the Supabase configuration in the affected environment, then redeploy.
Do not delete the imported canonical discovery rows, evidence, image-rights
decisions, or source records: the database remains the review audit trail.
