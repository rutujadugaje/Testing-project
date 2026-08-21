import { useMemo } from "react"
import { Copy, MessageSquare } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useFormatters } from "@/hooks/useAppSettings"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"
import {
  summarize,
  categoryBreakdown,
  detectSubscriptions,
  queryTransactions,
} from "@/lib/finance/calc"
import { previousRange } from "@/lib/finance/dates"
import {
  generateReportNarrative,
  exportReportMarkdown,
} from "./narrative"
import type { DateRange } from "@/lib/finance/dates"

const EXCLUDED_CATEGORY_IDS = ["cat-rent", "cat-taxes", "cat-utilities", "cat-insurance"]

interface Props {
  range: DateRange
}

export function AINarrativeCard({ range }: Props) {
  const fmt = useFormatters()
  const askAgent = useUiStore((s) => s.askAgent)

  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)

  const input = useMemo(() => {
    const txns = queryTransactions(transactions, { includeTransfers: false })
    const current = summarize(txns, categories, range)
    const prevR = previousRange(range)
    const previous = summarize(txns, categories, prevR)
    const rangeExpenses = txns.filter((t) => t.date >= range.from && t.date <= range.to && t.amount < 0)
    const breakdown = categoryBreakdown(rangeExpenses, categories, "expense")
    const subscriptions = detectSubscriptions(txns, {
      excludeCategoryIds: EXCLUDED_CATEGORY_IDS,
    })

    return {
      current,
      previous,
      range,
      breakdown,
      subscriptions,
      currency: fmt.currency,
      locale: fmt.locale,
    }
  }, [transactions, categories, range, fmt.currency, fmt.locale])

  const narrative = useMemo(() => generateReportNarrative(input), [input])

  const handleCopy = () => {
    const md = exportReportMarkdown(input)
    navigator.clipboard.writeText(md).then(() => {
      toast.success("Report copied as Markdown")
    }).catch(() => {
      toast.error("Failed to copy to clipboard")
    })
  }

  const handleAskAgent = () => {
    askAgent(`Analyse my finances for this period and give me actionable advice. ${narrative}`)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            AI Period Summary
          </CardTitle>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="ghost" size="icon-sm" onClick={handleCopy} aria-label="Copy as Markdown" />
                }
              >
                <Copy />
              </TooltipTrigger>
              <TooltipContent>Copy as Markdown</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="ghost" size="icon-sm" onClick={handleAskAgent} aria-label="Ask the agent for advice" />
                }
              >
                <MessageSquare />
              </TooltipTrigger>
              <TooltipContent>Ask the agent for advice</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          {narrative.split("\n\n").map((p, i) => {
            // Handle **bold** markdown
            const parts = p.split(/\*\*(.+?)\*\*/g)
            return (
              <p key={i}>
                {parts.map((part, j) =>
                  j % 2 === 1 ? (
                    <strong key={j} className="font-medium text-foreground">
                      {part}
                    </strong>
                  ) : (
                    part
                  ),
                )}
              </p>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
