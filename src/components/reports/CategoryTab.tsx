import { useMemo, useState } from "react"
import { ArrowUpDown } from "lucide-react"
import { PieChart, Pie, Cell, Tooltip } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ChartContainer } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { useFormatters } from "@/hooks/useAppSettings"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { categoryBreakdown, queryTransactions } from "@/lib/finance/calc"
import { CHART_COLORS } from "@/lib/icons"
import type { DateRange } from "@/lib/finance/dates"
import { cn } from "@/lib/utils"
import type { CategoryBreakdownItem } from "@/types/finance"

type SortKey = "name" | "transactions" | "total" | "share"

interface Props {
  range: DateRange
}

export function CategoryTab({ range }: Props) {
  const fmt = useFormatters()
  const [sortKey, setSortKey] = useState<SortKey>("total")
  const [sortAsc, setSortAsc] = useState(false)

  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)

  const breakdown = useMemo(() => {
    const txns = queryTransactions(transactions, {
      from: range.from,
      to: range.to,
      includeTransfers: false,
    })
    return categoryBreakdown(txns, categories, "expense")
  }, [transactions, categories, range])

  const sorted = useMemo(() => {
    const rows = [...breakdown]
    rows.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break
        case "transactions": cmp = a.transactionCount - b.transactionCount; break
        case "total": cmp = a.total - b.total; break
        case "share": cmp = a.share - b.share; break
      }
      return sortAsc ? cmp : -cmp
    })
    return rows
  }, [breakdown, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const pieData = useMemo(
    () =>
      breakdown.slice(0, 6).map((item, i) => ({
        name: item.name,
        value: item.total,
        share: item.share,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [breakdown],
  )

  const chartConfig: ChartConfig = useMemo(
    () =>
      Object.fromEntries(
        breakdown.slice(0, 6).map((item, i) => [
          item.categoryId,
          { label: item.name, color: CHART_COLORS[i % CHART_COLORS.length] },
        ]),
      ),
    [breakdown],
  )

  function SortBtn({ col }: { col: SortKey }) {
    return (
      <Button
        variant="ghost"
        size="xs"
        onClick={() => toggleSort(col)}
        className={cn(sortKey === col ? "opacity-100" : "opacity-40")}
      >
        <ArrowUpDown className="size-3" />
      </Button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Donut */}
        <Card className="lg:w-64 shrink-0">
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <ChartContainer config={chartConfig} className="h-40 w-40">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius="55%" outerRadius="88%" dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="var(--background)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload as typeof pieData[0]
                    return (
                      <div className="rounded-none border border-border bg-background px-2 py-1.5 text-xs shadow-md">
                        <p className="font-medium">{d.name}</p>
                        <p className="text-muted-foreground">{fmt.money(d.value)} · {fmt.percent(d.share, 1)}</p>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ChartContainer>
            <div className="w-full space-y-1">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <div className="size-2 shrink-0 rounded-full" style={{ background: d.fill }} />
                  <span className="flex-1 truncate text-muted-foreground">{d.name}</span>
                  <span className="tabular-nums">{fmt.percent(d.share, 0)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="flex-1 min-w-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    Category <SortBtn col="name" />
                  </TableHead>
                  <TableHead className="text-right">
                    Txns <SortBtn col="transactions" />
                  </TableHead>
                  <TableHead className="text-right">
                    Total <SortBtn col="total" />
                  </TableHead>
                  <TableHead className="text-right w-32">
                    Share <SortBtn col="share" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row: CategoryBreakdownItem) => (
                  <TableRow key={row.categoryId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.transactionCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt.money(row.total)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(row.share * 100, 100)}%` }}
                          />
                        </div>
                        <span className="tabular-nums w-10 text-right">{fmt.percent(row.share, 0)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
