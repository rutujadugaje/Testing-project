/**
 * Deterministic sample dataset: 3 accounts, ~110 transactions across 4 months,
 * a French/EUR household with freelance income. Generated from a seeded PRNG so
 * every reload (and every screenshot) shows the same numbers.
 */

import { addDays, subMonths } from "date-fns"

import { toIsoDate, toIsoMonth } from "@/lib/finance/dates"
import { transactionHash } from "@/lib/finance/hash"
import { toMinor } from "@/lib/finance/money"
import type {
  Account,
  Budget,
  Category,
  Goal,
  Holding,
  Rule,
  Transaction,
} from "@/types/finance"

/** Mulberry32 — small, fast, deterministic. */
function createRng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = createRng(20260727)

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]
}

/** Random amount in whole cents between two major-unit bounds. */
function amountBetween(minMajor: number, maxMajor: number): number {
  return toMinor(Math.round((minMajor + rng() * (maxMajor - minMajor)) * 100) / 100)
}

const NOW = new Date(2026, 6, 27) // 27 Jul 2026 — matches the app's "today"
const MONTHS_BACK = 3

export const sampleAccounts: Account[] = [
  {
    id: "acc-courant",
    name: "Compte Courant",
    type: "checking",
    currency: "EUR",
    openingBalance: toMinor(1_240.55),
    color: "var(--chart-1)",
    institution: "BNP Paribas",
    reference: "••4417",
    archived: false,
    createdAt: "2024-01-12T09:00:00.000Z",
  },
  {
    id: "acc-livret",
    name: "Livret A",
    type: "savings",
    currency: "EUR",
    openingBalance: toMinor(8_600),
    color: "var(--chart-2)",
    institution: "BNP Paribas",
    reference: "••9021",
    archived: false,
    createdAt: "2024-01-12T09:05:00.000Z",
  },
  {
    id: "acc-visa",
    name: "Visa Premier",
    type: "credit",
    currency: "EUR",
    openingBalance: toMinor(-410.2),
    color: "var(--chart-4)",
    institution: "BNP Paribas",
    reference: "••7732",
    archived: false,
    createdAt: "2024-03-02T09:00:00.000Z",
  },
]

export const sampleCategories: Category[] = [
  // Income
  { id: "cat-salary", name: "Salary", icon: "Wallet", kind: "income", budgetable: false, color: "var(--chart-2)" },
  { id: "cat-freelance", name: "Freelance", icon: "Laptop", kind: "income", budgetable: false, color: "var(--chart-3)" },
  { id: "cat-interest", name: "Interest", icon: "PiggyBank", kind: "income", budgetable: false, color: "var(--chart-5)" },
  // Housing
  { id: "cat-rent", name: "Rent", icon: "Home", kind: "expense", budgetable: true, color: "var(--chart-1)" },
  { id: "cat-utilities", name: "Utilities", icon: "Zap", kind: "expense", budgetable: true, color: "var(--chart-4)" },
  { id: "cat-phone", name: "Phone & Internet", icon: "Wifi", kind: "expense", budgetable: true, color: "var(--chart-5)" },
  // Daily life
  { id: "cat-groceries", name: "Groceries", icon: "ShoppingCart", kind: "expense", budgetable: true, color: "var(--chart-2)" },
  { id: "cat-restaurants", name: "Restaurants", icon: "UtensilsCrossed", kind: "expense", budgetable: true, color: "var(--chart-3)" },
  { id: "cat-transport", name: "Transport", icon: "Train", kind: "expense", budgetable: true, color: "var(--chart-1)" },
  { id: "cat-fuel", name: "Fuel", icon: "Fuel", kind: "expense", budgetable: true, color: "var(--chart-4)" },
  // Lifestyle
  { id: "cat-subscriptions", name: "Subscriptions", icon: "Repeat", kind: "expense", budgetable: true, color: "var(--chart-5)" },
  { id: "cat-entertainment", name: "Entertainment", icon: "Clapperboard", kind: "expense", budgetable: true, color: "var(--chart-3)" },
  { id: "cat-shopping", name: "Shopping", icon: "ShoppingBag", kind: "expense", budgetable: true, color: "var(--chart-2)" },
  { id: "cat-personal", name: "Personal Care", icon: "Scissors", kind: "expense", budgetable: true, color: "var(--chart-4)" },
  { id: "cat-travel", name: "Travel", icon: "Plane", kind: "expense", budgetable: true, color: "var(--chart-1)" },
  // Obligations
  { id: "cat-health", name: "Health", icon: "HeartPulse", kind: "expense", budgetable: true, color: "var(--chart-5)" },
  { id: "cat-insurance", name: "Insurance", icon: "ShieldCheck", kind: "expense", budgetable: true, color: "var(--chart-3)" },
  { id: "cat-taxes", name: "Taxes", icon: "Landmark", kind: "expense", budgetable: true, color: "var(--chart-4)" },
  { id: "cat-education", name: "Education", icon: "GraduationCap", kind: "expense", budgetable: true, color: "var(--chart-2)" },
  { id: "cat-savings", name: "Savings", icon: "PiggyBank", kind: "transfer", budgetable: false, color: "var(--chart-2)" },
]

