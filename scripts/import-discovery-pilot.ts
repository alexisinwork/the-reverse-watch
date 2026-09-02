import { discoveryPilotCorpusSchema } from "../app/domain/discovery";
import { DISCOVERY_PILOT_CORPUS } from "../app/domain/discovery-pilot";
import { z } from "zod";

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the discovery pilot import.",
  );
}

const corpus = discoveryPilotCorpusSchema.parse(DISCOVERY_PILOT_CORPUS);
if (corpus.stories.length !== 21) {
  throw new Error("The D2 importer requires the reviewed 21-story pilot.");
}

const response = await fetch(
  new URL("/rest/v1/rpc/import_discovery_pilot_v1", supabaseUrl),
  {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_corpus: corpus }),
    signal: AbortSignal.timeout(15_000),
  },
);

if (!response.ok) {
  throw new Error(`Discovery pilot import returned ${response.status}.`);
}

const imported = z
  .number()
  .int()
  .parse(await response.json());
if (imported !== 21) {
  throw new Error(
    `Discovery pilot import expected 21 stories, received ${imported}.`,
  );
}

console.log("Imported 21 reviewed discovery pilot stories.");
