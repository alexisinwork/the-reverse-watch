import { z } from "zod";

import { ARCHETYPE_IDS } from "./discovery-archetype";
import {
  DISCOVERY_ANCHOR_KINDS,
  discoveryTopicStatusSchema,
} from "./discovery-selection";

export const DISCOVERY_SURFACES = [
  "index",
  "entity",
  "work",
  "story",
  "archetype",
] as const;

export const discoveryAnalyticsEventSchema = z.discriminatedUnion("name", [
  z
    .object({
      name: z.literal("page_view"),
      surface: z.enum(DISCOVERY_SURFACES),
    })
    .strict(),
  z.object({ name: z.literal("archetype_start") }).strict(),
  z
    .object({
      name: z.enum(["archetype_completion", "share", "core_handoff"]),
      archetypeId: z.enum(ARCHETYPE_IDS),
    })
    .strict(),
  z.object({ name: z.literal("qualified_recommendation") }).strict(),
  z.object({ name: z.literal("opt_in") }).strict(),
  z
    .object({
      name: z.enum(["cultural_anchor_selected", "research_request_submitted"]),
      anchor: z.enum(DISCOVERY_ANCHOR_KINDS),
    })
    .strict(),
  z
    .object({
      name: z.literal("research_status_seen"),
      status: discoveryTopicStatusSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal("outbound_market_click"),
      surface: z.enum(DISCOVERY_SURFACES),
    })
    .strict(),
]);

export type DiscoveryAnalyticsEvent = z.infer<
  typeof discoveryAnalyticsEventSchema
>;

export function sendDiscoveryAnalyticsEvent(event: DiscoveryAnalyticsEvent) {
  if (!import.meta.env.PROD) return;
  void fetch("/analytics/discovery", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined);
}
