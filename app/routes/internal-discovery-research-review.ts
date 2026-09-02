import type { Route } from "./+types/internal-discovery-research-review";

import {
  discoveryReviewRequestSchema,
  independentlyFetchDiscoverySources,
  parseDiscoveryReviewConfiguration,
  reviewSecretMatches,
} from "../domain/discovery-review.server";
import { createDiscoveryResearchWorkerStore } from "../domain/discovery-research-worker-store.server";

export function loader() {
  return Response.json({ ok: false }, { status: 405 });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST")
    return Response.json({ ok: false }, { status: 405 });
  const parsedConfiguration = parseDiscoveryReviewConfiguration();
  if (!parsedConfiguration.configured) {
    return Response.json(
      { ok: false, reason: "review_not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (
    !reviewSecretMatches(
      request.headers.get("authorization"),
      parsedConfiguration.config.reviewSecret,
    )
  ) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, reason: "invalid_json" },
      { status: 400 },
    );
  }
  const parsedRequest = discoveryReviewRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return Response.json(
      { ok: false, reason: "invalid_review_request" },
      { status: 400 },
    );
  }
  const store = createDiscoveryResearchWorkerStore({
    env: {
      SUPABASE_URL: parsedConfiguration.config.supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: parsedConfiguration.config.serviceRoleKey,
    },
  });
  try {
    if (parsedRequest.data.decision === "rejected") {
      const result = await store.reviewCandidate(parsedRequest.data);
      return Response.json(
        { ok: true, result },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const sources = await store.listCandidateSources(
      parsedRequest.data.candidateId,
    );
    const outcomes = await independentlyFetchDiscoverySources(sources);
    for (const outcome of outcomes) {
      await store.recordCandidateSourceFetch({
        candidateId: parsedRequest.data.candidateId,
        sourceId: outcome.sourceId,
        status: outcome.status,
        fetchedAt: outcome.fetchedAt,
        contentHash: outcome.contentHash,
        failureCategory: outcome.failureCategory,
      });
    }
    const failed = outcomes.filter((outcome) => outcome.status !== "verified");
    if (failed.length > 0) {
      return Response.json(
        {
          ok: false,
          reason: "source_fetch_failed",
          failedSourceCount: failed.length,
        },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await store.reviewCandidate(parsedRequest.data);
    const castCredit = parsedRequest.data.castCredit
      ? await store.reviewCastCredit(parsedRequest.data.castCredit)
      : null;
    return Response.json(
      { ok: true, result, castCredit },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, reason: "review_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
