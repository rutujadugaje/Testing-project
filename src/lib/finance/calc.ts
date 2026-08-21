/**
 * Pure finance calculations. No React, no store, no side effects — every
 * function takes plain data and returns plain data so the agent tools and the
 * UI compute identical numbers.
 */

import type {
  Account,
  AccountBalance,
  Anomaly,
  Budget,
  BudgetProgress,
  CashflowPoint,
  CashflowSummary,
  Category,
  CategoryBreakdownItem,
  DetectedSubscription,
  Goal,
  Holding,
  IsoDate,
  IsoMonth,
  Rule,
  Transaction,
  TransactionQuery,
} from "@/types/finance"

import {
  bucketLabel,
  bucketRange,
  fromIsoDate,
  isWithinRange,
  monthRange,
  pickGranularity,
  toIsoDate,
  toIsoMonth,
  type DateRange,
  type Granularity,
} from "./dates"

// ---------------------------------------------------------------------------
// Querying
// ---------------------------------------------------------------------------

export function queryTransactions(
  transactions: Transaction[],
  query: TransactionQuery = {},
): Transaction[] {
  const search = query.search?.trim().toLowerCase()

  let rows = transactions.filter((t) => {
    if (query.from && t.date < query.from) return false
    if (query.to && t.date > query.to) return false
    if (query.accountIds?.length && !query.accountIds.includes(t.accountId)) return false
    if (query.categoryIds?.length && (!t.categoryId || !query.categoryIds.includes(t.categoryId)))
      return false
    if (query.status?.length && !query.status.includes(t.status)) return false
    if (query.uncategorizedOnly && t.categoryId) return false
    if (query.includeTransfers === false && t.isTransfer) return false
    if (query.direction === "expense" && t.amount >= 0) return false
    if (query.direction === "income" && t.amount <= 0) return false
    if (query.minAmount != null && t.amount < query.minAmount) return false
    if (query.maxAmount != null && t.amount > query.maxAmount) return false
    if (query.tags?.length && !query.tags.some((tag) => t.tags.includes(tag))) return false
    if (search) {
      const haystack = `${t.payee} ${t.memo ?? ""} ${t.tags.join(" ")}`.toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })

  rows = sortTransactions(rows, query.sort ?? "date_desc")
  return query.limit != null ? rows.slice(0, query.limit) : rows
}

export function sortTransactions(
  rows: Transaction[],
  sort: NonNullable<TransactionQuery["sort"]>,
): Transaction[] {
  const sorted = [...rows]
  switch (sort) {
    case "date_asc":
      return sorted.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    case "amount_desc":
      return sorted.sort((a, b) => b.amount - a.amount)
    case "amount_asc":
      return sorted.sort((a, b) => a.amount - b.amount)
    case "date_desc":
    default:
      return sorted.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  }
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

export function accountBalances(
  accounts: Account[],
  transactions: Transaction[],
): AccountBalance[] {
  const byAccount = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const list = byAccount.get(t.accountId)
    if (list) list.push(t)
    else byAccount.set(t.accountId, [t])
  }

  return accounts.map((account) => {
    const rows = byAccount.get(account.id) ?? []
    let cleared = account.openingBalance
    let pending = 0
    for (const t of rows) {
      if (t.status === "pending") pending += t.amount
      else cleared += t.amount
    }
    return {
      accountId: account.id,
      balance: cleared + pending,
      clearedBalance: cleared,
      pendingBalance: pending,
      transactionCount: rows.length,
    }
  })
}

export function totalNetWorth(
  accounts: Account[],
  transactions: Transaction[],
  holdings: Holding[] = [],
): number {
  const liquid = accountBalances(
    accounts.filter((a) => !a.archived),
    transactions,
  ).reduce((sum, b) => sum + b.balance, 0)
  const invested = holdings.reduce((sum, h) => sum + h.quantity * h.lastPrice, 0)
  return liquid + invested
}

/** Running balance after each transaction, oldest first. Used for sparklines. */
export function balanceSeries(
  accounts: Account[],
  transactions: Transaction[],
  range: DateRange,
): CashflowPoint[] {
  const granularity = pickGranularity(range)
  const opening = accounts.reduce((sum, a) => sum + a.openingBalance, 0)
  const priorNet = transactions
    .filter((t) => t.date < range.from)
    .reduce((sum, t) => sum + t.amount, 0)

  let running = opening + priorNet
  return bucketRange(range, granularity).map((bucket) => {
    const rows = transactions.filter((t) => isWithinRange(t.date, bucket) && !t.isTransfer)
    const income = rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const expense = rows.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)
    running += income + expense
    return {
      label: bucketLabel(bucket, granularity),
      date: bucket.from,
      income,
      expense: Math.abs(expense),
      net: income + expense,
      balance: running,
    }
  })
}

