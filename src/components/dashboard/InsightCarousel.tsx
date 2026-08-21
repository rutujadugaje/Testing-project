import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, CreditCard, PieChart, TrendingUp, Target, MessageSquare } from "lucide-react"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { generateInsightCards } from "./insights"
import type { InsightCard } from "./insights"
import { cn } from "@/lib/utils"

function kindIcon(kind: InsightCard["kind"]) {
  switch (kind) {
    case "anomaly": return AlertTriangle
    case "subscription": return CreditCard
    case "top-payee": return PieChart
    case "savings-trend": return TrendingUp
    case "budget": return Target
  }
}

function severityVariant(severity?: InsightCard["severity"]): "destructive" | "outline" | "secondary" {
  if (severity === "high") return "destructive"
  if (severity === "medium") return "outline"
  return "secondary"
}

export function InsightCarousel() {
  const fmt = useFormatters()
  const navigate = useNavigate()
  const askAgent = useUiStore((s) => s.askAgent)

  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const budgets = useFinanceStore((s) => s.budgets)
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)
  const range = useActiveRange(monthStartDay)
  const thisMonth = useMemo(() => toIsoMonth(new Date()), [])

  const cards = useMemo(() => {
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

    return generateInsightCards({
      current,
      previous,
      breakdown,
      budgets: prog,
      anomalies,
      subscriptions,
      budgetHealthScore: score,
      currency: fmt.currency,
      locale: fmt.locale,
    })
  }, [transactions, categories, budgets, range, monthStartDay, thisMonth, fmt.currency, fmt.locale])

  if (cards.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Insights</p>
      <Carousel opts={{ align: "start", dragFree: true }} className="relative">
        <CarouselContent>
          {cards.map((card) => {
            const Icon = kindIcon(card.kind)
            return (
              <CarouselItem key={card.id} className="basis-72 sm:basis-80">
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <CardTitle className="text-xs">{card.title}</CardTitle>
                      </div>
                      {card.severity && (
                        <Badge variant={severityVariant(card.severity)} className="shrink-0">
                          {card.severity}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">{card.body}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => {
                        if (card.ctaRoute) navigate(card.ctaRoute)
                        if (card.ctaPrompt) askAgent(card.ctaPrompt)
                      }}
                    >
                      {card.ctaPrompt && <MessageSquare className="size-3" />}
                      {card.ctaLabel}
                    </Button>
                  </CardContent>
                </Card>
              </CarouselItem>
            )
          })}
        </CarouselContent>
        <div className={cn("flex justify-end gap-1 pt-1", cards.length <= 1 && "hidden")}>
          <CarouselPrevious className="static translate-y-0" />
          <CarouselNext className="static translate-y-0" />
        </div>
      </Carousel>
    </div>
  )
}