const GROCERY_PAYEES = [
  "CARREFOUR MARKET PARIS 11",
  "MONOPRIX BASTILLE",
  "FRANPRIX RUE DE CHARONNE",
  "LIDL MONTREUIL",
  "PICARD SURGELES",
  "BIOCOOP LEDRU",
] as const

const RESTAURANT_PAYEES = [
  "LE PETIT CAMBODGE",
  "BOULANGERIE UTOPIE",
  "CAFE OBERKAMPF",
  "UBER EATS",
  "DELIVEROO PARIS",
  "PIZZERIA POPOLARE",
  "BIG FERNAND",
] as const

const TRANSPORT_PAYEES = ["RATP NAVIGO", "SNCF CONNECT", "UBER BV", "BOLT EU", "VELIB METROPOLE"] as const
const SHOPPING_PAYEES = ["AMAZON EU SARL", "FNAC BASTILLE", "DECATHLON", "ZARA FRANCE", "IKEA PARIS", "LEROY MERLIN"] as const
const ENTERTAINMENT_PAYEES = ["UGC CINE CITE", "STEAM GAMES", "LE TRABENDO", "MUSEE PICASSO"] as const
const PERSONAL_PAYEES = ["SEPHORA", "COIFFEUR MARAIS", "PHARMACIE DE LA BASTILLE"] as const
const FUEL_PAYEES = ["TOTAL ENERGIES A6", "SHELL STATION IVRY"] as const

interface Draft {
  date: Date
  amount: number
  payee: string
  accountId: string
  categoryId?: string
  memo?: string
  tags?: string[]
  status?: Transaction["status"]
  isTransfer?: boolean
}

const drafts: Draft[] = []

