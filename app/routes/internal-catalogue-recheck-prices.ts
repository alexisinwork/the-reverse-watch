import { createHash, timingSafeEqual } from "node:crypto";

import type { Route } from "./+types/internal-catalogue-recheck-prices";
import { defaultDeps, searchReady } from "../domain/ai-providers.server";
import { recheckPrice } from "../domain/catalogue-build.server";
import { loadFxTable } from "../domain/fx.server";
import { PRICE_MAX_AGE_DAYS } from "../domain/price-check.server";
import {
  catalogueClient,
  cataloguePricesDue,
  recordCataloguePrice,
} from "../domain/watch-catalogue.server";

/** Per daily run: small enough to finish well inside the function limit. */
const BATCH = 8;

function secretMatches(header: string | null, secret: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return (
    header !== null &&
    timingSafeEqual(digest(header), digest(`Bearer ${secret}`))
  );
}

/**
 * Vercel Cron calls this daily with CRON_SECRET. It rechecks the prices
 * that are over 90 days old (or never confirmed): an unchanged price only
 * gets a new check date; a changed one is parked for review on the admin
 * page, never applied silently.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16)
    return Response.json({ ok: false }, { status: 503 });
  if (!secretMatches(request.headers.get("authorization"), secret)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const client = catalogueClient();
  const deps = defaultDeps();
  if (!client || !searchReady(deps.config))
    return Response.json({ ok: false }, { status: 503 });

  const before = new Date(Date.now() - PRICE_MAX_AGE_DAYS * 86_400_000);
  const [due, fx] = await Promise.all([
    cataloguePricesDue(client, before, BATCH),
    loadFxTable(),
  ]);
  const outcomes = await Promise.all(
    due.map(async (watch) => {
      try {
        const result = await recheckPrice(watch, deps, fx);
        await recordCataloguePrice(client, watch.id, result);
        return result.kind;
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "catalogue_price_recheck_error",
            message: error instanceof Error ? error.message : "unknown error",
          }),
        );
        return "error";
      }
    }),
  );
  const counts: Record<string, number> = {};
  for (const outcome of outcomes) counts[outcome] = (counts[outcome] ?? 0) + 1;
  console.info(
    JSON.stringify({
      event: "catalogue_price_recheck",
      checked: due.length,
      counts,
    }),
  );
  return Response.json({ ok: true, checked: due.length, counts });
}
