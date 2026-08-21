import { useMemo } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { useFormatters } from "@/hooks/useAppSettings"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { categoryBreakdown, summarize, queryTransactions } from "@/lib/finance/calc"
import { recentMonths, monthRange, monthLabel } from "@/lib/finance/dates"
import { toMajor } from "@/lib/finance/money"
import { CHART_COLORS } from "@/lib/icons"
import type { DateRange } from "@/lib/finance/dates"

const SAVINGS_COLOR = "var(--chart-5)"

interface Props {
  range: DateRange
}

export function TrendsTab({ range: _range }: Props) {
  const fmt = useFormatters()
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)

  const months6 = useMemo(() => recentMonths(6), [])

  // Get top 5 expense categories across all time
  const topCats = useMemo(() => {
    const allTxns = queryTransactions(transactions, { includeTransfers: false })
    return categoryBreakdown(allTxns, categories, "expense").slice(0, 5)
  }, [transactions, categories])

  const lineData = useMemo(() =>
    months6
      .slice()
      .reverse()
      .map((m) => {
        const r = monthRange(m, monthStartDay)
        const txns = queryTransactions(transactions, { from: r.from, to: r.to, includeTransfers: false })
        const point: Record<string, number | string> = {
          label: monthLabel(m, fmt.locale).replace(/ \d{4}$/, ""),
        }
        for (const cat of topCats) {
          const catTxns = txns.filter((t) => t.categoryId === cat.categoryId && t.amount < 0)
          point[cat.categoryId] = toMajor(Math.abs(catTxns.reduce((s, t) => s + t.amount, 0)))
        }
        return point
      }),
    [transactions, months6, topCats, monthStartDay, fmt.locale],
  )

  const savingsData = useMemo(() =>
    months6
      .slice()
      .reverse()
      .map((m) => {
        const r = monthRange(m, monthStartDay)
        const txns = queryTransactions(transactions, { includeTransfers: false })
        const s = summarize(txns, categories, r)
        return {
          label: monthLabel(m, fmt.locale).replace(/ \d{4}$/, ""),
          rate: Math.round(s.savingsRate * 100),
        }
      }),
    [transactions, categories, months6, monthStartDay, fmt.locale],
  )

  const catChartConfig: ChartConfig = useMemo(
    () =>
      Object.fromEntries(
        topCats.map((c, i) => [c.categoryId, { label: c.name, color: CHART_COLORS[i % CHART_COLORS.length] }]),
      ),
    [topCats],
  )

  const savingsConfig: ChartConfig = {
    rate: { label: "Savings rate %", color: SAVINGS_COLOR },
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Top 5 categories — monthly spend</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={catChartConfig} className="h-56 w-full">
            <LineChart data={lineData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v: number) => fmt.moneyCompact(Math.round(v * 100))}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(v) => fmt.money(Math.round((v as number) * 100))}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {topCats.map((cat, i) => (
                <Line
                  key={cat.categoryId}
                  type="monotone"
                  dataKey={cat.categoryId}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Savings rate — monthly trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={savingsConfig} className="h-40 w-full">
            <LineChart data={savingsData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(v) => `${v}%`}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke={SAVINGS_COLOR}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
