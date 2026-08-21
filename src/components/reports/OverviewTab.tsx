import { useMemo } from "react"
import {
  BarChart,
  Bar,
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
import { summarize, queryTransactions } from "@/lib/finance/calc"
import { recentMonths, monthRange, monthLabel } from "@/lib/finance/dates"
import { toMajor } from "@/lib/finance/money"
import type { DateRange } from "@/lib/finance/dates"

const barConfig = {
  income: { label: "Income", color: "var(--chart-2)" },
  expense: { label: "Expenses", color: "var(--chart-1)" },
} satisfies ChartConfig

interface Props {
  range: DateRange
}

export function OverviewTab({ range }: Props) {
  const fmt = useFormatters()
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)

  const current = useMemo(() => {
    const txns = queryTransactions(transactions, { includeTransfers: false })
    return summarize(txns, categories, range)
  }, [transactions, categories, range])

  const months6 = useMemo(() => recentMonths(6), [])

  const barData = useMemo(
    () =>
      months6
        .slice()
        .reverse()
        .map((m) => {
          const r = monthRange(m, monthStartDay)
          const txns = queryTransactions(transactions, { includeTransfers: false })
          const s = summarize(txns, categories, r)
          return {
            label: monthLabel(m, fmt.locale).replace(/ \d{4}$/, ""),
            income: toMajor(s.income),
            expense: toMajor(s.expense),
          }
        }),
    [transactions, categories, months6, monthStartDay, fmt.locale],
  )

  const kpis = [
    { label: "Income", value: fmt.money(current.income) },
    { label: "Expenses", value: fmt.money(current.expense) },
    { label: "Net", value: fmt.money(Math.abs(current.net)), bad: current.net < 0 },
    { label: "Savings rate", value: fmt.percent(current.savingsRate, 1), bad: current.savingsRate < 0 },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader>
              <CardTitle className="text-muted-foreground">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold tabular-nums">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly income vs expenses — last 6 months</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={barConfig} className="h-56 w-full">
            <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
              <Bar dataKey="income" fill="var(--color-income)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expense" fill="var(--color-expense)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
