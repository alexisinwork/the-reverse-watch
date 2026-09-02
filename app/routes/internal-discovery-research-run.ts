import type { Route } from "./+types/internal-discovery-research-run";

import {
  parseDiscoveryResearchWorkerConfiguration,
  runDiscoveryResearchBatch,
  workerSecretMatches,
} from "../domain/discovery-research-worker.server";
import { createDiscoveryResearchWorkerStore } from "../domain/discovery-research-worker-store.server";

export function loader() {
  return Response.json({ ok: false }, { status: 405 });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST")
    return Response.json({ ok: false }, { status: 405 });
  const parsed = parseDiscoveryResearchWorkerConfiguration();
  if (!parsed.configured) {
    return Response.json(
      { ok: false, reason: "worker_not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (
    !workerSecretMatches(
      request.headers.get("authorization"),
      parsed.config.workerSecret,
    )
  ) {
    return Response.json({ ok: false }, { status: 401 });
  }
  try {
    const result = await runDiscoveryResearchBatch({
      config: parsed.config,
      store: createDiscoveryResearchWorkerStore(),
    });
    return Response.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, reason: "worker_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
