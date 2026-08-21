/**
 * Headless smoke test: visits every route, captures console/page errors, and
 * writes screenshots to ./shots. Fails loudly so regressions are obvious.
 *
 *   node scripts/smoke.mjs [--url http://127.0.0.1:5180] [--dark] [--mobile]
 */
import { chromium } from "playwright-core"
import { mkdirSync } from "node:fs"

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const BASE = getArg("url", "http://127.0.0.1:5180")
const DARK = args.includes("--dark")
const MOBILE = args.includes("--mobile")
const ONLY = getArg("only", null)

const ROUTES = [
  ["/", "dashboard"],
  ["/transactions", "transactions"],
  ["/accounts", "accounts"],
  ["/budgets", "budgets"],
  ["/goals", "goals"],
  ["/investments", "investments"],
  ["/reports", "reports"],
  ["/rules", "rules"],
  ["/agent", "agent"],
  ["/settings", "settings"],
  ["/onboarding", "onboarding"],
]

mkdirSync("shots", { recursive: true })

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] })
const context = await browser.newContext({
  viewport: MOBILE ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: DARK ? "dark" : "light",
})

const problems = []
const page = await context.newPage()

page.on("console", (msg) => {
  if (msg.type() !== "error" && msg.type() !== "warning") return
  const text = msg.text()
  // React Router's future-flag chatter and Vite HMR noise are not app bugs.
  if (/Download the React DevTools|\[vite\]/i.test(text)) return
  problems.push({ route: page.url().replace(BASE, "") || "/", type: msg.type(), text })
})
page.on("pageerror", (err) => {
  problems.push({ route: page.url().replace(BASE, "") || "/", type: "pageerror", text: err.message })
})

const suffix = `${DARK ? "-dark" : ""}${MOBILE ? "-mobile" : ""}`
const routes = ONLY ? ROUTES.filter(([r]) => r === ONLY) : ROUTES

for (const [route, name] of routes) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 })
    await page.waitForTimeout(MOBILE ? 1200 : 1500)
    const bodyText = (await page.locator("body").innerText().catch(() => "")) || ""
    if (bodyText.trim().length < 20) {
      problems.push({ route, type: "blank", text: `Body text only ${bodyText.trim().length} chars` })
    }
    await page.screenshot({ path: `shots/${name}${suffix}.png`, fullPage: false })
    console.log(`ok   ${route.padEnd(16)} ${bodyText.trim().length} chars`)
  } catch (err) {
    problems.push({ route, type: "navigation", text: err.message })
    console.log(`FAIL ${route.padEnd(16)} ${err.message.split("\n")[0]}`)
  }
}

await browser.close()

if (problems.length) {
  console.log(`\n=== ${problems.length} PROBLEM(S) ===`)
  const seen = new Set()
  for (const p of problems) {
    const key = `${p.route}|${p.text.slice(0, 160)}`
    if (seen.has(key)) continue
    seen.add(key)
    console.log(`[${p.type}] ${p.route}\n  ${p.text.slice(0, 500)}\n`)
  }
  process.exit(1)
}
console.log("\nAll routes clean.")
