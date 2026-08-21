/**
 * The agent's toolbelt.
 *
 * Every tool is a thin, typed wrapper over `facade` — descriptions are written
 * for the model (when to reach for it, what it returns), and the destructive
 * ones set `needsApproval` so the UI can gate them behind a confirm step.
 */

import { tool } from "ai"
import { z } from "zod"

import { facade } from "@/lib/ai/store-facade"

const periodSchema = z
  .string()
  .describe(
    'Natural period: "this month", "last month", "week", "quarter", "ytd", "last 30 days", "all", or a YYYY-MM month.',
  )
  .optional()

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .describe("Date as YYYY-MM-DD")

export const financeTools = {
  // ------------------------------------------------------------------ reads
  listAccounts: tool({
    description:
      "List the user's accounts with current balances and total net worth. Call this before creating a transaction or transfer so you use real account names.",
    inputSchema: z.object({
      includeArchived: z.boolean().optional().describe("Include archived accounts."),
    }),
    execute: async ({ includeArchived }) => facade.listAccounts(includeArchived ?? false),
  }),

  listCategories: tool({
    description:
      "List every category with its id, kind (income/expense/transfer) and whether it is budgetable. Call this before categorizing so you use categories that actually exist.",
    inputSchema: z.object({}),
    execute: async () => facade.listCategories(),
  }),

  queryTransactions: tool({
    description:
      "Search transactions with filters and get a total for the match. Use this to answer questions like 'what did I spend at Carrefour last month' or to collect ids before a bulk update.",
    inputSchema: z.object({
      period: periodSchema,
      from: isoDate.optional(),
      to: isoDate.optional(),
      search: z.string().optional().describe("Matches payee, memo or tags, case-insensitive."),
      categoryIds: z.array(z.string()).optional(),
      accountIds: z.array(z.string()).optional(),
      direction: z.enum(["income", "expense", "all"]).optional(),
      uncategorizedOnly: z.boolean().optional(),
      includeTransfers: z.boolean().optional().describe("Defaults to including transfers; set false to exclude internal movements."),
      minAmount: z.number().optional().describe("Signed amount in minor units (cents)."),
      maxAmount: z.number().optional().describe("Signed amount in minor units (cents)."),
      tags: z.array(z.string()).optional(),
      sort: z.enum(["date_desc", "date_asc", "amount_desc", "amount_asc"]).optional(),
      limit: z.number().int().min(1).max(200).optional().describe("Rows to return. Defaults to 50."),
    }),
    execute: async (input) => facade.queryTransactions(input),
  }),

  runCashflowSummary: tool({
    description:
      "Income, expenses, net, savings rate, top categories and top payees for a period. This is the right first call for 'how am I doing' or briefing questions.",
    inputSchema: z.object({ period: periodSchema, from: isoDate.optional(), to: isoDate.optional() }),
    execute: async (input) => facade.runCashflowSummary(input),
  }),

  categoryBreakdown: tool({
    description: "Spending or income broken down by category for a period, with each category's share of the total.",
    inputSchema: z.object({
      period: periodSchema,
      from: isoDate.optional(),
      to: isoDate.optional(),
      direction: z.enum(["expense", "income"]).optional(),
    }),
    execute: async (input) => facade.categoryBreakdown(input),
  }),

  detectSubscriptions: tool({
    description:
      "Find recurring charges that look like subscriptions, with cadence, confidence, next expected date and annualised cost. Rent, taxes, utilities and insurance are excluded because they are not cancellable subscriptions.",
    inputSchema: z.object({}),
    execute: async () => facade.detectSubscriptions(),
  }),

  detectAnomalies: tool({
    description:
      "Find duplicate charges, amounts far above a payee's own history, large first-time payees, and uncategorized spending. Use this for 'anything unusual?' questions.",
    inputSchema: z.object({}),
    execute: async () => facade.detectAnomalies(),
  }),

  analyzeBudget: tool({
    description:
      "Budget status for a month: limits, spend, remaining, which are overspent, plus categories with meaningful spend and no budget (each with a suggested limit).",
    inputSchema: z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("YYYY-MM. Defaults to the current month."),
    }),
    execute: async (input) => facade.analyzeBudget(input),
  }),

  listGoals: tool({
    description:
      "List savings goals with progress, deadline, months remaining, and the monthly contribution required to hit each one on time.",
    inputSchema: z.object({}),
    execute: async () => facade.listGoals(),
  }),

  listRules: tool({
    description:
      "List auto-categorization rules and any rules that could be inferred from how the user has categorized similar payees before.",
    inputSchema: z.object({}),
    execute: async () => facade.listRules(),
  }),

  // ----------------------------------------------------------------- writes
  createTransaction: tool({
    description:
      "Record a single new transaction. Amount is in MAJOR units (euros, not cents) and its sign comes from `direction`.",
    inputSchema: z.object({
      amount: z.number().positive().describe("Positive amount in major units, e.g. 12.34 for €12.34."),
      direction: z.enum(["income", "expense"]).describe("Expense makes it negative, income positive."),
      payee: z.string().min(1),
      account: z.string().optional().describe("Account name or id. Defaults to the first active account."),
      category: z.string().optional().describe("Category name or id."),
      date: isoDate.optional().describe("Defaults to today."),
      memo: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
    execute: async (input) => facade.createTransaction(input),
  }),

  updateTransactions: tool({
    description:
      "Update one or more transactions in place — set a category, rename a payee, change status or add tags. Get the ids from queryTransactions first. Ask the user before changing many rows at once.",
    inputSchema: z.object({
      ids: z.array(z.string()).min(1).describe("Transaction ids from queryTransactions."),
      category: z.string().optional().describe("Category name or id to assign."),
      payee: z.string().optional(),
      memo: z.string().optional(),
      status: z.enum(["cleared", "pending", "reconciled"]).optional(),
      addTags: z.array(z.string()).optional(),
    }),
    // Bulk edits are hard to eyeball afterwards, so the user confirms first.
    needsApproval: async ({ ids }) => ids.length > 5,
    execute: async (input) => facade.updateTransactions(input),
  }),

  deleteTransactions: tool({
    description:
      "Permanently delete transactions by id. Always explain exactly what will be deleted and get the user's agreement first.",
    inputSchema: z.object({ ids: z.array(z.string()).min(1) }),
    needsApproval: true,
    execute: async ({ ids }) => facade.deleteTransactions(ids),
  }),

  suggestCategories: tool({
    description:
      "Propose categories for uncategorized transactions, each with a confidence and a reason. Suggestions appear in the transactions grid for the user to accept or reject; call applyCategories to commit them.",
    inputSchema: z.object({
      transactionIds: z.array(z.string()).optional().describe("Defaults to all uncategorized transactions."),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    execute: async (input) => facade.suggestCategories(input),
  }),

  applyCategories: tool({
    description:
      "Commit pending category suggestions. Use minConfidence to only apply the confident ones.",
    inputSchema: z.object({
      transactionIds: z.array(z.string()).optional(),
      minConfidence: z.number().min(0).max(1).optional().describe("e.g. 0.8 to only apply strong matches."),
    }),
    needsApproval: async ({ transactionIds }) => !transactionIds?.length,
    execute: async (input) => facade.applyCategories(input),
  }),

  createBudget: tool({
    description:
      "Create or update a monthly budget for a category. Omit `limit` and a sensible limit is inferred from the median of the last three months.",
    inputSchema: z.object({
      category: z.string().describe("Category name or id."),
      limit: z.number().positive().optional().describe("Limit in MAJOR units. Omit to infer from history."),
      month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("YYYY-MM. Defaults to this month."),
      rollover: z.boolean().optional(),
    }),
    execute: async (input) => facade.createBudget(input),
  }),

  createGoal: tool({
    description: "Create a savings goal. Amounts are in MAJOR units.",
    inputSchema: z.object({
      name: z.string().min(1),
      targetAmount: z.number().positive().describe("Target in major units."),
      currentAmount: z.number().min(0).optional(),
      deadline: isoDate.optional(),
      monthlyContribution: z.number().positive().optional(),
    }),
    execute: async (input) => facade.createGoal(input),
  }),

  updateGoalProgress: tool({
    description: "Add (or subtract, with a negative amount) a contribution to a goal. Amount is in MAJOR units.",
    inputSchema: z.object({
      goal: z.string().describe("Goal name or id."),
      amount: z.number().describe("Contribution in major units. Negative to withdraw."),
    }),
    execute: async (input) => facade.updateGoalProgress(input),
  }),

  createRule: tool({
    description:
      "Create an auto-categorization rule so future matching transactions are categorized automatically. It runs immediately over existing transactions and reports how many it touched.",
    inputSchema: z.object({
      name: z.string().optional(),
      matchKind: z
        .enum(["payee_contains", "payee_regex", "memo_contains", "amount_range"])
        .optional()
        .describe("Defaults to payee_contains."),
      value: z.string().optional().describe("Text or regex to match. Required unless matchKind is amount_range."),
      minAmount: z.number().optional().describe("MAJOR units, for amount_range."),
      maxAmount: z.number().optional().describe("MAJOR units, for amount_range."),
      category: z.string().optional().describe("Category name or id to assign."),
      tags: z.array(z.string()).optional(),
    }),
    execute: async (input) => facade.createRule(input),
  }),

  splitTransaction: tool({
    description:
      "Split one transaction into weighted parts across categories, e.g. 80% Transport / 20% Restaurants. The parts always sum exactly to the original amount.",
    inputSchema: z.object({
      transactionId: z.string(),
      parts: z
        .array(
          z.object({
            categoryOrName: z.string().describe("Category name or id for this part."),
            weight: z.number().positive().describe("Relative weight, e.g. 80 and 20 for an 80/20 split."),
            memo: z.string().optional(),
          }),
        )
        .min(2),
    }),
    execute: async (input) => facade.splitTransaction(input),
  }),

  exportSummaryMarkdown: tool({
    description:
      "Produce a Markdown summary of a period covering cashflow, top categories, budgets and subscriptions — useful when the user asks for a report they can paste elsewhere.",
    inputSchema: z.object({ period: periodSchema, from: isoDate.optional(), to: isoDate.optional() }),
    execute: async (input) => facade.exportSummaryMarkdown(input),
  }),

  // ------------------------------------------------------------ navigation
  navigateTo: tool({
    description:
      "Send the user to a page in the app. Use it after doing work they will want to see, e.g. the grid after categorizing.",
    inputSchema: z.object({
      route: z
        .enum([
          "/",
          "/transactions",
          "/accounts",
          "/budgets",
          "/goals",
          "/investments",
          "/reports",
          "/rules",
          "/settings",
        ])
        .describe("Destination route."),
      reason: z.string().optional().describe("One short line on why, shown to the user."),
    }),
    // The UI performs the actual navigation when it sees this tool result.
    execute: async ({ route, reason }) => ({ navigate: route, reason }),
  }),
} as const

export type FinanceTools = typeof financeTools

/** Tool names the UI renders with a bespoke result card. */
export const TOOL_LABELS: Record<keyof FinanceTools, string> = {
  listAccounts: "Reading accounts",
  listCategories: "Reading categories",
  queryTransactions: "Searching transactions",
  runCashflowSummary: "Summarising cashflow",
  categoryBreakdown: "Breaking down categories",
  detectSubscriptions: "Finding subscriptions",
  detectAnomalies: "Checking for anomalies",
  analyzeBudget: "Analysing budgets",
  listGoals: "Reading goals",
  listRules: "Reading rules",
  createTransaction: "Adding a transaction",
  updateTransactions: "Updating transactions",
  deleteTransactions: "Deleting transactions",
  suggestCategories: "Suggesting categories",
  applyCategories: "Applying categories",
  createBudget: "Creating a budget",
  createGoal: "Creating a goal",
  updateGoalProgress: "Updating goal progress",
  createRule: "Creating a rule",
  splitTransaction: "Splitting a transaction",
  exportSummaryMarkdown: "Writing a summary",
  navigateTo: "Opening a page",
}
