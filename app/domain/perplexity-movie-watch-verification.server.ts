import { z } from "zod";

const httpsUrl = z
  .url()
  .refine((value) => new URL(value).protocol === "https:");

export const movieWatchVerificationSchema = z
  .object({
    work: z.object({
      exists: z.boolean(),
      canonicalTitle: z.string().trim().min(1).max(300),
      kind: z.enum(["film", "series", "episode", "unknown"]),
      releaseYear: z.number().int().min(1888).max(2100).nullable(),
      sources: z.array(httpsUrl).max(8),
    }),
    subject: z.object({
      name: z.string().trim().min(1).max(300),
      kind: z.enum([
        "fictional_character",
        "public_figure",
        "ensemble",
        "unknown",
      ]),
      performer: z.string().trim().max(300).nullable(),
      sources: z.array(httpsUrl).max(8),
    }),
    watchClaims: z
      .array(
        z.object({
          candidate: z.string().trim().min(1).max(500),
          brand: z.string().trim().max(160).nullable(),
          modelFamily: z.string().trim().max(300).nullable(),
          exactReference: z.string().trim().max(160).nullable(),
          claimType: z.enum([
            "screen_worn",
            "owned",
            "reported",
            "unconfirmed",
          ]),
          confidence: z.enum([
            "confirmed",
            "probable",
            "uncertain",
            "unconfirmed",
          ]),
          evidenceUrls: z.array(httpsUrl).max(8),
          note: z.string().trim().max(1_500),
        }),
      )
      .max(12),
    context: z.object({
      synopsis: z.string().trim().max(2_000),
      sceneOrEpisode: z.string().trim().max(1_000).nullable(),
      corrections: z.array(z.string().trim().max(500)).max(12),
    }),
  })
  .strict();

const relaxedMovieWatchVerificationSchema = z.object({
  work: z.object({
    exists: z.boolean(),
    canonicalTitle: z.string(),
    kind: z.enum(["film", "series", "episode", "unknown"]),
    releaseYear: z.number().int().nullable(),
    sources: z.array(z.string()),
  }),
  subject: z.object({
    name: z.string(),
    kind: z.enum([
      "fictional_character",
      "public_figure",
      "ensemble",
      "unknown",
    ]),
    performer: z.string().nullable(),
    sources: z.array(z.string()),
  }),
  watchClaims: z.array(
    z.object({
      candidate: z.string(),
      brand: z.string().nullable(),
      modelFamily: z.string().nullable(),
      exactReference: z.string().nullable(),
      claimType: z.enum(["screen_worn", "owned", "reported", "unconfirmed"]),
      confidence: z.enum(["confirmed", "probable", "uncertain", "unconfirmed"]),
      evidenceUrls: z.array(z.string()),
      note: z.string(),
    }),
  ),
  context: z.object({
    synopsis: z.string(),
    sceneOrEpisode: z.string().nullable(),
    corrections: z.array(z.string()),
  }),
});

export type MovieWatchVerification = z.infer<
  typeof movieWatchVerificationSchema
>;

type SonarBody = {
  choices?: Array<{ message?: { content?: unknown } }>;
  citations?: unknown;
};

function extract(body: SonarBody) {
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string")
    throw new Error("Sonar returned no JSON content.");
  const raw = relaxedMovieWatchVerificationSchema.parse(JSON.parse(content));
  const citations = z.array(httpsUrl).safeParse(body.citations).data ?? [];
  const keep = (value: string) => {
    const url = httpsUrl.safeParse(value).data;
    return url && citations.includes(url) ? url : null;
  };
  const dropped = [
    ...raw.work.sources,
    ...raw.subject.sources,
    ...raw.watchClaims.flatMap((claim) => claim.evidenceUrls),
  ].filter((url) => !keep(url));
  return movieWatchVerificationSchema.parse({
    ...raw,
    work: {
      ...raw.work,
      sources: raw.work.sources
        .map(keep)
        .filter((v): v is string => Boolean(v)),
    },
    subject: {
      ...raw.subject,
      sources: raw.subject.sources
        .map(keep)
        .filter((v): v is string => Boolean(v)),
    },
    watchClaims: raw.watchClaims.map((claim) => ({
      ...claim,
      evidenceUrls: claim.evidenceUrls
        .map(keep)
        .filter((v): v is string => Boolean(v)),
    })),
    context: {
      ...raw.context,
      corrections: [
        ...raw.context.corrections,
        ...dropped.map(
          (url) =>
            `Provider URL omitted because it was not a valid citation: ${url}`,
        ),
      ].slice(0, 12),
    },
  });
}

export async function verifyMovieWatchIntake(
  input: {
    title: string;
    originalTitle: string | null;
    yearStart: number | null;
    yearEnd: number | null;
    subject: string;
    watches: string;
    context: string;
    affordableAlternative: string;
  },
  {
    apiKey,
    model = "sonar-pro",
    fetchImpl = fetch,
  }: { apiKey: string; model?: string; fetchImpl?: typeof fetch },
) {
  const response = await fetchImpl("https://api.perplexity.ai/v1/sonar", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1_200,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "movie_watch_verification_v1",
          schema: z.toJSONSchema(movieWatchVerificationSchema, {
            target: "draft-7",
          }),
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You are a skeptical film and horology fact checker. Verify the film or series, the named character or performer, and each watch attribution using primary production records, direct interviews, reputable contemporary reporting, and specialist watch sources. Never guess an exact reference. Preserve uncertainty and contradictions in corrections. Return JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Verify this intake row. A screen-worn claim is not proof of actor ownership. Cite every factual claim with URLs returned by the provider.",
            title: input.title,
            originalTitle: input.originalTitle,
            yearStart: input.yearStart,
            yearEnd: input.yearEnd,
            subject: input.subject,
            watches: input.watches,
            context: input.context,
            affordableAlternative: input.affordableAlternative,
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok)
    throw new Error(
      `Perplexity movie verification returned ${response.status}.`,
    );
  return extract((await response.json()) as SonarBody);
}
