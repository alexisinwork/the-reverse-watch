import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/** Runs with Node's native TypeScript support; no dependency installation or
 * database/provider credentials are needed on the monitoring runner. */
export async function checkProduction({
  token,
  baseUrl = "https://thereserve.watch",
  fetchImpl = fetch,
}: {
  token: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}) {
  if (token.length < 32)
    throw new Error("Configure the operations monitor token");
  const checks = [];
  for (const path of ["/health", "/internal/operations/health"]) {
    const response = await fetchImpl(new URL(path, baseUrl), {
      ...(path.startsWith("/internal/")
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {}),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error(
        `Readiness check ${path} returned HTTP ${response.status}`,
      );
    const body: unknown = await response.json();
    const status =
      body && typeof body === "object" && "status" in body ? body.status : null;
    if (status !== (path === "/health" ? "ok" : "ready"))
      throw new Error(`Readiness check ${path} did not pass`);
    checks.push({ path, status: response.status });
  }
  return { at: new Date().toISOString(), checks };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let succeeded = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      console.log(
        JSON.stringify(
          await checkProduction({
            token:
              process.env.RESERVE_OPERATIONS_TOKEN ??
              process.env.OPERATIONS_TOKEN ??
              "",
          }),
        ),
      );
      succeeded = true;
      break;
    } catch (error) {
      if (attempt === 1)
        console.error(
          error instanceof Error
            ? error.message
            : "Production readiness check failed",
        );
      else await new Promise((done) => setTimeout(done, 3000));
    }
  }
  if (!succeeded) process.exitCode = 1;
}
