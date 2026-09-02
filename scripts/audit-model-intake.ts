import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type SourceExpression = {
  sourceFile: string;
  sourceSha256: string;
  sourceLine: number;
  sourceOrdinal: number;
  sourceBrand: string;
  canonicalBrandSlug: string | null;
  canonicalBrandName: string | null;
  expression: string;
  expressionId: string;
  parseState: "needs_atomization" | "unreviewed";
  catalogueStatus:
    | "exact_reference_covered"
    | "family_or_model_covered"
    | "missing_reference_or_model"
    | "brand_has_no_accepted_variant"
    | "unresolved_brand";
  matchedVariantIds: string[];
  atomizationSignals: string[];
};

const ROOT = process.cwd();
const SOURCE_FILES = [
  "data/knowledge base/top-15 brands.txt",
  "data/knowledge base/other brands.txt",
  "data/knowledge base/last 100 brands.txt",
] as const;

function normalize(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/&/g, "and")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function splitTopLevel(value: string) {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote !== null) {
      if (character === quote && value[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[") depth += 1;
    if (character === ")" || character === "]") depth = Math.max(0, depth - 1);
    if (character === "," && depth === 0) {
      const expression = value.slice(start, index).trim();
      if (expression) result.push(expression);
      start = index + 1;
    }
  }

  const finalExpression = value.slice(start).trim();
  if (finalExpression) result.push(finalExpression);
  return result;
}

function sha256(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function sourceRows() {
  return SOURCE_FILES.flatMap((relativeFile) => {
    const absoluteFile = path.resolve(ROOT, relativeFile);
    const content = fs.readFileSync(absoluteFile, "utf8");
    const sourceSha256 = sha256(content);
    return content.split(/\r?\n/).flatMap((line, lineIndex) => {
      const match = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
      if (!match) return [];
      const sourceBrand = match[1]!.trim();
      const modelText = match[2]!.replace(/\.$/, "").trim();
      return splitTopLevel(modelText).map((expression) => ({
        relativeFile,
        sourceSha256,
        sourceLine: lineIndex + 1,
        sourceBrand,
        expression,
      }));
    });
  });
}

function main() {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.resolve(ROOT, "data/research/brand-manifest.json"),
      "utf8",
    ),
  ) as {
    brands: Array<{ slug: string; name: string }>;
  };
  const catalogue = JSON.parse(
    fs.readFileSync(
      path.resolve(ROOT, "data/catalogue/seed-catalogue.json"),
      "utf8",
    ),
  ) as {
    variants: Array<{
      id: string;
      brand: { slug: string; name: string };
      collection: string;
      model: string;
      referenceCode: string;
    }>;
  };

  const brandsByName = new Map(
    manifest.brands.map((brand) => [normalize(brand.name), brand]),
  );
  const aliases: Record<string, string> = {
    sinnspezialuhren: "sinn",
    casio: "casio-g-shock",
    orientorientstar: "orient",
    brewwatchco: "brew",
    boldrboldrsupplyco: "boldr",
  };
  const variantsByBrand = new Map<
    string,
    (typeof catalogue.variants)[number][]
  >();
  for (const variant of catalogue.variants) {
    const current = variantsByBrand.get(variant.brand.slug) ?? [];
    current.push(variant);
    variantsByBrand.set(variant.brand.slug, current);
  }

  const rows: SourceExpression[] = sourceRows().map((source, sourceIndex) => {
    const sourceNameKey = normalize(source.sourceBrand);
    const brand = brandsByName.get(sourceNameKey);
    const canonicalBrandSlug = brand?.slug ?? aliases[sourceNameKey] ?? null;
    const canonicalBrand = manifest.brands.find(
      (candidate) => candidate.slug === canonicalBrandSlug,
    );
    const variants = canonicalBrandSlug
      ? (variantsByBrand.get(canonicalBrandSlug) ?? [])
      : [];
    const expressionKey = normalize(source.expression);
    const exactMatches = variants.filter((variant) =>
      expressionKey.includes(normalize(variant.referenceCode)),
    );
    const modelMatches = variants.filter((variant) => {
      const modelKey = normalize(variant.model);
      const collectionKey = normalize(variant.collection);
      return (
        (modelKey.length >= 5 && expressionKey.includes(modelKey)) ||
        (collectionKey.length >= 5 && expressionKey.includes(collectionKey))
      );
    });
    const matchedVariantIds = [
      ...new Set(
        [...exactMatches, ...modelMatches].map((variant) => variant.id),
      ),
    ];
    const atomizationSignals = [
      source.expression.includes("(") ? "parenthetical_alternative" : null,
      source.expression.includes("/") ? "slash_alternative" : null,
      /\b\d{3,6}[A-Z]{0,4}(?:[-/]\d+)?\b/i.test(source.expression)
        ? "reference_or_calibre_token"
        : null,
    ].filter((signal): signal is string => signal !== null);

    let catalogueStatus: SourceExpression["catalogueStatus"];
    if (!canonicalBrandSlug) catalogueStatus = "unresolved_brand";
    else if (exactMatches.length > 0)
      catalogueStatus = "exact_reference_covered";
    else if (modelMatches.length > 0)
      catalogueStatus = "family_or_model_covered";
    else if (variants.length === 0)
      catalogueStatus = "brand_has_no_accepted_variant";
    else catalogueStatus = "missing_reference_or_model";

    const expressionId = sha256(
      `${source.relativeFile}:${source.sourceLine}:${sourceIndex}:${source.expression}`,
    ).slice(0, 24);
    return {
      sourceFile: source.relativeFile,
      sourceSha256: source.sourceSha256,
      sourceLine: source.sourceLine,
      sourceOrdinal: sourceIndex + 1,
      sourceBrand: source.sourceBrand,
      canonicalBrandSlug,
      canonicalBrandName: canonicalBrand?.name ?? null,
      expression: source.expression,
      expressionId,
      parseState:
        atomizationSignals.length > 0 ? "needs_atomization" : "unreviewed",
      catalogueStatus,
      matchedVariantIds,
      atomizationSignals,
    };
  });

  const counts = Object.fromEntries(
    [...new Set(rows.map((row) => row.catalogueStatus))].map((status) => [
      status,
      rows.filter((row) => row.catalogueStatus === status).length,
    ]),
  );
  const output = {
    schemaVersion: 1,
    sourceFiles: SOURCE_FILES.map((relativeFile) => {
      const content = fs.readFileSync(path.resolve(ROOT, relativeFile), "utf8");
      return { path: relativeFile, sha256: sha256(content) };
    }),
    declaredSourceBrandRows: 220,
    sourceBrandRows: new Set(
      rows.map((row) => `${row.sourceFile}:${row.sourceLine}`),
    ).size,
    sourceExpressionCount: rows.length,
    expressionIdUniqueness:
      new Set(rows.map((row) => row.expressionId)).size === rows.length,
    statusCounts: counts,
    expressions: rows,
  };
  const outputPath = path.resolve(
    ROOT,
    "data/research/model-intake-index.json",
  );
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Model intake index: ${path.relative(ROOT, outputPath)}`);
  console.log(
    `Brand rows: ${output.sourceBrandRows}/${output.declaredSourceBrandRows}`,
  );
  console.log(`Top-level expressions: ${output.sourceExpressionCount}/1786`);
  console.log(`Expression IDs unique: ${output.expressionIdUniqueness}`);
  for (const [status, count] of Object.entries(counts))
    console.log(`${status}: ${count}`);
}

main();
