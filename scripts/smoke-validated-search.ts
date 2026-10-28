import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { defaultDeps } from "../app/domain/ai-providers.server";
import { catalogueClient } from "../app/domain/watch-catalogue.server";
import { validationServices } from "../app/domain/validation-services.server";
import { validateCachedSearch } from "../app/domain/validate-cached-search.server";
import { loadValidatedSnapshot } from "../app/domain/validated-cache.server";

// An explicitly invoked, single-card live smoke. The same durable production
// budget protects this command; it does not bypass or reset a reservation.
const client = catalogueClient();
const base = defaultDeps();
const reference = process.argv[2] ?? "2201.50.00";
if (!/^[A-Za-z0-9.-]{3,80}$/.test(reference))
  throw new Error("Invalid reference");
if (!client || !base.config.perplexity || !base.config.museSpark)
  throw new Error("Database and both providers must be configured");
await mkdir(".scratch/validation-smoke", { recursive: true });
let sequence = 0;
const fetchImpl: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const endpoint = input instanceof Request ? input.url : String(input);
  if (/api\.perplexity\.ai|api\.meta\.ai/.test(endpoint)) {
    const filename = `.scratch/validation-smoke/provider-${Date.now()}-${sequence++}.json`;
    await writeFile(filename, await response.clone().text());
    console.log(
      JSON.stringify({
        provider: new URL(endpoint).hostname,
        status: response.status,
        responseFile: filename,
      }),
    );
  }
  return response;
};
const key = createHash("sha256")
  .update(`live-validation-smoke:Omega:${reference}:v1`)
  .digest("hex");
const cached = await loadValidatedSnapshot(client, key);
if (cached)
  console.log(
    JSON.stringify({
      status: "found",
      fromCache: true,
      watches: cached.watches.length,
    }),
  );
else {
  const result = await validateCachedSearch(
    key,
    [
      {
        brand: "Omega",
        model: "Seamaster Planet Ocean",
        referenceCode: reference,
        sourceUrl: "https://www.omegawatches.com/",
        imageUrl: null,
        priceNote: null,
        rationale: "",
        details: {},
      },
    ],
    validationServices(client, { ...base, fetchImpl }),
  );
  console.log(
    JSON.stringify(
      result.status === "verified"
        ? {
            status: result.status,
            watches: result.watches.map((watch) => ({
              brand: watch.brand,
              model: watch.model,
              referenceCode: watch.referenceCode,
            })),
          }
        : result,
    ),
  );
}