export function cashflowSeries(
  transactions: Transaction[],
  range: DateRange,
  granularity: Granularity = pickGranularity(range),
  locale = "fr-FR",
): CashflowPoint[] {
  let running = 0
  return bucketRange(range, granularity).map((bucket) => {
    const rows = transactions.filter((t) => isWithinRange(t.date, bucket) && !t.isTransfer)
    const income = rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const expense = Math.abs(rows.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0))
    running += income - expense
    return {
      label: bucketLabel(bucket, granularity, locale),
      date: bucket.from,
      income,
      expense,
      net: income - expense,
      balance: running,
    }
  })
}

// ---------------------------------------------------------------------------
// Summaries and breakdowns
// ---------------------------------------------------------------------------

export function summarize(
  transactions: Transaction[],
  categories: Category[],
  range: DateRange,
): CashflowSummary {
  const rows = transactions.filter((t) => isWithinRange(t.date, range) && !t.isTransfer)
  const income = rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const expense = Math.abs(rows.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0))
  return {
    from: range.from,
    to: range.to,
    income,
    expense,
    net: income - expense,
    savingsRate: income > 0 ? (income - expense) / income : 0,
    transactionCount: rows.length,
    topCategories: categoryBreakdown(rows, categories, "expense").slice(0, 5),
  }
}

export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  direction: "expense" | "income" = "expense",
): CategoryBreakdownItem[] {
  const rows = transactions.filter((t) =>
    direction === "expense" ? t.amount < 0 && !t.isTransfer : t.amount > 0 && !t.isTransfer,
  )
  const byCategory = new Map<string, { total: number; count: number }>()

  for (const t of rows) {
    const key = t.categoryId ?? "__uncategorized__"
    const entry = byCategory.get(key) ?? { total: 0, count: 0 }
    entry.total += Math.abs(t.amount)
    entry.count += 1
    byCategory.set(key, entry)
  }

  const grand = [...byCategory.values()].reduce((s, e) => s + e.total, 0)
  const lookup = new Map(categories.map((c) => [c.id, c]))

  return [...byCategory.entries()]
    .map(([categoryId, entry]) => {
      const category = lookup.get(categoryId)
      return {
        categoryId,
        name: category?.name ?? "Uncategorized",
        color: category?.color ?? "var(--muted-foreground)",
        total: entry.total,
        share: grand > 0 ? entry.total / grand : 0,
        transactionCount: entry.count,
      }
    })
    .sort((a, b) => b.total - a.total)
}

