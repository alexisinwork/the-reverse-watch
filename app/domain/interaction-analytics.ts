import { z } from "zod";
import { PARTNER_FEATURES } from "./partner-sites";

export const interactionEventSchema = z
  .object({
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
    helpful: z.boolean().optional(),
  })
  .strict();
export type InteractionEvent = z.infer<typeof interactionEventSchema>;
let sessionId: string | undefined;
export function currentInteractionSession() {
  sessionId ??= crypto.randomUUID();
  return sessionId;
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
function context() {
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
  const query = new URLSearchParams(window.location.search),
    campaign = query.get("utm_campaign") ?? undefined,
    taggedSource = query.get("utm_source") ?? undefined;
  let source: string | undefined;
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    source =
      taggedSource ||
      (ref && ref.hostname !== window.location.hostname
        ? ref.hostname
        : undefined);
  } catch {}
  return {
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
    ...context(),
    name,
    ...extra,
  });
  if (!event.success) return;
  void fetch("/analytics/interactions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event.data),
    keepalive: true,
  }).catch(() => undefined);
}
export function sendResultFeedback(helpful: boolean) {
  sendInteraction("result_feedback", { helpful, control: "result_feedback" });
}
export function interactionPagePath(path: string) {
  return safePath(path);
}
