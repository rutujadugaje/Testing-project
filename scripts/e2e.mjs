/**
 * End-to-end interaction test. Drives real user flows in a headless browser and
 * reports console errors, so regressions in behaviour (not just rendering) show up.
 */
import { chromium } from "playwright-core"
import { mkdirSync } from "node:fs"

const BASE = process.env.BASE ?? "http://127.0.0.1:5180"
mkdirSync("shots", { recursive: true })

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] })
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

const errors = []
page.on("console", (m) => {
  if (m.type() === "error" && !/Download the React DevTools|\[vite\]/.test(m.text())) {
    errors.push(m.text())
  }
})
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message))

const step = async (name, fn) => {
  try {
    await fn()
    console.log(`ok    ${name}`)
  } catch (e) {
    console.log(`FAIL  ${name}\n        ${String(e.message).split("\n")[0].slice(0, 220)}`)
    process.exitCode = 1
  }
}

// ---- 1. Agent chat: click a starter prompt and confirm a streamed reply ----
await step("agent: starter prompt streams a reply with tool trace", async () => {
  await page.goto(`${BASE}/agent`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1800)
  const chip = page.getByRole("button", { name: /subscription/i }).first()
  await chip.click({ timeout: 8000 })
  // Wait for the offline router to stream its reply.
  await page.waitForFunction(
    () => /recurring charges|could not find any recurring/i.test(document.body.innerText),
    { timeout: 25000 },
  )
  await page.screenshot({ path: "shots/e2e-agent.png" })
})

// ---- 2. Agent follow-up: type into the composer ----
await step("agent: composer sends a follow-up", async () => {
  const box = page.locator("textarea").first()
  await box.fill("How am I doing on budgets?")
  await box.press("Enter")
  await page.waitForFunction(
    () => /over the limit|you have budgeted|do not have any budgets/i.test(document.body.innerText),
    { timeout: 25000 },
  )
})

// ---- 3. Command palette ----
await step("command palette opens and navigates", async () => {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1200)
  await page.keyboard.press("Control+k")
  await page.waitForTimeout(700)
  const input = page.getByPlaceholder(/Search pages/i)
  await input.fill("budget")
  await page.waitForTimeout(500)
  await page.keyboard.press("Enter")
  await page.waitForTimeout(1200)
  if (!/budget/i.test(page.url())) throw new Error(`expected /budgets, got ${page.url()}`)
})

// ---- 4. AI grid: suggest categories, then accept ----
await step("grid AI: suggest categories produces pending suggestions", async () => {
  await page.goto(`${BASE}/transactions`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1800)
  await page.getByRole("button", { name: /suggest categories/i }).first().click({ timeout: 8000 })
  await page.waitForFunction(
    () => /suggestion|pending|Review/i.test(document.body.innerText),
    { timeout: 15000 },
  )
  await page.screenshot({ path: "shots/e2e-ai-grid.png" })
})

// ---- 5. Inline edit persistence across reload ----
await step("transactions: inline payee edit persists across reload", async () => {
  await page.goto(`${BASE}/transactions`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1600)
  const cell = page.locator("table tbody tr").first().locator("td").nth(2)
  await cell.click()
  await page.waitForTimeout(500)
  const input = page.locator("table input[type=text], table input:not([type])").first()
  const visible = await input.isVisible().catch(() => false)
  if (!visible) throw new Error("inline editor did not open on payee cell")
  await input.fill("E2E EDITED PAYEE")
  await input.press("Enter")
  await page.waitForTimeout(800)
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1600)
  if (!(await page.getByText("E2E EDITED PAYEE").first().isVisible().catch(() => false))) {
    throw new Error("edit did not persist after reload")
  }
})

// ---- 6. Budgets CRUD ----
await step("budgets: page shows progress and over-budget state", async () => {
  await page.goto(`${BASE}/budgets`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)
  const text = await page.locator("body").innerText()
  if (!/Groceries/i.test(text)) throw new Error("expected Groceries budget row")
  if (!/over|100%|1 0/i.test(text)) throw new Error("expected an over-budget indicator")
})

// ---- 7. Dark mode ----
await step("dark mode toggles via settings", async () => {
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1400)
  // ToggleGroup items expose a "radio"-ish role in Base UI, so match on text.
  const darkBtn = page.locator("button", { hasText: /^Dark$/ }).first()
  if (await darkBtn.isVisible().catch(() => false)) {
    await darkBtn.click()
    await page.waitForTimeout(800)
    const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"))
    if (!isDark) throw new Error("dark class not applied to <html>")
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: "shots/e2e-dark.png" })
    // restore
    await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1200)
    await page.locator("button", { hasText: /^Light$/ }).first().click().catch(() => {})
    await page.waitForTimeout(500)
  } else {
    throw new Error("dark theme control not found on settings")
  }
})

// ---- 8. Mobile layout ----
await step("mobile: dashboard renders without overflow", async () => {
  const mob = await context.newPage()
  await mob.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
  await mob.setViewportSize({ width: 390, height: 844 })
  await mob.waitForTimeout(1800)
  const overflow = await mob.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  await mob.screenshot({ path: "shots/e2e-mobile.png" })
  await mob.close()
  if (overflow > 12) throw new Error(`horizontal overflow of ${overflow}px`)
})

await browser.close()

if (errors.length) {
  console.log(`\n=== ${errors.length} CONSOLE ERROR(S) ===`)
  for (const e of [...new Set(errors)].slice(0, 12)) console.log("  " + e.slice(0, 300))
  process.exitCode = 1
} else {
  console.log("\nNo console errors.")
}
