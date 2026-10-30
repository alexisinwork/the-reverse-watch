import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { removeLocalTestPartners } from "../../scripts/local-test-partner-cleanup";

type Site = {
  id: string;
  publicKey: string;
  usage: unknown[];
  active: boolean;
};
async function rpc<T>(name: string, body: unknown): Promise<T> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        ...(key.startsWith("eyJ") ? { authorization: `Bearer ${key}` } : {}),
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok)
    throw new Error(`Partner test RPC ${name}: HTTP ${response.status}`);
  return (await response.json()) as T;
}
const listPartnerSites = async (): Promise<Site[]> =>
  rpc("partner_sites_list_v1", {});
const createdTestSites: string[] = [];
const savePartnerSite = async (input: object): Promise<Site> => {
  const site = await rpc<Site>("partner_site_save_v1", {
    p_site: {
      publicKey: `pk_live_${randomBytes(12).toString("hex")}`,
      ...input,
    },
  });
  if (!("id" in input)) createdTestSites.push(site.id);
  return site;
};

test.afterAll(async () => {
  await removeLocalTestPartners(createdTestSites);
});
const recordPartnerUse = async (
  site: Site,
  feature: string,
): Promise<{ allowed: boolean }> =>
  rpc("partner_site_use_v1", { p_site: site.id, p_feature: feature });

const features = [
  ["quiz", "Find your watch"],
  ["archetype", "Your watch archetype"],
  ["find", "Film, TV & people"],
  ["alternatives", "Cheaper alternatives"],
  ["stories", "Watch stories"],
] as const;
const config = parseEnv(readFileSync("../personal-website/.env.local", "utf8"));
const publicKey = config.VITE_RESERVE_PUBLIC_KEY!;
const service = "http://localhost:5173";