/** Spend per payee, for "where does my money actually go" views. */
export function payeeBreakdown(
  transactions: Transaction[],
  limit = 10,
): { payee: string; total: number; count: number }[] {
  const byPayee = new Map<string, { total: number; count: number }>()
  for (const t of transactions) {
    if (t.amount >= 0 || t.isTransfer) continue
    const key = normalizePayee(t.payee)
    const entry = byPayee.get(key) ?? { total: 0, count: 0 }
    entry.total += Math.abs(t.amount)
    entry.count += 1
    byPayee.set(key, entry)
  }
  return [...byPayee.entries()]
    .map(([payee, e]) => ({ payee, total: e.total, count: e.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export function budgetProgress(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  month: IsoMonth,
  monthStartDay = 1,
): BudgetProgress[] {
  const range = monthRange(month, monthStartDay)
  const lookup = new Map(categories.map((c) => [c.id, c]))
  const rows = transactions.filter((t) => isWithinRange(t.date, range) && !t.isTransfer)

  return budgets
    .filter((b) => b.month === month)
    .map((budget) => {
      const spent = Math.abs(
        rows
          .filter((t) => t.categoryId === budget.categoryId && t.amount < 0)
          .reduce((s, t) => s + t.amount, 0),
      )
      const ratio = budget.limit > 0 ? spent / budget.limit : 0
      return {
        budget,
        category: lookup.get(budget.categoryId),
        spent,
        limit: budget.limit,
        remaining: budget.limit - spent,
        ratio,
        state: ratio > 1 ? "over" : ratio >= 0.8 ? "warning" : "under",
      } satisfies BudgetProgress
    })
    .sort((a, b) => b.ratio - a.ratio)
}

/**
 * 0–100 score for how well spending is tracking against budget.
 *
 * Measured against *pace*, not against the raw remaining balance: on the 27th of
 * the month a user who has spent 85% of their budget is doing fine, and scoring
 * them 15/100 would be actively misleading. Pass `elapsedRatio` (0–1, how far
 * through the budget period we are) to enable pace-aware scoring; omit it and
 * the score falls back to plain "share still unspent".
 */
export function budgetHealthScore(progress: BudgetProgress[], elapsedRatio?: number): number {
  if (!progress.length) return 100
  const limit = progress.reduce((s, p) => s + p.limit, 0)
  const spent = progress.reduce((s, p) => s + p.spent, 0)
  if (limit <= 0) return 100

  const spentRatio = spent / limit

  if (elapsedRatio == null) {
    return Math.max(0, Math.min(100, Math.round((1 - spentRatio) * 100)))
  }

  // Expected spend at this point in the period, floored so day 1 is not scored
  // against a target of zero.
  const expected = Math.max(0.05, Math.min(1, elapsedRatio))
  // 1.0 means exactly on pace; above 1 means spending faster than the month.
  const pace = spentRatio / expected

  // On or under pace stays in the 70–100 band; overspending falls away steeply
  // so a genuinely blown budget still reads as bad.
  const score = pace <= 1 ? 100 - pace * 30 : 70 - (pace - 1) * 70
  return Math.max(0, Math.min(100, Math.round(score)))
}

/** How far through a date range we are, 0–1. Feeds `budgetHealthScore`. */
export function elapsedRatioOfRange(range: DateRange, reference: Date = new Date()): number {
  const start = fromIsoDate(range.from).getTime()
  const end = fromIsoDate(range.to).getTime()
  if (end <= start) return 1
  const now = reference.getTime()
  if (now <= start) return 0
  if (now >= end) return 1
  return (now - start) / (end - start)
}

/**
 * Suggest a limit from history: the median of the last `lookback` months, so a
 * single unusual month does not distort the recommendation.
 */
export function suggestBudgetLimit(
  transactions: Transaction[],
  categoryId: string,
  lookback = 3,
  reference: Date = new Date(),
  monthStartDay = 1,
): number {
  const totals: number[] = []
  for (let i = 1; i <= lookback; i++) {
    const month = toIsoMonth(new Date(reference.getFullYear(), reference.getMonth() - i, 1))
    const range = monthRange(month, monthStartDay)
    const total = Math.abs(
      transactions
        .filter(
          (t) =>
            t.categoryId === categoryId &&
            t.amount < 0 &&
            !t.isTransfer &&
            isWithinRange(t.date, range),
        )
        .reduce((s, t) => s + t.amount, 0),
    )
    if (total > 0) totals.push(total)
  }
  if (!totals.length) return 0
  totals.sort((a, b) => a - b)
  const median = totals[Math.floor(totals.length / 2)]
  // Round up to the nearest €5 so suggestions look deliberate.
  return Math.ceil(median / 500) * 500
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export interface GoalProjection {
  goal: Goal
  ratio: number
  remaining: number
  monthsRemaining?: number
  requiredMonthly?: number
  onTrack: boolean
  projectedCompletion?: IsoDate
}

export function goalProjection(goal: Goal, reference: Date = new Date()): GoalProjection {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
  const ratio = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0

  let monthsRemaining: number | undefined
  let requiredMonthly: number | undefined
  if (goal.deadline) {
    const deadline = fromIsoDate(goal.deadline)
    const months =
      (deadline.getFullYear() - reference.getFullYear()) * 12 +
      (deadline.getMonth() - reference.getMonth())
    monthsRemaining = Math.max(0, months)
    requiredMonthly = monthsRemaining > 0 ? Math.ceil(remaining / monthsRemaining) : remaining
  }

  const contribution = goal.monthlyContribution ?? 0
  let projectedCompletion: IsoDate | undefined
  if (contribution > 0 && remaining > 0) {
    const months = Math.ceil(remaining / contribution)
    const date = new Date(reference.getFullYear(), reference.getMonth() + months, 1)
    projectedCompletion = toIsoDate(date)
  }

  const onTrack =
    remaining === 0 || requiredMonthly == null || contribution >= requiredMonthly

  return { goal, ratio, remaining, monthsRemaining, requiredMonthly, onTrack, projectedCompletion }
}

// ---------------------------------------------------------------------------
// Rules engine
// ---------------------------------------------------------------------------

export function ruleMatches(rule: Rule, t: Transaction): boolean {
  if (!rule.enabled) return false
  const { match } = rule
  switch (match.kind) {
    case "payee_contains":
      return !!match.value && t.payee.toLowerCase().includes(match.value.toLowerCase())
    case "memo_contains":
      return !!match.value && (t.memo ?? "").toLowerCase().includes(match.value.toLowerCase())
    case "payee_regex": {
      if (!match.value) return false
      try {
        return new RegExp(match.value, "i").test(t.payee)
      } catch {
        return false
      }
    }
    case "amount_range": {
      const amount = Math.abs(t.amount)
      if (match.min != null && amount < match.min) return false
      if (match.max != null && amount > match.max) return false
      return match.min != null || match.max != null
    }
    default:
      return false
  }
}

export interface RuleApplication {
  transactionId: string
  ruleId: string
  setCategoryId?: string
  addTags: string[]
}

/** Lowest `priority` wins; only fills gaps unless `overwrite`. */
export function applyRules(
  rules: Rule[],
  transactions: Transaction[],
  options: { overwrite?: boolean } = {},
): RuleApplication[] {
  const ordered = [...rules].filter((r) => r.enabled).sort((a, b) => a.priority - b.priority)
  const applications: RuleApplication[] = []

  for (const t of transactions) {
    for (const rule of ordered) {
      if (!ruleMatches(rule, t)) continue
      const setCategory =
        rule.setCategoryId && (options.overwrite || !t.categoryId) ? rule.setCategoryId : undefined
      const addTags = rule.setTags.filter((tag) => !t.tags.includes(tag))
      if (setCategory || addTags.length) {
        applications.push({
          transactionId: t.id,
          ruleId: rule.id,
          setCategoryId: setCategory,
          addTags,
        })
      }
      break // first matching rule wins
    }
  }
  return applications
}

// ---------------------------------------------------------------------------
// Subscription detection
// ---------------------------------------------------------------------------

/** Strip order refs, dates, card tails and city suffixes banks append. */
export function normalizePayee(payee: string): string {
  return payee
    .toUpperCase()
    .replace(/\b(CARTE|CB|VIR|PRLV|PAIEMENT|ACHAT|FACTURE|SEPA)\b/g, " ")
    .replace(/\b\d{2}[/.-]\d{2}([/.-]\d{2,4})?\b/g, " ")
    .replace(/\b[A-Z]{0,2}\d{4,}\b/g, " ")
    .replace(/[^A-Z0-9&' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

function cadenceFromGap(days: number): DetectedSubscription["cadence"] {
  if (days >= 5 && days <= 9) return "weekly"
  if (days >= 25 && days <= 35) return "monthly"
  if (days >= 84 && days <= 100) return "quarterly"
  if (days >= 350 && days <= 380) return "yearly"
  return "irregular"
}

const CADENCE_PER_YEAR: Record<DetectedSubscription["cadence"], number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
  irregular: 0,
}

/**
 * Group recurring outflows by normalized payee, then judge regularity from the
 * spacing of dates and the stability of amounts.
 */
export function detectSubscriptions(
  transactions: Transaction[],
  options: { minOccurrences?: number; excludeCategoryIds?: string[] } = {},
): DetectedSubscription[] {
  const minOccurrences = options.minOccurrences ?? 3
  const excluded = new Set(options.excludeCategoryIds ?? [])
  const groups = new Map<string, Transaction[]>()

  for (const t of transactions) {
    if (t.amount >= 0 || t.isTransfer) continue
    // Rent and taxes are recurring but they are not discretionary subscriptions;
    // surfacing them as "cancellable" would be noise.
    if (t.categoryId && excluded.has(t.categoryId)) continue
    const key = normalizePayee(t.payee)
    if (!key) continue
    const list = groups.get(key)
    if (list) list.push(t)
    else groups.set(key, [t])
  }

  const results: DetectedSubscription[] = []

  for (const [payee, rows] of groups) {
    if (rows.length < minOccurrences) continue
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
    const amounts = sorted.map((t) => Math.abs(t.amount))
    const med = median(amounts)
    if (med <= 0) continue

    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      const prev = fromIsoDate(sorted[i - 1].date).getTime()
      const curr = fromIsoDate(sorted[i].date).getTime()
      gaps.push(Math.round((curr - prev) / 86_400_000))
    }
    const medGap = median(gaps)
    const cadence = cadenceFromGap(medGap)

    // Amount stability: how tightly amounts cluster around the median.
    const spread = median(amounts.map((a) => Math.abs(a - med))) / med
    const gapSpread = medGap > 0 ? median(gaps.map((g) => Math.abs(g - medGap))) / medGap : 1

    // A real subscription bills a near-identical amount every time. Variable
    // spend at a regular haunt (groceries every few days, the usual lunch spot)
    // produces a steady cadence but scattered amounts — reject those, otherwise
    // every supermarket looks like Netflix.
    if (spread > 0.2) continue

    // Without a recognisable billing rhythm it is repeat spending, not a
    // subscription the user could cancel.
    if (cadence === "irregular") continue

    let confidence = 1 - Math.min(1, spread * 1.5) * 0.5 - Math.min(1, gapSpread) * 0.35
    confidence = Math.max(0, Math.min(1, confidence + Math.min(sorted.length, 6) * 0.03))
    if (confidence < 0.5) continue

    const last = sorted[sorted.length - 1]
    const nextExpectedDate = toIsoDate(
      new Date(fromIsoDate(last.date).getTime() + medGap * 86_400_000),
    )

    results.push({
      payee,
      amount: med,
      cadence,
      occurrences: sorted.length,
      lastDate: last.date,
      nextExpectedDate,
      categoryId: last.categoryId,
      confidence: Math.round(confidence * 100) / 100,
      annualCost: med * (CADENCE_PER_YEAR[cadence] || sorted.length),
    })
  }

  return results.sort((a, b) => b.annualCost - a.annualCost)
}

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

/**
 * Heuristics that need no model: exact duplicates, amounts far above a payee's
 * own history, large first-time payees, and missing categories.
 */
export function detectAnomalies(
  transactions: Transaction[],
  options: { spikeMultiplier?: number; largeAmount?: number } = {},
): Anomaly[] {
  const spikeMultiplier = options.spikeMultiplier ?? 3
  const largeAmount = options.largeAmount ?? 20_000 // €200
  const anomalies: Anomaly[] = []

  // 1. Exact duplicates: same day, same amount, same normalized payee.
  const dupeKeys = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (t.isTransfer) continue
    const key = `${t.date}|${t.amount}|${normalizePayee(t.payee)}`
    const list = dupeKeys.get(key)
    if (list) list.push(t)
    else dupeKeys.set(key, [t])
  }
  for (const [, rows] of dupeKeys) {
    if (rows.length < 2) continue
    anomalies.push({
      id: `dup-${rows[0].id}`,
      kind: "duplicate",
      severity: "high",
      transactionIds: rows.map((r) => r.id),
      title: `Possible duplicate: ${rows[0].payee}`,
      description: `${rows.length} identical charges on ${rows[0].date}. One may have been recorded twice.`,
      amount: Math.abs(rows[0].amount) * (rows.length - 1),
    })
  }

  // 2. Amount spikes vs the payee's own median.
  const byPayee = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (t.amount >= 0 || t.isTransfer) continue
    const key = normalizePayee(t.payee)
    const list = byPayee.get(key)
    if (list) list.push(t)
    else byPayee.set(key, [t])
  }
  for (const [payee, rows] of byPayee) {
    if (rows.length < 4) continue
    const amounts = rows.map((r) => Math.abs(r.amount))
    const med = median(amounts)
    if (med <= 0) continue
    for (const t of rows) {
      const amount = Math.abs(t.amount)
      if (amount > med * spikeMultiplier && amount - med > 2_000) {
        anomalies.push({
          id: `spike-${t.id}`,
          kind: "amount_spike",
          severity: amount > med * spikeMultiplier * 2 ? "high" : "medium",
          transactionIds: [t.id],
          title: `Unusual amount at ${t.payee}`,
          description: `This charge is ${(amount / med).toFixed(1)}× the typical ${payee} amount.`,
          amount: amount - med,
        })
      }
    }
  }

  // 3. Large charges from a payee seen only once.
  for (const [, rows] of byPayee) {
    if (rows.length !== 1) continue
    const t = rows[0]
    if (Math.abs(t.amount) >= largeAmount) {
      anomalies.push({
        id: `new-${t.id}`,
        kind: "new_payee_large",
        severity: "medium",
        transactionIds: [t.id],
        title: `Large first-time charge: ${t.payee}`,
        description: "A sizeable payment to a payee with no prior history.",
        amount: Math.abs(t.amount),
      })
    }
  }

  // 4. Uncategorized spend, rolled into one actionable item.
  const uncategorized = transactions.filter((t) => !t.categoryId && !t.isTransfer && t.amount < 0)
  if (uncategorized.length) {
    anomalies.push({
      id: "uncategorized",
      kind: "uncategorized",
      severity: uncategorized.length > 10 ? "medium" : "low",
      transactionIds: uncategorized.map((t) => t.id),
      title: `${uncategorized.length} uncategorized transaction${uncategorized.length === 1 ? "" : "s"}`,
      description: "Categorize these so budgets and reports stay accurate.",
      amount: Math.abs(uncategorized.reduce((s, t) => s + t.amount, 0)),
    })
  }

  const severityRank = { high: 0, medium: 1, low: 2 }
  return anomalies.sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || b.amount - a.amount,
  )
}

// ---------------------------------------------------------------------------
// Heuristic categorization (offline fallback for the AI categorizer)
// ---------------------------------------------------------------------------

const KEYWORD_HINTS: { pattern: RegExp; category: string; confidence: number }[] = [
  { pattern: /carrefour|leclerc|lidl|monoprix|franprix|auchan|intermarch|casino|picard|grocer/i, category: "Groceries", confidence: 0.94 },
  { pattern: /uber\s?eats|deliveroo|just\s?eat|restaurant|brasserie|boulangerie|cafe|starbucks|mcdo|burger/i, category: "Restaurants", confidence: 0.9 },
  { pattern: /uber(?!\s?eats)|bolt|taxi|ratp|sncf|navigo|blablacar|trainline|velib/i, category: "Transport", confidence: 0.92 },
  { pattern: /total|shell|esso|bp\b|station|essence|fuel|petrol/i, category: "Fuel", confidence: 0.9 },
  { pattern: /netflix|spotify|disney|canal|prime\s?video|deezer|apple\s?(music|tv)|youtube\s?premium|audible|icloud|dropbox|notion|figma/i, category: "Subscriptions", confidence: 0.95 },
  { pattern: /orange|sfr|bouygues|free\s?mobile|sosh|telecom|mobile/i, category: "Phone & Internet", confidence: 0.9 },
  { pattern: /edf|engie|veolia|suez|total\s?energies|electricit|gaz\b/i, category: "Utilities", confidence: 0.92 },
  { pattern: /loyer|rent|foncia|nexity|syndic/i, category: "Rent", confidence: 0.95 },
  { pattern: /pharmacie|doctolib|medecin|dentiste|hopital|mutuelle|opticien/i, category: "Health", confidence: 0.9 },
  { pattern: /decathlon|fnac|darty|amazon|zalando|zara|uniqlo|h&m|ikea|leroy\s?merlin/i, category: "Shopping", confidence: 0.82 },
  { pattern: /cinema|ugc|pathe|theatre|concert|museum|musee|spotify|steam|playstation|nintendo/i, category: "Entertainment", confidence: 0.85 },
  // `paie` must be a whole word — otherwise it matches "PAIEMENT" on card repayments.
  { pattern: /salaire|salary|\bpaie\b|payroll|virement\s?employeur/i, category: "Salary", confidence: 0.96 },
  { pattern: /freelance|facture\s?client|invoice|stripe|upwork|malt/i, category: "Freelance", confidence: 0.88 },
  { pattern: /assurance|axa|maif|macif|allianz|insurance/i, category: "Insurance", confidence: 0.9 },
  { pattern: /impot|taxe|urssaf|tax\b|tresor\s?public/i, category: "Taxes", confidence: 0.92 },
  { pattern: /coiffeur|salon|spa|beaute|sephora|nocibe/i, category: "Personal Care", confidence: 0.85 },
  { pattern: /ecole|creche|scolaire|university|udemy|coursera|formation/i, category: "Education", confidence: 0.85 },
  { pattern: /hotel|airbnb|booking|ryanair|easyjet|air\s?france|vol\b|flight/i, category: "Travel", confidence: 0.88 },
]

export interface HeuristicSuggestion {
  transactionId: string
  categoryId: string
  confidence: number
  reason: string
}

/**
 * Suggest categories without a model, in three passes:
 * 1. an identical payee already categorized by the user (strongest signal),
 * 2. keyword hints for well-known merchants,
 * 3. a same-payee majority vote across history.
 */
export function suggestCategoriesHeuristic(
  targets: Transaction[],
  history: Transaction[],
  categories: Category[],
): HeuristicSuggestion[] {
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))
  const payeeMemory = new Map<string, Map<string, number>>()

  for (const t of history) {
    if (!t.categoryId) continue
    const key = normalizePayee(t.payee)
    const votes = payeeMemory.get(key) ?? new Map<string, number>()
    votes.set(t.categoryId, (votes.get(t.categoryId) ?? 0) + 1)
    payeeMemory.set(key, votes)
  }

  const suggestions: HeuristicSuggestion[] = []

  for (const t of targets) {
    // Transfers are movements between the user's own accounts, not spending or
    // income — categorizing them would double-count in every report.
    if (t.categoryId || t.isTransfer) continue
    const key = normalizePayee(t.payee)

    const votes = payeeMemory.get(key)
    if (votes?.size) {
      const [categoryId, count] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]
      const total = [...votes.values()].reduce((s, v) => s + v, 0)
      suggestions.push({
        transactionId: t.id,
        categoryId,
        confidence: Math.min(0.98, 0.7 + (count / total) * 0.28),
        reason: `You categorized ${count} previous "${t.payee}" transaction${count === 1 ? "" : "s"} this way.`,
      })
      continue
    }

    const hint = KEYWORD_HINTS.find((h) => h.pattern.test(t.payee) || h.pattern.test(t.memo ?? ""))
    if (hint) {
      const category = byName.get(hint.category.toLowerCase())
      if (category && (category.kind === "expense") === t.amount < 0) {
        suggestions.push({
          transactionId: t.id,
          categoryId: category.id,
          confidence: hint.confidence,
          reason: `"${t.payee}" matches known ${hint.category.toLowerCase()} merchants.`,
        })
        continue
      }
    }

    // Fall back to the dominant category for similar amounts and direction.
    const direction = t.amount < 0 ? "expense" : "income"
    const similar = history.filter(
      (h) =>
        h.categoryId &&
        (h.amount < 0 ? "expense" : "income") === direction &&
        Math.abs(Math.abs(h.amount) - Math.abs(t.amount)) < 500,
    )
    if (similar.length >= 3) {
      const votes2 = new Map<string, number>()
      for (const s of similar) votes2.set(s.categoryId!, (votes2.get(s.categoryId!) ?? 0) + 1)
      const [categoryId, count] = [...votes2.entries()].sort((a, b) => b[1] - a[1])[0]
      if (count / similar.length > 0.5) {
        suggestions.push({
          transactionId: t.id,
          categoryId,
          confidence: 0.55,
          reason: "Similar amounts in your history usually land in this category.",
        })
      }
    }
  }

  return suggestions
}

