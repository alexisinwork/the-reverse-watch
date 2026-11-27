// Catalogue completion: wearing styles for watches imported from watch
// databases (owner, 2026-11-27: "детально дополни существующий каталог").
// 15,728 of them had no style, and the quiz needs a style to call a watch
// an exact fit, so the more accurate imported records (13% wrong facts on
// the judged cards, against 56% for AI-found watches) could not compete.
//
// Muse Spark sorts each watch into the six wearing styles from the
// record's own facts (brand, model, reference, size, movement, water
// resistance, materials, complications and, for dials records, series,
// bezel and dial), using the same style briefs the catalogue build used
// (STYLE_BRIEFS in app/domain/watch-catalogue.ts). Styles are a
// classification, not a fact, so the log marks them method "model" with
// the model and rule version. No web search; 25 watches a call.
//
//   node --env-file=.env --import tsx scripts/classify-catalogue-styles.ts \
//     --run styles-1 --budget 3 [--apply] [--limit N]
//
// Resumable like scripts/repair-catalogue.ts: .scratch/repair/<run>.jsonl.
// --apply-only writes the journal through watch_catalogue_fact_apply_v1.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

import { loadAiWatchFinderConfig } from "../app/domain/ai-providers.server";
import {
  CATALOGUE_STYLES,
  STYLE_BRIEFS,
  type CatalogueStyle,
  type CatalogueWatch,
} from "../app/domain/watch-catalogue";
import {
  catalogueClient,
  listCatalogue,
  rpc,
} from "../app/domain/watch-catalogue.server";

function option(name: string) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
}
const run = option("run");
const budgetUsd = Number(option("budget") ?? 0);
const limit = Number(option("limit") ?? Number.POSITIVE_INFINITY);
const apply = process.argv.includes("--apply");
const applyOnly = process.argv.includes("--apply-only");
const writers = Number(option("writers") ?? 2);
const pauseMs = Number(option("pause-ms") ?? 100);
if (!Number.isInteger(writers) || writers < 1 || writers > 4)
  throw new Error("--writers takes 1-4.");
if (!run || !/^[a-z0-9-]{1,60}$/.test(run))
  throw new Error("--run takes lowercase letters, digits and dashes.");
if (
  !applyOnly &&
  (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 10)
)
  throw new Error("--budget <usd> is required: above 0 and at most 10.");
const muse = loadAiWatchFinderConfig().museSpark;
if (!muse && !applyOnly) throw new Error("MUSE_SPARK_API_KEY is required.");
const client = catalogueClient();
if (!client) throw new Error("SUPABASE_URL and the service key are required.");

export const STYLE_RULE_VERSION = "styles-v1";
const BATCH = 25;

const INSTRUCTIONS = [
  "You sort watches from a watch catalogue into wearing styles, for a site that recommends watches by where they are worn. Use only the facts given for each watch and what is generally known about that exact model; never invent facts.",
  `The styles:\n${CATALOGUE_STYLES.map((style) => `- ${style}: ${STYLE_BRIEFS[style]}`).join("\n")}`,
  "Give each watch one to three styles, the ones it is genuinely made for, most fitting first. dive only for a real dive or water-sports watch (a dive bezel or at least 200 m water resistance, or a model known as a diver). travel only for a GMT, dual-time or world-time watch, or a pilot's watch. dress for slim, formal watches (precious metal, leather strap, simple dial). field for military, field and expedition watches. sport for robust sports watches and chronographs on bracelets or rubber. everyday for versatile watches that work with a shirt cuff and at the weekend. When the facts do not tell, give no style rather than a guess.",
  'Reply with JSON only: {"watches": [{"id": "the id given", "styles": ["dress", ...]}]}, one entry per watch given.',
].join("\n\n");

const answerSchema = z.object({
  watches: z.array(
    z.object({
      id: z.string(),
      styles: z.array(z.string()).max(6),
    }),
  ),
});

