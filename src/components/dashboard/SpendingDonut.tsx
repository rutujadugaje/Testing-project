import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { PieChart, Pie, Cell, Tooltip } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { useFormatters } from "@/hooks/useAppSettings"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useActiveRange } from "@/stores/useUiStore"
import { categoryBreakdown, queryTransactions } from "@/lib/finance/calc"
import { CHART_COLORS } from "@/lib/icons"

const DONUT_COLORS = CHART_COLORS

export function SpendingDonut() {
  const fmt = useFormatters()
  const navigate = useNavigate()
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)
  const range = useActiveRange(monthStartDay)

  const breakdown = useMemo(() => {
    const txns = queryTransactions(transactions, {
      from: range.from,
      to: range.to,
      includeTransfers: false,
    })
    return categoryBreakdown(txns, categories, "expense").slice(0, 6)
  }, [transactions, categories, range])

  const chartConfig: ChartConfig = useMemo(
    () =>
      Object.fromEntries(
        breakdown.map((item, i) => [
          item.categoryId,
          { label: item.name, color: DONUT_COLORS[i % DONUT_COLORS.length] },
        ]),
      ),
    [breakdown],
  )

  const pieData = useMemo(
    () =>
      breakdown.map((item, i) => ({
        name: item.name,
        value: item.total,
        share: item.share,
        categoryId: item.categoryId,
        fill: DONUT_COLORS[i % DONUT_COLORS.length],
      })),
    [breakdown],
  )

  const total = useMemo(() => breakdown.reduce((s, c) => s + c.total, 0), [breakdown])

  if (breakdown.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending by category</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">No expense data for this period.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="w-44 shrink-0 self-center">
            <AspectRatio ratio={1}>
          <ChartContainer config={chartConfig} className="h-full w-full">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="90%"
                dataKey="value"
                onClick={() => navigate("/transactions")}
                className="cursor-pointer"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} stroke="var(--background)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload as typeof pieData[0]
                  return (
                    <div className="rounded-none border border-border bg-background px-2.5 py-1.5 text-xs shadow-md">
                      <p className="font-medium">{d.name}</p>
                      <p className="text-muted-foreground">{fmt.money(d.value)}</p>
                      <p className="text-muted-foreground">{fmt.percent(d.share, 1)}</p>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ChartContainer>
            </AspectRatio>
          </div>

          <div className="flex flex-1 flex-col gap-1.5">
            {breakdown.map((item, i) => (
              <div
                key={item.categoryId}
                className="flex items-center gap-2 text-xs cursor-pointer hover:opacity-80"
                onClick={() => navigate("/transactions")}
              >
                <div
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                <span className="flex-1 truncate text-muted-foreground">{item.name}</span>
                <span className="tabular-nums">{fmt.money(item.total)}</span>
                <span className="w-9 text-right tabular-nums text-muted-foreground">
                  {fmt.percent(item.share, 0)}
                </span>
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2 border-t pt-1.5 text-xs">
              <span className="flex-1 font-medium">Total</span>
              <span className="tabular-nums font-medium">{fmt.money(total)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
