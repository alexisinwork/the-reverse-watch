import type { Config } from "@react-router/dev/config";
import { sentryOnBuildEnd } from "@sentry/react-router";
import { vercelPreset } from "@vercel/react-router/vite";

import { sentrySourceMapConfiguration } from "./app/domain/sentry-config";

const sentryBuildConfig = sentrySourceMapConfiguration(process.env);

export default {
  ssr: true,
  presets: [vercelPreset()],
  ...(sentryBuildConfig ? { buildEnd: sentryOnBuildEnd } : {}),
  future: {
    v8_middleware: true,
    v8_passThroughRequests: true,
    v8_splitRouteModules: true,
    v8_trailingSlashAwareDataRequests: true,
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