async function openTool(page: Page, feature: (typeof features)[number][0]) {
  await page
    .getByRole("button", {
      name: features.find(([id]) => id === feature)![1],
      exact: true,
    })
    .click();
  const frame = page.frameLocator(`[data-reserve="${feature}"] iframe`);
  await expect(
    frame.getByText("Powered by The Reserve", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Watch advisor ready." }),
  ).toBeVisible();
  return frame;
}

test("five real tools, preserved answers, mobile and admin", async ({
  page,
}) => {
  await page.goto("/watch-advisor-demo");
  const quiz = await openTool(page, "quiz");
  await quiz.getByLabel("USD 1k–2k", { exact: true }).check();
  await quiz.getByRole("button", { name: "Next", exact: true }).click();
  await quiz.getByRole("button", { name: "17 cm", exact: true }).click();
  const archetype = await openTool(page, "archetype");
  for (const group of await archetype.locator("fieldset").all())
    await group.getByRole("radio").first().check();
  await archetype
    .getByRole("button", { name: "Reveal editorial archetype" })
    .click();
  await expect(
    archetype.getByRole("heading", {
      name: "The Field Rationalist",
      exact: true,
    }),
  ).toBeVisible();
  await expect(archetype.getByRole("link")).toHaveCount(1);
  await expect(archetype.getByRole("link")).toHaveText(
    "Powered by The Reserve",
  );
  await expect(archetype.locator("article.watch-card")).toHaveCount(10, {
    timeout: 90_000,
  });
  const find = await openTool(page, "find");
  await find.getByLabel("What are you searching for?").selectOption("actor");
  await find
    .getByLabel("Name of the movie, series, actor, character or celebrity")
    .fill("Daniel Craig");
  await find.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    find.getByRole("heading", { name: "Watches in “Daniel Craig”" }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(find.locator("article.watch-card")).toHaveCount(10, {
    timeout: 60_000,
  });
  await expect(
    find.getByText("Association not fully verified", { exact: true }),
  ).toHaveCount(9);
  await expect(find.getByRole("link")).toHaveCount(1);
  await openTool(page, "alternatives");
  await openTool(page, "stories");
  await openTool(page, "quiz");
  await expect(quiz.getByLabel("Wrist circumference")).toHaveValue("17");
  await expect(page.locator("iframe")).toHaveCount(5);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await expect(quiz.locator('input[type="email"]')).toHaveCount(0);
  await page.screenshot({
    path: "test-results/partner-mobile.png",
    fullPage: true,
  });
  await page.goto(`${service}/admin/sites`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Portfolio local integration",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Vite configuration for Portfolio local integration"),
  ).toHaveValue(
    `VITE_RESERVE_ORIGIN=${service}\nVITE_RESERVE_PUBLIC_KEY=${publicKey}`,
  );
});

test("complete six-screen diagnostic", async ({ page }) => {
  await page.goto("/watch-advisor-demo");
  const frame = await openTool(page, "quiz");
  await frame.getByLabel("USD 1k–2k", { exact: true }).check();
  await frame.getByRole("button", { name: "Next", exact: true }).click();
  await frame.getByRole("button", { name: "17 cm", exact: true }).click();
  await frame.getByRole("button", { name: "Next", exact: true }).click();
  await frame.getByLabel("Everyday", { exact: true }).check();
  await frame.getByRole("button", { name: "Next", exact: true }).click();
  await frame.getByLabel("Automatic", { exact: true }).check();
  await frame.getByRole("button", { name: "Next", exact: true }).click();
  await frame.getByRole("button", { name: "Next", exact: true }).click();
  await frame.getByRole("button", { name: /find|show|shortlist/i }).click();
  await expect(
    frame.getByRole("heading", { name: /Watches that fit every answer/ }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(frame.getByRole("link")).toHaveCount(1);
  await expect(frame.getByRole("link")).toHaveText("Powered by The Reserve");
});

test("submit cheaper alternatives against the real catalogue", async ({
  page,
}) => {
  await page.goto("/watch-advisor-demo");
  const frame = await openTool(page, "alternatives");
  await frame.getByLabel("Watch", { exact: true }).fill("Tudor Black Bay 58");
  await frame.getByLabel("Reference (optional)").fill("M79030N-0001");
  await frame.getByLabel("Price", { exact: true }).fill("2000");
  await frame.getByLabel("No, mechanical only", { exact: true }).check();
  await frame
    .getByRole("button", { name: "Find alternatives", exact: true })
    .click();
  await expect(
    frame.getByRole("heading", {
      name: "Alternatives to the Tudor Black Bay 58",
    }),
  ).toBeVisible({ timeout: 120_000 });
  await expect(frame.locator("article.watch-card").first()).toBeVisible({
    timeout: 90_000,
  });
  await expect(frame.getByRole("link")).toHaveCount(1);
  await expect(frame.getByRole("link")).toHaveText("Powered by The Reserve");
});

test("alternatives shows and submits only the selected budget input", async ({
  page,
}) => {
  await page.goto("/watch-advisor-demo");
  const frame = await openTool(page, "alternatives");
  await expect(frame.getByLabel("Price", { exact: true })).toBeVisible();
  await expect(frame.locator('[name="range"]')).toHaveCount(0);
  await frame.getByLabel("Price", { exact: true }).fill("2500");
  await frame
    .getByRole("radio", { name: "A price range", exact: true })
    .check();
  await expect(frame.locator('[name="amount"]')).toHaveCount(0);
  await frame
    .getByRole("combobox", { name: "Range", exact: true })
    .selectOption("2000_3000");
  const rangeData = await frame
    .locator("form")
    .evaluate((form) =>
      Object.fromEntries(new FormData(form as HTMLFormElement)),
    );
  expect(rangeData).toMatchObject({ mode: "range", range: "2000_3000" });
  expect(rangeData).not.toHaveProperty("amount");
  await frame.getByRole("radio", { name: /Around a price/ }).check();
  await expect(frame.getByLabel("Price", { exact: true })).toHaveValue("2500");
  await expect(frame.locator('[name="range"]')).toHaveCount(0);
  const exactData = await frame
    .locator("form")
    .evaluate((form) =>
      Object.fromEntries(new FormData(form as HTMLFormElement)),
    );
  expect(exactData).toMatchObject({ mode: "exact", amount: "2500" });
  expect(exactData).not.toHaveProperty("range");
  await frame
    .getByRole("radio", { name: "A price range", exact: true })
    .check();
  await expect(
    frame.getByRole("combobox", { name: "Range", exact: true }),
  ).toHaveValue("2000_3000");
});

test("script failure displays a working retry", async ({ page }) => {
  await page.route(`${service}/embed.js`, (route) => route.abort());
  await page.goto("/watch-advisor-demo");
  await expect(page.getByRole("status")).toContainText("could not connect");
  await page.unroute(`${service}/embed.js`);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Watch advisor ready.");
});

test("registered framing, disabled key, wrong origin and quota", async ({
  request,
  browser,
}) => {
  const response = await request.get(`${service}/embed/${publicKey}/archetype`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors http://localhost:8080 http://127.0.0.1:8080",
  );
  expect(response.headers()["x-frame-options"]).toBeUndefined();
  const disabled = await savePartnerSite({
    name: "Local integration disabled check",
    active: false,
    allowedOrigins: ["http://localhost:8080"],
    monthlyQuota: 1,
    theme: {},
    notes: "Automated integration test; intentionally disabled.",
  });
  expect(
    (
      await request.get(`${service}/embed/${disabled.publicKey}/archetype`)
    ).status(),
  ).toBe(404);
  const quota = await savePartnerSite({
    name: "Local integration quota check",
    active: true,
    allowedOrigins: ["http://localhost:8080"],
    monthlyQuota: 1,
    theme: {},
    notes: "Automated integration test; switched off on completion.",
  });
  try {
    expect((await recordPartnerUse(quota, "quiz")).allowed).toBe(true);
    expect((await recordPartnerUse(quota, "quiz")).allowed).toBe(false);
    const limit = await request.get(
      `${service}/embed/${quota.publicKey}/archetype?socialSignal=discreet_competence&aestheticDna=structural_tool&deploymentEnvironment=field_water_abuse&priceComfort=first_good_watch&scoringVersion=2.0.0`,
    );
    expect(await limit.text()).toContain("used all of its searches");
  } finally {
    await savePartnerSite({ ...quota, active: false });
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  // Use an actual unregistered local server. Browser interception assigns a
  // different network address space and can trigger Local Network Access first.
  const wrongOrigin = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.end(
      `<iframe src="${service}/embed/${publicKey}/archetype"></iframe>`,
    );
  });
  await new Promise<void>((resolve) =>
    wrongOrigin.listen(0, "localhost", resolve),
  );
  const address = wrongOrigin.address();
  if (!address || typeof address === "string")
    throw new Error("No test server port");
  const errors: string[] = [];
  page.on("console", (message) => errors.push(message.text()));
  try {
    await page.goto(`http://localhost:${address.port}/`);
    await expect
      .poll(() => errors.some((message) => /frame-ancestors/.test(message)))
      .toBe(true);
  } finally {
    await context.close();
    wrongOrigin.closeAllConnections();
    wrongOrigin.close();
  }
  const sites = await listPartnerSites();
  expect(
    sites.find((site) => site.publicKey === publicKey)?.usage.length,
  ).toBeGreaterThan(0);
});