/** Month index 0 = oldest. Anchored so the newest month is partially complete. */
for (let monthOffset = MONTHS_BACK; monthOffset >= 0; monthOffset--) {
  const monthStart = new Date(NOW.getFullYear(), NOW.getMonth() - monthOffset, 1)
  const isCurrentMonth = monthOffset === 0
  const daysInMonth = isCurrentMonth
    ? NOW.getDate()
    : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()

  const day = (d: number) => addDays(monthStart, Math.min(d, daysInMonth) - 1)

  // --- Recurring income ---
  drafts.push({
    date: day(27),
    amount: toMinor(3_180),
    payee: "VIREMENT SALAIRE ATELIER NOVA",
    accountId: "acc-courant",
    categoryId: "cat-salary",
    memo: "Monthly net salary",
    tags: ["income"],
  })

  // Freelance invoices land irregularly — the interesting cashflow signal.
  if (monthOffset !== 1) {
    drafts.push({
      date: day(monthOffset === 0 ? 12 : 8 + Math.floor(rng() * 10)),
      amount: amountBetween(680, 1_650),
      payee: "STRIPE PAYOUT ATELIER NOVA",
      accountId: "acc-courant",
      categoryId: "cat-freelance",
      memo: "Client invoice",
      tags: ["freelance"],
    })
  }

  // --- Recurring fixed costs ---
  drafts.push({
    date: day(3),
    amount: toMinor(-1_150),
    payee: "PRLV FONCIA LOYER",
    accountId: "acc-courant",
    categoryId: "cat-rent",
    memo: "Rent — 42 rue de Charonne",
    tags: ["fixed"],
  })
  drafts.push({
    date: day(5),
    amount: -amountBetween(74, 118),
    payee: "EDF ELECTRICITE",
    accountId: "acc-courant",
    categoryId: "cat-utilities",
    tags: ["fixed"],
  })
  drafts.push({
    date: day(6),
    amount: toMinor(-29.99),
    payee: "FREE MOBILE",
    accountId: "acc-courant",
    categoryId: "cat-phone",
    tags: ["fixed"],
  })
  drafts.push({
    date: day(6),
    amount: toMinor(-39.99),
    payee: "ORANGE FIBRE",
    accountId: "acc-courant",
    categoryId: "cat-phone",
    tags: ["fixed"],
  })
  drafts.push({
    date: day(10),
    amount: toMinor(-46.2),
    payee: "MAIF ASSURANCE HABITATION",
    accountId: "acc-courant",
    categoryId: "cat-insurance",
    tags: ["fixed"],
  })

  // --- Subscriptions (detectable, with one price rise) ---
  drafts.push({
    date: day(15),
    amount: toMinor(monthOffset <= 1 ? -19.99 : -15.49),
    payee: "NETFLIX.COM",
    accountId: "acc-visa",
    categoryId: "cat-subscriptions",
    memo: monthOffset <= 1 ? "Price increased" : undefined,
    tags: ["subscription"],
  })
  drafts.push({
    date: day(17),
    amount: toMinor(-10.99),
    payee: "SPOTIFY AB",
    accountId: "acc-visa",
    categoryId: "cat-subscriptions",
    tags: ["subscription"],
  })
  drafts.push({
    date: day(21),
    amount: toMinor(-11.99),
    payee: "ICLOUD+ APPLE",
    accountId: "acc-visa",
    categoryId: "cat-subscriptions",
    tags: ["subscription"],
  })
  drafts.push({
    date: day(23),
    amount: toMinor(-29.9),
    payee: "BASIC FIT CLUB",
    accountId: "acc-courant",
    categoryId: "cat-personal",
    tags: ["subscription"],
  })

  // --- Variable daily spend ---
  const groceryRuns = 7 + Math.floor(rng() * 3)
  for (let i = 0; i < groceryRuns; i++) {
    if (isCurrentMonth && (i * 3 + 2) > daysInMonth) break
    drafts.push({
      date: day(2 + i * 3 + Math.floor(rng() * 2)),
      amount: -amountBetween(18, 96),
      payee: pick(GROCERY_PAYEES),
      accountId: rng() > 0.3 ? "acc-courant" : "acc-visa",
      categoryId: "cat-groceries",
    })
  }

  const meals = 6 + Math.floor(rng() * 4)
  for (let i = 0; i < meals; i++) {
    if (isCurrentMonth && (i * 4 + 1) > daysInMonth) break
    drafts.push({
      date: day(1 + i * 4 + Math.floor(rng() * 3)),
      amount: -amountBetween(9.5, 68),
      payee: pick(RESTAURANT_PAYEES),
      accountId: rng() > 0.45 ? "acc-visa" : "acc-courant",
      categoryId: "cat-restaurants",
    })
  }

  drafts.push({
    date: day(2),
    amount: toMinor(-88.8),
    payee: "RATP NAVIGO MENSUEL",
    accountId: "acc-courant",
    categoryId: "cat-transport",
    tags: ["fixed"],
  })

  const rides = 2 + Math.floor(rng() * 4)
  for (let i = 0; i < rides; i++) {
    if (isCurrentMonth && (i * 6 + 4) > daysInMonth) break
    drafts.push({
      date: day(4 + i * 6),
      amount: -amountBetween(7.4, 34),
      payee: pick(TRANSPORT_PAYEES),
      accountId: "acc-visa",
      categoryId: "cat-transport",
    })
  }

  if (rng() > 0.4) {
    drafts.push({
      date: day(11 + Math.floor(rng() * 12)),
      amount: -amountBetween(48, 92),
      payee: pick(FUEL_PAYEES),
      accountId: "acc-visa",
      categoryId: "cat-fuel",
    })
  }

  const shoppingRuns = 1 + Math.floor(rng() * 3)
  for (let i = 0; i < shoppingRuns; i++) {
    if (isCurrentMonth && (i * 7 + 8) > daysInMonth) break
    drafts.push({
      date: day(8 + i * 7),
      amount: -amountBetween(21, 180),
      payee: pick(SHOPPING_PAYEES),
      accountId: "acc-visa",
      categoryId: "cat-shopping",
    })
  }

  if (rng() > 0.35) {
    drafts.push({
      date: day(13 + Math.floor(rng() * 10)),
      amount: -amountBetween(12, 62),
      payee: pick(ENTERTAINMENT_PAYEES),
      accountId: "acc-visa",
      categoryId: "cat-entertainment",
    })
  }
  if (rng() > 0.5) {
    drafts.push({
      date: day(9 + Math.floor(rng() * 14)),
      amount: -amountBetween(14, 78),
      payee: pick(PERSONAL_PAYEES),
      accountId: "acc-courant",
      categoryId: "cat-personal",
    })
  }

  // --- Savings transfer (paired) ---
  drafts.push({
    date: day(28),
    amount: toMinor(-350),
    payee: "VIREMENT LIVRET A",
    accountId: "acc-courant",
    categoryId: "cat-savings",
    memo: "Monthly savings",
    isTransfer: true,
  })
  drafts.push({
    date: day(28),
    amount: toMinor(350),
    payee: "VIREMENT DEPUIS COMPTE COURANT",
    accountId: "acc-livret",
    categoryId: "cat-savings",
    memo: "Monthly savings",
    isTransfer: true,
  })

  // --- Credit card repayment (paired) ---
  drafts.push({
    date: day(25),
    amount: toMinor(-420),
    payee: "REMBOURSEMENT VISA PREMIER",
    accountId: "acc-courant",
    isTransfer: true,
    memo: "Card balance payment",
  })
  drafts.push({
    date: day(25),
    amount: toMinor(420),
    payee: "PAIEMENT RECU COMPTE COURANT",
    accountId: "acc-visa",
    isTransfer: true,
    memo: "Card balance payment",
  })
}

