/// <reference types="vitest/config" />

import { reactRouter } from "@react-router/dev/vite";
import { sentryReactRouter } from "@sentry/react-router";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

import { sentrySourceMapConfiguration } from "./app/domain/sentry-config";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const sentryBuildConfig = sentrySourceMapConfiguration(env);

  return {
    define: {
      "import.meta.env.SENTRY_DSN": JSON.stringify(env.SENTRY_DSN),
    },
    plugins:
      process.env.VITEST || sentryBuildConfig === null
        ? process.env.VITEST
          ? []
          : [reactRouter()]
        : [
            reactRouter(),
            sentryReactRouter(sentryBuildConfig, { command, mode }),
          ],
    resolve: {
      alias: {
        "~": fileURLToPath(new URL("./app", import.meta.url)),
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./tests/setup.ts"],
      include: ["app/**/*.test.{ts,tsx}"],
    },
  };
});
