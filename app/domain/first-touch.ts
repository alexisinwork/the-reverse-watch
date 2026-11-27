/**
 * How a visit to The Reserve began ("first touch"), remembered for the
 * browser tab so that a quiz start, a finished search or a newsletter
 * sign-up several pages later still counts for the platform and episode
 * that brought the visitor (2026-11-27). The analytics events carry it, and
 * the newsletter sign-up passes it to Beehiiv as utm_* fields.
 *
 * Only these four plain values are kept, in the tab's sessionStorage beside
 * the anonymous analytics session code: no email, no cookie, no full URL,
 * no referring page beyond its site's name. Closing the tab removes them.
 */
import { z } from "zod";

/** A plain tag value: lower-case letters, digits, "_", "." and "-". */
const TAG = /^[a-z0-9_.-]{1,60}$/;
/** An entry page: a path on this site, ids already masked, no query. */
const LANDING = /^\/[A-Za-z0-9/_:.~%-]{0,119}$/;

export const firstTouchSchema = z
  .object({
    source: z.string().regex(TAG),
    medium: z.string().regex(TAG),
    campaign: z.string().regex(TAG).optional(),
    landing: z.string().regex(LANDING),
  })
  .strict();
export type FirstTouch = z.infer<typeof firstTouchSchema>;

/** The platform behind a referring site, or the site's own name. */
export function sourceForHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const on = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (on("instagram.com")) return "instagram";
  if (on("tiktok.com")) return "tiktok";
  if (on("youtube.com") || on("youtu.be")) return "youtube";
  return host;
}

/** A utm value as a plain tag, or undefined when nothing usable is left. */
export function plainTag(value: string | null | undefined) {
  const tag = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return TAG.test(tag) ? tag : undefined;
}

/**
 * The first touch of a visit that starts at this address: its utm tags
 * when it has them, otherwise the referring site (instagram, tiktok and
 * youtube by platform, any other site by its host name), otherwise
 * "direct": an address typed by hand, for example after an episode's ad.
 */
export function firstTouchFrom(input: {
  /** window.location.search */
  search: string;
  /** document.referrer */
  referrer: string;
  /** The landing page's path, already made safe by the caller. */
  landing: string;
  /** This site's host name, to tell an internal referrer apart. */
  ownHost: string;
}): FirstTouch {
  const query = new URLSearchParams(input.search);
  const landing = LANDING.test(input.landing) ? input.landing : "/";
  const campaign = plainTag(query.get("utm_campaign"));
  const tagged = plainTag(query.get("utm_source"));
  if (tagged) {
    return {
      source: tagged,
      medium: plainTag(query.get("utm_medium")) ?? "unknown",
      ...(campaign ? { campaign } : {}),
      landing,
    };
  }
  let host: string | undefined;
  try {
    host = input.referrer ? new URL(input.referrer).hostname : undefined;
  } catch {
    host = undefined;
  }
  const source = !host
    ? "direct"
    : host.toLowerCase() === input.ownHost.toLowerCase()
      ? // A tab opened from one of our own pages without the stored touch.
        "internal"
      : (plainTag(sourceForHost(host)) ?? "direct");
  return {
    source,
    medium: source === "direct" || source === "internal" ? "none" : "referral",
    ...(campaign ? { campaign } : {}),
    landing,
  };
}

/**
 * The value analytics stores as the campaign: the utm_campaign, with
 * YouTube Shorts kept apart from the long video of the same episode
 * ("ep11 shorts"), as the per-page analytics already did
 * (docs/episode-links.md).
 */
export function campaignLabel(touch: FirstTouch) {
  if (!touch.campaign) return undefined;
  return touch.medium === "shorts"
    ? `${touch.campaign} shorts`
    : touch.campaign;
}

export const TAB_SESSION_KEY = "reserve.analytics.v1";
const storedSchema = z
  .object({ sessionId: z.uuid(), firstTouch: firstTouchSchema })
  .strict();
export type TabSession = z.infer<typeof storedSchema>;

type SessionStore = Pick<Storage, "getItem" | "setItem">;

/**
 * The tab's analytics session and first touch: the stored pair when there is
 * one, otherwise a new pair for this landing, saved for the rest of the tab's
 * life. Storage that is blocked or full only means the pair lives in memory
 * for this page.
 */
export function loadTabSession(
  storage: SessionStore | null,
  landing: () => FirstTouch,
  newId: () => string = () => crypto.randomUUID(),
): TabSession {
  try {
    const stored = storage?.getItem(TAB_SESSION_KEY);
    if (stored) {
      const parsed = storedSchema.safeParse(JSON.parse(stored));
      if (parsed.success) return parsed.data;
    }
  } catch {
    // Blocked storage or a damaged value: start a new pair.
  }
  const session = { sessionId: newId(), firstTouch: landing() };
  try {
    storage?.setItem(TAB_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Kept in memory only.
  }
  return session;
}

/** The sign-up form's hidden fields: the first touch, nothing else. */
export const FIRST_TOUCH_FIELDS = {
  source: "touchSource",
  medium: "touchMedium",
  campaign: "touchCampaign",
  landing: "touchLanding",
} as const;

/** The first touch a sign-up form sent, or null when it sent none or an
 * invalid one (the server never trusts these fields beyond their shape). */
export function firstTouchFromForm(form: FormData): FirstTouch | null {
  const read = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" && value ? value : undefined;
  };
  const parsed = firstTouchSchema.safeParse({
    source: read(FIRST_TOUCH_FIELDS.source),
    medium: read(FIRST_TOUCH_FIELDS.medium),
    campaign: read(FIRST_TOUCH_FIELDS.campaign),
    landing: read(FIRST_TOUCH_FIELDS.landing),
  });
  if (!parsed.success) return null;
  const { campaign, ...rest } = parsed.data;
  return campaign ? { ...rest, campaign } : rest;
}