// --- One-off events that give the AI something to actually find ---

// Quarterly tax payment
drafts.push({
  date: new Date(NOW.getFullYear(), NOW.getMonth() - 2, 16),
  amount: toMinor(-1_284),
  payee: "URSSAF COTISATIONS",
  accountId: "acc-courant",
  categoryId: "cat-taxes",
  memo: "Quarterly contribution",
  tags: ["tax"],
})

// Holiday: a genuine spending spike
drafts.push({
  date: new Date(NOW.getFullYear(), NOW.getMonth() - 1, 8),
  amount: toMinor(-642.3),
  payee: "AIR FRANCE",
  accountId: "acc-visa",
  categoryId: "cat-travel",
  memo: "Flights — Lisbon",
  tags: ["travel"],
})
drafts.push({
  date: new Date(NOW.getFullYear(), NOW.getMonth() - 1, 9),
  amount: toMinor(-388.5),
  payee: "AIRBNB PAYMENTS",
  accountId: "acc-visa",
  categoryId: "cat-travel",
  memo: "5 nights — Lisbon",
  tags: ["travel"],
})

// Duplicate charge — anomaly detection should catch this pair
const dupDate = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 19)
drafts.push({
  date: dupDate,
  amount: toMinor(-79.9),
  payee: "DECATHLON",
  accountId: "acc-visa",
  categoryId: "cat-shopping",
})
drafts.push({
  date: dupDate,
  amount: toMinor(-79.9),
  payee: "DECATHLON",
  accountId: "acc-visa",
  categoryId: "cat-shopping",
  memo: "Charged twice?",
})

// Amount spike at a familiar grocer
drafts.push({
  date: new Date(NOW.getFullYear(), NOW.getMonth(), 14),
  amount: toMinor(-412.75),
  payee: "CARREFOUR MARKET PARIS 11",
  accountId: "acc-courant",
  categoryId: "cat-groceries",
  memo: "Party supplies",
})

