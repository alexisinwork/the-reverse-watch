import { z } from "zod";
import { webResearchJson, type Deps } from "./ai-providers.server";
import { classifySource, pageMentionsReference } from "./ai-watch-guardrails";
import { readBuildCandidate, verifyCandidate } from "./catalogue-build.server";
import { publicFetch, safeHttpUrl } from "./source-pages.server";
import type { FxTable } from "./fx";

const fields = [
  "caseDiameterMm",
  "caseThicknessMm",
  "caseShape",
  "waterResistanceM",
  "movementType",
  "inHouseCalibre",
  "crystal",
  "displayCaseback",
  "caseMaterial",
  "casebackMaterial",
  "strapMaterial",
  "complications",
] as const;
const claimSchema = z.object({
  field: z.enum(fields),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  quote: z.string().min(8),
  sourceUrl: z.string(),
});
const researchSchema = z.object({
  manufacturerUrl: z.string().nullable(),
  styles: z.array(z.string()).default([]),
  facts: z
    .array(z.unknown())
    .default([])
    .transform((claims) =>
      claims.flatMap((claim) => {
        const parsed = claimSchema.safeParse(claim);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
});
const jsonSchema = {
  type: "object",
  properties: {
    manufacturerUrl: { type: ["string", "null"] },
    styles: { type: "array", items: { type: "string" } },
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string", enum: fields },
          value: {
            anyOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { type: "array", items: { type: "string" } },
            ],
          },
          quote: { type: "string" },
          sourceUrl: { type: "string" },
        },
        required: ["field", "value", "quote", "sourceUrl"],
      },
    },
  },
  required: ["manufacturerUrl", "styles", "facts"],
};
const fold = (value: string) =>
  value
    .toLowerCase()
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
export function quoteSupportsValue(claim: z.infer<typeof claimSchema>) {
  const expected = [
    "caseDiameterMm",
    "caseThicknessMm",
    "waterResistanceM",
  ].includes(claim.field)
    ? "number"
    : ["displayCaseback", "inHouseCalibre"].includes(claim.field)
      ? "boolean"
      : claim.field === "complications"
        ? "array"
        : "string";
  if ((Array.isArray(claim.value) ? "array" : typeof claim.value) !== expected)
    return false;
  const quote = fold(claim.quote);
  if (
    claim.field === "caseDiameterMm" &&
    (!/diameter|diamètre|case size/.test(quote) || /\d\s*[x×]\s*\d/.test(quote))
  )
    return false;
  if (
    claim.field === "caseThicknessMm" &&
    !/thick|height|épaisseur/.test(quote)
  )
    return false;
  if (
    claim.field === "waterResistanceM" &&
    !/water|resistan|bar|atm/.test(quote)
  )
    return false;
  if (typeof claim.value === "number") {
    const label =
      claim.field === "caseDiameterMm"
        ? "(?:diameter|diamètre|case size)"
        : claim.field === "caseThicknessMm"
          ? "(?:thickness|height|épaisseur)"
          : "(?:water resistance|water resistant|resistance|résistance)";
    const values = [
      ...quote.matchAll(
        new RegExp(
          `${label}[^0-9]{0,30}(\\d+(?:[.,]\\d+)?)\\s*(mm|metres|meters|m|bar|atm)\\b`,
          "g",
        ),
      ),
    ];
    return values.some((match) => {
      const n = Number(match[1]!.replace(",", ".")),
        unit = match[2];
      if (claim.field === "waterResistanceM")
        return (
          n * (unit === "bar" || unit === "atm" ? 10 : 1) === claim.value &&
          unit !== "mm"
        );
      return unit === "mm" && n === claim.value;
    });
  }
  if (typeof claim.value === "boolean") {
    if (claim.field === "displayCaseback")
      return claim.value
        ? /open|transparent|display|see.through/.test(quote)
        : /closed|solid/.test(quote);
    return claim.value
      ? /in.house|manufacture/.test(quote) && !/not|non|outsourced/.test(quote)
      : /not in.house|outsourced|third.party/.test(quote);
  }
  if (Array.isArray(claim.value))
    return claim.value.every((value) =>
      quote.includes(fold(value.replaceAll("_", " "))),
    );
  return quote.includes(fold(claim.value.replaceAll("_", " ")));
}

