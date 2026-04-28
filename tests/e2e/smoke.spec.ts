import { test, expect } from "@playwright/test";

const NAME = "E2E Acme GmbH";
const PROJECT = "E2E Project Alpha";

test("home → create org → create project → see them", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/funding/i);

  // Create org
  await page.getByRole("link", { name: "Organizations" }).click();
  await page.getByRole("link", { name: "New organization" }).click();
  await page.getByLabel("Legal name").fill(NAME);
  await page.getByLabel("Country (ISO-2)").fill("AT");
  await page.getByLabel("Employees").fill("5");
  await page.getByLabel("Annual revenue (EUR)").fill("1000000.00");
  await page.getByLabel("Balance sheet total (EUR)").fill("1000000.00");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: NAME })).toBeVisible();

  // SME class derived
  await page.getByRole("link", { name: "Organizations" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`${NAME}.*micro`) })).toBeVisible();

  // Create project under that org
  await page.getByRole("link", { name: "Projects" }).click();
  await page.getByRole("link", { name: "New project" }).click();
  await page.getByLabel("Title").fill(PROJECT);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: PROJECT })).toBeVisible();

  // Verify in projects list
  await page.getByRole("link", { name: "Projects" }).click();
  await expect(page.getByRole("row", { name: new RegExp(PROJECT) })).toBeVisible();

  // Catalog browse
  await page.getByRole("link", { name: "Catalog" }).click();
  await expect(page.getByRole("heading", { name: "Funding catalog" })).toBeVisible();
  // Should list multiple seeded programs (15 total in seed)
  const rows = page.locator("table tbody tr");
  await expect(rows).toHaveCount(15);

  // Filter by kind=equity
  await page.getByRole("link", { name: "equity", exact: true }).click();
  await expect(page.locator("table tbody tr")).toHaveCount(3);

  // Quick match: navigate to project detail and assert the panel renders
  await page.getByRole("link", { name: "Projects" }).click();
  await page.getByRole("link", { name: PROJECT }).click();
  await expect(page.getByRole("heading", { name: /Quick match/i })).toBeVisible();
});
