import fs from "node:fs";
import path from "node:path";

const SCENARIOS: Record<string, string[]> = {
  field_water_abuse: ["sport", "diving", "field"],
  studio_desk_daily: ["office", "everyday", "smart_casual"],
  formal_architectural: ["suit", "evening", "reception"],
};

const COMPLICATIONS: Record<string, string> = {
  gmt: "gmt",
  chronograph: "chronograph",
  moonphase: "moonphase",
  power_reserve: "power_reserve",
  alarm: "alarm",
  world_time: "world_time",
  perpetual_calendar: "perpetual_calendar",
};

type Variant = {
  eligibleEnvironments: string[];
  complications: string[];
  dateStatus: "present" | "absent";
  wearingScenarios?: string[];
  complicationSlugs?: string[];
};

const file = path.join(process.cwd(), "data/catalogue/seed-catalogue.json");
const catalogue = JSON.parse(fs.readFileSync(file, "utf8")) as {
  variants: Variant[];
};

for (const variant of catalogue.variants) {
  variant.wearingScenarios = [
    ...new Set(
      variant.eligibleEnvironments.flatMap(
        (environment) => SCENARIOS[environment] ?? [],
      ),
    ),
  ].sort();

  const slugs = variant.complications
    .map((complication) => COMPLICATIONS[complication])
    .filter((slug): slug is string => Boolean(slug));
  if (variant.dateStatus === "present") slugs.push("date");
  if (slugs.length === 0) slugs.push("time_only");
  variant.complicationSlugs = [...new Set(slugs)].sort();
}

// Written with JSON.stringify indentation; run Prettier over the file
// afterwards so `npm run format:check` stays green.
fs.writeFileSync(file, `${JSON.stringify(catalogue, null, 2)}\n`);
console.log(`Migrated ${catalogue.variants.length} variants to v3 fields.`);
