// Resumable local worker; source archive and queue live in the database.
// --budget is a conservative request-cost allowance, not provider invoice data.
import { appendFileSync } from "node:fs";
import postgres from "postgres";
import { z } from "zod";
import { defaultDeps } from "../app/domain/ai-providers.server";
import { enrichCatalogueReference } from "../app/domain/catalogue-enrichment.server";
import { loadFxTable } from "../app/domain/fx.server";
import { createEnrichmentLedger } from "./lib/enrichment-ledger";

const flag = (key: string, fallback: number) => {
  const at = process.argv.indexOf(`--${key}`);
  const n = at >= 0 ? Number(process.argv[at + 1]) : fallback;
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid --${key}`);
  return n;
};
const budget = flag("budget", 100),
  limit = flag("limit", 100_000);
const ledger = createEnrichmentLedger("data/watch-archive");
const progress = ledger.load();
const save = () => ledger.save(progress);
const trackedFetch: typeof fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url,
  );
  // Reserve before every paid request, including retries and provider fallback.
  const reserve =
    url.hostname === "api.perplexity.ai"
      ? url.pathname.endsWith("/search")
        ? 0.02
        : 0.1
      : url.hostname ===
          new URL(process.env.MUSE_SPARK_BASE_URL || "https://api.meta.ai/v1")
            .hostname
        ? 0.5
        : 0;
  if (reserve) {
    if (progress.reservedUsd + reserve > budget)
      throw new Error("ENRICHMENT_BUDGET_LIMIT");
    progress.reservedUsd = Number((progress.reservedUsd + reserve).toFixed(4));
    progress.calls++;
    save();
  }
  return fetch(input, init);
};
const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(url, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  max_lifetime: 0,
  onnotice: () => undefined,
});
const deps = defaultDeps({ fetchImpl: trackedFetch });
// Owner explicitly requests Perplexity for missing-fact/reference research.
// The existing independent price checker may still use Muse as its second source.
deps.config.webSearch = "perplexity";
if (!deps.config.perplexity)
  throw new Error("PERPLEXITY_API_KEY is required for catalogue research");
const [lock] = await sql<
  { locked: boolean }[]
>`select pg_try_advisory_lock(hashtext('reserve_catalogue_enrichment')) as locked`;
if (!lock?.locked) {
  await sql.end();
  throw new Error("Another enrichment worker is active");
}
Object.assign(progress, ledger.load());
progress.stopped = null;
const fx = await loadFxTable();
type Job = {
  source: string;
  snapshot: string;
  source_record_id: string;
  watch_id: string;
  brand: string;
  model: string;
  reference_code: string;
};
let consecutiveErrors = 0;
try {
  for (let n = 0; n < limit && progress.reservedUsd < budget; n++) {
    if (progress.reservedUsd + 0.5 > budget) {
      progress.stopped = "budget_limit";
      break;
    }
    const jobs = await sql<Job[]>`
      with due as (
        select source,snapshot,source_record_id from private.watch_catalogue_intake
        where watch_id is not null and state in ('pending','retry','running') and next_attempt_at <= now()
          and exists(select 1 from private.watch_catalogue w where w.id=watch_id and w.review_status <> 'rejected')
        order by priority desc,next_attempt_at,source_record_id for update skip locked limit 1
      ), claimed as (
        update private.watch_catalogue_intake i set state='running',attempts=attempts+1,next_attempt_at=now()+interval '20 minutes',updated_at=now()
        from due where (i.source,i.snapshot,i.source_record_id)=(due.source,due.snapshot,due.source_record_id) returning i.*
      ) select c.source,c.snapshot,c.source_record_id,c.watch_id,w.brand,w.model,w.reference_code
        from claimed c join private.watch_catalogue w on w.id=c.watch_id where w.review_status <> 'rejected'`;
    const job = jobs[0];
    if (!job) {
      progress.stopped = "no_due_jobs";
      break;
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
        const entry = result.entry;
        if (entry) {
          await tx`update private.watch_catalogue set
            reference_confirmed=true,source_url=coalesce(source_url,${entry.sourceUrl ?? null}),
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
            where id=${job.watch_id} and review_status <> 'rejected'`;
          // Imported rows start with a dataset URL; replace it only after primary confirmation.
          await tx`update private.watch_catalogue set source_url=${entry.sourceUrl ?? null}, source_kind=${entry.sourceKind ?? null}
            where id=${job.watch_id} and import_source is not null and (source_kind is null or source_url like 'https://timepiecepedia.com/%')`;
          if (
            entry.priceStatus === "confirmed" &&
            entry.priceAmount &&
            entry.priceCurrency
          ) {
            await tx`update private.watch_catalogue set price_amount=${entry.priceAmount},price_currency=${entry.priceCurrency},price_status='confirmed',price_checked_at=now(),price_evidence=${sql.json(entry.priceEvidence as postgres.JSONValue)}
              where id=${job.watch_id} and price_status='unconfirmed' and review_status <> 'rejected'`;
          }
        }
        await tx`update private.watch_catalogue_intake set state=${result.status},enrichment=${sql.json(result as unknown as postgres.JSONValue)},last_error=null,updated_at=now()
          where source=${job.source} and snapshot=${job.snapshot} and source_record_id=${job.source_record_id}`;
      });
      appendFileSync(
        "data/watch-archive/enrichment-results.jsonl",
        `${JSON.stringify({ at: new Date().toISOString(), watchId: job.watch_id, sourceRecordId: job.source_record_id, result })}\n`,
      );
      consecutiveErrors = 0;
      progress.processed++;
      if (result.entry) progress.enriched++;
      console.log(
        JSON.stringify({
          reference: `${job.brand} ${job.reference_code}`,
          status: result.status,
          image: !!result.entry?.imageUrl,
          priced: result.entry?.priceStatus === "confirmed",
          allowanceReservedUsd: progress.reservedUsd,
        }),
      );
    } catch (error) {
      progress.errors++;
      consecutiveErrors++;
      const diagnostic =
        error instanceof z.ZodError
          ? error.issues
              .map((issue) => `${issue.path.join(".")}:${issue.code}`)
              .join(",")
              .slice(0, 160)
          : error instanceof Error
            ? error.name
            : "unknown";
      const budgetHit =
        error instanceof Error &&
        error.message.includes("ENRICHMENT_BUDGET_LIMIT");
      await sql`update private.watch_catalogue_intake set state='retry',last_error=${budgetHit ? "budget_limit" : diagnostic},next_attempt_at=now()+interval '1 hour',updated_at=now()
        where source=${job.source} and snapshot=${job.snapshot} and source_record_id=${job.source_record_id}`;
      console.log(
        JSON.stringify({
          reference: job.reference_code,
          status: budgetHit ? "budget_limit" : "retry",
        }),
      );
      if (budgetHit || consecutiveErrors >= 5) {
        progress.stopped = budgetHit
          ? "budget_limit"
          : "five_consecutive_errors";
        break;
      }
    }
    save();
  }
  if (progress.reservedUsd >= budget) progress.stopped = "budget_limit";
} finally {
  save();
  await sql.end();
}
