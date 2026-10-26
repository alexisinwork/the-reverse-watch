// Creates Excel workbooks for manual catalogue completion. Each file contains
// source/provenance fields plus clearly marked cells for the owner to fill in
// and later return for import.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import postgres from "postgres";

const databaseUrl = process.env.DIRECT_DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_DATABASE_URL required");

const outputRoot =
  "C:/Users/alexi/OneDrive/Desktop/TheReserve_manual_catalogue";
const date = new Date().toISOString().slice(0, 10);
const output = path.join(outputRoot, date);
await mkdir(output, { recursive: true });

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});

type CatalogueRow = {
  id: string;
  brand: string;
  model: string;
  reference: string | null;
  reference_confirmed: boolean;
  import_source: string | null;
  source_url: string | null;
  dials_known: boolean;
  dials_url: string | null;
  price_amount: string | null;
  price_currency: string | null;
  price_status: string;
  movement: string | null;
  diameter: string | null;
  styles: string[];
  image_url: string | null;
};

type Queue = {
  key: "price" | "movement" | "diameter" | "style" | "photo";
  title: string;
  filename: string;
  description: string;
  predicate: string;
  valueLabel: string;
  entryHelp: string;
  inputColumns: { header: string; key: string; width: number }[];
};

const queues: Queue[] = [
  {
    key: "price",
    title: "Missing confirmed price",
    filename: "01_missing-confirmed-price.xlsx",
    description:
      "Every non-rejected catalogue watch without a currently usable price. A price is usable only after the existing two-source check; enter both source URLs where available.",
    predicate: "(price_amount is null or price_status = 'unconfirmed')",
    valueLabel: "Current value",
    entryHelp:
      "Enter a current new-watch price, ISO currency code, two supporting URLs, and date checked. Do not use marketplace or grey-market listings.",
    inputColumns: [
      { header: "Manual price", key: "manualPrice", width: 15 },
      { header: "Currency", key: "manualCurrency", width: 12 },
      { header: "Primary price URL", key: "primaryPriceUrl", width: 38 },
      { header: "Second check URL", key: "secondPriceUrl", width: 38 },
      { header: "Checked date (YYYY-MM-DD)", key: "checkedDate", width: 24 },
    ],
  },
  {
    key: "movement",
    title: "Missing movement",
    filename: "02_missing-movement.xlsx",
    description:
      "Watches with no normalized movement category. Choose a category and include an evidence URL.",
    predicate: "movement is null",
    valueLabel: "Current value",
    entryHelp:
      "Use one normalized category: automatic, manual, quartz, solar, hybrid, or spring_drive. Add the source URL and checked date.",
    inputColumns: [
      { header: "Manual movement", key: "manualMovement", width: 20 },
      { header: "Evidence URL", key: "evidenceUrl", width: 42 },
      { header: "Checked date (YYYY-MM-DD)", key: "checkedDate", width: 24 },
    ],
  },
  {
    key: "diameter",
    title: "Missing case diameter",
    filename: "03_missing-case-diameter.xlsx",
    description:
      "Watches with no case diameter in millimetres. Enter only the case diameter, not lug-to-lug or crown diameter.",
    predicate: "case_diameter_mm is null",
    valueLabel: "Current value",
    entryHelp:
      "Enter a numeric case diameter in millimetres, plus an evidence URL and checked date.",
    inputColumns: [
      { header: "Manual diameter (mm)", key: "manualDiameter", width: 23 },
      { header: "Evidence URL", key: "evidenceUrl", width: 42 },
      { header: "Checked date (YYYY-MM-DD)", key: "checkedDate", width: 24 },
    ],
  },
  {
    key: "style",
    title: "Missing wearing style",
    filename: "04_missing-wearing-style.xlsx",
    description:
      "Watches with no explicit style tag. Use only the controlled tags listed in the instructions.",
    predicate: "cardinality(styles) = 0",
    valueLabel: "Current value",
    entryHelp:
      "Choose one or more tags separated by commas: dress, everyday, sport, dive, field, travel. Add an evidence URL and checked date.",
    inputColumns: [
      { header: "Manual style tags", key: "manualStyles", width: 28 },
      { header: "Evidence URL", key: "evidenceUrl", width: 42 },
      { header: "Checked date (YYYY-MM-DD)", key: "checkedDate", width: 24 },
    ],
  },
  {
    key: "photo",
    title: "Missing photo URL",
    filename: "05_missing-photo-url.xlsx",
    description:
      "Watches without a saved product-photo URL. Enter a public image URL and the product/source page it came from; do not download images into the workbook.",
    predicate: "image_url is null",
    valueLabel: "Current value",
    entryHelp:
      "Enter only the direct public product-image URL and the page that declares it. Do not use Dials image-CDN URLs.",
    inputColumns: [
      { header: "Manual photo URL", key: "manualPhotoUrl", width: 46 },
      { header: "Evidence page URL", key: "evidenceUrl", width: 42 },
      { header: "Checked date (YYYY-MM-DD)", key: "checkedDate", width: 24 },
    ],
  },
];

