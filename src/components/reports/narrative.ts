/**
 * Pure report narrative generator — no model calls, no React, no side effects.
 * Produces period summaries from computed finance data with real numbers.
 */

import { toMajor } from "@/lib/finance/money"
import type {
  CategoryBreakdownItem,
  CashflowSummary,
  DetectedSubscription,
} from "@/types/finance"
import type { DateRange } from "@/lib/finance/dates"

export interface ReportNarrativeInput {
  current: CashflowSummary
  previous: CashflowSummary | null
  range: DateRange
  breakdown: CategoryBreakdownItem[]
  subscriptions: DetectedSubscription[]
  currency: string
  locale: string
}

function fmt(minor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(toMajor(minor))
}

function pct(ratio: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(ratio)
}

function formatDateRange(range: DateRange, locale: string): string {
  const from = new Date(range.from).toLocaleDateString(locale, { day: "numeric", month: "short" })
  const to = new Date(range.to).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })
  return `${from} – ${to}`
}

export function generateReportNarrative(input: ReportNarrativeInput): string {
  const { current, previous, range, breakdown, subscriptions, currency, locale } = input

  const period = formatDateRange(range, locale)
  const income = fmt(current.income, currency, locale)
  const expense = fmt(current.expense, currency, locale)
  const net = fmt(Math.abs(current.net), currency, locale)
  const netDir = current.net >= 0 ? "surplus" : "deficit"
  const savingsRate = pct(current.savingsRate, locale)

  const lines: string[] = []

  // Overview
  if (current.income > 0) {
    lines.push(
      `**Period: ${period}** — You took in ${income} in income and spent ${expense}, resulting in a ${net} ${netDir} and a savings rate of ${savingsRate}.`
    )
  } else {
    lines.push(
      `**Period: ${period}** — ${expense} in expenses recorded; no income yet for this period.`
    )
  }

  // Top categories
  if (breakdown.length > 0) {
    const topThree = breakdown.slice(0, 3)
    const catList = topThree
      .map((c) => `${c.name} (${fmt(c.total, currency, locale)}, ${pct(c.share, locale)})`)
      .join(", ")
    lines.push(`Your top expense categories were ${catList}.`)
  }

  // Period-over-period comparison
  if (previous && (previous.income > 0 || previous.expense > 0)) {
    const expenseDelta = current.expense - previous.expense
    const incomeDelta = current.income - previous.income
    const parts: string[] = []

    if (Math.abs(expenseDelta) >= 1000) {
      const dir = expenseDelta > 0 ? "up" : "down"
      parts.push(`spending ${dir} ${fmt(Math.abs(expenseDelta), currency, locale)}`)
    }
    if (Math.abs(incomeDelta) >= 1000) {
      const dir = incomeDelta > 0 ? "up" : "down"
      parts.push(`income ${dir} ${fmt(Math.abs(incomeDelta), currency, locale)}`)
    }
    if (parts.length > 0) {
      lines.push(`Compared to the previous period: ${parts.join(" and ")} vs last period.`)
    } else {
      lines.push(`Spending patterns were broadly similar to the previous period.`)
    }
  }

  // Subscriptions callout
  if (subscriptions.length > 0) {
    const totalAnnual = subscriptions.reduce((s, sub) => s + sub.annualCost, 0)
    const topSub = subscriptions[0]
    lines.push(
      `${subscriptions.length} recurring subscription${subscriptions.length > 1 ? "s" : ""} detected, totalling ${fmt(totalAnnual, currency, locale)}/year. Largest: ${topSub.payee} at ${fmt(topSub.amount, currency, locale)}/${topSub.cadence}.`
    )
  }

  return lines.join("\n\n")
}

/** Markdown export of the report. */
export function exportReportMarkdown(input: ReportNarrativeInput): string {
  const { current, range, breakdown, subscriptions, currency, locale } = input
  const period = formatDateRange(range, locale)

  const rows = breakdown
    .map(
      (c) =>
        `| ${c.name} | ${c.transactionCount} | ${fmt(c.total, currency, locale)} | ${pct(c.share, locale)} |`
    )
    .join("\n")

  const subRows = subscriptions
    .map(
      (s) =>
        `| ${s.payee} | ${s.cadence} | ${fmt(s.amount, currency, locale)} | ${fmt(s.annualCost, currency, locale)} |`
    )
    .join("\n")

  return `# Finora Report — ${period}

## Summary

| | Amount |
|---|---|
| Income | ${fmt(current.income, currency, locale)} |
| Expenses | ${fmt(current.expense, currency, locale)} |
| Net | ${fmt(Math.abs(current.net), currency, locale)} (${current.net >= 0 ? "surplus" : "deficit"}) |
| Savings rate | ${pct(current.savingsRate, locale)} |
| Transactions | ${current.transactionCount} |

## By category

| Category | Transactions | Total | Share |
|---|---|---|---|
${rows}

## Subscriptions

| Payee | Cadence | Amount | Annual cost |
|---|---|---|---|
${subRows}

---
*Exported from Finora*
`
}

/** CSV export of the category breakdown. */
export function exportCategoryCSV(input: ReportNarrativeInput): string {
  const { breakdown, subscriptions, currency, locale } = input
  const header = "Category,Transactions,Total,Share"
  const catRows = breakdown.map(
    (c) =>
      `"${c.name}",${c.transactionCount},"${fmt(c.total, currency, locale)}","${pct(c.share, locale)}"`
  )

  const subHeader = "\n\nSubscriptions,Cadence,Amount,Annual Cost"
  const subRows = subscriptions.map(
    (s) =>
      `"${s.payee}","${s.cadence}","${fmt(s.amount, currency, locale)}","${fmt(s.annualCost, currency, locale)}"`
  )

  return [header, ...catRows, subHeader, ...subRows].join("\n")
}