// Uncategorized rows so the AI categorizer has work to do on first run
const uncategorized: Draft[] = [
  { date: new Date(NOW.getFullYear(), NOW.getMonth(), 21), amount: toMinor(-54.2), payee: "SNCF CONNECT", accountId: "acc-visa" },
  { date: new Date(NOW.getFullYear(), NOW.getMonth(), 22), amount: toMinor(-23.9), payee: "UBER EATS", accountId: "acc-visa" },
  { date: new Date(NOW.getFullYear(), NOW.getMonth(), 23), amount: toMinor(-119), payee: "DOCTOLIB CONSULTATION", accountId: "acc-courant", memo: "Specialist visit" },
  { date: new Date(NOW.getFullYear(), NOW.getMonth(), 24), amount: toMinor(-41.6), payee: "MONOPRIX BASTILLE", accountId: "acc-courant" },
  { date: new Date(NOW.getFullYear(), NOW.getMonth(), 25), amount: toMinor(-8.5), payee: "BOULANGERIE UTOPIE", accountId: "acc-courant" },
  { date: new Date(NOW.getFullYear(), NOW.getMonth(), 25), amount: toMinor(-320), payee: "ATELIER MENUISERIE DUBOIS", accountId: "acc-courant", memo: "Custom shelving" },
  { date: new Date(NOW.getFullYear(), NOW.getMonth(), 26), amount: toMinor(-15.99), payee: "AUDIBLE FR", accountId: "acc-visa" },
  { date: new Date(NOW.getFullYear(), NOW.getMonth(), 26), amount: toMinor(-62.4), payee: "TOTAL ENERGIES A6", accountId: "acc-visa" },
]
drafts.push(...uncategorized)

// Interest on savings, twice a year
drafts.push({
  date: new Date(NOW.getFullYear(), 0, 31),
  amount: toMinor(64.8),
  payee: "INTERETS LIVRET A",
  accountId: "acc-livret",
  categoryId: "cat-interest",
})

// A couple of pending rows so status filters have something to show
drafts.push({
  date: addDays(NOW, -1),
  amount: toMinor(-34.9),
  payee: "FNAC BASTILLE",
  accountId: "acc-visa",
  categoryId: "cat-shopping",
  status: "pending",
})
drafts.push({
  date: NOW,
  amount: toMinor(-11.4),
  payee: "CAFE OBERKAMPF",
  accountId: "acc-courant",
  categoryId: "cat-restaurants",
  status: "pending",
})


export const sampleTransactions: Transaction[] = drafts
  .filter((d) => d.date <= NOW)
  .sort((a, b) => a.date.getTime() - b.date.getTime())
  .map((draft, index) => {
    const date = toIsoDate(draft.date)
    const createdAt = new Date(draft.date).toISOString()
    return {
      id: `txn-${String(index + 1).padStart(4, "0")}`,
      date,
      amount: draft.amount,
      currency: "EUR",
      accountId: draft.accountId,
      categoryId: draft.categoryId,
      payee: draft.payee,
      memo: draft.memo,
      tags: draft.tags ?? [],
      status: draft.status ?? "cleared",
      externalId: transactionHash(date, draft.amount, draft.payee),
      isTransfer: draft.isTransfer ?? false,
      createdAt,
      updatedAt: createdAt,
    } satisfies Transaction
  })

// Link the paired transfers now that ids exist.
for (const t of sampleTransactions) {
  if (!t.isTransfer || t.transferPairId) continue
  const pair = sampleTransactions.find(
    (o) => o.isTransfer && !o.transferPairId && o.id !== t.id && o.date === t.date && o.amount === -t.amount,
  )
  if (pair) {
    t.transferPairId = pair.id
    pair.transferPairId = t.id
  }
}

const thisMonth = toIsoMonth(NOW)
const lastMonth = toIsoMonth(subMonths(NOW, 1))

