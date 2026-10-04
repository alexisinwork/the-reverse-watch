import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("quiz", "routes/quiz.tsx"),
  route("analytics/quiz-started", "routes/quiz-analytics-start.ts"),
  route("analytics/discovery", "routes/discovery-analytics.ts"),
  route("evaluation", "routes/evaluation-moved.ts"),
  route("admin/evaluation", "routes/evaluation.tsx"),
  route("health", "routes/health.ts"),
  route("privacy", "routes/privacy.tsx"),
  route("partners", "routes/partners.tsx"),
  route("watches", "routes/watches.tsx"),
  route("watches/archetype", "routes/watch-archetype.tsx"),
  route("watches/find", "routes/watch-find.tsx"),
  route("watches/alternatives", "routes/watch-alternatives.tsx"),
  route("watches/research/:requestToken", "routes/watch-research-status.tsx"),
  route(
    "internal/discovery-research/run",
    "routes/internal-discovery-research-run.ts",
  ),
  route(
    "internal/discovery-research/review",
    "routes/internal-discovery-research-review.ts",
  ),
  route(
    "internal/catalogue/recheck-prices",
    "routes/internal-catalogue-recheck-prices.ts",
  ),
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
