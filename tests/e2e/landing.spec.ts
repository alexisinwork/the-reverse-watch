import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders the landing page and Beehiiv embed", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "The Reserve" }),
  ).toBeVisible();
  await expect(page.getByText("Archival Documentary")).toBeVisible();

  const signupScript = page.locator("script[data-beehiiv-form]");
  await expect(signupScript).toHaveAttribute(
    "data-beehiiv-form",
    "e0fc5991-3244-47f3-a4fd-1214039d9da7",
  );
  await expect(
    page.locator('iframe[src*="subscribe-forms.beehiiv.com"]'),
  ).toBeVisible({
    timeout: 15_000,
  });

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

test("uses the branded error boundary for unknown routes", async ({ page }) => {
  const response = await page.goto("/not-in-the-archive");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Record not found" }),
  ).toBeVisible();
});

test("completes the six-screen core diagnostic without a model provider", async ({
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
  await page.getByRole("button", { name: "View profile" }).click();

  await expect(
    page.getByRole("heading", { name: "Your search boundary" }),
  ).toBeVisible();
  await expect(page.getByText("USD 10,000")).toBeVisible();
});