/** Facts must have a quote on a fetched maker/authorised-retailer exact-reference page. */
export async function enrichCatalogueReference(
  watch: { brand: string; model: string; referenceCode: string },
  deps: Deps,
  fx: FxTable | null,
) {
  const raw = researchSchema.parse(
    await webResearchJson(
      [
        `Research this exact watch only: ${watch.brand} ${watch.model}, reference ${watch.referenceCode}.`,
        "Find its manufacturer or authorised retailer product page, missing technical facts and product photograph metadata. No marketplace/grey-market claims.",
        "Return manufacturerUrl, styles (dress/everyday/sport/dive/field/travel; editorial role classification), facts.",
        "Each fact needs field, typed value, exact verbatim quote from that page and sourceUrl. Use explicit units: diameter/thickness mm, water resistance metres. Do not confuse width, length or lug-to-lug with diameter.",
        "MovementType: automatic/manual/quartz/solar/spring_drive/hybrid. Complications: canonical English slugs. If unknown omit the fact; never guess. Quotes must include the value. Do not substitute a related reference or case configuration.",
      ].join("\n"),
      jsonSchema,
      deps,
      { maxToolCalls: 4, contextSize: "medium" },
    ),
  );
  const evidence: Record<string, unknown> = {};
  const accepted: Record<string, unknown> = {};
  const pages = new Map<string, string | null>();
  for (const claim of raw.facts) {
    const url = safeHttpUrl(claim.sourceUrl);
    if (!url || !classifySource(url, watch.brand) || !quoteSupportsValue(claim))
      continue;
    if (!pages.has(url)) {
      if (pages.size >= 3) continue;
      let text: string | null = null;
      try {
        const fetched = await publicFetch(
          url,
          {
            signal: AbortSignal.timeout(8_000),
            headers: {
              "user-agent": "TheReserveBot/1.0 (+https://thereserve.watch)",
            },
          },
          deps.fetchImpl,
        );
        if (
          fetched?.response.ok &&
          classifySource(fetched.finalUrl, watch.brand)
        ) {
          const html = (await fetched.response.text()).slice(0, 1_500_000);
          if (
            pageMentionsReference(watch.referenceCode, html, fetched.finalUrl)
          )
            text = fold(
              html
                .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
                .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
                .replace(/<[^>]*>/g, " "),
            );
        } else {
          await fetched?.response.body?.cancel();
        }
      } catch {
        /* Unreachable facts remain unknown. */
      }
      pages.set(url, text);
    }
    if (!pages.get(url)?.includes(fold(claim.quote))) continue;
    accepted[claim.field] = claim.value;
    evidence[claim.field] = {
      value: claim.value,
      sourceUrl: url,
      quote: claim.quote,
      checkedAt: new Date(deps.now()).toISOString(),
      state: "verified_quote",
    };
  }
  const candidate = readBuildCandidate({
    ...watch,
    ...accepted,
    manufacturerUrl: raw.manufacturerUrl,
    styles: raw.styles,
  });
  if (!candidate) throw new Error("Invalid exact-reference candidate");
  const entry = await verifyCandidate(
    candidate,
    candidate.styles,
    {
      source: "catalogue_enrichment",
      checkedAt: new Date(deps.now()).toISOString(),
    },
    deps,
    fx,
  );
  // Unconfirmed identity is not allowed to promote any fact or photo.
  if (!entry.referenceConfirmed)
    return {
      entry: null,
      evidence,
      research: raw,
      status: "needs_evidence" as const,
    };
  const missingFields = (
    [
      "caseDiameterMm",
      "caseThicknessMm",
      "caseShape",
      "waterResistanceM",
      "movement",
      "inHouseCalibre",
      "crystal",
      "displayCaseback",
      "caseMaterial",
      "casebackMaterial",
      "strapMaterial",
      "imageUrl",
      "priceAmount",
      "priceCurrency",
    ] as const
  ).filter((field) => entry[field] === null || entry[field] === undefined);
  return {
    entry,
    evidence,
    research: raw,
    missingFields,
    status: "enriched" as const,
  };
}
