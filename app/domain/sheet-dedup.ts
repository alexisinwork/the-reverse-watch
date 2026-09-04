import type { SheetRow } from "./sheet-intake";

const ARTIFACT_MARKERS = [
  "needs research",
  "нет точного варианта в seed-catalogue",
];

export function isWorkbookArtifact(cells: string[]) {
  return cells.some((cell) => {
    const text = cell.normalize("NFKC").trim().toLocaleLowerCase("ru-RU");
    return ARTIFACT_MARKERS.some((marker) => text.startsWith(marker));
  });
}

// `identity` and `sourceLine` are labels, not facts: two rows describing the
// same reference under different display names are the same watch.
const COMPARED_FIELDS = [
  "caliber",
  "caseDiameterMm",
  "caseShape",
  "caseThicknessMm",
  "complications",
  "crystal",
  "displayCaseback",
  "integratedBracelet",
  "lugToLugMm",
  "lugWidthMm",
  "microAdjustment",
  "movementConstruction",
  "movementType",
  "nickelContactRisk",
  "positioningGroup",
  "positioningLine",
  "priceUsdMinor",
  "productUrl",
  "waterResistanceM",
  "wearingScenarios",
] as const satisfies readonly (keyof SheetRow)[];

function differingFields(left: SheetRow, right: SheetRow) {
  return COMPARED_FIELDS.filter(
    (field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]),
  );
}

export function dedupeSheetRows(rows: SheetRow[]) {
  const grouped = new Map<string, SheetRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.referenceCode);
    if (existing) existing.push(row);
    else grouped.set(row.referenceCode, [row]);
  }

  const accepted: SheetRow[] = [];
  const collapsed: { referenceCode: string; sourceLines: number[] }[] = [];
  const conflicts: {
    referenceCode: string;
    sourceLines: number[];
    fields: string[];
  }[] = [];

  for (const [referenceCode, group] of grouped) {
    const first = group[0]!;
    if (group.length === 1) {
      accepted.push(first);
      continue;
    }
    const fields = [
      ...new Set(
        group
          .slice(1)
          .flatMap((candidate) => differingFields(first, candidate)),
      ),
    ].sort();
    const sourceLines = group
      .map((candidate) => candidate.sourceLine)
      .sort((a, b) => a - b);
    if (fields.length === 0) {
      accepted.push(first);
      collapsed.push({ referenceCode, sourceLines });
      continue;
    }
    conflicts.push({ referenceCode, sourceLines, fields });
  }

  return { accepted, collapsed, conflicts };
}
