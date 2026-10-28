import { normalizeReference } from "./ai-watch-guardrails";
import { safeHttpUrl } from "./source-pages.server";

/** Extract a product image only when structured product data identifies the
 * exact reference. Article thumbnails and similar references are not proof. */
export function referencedProductImage(
  html: string,
  reference: string,
  brand: string,
  baseUrl: string,
) {
  const target = normalizeReference(reference);
  const fold = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const targetBrand = fold(brand);
  if (!target || !targetBrand) return null;
  const products: Record<string, unknown>[] = [];
  let visited = 0;
  function walk(value: unknown, depth: number) {
    if (
      ++visited > 500 ||
      depth > 10 ||
      value === null ||
      typeof value !== "object"
    )
      return;
    if (Array.isArray(value)) {
      for (const child of value) walk(child, depth + 1);
      return;
    }
    const item = value as Record<string, unknown>;
    const types = Array.isArray(item["@type"])
      ? item["@type"]
      : [item["@type"]];
    if (
      types.some(
        (type) => typeof type === "string" && /(?:^|\/)product$/i.test(type),
      )
    ) {
      const identities = [
        item.sku,
        item.mpn,
        item.productID,
        item.model,
      ].filter((v): v is string => typeof v === "string");
      const rawBrand =
        typeof item.brand === "string"
          ? item.brand
          : item.brand && typeof item.brand === "object"
            ? (item.brand as Record<string, unknown>).name
            : null;
      if (
        typeof rawBrand === "string" &&
        fold(rawBrand) === targetBrand &&
        identities.some((identity) => normalizeReference(identity) === target)
      )
        products.push(item);
    }
    for (const child of Object.values(item)) walk(child, depth + 1);
  }
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi,
  )) {
    try {
      walk(JSON.parse(match[1]!) as unknown, 0);
    } catch {
      /* Ignore invalid metadata. */
    }
  }
  if (products.length !== 1) return null;
  const image = products[0]!.image;
  const candidate: unknown = Array.isArray(image) ? image[0] : image;
  const raw =
    typeof candidate === "string"
      ? candidate
      : candidate && typeof candidate === "object"
        ? ((candidate as Record<string, unknown>).url ??
          (candidate as Record<string, unknown>).contentUrl)
        : null;
  if (typeof raw !== "string") return null;
  try {
    return safeHttpUrl(new URL(raw, baseUrl).toString());
  } catch {
    return null;
  }
}
