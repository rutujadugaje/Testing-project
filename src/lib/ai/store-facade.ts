/**
 * The only door between the agent and the app's data.
 *
 * Tools never touch the zustand store directly. Everything funnels through this
 * facade so there is exactly one place to audit what the agent can read and
 * change, and so tool results come back as small, model-friendly shapes
 * (readable labels and major-unit strings) rather than raw internal records.
 */

import {
  accountBalances,
  budgetProgress,
  categoryBreakdown,
  detectAnomalies,
  detectSubscriptions,
  goalProjection,
  payeeBreakdown,
  proposeRulesFromHistory,
  queryTransactions,
  suggestBudgetLimit,
  suggestCategoriesHeuristic,
  summarize,
  totalNetWorth,
} from "@/lib/finance/calc"
import { monthRange, resolvePeriod, todayIso, toIsoMonth, type DateRange } from "@/lib/finance/dates"
import { formatMoney, splitAmount, toMinor } from "@/lib/finance/money"
import { useFinanceStore, type NewTransactionInput } from "@/stores/useFinanceStore"
import type {
  Account,
  Category,
  IsoDate,
  IsoMonth,
  Transaction,
  TransactionQuery,
} from "@/types/finance"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function snapshot() {
  return useFinanceStore.getState()
}

function money(minor: number): string {
  const { currency, locale } = snapshot().settings
  return formatMoney(minor, currency, locale)
}

function categoryName(id: string | undefined, categories: Category[]): string {
  if (!id) return "Uncategorized"
  return categories.find((c) => c.id === id)?.name ?? "Unknown"
}

function accountName(id: string, accounts: Account[]): string {
  return accounts.find((a) => a.id === id)?.name ?? "Unknown"
}

/**
 * Resolve a category from whatever the model produced — an id, an exact name,
 * or a near-miss like "groceries " / "Grocery". Prevents a hallucinated id from
 * silently writing garbage.
 */
export function resolveCategory(
  needle: string | undefined,
  categories: Category[],
): Category | undefined {
  if (!needle) return undefined
  const trimmed = needle.trim().toLowerCase()
  return (
    categories.find((c) => c.id === needle) ??
    categories.find((c) => c.name.toLowerCase() === trimmed) ??
    categories.find((c) => c.name.toLowerCase().startsWith(trimmed)) ??
    categories.find((c) => trimmed.length > 3 && c.name.toLowerCase().includes(trimmed))
  )
}

export function resolveAccount(
  needle: string | undefined,
  accounts: Account[],
): Account | undefined {
  if (!needle) return undefined
  const trimmed = needle.trim().toLowerCase()
  return (
    accounts.find((a) => a.id === needle) ??
    accounts.find((a) => a.name.toLowerCase() === trimmed) ??
    accounts.find((a) => a.name.toLowerCase().includes(trimmed))
  )
}

/**
 * Turn a loose period description into concrete dates. The model may pass a
 * preset ("this month"), an explicit from/to, or nothing at all.
 */
export function resolveRange(input?: {
  from?: string
  to?: string
  period?: string
}): DateRange {
  const { monthStartDay } = snapshot().settings
  if (input?.from && input?.to) return { from: input.from, to: input.to }

  const period = (input?.period ?? "month").toLowerCase()
  const today = new Date()

  if (/last\s*month|previous\s*month/.test(period)) {
    const month = toIsoMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1))
    return monthRange(month, monthStartDay)
  }
  if (/this\s*month|current\s*month|^month$/.test(period)) {
    return resolvePeriod("month", today, monthStartDay)
  }
  if (/week/.test(period)) return resolvePeriod("week", today, monthStartDay)
  if (/quarter/.test(period)) return resolvePeriod("quarter", today, monthStartDay)
  if (/year|ytd/.test(period)) return resolvePeriod("ytd", today, monthStartDay)
  if (/30|thirty/.test(period)) return resolvePeriod("last30", today, monthStartDay)
  if (/90|ninety|three\s*month/.test(period)) return resolvePeriod("last90", today, monthStartDay)
  if (/all|ever|everything/.test(period)) return resolvePeriod("all", today, monthStartDay)

  // `YYYY-MM` passed straight through.
  if (/^\d{4}-\d{2}$/.test(period)) return monthRange(period as IsoMonth, monthStartDay)

  return resolvePeriod("month", today, monthStartDay)
}

