/**
 * The offline agent.
 *
 * Finora ships without credentials, so with no API key configured we still want
 * every agent affordance to work end to end. This implements the same
 * `LanguageModelV4` interface a real provider does, but instead of calling a
 * model it reads the user's last message, picks the tools a competent assistant
 * would pick, and streams a reply built from the tool results.
 *
 * It is deliberately honest about what it is: an intent router, not a model. It
 * exists so the product is explorable and the tool contracts are exercised for
 * real — the moment a key is present, `createFinanceModel` returns the real
 * provider and this file is bypassed.
 */

import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from "@ai-sdk/provider"

const NO_USAGE: LanguageModelV4Usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
}

/** A tool the router wants to call, with its arguments. */
interface PlannedCall {
  toolName: string
  input: Record<string, unknown>
}

interface Plan {
  calls: PlannedCall[]
  /** Built from the tool results once they come back. */
  respond: (results: Record<string, unknown>[]) => string
}

// ---------------------------------------------------------------------------
// Reading the conversation
// ---------------------------------------------------------------------------

function lastUserText(options: LanguageModelV4CallOptions): string {
  for (let i = options.prompt.length - 1; i >= 0; i--) {
    const message = options.prompt[i]
    if (message.role !== "user") continue
    if (typeof message.content === "string") return message.content
    return message.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join(" ")
  }
  return ""
}

/** Tool outputs already in the transcript, so a second pass can summarise them. */
function collectToolResults(options: LanguageModelV4CallOptions): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = []
  for (const message of options.prompt) {
    if (message.role !== "tool" || typeof message.content === "string") continue
    for (const part of message.content) {
      if (part.type !== "tool-result") continue
      const output = part.output
      if (output && typeof output === "object" && "value" in output) {
        results.push({ toolName: part.toolName, value: (output as { value: unknown }).value })
      } else {
        results.push({ toolName: part.toolName, value: output })
      }
    }
  }
  return results
}

function value<T = Record<string, unknown>>(
  results: Record<string, unknown>[],
  toolName: string,
): T | undefined {
  const hit = results.find((r) => r.toolName === toolName)
  return hit?.value as T | undefined
}

// ---------------------------------------------------------------------------
// Intent routing
// ---------------------------------------------------------------------------

const has = (text: string, ...patterns: RegExp[]) => patterns.some((p) => p.test(text))

