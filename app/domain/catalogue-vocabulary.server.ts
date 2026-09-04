import { z } from "zod";

import {
  BUNDLED_VOCABULARY,
  vocabularyRowSchema,
  type VocabularyRow,
} from "./catalogue-vocabulary";

export const CATALOGUE_VOCABULARY_RPC = "catalogue_vocabulary_v1" as const;
const STORE_TIMEOUT_MS = 2_000;

const databaseRowsSchema = z.array(
  z
    .object({
      kind: z.string(),
      slug: z.string(),
      label_en: z.string(),
      source_alias: z.array(z.string()),
      sort_order: z.number(),
      active: z.boolean(),
    })
    .strict()
    .transform((row) =>
      vocabularyRowSchema.parse({
        kind: row.kind,
        slug: row.slug,
        labelEn: row.label_en,
        sourceAliases: row.source_alias,
        sortOrder: row.sort_order,
        active: row.active,
      }),
    ),
);

type Options = {
  env?: Partial<
    Pick<NodeJS.ProcessEnv, "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY">
  >;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function loadCatalogueVocabulary({
  env = process.env,
  fetchImpl = fetch,
  timeoutMs = STORE_TIMEOUT_MS,
}: Options = {}): Promise<readonly VocabularyRow[]> {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !publishableKey) return BUNDLED_VOCABULARY;

  try {
    const response = await fetchImpl(
      new URL(`/rest/v1/rpc/${CATALOGUE_VOCABULARY_RPC}`, supabaseUrl),
      {
        method: "POST",
        headers: { apikey: publishableKey, "content-type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) return BUNDLED_VOCABULARY;
    const parsed = databaseRowsSchema.safeParse(await response.json());
    return parsed.success && parsed.data.length > 0
      ? parsed.data
      : BUNDLED_VOCABULARY;
  } catch {
    return BUNDLED_VOCABULARY;
  }
}
