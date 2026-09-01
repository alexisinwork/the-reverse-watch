import { createCookie } from "react-router";

const COOKIE_NAME = "reserve_diagnostic_access";
const ACCESS_VERSION = 1;
const ACCESS_TTL_SECONDS = 60 * 60 * 24 * 180;
const MINIMUM_SECRET_LENGTH = 32;

type Environment = Record<string, string | undefined>;

export type DiagnosticAccessConfiguration =
  | { configured: true; secret: string; secure: boolean }
  | { configured: false; reason: "missing" | "invalid" };

export function parseDiagnosticAccessConfiguration(
  environment: Environment = process.env,
): DiagnosticAccessConfiguration {
  const secret = environment.SESSION_SECRET?.trim();
  if (!secret) return { configured: false, reason: "missing" };
  if (
    secret.length < MINIMUM_SECRET_LENGTH ||
    secret === "replace-with-a-long-random-value"
  ) {
    return { configured: false, reason: "invalid" };
  }

  return {
    configured: true,
    secret,
    secure: environment.NODE_ENV === "production",
  };
}

function diagnosticAccessCookie(
  configuration: Extract<DiagnosticAccessConfiguration, { configured: true }>,
) {
  return createCookie(COOKIE_NAME, {
    httpOnly: true,
    maxAge: ACCESS_TTL_SECONDS,
    path: "/",
    sameSite: "lax",
    secrets: [configuration.secret],
    secure: configuration.secure,
  });
}

export async function issueDiagnosticAccessCookie(
  configuration: Extract<DiagnosticAccessConfiguration, { configured: true }>,
  now = Date.now(),
) {
  return diagnosticAccessCookie(configuration).serialize({
    expiresAt: now + ACCESS_TTL_SECONDS * 1_000,
    version: ACCESS_VERSION,
  });
}

export async function hasDiagnosticAccess(
  request: Request,
  environment: Environment = process.env,
  now = Date.now(),
) {
  const configuration = parseDiagnosticAccessConfiguration(environment);
  if (!configuration.configured) return false;

  const grant = (await diagnosticAccessCookie(configuration).parse(
    request.headers.get("Cookie"),
  )) as unknown;

  if (!grant || typeof grant !== "object") return false;
  const candidate = grant as Record<string, unknown>;
  return (
    candidate.version === ACCESS_VERSION &&
    typeof candidate.expiresAt === "number" &&
    Number.isSafeInteger(candidate.expiresAt) &&
    candidate.expiresAt > now
  );
}
