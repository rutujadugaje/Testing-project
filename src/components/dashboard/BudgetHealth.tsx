import { useMemo } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useFormatters } from "@/hooks/useAppSettings"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { budgetProgress, budgetHealthScore, elapsedRatioOfRange } from "@/lib/finance/calc"
import { monthRange, toIsoMonth } from "@/lib/finance/dates"
import { cn } from "@/lib/utils"

export function BudgetHealth() {
  const fmt = useFormatters()
  const transactions = useFinanceStore((s) => s.transactions)
  const budgets = useFinanceStore((s) => s.budgets)
  const categories = useFinanceStore((s) => s.categories)
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)

  const thisMonth = useMemo(() => toIsoMonth(new Date()), [])

  const progress = useMemo(
    () => budgetProgress(budgets, transactions, categories, thisMonth, monthStartDay),
    [budgets, transactions, categories, thisMonth, monthStartDay],
  )

  const score = useMemo(
    () => budgetHealthScore(progress, elapsedRatioOfRange(monthRange(thisMonth, monthStartDay))),
    [progress, thisMonth, monthStartDay],
  )

  if (progress.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budget health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">No budgets set for this month.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Budget health</CardTitle>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Score</span>
            <span
              className={cn(
                "text-sm font-bold tabular-nums",
                score >= 60 ? "text-foreground" : "text-destructive",
              )}
            >
              {score}
            </span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {progress.map((p) => (
          <div key={p.budget.id} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-xs font-medium">{p.category?.name ?? "Budget"}</span>
                {p.state === "over" && (
                  <Badge variant="destructive" className="shrink-0">Over</Badge>
                )}
                {p.state === "warning" && (
                  <Badge variant="outline" className="shrink-0 text-amber-600 border-amber-400">Warning</Badge>
                )}
              </div>
              <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {fmt.money(p.spent)}&nbsp;/&nbsp;{fmt.money(p.limit)}
              </div>
            </div>
            <Progress
              value={Math.min(p.ratio * 100, 100)}
              className={cn(
                "[&_.recharts-bar-rectangle]:fill-primary",
                p.state === "over" &&
                  "[&_[data-slot=progress-indicator]]:bg-destructive",
                p.state === "warning" &&
                  "[&_[data-slot=progress-indicator]]:bg-amber-500",
              )}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
