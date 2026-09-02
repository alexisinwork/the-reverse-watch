import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("quiz", "routes/quiz.tsx"),
  route("analytics/quiz-started", "routes/quiz-analytics-start.ts"),
  route("analytics/discovery", "routes/discovery-analytics.ts"),
  route("evaluation", "routes/evaluation.tsx"),
  route("health", "routes/health.ts"),
  route("watches", "routes/watches.tsx"),
  route("watches/archetype", "routes/watch-archetype.tsx"),
  route("watches/find", "routes/watch-find.tsx"),
  route("watches/research/:requestToken", "routes/watch-research-status.tsx"),
  route(
    "internal/discovery-research/run",
    "routes/internal-discovery-research-run.ts",
  ),
  route(
    "internal/discovery-research/review",
    "routes/internal-discovery-research-review.ts",
  ),
  route("watches/people/:entitySlug", "routes/watch-entity.tsx"),
  route("watches/works/:workSlug", "routes/watch-work.tsx"),
  route("watches/stories/:storySlug", "routes/watch-story.tsx"),
] satisfies RouteConfig;
