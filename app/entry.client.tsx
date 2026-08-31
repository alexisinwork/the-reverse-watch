import * as Sentry from "@sentry/react-router";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

const sentryEnv: Record<string, unknown> = import.meta.env;
const sentryDsn =
  typeof sentryEnv.SENTRY_DSN === "string" ? sentryEnv.SENTRY_DSN : undefined;
const sentryEnvironment =
  typeof sentryEnv.MODE === "string" ? sentryEnv.MODE : undefined;

Sentry.init({
  dsn: sentryDsn,
  environment: sentryEnvironment,
  integrations: [Sentry.reactRouterTracingIntegration()],
  sendDefaultPii: false,
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter
        instrumentations={[Sentry.createSentryClientInstrumentation()]}
        onError={Sentry.sentryOnError}
      />
    </StrictMode>,
  );
});
