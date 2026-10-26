// Muse Spark-only, resumable catalogue completion pass. This has a separate
// allowance journal from the historical Perplexity worker and never falls back
// to Perplexity. One exact-reference result is propagated to every matching
// catalogue row, which refreshes every manual-review workbook on re-export.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { z } from "zod";
import { defaultDeps } from "../app/domain/ai-providers.server";
import { enrichCatalogueReference } from "../app/domain/catalogue-enrichment.server";
import { loadFxTable } from "../app/domain/fx.server";

const valueFlag = (name: string, fallback: number) => {
  const index = process.argv.indexOf(`--${name}`);
  const value = index < 0 ? fallback : Number(process.argv[index + 1]);
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`Invalid --${name} value`);
  return value;
};

const budgetUsd = valueFlag("budget", 100);
const maxPasses = Math.min(3, Math.floor(valueFlag("max-passes", 3)));
const limit = Math.floor(valueFlag("limit", 100_000));
const archive = "data/watch-archive/muse-only-2026-10-26";
const progressPath = path.join(archive, "progress.json");
const journalPath = path.join(archive, "allowance.jsonl");
const resultsPath = path.join(archive, "results.jsonl");
const logsPath = path.join(archive, "worker.log");

// Meta bills web-search/tool calls at $2.50 per 1,000. The additional reserve
// leaves room for model tokens, which are not currently itemized in the API
// response used by this worker. We keep the maximum request reservation rather
// than releasing unused calls, so this is a hard conservative local ceiling.
const MUSE_TOOL_CALL_USD = 0.0025;
const MUSE_TOKEN_RESERVE_USD = 0.002;

const progressSchema = z.object({
  session: z.literal("muse-only-2026-10-26"),
  budgetUsd: z.number().positive(),
  reservedUsd: z.number().nonnegative(),
  requests: z.number().int().nonnegative(),
  maxToolCallsReserved: z.number().int().nonnegative(),
  actualToolCalls: z.number().int().nonnegative(),
  processed: z.number().int().nonnegative(),
  enriched: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  stopped: z.string().nullable(),
  updatedAt: z.string(),
});
type Progress = z.infer<typeof progressSchema>;

mkdirSync(archive, { recursive: true });
const emptyProgress = (): Progress => ({
  session: "muse-only-2026-10-26",
  budgetUsd,
  reservedUsd: 0,
  requests: 0,
  maxToolCallsReserved: 0,
  actualToolCalls: 0,
  processed: 0,
  enriched: 0,
  errors: 0,
  stopped: null,
  updatedAt: new Date().toISOString(),
});

function loadProgress(): Progress {
  const candidates: Progress[] = [];
  for (const file of [progressPath, journalPath]) {
    if (!existsSync(file)) continue;
    const entries =
      file === journalPath
        ? readFileSync(file, "utf8").split("\n").filter(Boolean)
        : [readFileSync(file, "utf8")];
    for (const entry of entries) {
      const parsed = progressSchema.safeParse(
        (() => {
          try {
            return JSON.parse(entry) as unknown;
          } catch {
            return null;
          }
        })(),
      );
      if (parsed.success) candidates.push(parsed.data);
    }
  }
  if (!candidates.length) return emptyProgress();
  return candidates.sort(
    (a, b) => b.reservedUsd - a.reservedUsd || b.processed - a.processed,
  )[0]!;
}

const progress = loadProgress();
if (progress.budgetUsd !== budgetUsd)
  throw new Error(
    `This Muse-only session was created with a $${progress.budgetUsd} ceiling; refusing a different budget.`,
  );
if (progress.stopped === "limit_reached") progress.stopped = null;
function save() {
  progress.updatedAt = new Date().toISOString();
  const value = `${JSON.stringify(progress)}\n`;
  appendFileSync(journalPath, value);
  writeFileSync(progressPath, value);
}

type ResultLine = { watchId?: string; attempt?: number };
const attempts = new Map<string, number>();
if (existsSync(resultsPath)) {
  for (const line of readFileSync(resultsPath, "utf8").split("\n")) {
    if (!line) continue;
    try {
      const result = JSON.parse(line) as ResultLine;
      if (result.watchId && typeof result.attempt === "number")
        attempts.set(
          result.watchId,
          Math.max(attempts.get(result.watchId) ?? 0, result.attempt),
        );
    } catch {
      // A torn last local log line cannot cause a spending reset.
    }
  }
}

