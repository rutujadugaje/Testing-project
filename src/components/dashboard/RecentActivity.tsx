import { useMemo } from "react"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions, ItemGroup } from "@/components/ui/item"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty"
import { useFormatters } from "@/hooks/useAppSettings"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { queryTransactions } from "@/lib/finance/calc"
import { categoryIcon } from "@/lib/icons"
import { cn } from "@/lib/utils"

export function RecentActivity() {
  const fmt = useFormatters()
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const recent = useMemo(
    () =>
      queryTransactions(transactions, {
        includeTransfers: false,
        limit: 8,
        sort: "date_desc",
      }),
    [transactions],
  )

  if (recent.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ArrowRight />
              </EmptyMedia>
              <EmptyTitle>No transactions yet</EmptyTitle>
              <EmptyDescription>Import your bank data to get started.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent activity</CardTitle>
          <Link
            to="/transactions"
            className="inline-flex h-7 items-center gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            View all
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <ItemGroup>
          {recent.map((txn) => {
            const cat = txn.categoryId ? catMap.get(txn.categoryId) : undefined
            const Icon = categoryIcon(cat?.icon)
            const isExpense = txn.amount < 0

            return (
              <Item key={txn.id} size="sm">
                <ItemMedia
                  variant="icon"
                  className="size-7 rounded-none bg-muted text-muted-foreground"
                >
                  <Icon className="size-3.5" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="font-medium">{txn.payee}</ItemTitle>
                  <ItemDescription>
                    {cat?.name ?? "Uncategorized"} · {fmt.shortDate(txn.date)}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {txn.status === "pending" && (
                    <Badge variant="outline" className="text-muted-foreground">pending</Badge>
                  )}
                  <span
                    className={cn(
                      "tabular-nums font-medium text-xs",
                      isExpense ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {isExpense ? "-" : "+"}{fmt.money(Math.abs(txn.amount))}
                  </span>
                </ItemActions>
              </Item>
            )
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  )
}
