import { createHash, timingSafeEqual } from "node:crypto";
import type { Route } from "./+types/internal-catalogue-recheck-prices";
import { defaultDeps } from "../domain/ai-providers.server";
import { catalogueClient } from "../domain/watch-catalogue.server";
import {
  priceRefreshServices,
  runPriceRefresh,
} from "../domain/catalogue-price-refresh.server";

const headers = { "Cache-Control": "no-store" };
function secretMatches(header: string | null, secret: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return (
    header !== null &&
    timingSafeEqual(digest(header), digest(`Bearer ${secret}`))
  );
}

/** Daily bounded maintenance: existing prices older than 90 days only. One
 * UTC-day reservation, <=8 cards, <=$0.20, sharing the $100 monthly ledger.
 * Changes await review; missing-price imports are not a background paid queue. */
export async function loader({ request }: Route.LoaderArgs) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16)
    return Response.json({ ok: false }, { status: 503, headers });
  if (
    request.headers.has("origin") ||
    !secretMatches(request.headers.get("authorization"), secret)
  )
    return Response.json({ ok: false }, { status: 401, headers });
  const client = catalogueClient(),
    deps = defaultDeps();
  if (
    !client ||
    !deps.config.perplexity ||
    !deps.config.museSpark ||
    !/^muse-spark-1\.[23]-contributor$/.test(deps.config.museSpark.fastModel)
  )
    return Response.json(
      { ok: false, reason: "configuration_unavailable" },
      { status: 503, headers },
    );
  try {
    const result = await runPriceRefresh(priceRefreshServices(client, deps));
    console.info(
      JSON.stringify({ event: "catalogue_price_recheck", ...result }),
    );
    return Response.json(result, { status: result.ok ? 200 : 503, headers });
  } catch {
    console.error(JSON.stringify({ event: "catalogue_price_recheck_error" }));
    return Response.json(
      { ok: false, reason: "refresh_unavailable" },
      { status: 503, headers },
    );
  }
}
