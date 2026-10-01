// Reads how each catalogue watch looks from its product photo (dial colour,
// hands, bezel, lume, case shape, bracelet, era) and stores it, for the
// cheaper-alternative finder. Watches already read are skipped, so it can be
// re-run. Stops before the spend reaches --budget (USD).
//   node --env-file=.env --import tsx scripts/read-design-traits.ts [--limit N] [--budget 15]
import { defaultDeps } from "../app/domain/ai-providers.server";
import { readDesignTraits } from "../app/domain/design-traits.server";
import {
  catalogueClient,
  listCatalogue,
  recordDesignTraits,
} from "../app/domain/watch-catalogue.server";

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const LIMIT = Number(argument("--limit") ?? Infinity);
const BUDGET_USD = Number(argument("--budget") ?? 15);
// Conservative per-photo estimate (about 1,000 input and 450 output tokens).
const COST_PER_PHOTO = 0.006;
const CONCURRENCY = 12;

const client = catalogueClient();
const deps = defaultDeps();
if (!client || !deps.config.museSpark) {
  throw new Error("Supabase service key and MUSE_SPARK_API_KEY are required.");
}

const todo = (await listCatalogue(client))
  .filter((watch) => watch.imageUrl && !watch.designTraits)
  // Approved watches first: they are the ones shown.
  .sort(
    (a, b) =>
      Number(b.reviewStatus === "approved") -
      Number(a.reviewStatus === "approved"),
  )
  .slice(0, LIMIT);
console.log(`${todo.length} photos to read; budget USD ${BUDGET_USD}.`);

let spent = 0;
let done = 0;
let failed = 0;
const queue = [...todo];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let watch = queue.shift(); watch; watch = queue.shift()) {
      if (spent + COST_PER_PHOTO > BUDGET_USD) break;
      spent += COST_PER_PHOTO;
      try {
        const traits = await readDesignTraits(watch.imageUrl!, deps);
        await recordDesignTraits(client, watch.id, traits);
        done += 1;
        if (done <= 5 || done % 100 === 0) {
          console.log(
            `${done} $${spent.toFixed(2)} ${watch.brand} ${watch.model}: ${JSON.stringify(traits)}`,
          );
        }
      } catch (error) {
        failed += 1;
        if (failed <= 10) {
          console.log(
            `  failed ${watch.brand} ${watch.model}: ${error instanceof Error ? error.message.slice(0, 100) : "error"}`,
          );
        }
      }
    }
  }),
);
console.log(
  `\nRead ${done}, failed ${failed}, about USD ${spent.toFixed(2)} spent.`,
);
