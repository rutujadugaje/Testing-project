import { useMemo, useState } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { useActiveRange } from "@/stores/useUiStore"
import { cashflowSeries } from "@/lib/finance/calc"
import { toMajor } from "@/lib/finance/money"

const chartConfig = {
  income: {
    label: "Income",
    color: "var(--chart-2)",
  },
  expense: {
    label: "Expenses",
    color: "var(--chart-1)",
  },
  balance: {
    label: "Balance",
    color: "var(--chart-3)",
  },
  net: {
    label: "Net",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig

type ChartView = "cashflow" | "balance" | "net"

export function CashflowChart() {
  const [view, setView] = useState<ChartView>("cashflow")
  const fmt = useFormatters()
  const transactions = useFinanceStore((s) => s.transactions)
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)
  const range = useActiveRange(monthStartDay)

  const series = useMemo(
    () => cashflowSeries(transactions, range, undefined, fmt.locale),
    [transactions, range, fmt.locale],
  )

  const chartData = useMemo(
    () =>
      series.map((p) => ({
        label: p.label,
        income: toMajor(p.income),
        expense: toMajor(p.expense),
        balance: toMajor(p.balance),
        net: toMajor(p.net),
      })),
    [series],
  )

  const tickFormatter = (v: number) => fmt.moneyCompact(Math.round(v * 100))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Cashflow</CardTitle>
          <Tabs value={view} onValueChange={(v) => v && setView(v as ChartView)}>
            <TabsList>
              <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
              <TabsTrigger value="balance">Balance</TabsTrigger>
              <TabsTrigger value="net">Net</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-56 w-full">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-income" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="grad-expense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-expense)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-expense)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="grad-balance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-balance)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-balance)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="grad-net" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-net)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-net)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="equidistantPreserveStart"
            />
            <YAxis
              tickFormatter={tickFormatter}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => {
                    const v = typeof value === "number" ? value : Number(value)
                    return fmt.money(Math.round(v * 100))
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />

            {view === "cashflow" && (
              <>
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="var(--color-income)"
                  strokeWidth={2}
                  fill="url(#grad-income)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="var(--color-expense)"
                  strokeWidth={2}
                  fill="url(#grad-expense)"
                  dot={false}
                />
              </>
            )}
            {view === "balance" && (
              <Area
                type="monotone"
                dataKey="balance"
                stroke="var(--color-balance)"
                strokeWidth={2}
                fill="url(#grad-balance)"
                dot={false}
              />
            )}
            {view === "net" && (
              <Area
                type="monotone"
                dataKey="net"
                stroke="var(--color-net)"
                strokeWidth={2}
                fill="url(#grad-net)"
                dot={false}
              />
            )}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
