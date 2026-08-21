/**
 * Rich bespoke cards for high-value tool outputs.
 * For everything else: collapsible pretty-printed JSON.
 */

import * as React from "react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Item, ItemContent, ItemTitle, ItemDescription, ItemGroup } from "@/components/ui/item"
import { cn } from "@/lib/utils"
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CalendarIcon,
  TrendingDownIcon,
} from "lucide-react"

// ─── Subscriptions ────────────────────────────────────────────────────────────

interface Subscription {
  payee: string
  amount: string
  cadence: string
  annualCost: string
  confidence: number
}

interface SubscriptionsOutput {
  count: number
  annualTotal: string
  monthlyEquivalent: string
  subscriptions: Subscription[]
}

function SubscriptionsCard({ data }: { data: SubscriptionsOutput }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span><strong className="text-foreground">{data.count}</strong> subscriptions</span>
        <span className="text-muted-foreground/50">·</span>
        <span><strong className="text-foreground">{data.annualTotal}</strong>/yr</span>
        <span className="text-muted-foreground/50">·</span>
        <span>{data.monthlyEquivalent}/mo</span>
      </div>
      <ItemGroup>
        {data.subscriptions.map((sub, i) => (
          <Item key={i} variant="outline" size="xs">
            <ItemContent>
              <ItemTitle>{sub.payee}</ItemTitle>
              <ItemDescription>
                {sub.cadence} · {sub.annualCost}/yr
              </ItemDescription>
            </ItemContent>
            <Badge variant="outline" className="ml-auto shrink-0">{sub.amount}</Badge>
          </Item>
        ))}
      </ItemGroup>
    </div>
  )
}

// ─── Anomalies ────────────────────────────────────────────────────────────────

interface Anomaly {
  severity: "high" | "medium" | "low"
  title: string
  description: string
  amount: string
  transactionCount: number
}

interface AnomaliesOutput {
  count: number
  anomalies: Anomaly[]
}

function AnomaliesCard({ data }: { data: AnomaliesOutput }) {
  if (data.count === 0) {
    return <p className="text-xs text-muted-foreground">No anomalies detected.</p>
  }
  return (
    <div className="flex flex-col gap-1.5">
      {data.anomalies.map((a, i) => (
        <Alert key={i} variant={a.severity === "high" ? "destructive" : "default"}>
          {a.severity === "high" ? (
            <AlertTriangleIcon className="size-3.5 text-destructive" />
          ) : (
            <TrendingDownIcon className="size-3.5 text-muted-foreground" />
          )}
          <AlertTitle className="text-xs">{a.title}
            {a.amount && <span className="ml-1 font-normal text-muted-foreground">— {a.amount}</span>}
          </AlertTitle>
          <AlertDescription>{a.description}</AlertDescription>
        </Alert>
      ))}
    </div>
  )
}

// ─── Budget ───────────────────────────────────────────────────────────────────

interface BudgetRow {
  category: string
  limit: string
  spent: string
  remaining: string
  usage: string
  state: string
}

interface BudgetOutput {
  month: string
  totalBudgeted: string
  totalSpent: string
  budgets: BudgetRow[]
  overspent: string[]
}

