import { createHash, timingSafeEqual } from "node:crypto";

import { createCookie } from "react-router";

import { parseDiagnosticAccessConfiguration } from "./diagnostic-access.server";

type Environment = Record<string, string | undefined>;

const COOKIE_NAME = "reserve_admin";
const TTL_SECONDS = 60 * 60 * 12;
const MINIMUM_PASSWORD_LENGTH = 12;

export type AdminConfiguration =
  | { configured: true; password: string; secret: string; secure: boolean }
  | { configured: false };

/** ADMIN_PASSWORD gates the page; the cookie is signed with SESSION_SECRET. */
export function parseAdminConfiguration(
  environment: Environment = process.env,
): AdminConfiguration {
  const password = environment.ADMIN_PASSWORD?.trim();
  const session = parseDiagnosticAccessConfiguration(environment);
  if (
    !password ||
    password.length < MINIMUM_PASSWORD_LENGTH ||
    !session.configured
  ) {
    return { configured: false };
  }
  return {
    configured: true,
    password,
    secret: session.secret,
    secure: session.secure,
  };
}

function adminCookie(
  configuration: Extract<AdminConfiguration, { configured: true }>,
) {
  return createCookie(COOKIE_NAME, {
    httpOnly: true,
    maxAge: TTL_SECONDS,
    path: "/admin",
    sameSite: "strict",
    secrets: [configuration.secret],
    secure: configuration.secure,
  });
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function passwordMatches(candidate: string, password: string) {
  return timingSafeEqual(digest(candidate), digest(password));
}

/** A Set-Cookie value for a correct password, otherwise null. */
export async function adminLogin(
  candidate: string,
  environment: Environment = process.env,
  now = Date.now(),
) {
  const configuration = parseAdminConfiguration(environment);
  if (
    !configuration.configured ||
    !passwordMatches(candidate, configuration.password)
  )
    return null;
  return adminCookie(configuration).serialize({
    admin: true,
    expiresAt: now + TTL_SECONDS * 1_000,
  });
}

export async function adminLogout(environment: Environment = process.env) {
  const configuration = parseAdminConfiguration(environment);
  if (!configuration.configured) return null;
  return adminCookie(configuration).serialize("", { maxAge: 0 });
}

export async function isAdmin(
  request: Request,
  environment: Environment = process.env,
  now = Date.now(),
) {
  const configuration = parseAdminConfiguration(environment);
  if (!configuration.configured) return false;
  const grant = (await adminCookie(configuration).parse(
    request.headers.get("Cookie"),
  )) as unknown;
  if (!grant || typeof grant !== "object") return false;
  const candidate = grant as Record<string, unknown>;
  return (
    candidate.admin === true &&
    typeof candidate.expiresAt === "number" &&
    candidate.expiresAt > now
  );
}
