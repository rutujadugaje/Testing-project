# Finora AI layer — verified reference

The agent layer is **built and runtime-verified**. Do not modify these files:
- `src/lib/ai/store-facade.ts` — the only door between agent tools and app state
- `src/lib/ai/tools.ts` — 22 AI SDK 7 tool definitions
- `src/lib/ai/local-model.ts` — offline `LanguageModelV4` fallback (intent router)
- `src/lib/ai/agent.ts` — agent construction, provider switching, system prompt

## How to consume it from UI

```tsx
import { useChat } from "@ai-sdk/react"
import { createFinanceTransport, type FinoraUIMessage } from "@/lib/ai/agent"

// Build the transport in a useMemo keyed on the things that change the agent's
// context. Rebuilding it on every render restarts the stream.
const { transport, live, label } = useMemo(
  () => createFinanceTransport({ settings, route, selectedTransactionIds }),
  [settings.aiApiKey, settings.aiBaseUrl, settings.aiModel, settings.currency, settings.locale, route, selectedIdsKey],
)

const { messages, sendMessage, status, stop, error, regenerate, setMessages,
        clearError, addToolResult, addToolApprovalResponse } =
  useChat<FinoraUIMessage>({ transport })

sendMessage({ text: "How am I doing this month?" })
```

`status` is `"ready" | "submitted" | "streaming" | "error"`.

## Rendering message parts (verified shapes)

```tsx
import { isToolUIPart, getToolName } from "ai"

message.parts.map((part, i) => {
  if (part.type === "text")        return part.text          // markdown-ish
  if (part.type === "reasoning")   return part.text
  if (part.type === "step-start")  return <hr />             // new agent step
  if (isToolUIPart(part)) {
    const name = getToolName(part)   // e.g. "detectSubscriptions"
    // part.state: "input-streaming" | "input-available" | "output-available" | "output-error"
    // part.input, part.output, part.errorText, part.toolCallId
  }
})
```

`TOOL_LABELS` in `src/lib/ai/tools.ts` maps every tool name to a human label
("Finding subscriptions", "Analysing budgets") — use it for the tool trace UI.

## Tool approvals (destructive actions)

`deleteTransactions` always needs approval; `updateTransactions` needs it for >5
rows; `applyCategories` needs it when applying to everything. When a tool needs
approval the part carries an approval request and the chat exposes
`addToolApprovalResponse({ approvalId, approved })`. Render an inline
approve/deny prompt — do not auto-approve.

The approval id lives on the tool part's approval field; inspect the part at
runtime (`console.log(part)`) and read `node_modules/ai/dist/index.d.ts`
(`ToolApprovalRequest`, `ChatAddToolApproveResponseFunction`) for exact naming
rather than guessing.

## The 22 tools

Reads: `listAccounts`, `listCategories`, `queryTransactions`, `runCashflowSummary`,
`categoryBreakdown`, `detectSubscriptions`, `detectAnomalies`, `analyzeBudget`,
`listGoals`, `listRules`.

Writes: `createTransaction`, `updateTransactions`, `deleteTransactions`,
`suggestCategories`, `applyCategories`, `createBudget`, `createGoal`,
`updateGoalProgress`, `createRule`, `splitTransaction`, `exportSummaryMarkdown`.

Navigation: `navigateTo` — returns `{ navigate: "/route", reason }`. **The UI must
watch for this tool's output and actually navigate** (via `useNavigate`).

## Offline vs live

With no API key, `createFinanceModel` returns `FinoraLocalModel`: a deterministic
intent router that calls the same real tools and streams a reply built from real
tool results. `live: false` and `label: "Offline router"` are returned so the UI
can badge it honestly ("Offline mode"). It handles: briefing/summary (default),
subscriptions, anomalies, categorization (+ "apply them"), budgets, goals, rules,
category breakdown, savings advice, balances.

Verified working: tool-call → execute → output-available → streamed text, for all
nine intents against the sample dataset.

## Facade helpers you may reuse

`facade.context()` returns `{ today, currency, locale, accountCount, transactionCount, uncategorizedCount }`.
`facade` also exposes every tool's underlying function directly — call these for
**non-chat AI features** (e.g. grid actions) instead of going through the agent:
`facade.suggestCategories({...})`, `facade.applyCategories({...})`,
`facade.detectAnomalies()`, `facade.splitTransaction({...})`, etc.
