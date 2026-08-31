import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("quiz", "routes/quiz.tsx"),
  route("analytics/quiz-started", "routes/quiz-analytics-start.ts"),
  route("evaluation", "routes/evaluation.tsx"),
  route("health", "routes/health.ts"),
] satisfies RouteConfig;
