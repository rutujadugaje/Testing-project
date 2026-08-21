/**
 * The single source of truth for Finora's financial data.
 *
 * One store, persisted to localStorage, mutated through `immer` so reducers read
 * like plain imperative code. The agent's tools never touch this directly —
 * they go through `@/lib/ai/store-facade`, which keeps the mutation surface
 * small and auditable.
 */

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

import { sampleData } from "@/data/sample"
import { transactionHash } from "@/lib/finance/hash"
import { applyRules } from "@/lib/finance/calc"
import { todayIso } from "@/lib/finance/dates"
import type {
  Account,
  AppSettings,
  Budget,
  Category,
  Goal,
  Holding,
  ImportBatch,
  IsoMonth,
  Rule,
  Transaction,
} from "@/types/finance"

export const STORAGE_KEY = "finora.state.v1"

/** Re-exported so existing imports keep working. */
export { transactionHash }

/** Crypto-backed where available, with a deterministic fallback for older browsers. */
export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${rand}`
}


export const defaultSettings: AppSettings = {
  currency: "EUR",
  locale: "fr-FR",
  monthStartDay: 1,
  theme: "system",
  density: "comfortable",
  aiModel: import.meta.env.VITE_AI_MODEL ?? "gpt-4o-mini",
  aiBaseUrl: import.meta.env.VITE_AI_BASE_URL ?? "",
  aiApiKey: import.meta.env.VITE_AI_API_KEY ?? "",
  onboardingComplete: false,
}

export interface NewTransactionInput {
  date?: string
  amount: number
  accountId: string
  payee: string
  categoryId?: string
  memo?: string
  tags?: string[]
  status?: Transaction["status"]
  currency?: string
  isTransfer?: boolean
  externalId?: string
  importBatchId?: string
}

/** Field-level patch used by inline grid edits and by the agent. */
export type TransactionPatch = Partial<
  Pick<
    Transaction,
    | "date"
    | "amount"
    | "accountId"
    | "categoryId"
    | "payee"
    | "memo"
    | "tags"
    | "status"
    | "aiSuggestedCategoryId"
    | "aiConfidence"
    | "aiReason"
  >
>

interface FinanceState {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  goals: Goal[]
  holdings: Holding[]
  rules: Rule[]
  importBatches: ImportBatch[]
  settings: AppSettings
  /** Bumped on every dataset mutation so memoised selectors can invalidate. */
  revision: number
}

interface FinanceActions {
  // --- transactions ---
  addTransaction: (input: NewTransactionInput) => string
  addTransactions: (inputs: NewTransactionInput[]) => string[]
  updateTransaction: (id: string, patch: TransactionPatch) => void
  updateTransactions: (ids: string[], patch: TransactionPatch) => number
  deleteTransactions: (ids: string[]) => number
  /** Restore rows removed by an undoable delete. */
  restoreTransactions: (rows: Transaction[]) => void
  setCategoryForTransactions: (ids: string[], categoryId: string | undefined) => number
  addTagToTransactions: (ids: string[], tag: string) => number
  removeTagFromTransactions: (ids: string[], tag: string) => number
  /** Replace one transaction with weighted splits that sum to the original. */
  splitTransaction: (
    id: string,
    parts: { amount: number; categoryId?: string; memo?: string; tags?: string[] }[],
  ) => string[]
  /** Two mirrored transactions linked as a transfer. */
  createTransfer: (input: {
    fromAccountId: string
    toAccountId: string
    amount: number
    date?: string
    memo?: string
  }) => string[]

  // --- AI suggestion lifecycle ---
  setAiSuggestions: (
    suggestions: { transactionId: string; categoryId: string; confidence: number; reason: string }[],
  ) => void
  acceptAiSuggestions: (ids: string[]) => number
  rejectAiSuggestions: (ids: string[]) => number
  clearAiSuggestions: () => void

  // --- accounts / categories ---
  addAccount: (input: Omit<Account, "id" | "createdAt" | "archived"> & { archived?: boolean }) => string
  updateAccount: (id: string, patch: Partial<Omit<Account, "id">>) => void
  deleteAccount: (id: string) => void
  addCategory: (input: Omit<Category, "id">) => string
  updateCategory: (id: string, patch: Partial<Omit<Category, "id">>) => void
  deleteCategory: (id: string) => void

  // --- budgets ---
  upsertBudget: (input: Omit<Budget, "id"> & { id?: string }) => string
  deleteBudget: (id: string) => void
  /** Copy a month's budgets forward, skipping categories already budgeted. */
  copyBudgets: (fromMonth: IsoMonth, toMonth: IsoMonth) => number

  // --- goals ---
  addGoal: (input: Omit<Goal, "id" | "createdAt">) => string
  updateGoal: (id: string, patch: Partial<Omit<Goal, "id">>) => void
  deleteGoal: (id: string) => void
  contributeToGoal: (id: string, amount: number) => void

  // --- holdings ---
  addHolding: (input: Omit<Holding, "id">) => string
  updateHolding: (id: string, patch: Partial<Omit<Holding, "id">>) => void
  deleteHolding: (id: string) => void

  // --- rules ---
  addRule: (input: Omit<Rule, "id" | "createdAt" | "timesApplied">) => string
  updateRule: (id: string, patch: Partial<Omit<Rule, "id">>) => void
  deleteRule: (id: string) => void
  toggleRule: (id: string, enabled: boolean) => void
  /** Run enabled rules over transactions; returns how many rows changed. */
  runRules: (options?: { transactionIds?: string[]; overwrite?: boolean }) => number

  // --- imports ---
  recordImportBatch: (batch: Omit<ImportBatch, "id">) => string
  /** External ids already present, so the importer can flag duplicates. */
  knownExternalIds: () => Set<string>

  // --- settings / data management ---
  updateSettings: (patch: Partial<AppSettings>) => void
  resetData: (options?: { withSample?: boolean }) => void
  loadSampleData: () => void
  exportBackup: () => string
  importBackup: (json: string) => { ok: true } | { ok: false; error: string }
}

export type FinanceStore = FinanceState & FinanceActions

const emptyState: FinanceState = {
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  goals: [],
  holdings: [],
  rules: [],
  importBatches: [],
  settings: defaultSettings,
  revision: 0,
}

function seededState(): FinanceState {
  return {
    ...emptyState,
    accounts: structuredClone(sampleData.accounts),
    categories: structuredClone(sampleData.categories),
    transactions: structuredClone(sampleData.transactions),
    budgets: structuredClone(sampleData.budgets),
    goals: structuredClone(sampleData.goals),
    holdings: structuredClone(sampleData.holdings),
    rules: structuredClone(sampleData.rules),
    settings: { ...defaultSettings },
    revision: 1,
  }
}

function materialize(input: NewTransactionInput, currency: string): Transaction {
  const now = new Date().toISOString()
  const date = input.date ?? todayIso()
  return {
    id: newId("txn"),
    date,
    amount: input.amount,
    currency: input.currency ?? currency,
    accountId: input.accountId,
    categoryId: input.categoryId,
    payee: input.payee,
    memo: input.memo,
    tags: input.tags ?? [],
    status: input.status ?? "cleared",
    externalId: input.externalId ?? transactionHash(date, input.amount, input.payee),
    importBatchId: input.importBatchId,
    isTransfer: input.isTransfer ?? false,
    createdAt: now,
    updatedAt: now,
  }
}

export const useFinanceStore = create<FinanceStore>()(
  persist(
    immer((set, get) => ({
      ...seededState(),

      // ---------------------------------------------------------------- txns
      addTransaction: (input) => {
        const row = materialize(input, get().settings.currency)
        set((s) => {
          s.transactions.push(row)
          s.revision++
        })
        return row.id
      },

      addTransactions: (inputs) => {
        const currency = get().settings.currency
        const rows = inputs.map((i) => materialize(i, currency))
        set((s) => {
          s.transactions.push(...rows)
          s.revision++
        })
        return rows.map((r) => r.id)
      },

      updateTransaction: (id, patch) => {
        set((s) => {
          const row = s.transactions.find((t) => t.id === id)
          if (!row) return
          Object.assign(row, patch)
          row.updatedAt = new Date().toISOString()
          s.revision++
        })
      },

      updateTransactions: (ids, patch) => {
        const idSet = new Set(ids)
        let changed = 0
        set((s) => {
          const now = new Date().toISOString()
          for (const row of s.transactions) {
            if (!idSet.has(row.id)) continue
            Object.assign(row, patch)
            row.updatedAt = now
            changed++
          }
          if (changed) s.revision++
        })
        return changed
      },

      deleteTransactions: (ids) => {
        const idSet = new Set(ids)
        let removed = 0
        set((s) => {
          const before = s.transactions.length
          // Deleting one half of a transfer would corrupt the pair, so unlink
          // the surviving side rather than leaving a dangling reference.
          for (const row of s.transactions) {
            if (row.transferPairId && idSet.has(row.transferPairId) && !idSet.has(row.id)) {
              row.transferPairId = undefined
              row.isTransfer = false
            }
          }
          s.transactions = s.transactions.filter((t) => !idSet.has(t.id))
          removed = before - s.transactions.length
          if (removed) s.revision++
        })
        return removed
      },

      restoreTransactions: (rows) => {
        set((s) => {
          const existing = new Set(s.transactions.map((t) => t.id))
          for (const row of rows) if (!existing.has(row.id)) s.transactions.push(row)
          s.revision++
        })
      },

      setCategoryForTransactions: (ids, categoryId) =>
        get().updateTransactions(ids, {
          categoryId,
          aiSuggestedCategoryId: undefined,
          aiConfidence: undefined,
          aiReason: undefined,
        }),

      addTagToTransactions: (ids, tag) => {
        const clean = tag.trim()
        if (!clean) return 0
        const idSet = new Set(ids)
        let changed = 0
        set((s) => {
          for (const row of s.transactions) {
            if (!idSet.has(row.id) || row.tags.includes(clean)) continue
            row.tags.push(clean)
            row.updatedAt = new Date().toISOString()
            changed++
          }
          if (changed) s.revision++
        })
        return changed
      },

      removeTagFromTransactions: (ids, tag) => {
        const idSet = new Set(ids)
        let changed = 0
        set((s) => {
          for (const row of s.transactions) {
            if (!idSet.has(row.id)) continue
            const next = row.tags.filter((t) => t !== tag)
            if (next.length !== row.tags.length) {
              row.tags = next
              changed++
            }
          }
          if (changed) s.revision++
        })
        return changed
      },

      splitTransaction: (id, parts) => {
        const original = get().transactions.find((t) => t.id === id)
        if (!original || !parts.length) return []
        const created: Transaction[] = parts.map((part, i) => ({
          ...structuredClone(original),
          id: newId("txn"),
          amount: part.amount,
          categoryId: part.categoryId ?? original.categoryId,
          memo: part.memo ?? original.memo,
          tags: part.tags ?? [...original.tags],
          // Keep the hash unique so a re-import does not treat splits as dupes.
          externalId: original.externalId ? `${original.externalId}-s${i + 1}` : undefined,
          aiSuggestedCategoryId: undefined,
          aiConfidence: undefined,
          aiReason: undefined,
          updatedAt: new Date().toISOString(),
        }))
        set((s) => {
          s.transactions = s.transactions.filter((t) => t.id !== id)
          s.transactions.push(...created)
          s.revision++
        })
        return created.map((c) => c.id)
      },

      createTransfer: ({ fromAccountId, toAccountId, amount, date, memo }) => {
        const currency = get().settings.currency
        const when = date ?? todayIso()
        const magnitude = Math.abs(amount)
        const accounts = get().accounts
        const fromName = accounts.find((a) => a.id === fromAccountId)?.name ?? "account"
        const toName = accounts.find((a) => a.id === toAccountId)?.name ?? "account"

        const out = materialize(
          { date: when, amount: -magnitude, accountId: fromAccountId, payee: `Transfer to ${toName}`, memo, isTransfer: true },
          currency,
        )
        const into = materialize(
          { date: when, amount: magnitude, accountId: toAccountId, payee: `Transfer from ${fromName}`, memo, isTransfer: true },
          currency,
        )
        out.transferPairId = into.id
        into.transferPairId = out.id

        set((s) => {
          s.transactions.push(out, into)
          s.revision++
        })
        return [out.id, into.id]
      },

      // ------------------------------------------------------- AI suggestions
      setAiSuggestions: (suggestions) => {
        const byId = new Map(suggestions.map((s) => [s.transactionId, s]))
        set((s) => {
          for (const row of s.transactions) {
            const suggestion = byId.get(row.id)
            if (!suggestion) continue
            row.aiSuggestedCategoryId = suggestion.categoryId
            row.aiConfidence = suggestion.confidence
            row.aiReason = suggestion.reason
          }
          s.revision++
        })
      },

      acceptAiSuggestions: (ids) => {
        const idSet = new Set(ids)
        let applied = 0
        set((s) => {
          const now = new Date().toISOString()
          for (const row of s.transactions) {
            if (!idSet.has(row.id) || !row.aiSuggestedCategoryId) continue
            row.categoryId = row.aiSuggestedCategoryId
            row.aiSuggestedCategoryId = undefined
            row.aiConfidence = undefined
            row.aiReason = undefined
            row.updatedAt = now
            applied++
          }
          if (applied) s.revision++
        })
        return applied
      },

      rejectAiSuggestions: (ids) => {
        const idSet = new Set(ids)
        let cleared = 0
        set((s) => {
          for (const row of s.transactions) {
            if (!idSet.has(row.id) || !row.aiSuggestedCategoryId) continue
            row.aiSuggestedCategoryId = undefined
            row.aiConfidence = undefined
            row.aiReason = undefined
            cleared++
          }
          if (cleared) s.revision++
        })
        return cleared
      },

      clearAiSuggestions: () => {
        set((s) => {
          for (const row of s.transactions) {
            row.aiSuggestedCategoryId = undefined
            row.aiConfidence = undefined
            row.aiReason = undefined
          }
          s.revision++
        })
      },

      // ------------------------------------------------------------ accounts
      addAccount: (input) => {
        const id = newId("acc")
        set((s) => {
          s.accounts.push({
            ...input,
            id,
            archived: input.archived ?? false,
            createdAt: new Date().toISOString(),
          })
          s.revision++
        })
        return id
      },

      updateAccount: (id, patch) => {
        set((s) => {
          const account = s.accounts.find((a) => a.id === id)
          if (account) Object.assign(account, patch)
          s.revision++
        })
      },

      deleteAccount: (id) => {
        set((s) => {
          s.accounts = s.accounts.filter((a) => a.id !== id)
          // Transactions cannot exist without an account, so they go too.
          s.transactions = s.transactions.filter((t) => t.accountId !== id)
          s.holdings = s.holdings.filter((h) => h.accountId !== id)
          s.revision++
        })
      },

      addCategory: (input) => {
        const id = newId("cat")
        set((s) => {
          s.categories.push({ ...input, id })
          s.revision++
        })
        return id
      },

      updateCategory: (id, patch) => {
        set((s) => {
          const category = s.categories.find((c) => c.id === id)
          if (category) Object.assign(category, patch)
          s.revision++
        })
      },

      deleteCategory: (id) => {
        set((s) => {
          s.categories = s.categories.filter((c) => c.id !== id)
          // Orphaned references become "uncategorized" rather than dangling.
          for (const t of s.transactions) {
            if (t.categoryId === id) t.categoryId = undefined
            if (t.aiSuggestedCategoryId === id) t.aiSuggestedCategoryId = undefined
          }
          s.budgets = s.budgets.filter((b) => b.categoryId !== id)
          for (const r of s.rules) if (r.setCategoryId === id) r.setCategoryId = undefined
          s.revision++
        })
      },

      // ------------------------------------------------------------- budgets
      upsertBudget: (input) => {
        const existing = get().budgets.find(
          (b) => b.month === input.month && b.categoryId === input.categoryId,
        )
        const id = input.id ?? existing?.id ?? newId("bud")
        set((s) => {
          const target = s.budgets.find((b) => b.id === id)
          if (target) Object.assign(target, input, { id })
          else s.budgets.push({ ...input, id })
          s.revision++
        })
        return id
      },

      deleteBudget: (id) => {
        set((s) => {
          s.budgets = s.budgets.filter((b) => b.id !== id)
          s.revision++
        })
      },

      copyBudgets: (fromMonth, toMonth) => {
        let copied = 0
        set((s) => {
          const source = s.budgets.filter((b) => b.month === fromMonth)
          const existing = new Set(
            s.budgets.filter((b) => b.month === toMonth).map((b) => b.categoryId),
          )
          for (const budget of source) {
            if (existing.has(budget.categoryId)) continue
            s.budgets.push({ ...budget, id: newId("bud"), month: toMonth })
            copied++
          }
          if (copied) s.revision++
        })
        return copied
      },

      // --------------------------------------------------------------- goals
      addGoal: (input) => {
        const id = newId("goal")
        set((s) => {
          s.goals.push({ ...input, id, createdAt: new Date().toISOString() })
          s.revision++
        })
        return id
      },

      updateGoal: (id, patch) => {
        set((s) => {
          const goal = s.goals.find((g) => g.id === id)
          if (!goal) return
          Object.assign(goal, patch)
          if (goal.currentAmount >= goal.targetAmount && goal.status === "active") {
            goal.status = "completed"
          }
          s.revision++
        })
      },

      deleteGoal: (id) => {
        set((s) => {
          s.goals = s.goals.filter((g) => g.id !== id)
          s.revision++
        })
      },

      contributeToGoal: (id, amount) => {
        set((s) => {
          const goal = s.goals.find((g) => g.id === id)
          if (!goal) return
          goal.currentAmount = Math.max(0, goal.currentAmount + amount)
          if (goal.currentAmount >= goal.targetAmount) goal.status = "completed"
          s.revision++
        })
      },

      // ------------------------------------------------------------ holdings
      addHolding: (input) => {
        const id = newId("hold")
        set((s) => {
          s.holdings.push({ ...input, id })
          s.revision++
        })
        return id
      },

      updateHolding: (id, patch) => {
        set((s) => {
          const holding = s.holdings.find((h) => h.id === id)
          if (holding) Object.assign(holding, patch)
          s.revision++
        })
      },

      deleteHolding: (id) => {
        set((s) => {
          s.holdings = s.holdings.filter((h) => h.id !== id)
          s.revision++
        })
      },

      // --------------------------------------------------------------- rules
      addRule: (input) => {
        const id = newId("rule")
        set((s) => {
          s.rules.push({ ...input, id, timesApplied: 0, createdAt: new Date().toISOString() })
          s.revision++
        })
        return id
      },

      updateRule: (id, patch) => {
        set((s) => {
          const rule = s.rules.find((r) => r.id === id)
          if (rule) Object.assign(rule, patch)
          s.revision++
        })
      },

      deleteRule: (id) => {
        set((s) => {
          s.rules = s.rules.filter((r) => r.id !== id)
          s.revision++
        })
      },

      toggleRule: (id, enabled) => {
        set((s) => {
          const rule = s.rules.find((r) => r.id === id)
          if (rule) rule.enabled = enabled
          s.revision++
        })
      },

      runRules: (options = {}) => {
        const state = get()
        const targets = options.transactionIds
          ? state.transactions.filter((t) => options.transactionIds!.includes(t.id))
          : state.transactions
        const applications = applyRules(state.rules, targets, { overwrite: options.overwrite })
        if (!applications.length) return 0

        set((s) => {
          const now = new Date().toISOString()
          const byRule = new Map<string, number>()
          for (const app of applications) {
            const row = s.transactions.find((t) => t.id === app.transactionId)
            if (!row) continue
            if (app.setCategoryId) row.categoryId = app.setCategoryId
            for (const tag of app.addTags) if (!row.tags.includes(tag)) row.tags.push(tag)
            row.updatedAt = now
            byRule.set(app.ruleId, (byRule.get(app.ruleId) ?? 0) + 1)
          }
          for (const rule of s.rules) {
            const hits = byRule.get(rule.id)
            if (hits) rule.timesApplied += hits
          }
          s.revision++
        })
        return applications.length
      },

      // ------------------------------------------------------------- imports
      recordImportBatch: (batch) => {
        const id = newId("imp")
        set((s) => {
          s.importBatches.unshift({ ...batch, id })
          s.revision++
        })
        return id
      },

      knownExternalIds: () => {
        const ids = new Set<string>()
        for (const t of get().transactions) if (t.externalId) ids.add(t.externalId)
        return ids
      },

      // ------------------------------------------------------------ settings
      updateSettings: (patch) => {
        set((s) => {
          Object.assign(s.settings, patch)
        })
      },

      resetData: (options = {}) => {
        const settings = get().settings
        const base = options.withSample ? seededState() : structuredClone(emptyState)
        set(() => ({
          ...base,
          // Preserve the user's preferences and API key across a data wipe.
          settings: { ...settings, onboardingComplete: settings.onboardingComplete },
          revision: base.revision + 1,
        }))
      },

      loadSampleData: () => {
        const settings = get().settings
        set(() => ({ ...seededState(), settings: { ...settings, onboardingComplete: true } }))
      },

      exportBackup: () => {
        const s = get()
        return JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            data: {
              accounts: s.accounts,
              categories: s.categories,
              transactions: s.transactions,
              budgets: s.budgets,
              goals: s.goals,
              holdings: s.holdings,
              rules: s.rules,
              importBatches: s.importBatches,
              settings: s.settings,
            },
          },
          null,
          2,
        )
      },

      importBackup: (json) => {
        try {
          const parsed = JSON.parse(json) as {
            data?: Partial<FinanceState>
          }
          const data = parsed.data ?? (parsed as unknown as Partial<FinanceState>)
          if (!Array.isArray(data.accounts) || !Array.isArray(data.transactions)) {
            return { ok: false, error: "Backup is missing accounts or transactions." }
          }
          set((s) => {
            s.accounts = data.accounts ?? []
            s.categories = data.categories ?? []
            s.transactions = data.transactions ?? []
            s.budgets = data.budgets ?? []
            s.goals = data.goals ?? []
            s.holdings = data.holdings ?? []
            s.rules = data.rules ?? []
            s.importBatches = data.importBatches ?? []
            if (data.settings) s.settings = { ...defaultSettings, ...data.settings }
            s.revision++
          })
          return { ok: true }
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "Invalid JSON." }
        }
      },
    })),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // The API key lives in localStorage only via explicit user action; keep
      // everything else so a refresh restores the full workspace.
      partialize: (state) => ({
        accounts: state.accounts,
        categories: state.categories,
        transactions: state.transactions,
        budgets: state.budgets,
        goals: state.goals,
        holdings: state.holdings,
        rules: state.rules,
        importBatches: state.importBatches,
        settings: state.settings,
        revision: state.revision,
      }),
    },
  ),
)
