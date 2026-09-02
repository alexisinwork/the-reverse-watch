import { z } from "zod";

const sourceUrlSchema = z
  .url()
  .refine(
    (value) => new URL(value).protocol === "https:",
    "Sources must use HTTPS.",
  );

export const titleVerificationResponseSchema = z
  .object({
    exists: z.boolean(),
    canonicalTitle: z.string().trim().min(1).max(300),
    releaseYear: z.number().int().min(1888).max(2100).nullable(),
    sources: z.array(sourceUrlSchema).min(1).max(8),
  })
  .strict();

export type TitleVerificationResponse = z.infer<
  typeof titleVerificationResponseSchema
>;

function parseContent(body: unknown): TitleVerificationResponse {
  const content = (
    body as { choices?: Array<{ message?: { content?: unknown } }> }
  )?.choices?.[0]?.message?.content;
  if (typeof content !== "string")
    throw new Error("Sonar returned no JSON content.");
  const parsed = JSON.parse(content) as unknown;
  const result = titleVerificationResponseSchema.parse(parsed);
  const citations = z
    .array(sourceUrlSchema)
    .safeParse((body as { citations?: unknown })?.citations).data;
  if (
    !citations ||
    result.sources.some((source) => !citations.includes(source))
  )
    throw new Error(
      "Title verification source was not returned as a citation.",
    );
  return result;
}

export async function verifyFilmOrSeriesTitle(
  title: string,
  {
    apiKey,
    model = "sonar-pro",
    fetchImpl = fetch,
  }: { apiKey: string; model?: string; fetchImpl?: typeof fetch },
) {
  const boundedTitle = z.string().trim().min(2).max(160).parse(title);
  const response = await fetchImpl("https://api.perplexity.ai/v1/sonar", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Verify one film or television title using sources. Return JSON only. Never guess. Set exists false when the title is not supported.",
        },
        {
          role: "user",
          content: `Verify this original-language title only: ${JSON.stringify(boundedTitle)}. Return its canonical title, release year, and source URLs. Do not identify watches or actors yet.`,
        },
      ],
      temperature: 0,
      max_tokens: 300,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "film_title_verification_v1",
          schema: z.toJSONSchema(titleVerificationResponseSchema, {
            target: "draft-7",
          }),
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(
      `Perplexity title verification returned ${response.status}.`,
    );
  const result = parseContent(await response.json());
  if (result.sources.length === 0)
    throw new Error("Title verification has no sources.");
  return result;
}
