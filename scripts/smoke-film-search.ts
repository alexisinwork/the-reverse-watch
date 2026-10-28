import { mkdir, writeFile } from "node:fs/promises";
import { runFilmSearch } from "../app/domain/film-search-run.server";
import { parseFilmSubjectKind } from "../app/domain/film-subject";

const query = process.argv[2] ?? "Daniel Craig";
const kind = parseFilmSubjectKind(process.argv[3] ?? "actor");
if (!kind) throw new Error("Invalid subject kind");
await mkdir(".scratch/validation-smoke", { recursive: true });
const originalFetch = globalThis.fetch;
let paidCalls = 0;
globalThis.fetch = async (input, init) => {
  const response = await originalFetch(input, init);
  const endpoint = input instanceof Request ? input.url : String(input);
  if (/api\.perplexity\.ai|api\.meta\.ai/.test(endpoint)) {
    const filename = `.scratch/validation-smoke/film-${Date.now()}-${paidCalls++}.json`;
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
try {
  const result = await runFilmSearch({
    query,
    kind,
    rateKey: "owner-live-smoke",
    report: (event) => console.log(event.text),
  });
  console.log(
    JSON.stringify(
      result.status === "found"
        ? {
            status: result.status,
            fromCache: result.fromCache,
            watches: result.watches.map((watch) => ({
              brand: watch.brand,
              model: watch.model,
              referenceCode: watch.referenceCode,
            })),
            paidCalls,
          }
        : { ...result, paidCalls },
    ),
  );
} finally {
  globalThis.fetch = originalFetch;
}
