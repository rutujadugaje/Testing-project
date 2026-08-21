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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { useFormatters } from "@/hooks/useAppSettings"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { payeeBreakdown, queryTransactions } from "@/lib/finance/calc"
import { toMajor } from "@/lib/finance/money"
import type { DateRange } from "@/lib/finance/dates"

const chartConfig = {
  total: { label: "Spend", color: "var(--chart-1)" },
} satisfies ChartConfig

interface Props {
  range: DateRange
}

export function PayeeTab({ range }: Props) {
  const fmt = useFormatters()
  const transactions = useFinanceStore((s) => s.transactions)

  const rows = useMemo(() => {
    const txns = queryTransactions(transactions, {
      from: range.from,
      to: range.to,
      includeTransfers: false,
    })
    return payeeBreakdown(txns, 15)
  }, [transactions, range])

  const top10 = rows.slice(0, 10)

  const barData = useMemo(
    () =>
      top10
        .slice()
        .reverse()
        .map((r) => ({
          name: r.payee.length > 18 ? r.payee.slice(0, 18) + "…" : r.payee,
          fullName: r.payee,
          total: toMajor(r.total),
        })),
    [top10],
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Top 10 payees by spend</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/40" />
              <XAxis
                type="number"
                tickFormatter={(v: number) => fmt.moneyCompact(Math.round(v * 100))}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={108}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(v) => fmt.money(Math.round((v as number) * 100))}
                  />
                }
              />
              <Bar dataKey="total" fill="var(--color-total)" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All payees</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payee</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.payee}>
                  <TableCell className="font-medium">{row.payee}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.money(row.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
