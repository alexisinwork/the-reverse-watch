import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders the landing page and legible subscription form", async ({
  page,
}) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { level: 1, name: "The Reserve" }),
  ).toBeVisible();
  await expect(page.getByText("Archival Documentary")).toBeVisible();
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/favicon.svg",
  );

  const sentryDsn = process.env.SENTRY_DSN?.trim();
  if (sentryDsn) {
    expect(response?.headers()["content-security-policy"]).toContain(
      new URL(sentryDsn).origin,
    );
  }

  const emailInput = page.getByLabel("Email address");
  await expect(emailInput).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /agree to receive/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Subscribe" })).toBeVisible();
  await expect(
    page.locator('script[src*="subscribe-forms.beehiiv.com"]'),
  ).toHaveCount(0);

  const inputColors = await emailInput.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color };
  });
  expect(inputColors).toEqual(
    expect.objectContaining({
      background: "rgb(8, 9, 11)",
      color: "rgb(255, 255, 255)",
    }),
  );
  await expect(
    page.locator('script[src="/_vercel/insights/script.js"]'),
  ).toHaveCount(1);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("exposes a healthy service route", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    service: "the-reserve-web",
  });
});

test("browses sourced watch discovery without hiding uncertainty", async ({
  page,
}) => {
  await page.goto("/watches");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Watches of Celebrity & Cinema",
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Annie Edison's recurring Community watch" })
    .click();
  await expect(page.getByText("Unconfirmed identification")).toBeVisible();
  await expect(page.getByText("Not identified")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Reviewed sources" }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("uses the branded error boundary for unknown routes", async ({ page }) => {
  const response = await page.goto("/not-in-the-archive");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Record not found" }),
  ).toBeVisible();
});

test("completes the essential and personal diagnostic without a model provider", async ({
  page,
}) => {
  await page.goto("/quiz");

  await page.getByLabel("Maximum amount").fill("10000");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Wrist circumference (mm)").fill("170");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Studio, desk, or daily wear").check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Workhorse mechanical").check();
  await page.getByLabel("Within ±15 seconds per day").check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Under 160 g").check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("GMT").check();
  await page.getByLabel("Either is acceptable").check();
  await page
    .getByRole("button", { name: "Continue to personal profile" })
    .click();
  await expect(
    page.getByRole("heading", { name: "How do you want to be perceived?" }),
  ).toBeVisible();
  for (let step = 0; step < 6; step += 1) {
    await page.getByRole("button", { name: "Next" }).click();
  }
  await page.getByRole("button", { name: "View matches" }).click();

  await expect(
    page.getByRole("heading", { name: "Your search boundary" }),
  ).toBeVisible();
  await expect(page.getByText("USD 10,000")).toBeVisible();

  await page.getByRole("button", { name: "Restart diagnostic" }).click();
  await expect(
    page.getByRole("heading", {
      name: "What is the actual purchase ceiling?",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Maximum amount")).toHaveValue("");
});

test("captures personal preferences and preserves cited results", async ({
  page,
}) => {
  await page.goto("/quiz");

  await page.getByLabel("Maximum amount").fill("10000");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Wrist circumference (mm)").fill("170");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Studio, desk, or daily wear").check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Workhorse mechanical").check();
  await page.getByLabel("Within ±15 seconds per day").check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Under 160 g").check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("GMT").check();
  await page.getByLabel("Either is acceptable").check();
  await page
    .getByRole("button", { name: "Continue to personal profile" })
    .click();
  await page.getByRole("radio", { name: /Discreet competence/i }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: /Mid-century industrial/i }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: /Sovereign independent/i }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: /Generational custody/i }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "View matches" }).click();

  await expect(
    page.getByRole("heading", { name: "Your search boundary" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sources used in this result" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Inspect manufacturer source" }).first(),
  ).toBeVisible();
  await expect(page.getByText("Discreet competence")).toBeVisible();
  await expect(page.getByText("Generational custody")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /supabase|sql|beehiiv|engine v|catalogue v|bundled snapshot/i,
  );
});
