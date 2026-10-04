/**
 * Partner sites in the database (migration 0075): looking a site up by its
 * public or secret key, the admin list, saving, and counting uses. The rules
 * themselves are in partner-sites.ts.
 */
import { createHash } from "node:crypto";
import { z } from "zod";

import {
  newPublicKey,
  newSecretKey,
  PUBLIC_KEY_PATTERN,
  readTheme,
  SECRET_KEY_PATTERN,
  type PartnerFeature,
  type PartnerTheme,
} from "./partner-sites";
import { logError } from "./quiz-email.server";
import {
  catalogueClient,
  rpc,
  type CatalogueClient,
} from "./watch-catalogue.server";

const siteSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  publicKey: z.string(),
  hasSecret: z.boolean(),
  allowedOrigins: z.array(z.string()),
  active: z.boolean(),
  monthlyQuota: z.number().int().nullable(),
  theme: z.unknown().transform(readTheme),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PartnerSite = z.infer<typeof siteSchema>;

const usageSchema = z.array(
  z.object({ month: z.string(), feature: z.string(), uses: z.number() }),
);
const listSchema = z.array(siteSchema.extend({ usage: usageSchema }));
export type PartnerSiteWithUsage = z.infer<typeof listSchema>[number];

export function hashSecretKey(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

// Sites change rarely and every widget page looks one up, so a lookup is
// kept for a minute per server instance (a switched-off site stops within
// a minute).
const CACHE_MS = 60_000;
const cache = new Map<
  string,
  { site: PartnerSite | null; expiresAt: number }
>();

export function clearPartnerSiteCache() {
  cache.clear();
}

async function cachedLookup(
  cacheKey: string,
  load: () => Promise<unknown>,
  now: number,
) {
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) return hit.site;
  const raw = await load();
  const site = raw === null ? null : siteSchema.parse(raw);
  if (cache.size > 500) cache.clear();
  cache.set(cacheKey, { site, expiresAt: now + CACHE_MS });
  return site;
}

/** The active site for a public key, or null (unknown, off, or no store). */
export async function findSiteByPublicKey(
  key: string,
  client: CatalogueClient | null = catalogueClient(),
  now = Date.now(),
): Promise<PartnerSite | null> {
  if (!client || !PUBLIC_KEY_PATTERN.test(key)) return null;
  try {
    const site = await cachedLookup(
      `pk:${key}`,
      () => rpc(client, "partner_site_by_public_key_v1", { p_key: key }),
      now,
    );
    return site?.active ? site : null;
  } catch (error) {
    logError("partner_site_lookup_error", error);
    return null;
  }
}

/** The active site for a secret key (server-to-server API calls). */
export async function findSiteBySecretKey(
  secret: string,
  client: CatalogueClient | null = catalogueClient(),
  now = Date.now(),
): Promise<PartnerSite | null> {
  if (!client || !SECRET_KEY_PATTERN.test(secret)) return null;
  const hash = hashSecretKey(secret);
  try {
    const site = await cachedLookup(
      `sk:${hash}`,
      () => rpc(client, "partner_site_by_secret_v1", { p_hash: hash }),
      now,
    );
    return site?.active ? site : null;
  } catch (error) {
    logError("partner_site_lookup_error", error);
    return null;
  }
}

export async function listPartnerSites(client: CatalogueClient) {
  return listSchema.parse(await rpc(client, "partner_sites_list_v1", {}));
}

export type PartnerSiteInput = {
  id?: string;
  name: string;
  allowedOrigins: string[];
  active: boolean;
  monthlyQuota: number | null;
  theme: PartnerTheme;
  notes: string | null;
};

export async function savePartnerSite(
  client: CatalogueClient,
  input: PartnerSiteInput,
) {
  const saved = await rpc(client, "partner_site_save_v1", {
    p_site: input.id ? input : { ...input, publicKey: newPublicKey() },
  });
  clearPartnerSiteCache();
  return saved === null ? null : siteSchema.parse(saved);
}

/** A new secret key for a site; shown to the owner once, stored hashed. */
export async function issueSecretKey(client: CatalogueClient, id: string) {
  const secret = newSecretKey();
  const ok = await rpc(client, "partner_site_set_secret_v1", {
    p_id: id,
    p_hash: hashSecretKey(secret),
  });
  clearPartnerSiteCache();
  return ok === true ? secret : null;
}

export type UseDecision = { allowed: boolean; uses: number };

/**
 * Counts one use of a feature (a search, a quiz result, a page of stories).
 * Refused only when the site's own monthly limit is reached. If the count
 * itself fails, the visitor is still served and the error is logged:
 * a partner who pays should never see an outage because of metering.
 */
export async function recordPartnerUse(
  site: PartnerSite,
  feature: PartnerFeature,
  client: CatalogueClient | null = catalogueClient(),
): Promise<UseDecision> {
  if (!client) return { allowed: true, uses: 0 };
  try {
    return z.object({ allowed: z.boolean(), uses: z.number() }).parse(
      await rpc(client, "partner_site_use_v1", {
        p_site: site.id,
        p_feature: feature,
      }),
    );
  } catch (error) {
    logError("partner_site_use_error", error);
    return { allowed: true, uses: 0 };
  }
}

export const MONTHLY_LIMIT_MESSAGE =
  "This website has used all of its searches for this month. Please try again next month.";
