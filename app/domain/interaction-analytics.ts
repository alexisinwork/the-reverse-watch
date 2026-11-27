import { z } from "zod";
import {
  campaignLabel,
  firstTouchFrom,
  loadTabSession,
  type FirstTouch,
  type TabSession,
} from "./first-touch";
import { PARTNER_FEATURES, type PartnerFeature } from "./partner-sites";

export const interactionEventSchema = z
  .object({
    eventId: z.uuid().optional(),
    sessionId: z.uuid(),
    siteKey: z
      .string()
      .regex(/^pk_live_[A-Za-z0-9]{24}$/)
      .optional(),
    name: z.enum([
      "page_view",
      "click",
      "quiz_start",
      "service_complete",
      "result_feedback",
      // The fact of a new newsletter subscription, never the address.
      "newsletter_signup",
    ]),
    feature: z.enum([...PARTNER_FEATURES, "site"]),
    page: z
      .string()
      .min(1)
      .max(120)
      .refine((value) => !/[?#]/.test(value)),
    control: z.string().max(100).optional(),
    target: z.string().max(160).optional(),
    source: z.string().max(120).optional(),
    campaign: z.string().max(120).optional(),
    /** First touch utm_medium, or referral / none (domain/first-touch.ts). */
    medium: z
      .string()
      .regex(/^[a-z0-9_.-]{1,60}$/)
      .optional(),
    /** The tab session's first page (path only). */
    landing: z
      .string()
      .min(1)
      .max(120)
      .refine((value) => !/[?&#]/.test(value))
      .optional(),
    helpful: z.boolean().optional(),
  })
  .strict();
export type InteractionEvent = z.infer<typeof interactionEventSchema>;

const EMBED_PATH = /^\/embed\/pk_live_[A-Za-z0-9]{24}\//;
let sessionId: string | undefined;
let tabSession: TabSession | undefined;

function sessionStore() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * On The Reserve's own pages: the tab's session code and how the visit
 * began, kept in sessionStorage so that a reload or a plain link (such as
 * /start → the archetype quiz) stays one session with one first touch.
 * Partner frames keep their in-memory, parent-shared code and no storage.
 */
export function currentTabSession(): TabSession | undefined {
  if (
    typeof window === "undefined" ||
    EMBED_PATH.test(window.location.pathname)
  )
    return undefined;
  tabSession ??= loadTabSession(sessionStore(), () =>
    firstTouchFrom({
      search: window.location.search,
      referrer: document.referrer,
      landing: safePath(window.location.pathname),
      ownHost: window.location.hostname,
    }),
  );
  return tabSession;
}

/** How this tab's visit began, for the newsletter sign-up form. */
export function currentFirstTouch(): FirstTouch | undefined {
  return currentTabSession()?.firstTouch;
}

export function currentInteractionSession() {
  if (sessionId) return sessionId;
  if (
    typeof window !== "undefined" &&
    EMBED_PATH.test(window.location.pathname)
  ) {
    const shared = z
      .uuid()
      .safeParse(
        new URLSearchParams(window.location.search).get("_reserve_session"),
      );
    if (shared.success) sessionId = shared.data;
  }
  sessionId ??= currentTabSession()?.sessionId ?? crypto.randomUUID();
  return sessionId;
}

const advisorMessageSchema = z
  .object({
    type: z.literal("reserve:advisor-click"),
    key: z.string(),
    feature: z.enum(PARTNER_FEATURES),
    control: z.enum(["advisor_tab", "advisor_retry"]),
  })
  .strict();
export function trustedAdvisorControl(
  event: MessageEvent,
  expected: {
    key: string;
    feature: PartnerFeature;
    origins: readonly string[];
    parent: MessageEventSource;
  },
) {
  if (
    event.source !== expected.parent ||
    !expected.origins.includes(event.origin)
  )
    return null;
  const parsed = advisorMessageSchema.safeParse(event.data);
  return parsed.success &&
    parsed.data.key === expected.key &&
    parsed.data.feature === expected.feature
    ? parsed.data.control
    : null;
}
const clean = (value: string, max: number) =>
  value
    .replace(/[?#].*$/, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const safePath = (value: string) =>
  clean(
    value.replace(
      /\/(?:[0-9a-f]{8}-[0-9a-f-]{27,}|[a-zA-Z0-9_-]{32,})(?=\/|$)/g,
      "/:id",
    ),
    120,
  ) || "/";
/** The fields every event of this page carries: session, tool, page and,
 * on The Reserve's own pages, the tab's first touch. */
export function interactionContext() {
  const path = window.location.pathname,
    match = path.match(/^\/embed\/(pk_live_[A-Za-z0-9]{24})\//);
  const feature = match?.[0]
    ? path.slice(match[0].length).split("/")[0]
    : path.startsWith("/quiz")
      ? "quiz"
      : path.startsWith("/watches/find")
        ? "find"
        : path.startsWith("/watches/alternatives")
          ? "alternatives"
          : path.startsWith("/watches/archetype")
            ? "archetype"
            : path.startsWith("/watches")
              ? "stories"
              : "site";
  // Own pages: every event says how the tab's visit began, so a sign-up
  // three pages after an Instagram link still counts for Instagram.
  const touch = currentFirstTouch();
  let source: string | undefined, campaign: string | undefined;
  if (touch) {
    source = touch.source;
    campaign = campaignLabel(touch);
  } else {
    // Partner frames: the frame's own tags or the partner page's site.
    const query = new URLSearchParams(window.location.search);
    campaign = query.get("utm_campaign") ?? undefined;
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      source =
        query.get("utm_source") ||
        (ref && ref.hostname !== window.location.hostname
          ? ref.hostname
          : undefined);
    } catch {}
  }
  return {
    ...(touch ? { medium: touch.medium, landing: touch.landing } : {}),
    sessionId: currentInteractionSession(),
    ...(match?.[1] ? { siteKey: match[1] } : {}),
    feature: PARTNER_FEATURES.includes(
      feature as (typeof PARTNER_FEATURES)[number],
    )
      ? (feature as InteractionEvent["feature"])
      : "site",
    page: safePath(path),
    ...(source ? { source: clean(source, 120) } : {}),
    ...(campaign
      ? { campaign: clean(campaign, 120).replace(/[^a-zA-Z0-9_. -]/g, "") }
      : {}),
  };
}
export function sendInteraction(
  name: InteractionEvent["name"],
  extra: Partial<InteractionEvent> = {},
) {
  if (!import.meta.env.PROD) return;
  const event = interactionEventSchema.safeParse({
    ...interactionContext(),
    name,
    ...extra,
    eventId: crypto.randomUUID(),
  });
  if (!event.success) return;
  void deliverInteraction(event.data).catch(() => undefined);
}

/** One bounded retry while the page is alive, with the same anonymous delivery
 * ID. keepalive still permits the first request to finish during navigation. */
export async function deliverInteraction(
  event: InteractionEvent,
  fetchImpl: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = (ms) =>
    new Promise((done) => setTimeout(done, ms)),
) {
  const body = JSON.stringify(event);
  const send = () =>
    fetchImpl("/analytics/interactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  try {
    const response = await send();
    if (response.ok || response.status < 500 || !event.eventId)
      return response.ok;
  } catch {
    if (!event.eventId) return false;
  }
  await wait(300);
  try {
    return (await send()).ok;
  } catch {
    return false;
  }
}
export function sendResultFeedback(helpful: boolean) {
  sendInteraction("result_feedback", { helpful, control: "result_feedback" });
}
export function interactionPagePath(path: string) {
  return safePath(path);
}
/** A new newsletter subscription: the fact and the tab's first touch only
 * (the event carries it like every other), never the address. */
export function sendNewsletterSignup() {
  sendInteraction("newsletter_signup", { control: "newsletter_signup" });
}
