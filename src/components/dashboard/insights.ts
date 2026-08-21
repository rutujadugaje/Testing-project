/**
 * Pure insight generator — no model calls, no React, no side effects.
 * Takes pre-computed finance data and returns strings for the AI Daily Brief
 * and the insight carousel. Every sentence references actual numbers.
 */

import { toMajor } from "@/lib/finance/money"
import type {
  Anomaly,
  BudgetProgress,
  CategoryBreakdownItem,
  CashflowSummary,
  DetectedSubscription,
} from "@/types/finance"

export interface InsightInput {
  current: CashflowSummary
  previous: CashflowSummary
  breakdown: CategoryBreakdownItem[]
  budgets: BudgetProgress[]
  anomalies: Anomaly[]
  subscriptions: DetectedSubscription[]
  budgetHealthScore: number
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
    maximumFractionDigits: 0,
  }).format(ratio)
}

/** The opening sentence of the daily brief. */
function openingLine(input: InsightInput): string {
  const { current, currency, locale } = input
  const income = fmt(current.income, currency, locale)
  const expense = fmt(current.expense, currency, locale)
  const savingsRate = pct(current.savingsRate, locale)

  if (current.income === 0) {
    return `No income recorded for this period yet — ${expense} spent so far.`
  }
  if (current.savingsRate >= 0.2) {
    return `You're saving ${savingsRate} of your income this period. Income is ${income} vs ${expense} in expenses — a healthy margin.`
  }
  if (current.savingsRate < 0) {
    return `Spending outpaces income this period: ${expense} out vs ${income} in. A ${fmt(Math.abs(current.net), currency, locale)} deficit so far.`
  }
  return `Income is ${income} with ${expense} in expenses, leaving a ${pct(current.savingsRate, locale)} savings rate this period.`
}

/** One sentence about the top spending category. */
function topCategoryLine(input: InsightInput): string | null {
  const { breakdown, currency, locale } = input
  if (!breakdown.length) return null
  const top = breakdown[0]
  return `Your biggest expense category is ${top.name} at ${fmt(top.total, currency, locale)} (${pct(top.share, locale)} of total spending).`
}

/** One sentence about the biggest change vs last period. */
function changeLine(input: InsightInput): string | null {
  const { current, previous, currency, locale } = input
  if (previous.income === 0 && previous.expense === 0) return null
  const expenseDelta = current.expense - previous.expense
  const absDelta = fmt(Math.abs(expenseDelta), currency, locale)
  if (Math.abs(expenseDelta) < 1000) return null // less than €10 — not interesting
  if (expenseDelta > 0) {
    return `Spending is up ${absDelta} compared to last period — check your categories for any surprises.`
  }
  return `Spending is down ${absDelta} vs last period — great progress.`
}

/** One sentence about budget health. */
function budgetLine(input: InsightInput): string | null {
  const { budgets, budgetHealthScore, currency, locale } = input
  if (!budgets.length) return null
  const over = budgets.filter((b) => b.state === "over")
  const warning = budgets.filter((b) => b.state === "warning")
  if (over.length > 0) {
    const names = over.map((b) => b.category?.name ?? "Unknown").join(", ")
    const total = over.reduce((s, b) => s + (b.spent - b.limit), 0)
    return `${over.length} budget${over.length > 1 ? "s are" : " is"} over the limit (${names}) — ${fmt(total, currency, locale)} overspent. Budget health score: ${budgetHealthScore}/100.`
  }
  if (warning.length > 0) {
    return `${warning.length} budget${warning.length > 1 ? "s are" : " is"} nearing the limit. Budget health score: ${budgetHealthScore}/100.`
  }
  return `All budgets are on track. Budget health score: ${budgetHealthScore}/100.`
}

/** One sentence about subscriptions. */
function subscriptionLine(input: InsightInput): string | null {
  const { subscriptions, currency, locale } = input
  if (!subscriptions.length) return null
  const totalAnnual = subscriptions.reduce((s, sub) => s + sub.annualCost, 0)
  return `${subscriptions.length} recurring subscription${subscriptions.length > 1 ? "s" : ""} detected totalling ${fmt(totalAnnual, currency, locale)}/year.`
}

/** One sentence about anomalies. */
function anomalyLine(input: InsightInput): string | null {
  const { anomalies } = input
  if (!anomalies.length) return null
  const high = anomalies.filter((a) => a.severity === "high")
  if (high.length > 0) {
    return `${anomalies.length} potential anomal${anomalies.length > 1 ? "ies" : "y"} flagged — including ${high.length} high-severity item${high.length > 1 ? "s" : ""} that may need your attention.`
  }
  return `${anomalies.length} potential anomal${anomalies.length > 1 ? "ies" : "y"} detected — review when you have a moment.`
}

/** Full daily brief narrative. Returns an array of paragraph strings. */
export function generateDailyBrief(input: InsightInput): string[] {
  const lines: (string | null)[] = [
    openingLine(input),
    topCategoryLine(input),
    changeLine(input),
    budgetLine(input),
    subscriptionLine(input),
    anomalyLine(input),
  ]
  return lines.filter((l): l is string => l !== null)
}