function reserveMuseRequest(init: RequestInit | undefined) {
  const body = typeof init?.body === "string" ? init.body : "{}";
  let maxToolCalls = 0;
  try {
    const parsed = JSON.parse(body) as { max_tool_calls?: unknown };
    maxToolCalls =
      typeof parsed.max_tool_calls === "number"
        ? Math.max(0, Math.floor(parsed.max_tool_calls))
        : 0;
  } catch {
    // No web tool in an unreadable request body is not a chargeable search.
  }
  const reservation =
    maxToolCalls * MUSE_TOOL_CALL_USD +
    (maxToolCalls > 0 ? MUSE_TOKEN_RESERVE_USD : 0);
  if (progress.reservedUsd + reservation > budgetUsd) {
    progress.stopped = "budget_limit";
    save();
    throw new Error("MUSE_ENRICHMENT_BUDGET_LIMIT");
  }
  progress.reservedUsd += reservation;
  progress.requests++;
  progress.maxToolCallsReserved += maxToolCalls;
  save();
}

function countMuseTools(payload: unknown) {
  if (!payload || typeof payload !== "object") return 0;
  const output = (payload as { output?: unknown }).output;
  return Array.isArray(output)
    ? output.filter(
        (item) =>
          !!item &&
          typeof item === "object" &&
          (item as { type?: unknown }).type === "web_search_call",
      ).length
    : 0;
}

const trackedFetch: typeof fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url,
  );
  const museHost = new URL(
    process.env.MUSE_SPARK_BASE_URL || "https://api.meta.ai/v1",
  ).hostname;
  const isMuseResearch =
    url.hostname === museHost && url.pathname.endsWith("/responses");
  if (isMuseResearch) reserveMuseRequest(init);
  const response = await fetch(input, init);
  if (isMuseResearch) {
    const payload: unknown = await response
      .clone()
      .json()
      .catch(() => null);
    progress.actualToolCalls += countMuseTools(payload);
    save();
  }
  return response;
};

const databaseUrl = process.env.DIRECT_DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  max_lifetime: 0,
  onnotice: () => undefined,
});

type Job = {
  id: string;
  brand: string;
  model: string;
  reference_code: string | null;
};

const deps = defaultDeps({ fetchImpl: trackedFetch });
if (!deps.config.museSpark) throw new Error("MUSE_SPARK_API_KEY is required");
// A failed Muse request must fail the job; it must never silently send a
// visitor/catalogue query to Perplexity during this owner-requested run.
deps.config.webSearch = "muse";
deps.config.perplexity = null;

const [lock] = await sql<
  { locked: boolean }[]
>`select pg_try_advisory_lock(hashtext('reserve_catalogue_muse_only_enrichment')) as locked`;
if (!lock?.locked) {
  await sql.end();
  throw new Error("Another Muse-only enrichment worker is active");
}