/** Propose rules from payees the user has categorized consistently. */
export function proposeRulesFromHistory(
  transactions: Transaction[],
  categories: Category[],
  existingRules: Rule[],
  options: { minOccurrences?: number } = {},
): Omit<Rule, "id" | "createdAt" | "timesApplied">[] {
  const minOccurrences = options.minOccurrences ?? 3
  const groups = new Map<string, { categoryVotes: Map<string, number>; sample: string }>()

  for (const t of transactions) {
    if (!t.categoryId || t.isTransfer) continue
    const key = normalizePayee(t.payee)
    if (!key || key.length < 3) continue
    const entry = groups.get(key) ?? { categoryVotes: new Map<string, number>(), sample: t.payee }
    entry.categoryVotes.set(t.categoryId, (entry.categoryVotes.get(t.categoryId) ?? 0) + 1)
    groups.set(key, entry)
  }

  const categoryLookup = new Map(categories.map((c) => [c.id, c]))
  const covered = new Set(
    existingRules
      .filter((r) => r.match.kind === "payee_contains" && r.match.value)
      .map((r) => r.match.value!.toUpperCase()),
  )

  const proposals: Omit<Rule, "id" | "createdAt" | "timesApplied">[] = []

  for (const [key, entry] of groups) {
    if (covered.has(key)) continue
    const votes = [...entry.categoryVotes.entries()].sort((a, b) => b[1] - a[1])
    const [categoryId, count] = votes[0]
    const total = votes.reduce((s, [, v]) => s + v, 0)
    if (count < minOccurrences || count / total < 0.8) continue

    const category = categoryLookup.get(categoryId)
    if (!category) continue

    // Use the shortest distinctive token so the rule generalises.
    const token = key.split(" ").filter((w) => w.length >= 4)[0] ?? key
    proposals.push({
      name: `${entry.sample.trim()} → ${category.name}`,
      match: { kind: "payee_contains", value: token },
      setCategoryId: categoryId,
      setTags: [],
      priority: 100 + proposals.length,
      enabled: true,
      aiSuggested: true,
    })
  }

  return proposals.slice(0, 12)
}
