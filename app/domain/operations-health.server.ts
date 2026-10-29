import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  catalogueClient,
  rpc,
  type CatalogueClient,
} from "./watch-catalogue.server";
import { parseAdminConfiguration } from "./admin-auth.server";
import { loadAiWatchFinderConfig } from "./ai-providers.server";
import { parseUpstashRateLimitConfiguration } from "./rate-limit-upstash.server";

const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
const databaseSchema = z.object({
  catalogueAvailable: z.boolean(),
  validationContractReady: z.boolean(),
  tableAccessProtected: z.boolean(),
  analyticsAccessProtected: z.boolean(),
  priceRefreshContractReady: z.boolean(),
  priceRefreshLastRunAt: z.string().nullable(),
  priceRefreshOverdue: z.boolean(),
  staleReservations: z.number().int().nonnegative(),
  stalePricesPresent: z.boolean(),
  budget: z.object({
    halted: z.boolean(),
    remainingUsd: z.number().nonnegative(),
  }),
});
const digest = (value: string) => createHash("sha256").update(value).digest();

/** An authenticated readiness check. It performs only narrow database reads;
 * it never calls a paid provider or mutates reservations/catalogue records. */
export async function operationsHealth(
  request: Request,
  {
    environment = process.env,
    client = catalogueClient(),
  }: { environment?: NodeJS.ProcessEnv; client?: CatalogueClient | null } = {},
) {
  const token = environment.OPERATIONS_TOKEN?.trim();
  if (!token || token.length < 32)
    return Response.json({ status: "unconfigured" }, { status: 503, headers });
  if (
    request.headers.has("origin") ||
    !timingSafeEqual(
      digest(request.headers.get("authorization") ?? ""),
      digest(`Bearer ${token}`),
    )
  )
    return Response.json({ status: "unauthorized" }, { status: 401, headers });
  const providers = loadAiWatchFinderConfig(environment);
  const configuration = {
    admin: parseAdminConfiguration(environment).configured,
    providers:
      !!providers.perplexity &&
      !!providers.museSpark &&
      /^muse-spark-1\.[23]-contributor$/.test(providers.museSpark.fastModel),
    sharedRateLimit: parseUpstashRateLimitConfiguration(environment).configured,
    newsletter:
      !!environment.BEEHIIV_API_KEY?.trim() &&
      !!environment.BEEHIIV_PUBLICATION_ID?.trim(),
  };
  try {
    if (!client) throw new Error("Database configuration unavailable");
    const database = databaseSchema.parse(
      await rpc(client, "application_readiness_v3", {}, 12000),
    );
    const ready =
      Object.values(configuration).every(Boolean) &&
      database.catalogueAvailable &&
      database.validationContractReady &&
      database.tableAccessProtected &&
      database.analyticsAccessProtected &&
      database.priceRefreshContractReady &&
      (!database.priceRefreshOverdue || database.budget.remainingUsd < 0.025) &&
      database.staleReservations === 0 &&
      !database.budget.halted;
    return Response.json(
      {
        status: ready ? "ready" : "attention_required",
        configuration,
        database,
        warnings: [
          ...(database.budget.remainingUsd === 0
            ? ["monthly_research_limit_reached"]
            : []),
          ...(database.stalePricesPresent ? ["stale_prices_present"] : []),
          ...(database.priceRefreshOverdue &&
          database.budget.remainingUsd < 0.025
            ? ["price_refresh_waiting_for_monthly_budget"]
            : []),
          ...(!environment.SENTRY_DSN?.trim() ? ["sentry_not_configured"] : []),
          "legacy_bulk_research_paused",
        ],
        checkedAt: new Date().toISOString(),
      },
      { status: ready ? 200 : 503, headers },
    );
  } catch {
    return Response.json(
      {
        status: "unavailable",
        configuration,
        database: "unavailable",
        checkedAt: new Date().toISOString(),
      },
      { status: 503, headers },
    );
  }
}