function BudgetCard({ data }: { data: BudgetOutput }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{data.month}</span>
        <span>
          <strong>{data.totalSpent}</strong>
          <span className="text-muted-foreground"> of {data.totalBudgeted}</span>
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {data.budgets.map((b, i) => {
          const pct = parseFloat(b.usage) || 0
          const over = b.state === "over"
          return (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className={over ? "text-destructive font-medium" : ""}>{b.category}</span>
                <span className="text-muted-foreground tabular-nums">{b.spent} / {b.limit}</span>
              </div>
              <Progress
                value={Math.min(pct, 100)}
                className={cn(over && "[&_[data-slot=progress-indicator]]:bg-destructive")}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Cashflow summary ─────────────────────────────────────────────────────────

interface CashflowOutput {
  income: string
  expense: string
  net: string
  savingsRate: string
  transactionCount?: number
}

function CashflowCard({ data }: { data: CashflowOutput }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {([
        ["Income", data.income, "text-emerald-600 dark:text-emerald-400"],
        ["Expenses", data.expense, "text-foreground"],
        ["Net", data.net, "text-foreground font-semibold"],
        ["Savings rate", data.savingsRate, "text-foreground"],
      ] as [string, string, string][]).map(([label, value, cls]) => (
        <div key={label} className="flex flex-col gap-0.5 rounded border border-border p-2">
          <span className="text-[10px] text-muted-foreground">{label}</span>
          <span className={cn("text-xs tabular-nums", cls)}>{value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Transactions ─────────────────────────────────────────────────────────────

interface TxRow {
  date: string
  payee: string
  amount: string
  category?: string
}

interface QueryTransactionsOutput {
  total?: string
  count?: number
  transactions: TxRow[]
}

function TransactionsCard({ data }: { data: QueryTransactionsOutput }) {
  const rows = data.transactions.slice(0, 5)
  const more = (data.count ?? data.transactions.length) - rows.length
  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Payee</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{tx.date}</td>
                <td className="px-2 py-1.5 truncate max-w-[120px]">{tx.payee}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{tx.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {more > 0 && (
        <Link
          to="/transactions"
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          See all {more} more →
        </Link>
      )}
    </div>
  )
}

// ─── Suggest categories ───────────────────────────────────────────────────────

interface CategorySuggestion {
  payee: string
  amount: string
  category: string
  confidence: number
  reason: string
}

interface SuggestCategoriesOutput {
  considered: number
  suggested: number
  suggestions: CategorySuggestion[]
}

function SuggestCategoriesCard({ data }: { data: SuggestCategoriesOutput }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {data.suggested} suggestions for {data.considered} uncategorized transactions
      </p>
      <ItemGroup>
        {data.suggestions.slice(0, 8).map((s, i) => (
          <Item key={i} variant="outline" size="xs">
            <ItemContent>
              <ItemTitle>{s.payee}
                <span className="ml-1 font-normal text-muted-foreground">→ {s.category}</span>
              </ItemTitle>
              <ItemDescription>{s.reason}</ItemDescription>
            </ItemContent>
            <Badge
              variant={s.confidence > 0.85 ? "default" : "outline"}
              className="ml-auto shrink-0"
            >
              {Math.round(s.confidence * 100)}%
            </Badge>
          </Item>
        ))}
      </ItemGroup>
    </div>
  )
}

// ─── Goals ────────────────────────────────────────────────────────────────────

interface GoalRow {
  name: string
  current: string
  target: string
  progress: string
  status: string
  deadline?: string
  onTrack: boolean
}

interface GoalsOutput {
  goals: GoalRow[]
}

function GoalsCard({ data }: { data: GoalsOutput }) {
  return (
    <div className="flex flex-col gap-2">
      {data.goals.map((g, i) => {
        const pct = parseFloat(g.progress) || 0
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{g.name}</span>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {g.deadline && (
                  <span className="flex items-center gap-0.5">
                    <CalendarIcon className="size-3" />
                    {g.deadline}
                  </span>
                )}
                <Badge variant={g.onTrack ? "outline" : "destructive"}>
                  {g.onTrack ? "On track" : "Behind"}
                </Badge>
              </div>
            </div>
            <Progress value={Math.min(pct, 100)} />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{g.current}</span>
              <span>{g.target} · {g.progress}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Category breakdown ───────────────────────────────────────────────────────

interface CategoryRow {
  name: string
  total: string
  share: string
  transactionCount: number
}

interface CategoryBreakdownOutput {
  categories: CategoryRow[]
}

function CategoryBreakdownCard({ data }: { data: CategoryBreakdownOutput }) {
  const top = data.categories.slice(0, 8)
  return (
    <div className="flex flex-col gap-1.5">
      {top.map((c, i) => {
        const pct = parseFloat(c.share) || 0
        return (
          <div key={i} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-xs">
              <span>{c.name}</span>
              <span className="text-muted-foreground tabular-nums">{c.total} · {c.share}</span>
            </div>
            <Progress value={Math.min(pct, 100)} />
          </div>
        )
      })}
    </div>
  )
}

// ─── JSON fallback ────────────────────────────────────────────────────────────

function JsonCard({ data }: { data: unknown }) {
  const [open, setOpen] = React.useState(false)
  const json = JSON.stringify(data, null, 2)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        {open ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
        {open ? "Hide" : "Show"} result
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="mt-1.5 max-h-48 rounded border border-border bg-muted/30">
          <pre className="p-2 text-[10px] leading-relaxed whitespace-pre-wrap break-all text-muted-foreground">
            {json}
          </pre>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function ToolResultCard({ toolName, output }: { toolName: string; output: unknown }) {
  if (output === undefined || output === null) return null

  try {
    if (toolName === "detectSubscriptions") {
      return <SubscriptionsCard data={output as SubscriptionsOutput} />
    }
    if (toolName === "detectAnomalies") {
      return <AnomaliesCard data={output as AnomaliesOutput} />
    }
    if (toolName === "analyzeBudget") {
      return <BudgetCard data={output as BudgetOutput} />
    }
    if (toolName === "runCashflowSummary") {
      return <CashflowCard data={output as CashflowOutput} />
    }
    if (toolName === "queryTransactions") {
      return <TransactionsCard data={output as QueryTransactionsOutput} />
    }
    if (toolName === "suggestCategories") {
      return <SuggestCategoriesCard data={output as SuggestCategoriesOutput} />
    }
    if (toolName === "listGoals") {
      return <GoalsCard data={output as GoalsOutput} />
    }
    if (toolName === "categoryBreakdown") {
      return <CategoryBreakdownCard data={output as CategoryBreakdownOutput} />
    }
    if (toolName === "navigateTo") {
      // Minimal — navigation is handled by the parent, just acknowledge
      const nav = output as { navigate?: string; reason?: string }
      return (
        <p className="text-xs text-muted-foreground italic">
          Navigating to {nav.navigate}{nav.reason ? ` — ${nav.reason}` : ""}
        </p>
      )
    }
  } catch {
    // fall through to JSON
  }

  return <JsonCard data={output} />
}
