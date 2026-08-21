/**
 * Finora domain model.
 *
 * Money is stored in **minor units** (integer cents) to avoid floating point
 * drift. A €12.34 expense is `-1234`. Income is positive, expense negative.
 * Use the helpers in `@/lib/finance/money` to format and parse.
 */

export type AccountType =
  | "checking"
  | "savings"
  | "credit"
  | "cash"
  | "investment"

export type CategoryKind = "income" | "expense" | "transfer"

export type TransactionStatus = "cleared" | "pending" | "reconciled"

export type GoalStatus = "active" | "paused" | "completed" | "archived"

export type RuleMatchKind = "payee_contains" | "payee_regex" | "amount_range" | "memo_contains"

/** ISO-4217 code. The app is EUR-first but formatting is locale driven. */
export type CurrencyCode = string

/** `YYYY-MM-DD` */
export type IsoDate = string
/** `YYYY-MM` */
export type IsoMonth = string

export interface Account {
  id: string
  name: string
  type: AccountType
  currency: CurrencyCode
  /** Opening balance in minor units. Live balance is derived from transactions. */
  openingBalance: number
  /** Tailwind/oklch-friendly token used for charts and avatars. */
  color: string
  institution?: string
  /** Last 4 digits or IBAN tail, display only. */
  reference?: string
  archived: boolean
  createdAt: string
}

export interface Category {
  id: string
  name: string
  parentId?: string
  /** lucide-react icon name, resolved through `@/lib/icons`. */
  icon: string
  kind: CategoryKind
  budgetable: boolean
  color: string
}

export interface Transaction {
  id: string
  date: IsoDate
  /** Signed minor units: income positive, expense negative. */
  amount: number
  currency: CurrencyCode
  accountId: string
  categoryId?: string
  payee: string
  memo?: string
  tags: string[]
  status: TransactionStatus
  /** Stable hash of date+amount+payee, used to dedupe imports. */
  externalId?: string
  importBatchId?: string
  /** Set by the AI categorizer; pending until accepted. */
  aiSuggestedCategoryId?: string
  aiConfidence?: number
  aiReason?: string
  isTransfer: boolean
  transferPairId?: string
  createdAt: string
  updatedAt: string
}

export interface Budget {
  id: string
  month: IsoMonth
  categoryId: string
  /** Positive minor units. */
  limit: number
  rollover: boolean
  note?: string
}

export interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline?: IsoDate
  accountId?: string
  status: GoalStatus
  color: string
  /** Monthly contribution the user intends to make, minor units. */
  monthlyContribution?: number
  createdAt: string
}

export interface Holding {
  id: string
  symbol: string
  name: string
  quantity: number
  /** Minor units, per share. */
  costBasis: number
  /** Minor units, per share. Static/mock — no live market data in v1. */
  lastPrice: number
  accountId: string
  assetClass: "equity" | "etf" | "bond" | "crypto" | "cash"
}

export interface RuleMatcher {
  kind: RuleMatchKind
  /** Free text for contains/regex kinds. */
  value?: string
  /** Inclusive bounds in minor units, for amount_range. */
  min?: number
  max?: number
}

export interface Rule {
  id: string
  name: string
  match: RuleMatcher
  setCategoryId?: string
  setTags: string[]
  priority: number
  enabled: boolean
  /** True when proposed by the agent and not yet confirmed by the user. */
  aiSuggested?: boolean
  timesApplied: number
  createdAt: string
}

export interface ImportColumnMapping {
  date?: string
  amount?: string
  /** Some banks split debit/credit into two columns. */
  debit?: string
  credit?: string
  payee?: string
  memo?: string
  category?: string
  /** Date parsing hint, e.g. `dd/MM/yyyy`. */
  dateFormat?: string
  /** `1 234,56` (fr) vs `1,234.56` (en). */
  decimalSeparator?: "," | "."
  /** Flip sign when a bank reports expenses as positive. */
  invertAmount?: boolean
}

export interface ImportBatch {
  id: string
  filename: string
  rowCount: number
  importedCount: number
  duplicateCount: number
  importedAt: string
  accountId: string
  mapping: ImportColumnMapping
}