export const sampleBudgets: Budget[] = [
  { id: "bud-1", month: thisMonth, categoryId: "cat-groceries", limit: toMinor(600), rollover: false },
  { id: "bud-2", month: thisMonth, categoryId: "cat-restaurants", limit: toMinor(250), rollover: false, note: "Trying to cook more" },
  { id: "bud-3", month: thisMonth, categoryId: "cat-transport", limit: toMinor(160), rollover: false },
  { id: "bud-4", month: thisMonth, categoryId: "cat-shopping", limit: toMinor(200), rollover: true },
  { id: "bud-5", month: thisMonth, categoryId: "cat-subscriptions", limit: toMinor(60), rollover: false },
  { id: "bud-6", month: lastMonth, categoryId: "cat-groceries", limit: toMinor(600), rollover: false },
  { id: "bud-7", month: lastMonth, categoryId: "cat-restaurants", limit: toMinor(250), rollover: false },
]

export const sampleGoals: Goal[] = [
  {
    id: "goal-1",
    name: "Emergency fund",
    targetAmount: toMinor(12_000),
    currentAmount: toMinor(8_950),
    deadline: toIsoDate(new Date(NOW.getFullYear() + 1, 2, 31)),
    accountId: "acc-livret",
    status: "active",
    color: "var(--chart-2)",
    monthlyContribution: toMinor(350),
    createdAt: "2025-02-01T10:00:00.000Z",
  },
  {
    id: "goal-2",
    name: "Japan trip",
    targetAmount: toMinor(4_500),
    currentAmount: toMinor(1_280),
    deadline: toIsoDate(new Date(NOW.getFullYear() + 1, 8, 15)),
    status: "active",
    color: "var(--chart-3)",
    monthlyContribution: toMinor(200),
    createdAt: "2026-01-15T10:00:00.000Z",
  },
  {
    id: "goal-3",
    name: "New laptop",
    targetAmount: toMinor(2_400),
    currentAmount: toMinor(2_400),
    status: "completed",
    color: "var(--chart-5)",
    createdAt: "2025-09-01T10:00:00.000Z",
  },
]

export const sampleHoldings: Holding[] = [
  { id: "hold-1", symbol: "CW8", name: "Amundi MSCI World", quantity: 42, costBasis: toMinor(398.2), lastPrice: toMinor(441.75), accountId: "acc-livret", assetClass: "etf" },
  { id: "hold-2", symbol: "ESE", name: "BNP S&P 500", quantity: 18, costBasis: toMinor(21.4), lastPrice: toMinor(24.86), accountId: "acc-livret", assetClass: "etf" },
  { id: "hold-3", symbol: "AI.PA", name: "Air Liquide", quantity: 12, costBasis: toMinor(158.9), lastPrice: toMinor(172.3), accountId: "acc-livret", assetClass: "equity" },
  { id: "hold-4", symbol: "BTC", name: "Bitcoin", quantity: 0.15, costBasis: toMinor(38_400), lastPrice: toMinor(52_180), accountId: "acc-livret", assetClass: "crypto" },
]

export const sampleRules: Rule[] = [
  {
    id: "rule-1",
    name: "Carrefour → Groceries",
    match: { kind: "payee_contains", value: "CARREFOUR" },
    setCategoryId: "cat-groceries",
    setTags: [],
    priority: 10,
    enabled: true,
    timesApplied: 9,
    createdAt: "2025-06-01T10:00:00.000Z",
  },
  {
    id: "rule-2",
    name: "Netflix & Spotify → Subscriptions",
    match: { kind: "payee_regex", value: "netflix|spotify|icloud" },
    setCategoryId: "cat-subscriptions",
    setTags: ["subscription"],
    priority: 20,
    enabled: true,
    timesApplied: 12,
    createdAt: "2025-06-01T10:05:00.000Z",
  },
  {
    id: "rule-3",
    name: "Uber Eats → Restaurants",
    match: { kind: "payee_contains", value: "UBER EATS" },
    setCategoryId: "cat-restaurants",
    setTags: ["delivery"],
    priority: 30,
    enabled: true,
    timesApplied: 6,
    createdAt: "2025-07-11T10:00:00.000Z",
  },
]

/** Everything a fresh install needs. */
export const sampleData = {
  accounts: sampleAccounts,
  categories: sampleCategories,
  transactions: sampleTransactions,
  budgets: sampleBudgets,
  goals: sampleGoals,
  holdings: sampleHoldings,
  rules: sampleRules,
}

export type SampleData = typeof sampleData
