import { createHash, timingSafeEqual } from "node:crypto";

import type { Route } from "./+types/internal-spend-alert";
import { providerSpendThisMonth } from "../domain/provider-spend.server";
import {
  runSpendAlert,
  spendAlertServices,
} from "../domain/spend-alert.server";
import { validationBudgetStatus } from "../domain/validation-budget.server";
import { catalogueClient } from "../domain/watch-catalogue.server";

const headers = { "Cache-Control": "no-store" };
function secretMatches(header: string | null, secret: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return (
    header !== null &&
    timingSafeEqual(digest(header), digest(`Bearer ${secret}`))
  );
}

/** Hourly (vercel.json): emails the owner when the month's paid checks
 * reach a spend mark or the ledger halts them. Reads only the ledger and
 * the provider counters; makes no paid call. */
export async function loader({ request }: Route.LoaderArgs) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16)
    return Response.json({ ok: false }, { status: 503, headers });
  if (
    request.headers.has("origin") ||
    !secretMatches(request.headers.get("authorization"), secret)
  )
    return Response.json({ ok: false }, { status: 401, headers });
  const client = catalogueClient();
  const services = spendAlertServices();
  if (!client || !services)
    return Response.json(
      { ok: false, reason: "configuration_unavailable" },
      { status: 503, headers },
    );
  try {
    const [ledger, providers] = await Promise.all([
      validationBudgetStatus(client),
      providerSpendThisMonth(),
    ]);
    const result = await runSpendAlert(ledger, providers, services);
    console.info(JSON.stringify({ event: "spend_alert", ...result }));
    return Response.json({ ok: true, ...result }, { headers });
  } catch {
    console.error(JSON.stringify({ event: "spend_alert_error" }));
    return Response.json(
      { ok: false, reason: "alert_unavailable" },
      { status: 503, headers },
    );
  }
}
