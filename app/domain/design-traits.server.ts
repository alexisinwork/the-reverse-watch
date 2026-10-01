/**
 * Reads a watch's design traits from its product photo. Muse Spark is given
 * the photo's address first; when Meta's servers cannot download it (some
 * makers block them), our server downloads it itself (public addresses
 * only, through publicFetch) and sends the image data instead.
 */
import { museVisionJson, type Deps } from "./ai-providers.server";
import {
  designTraitsSchema,
  DESIGN_TRAITS_PROMPT,
  type DesignTraits,
} from "./design-traits";
import { publicFetch } from "./source-pages.server";

const MAX_IMAGE_BYTES = 4_000_000;

async function photoAsDataUrl(imageUrl: string, fetchImpl: typeof fetch) {
  const fetched = await publicFetch(
    imageUrl,
    {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        accept: "image/*",
      },
      signal: AbortSignal.timeout(15_000),
    },
    fetchImpl,
  );
  if (!fetched?.response.ok) return null;
  const type = fetched.response.headers.get("content-type")?.split(";")[0];
  if (!type?.startsWith("image/")) return null;
  const bytes = Buffer.from(await fetched.response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  return `data:${type};base64,${bytes.toString("base64")}`;
}

export async function readDesignTraits(
  imageUrl: string,
  deps: Deps,
): Promise<DesignTraits> {
  try {
    return designTraitsSchema.parse(
      await museVisionJson(DESIGN_TRAITS_PROMPT, imageUrl, deps),
    );
  } catch (error) {
    if (!(
      error instanceof Error &&
      error.message.includes("media_url_not_fetchable")
    )) {
      throw error;
    }
    const dataUrl = await photoAsDataUrl(imageUrl, deps.fetchImpl);
    if (!dataUrl) throw new Error("The photo could not be downloaded.");
    return designTraitsSchema.parse(
      await museVisionJson(DESIGN_TRAITS_PROMPT, dataUrl, deps),
    );
  }
}