function describe(watch: CatalogueWatch, key: string) {
  const dials = watch.sourceDetails?.dials ?? {};
  const facts: Record<string, unknown> = {
    id: key,
    brand: watch.brand,
    model: watch.model,
    reference: watch.referenceCode,
    caseDiameterMm: watch.caseDiameterMm,
    caseThicknessMm: watch.caseThicknessMm,
    movement: watch.movement,
    waterResistanceM: watch.waterResistanceM,
    caseMaterial: watch.caseMaterial,
    strapMaterial: watch.strapMaterial,
    complications: watch.complications.length ? watch.complications : null,
    series: dials.Series ?? null,
    bezel: dials.Bezel ?? null,
    dial: dials["Dial colors"] ?? null,
    indexes: dials.Indexes ?? null,
  };
  return Object.fromEntries(
    Object.entries(facts).filter(
      ([, value]) => value !== null && value !== undefined,
    ),
  );
}

let spent = 0;
const CALL_CEILING_USD = 0.02;

async function classify(batch: CatalogueWatch[]) {
  const keys = batch.map((_, index) => `w${index + 1}`);
  const response = await fetch(new URL("chat/completions", muse!.baseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${muse!.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: muse!.fastModel,
      reasoning_effort: "minimal",
      temperature: 0,
      prompt_cache_key: `reserve-catalogue-${STYLE_RULE_VERSION}`,
      max_tokens: 6_000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: INSTRUCTIONS },
        {
          role: "user",
          content: JSON.stringify({
            watches: batch.map((watch, index) => describe(watch, keys[index]!)),
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: unknown } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } | null;
  const contributor = muse!.fastModel.endsWith("-contributor");
  const cost = body?.usage
    ? ((body.usage.prompt_tokens ?? 0) * (contributor ? 0.1 : 1.25) +
        (body.usage.completion_tokens ?? 0) * (contributor ? 0.2 : 4.25)) /
      1_000_000
    : CALL_CEILING_USD;
  spent += cost;
  if (!response.ok) throw new Error(`Muse returned ${response.status}`);
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Muse: no content");
  const answer = answerSchema.parse(
    JSON.parse(
      content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1),
    ),
  );
  const byKey = new Map(
    answer.watches.map((entry) => [entry.id, entry.styles]),
  );
  const share = cost / batch.length;
  return batch.map((watch, index) => {
    const styles = (byKey.get(keys[index]!) ?? []).filter(
      (style): style is CatalogueStyle =>
        (CATALOGUE_STYLES as readonly string[]).includes(style),
    );
    return {
      id: watch.id,
      styles: [...new Set(styles)].slice(0, 3),
      costUsd: Number(share.toFixed(6)),
    };
  });
}

type Entry = {
  id: string;
  styles: CatalogueStyle[];
  costUsd: number;
  applied?: number | null;
  error?: string;
};

async function write(entry: Entry) {
  if (!entry.styles.length) return 0;
  return z.number().parse(
    await rpc(
      client!,
      "watch_catalogue_fact_apply_v1",
      {
        p_watch_id: entry.id,
        p_run: run,
        p_facts: [
          {
            field: "styles",
            status: "filled",
            value: entry.styles,
            method: "model",
            model: muse?.fastModel ?? "muse-spark",
            passage: `Wearing styles from the record's own facts (${STYLE_RULE_VERSION}).`,
          },
        ],
      },
      20_000,
    ),
  );
}

const journalPath = resolve(`.scratch/repair/${run}.jsonl`);
mkdirSync(resolve(".scratch/repair"), { recursive: true });
const journal = new Map<string, Entry>();
if (existsSync(journalPath))
  for (const line of readFileSync(journalPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as Entry;
      journal.set(entry.id, entry);
    } catch {
      continue;
    }
  }
spent = [...journal.values()].reduce((sum, entry) => sum + entry.costUsd, 0);

const catalogue = await listCatalogue(client);
const byId = new Map(catalogue.map((watch) => [watch.id, watch]));

if (applyOnly) {
  let written = 0;
  let next = 0;
  const entries = [...journal.values()].filter(
    (entry) =>
      entry.applied === undefined && byId.get(entry.id)?.styles.length === 0,
  );
  await Promise.all(
    // Gentle on the live site: thousands of quick writes at once made its
    // searches ten times slower (2026-11-27), so two writers with a pause.
    Array.from({ length: writers }, async () => {
      while (next < entries.length) {
        const entry = entries[next++]!;
        try {
          entry.applied = await write(entry);
          written += entry.applied;
        } catch (error) {
          entry.applied = null;
          entry.error = (error as Error).message.slice(0, 160);
        }
        await new Promise((done) => setTimeout(done, pauseMs));
      }
    }),
  );
  writeFileSync(
    journalPath,
    `${[...journal.values()].map((entry) => JSON.stringify(entry)).join("\n")}\n`,
  );
  console.log(
    `Applied: ${written} watches got styles; ${entries.filter((entry) => entry.error).length} failed.`,
  );
  process.exit(0);
}

const todo = catalogue
  .filter((watch) => watch.sourceKind === "catalogue")
  .filter(
    (watch) => watch.reviewStatus !== "rejected" && watch.styles.length === 0,
  )
  // A watch whose classification failed is classified again.
  .filter(
    (watch) =>
      !journal.has(watch.id) ||
      Boolean(
        journal.get(watch.id)?.error && !journal.get(watch.id)?.styles.length,
      ),
  )
  .sort((a, b) => a.id.localeCompare(b.id))
  .slice(0, limit);
console.log(
  `${todo.length} database-imported watches without a style to classify.`,
);
const batches: CatalogueWatch[][] = [];
for (let start = 0; start < todo.length; start += BATCH)
  batches.push(todo.slice(start, start + BATCH));
let next = 0;
let stopReason: string | null = null;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (next < batches.length) {
      const batch = batches[next++]!;
      if (spent + 6 * CALL_CEILING_USD > budgetUsd) {
        stopReason ??= `the next calls could pass $${budgetUsd}`;
        continue;
      }
      let entries: Entry[];
      try {
        entries = await classify(batch);
      } catch (first) {
        // Muse answers 429 when its quota is shared: wait before the retry.
        if (/returned 429/.test((first as Error).message))
          await new Promise((done) => setTimeout(done, 8_000));
        try {
          entries = await classify(batch);
        } catch (error) {
          entries = batch.map((watch) => ({
            id: watch.id,
            styles: [],
            costUsd: 0,
            error: (error as Error).message.slice(0, 160),
          }));
        }
      }
      for (const entry of entries) {
        if (apply && !entry.error) {
          try {
            entry.applied = await write(entry);
          } catch (error) {
            entry.applied = null;
            entry.error = `apply: ${(error as Error).message.slice(0, 150)}`;
          }
        }
        journal.set(entry.id, entry);
        appendFileSync(journalPath, `${JSON.stringify(entry)}\n`);
      }
    }
  }),
);

const entries = [...journal.values()];
const tally: Record<string, number> = {};
for (const entry of entries)
  for (const style of entry.styles) tally[style] = (tally[style] ?? 0) + 1;
const report = {
  at: new Date().toISOString(),
  run,
  rule: STYLE_RULE_VERSION,
  model: muse?.fastModel ?? null,
  applied: apply,
  spendUsd: Number(spent.toFixed(4)),
  stopReason,
  watches: entries.length,
  withStyles: entries.filter((entry) => entry.styles.length).length,
  withoutStyles: entries.filter((entry) => !entry.styles.length && !entry.error)
    .length,
  errors: entries.filter((entry) => entry.error).length,
  styles: tally,
  stylesPerWatch: Number(
    (
      entries.reduce((sum, entry) => sum + entry.styles.length, 0) /
      Math.max(entries.filter((entry) => entry.styles.length).length, 1)
    ).toFixed(2),
  ),
};
const output = resolve(`docs/reports/${run}-${report.at.slice(0, 10)}.json`);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(`Wrote ${output}`);
process.exit(0);
