import { z } from "zod";
import { rpc, type CatalogueClient } from "./watch-catalogue.server";

function transient(error: unknown) {
  if (
    error !== null &&
    typeof error === "object" &&
    "name" in error &&
    typeof error.name === "string" &&
    ["TypeError", "TimeoutError", "AbortError"].includes(error.name)
  )
    return true;
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
  )
    return error.status === 429 || (error.status >= 500 && error.status < 600);
  return false;
}

/** Only this idempotent write is retried. The same event ID survives an
 * uncertain commit/response outcome, so the database can acknowledge it once. */
export async function persistInteraction(
  client: CatalogueClient,
  body: Record<string, unknown> & { p_event_id: string },
  wait: (ms: number) => Promise<void> = (ms) =>
    new Promise((done) => setTimeout(done, ms)),
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return z
        .boolean()
        .parse(await rpc(client, "record_partner_interaction_v3", body, 3000));
    } catch (error) {
      if (attempt || !transient(error)) throw error;
      await wait(150);
    }
  }
  return false;
}