const fx = await loadFxTable();
let consecutiveErrors = 0;
try {
  const candidates = await sql<Job[]>`
    select id::text,brand,model,reference_code from private.watch_catalogue
    where review_status <> 'rejected'
      and (price_amount is null or price_status='unconfirmed'
        or movement is null or case_diameter_mm is null
        or cardinality(styles)=0 or image_url is null)
    order by
      (price_amount is null or price_status='unconfirmed') desc,
      (reference_code is not null) desc,
      brand,model,reference_code nulls last`;

  for (const job of candidates) {
    if (progress.processed >= limit || progress.stopped) break;
    const attempt = (attempts.get(job.id) ?? 0) + 1;
    if (attempt > maxPasses) continue;
    if (!job.reference_code) {
      appendFileSync(
        resultsPath,
        `${JSON.stringify({ at: new Date().toISOString(), watchId: job.id, attempt, status: "needs_reference" })}\n`,
      );
      attempts.set(job.id, attempt);
      continue;
    }
    try {
      const result = await enrichCatalogueReference(
        {
          brand: job.brand,
          model: job.model,
          referenceCode: job.reference_code,
        },
        deps,
        fx,
      );
      await sql.begin(async (tx) => {
        if (result.entry) {
          const entry = result.entry;
          // Exact brand/reference propagation is deliberate: a successful
          // result fills every matching manual workbook queue in one write.
          await tx`update private.watch_catalogue set
            reference_confirmed=true,
            source_url=coalesce(source_url,${entry.sourceUrl ?? null}),
            source_kind=coalesce(source_kind,${entry.sourceKind ?? null}),
            image_url=coalesce(image_url,${entry.imageUrl ?? null}),
            case_diameter_mm=coalesce(case_diameter_mm,${entry.caseDiameterMm ?? null}),
            case_thickness_mm=coalesce(case_thickness_mm,${entry.caseThicknessMm ?? null}),
            case_shape=coalesce(case_shape,${entry.caseShape ?? null}),
            water_resistance_m=coalesce(water_resistance_m,${entry.waterResistanceM ?? null}),
            movement=coalesce(movement,${entry.movement ?? null}),
            in_house_calibre=coalesce(in_house_calibre,${entry.inHouseCalibre ?? null}),
            crystal=coalesce(crystal,${entry.crystal ?? null}),
            display_caseback=coalesce(display_caseback,${entry.displayCaseback ?? null}),
            case_material=coalesce(case_material,${entry.caseMaterial ?? null}),
            caseback_material=coalesce(caseback_material,${entry.casebackMaterial ?? null}),
            strap_material=coalesce(strap_material,${entry.strapMaterial ?? null}),
            styles=array(select distinct unnest(styles || array(select jsonb_array_elements_text(${sql.json(entry.styles)})))),
            complications=array(select distinct unnest(complications || array(select jsonb_array_elements_text(${sql.json(entry.complications ?? [])})))),
            found_in=found_in || ${sql.json((entry.foundIn ?? []) as postgres.JSONValue)},
            updated_at=now()
          where lower(brand)=lower(${job.brand})
            and lower(reference_code)=lower(${job.reference_code})
            and review_status <> 'rejected'`;
          if (
            entry.priceStatus === "confirmed" &&
            entry.priceAmount &&
            entry.priceCurrency
          ) {
            await tx`update private.watch_catalogue set
              price_amount=${entry.priceAmount},price_currency=${entry.priceCurrency},
              price_status='confirmed',price_checked_at=now(),
              price_evidence=${sql.json(entry.priceEvidence as postgres.JSONValue)}
              where lower(brand)=lower(${job.brand})
                and lower(reference_code)=lower(${job.reference_code})
                and price_status='unconfirmed' and review_status <> 'rejected'`;
          }
        }
      });
      progress.processed++;
      if (result.entry) progress.enriched++;
      attempts.set(job.id, attempt);
      appendFileSync(
        resultsPath,
        `${JSON.stringify({ at: new Date().toISOString(), watchId: job.id, attempt, reference: job.reference_code, status: result.status, enriched: !!result.entry, priced: result.entry?.priceStatus === "confirmed" })}\n`,
      );
      appendFileSync(
        logsPath,
        `${JSON.stringify({ at: new Date().toISOString(), reference: job.reference_code, status: result.status, reservedUsd: progress.reservedUsd })}\n`,
      );
      consecutiveErrors = 0;
      save();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("MUSE_ENRICHMENT_BUDGET_LIMIT")
      ) {
        progress.stopped = "budget_limit";
        save();
        break;
      }
      progress.processed++;
      progress.errors++;
      consecutiveErrors++;
      attempts.set(job.id, attempt);
      appendFileSync(
        resultsPath,
        `${JSON.stringify({ at: new Date().toISOString(), watchId: job.id, attempt, reference: job.reference_code, status: "retry", error: error instanceof Error ? error.name : "unknown" })}\n`,
      );
      if (consecutiveErrors >= 5) {
        progress.stopped = "five_consecutive_errors";
        save();
        break;
      }
      save();
    }
  }
  if (!progress.stopped && progress.processed >= limit)
    progress.stopped = "limit_reached";
} finally {
  save();
  await sql.end();
}