/** Compact per-transaction shape handed to the model. */
export interface TransactionSummary {
  id: string
  date: IsoDate
  payee: string
  amount: string
  amountMinor: number
  category: string
  account: string
  status: string
  tags: string[]
  memo?: string
}

function toSummary(
  t: Transaction,
  categories: Category[],
  accounts: Account[],
): TransactionSummary {
  return {
    id: t.id,
    date: t.date,
    payee: t.payee,
    amount: money(t.amount),
    amountMinor: t.amount,
    category: categoryName(t.categoryId, categories),
    account: accountName(t.accountId, accounts),
    status: t.status,
    tags: t.tags,
    memo: t.memo,
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const facade = {
  context() {
    const s = snapshot()
    return {
      today: todayIso(),
      currency: s.settings.currency,
      locale: s.settings.locale,
      accountCount: s.accounts.length,
      transactionCount: s.transactions.length,
      uncategorizedCount: s.transactions.filter((t) => !t.categoryId && !t.isTransfer).length,
    }
  },

  listAccounts(includeArchived = false) {
    const s = snapshot()
    const balances = accountBalances(s.accounts, s.transactions)
    const accounts = s.accounts
      .filter((a) => includeArchived || !a.archived)
      .map((a) => {
        const balance = balances.find((b) => b.accountId === a.id)
        return {
          id: a.id,
          name: a.name,
          type: a.type,
          institution: a.institution,
          balance: money(balance?.balance ?? 0),
          balanceMinor: balance?.balance ?? 0,
          pending: balance?.pendingBalance ? money(balance.pendingBalance) : undefined,
          transactionCount: balance?.transactionCount ?? 0,
          archived: a.archived,
        }
      })
    return {
      accounts,
      netWorth: money(totalNetWorth(s.accounts, s.transactions, s.holdings)),
    }
  },

  listCategories() {
    const s = snapshot()
    return {
      categories: s.categories.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        budgetable: c.budgetable,
      })),
    }
  },

  queryTransactions(input: TransactionQuery & { period?: string } = {}) {
    const s = snapshot()
    const { period, ...query } = input
    // A bare period (or nothing) still needs concrete bounds.
    const range = query.from && query.to ? undefined : resolveRange({ period, from: query.from, to: query.to })
    const effective: TransactionQuery = {
      ...query,
      from: query.from ?? range?.from,
      to: query.to ?? range?.to,
      limit: query.limit ?? 50,
    }

    const matched = queryTransactions(s.transactions, { ...effective, limit: undefined })
    const rows = matched.slice(0, effective.limit)
    const total = matched.reduce((sum, t) => sum + t.amount, 0)

    return {
      range: { from: effective.from, to: effective.to },
      matchCount: matched.length,
      returnedCount: rows.length,
      total: money(total),
      totalMinor: total,
      transactions: rows.map((t) => toSummary(t, s.categories, s.accounts)),
    }
  },

  runCashflowSummary(input: { from?: string; to?: string; period?: string } = {}) {
    const s = snapshot()
    const range = resolveRange(input)
    const result = summarize(s.transactions, s.categories, range)
    const inRange = queryTransactions(s.transactions, { from: range.from, to: range.to })

    return {
      range,
      income: money(result.income),
      expense: money(result.expense),
      net: money(result.net),
      savingsRate: `${Math.round(result.savingsRate * 100)}%`,
      transactionCount: result.transactionCount,
      topCategories: result.topCategories.map((c) => ({
        name: c.name,
        total: money(c.total),
        share: `${Math.round(c.share * 100)}%`,
        transactionCount: c.transactionCount,
      })),
      topPayees: payeeBreakdown(inRange, 5).map((p) => ({
        payee: p.payee,
        total: money(p.total),
        count: p.count,
      })),
    }
  },

  categoryBreakdown(input: { from?: string; to?: string; period?: string; direction?: "expense" | "income" } = {}) {
    const s = snapshot()
    const range = resolveRange(input)
    const rows = queryTransactions(s.transactions, { from: range.from, to: range.to })
    return {
      range,
      direction: input.direction ?? "expense",
      categories: categoryBreakdown(rows, s.categories, input.direction ?? "expense").map((c) => ({
        name: c.name,
        total: money(c.total),
        totalMinor: c.total,
        share: `${Math.round(c.share * 100)}%`,
        transactionCount: c.transactionCount,
      })),
    }
  },

  detectSubscriptions() {
    const s = snapshot()
    // Rent, taxes, utilities and insurance recur but are not cancellable subs.
    const excluded = s.categories
      .filter((c) => /rent|tax|utilit|insurance/i.test(c.name))
      .map((c) => c.id)
    const subs = detectSubscriptions(s.transactions, { excludeCategoryIds: excluded })
    const annualTotal = subs.reduce((sum, sub) => sum + sub.annualCost, 0)

    return {
      count: subs.length,
      annualTotal: money(annualTotal),
      monthlyEquivalent: money(Math.round(annualTotal / 12)),
      subscriptions: subs.map((sub) => ({
        payee: sub.payee,
        amount: money(sub.amount),
        cadence: sub.cadence,
        occurrences: sub.occurrences,
        lastDate: sub.lastDate,
        nextExpectedDate: sub.nextExpectedDate,
        annualCost: money(sub.annualCost),
        confidence: sub.confidence,
        category: categoryName(sub.categoryId, s.categories),
      })),
    }
  },

  detectAnomalies() {
    const s = snapshot()
    const anomalies = detectAnomalies(s.transactions)
    return {
      count: anomalies.length,
      anomalies: anomalies.slice(0, 12).map((a) => ({
        id: a.id,
        kind: a.kind,
        severity: a.severity,
        title: a.title,
        description: a.description,
        amount: money(a.amount),
        transactionIds: a.transactionIds.slice(0, 20),
        transactionCount: a.transactionIds.length,
      })),
    }
  },

  analyzeBudget(input: { month?: string } = {}) {
    const s = snapshot()
    const month = (input.month && /^\d{4}-\d{2}$/.test(input.month)
      ? input.month
      : toIsoMonth(new Date())) as IsoMonth
    const progress = budgetProgress(
      s.budgets,
      s.transactions,
      s.categories,
      month,
      s.settings.monthStartDay,
    )

    const range = monthRange(month, s.settings.monthStartDay)
    const spentByCategory = categoryBreakdown(
      queryTransactions(s.transactions, { from: range.from, to: range.to }),
      s.categories,
    )
    const budgetedIds = new Set(progress.map((p) => p.budget.categoryId))

    return {
      month,
      totalBudgeted: money(progress.reduce((sum, p) => sum + p.limit, 0)),
      totalSpent: money(progress.reduce((sum, p) => sum + p.spent, 0)),
      budgets: progress.map((p) => ({
        category: p.category?.name ?? "Unknown",
        categoryId: p.budget.categoryId,
        limit: money(p.limit),
        spent: money(p.spent),
        remaining: money(p.remaining),
        usage: `${Math.round(p.ratio * 100)}%`,
        state: p.state,
      })),
      overspent: progress.filter((p) => p.state === "over").map((p) => p.category?.name ?? "Unknown"),
      unbudgetedSpending: spentByCategory
        .filter((c) => c.categoryId !== "__uncategorized__" && !budgetedIds.has(c.categoryId))
        .slice(0, 6)
        .map((c) => ({
          category: c.name,
          categoryId: c.categoryId,
          spent: money(c.total),
          suggestedLimit: money(suggestBudgetLimit(s.transactions, c.categoryId, 3)),
        })),
    }
  },

  listGoals() {
    const s = snapshot()
    return {
      goals: s.goals.map((goal) => {
        const projection = goalProjection(goal)
        return {
          id: goal.id,
          name: goal.name,
          status: goal.status,
          target: money(goal.targetAmount),
          current: money(goal.currentAmount),
          remaining: money(projection.remaining),
          progress: `${Math.round(projection.ratio * 100)}%`,
          deadline: goal.deadline,
          monthsRemaining: projection.monthsRemaining,
          requiredMonthly: projection.requiredMonthly ? money(projection.requiredMonthly) : undefined,
          plannedMonthly: goal.monthlyContribution ? money(goal.monthlyContribution) : undefined,
          onTrack: projection.onTrack,
        }
      }),
    }
  },

  listBudgets(month?: string) {
    return facade.analyzeBudget({ month })
  },

  listRules() {
    const s = snapshot()
    return {
      rules: s.rules.map((r) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        match: r.match,
        setCategory: categoryName(r.setCategoryId, s.categories),
        setTags: r.setTags,
        priority: r.priority,
        timesApplied: r.timesApplied,
      })),
      proposals: proposeRulesFromHistory(s.transactions, s.categories, s.rules)
        .slice(0, 6)
        .map((p) => ({
          name: p.name,
          match: p.match,
          setCategory: categoryName(p.setCategoryId, s.categories),
        })),
    }
  },

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  createTransaction(input: {
    amount: number
    payee: string
    account?: string
    category?: string
    date?: string
    memo?: string
    tags?: string[]
    /** `amount` arrives in major units from the model; sign is derived from this. */
    direction?: "income" | "expense"
  }) {
    const s = snapshot()
    const account = resolveAccount(input.account, s.accounts) ?? s.accounts.find((a) => !a.archived)
    if (!account) return { ok: false as const, error: "No account available to book this against." }

    const category = resolveCategory(input.category, s.categories)
    const magnitude = Math.abs(toMinor(input.amount))
    const signed = input.direction === "income" ? magnitude : -magnitude

    const payload: NewTransactionInput = {
      amount: signed,
      payee: input.payee,
      accountId: account.id,
      categoryId: category?.id,
      date: input.date,
      memo: input.memo,
      tags: input.tags,
    }
    const id = s.addTransaction(payload)

    return {
      ok: true as const,
      id,
      created: {
        payee: input.payee,
        amount: money(signed),
        account: account.name,
        category: category?.name ?? "Uncategorized",
        date: payload.date ?? todayIso(),
      },
    }
  },

  updateTransactions(input: {
    ids: string[]
    category?: string
    payee?: string
    memo?: string
    status?: "cleared" | "pending" | "reconciled"
    addTags?: string[]
  }) {
    const s = snapshot()
    const patch: Parameters<typeof s.updateTransactions>[1] = {}

    if (input.category !== undefined) {
      const category = resolveCategory(input.category, s.categories)
      if (!category) {
        return {
          ok: false as const,
          error: `No category matches "${input.category}". Call listCategories first.`,
        }
      }
      patch.categoryId = category.id
      // Clear any stale AI suggestion once a real category is set.
      patch.aiSuggestedCategoryId = undefined
      patch.aiConfidence = undefined
      patch.aiReason = undefined
    }
    if (input.payee !== undefined) patch.payee = input.payee
    if (input.memo !== undefined) patch.memo = input.memo
    if (input.status !== undefined) patch.status = input.status

    const updated = Object.keys(patch).length ? s.updateTransactions(input.ids, patch) : 0
    let tagged = 0
    for (const tag of input.addTags ?? []) tagged += s.addTagToTransactions(input.ids, tag)

    return { ok: true as const, updated, tagged, requested: input.ids.length }
  },

  deleteTransactions(ids: string[]) {
    const s = snapshot()
    const doomed = s.transactions.filter((t) => ids.includes(t.id))
    const total = doomed.reduce((sum, t) => sum + t.amount, 0)
    const removed = s.deleteTransactions(ids)
    return {
      ok: true as const,
      removed,
      totalValue: money(total),
      payees: doomed.slice(0, 10).map((t) => t.payee),
    }
  },

  suggestCategories(input: { transactionIds?: string[]; limit?: number } = {}) {
    const s = snapshot()
    const targets = input.transactionIds?.length
      ? s.transactions.filter((t) => input.transactionIds!.includes(t.id))
      : s.transactions.filter((t) => !t.categoryId && !t.isTransfer)

    const capped = targets.slice(0, input.limit ?? 40)
    const suggestions = suggestCategoriesHeuristic(capped, s.transactions, s.categories)
    // Surface them in the grid so the user can accept or reject visually.
    s.setAiSuggestions(suggestions)

    return {
      considered: capped.length,
      suggested: suggestions.length,
      unmatched: capped.length - suggestions.length,
      suggestions: suggestions.map((sg) => {
        const t = s.transactions.find((x) => x.id === sg.transactionId)
        return {
          transactionId: sg.transactionId,
          payee: t?.payee ?? "",
          amount: t ? money(t.amount) : "",
          category: categoryName(sg.categoryId, s.categories),
          categoryId: sg.categoryId,
          confidence: sg.confidence,
          reason: sg.reason,
        }
      }),
    }
  },

  applyCategories(input: { transactionIds?: string[]; minConfidence?: number } = {}) {
    const s = snapshot()
    const min = input.minConfidence ?? 0
    const pending = s.transactions.filter(
      (t) =>
        t.aiSuggestedCategoryId &&
        (t.aiConfidence ?? 1) >= min &&
        (!input.transactionIds?.length || input.transactionIds.includes(t.id)),
    )
    const applied = s.acceptAiSuggestions(pending.map((t) => t.id))
    return { ok: true as const, applied, skipped: pending.length - applied }
  },

  createBudget(input: { category: string; limit?: number; month?: string; rollover?: boolean }) {
    const s = snapshot()
    const category = resolveCategory(input.category, s.categories)
    if (!category) {
      return { ok: false as const, error: `No category matches "${input.category}".` }
    }

    const month = (input.month && /^\d{4}-\d{2}$/.test(input.month)
      ? input.month
      : toIsoMonth(new Date())) as IsoMonth
    // No limit given? Fall back to the median of recent months.
    const limit =
      input.limit != null
        ? toMinor(input.limit)
        : suggestBudgetLimit(s.transactions, category.id, 3)

    if (limit <= 0) {
      return {
        ok: false as const,
        error: `No spending history for ${category.name}, so I cannot infer a limit. Ask the user for an amount.`,
      }
    }

    const id = s.upsertBudget({
      month,
      categoryId: category.id,
      limit,
      rollover: input.rollover ?? false,
    })
    return {
      ok: true as const,
      id,
      budget: { category: category.name, month, limit: money(limit), inferred: input.limit == null },
    }
  },

  createGoal(input: {
    name: string
    targetAmount: number
    currentAmount?: number
    deadline?: string
    monthlyContribution?: number
  }) {
    const s = snapshot()
    const id = s.addGoal({
      name: input.name,
      targetAmount: toMinor(input.targetAmount),
      currentAmount: toMinor(input.currentAmount ?? 0),
      deadline: input.deadline,
      monthlyContribution:
        input.monthlyContribution != null ? toMinor(input.monthlyContribution) : undefined,
      status: "active",
      color: "var(--chart-2)",
    })
    const goal = snapshot().goals.find((g) => g.id === id)
    const projection = goal ? goalProjection(goal) : undefined
    return {
      ok: true as const,
      id,
      goal: {
        name: input.name,
        target: money(toMinor(input.targetAmount)),
        requiredMonthly: projection?.requiredMonthly ? money(projection.requiredMonthly) : undefined,
      },
    }
  },

  updateGoalProgress(input: { goal: string; amount: number }) {
    const s = snapshot()
    const needle = input.goal.trim().toLowerCase()
    const goal =
      s.goals.find((g) => g.id === input.goal) ??
      s.goals.find((g) => g.name.toLowerCase() === needle) ??
      s.goals.find((g) => g.name.toLowerCase().includes(needle))
    if (!goal) return { ok: false as const, error: `No goal matches "${input.goal}".` }

    s.contributeToGoal(goal.id, toMinor(input.amount))
    const updated = snapshot().goals.find((g) => g.id === goal.id)!
    const projection = goalProjection(updated)
    return {
      ok: true as const,
      goal: {
        name: updated.name,
        current: money(updated.currentAmount),
        target: money(updated.targetAmount),
        progress: `${Math.round(projection.ratio * 100)}%`,
        completed: updated.status === "completed",
      },
    }
  },

  createRule(input: {
    name?: string
    matchKind?: "payee_contains" | "payee_regex" | "memo_contains" | "amount_range"
    value?: string
    minAmount?: number
    maxAmount?: number
    category?: string
    tags?: string[]
  }) {
    const s = snapshot()
    const category = resolveCategory(input.category, s.categories)
    if (input.category && !category) {
      return { ok: false as const, error: `No category matches "${input.category}".` }
    }

    const kind = input.matchKind ?? "payee_contains"
    if (kind === "payee_regex" && input.value) {
      try {
        new RegExp(input.value)
      } catch {
        return { ok: false as const, error: `"${input.value}" is not a valid regular expression.` }
      }
    }
    if (kind !== "amount_range" && !input.value) {
      return { ok: false as const, error: "A match value is required for this rule kind." }
    }

    const id = s.addRule({
      name: input.name ?? `${input.value ?? "Amount range"} → ${category?.name ?? "tag only"}`,
      match: {
        kind,
        value: input.value,
        min: input.minAmount != null ? toMinor(input.minAmount) : undefined,
        max: input.maxAmount != null ? toMinor(input.maxAmount) : undefined,
      },
      setCategoryId: category?.id,
      setTags: input.tags ?? [],
      priority: s.rules.length * 10 + 10,
      enabled: true,
      aiSuggested: true,
    })
    return { ok: true as const, id, appliedNow: s.runRules({ overwrite: false }) }
  },

  splitTransaction(input: {
    transactionId: string
    parts: { categoryOrName: string; weight: number; memo?: string }[]
  }) {
    const s = snapshot()
    const original = s.transactions.find((t) => t.id === input.transactionId)
    if (!original) return { ok: false as const, error: "Transaction not found." }
    if (!input.parts?.length) return { ok: false as const, error: "No split parts provided." }

    const resolved = input.parts.map((p) => ({
      category: resolveCategory(p.categoryOrName, s.categories),
      weight: p.weight,
      memo: p.memo,
      raw: p.categoryOrName,
    }))
    const missing = resolved.filter((p) => !p.category).map((p) => p.raw)
    if (missing.length) {
      return { ok: false as const, error: `Unknown categories: ${missing.join(", ")}.` }
    }

    // Weighted split that still sums exactly to the original amount.
    const amounts = splitAmount(original.amount, resolved.map((p) => p.weight))
    const ids = s.splitTransaction(
      input.transactionId,
      resolved.map((p, i) => ({ amount: amounts[i], categoryId: p.category!.id, memo: p.memo })),
    )

    return {
      ok: true as const,
      ids,
      parts: resolved.map((p, i) => ({ category: p.category!.name, amount: money(amounts[i]) })),
    }
  },

  exportSummaryMarkdown(input: { from?: string; to?: string; period?: string } = {}) {
    const s = snapshot()
    const range = resolveRange(input)
    const result = summarize(s.transactions, s.categories, range)
    const subs = facade.detectSubscriptions()
    const budgets = facade.analyzeBudget({})

    const lines = [
      `# Finora summary — ${range.from} to ${range.to}`,
      "",
      `- **Income:** ${money(result.income)}`,
      `- **Expenses:** ${money(result.expense)}`,
      `- **Net:** ${money(result.net)}`,
      `- **Savings rate:** ${Math.round(result.savingsRate * 100)}%`,
      `- **Transactions:** ${result.transactionCount}`,
      "",
      "## Top spending categories",
      ...result.topCategories.map(
        (c) => `- ${c.name}: ${money(c.total)} (${Math.round(c.share * 100)}%)`,
      ),
      "",
      "## Budgets",
      ...(budgets.budgets.length
        ? budgets.budgets.map((b) => `- ${b.category}: ${b.spent} of ${b.limit} (${b.usage}) — ${b.state}`)
        : ["- No budgets set."]),
      "",
      "## Subscriptions",
      `Detected ${subs.count}, costing ${subs.annualTotal} per year.`,
      ...subs.subscriptions.slice(0, 8).map((x) => `- ${x.payee}: ${x.amount} ${x.cadence}`),
    ]

    return { markdown: lines.join("\n"), range }
  },
}

export type FinanceFacade = typeof facade