/** Concise headline for the brief card (used as the card subtitle). */
export function briefHeadline(input: InsightInput): string {
  const { budgets, anomalies, current } = input
  const hasOverBudget = budgets.some((b) => b.state === "over")
  const hasHighAnomaly = anomalies.some((a) => a.severity === "high")
  if (hasHighAnomaly) return "Action needed — anomalies detected"
  if (hasOverBudget) return "Budget limits exceeded in some categories"
  if (current.savingsRate >= 0.25) return "Strong savings rate this period"
  if (current.savingsRate < 0) return "Spending exceeds income this period"
  return "Here's what happened this period"
}

// ---------------------------------------------------------------------------
// Carousel insights
// ---------------------------------------------------------------------------

export interface InsightCard {
  id: string
  kind: "anomaly" | "subscription" | "top-payee" | "savings-trend" | "budget"
  title: string
  body: string
  severity?: "high" | "medium" | "low"
  ctaLabel: string
  ctaPrompt?: string
  ctaRoute?: string
}

export function generateInsightCards(input: InsightInput): InsightCard[] {
  const { anomalies, subscriptions, breakdown, current, previous, budgets, currency, locale } = input
  const cards: InsightCard[] = []

  // Top anomaly
  const topAnomaly = anomalies[0]
  if (topAnomaly) {
    cards.push({
      id: `anomaly-${topAnomaly.id}`,
      kind: "anomaly",
      title: topAnomaly.title,
      body: topAnomaly.description,
      severity: topAnomaly.severity,
      ctaLabel: "Ask the agent",
      ctaPrompt: `Tell me about this anomaly: ${topAnomaly.title}. ${topAnomaly.description}`,
    })
  }

  // Top subscription
  const topSub = subscriptions[0]
  if (topSub) {
    cards.push({
      id: `sub-${topSub.payee}`,
      kind: "subscription",
      title: `Subscription: ${topSub.payee}`,
      body: `${fmt(topSub.amount, currency, locale)}/${topSub.cadence}, ${fmt(topSub.annualCost, currency, locale)}/year. Next charge expected around ${topSub.nextExpectedDate ?? "TBD"}.`,
      ctaLabel: "View subscriptions",
      ctaRoute: "/reports",
      ctaPrompt: `Should I consider cancelling my ${topSub.payee} subscription at ${fmt(topSub.amount, currency, locale)} per month?`,
    })
  }

  // Top payee
  if (breakdown.length > 0) {
    const top = breakdown[0]
    cards.push({
      id: `top-payee-${top.categoryId}`,
      kind: "top-payee",
      title: `Top category: ${top.name}`,
      body: `${fmt(top.total, currency, locale)} across ${top.transactionCount} transaction${top.transactionCount !== 1 ? "s" : ""} this period — ${pct(top.share, locale)} of spending.`,
      ctaLabel: "Explore in reports",
      ctaRoute: "/reports",
    })
  }

  // Savings trend
  if (previous.income > 0) {
    const delta = current.savingsRate - previous.savingsRate
    const direction = delta >= 0 ? "up" : "down"
    cards.push({
      id: "savings-trend",
      kind: "savings-trend",
      title: `Savings rate ${direction} vs last period`,
      body: `${pct(current.savingsRate, locale)} this period vs ${pct(previous.savingsRate, locale)} last period — a ${pct(Math.abs(delta), locale)} ${direction}ward shift.`,
      ctaLabel: "Ask for savings tips",
      ctaPrompt: `My savings rate moved from ${pct(previous.savingsRate, locale)} to ${pct(current.savingsRate, locale)} this period. What can I do to improve it?`,
    })
  }

  // Budget warning
  const overBudgets = budgets.filter((b) => b.state === "over" || b.state === "warning")
  if (overBudgets.length > 0) {
    const worst = overBudgets[0]
    const name = worst.category?.name ?? "Unknown"
    cards.push({
      id: `budget-${worst.budget.id}`,
      kind: "budget",
      title: `${name} budget ${worst.state === "over" ? "exceeded" : "nearly full"}`,
      body: `${fmt(worst.spent, currency, locale)} spent of ${fmt(worst.limit, currency, locale)} limit (${pct(worst.ratio, locale)}). ${worst.state === "over" ? `${fmt(worst.spent - worst.limit, currency, locale)} over.` : ""}`,
      severity: worst.state === "over" ? "high" : "medium",
      ctaLabel: "Ask for advice",
      ctaPrompt: `My ${name} budget is ${worst.state === "over" ? "over" : "nearly full"} at ${pct(worst.ratio, locale)}. How can I cut back?`,
    })
  }

  return cards.slice(0, 5)
}

/** Ask-agent prompt for the brief card's "Ask the agent" button. */
export function briefAgentPrompt(input: InsightInput): string {
  const { current, currency, locale } = input
  const income = fmt(current.income, currency, locale)
  const expense = fmt(current.expense, currency, locale)
  return `Give me a full analysis of my finances this period. Income is ${income}, expenses are ${expense}, savings rate is ${pct(current.savingsRate, locale)}. What should I focus on?`
}
