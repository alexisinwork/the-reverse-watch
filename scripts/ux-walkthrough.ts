// Walks the live site in a real browser (Playwright Chromium) at phone and
// desktop sizes, clicking through every visitor journey, and writes
// screenshots plus a report of problems (script errors, failed requests,
// broken images, sideways scrolling) to a folder on the Desktop.
//   npx playwright install chromium   (once)
//   node --env-file=.env --import tsx scripts/ux-walkthrough.ts [https://thereserve.watch]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

import {
  issueDiagnosticAccessCookie,
  parseDiagnosticAccessConfiguration,
} from "../app/domain/diagnostic-access.server";

const SITE = process.argv[2] ?? "https://thereserve.watch";
const today = new Date().toISOString().slice(0, 10);
const OUT = `C:/Users/alexi/OneDrive/Desktop/TheReserve_ux-check_${today}`;
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

type Finding = { viewport: string; step: string; problem: string };
type Step = { viewport: string; step: string; seconds: number; shot: string };
const findings: Finding[] = [];
const steps: Step[] = [];

// A signed subscriber cookie, as a newsletter sign-up would set, so the
// walkthrough reaches the quiz without subscribing a real address.
const access = parseDiagnosticAccessConfiguration({
  ...process.env,
  NODE_ENV: "production",
});
if (!access.configured) throw new Error("SESSION_SECRET is required.");
const accessCookie = (await issueDiagnosticAccessCookie(access)).split(";")[0]!;
const [cookieName, cookieValue] = [
  accessCookie.slice(0, accessCookie.indexOf("=")),
  accessCookie.slice(accessCookie.indexOf("=") + 1),
];

