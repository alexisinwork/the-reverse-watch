import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("quiz", "routes/quiz.tsx"),
  route("analytics/quiz-started", "routes/quiz-analytics-start.ts"),
  route("analytics/discovery", "routes/discovery-analytics.ts"),
  route("analytics/interactions", "routes/analytics-interactions.ts"),
  route("admin/analytics", "routes/admin-analytics.tsx"),
  route("evaluation", "routes/evaluation-moved.ts"),
  route("admin/evaluation", "routes/evaluation.tsx"),
  route("health", "routes/health.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("sitemap.xml", "routes/sitemap.ts"),
  // Short links for video descriptions: /e/35 → episode 35's page, tagged.
  route("e/:episode", "routes/episode-link.ts"),
  // The same for YouTube Shorts, TikTok and Instagram, and the profiles'
  // bio links /yt, /tt and /ig (domain/episode-links.ts).
  route("yt", "routes/social-link.ts", { id: "social-link-yt" }),
  route("ys/:episode", "routes/social-link.ts", { id: "social-link-ys" }),
  route("tt/:episode?", "routes/social-link.ts", { id: "social-link-tt" }),
  route("ig/:episode?", "routes/social-link.ts", { id: "social-link-ig" }),
  // The page /ig and /tt lead to: the latest episode first, then every
  // episode out so far (docs/social-landing.md).
  route("start", "routes/start.tsx"),
  route("internal/operations/health", "routes/internal-operations-health.ts"),
  route("privacy", "routes/privacy.tsx"),
  route("partners", "routes/partners.tsx"),
  route("watches", "routes/watches.tsx"),
  route("watches/archetype", "routes/watch-archetype.tsx"),
  route("watches/find", "routes/watch-find.tsx"),
  route("watches/alternatives", "routes/watch-alternatives.tsx"),
  route(
    "internal/catalogue/recheck-prices",
    "routes/internal-catalogue-recheck-prices.ts",
  ),
  route("internal/spend-alert", "routes/internal-spend-alert.ts"),
  route("admin/catalogue", "routes/admin-catalogue.tsx"),
  route("admin/sites", "routes/admin-sites.tsx"),
  route("watches/people/:entitySlug", "routes/watch-entity.tsx"),
  route("watches/works/:workSlug", "routes/watch-work.tsx"),
  route("watches/stories/:storySlug", "routes/watch-story.tsx"),
  // Partner API (JSON, server-sent events) and its description.
  route("api/v1/openapi.json", "routes/api-v1-openapi.ts"),
  route("api/v1/quiz", "routes/api-v1-quiz.ts"),
  route("api/v1/find", "routes/api-v1-find.ts"),
  route("api/v1/alternatives", "routes/api-v1-alternatives.ts"),
  route("api/v1/archetype", "routes/api-v1-archetype.ts"),
  route("api/v1/stories", "routes/api-v1-stories.ts", { id: "api-stories" }),
  route("api/v1/stories/:storySlug", "routes/api-v1-stories.ts", {
    id: "api-story",
  }),
  // Partner widgets: the same pages inside a frame on a partner's website.
  route("embed/:key", "routes/embed-layout.tsx", [
    route("quiz", "routes/quiz.tsx", { id: "embed-quiz" }),
    route("find", "routes/watch-find.tsx", { id: "embed-find" }),
    route("alternatives", "routes/watch-alternatives.tsx", {
      id: "embed-alternatives",
    }),
    route("archetype", "routes/watch-archetype.tsx", { id: "embed-archetype" }),
    route("stories", "routes/watches.tsx", { id: "embed-stories" }),
    route("stories/:storySlug", "routes/watch-story.tsx", {
      id: "embed-story",
    }),
  ]),
] satisfies RouteConfig;
