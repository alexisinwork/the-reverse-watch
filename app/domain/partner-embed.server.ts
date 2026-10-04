/**
 * What the shared pages need to know when they run inside a partner
 * widget (/embed/:key/…): which site it is, and whether its monthly limit
 * still allows another use.
 */
import type { RouterContextProvider } from "react-router";

import { partnerSiteContext } from "../embed-context";
import type { PartnerFeature } from "./partner-sites";
import {
  MONTHLY_LIMIT_MESSAGE,
  recordPartnerUse,
  type PartnerSite,
} from "./partner-sites.server";

export function partnerSiteFrom(
  context: Readonly<RouterContextProvider> | undefined,
): PartnerSite | null {
  try {
    return context?.get(partnerSiteContext) ?? null;
  } catch {
    return null;
  }
}

/**
 * Counts one use for a partner widget. Returns the message to show when the
 * site's monthly limit is reached; null when the use may go ahead (always
 * null on The Reserve's own pages).
 */
export async function meterPartnerUse(
  site: PartnerSite | null,
  feature: PartnerFeature,
): Promise<string | null> {
  if (!site) return null;
  const decision = await recordPartnerUse(site, feature);
  return decision.allowed ? null : MONTHLY_LIMIT_MESSAGE;
}
