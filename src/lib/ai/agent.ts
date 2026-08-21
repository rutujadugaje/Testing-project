/**
 * The Finora finance agent.
 *
 * Runs entirely in the browser via AI SDK 7's `DirectChatTransport`, so there is
 * no server route to deploy. Swapping providers is one env var; with no key at
 * all we fall back to `FinoraLocalModel` so the product stays fully explorable.
 */

import { DirectChatTransport, ToolLoopAgent, stepCountIs, type InferAgentUIMessage } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

import { FinoraLocalModel } from "@/lib/ai/local-model"
import { financeTools } from "@/lib/ai/tools"
import { facade } from "@/lib/ai/store-facade"
import type { AppSettings } from "@/types/finance"

export interface ModelChoice {
  model: LanguageModel
  /** True when a real provider is configured. */
  live: boolean
  label: string
}

/**
 * Resolve the model from settings. Settings win over build-time env so the user
 * can paste a key at runtime without a rebuild.
 */
export function createFinanceModel(settings: Pick<AppSettings, "aiApiKey" | "aiBaseUrl" | "aiModel">): ModelChoice {
  const apiKey = settings.aiApiKey?.trim() || import.meta.env.VITE_AI_API_KEY?.trim() || ""
  const baseURL = settings.aiBaseUrl?.trim() || import.meta.env.VITE_AI_BASE_URL?.trim() || ""
  const modelId = settings.aiModel?.trim() || import.meta.env.VITE_AI_MODEL?.trim() || "gpt-4o-mini"

  if (!apiKey && !baseURL) {
    return {
      model: new FinoraLocalModel(),
      live: false,
      label: "Offline router",
    }
  }

  const provider = createOpenAI({
    apiKey: apiKey || "unused",
    ...(baseURL ? { baseURL } : {}),
    // Browser-side calls need this acknowledgement; the README explains the
    // production pattern of proxying through a server route instead.
    headers: { "x-finora-client": "browser" },
  })

  return { model: provider(modelId), live: true, label: modelId }
}

export const FINORA_SYSTEM_PROMPT = `You are the Finora finance agent — an expert personal finance assistant embedded in the user's own finance app.

You are not a chatbot that gives generic advice. You have tools that read and write the user's real financial data, and you are expected to use them. Never guess at a number you could look up.

## How to work

1. **Look before you answer.** Any question about the user's money starts with a tool call. "How am I doing?" means runCashflowSummary. "What do I spend on X?" means queryTransactions. Do not estimate from memory or from earlier turns if the data may have changed.
2. **Resolve names to ids.** Before categorizing or budgeting, call listCategories (or listAccounts) so you use categories and accounts that actually exist. Tools accept names as well as ids, but they will refuse a name that does not resolve — read the error and correct it rather than retrying blindly.
3. **Chain tools freely.** Real answers often need two or three calls: summarise, then break down, then look at specific rows. Do that in one turn rather than asking the user for permission to keep looking.
4. **Explain before destroying.** For anything that deletes or rewrites many rows, say exactly what you are about to change and how many rows are involved. Bulk updates and deletions are gated behind the user's approval — describe the change in plain language so the confirmation is meaningful.
5. **Report what you actually did.** After a mutation, state the real counts the tool returned ("categorized 7 of 16"), not what you hoped would happen. If a tool returned ok: false, say so plainly and suggest the fix.

## Style

- Lead with the answer, then the evidence. One or two sentences before any list.
- Use the currency-formatted strings the tools return verbatim. Do not reformat or recompute money.
- Be specific and quantitative: name the category, the payee, the amount, the percentage. "You spent 1 007 € on groceries, 68% over your 600 € budget" — never "you may be overspending".
- Markdown for structure: short bold labels, tight bullet lists. No headings in short replies.
- Keep it brief. Three bullets that name real numbers beat a paragraph of hedging.
- When you spot something genuinely actionable, say so once, concretely, and offer to do it. Do not moralise about spending habits and do not pad replies with disclaimers.

## Money conventions

- Amounts are in EUR by default and formatted for the user's locale by the tools.
- Expenses are negative, income positive. Transfers between the user's own accounts are neither — never count them as spending or income.
- When a tool asks for an amount, pass MAJOR units (12.34 for €12.34). The tools convert internally.

## Boundaries

- You cannot connect to banks, move real money, or file taxes. Say so directly if asked.
- Investment prices in this app are static mock values; never present them as live market data.
- If the user asks for something you have no tool for, say what you can do instead.`

/** Small facts about the workspace, so the agent starts oriented. */
export function buildRuntimeInstructions(context: {
  route: string
  selectedCount: number
  currency: string
  locale: string
}): string {
  const snapshot = facade.context()
  const lines = [
    FINORA_SYSTEM_PROMPT,
    "",
    "## Current workspace",
    `- Today: ${snapshot.today}`,
    `- Currency: ${context.currency}, locale: ${context.locale}`,
    `- ${snapshot.accountCount} accounts, ${snapshot.transactionCount} transactions`,
    `- ${snapshot.uncategorizedCount} transactions are uncategorized`,
    `- The user is looking at: ${context.route}`,
  ]
  if (context.selectedCount > 0) {
    lines.push(
      `- The user has ${context.selectedCount} transactions selected in the grid. If they say "these" or "the selected ones", they mean those rows.`,
    )
  }
  return lines.join("\n")
}

export interface CreateAgentOptions {
  settings: Pick<AppSettings, "aiApiKey" | "aiBaseUrl" | "aiModel" | "currency" | "locale">
  route: string
  selectedTransactionIds: string[]
}

export function createFinanceAgent(options: CreateAgentOptions) {
  const choice = createFinanceModel(options.settings)

  const agent = new ToolLoopAgent({
    id: "finora-finance-agent",
    model: choice.model,
    instructions: buildRuntimeInstructions({
      route: options.route,
      selectedCount: options.selectedTransactionIds.length,
      currency: options.settings.currency,
      locale: options.settings.locale,
    }),
    tools: financeTools,
    // Enough room to summarise, drill in, then act — without looping forever.
    stopWhen: stepCountIs(10),
    temperature: 0.3,
  })

  return { agent, live: choice.live, label: choice.label }
}

export type FinanceAgent = ReturnType<typeof createFinanceAgent>["agent"]
export type FinoraUIMessage = InferAgentUIMessage<FinanceAgent>

export function createFinanceTransport(options: CreateAgentOptions) {
  const { agent, live, label } = createFinanceAgent(options)
  return {
    transport: new DirectChatTransport<never, typeof financeTools>({ agent }),
    live,
    label,
  }
}
