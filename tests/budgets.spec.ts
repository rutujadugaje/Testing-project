import { test, expect } from "@playwright/test"

const BASE = process.env.BASE ?? "http://127.0.0.1:5180"

// Regression test for the budgets page row menu.
test("budgets: row menu opens via 'Budget options' control and allows edit", async ({ page }) => {
  await page.goto(`${BASE}/budgets`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)

  const row = page.locator("text=Groceries").first().locator("xpath=ancestor::div[contains(@class,'sm:flex-row')]")

  // Opens the per-row dropdown menu using its accessible name.
  const optionsButton = row.getByRole("button", { name: "Budget options" })
  await optionsButton.click({ timeout: 8000 })

  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible({ timeout: 5000 })
})