async function check(
  page: Page,
  viewport: string,
  step: string,
  started: number,
) {
  const shot = `${viewport}-${String(steps.length + 1).padStart(2, "0")}-${step.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
  // Photos load lazily as a visitor scrolls: scroll through the whole page
  // first, as a visitor would, so the screenshot shows what they see.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.screenshot({ path: path.join(OUT, shot), fullPage: true });
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    brokenImages: [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.alt || image.src.slice(0, 80)),
  }));
  if (layout.overflow > 2) {
    findings.push({
      viewport,
      step,
      problem: `Page is ${layout.overflow}px wider than the screen (sideways scrolling).`,
    });
  }
  for (const image of layout.brokenImages) {
    findings.push({
      viewport,
      step,
      problem: `Image failed to load: ${image}`,
    });
  }
  steps.push({
    viewport,
    step,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    shot,
  });
}

const browser = await chromium.launch();
for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  await context.addCookies([
    {
      name: cookieName,
      value: cookieValue,
      url: SITE,
      httpOnly: true,
      secure: true,
    },
  ]);
  const page = await context.newPage();
  let currentStep = "start";
  page.on("pageerror", (error) =>
    findings.push({
      viewport: viewport.name,
      step: currentStep,
      problem: `Script error: ${error.message.slice(0, 160)}`,
    }),
  );
  page.on("console", (message) => {
    if (message.type() === "error") {
      findings.push({
        viewport: viewport.name,
        step: currentStep,
        problem: `Console error: ${message.text().slice(0, 160)}`,
      });
    }
  });
  page.on("requestfailed", (request) =>
    findings.push({
      viewport: viewport.name,
      step: currentStep,
      problem: `Request failed (${request.failure()?.errorText ?? "error"}): ${request.url().slice(0, 120)}`,
    }),
  );
  page.on("response", (response) => {
    const url = response.url();
    if (
      url.startsWith(SITE) &&
      response.status() >= 400 &&
      !url.includes("nope-missing")
    ) {
      findings.push({
        viewport: viewport.name,
        step: currentStep,
        problem: `HTTP ${response.status()} for ${url.slice(SITE.length, SITE.length + 90)}`,
      });
    }
  });

  async function step(name: string, run: () => Promise<void>) {
    currentStep = name;
    const started = Date.now();
    try {
      await run();
      await check(page, viewport.name, name, started);
    } catch (error) {
      findings.push({
        viewport: viewport.name,
        step: name,
        problem: `Journey broke: ${error instanceof Error ? error.message.split("\n")[0]!.slice(0, 200) : "unknown"}`,
      });
      await page
        .screenshot({
          path: path.join(
            OUT,
            `${viewport.name}-FAILED-${name.replace(/[^a-z0-9]+/gi, "-")}.png`,
          ),
          fullPage: true,
        })
        .catch(() => undefined);
    }
  }

  await step("home", async () => {
    await page.goto(SITE, { waitUntil: "networkidle" });
  });
  await step("archive", async () => {
    await page.goto(`${SITE}/watches`, { waitUntil: "networkidle" });
  });
  await step("story page", async () => {
    await page.locator('a[href^="/watches/stories/"]').first().click();
    await page.waitForLoadState("networkidle");
  });
  await step("archetype quiz", async () => {
    await page.goto(`${SITE}/watches/archetype`, { waitUntil: "networkidle" });
  });
  await step("archetype result", async () => {
    for (const fieldset of await page
      .locator("form.archetype-form fieldset")
      .all()) {
      await fieldset.locator("label").first().click();
    }
    await page
      .getByRole("button", { name: /Reveal editorial archetype/ })
      .click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("heading", { level: 1 }).waitFor();
  });
  await step("film search form", async () => {
    await page.goto(`${SITE}/watches/find`, { waitUntil: "networkidle" });
  });
  await step("film search result", async () => {
    await page
      .getByRole("combobox", { name: "What are you searching for?" })
      .selectOption("actor");
    await page.getByRole("searchbox").fill("Daniel Craig");
    await page.getByRole("button", { name: "Search" }).click();
    await page
      .locator(".watch-card:not(.watch-card--skeleton), .empty-result")
      .first()
      .waitFor({ timeout: 45_000 });
    await page.waitForLoadState("networkidle");
  });
  await step("quiz step 1", async () => {
    await page.goto(`${SITE}/quiz`, { waitUntil: "networkidle" });
  });
  await step("quiz shortlist", async () => {
    await page.getByRole("radio", { name: "USD 1k–2k" }).check({ force: true });
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Wrist circumference").fill("17.5");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("checkbox", { name: "Office" }).check({ force: true });
    await page.getByRole("button", { name: "Next" }).click();
    await page
      .getByRole("checkbox", { name: "Automatic" })
      .check({ force: true });
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "See the shortlist" }).click();
    await page
      .locator(".watch-card:not(.watch-card--skeleton), .empty-result")
      .first()
      .waitFor({ timeout: 45_000 });
    await page.waitForLoadState("networkidle");
  });
  await step("admin login", async () => {
    await page.goto(`${SITE}/admin/catalogue`, { waitUntil: "networkidle" });
  });
  await step("missing page", async () => {
    await page.goto(`${SITE}/nope-missing-page`, { waitUntil: "networkidle" });
  });
  await context.close();
}
await browser.close();

const lines = [
  `# The Reserve: browser walkthrough (${today})`,
  "",
  `Site: ${SITE}. Every journey was clicked through in Chromium at phone (390 px) and desktop (1280 px) width. Screenshots are in this folder.`,
  "",
  "## Steps",
  "",
  "| Size | Step | Time | Screenshot |",
  "|---|---|---:|---|",
  ...steps.map(
    (row) =>
      `| ${row.viewport} | ${row.step} | ${row.seconds} s | ${row.shot} |`,
  ),
  "",
  `## Problems found (${findings.length})`,
  "",
  ...(findings.length === 0
    ? ["None."]
    : findings.map(
        (finding) =>
          `- **${finding.viewport} · ${finding.step}:** ${finding.problem}`,
      )),
  "",
];
writeFileSync(path.join(OUT, "report.md"), lines.join("\n"));
console.log(
  `${steps.length} steps, ${findings.length} problems. Report: ${OUT}/report.md`,
);
for (const finding of findings)
  console.log(`  ${finding.viewport} · ${finding.step}: ${finding.problem}`);
