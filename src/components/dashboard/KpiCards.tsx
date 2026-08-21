import { useMemo } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card"
import { Skeleton } from "@/components/ui/skeleton"
import { useFormatters } from "@/hooks/useAppSettings"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useActiveRange } from "@/stores/useUiStore"
import {
  accountBalances,
  totalNetWorth,
  summarize,
  queryTransactions,
} from "@/lib/finance/calc"
import { previousRange } from "@/lib/finance/dates"
import { cn } from "@/lib/utils"

function DeltaBadge({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  // Hooks must run before any early return, or the hook order changes between
  // renders as soon as `previous` flips to/from zero.
  const fmt = useFormatters()

  if (previous === 0) return null
  const delta = current - previous
  const ratio = delta / Math.abs(previous)
  const isPositive = delta > 0
  const isBad = invert ? isPositive : !isPositive

  return (
    <div className={cn("flex items-center gap-0.5 text-xs font-medium", isBad ? "text-destructive" : "text-muted-foreground")}>
      {isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      <span>{fmt.percent(Math.abs(ratio), 1)}</span>
    </div>
  )
}

export function KpiCards() {
  const fmt = useFormatters()
  const accounts = useFinanceStore((s) => s.accounts)
  const transactions = useFinanceStore((s) => s.transactions)
  const holdings = useFinanceStore((s) => s.holdings)
  const categories = useFinanceStore((s) => s.categories)
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)
  const range = useActiveRange(monthStartDay)

  const { netWorth, balances, current, prev } = useMemo(() => {
    const nw = totalNetWorth(accounts, transactions, holdings)
    const bals = accountBalances(accounts, transactions)
    const prevR = previousRange(range)
    const allTxns = queryTransactions(transactions, { includeTransfers: false })
    const cur = summarize(allTxns, categories, range)
    const prv = summarize(allTxns, categories, prevR)
    return { netWorth: nw, balances: bals, current: cur, prev: prv }
  }, [accounts, transactions, holdings, categories, range])

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Net Worth */}
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground">Net Worth</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <HoverCard>
            <HoverCardTrigger
              className="cursor-default text-xl font-bold tabular-nums hover:underline"
            >
              {fmt.moneyCompact(netWorth)}
            </HoverCardTrigger>
            <HoverCardContent className="w-56">
              <div className="space-y-2">
                <p className="font-medium text-xs">Account breakdown</p>
                {accounts.filter((a) => !a.archived).map((acc) => {
                  const bal = balances.find((b) => b.accountId === acc.id)
                  return (
                    <div key={acc.id} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{acc.name}</span>
                      <span className="font-medium tabular-nums">{fmt.money(bal?.balance ?? 0)}</span>
                    </div>
                  )
                })}
                {holdings.length > 0 && (
                  <>
                    <div className="my-1 h-px bg-border" />
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Investments</span>
                      <span className="font-medium tabular-nums">
                        {fmt.money(holdings.reduce((s, h) => s + h.quantity * h.lastPrice, 0))}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
          <p className="text-xs text-muted-foreground">All accounts + investments</p>
        </CardContent>
      </Card>

      {/* Income MTD */}
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground">Income</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-xl font-bold tabular-nums">{fmt.money(current.income)}</p>
          <DeltaBadge current={current.income} previous={prev.income} invert={false} />
        </CardContent>
      </Card>

      {/* Expenses MTD */}
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground">Expenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-xl font-bold tabular-nums">{fmt.money(current.expense)}</p>
          <DeltaBadge current={current.expense} previous={prev.expense} invert={true} />
        </CardContent>
      </Card>

      {/* Savings Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground">Savings Rate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className={cn("text-xl font-bold tabular-nums", current.savingsRate < 0 && "text-destructive")}>
            {fmt.percent(current.savingsRate, 1)}
          </p>
          <DeltaBadge current={current.savingsRate} previous={prev.savingsRate} invert={false} />
        </CardContent>
      </Card>
    </div>
  )
}

export function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-3 w-20" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