const baseColumns = [
  { header: "Catalogue ID", key: "id", width: 38 },
  { header: "Brand", key: "brand", width: 20 },
  { header: "Model", key: "model", width: 46 },
  { header: "Reference", key: "reference", width: 24 },
  { header: "Reference confirmed", key: "referenceConfirmed", width: 20 },
  { header: "Import source", key: "importSource", width: 18 },
  { header: "Already in Dials?", key: "dialsKnown", width: 18 },
  { header: "Dials model URL", key: "dialsUrl", width: 42 },
  { header: "Manually checked Dials?", key: "dialsChecked", width: 24 },
  { header: "Dials result / notes", key: "dialsNotes", width: 30 },
  {
    header: "Hide Dials link after manual verification?",
    key: "hideDialsLink",
    width: 31,
  },
  { header: "Existing source page", key: "sourceUrl", width: 42 },
  { header: "Existing price", key: "price", width: 18 },
  { header: "Existing movement", key: "movement", width: 18 },
  { header: "Existing diameter (mm)", key: "diameter", width: 21 },
  { header: "Existing styles", key: "styles", width: 25 },
  { header: "Existing photo URL", key: "imageUrl", width: 42 },
] as const;

function link(value: string | null) {
  return value ? { text: value, hyperlink: value } : "";
}

function addInstructions(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  queue: Queue,
  records: number,
) {
  const sheet = workbook.addWorksheet("Instructions");
  sheet.columns = [{ width: 28 }, { width: 105 }];
  sheet.getRow(1).values = ["Manual catalogue review", queue.title];
  sheet.getRow(1).font = {
    name: "Arial",
    bold: true,
    size: 14,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF172033" },
  };
  const rows = [
    [
      "What this file contains",
      `${records.toLocaleString("en")} watches. ${queue.description}`,
    ],
    [
      "Yellow cells",
      "Fill these cells only. Leave existing catalogue and source columns intact.",
    ],
    [
      "Dials check",
      "Already in Dials? is based on the local catalogue. Mark Manually checked Dials? as yes/no when you have checked it yourself. Mark Hide Dials link after manual verification? as yes only when you also provide your own evidence URL.",
    ],
    [
      "Evidence",
      "Every manual value needs a public evidence URL and date. Use maker or authorised-retailer pages where possible.",
    ],
    [
      "How to return",
      "Keep the Catalogue ID column unchanged. Save as .xlsx and send the completed file back for validation and import.",
    ],
    ["Entry guidance", queue.entryHelp],
    [
      "Example",
      "Example manual entry only: automatic | https://manufacturer.example/watch/reference | 2026-10-26. Replace it; it is not catalogue data.",
    ],
  ];
  for (const values of rows) {
    const row = sheet.addRow(values);
    row.alignment = { vertical: "top", wrapText: true };
    row.commit();
  }
  sheet.getColumn(1).font = { name: "Arial", bold: true };
  sheet.getColumn(2).font = { name: "Arial" };
  sheet.commit();
}

