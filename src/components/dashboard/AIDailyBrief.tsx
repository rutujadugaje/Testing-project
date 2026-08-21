import { useMemo, useState, useCallback } from "react"
import { RefreshCw, MessageSquare } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useFormatters } from "@/hooks/useAppSettings"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore, useActiveRange } from "@/stores/useUiStore"
import {
  categoryBreakdown,
  summarize,
  budgetProgress,
  budgetHealthScore,
  elapsedRatioOfRange,
  detectAnomalies,
  detectSubscriptions,
  queryTransactions,
} from "@/lib/finance/calc"
import { monthRange, previousRange, toIsoMonth } from "@/lib/finance/dates"
import {
  generateDailyBrief,
  briefHeadline,
  briefAgentPrompt,
} from "./insights"

export function AIDailyBrief() {
  const fmt = useFormatters()
  const askAgent = useUiStore((s) => s.askAgent)
  const [seed, setSeed] = useState(0)

  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const budgets = useFinanceStore((s) => s.budgets)
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)
  const range = useActiveRange(monthStartDay)

  const thisMonth = useMemo(() => toIsoMonth(new Date()), [])

  const input = useMemo(() => {
    const allTxns = queryTransactions(transactions, { includeTransfers: false })
    const prevR = previousRange(range)
    const current = summarize(allTxns, categories, range)
    const previous = summarize(allTxns, categories, prevR)
    const rangeExpenses = allTxns.filter(
      (t) => t.date >= range.from && t.date <= range.to && t.amount < 0,
    )
    const breakdown = categoryBreakdown(rangeExpenses, categories, "expense")
    const prog = budgetProgress(budgets, transactions, categories, thisMonth, monthStartDay)
    const score = budgetHealthScore(prog, elapsedRatioOfRange(monthRange(thisMonth, monthStartDay)))
    const anomalies = detectAnomalies(allTxns)
    const subscriptions = detectSubscriptions(allTxns, {
      excludeCategoryIds: ["cat-rent", "cat-taxes", "cat-utilities", "cat-insurance"],
    })

    return {
      current,
      previous,
      breakdown,
      budgets: prog,
      anomalies,
      subscriptions,
      budgetHealthScore: score,
      currency: fmt.currency,
      locale: fmt.locale,
    }
    // seed is intentionally included so "regenerate" re-runs the memo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, categories, budgets, range, monthStartDay, fmt.currency, fmt.locale, thisMonth, seed])

  const paragraphs = useMemo(() => generateDailyBrief(input), [input])
  const headline = useMemo(() => briefHeadline(input), [input])
  const agentPrompt = useMemo(() => briefAgentPrompt(input), [input])

  const [regenerating, setRegenerating] = useState(false)
  const handleRegenerate = useCallback(() => {
    setRegenerating(true)
    // Simulate brief loading then flip seed to trigger recalculation
    setTimeout(() => {
      setSeed((s) => s + 1)
      setRegenerating(false)
    }, 600)
  }, [])

  return (
    <Card className="border-primary/20 bg-primary/3">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              AI Daily Brief
            </CardTitle>
            <CardDescription className="mt-0.5">{headline}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    aria-label="Regenerate brief"
                  />
                }
              >
                <RefreshCw className={regenerating ? "animate-spin" : ""} />
              </TooltipTrigger>
              <TooltipContent>Regenerate</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => askAgent(agentPrompt)}
                    aria-label="Ask the agent"
                  />
                }
              >
                <MessageSquare />
              </TooltipTrigger>
              <TooltipContent>Ask the agent</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {regenerating ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </div>
        ) : (
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
