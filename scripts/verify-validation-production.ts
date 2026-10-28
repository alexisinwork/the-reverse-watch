// Uses an already validated public search. Never logs cookies, secrets or bodies.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { catalogueClient } from "../app/domain/watch-catalogue.server";
import { validationBudgetStatus } from "../app/domain/validation-budget.server";
import { listPartnerSites } from "../app/domain/partner-sites.server";
import { z } from "zod";

const client = catalogueClient();
if (!client) throw new Error("Catalogue read configuration required");
const before = await validationBudgetStatus(client);
const checks: { path: string; status: number; referencePresent?: boolean }[] =
  [];
for (const path of [
  "/health",
  "/watches/find?type=actor&q=Daniel%20Craig",
  "/watches/find?type=actor&q=Daniel%20Craig",
  "/watches/archetype?socialSignal=discreet_competence&aestheticDna=structural_tool&deploymentEnvironment=field_water_abuse&priceComfort=first_good_watch&scoringVersion=2.0.0",
]) {
  const response = await fetch(`https://thereserve.watch${path}`, {
    signal: AbortSignal.timeout(55000),
  });
  const html = await response.text();
  const referencePresent = path.includes("find")
    ? html.includes("231.10.39.21.03.001")
    : path.includes("archetype")
      ? html.includes("H70455533")
      : undefined;
  checks.push({ path, status: response.status, referencePresent });
  assert.equal(response.status, 200);
  if (referencePresent !== undefined) assert.equal(referencePresent, true);
}
// The dedicated local partner is a fixture; never log its key or request headers.
const partner = (await listPartnerSites(client)).find(
  (site) => site.name === "Portfolio local integration",
);
assert.ok(
  partner?.active && partner.allowedOrigins.includes("http://localhost:8080"),
);
for (const origin of [
  "http://localhost:8080",
  "https://unregistered.example",
]) {
  const response: Response = await fetch(
    "https://thereserve.watch/api/v1/find?type=actor&q=Daniel%20Craig",
    {
      headers: { "X-Reserve-Key": partner.publicKey, Origin: origin },
      signal: AbortSignal.timeout(55000),
    },
  );
  if (origin === "https://unregistered.example") {
    assert.equal(response.status, 403);
    checks.push({
      path: "/api/v1/find (unregistered origin)",
      status: response.status,
    });
  } else {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    const body = z
      .object({
        result: z.object({
          status: z.literal("found"),
          fromCache: z.literal(true),
          watches: z.array(z.object({ referenceCode: z.string().nullable() })),
        }),
      })
      .parse(await response.json());
    const referencePresent = body.result.watches.some(
      (watch) => watch.referenceCode === "231.10.39.21.03.001",
    );
    assert.equal(referencePresent, true);
    checks.push({
      path: "/api/v1/find (registered test partner)",
      status: response.status,
      referencePresent,
    });
  }
}
const partnerHeaders = {
  "X-Reserve-Key": partner.publicKey,
  Origin: "http://localhost:8080",
  "Content-Type": "application/json",
};
for (const [path, init] of [
  [
    "/api/v1/alternatives?name=Tudor%20Black%20Bay%2058&ref=M79030N-0001&mode=exact&amount=2000&currency=USD&quartz=no",
    {},
  ],
  [
    "/api/v1/quiz",
    {
      method: "POST",
      body: JSON.stringify({
        version: 4,
        budgetCurrency: "USD",
        priceRange: "1000_2000",
        wristCm: 17.5,
        wearingScenarios: ["everyday"],
        minimumWaterResistanceM: 30,
        movementTypes: ["automatic"],
        requiredComplications: [],
        allergyConstraint: "none",
      }),
    },
  ],
] as const) {
  const response: Response = await fetch(`https://thereserve.watch${path}`, {
    ...init,
    headers: partnerHeaders,
    signal: AbortSignal.timeout(55000),
  });
  assert.equal(response.status, 200);
  const body = z
    .object({
      result: z.object({
        status: z.literal("found"),
        watches: z
          .array(
            z.object({
              brand: z.string(),
              model: z.string(),
              referenceCode: z.string().nullable(),
            }),
          )
          .min(1),
      }),
    })
    .parse(await response.json());
  const references = body.result.watches.map(
    (watch) => `${watch.brand.toLowerCase()}|${watch.referenceCode}`,
  );
  assert.equal(new Set(references).size, references.length);
  checks.push({ path: path.split("?")[0]!, status: response.status });
}
const after = await validationBudgetStatus(client);
assert.equal(
  after.spentUsd,
  before.spentUsd,
  "Validated repeat incurred a charge (or another visitor ran paid research during the smoke)",
);
assert.equal(
  after.attempts,
  before.attempts,
  "Repeat started a validation attempt (or another visitor ran research)",
);
const evidence = {
  at: new Date().toISOString(),
  checks,
  budgetBefore: before,
  budgetAfter: after,
  repeatAddedCharge: after.spentUsd - before.spentUsd,
};
await writeFile(
  "docs/reports/validated-cache-production.json",
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(JSON.stringify(evidence, null, 2));