function addRecords(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  queue: Queue,
  records: CatalogueRow[],
) {
  const sheet = workbook.addWorksheet("Records", {
    views: [{ state: "frozen", ySplit: 1, xSplit: 4 }],
  });
  sheet.columns = [...baseColumns, ...queue.inputColumns];
  sheet.getRow(1).font = {
    name: "Arial",
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF172033" },
  };
  // Excel columns beyond Z are not needed by these review workbooks.
  sheet.autoFilter = `A1:${String.fromCharCode(64 + sheet.columnCount)}1`;
  const manualStart = baseColumns.length + 1;

  for (const watch of records) {
    const row = sheet.addRow({
      id: watch.id,
      brand: watch.brand,
      model: watch.model,
      reference: watch.reference ?? "",
      referenceConfirmed: watch.reference_confirmed ? "yes" : "no",
      importSource: watch.import_source ?? "native",
      dialsKnown: watch.dials_known ? "yes" : "no",
      dialsUrl: link(watch.dials_url),
      dialsChecked: "",
      dialsNotes: "",
      hideDialsLink: "",
      sourceUrl: link(watch.source_url),
      price:
        watch.price_amount && watch.price_status !== "unconfirmed"
          ? `${watch.price_currency ?? ""} ${watch.price_amount}`.trim()
          : "",
      movement: watch.movement ?? "",
      diameter: watch.diameter ?? "",
      styles: watch.styles.join(", "),
      imageUrl: link(watch.image_url),
    });
    row.font = { name: "Arial", size: 10 };
    row.alignment = { vertical: "top", wrapText: true };
    for (let column = 9; column <= 11; column++) {
      row.getCell(column).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF2CC" },
      };
    }
    for (let column = manualStart; column <= sheet.columnCount; column++) {
      row.getCell(column).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF2CC" },
      };
    }
    row.getCell("dialsChecked").dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"yes,no,not checked"'],
    };
    row.getCell("hideDialsLink").dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"yes,no"'],
    };
    if (queue.key === "movement") {
      row.getCell("manualMovement").dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"automatic,manual,quartz,solar,hybrid,spring_drive"'],
      };
    }
    if (queue.key === "style") {
      row.getCell("manualStyles").dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"dress,everyday,sport,dive,field,travel"'],
      };
    }
    row.commit();
  }
  sheet.commit();
}

try {
  for (const queue of queues) {
    const records = await sql<CatalogueRow[]>`
      select w.id::text,w.brand,w.model,w.reference_code as reference,
        w.reference_confirmed,w.import_source,w.source_url,
        w.price_amount::text,w.price_currency,w.price_status,w.movement,
        w.case_diameter_mm::text as diameter,w.styles,w.image_url,
        (w.source_details ? 'dials') as dials_known,
        (
          select evidence->>'url' from jsonb_array_elements(w.found_in) evidence
          where evidence->>'source'='dials' and evidence->>'url' like 'https://%'
          limit 1
        ) as dials_url
      from private.watch_catalogue w
      where w.review_status <> 'rejected' and ${sql.unsafe(queue.predicate)}
      order by w.brand,w.model,w.reference_code nulls last`;
    const file = path.join(output, queue.filename);
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      filename: file,
      useSharedStrings: true,
      useStyles: true,
    });
    workbook.creator = "The Reserve";
    workbook.created = new Date();
    workbook.modified = new Date();
    addInstructions(workbook, queue, records.length);
    addRecords(workbook, queue, records);
    await workbook.commit();
    console.log(`${queue.key}\t${records.length}\t${file}`);
  }
} finally {
  await sql.end();
}
