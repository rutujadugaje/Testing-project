import { chromium } from "playwright-core"
import { mkdirSync } from "node:fs"

mkdirSync("shots", { recursive: true })
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto("http://127.0.0.1:5181/", { waitUntil: "domcontentloaded" })
await page.waitForTimeout(2500)
await page.screenshot({ path: "shots/dashboard-full.png", fullPage: true })
await page.goto("http://127.0.0.1:5181/reports", { waitUntil: "domcontentloaded" })
await page.waitForTimeout(2000)
await page.screenshot({ path: "shots/reports-full.png", fullPage: true })
await page.goto("http://127.0.0.1:5181/investments", { waitUntil: "domcontentloaded" })
await page.waitForTimeout(2000)
await page.screenshot({ path: "shots/investments-full.png", fullPage: true })
await browser.close()
console.log("done")