function planFor(text: string): Plan {
  const q = text.toLowerCase()

  // --- Subscriptions -------------------------------------------------------
  if (has(q, /subscript/, /recurring/, /\bsubs\b/, /cancel/)) {
    return {
      calls: [{ toolName: "detectSubscriptions", input: {} }],
      respond: (results) => {
        const data = value<{
          count: number
          annualTotal: string
          monthlyEquivalent: string
          subscriptions: { payee: string; amount: string; cadence: string; annualCost: string; confidence: number }[]
        }>(results, "detectSubscriptions")
        if (!data || data.count === 0) {
          return "I could not find any recurring charges that look like subscriptions. That usually means there is not enough history yet — subscriptions need at least three similar charges at a regular interval before I will call them recurring."
        }
        const top = data.subscriptions.slice(0, 6)
        const lines = top.map(
          (s) => `- **${s.payee}** — ${s.amount} ${s.cadence} (${s.annualCost}/year)`,
        )
        return [
          `I found **${data.count} recurring charges** costing **${data.annualTotal} a year**, about ${data.monthlyEquivalent} a month.`,
          "",
          ...lines,
          "",
          data.subscriptions.length > top.length
            ? `Plus ${data.subscriptions.length - top.length} smaller ones. `
            : "",
          "Rent, taxes, utilities and insurance are excluded here since they are not really cancellable. The biggest one is worth a look first — cancelling the top item alone would save " +
            `${top[0]?.annualCost ?? "—"} a year.`,
        ]
          .filter(Boolean)
          .join("\n")
      },
    }
  }

  // --- Anomalies -----------------------------------------------------------
  if (has(q, /anomal/, /unusual/, /duplicate/, /suspicious/, /weird/, /wrong/, /double.?charg/)) {
    return {
      calls: [{ toolName: "detectAnomalies", input: {} }],
      respond: (results) => {
        const data = value<{
          count: number
          anomalies: { severity: string; title: string; description: string; amount: string; transactionCount: number }[]
        }>(results, "detectAnomalies")
        if (!data || data.count === 0) return "Nothing looks out of place — no duplicates, no unusual amounts."
        const high = data.anomalies.filter((a) => a.severity === "high")
        const lines = data.anomalies
          .slice(0, 6)
          .map((a) => `- **${a.title}** (${a.amount}) — ${a.description}`)
        return [
          `I flagged **${data.count} things worth a look**${high.length ? `, ${high.length} of them high severity` : ""}:`,
          "",
          ...lines,
          "",
          "Duplicates are the ones to check first — if a charge really was taken twice, that is money you can claim back.",
        ].join("\n")
      },
    }
  }

  // --- Categorization ------------------------------------------------------
  if (has(q, /categor/, /uncategori/, /classify/, /tag them/)) {
    const apply = has(q, /apply/, /accept/, /just do it/, /go ahead/, /confirm/)
    return {
      calls: apply
        ? [
            { toolName: "suggestCategories", input: {} },
            { toolName: "applyCategories", input: { minConfidence: 0.8 } },
          ]
        : [{ toolName: "suggestCategories", input: {} }],
      respond: (results) => {
        const data = value<{
          considered: number
          suggested: number
          unmatched: number
          suggestions: { payee: string; amount: string; category: string; confidence: number; reason: string }[]
        }>(results, "suggestCategories")
        const applied = value<{ applied: number }>(results, "applyCategories")

        if (!data || data.considered === 0) {
          return "Everything is already categorized — nothing waiting for me."
        }
        if (data.suggested === 0) {
          return `I looked at ${data.considered} uncategorized transactions but could not match any confidently. These look like one-off payees with no history to learn from, so they are worth categorizing by hand — after which I can turn the pattern into a rule.`
        }

        const lines = data.suggestions
          .slice(0, 8)
          .map(
            (s) =>
              `- **${s.payee}** (${s.amount}) → ${s.category} · ${Math.round(s.confidence * 100)}% — ${s.reason}`,
          )
        return [
          applied
            ? `I categorized **${applied.applied} transactions** automatically (only the confident ones, above 80%).`
            : `I have suggestions for **${data.suggested} of ${data.considered}** uncategorized transactions:`,
          "",
          ...lines,
          "",
          data.unmatched > 0
            ? `${data.unmatched} still need a human eye — no similar history to learn from.`
            : "",
          applied
            ? "Have a look in the grid to check my work."
            : "They are showing in the transactions grid with a confidence badge, so you can accept or reject each one. Say “apply them” and I will commit the confident matches.",
        ]
          .filter(Boolean)
          .join("\n")
      },
    }
  }

  // --- Budgets -------------------------------------------------------------
  if (has(q, /budget/, /overspend/, /over budget/, /limit/)) {
    return {
      calls: [{ toolName: "analyzeBudget", input: {} }],
      respond: (results) => {
        const data = value<{
          month: string
          totalBudgeted: string
          totalSpent: string
          budgets: { category: string; limit: string; spent: string; remaining: string; usage: string; state: string }[]
          overspent: string[]
          unbudgetedSpending: { category: string; spent: string; suggestedLimit: string }[]
        }>(results, "analyzeBudget")
        if (!data || data.budgets.length === 0) {
          return "You do not have any budgets set yet. Tell me a category and I will set one — or say “budget my top categories” and I will infer limits from your last three months."
        }
        const lines = data.budgets.map(
          (b) =>
            `- **${b.category}** — ${b.spent} of ${b.limit} (${b.usage})${b.state === "over" ? " ⚠️ over" : b.state === "warning" ? " · close to the limit" : ""}`,
        )
        const parts = [
          `For ${data.month} you have budgeted ${data.totalBudgeted} and spent ${data.totalSpent}.`,
          "",
          ...lines,
        ]
        if (data.overspent.length) {
          parts.push(
            "",
            `**${data.overspent.join(" and ")}** ${data.overspent.length === 1 ? "is" : "are"} over the limit. Worth checking whether that was a one-off or the budget is simply set too low.`,
          )
        }
        if (data.unbudgetedSpending.length) {
          parts.push(
            "",
            "You are also spending in categories with no budget:",
            ...data.unbudgetedSpending
              .slice(0, 3)
              .map((u) => `- ${u.category} — ${u.spent} so far (I would suggest ${u.suggestedLimit})`),
          )
        }
        return parts.join("\n")
      },
    }
  }

  // --- Goals ---------------------------------------------------------------
  if (has(q, /goal/, /saving for/, /target/, /emergency fund/)) {
    return {
      calls: [{ toolName: "listGoals", input: {} }],
      respond: (results) => {
        const data = value<{
          goals: {
            name: string
            status: string
            current: string
            target: string
            progress: string
            deadline?: string
            requiredMonthly?: string
            plannedMonthly?: string
            onTrack: boolean
          }[]
        }>(results, "listGoals")
        if (!data || data.goals.length === 0) {
          return "No goals yet. Tell me what you are saving for and by when, and I will set it up with the monthly contribution you would need."
        }
        const lines = data.goals.map((g) => {
          const bits = [`- **${g.name}** — ${g.current} of ${g.target} (${g.progress})`]
          if (g.status === "completed") bits.push(" ✅ done")
          else if (g.requiredMonthly)
            bits.push(
              ` · needs ${g.requiredMonthly}/month${g.plannedMonthly ? `, you are putting in ${g.plannedMonthly}` : ""}${g.onTrack ? " — on track" : " — behind"}`,
            )
          return bits.join("")
        })
        const behind = data.goals.filter((g) => g.status === "active" && !g.onTrack)
        return [
          ...lines,
          "",
          behind.length
            ? `${behind.map((g) => g.name).join(" and ")} ${behind.length === 1 ? "is" : "are"} behind schedule — either raise the monthly contribution or push the deadline out.`
            : "All active goals are on track at your current contribution rate.",
        ].join("\n")
      },
    }
  }

  // --- Rules ---------------------------------------------------------------
  if (has(q, /\brule/, /automat/, /auto.?categor/)) {
    return {
      calls: [{ toolName: "listRules", input: {} }],
      respond: (results) => {
        const data = value<{
          rules: { name: string; enabled: boolean; timesApplied: number; setCategory: string }[]
          proposals: { name: string; setCategory: string }[]
        }>(results, "listRules")
        if (!data) return "I could not read your rules."
        const parts: string[] = []
        if (data.rules.length) {
          parts.push(
            `You have **${data.rules.length} rules**:`,
            "",
            ...data.rules.map(
              (r) => `- ${r.name}${r.enabled ? "" : " (disabled)"} — applied ${r.timesApplied}×`,
            ),
          )
        } else {
          parts.push("You have no rules yet.")
        }
        if (data.proposals.length) {
          parts.push(
            "",
            `I can infer **${data.proposals.length} more** from how you have categorized things before:`,
            "",
            ...data.proposals.slice(0, 5).map((p) => `- ${p.name}`),
            "",
            "Say the word and I will create them.",
          )
        }
        return parts.join("\n")
      },
    }
  }

  // --- Saving advice -------------------------------------------------------
  // Checked before the breakdown branch: "where can I save money" contains
  // "where" + "money" and would otherwise be swallowed by it.
  if (has(q, /save money/, /\bcut\b/, /reduce/, /advice/, /help me save/, /spend less/, /where can i save/)) {
    return {
      calls: [
        { toolName: "runCashflowSummary", input: {} },
        { toolName: "detectSubscriptions", input: {} },
      ],
      respond: (results) => {
        const summary = value<{
          income: string
          expense: string
          net: string
          savingsRate: string
          topCategories: { name: string; total: string; share: string }[]
        }>(results, "runCashflowSummary")
        const subs = value<{ count: number; annualTotal: string; subscriptions: { payee: string; annualCost: string }[] }>(
          results,
          "detectSubscriptions",
        )
        if (!summary) return "I could not read your cashflow."

        const parts = [
          `You are saving ${summary.savingsRate} of a ${summary.income} income right now. Three concrete places to look:`,
          "",
        ]
        if (summary.topCategories[0]) {
          parts.push(
            `1. **${summary.topCategories[0].name}** is ${summary.topCategories[0].share} of your spending at ${summary.topCategories[0].total}. Even a 10% trim here beats optimising anything smaller.`,
          )
        }
        if (subs?.count) {
          parts.push(
            `2. **Subscriptions** total ${subs.annualTotal} a year across ${subs.count} charges. The largest is ${subs.subscriptions[0]?.payee} at ${subs.subscriptions[0]?.annualCost}/year — worth asking whether you still use it.`,
          )
        }
        if (summary.topCategories[1]) {
          parts.push(
            `3. **${summary.topCategories[1].name}** at ${summary.topCategories[1].total} is your second largest and usually the most discretionary — a budget here would make the drift visible.`,
          )
        }
        parts.push("", "Want me to set budgets for these? I can infer limits from your last three months.")
        return parts.join("\n")
      },
    }
  }

  // --- Where does my money go / category breakdown -------------------------
  if (has(q, /where.*(money|spend)/, /breakdown/, /by category/, /biggest.*(expense|categor)/, /most.*spend/)) {
    return {
      calls: [{ toolName: "categoryBreakdown", input: { direction: "expense" } }],
      respond: (results) => {
        const data = value<{
          categories: { name: string; total: string; share: string; transactionCount: number }[]
        }>(results, "categoryBreakdown")
        if (!data || !data.categories.length) return "No spending in that period."
        const top = data.categories.slice(0, 8)
        return [
          "Here is where your money went this period:",
          "",
          ...top.map((c) => `- **${c.name}** — ${c.total} (${c.share}, ${c.transactionCount} transactions)`),
          "",
          `${top[0].name} is your largest at ${top[0].share} of spending.`,
        ].join("\n")
      },
    }
  }

  // --- Accounts / balances -------------------------------------------------
  if (has(q, /balance/, /account/, /net worth/, /how much.*(have|left)/)) {
    return {
      calls: [{ toolName: "listAccounts", input: {} }],
      respond: (results) => {
        const data = value<{
          netWorth: string
          accounts: { name: string; type: string; balance: string; transactionCount: number }[]
        }>(results, "listAccounts")
        if (!data) return "I could not read your accounts."
        return [
          `Your net worth is **${data.netWorth}** across ${data.accounts.length} accounts:`,
          "",
          ...data.accounts.map((a) => `- **${a.name}** (${a.type}) — ${a.balance}`),
        ].join("\n")
      },
    }
  }

  // --- Report / summary / brief (also the default) -------------------------
  return {
    calls: [
      { toolName: "runCashflowSummary", input: {} },
      { toolName: "analyzeBudget", input: {} },
      { toolName: "detectAnomalies", input: {} },
    ],
    respond: (results) => {
      const summary = value<{
        range: { from: string; to: string }
        income: string
        expense: string
        net: string
        savingsRate: string
        transactionCount: number
        topCategories: { name: string; total: string; share: string }[]
        topPayees: { payee: string; total: string }[]
      }>(results, "runCashflowSummary")
      const budget = value<{ overspent: string[]; budgets: unknown[] }>(results, "analyzeBudget")
      const anomalies = value<{ count: number; anomalies: { title: string; severity: string }[] }>(
        results,
        "detectAnomalies",
      )
      if (!summary) return "I could not read your finances. Try importing a CSV or loading the sample data first."

      const parts = [
        `**${summary.range.from} → ${summary.range.to}**`,
        "",
        `Income ${summary.income}, expenses ${summary.expense}, leaving **${summary.net}** — a ${summary.savingsRate} savings rate across ${summary.transactionCount} transactions.`,
      ]
      if (summary.topCategories.length) {
        parts.push(
          "",
          "**Where it went**",
          ...summary.topCategories.slice(0, 4).map((c) => `- ${c.name}: ${c.total} (${c.share})`),
        )
      }
      if (budget?.overspent?.length) {
        parts.push("", `⚠️ Over budget on **${budget.overspent.join(", ")}**.`)
      }
      if (anomalies?.count) {
        const high = anomalies.anomalies.filter((a) => a.severity === "high")
        parts.push(
          "",
          `I also flagged ${anomalies.count} things worth checking${high.length ? `, including ${high.map((a) => a.title).join(" and ")}` : ""}.`,
        )
      }
      parts.push(
        "",
        "Ask me to categorize what is missing, dig into a category, or set budgets — I can act on any of it directly.",
      )
      return parts.join("\n")
    },
  }
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

/** Word-by-word streaming so the offline agent feels alive rather than instant. */
function streamText(
  controller: ReadableStreamDefaultController<LanguageModelV4StreamPart>,
  text: string,
  id: string,
): Promise<void> {
  return new Promise((resolve) => {
    controller.enqueue({ type: "text-start", id })
    const chunks = text.match(/\S+\s*/g) ?? [text]
    let i = 0
    const pump = () => {
      // A few words per tick keeps it readable without dragging.
      const batch = chunks.slice(i, i + 3).join("")
      if (batch) controller.enqueue({ type: "text-delta", id, delta: batch })
      i += 3
      if (i < chunks.length) {
        setTimeout(pump, 18)
      } else {
        controller.enqueue({ type: "text-end", id })
        resolve()
      }
    }
    setTimeout(pump, 10)
  })
}

export class FinoraLocalModel implements LanguageModelV4 {
  readonly specificationVersion = "v4"
  readonly provider = "finora-offline"
  readonly modelId = "finora-offline-router"
  readonly supportedUrls = {}

  async doGenerate(options: LanguageModelV4CallOptions) {
    const results = collectToolResults(options)
    const plan = planFor(lastUserText(options))
    const text = results.length ? plan.respond(results) : OFFLINE_INTRO
    return {
      content: [{ type: "text" as const, text }],
      finishReason: { unified: "stop" as const, raw: "offline" },
      usage: NO_USAGE,
      warnings: [],
    }
  }

  async doStream(options: LanguageModelV4CallOptions) {
    const text = lastUserText(options)
    const priorResults = collectToolResults(options)
    const plan = planFor(text)

    // Only call tools the agent was actually given, so a filtered toolset
    // cannot produce a call for something that does not exist.
    const availableTools = new Set(
      (options.tools ?? []).map((t) => ("name" in t ? (t.name as string) : "")),
    )
    const calls = plan.calls.filter((c) => availableTools.size === 0 || availableTools.has(c.toolName))

    const stream = new ReadableStream<LanguageModelV4StreamPart>({
      async start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] })

        // First pass: request the tools. The SDK executes them and calls us
        // again with the results in the transcript.
        if (priorResults.length === 0 && calls.length > 0) {
          for (const [index, call] of calls.entries()) {
            const toolCallId = `finora-${Date.now()}-${index}`
            const input = JSON.stringify(call.input)
            controller.enqueue({ type: "tool-input-start", id: toolCallId, toolName: call.toolName })
            controller.enqueue({ type: "tool-input-delta", id: toolCallId, delta: input })
            controller.enqueue({ type: "tool-input-end", id: toolCallId })
            controller.enqueue({
              type: "tool-call",
              toolCallId,
              toolName: call.toolName,
              input,
            })
          }
          controller.enqueue({
            type: "finish",
            finishReason: { unified: "tool-calls", raw: "offline" },
            usage: NO_USAGE,
          })
          controller.close()
          return
        }

        // Second pass: narrate the results.
        const reply = priorResults.length ? plan.respond(priorResults) : OFFLINE_INTRO
        await streamText(controller, reply, "offline-1")
        controller.enqueue({
          type: "finish",
          finishReason: { unified: "stop", raw: "offline" },
          usage: NO_USAGE,
        })
        controller.close()
      },
    })

    return { stream }
  }
}

const OFFLINE_INTRO = [
  "I am running in **offline mode** — no API key is configured, so I am using a built-in router rather than a language model.",
  "",
  "I can still do real work, because every tool runs against your actual data:",
  "",
  "- “How am I doing this month?” — cashflow, budgets and anomalies",
  "- “Categorize my uncategorized transactions”",
  "- “Find my subscriptions”",
  "- “Where does my money go?”",
  "- “Where can I save money?”",
  "",
  "Add a key in **Settings → AI** to swap me for a real model with full natural-language understanding.",
].join("\n")
