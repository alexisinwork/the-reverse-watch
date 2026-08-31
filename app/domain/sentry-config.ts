const SOURCE_MAP_ENVIRONMENT_VARIABLES = [
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
] as const;

type SentryEnvironment = Record<string, string | undefined>;

export type SentrySourceMapConfiguration = {
  authToken: string;
  org: string;
  project: string;
};

function configuredValue(value: string | undefined) {
  const configured = value?.trim();
  return configured ? configured : null;
}

export function sentrySourceMapConfiguration(
  environment: SentryEnvironment,
): SentrySourceMapConfiguration | null {
  const values = SOURCE_MAP_ENVIRONMENT_VARIABLES.map(
    (name) => [name, configuredValue(environment[name])] as const,
  );
  const configured = values.filter(([, value]) => value !== null);
  if (configured.length === 0) return null;

  const missing = values
    .filter(([, value]) => value === null)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `Sentry source-map upload is partially configured; missing ${missing.join(", ")}.`,
    );
  }

  return {
    authToken: configuredValue(environment.SENTRY_AUTH_TOKEN)!,
    org: configuredValue(environment.SENTRY_ORG)!,
    project: configuredValue(environment.SENTRY_PROJECT)!,
  };
}

export function sentryEnvelopeOrigin(dsn: string | undefined) {
  const configuredDsn = configuredValue(dsn);
  if (!configuredDsn) return null;

  try {
    const url = new URL(configuredDsn);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}