export interface AppSettings {
  currency: CurrencyCode
  locale: string
  /** 1–28; supports salary-aligned budget months. */
  monthStartDay: number
  theme: "light" | "dark" | "system"
  density: "comfortable" | "compact"
  aiModel: string
  aiBaseUrl: string
  /** Stored locally only, never committed. Empty means offline agent. */
  aiApiKey: string
  onboardingComplete: boolean
}

// ---------------------------------------------------------------------------
// Derived / view models — computed by `@/lib/finance`, never persisted.
// ---------------------------------------------------------------------------

export interface AccountBalance {
  accountId: string
  /** openingBalance + sum(transactions) */
  balance: number
  clearedBalance: number
  pendingBalance: number
  transactionCount: number
}

export interface BudgetProgress {
  budget: Budget
  category: Category | undefined
  /** Positive minor units actually spent this month. */
  spent: number
  limit: number
  remaining: number
  /** 0–1+, can exceed 1 when overspent. */
  ratio: number
  state: "under" | "warning" | "over"
}

export interface CashflowPoint {
  /** Bucket label, already formatted for the axis. */
  label: string
  /** Bucket start, ISO date — used for sorting and tooltips. */
  date: IsoDate
  income: number
  expense: number
  net: number
  /** Running balance across all accounts at the end of the bucket. */
  balance: number
}

export interface CategoryBreakdownItem {
  categoryId: string
  name: string
  color: string
  /** Positive minor units. */
  total: number
  share: number
  transactionCount: number
}

export interface CashflowSummary {
  from: IsoDate
  to: IsoDate
  income: number
  expense: number
  net: number
  savingsRate: number
  transactionCount: number
  topCategories: CategoryBreakdownItem[]
}

export interface DetectedSubscription {
  payee: string
  /** Median absolute amount in minor units. */
  amount: number
  cadence: "weekly" | "monthly" | "quarterly" | "yearly" | "irregular"
  occurrences: number
  lastDate: IsoDate
  nextExpectedDate?: IsoDate
  categoryId?: string
  /** 0–1 heuristic confidence. */
  confidence: number
  /** Annualised cost, minor units. */
  annualCost: number
}

export type AnomalyKind =
  | "duplicate"
  | "amount_spike"
  | "new_payee_large"
  | "uncategorized"
  | "subscription_increase"

export interface Anomaly {
  id: string
  kind: AnomalyKind
  severity: "low" | "medium" | "high"
  transactionIds: string[]
  title: string
  description: string
  /** Minor units of money implicated, for sorting by impact. */
  amount: number
}

export interface CategorySuggestion {
  transactionId: string
  categoryId: string
  confidence: number
  reason: string
}

// ---------------------------------------------------------------------------
// Transaction querying — shared by the UI filters and the agent's tools so
// natural-language queries and clicked filters resolve identically.
// ---------------------------------------------------------------------------

export interface TransactionQuery {
  from?: IsoDate
  to?: IsoDate
  accountIds?: string[]
  categoryIds?: string[]
  /** Matches payee or memo, case-insensitive. */
  search?: string
  tags?: string[]
  status?: TransactionStatus[]
  /** Minor units, inclusive, compared against the signed amount. */
  minAmount?: number
  maxAmount?: number
  /** `expense` keeps amount < 0, `income` keeps amount > 0. */
  direction?: "income" | "expense" | "all"
  uncategorizedOnly?: boolean
  includeTransfers?: boolean
  limit?: number
  sort?: "date_desc" | "date_asc" | "amount_desc" | "amount_asc"
}

// ---------------------------------------------------------------------------
// Agent chat persistence
// ---------------------------------------------------------------------------

/** Runtime context handed to every tool call so the agent knows where it is. */
export interface AgentRuntimeContext {
  route: string
  currency: CurrencyCode
  locale: string
  today: IsoDate
  selectedTransactionIds: string[]
  dateRange?: { from: IsoDate; to: IsoDate }
}

export interface AgentThreadSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}
