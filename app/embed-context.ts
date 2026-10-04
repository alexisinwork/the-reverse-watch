import { createContext } from "react-router";

import type { PartnerSite } from "./domain/partner-sites.server";

/**
 * Set by the /embed/:key layout once the partner key is valid: the
 * websites allowed to show that page in a frame. The root middleware reads
 * it to replace "never in a frame" with the partner's own addresses.
 */
export const embedFrameContext = createContext<readonly string[] | null>(null);

/** The partner site a widget request belongs to; null on The Reserve itself. */
export const partnerSiteContext = createContext<PartnerSite | null>(null);
