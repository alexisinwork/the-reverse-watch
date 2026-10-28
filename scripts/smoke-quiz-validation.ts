// Explicit live, ledger-controlled cache-miss check. No request headers are saved.
import { mkdir, writeFile } from "node:fs/promises";
import { searchWithStore } from "../app/domain/ai-watch-store.server";
import { quizCacheInput } from "../app/domain/quiz-live-search.server";
import type { ProfileV4 } from "../app/domain/questionnaire-v4";
import { meteredSearchOptions } from "../app/domain/validation-runtime.server";

const profile: ProfileV4 = {
  version: 4,
  budgetCurrency: "USD",
  priceRange: "5000_6000",
  wristCm: 18,
  wearingScenarios: ["diving"],
  minimumWaterResistanceM: 100,
  movementTypes: ["automatic"],
  requiredComplications: [],
  allergyConstraint: "none",
};
const originalFetch = globalThis.fetch;
let paidCalls = 0;
await mkdir(".scratch/validation-smoke", { recursive: true });
globalThis.fetch = async (input, init) => {
  const response = await originalFetch(input, init);
  const endpoint = input instanceof Request ? input.url : String(input);
  if (/api\.perplexity\.ai|api\.meta\.ai/.test(endpoint)) {
    await writeFile(
      `.scratch/validation-smoke/quiz-${Date.now()}-${paidCalls++}.json`,
      await response.clone().text(),
    );
    console.log(
      JSON.stringify({
        provider: new URL(endpoint).hostname,
        status: response.status,
      }),
    );
  }
  return response;
};
try {
  const result = await searchWithStore(
    { kind: "quiz", cacheInput: quizCacheInput(profile) },
    meteredSearchOptions({ quizProfile: profile }),
  );
  console.log(
    JSON.stringify(
      result.status === "found"
        ? {
            status: result.status,
            fromCache: result.fromCache,
            references: result.watches.map((watch) => watch.referenceCode),
            paidCalls,
          }
        : { ...result, paidCalls },
    ),
  );
} finally {
  globalThis.fetch = originalFetch;
}
