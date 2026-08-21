import { useMemo, useState } from "react"
import { CreditCard, Plus, ArrowLeftRight, Landmark } from "lucide-react"

import { PageHeader, PageShell } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from "@/components/ui/empty"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"

import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"
import { accountBalances, totalNetWorth } from "@/lib/finance/calc"
import { useFormatters } from "@/hooks/useAppSettings"
import { cn } from "@/lib/utils"

import { AccountCard } from "@/components/accounts/AccountCard"
import { AccountSheet } from "@/components/accounts/AccountSheet"
import { TransferDialog } from "@/components/accounts/TransferDialog"

export default function AccountsPage() {
  const fmt = useFormatters()
  const accounts = useFinanceStore((s) => s.accounts)
  const transactions = useFinanceStore((s) => s.transactions)
  const holdings = useFinanceStore((s) => s.holdings)
  const askAgent = useUiStore((s) => s.askAgent)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editAccountId, setEditAccountId] = useState<string | undefined>()
  const [transferOpen, setTransferOpen] = useState(false)

  const { balances, active, archived, netWorth, totalAssets, totalLiabilities } = useMemo(() => {
    const bals = accountBalances(accounts, transactions)
    const act = accounts.filter((a) => !a.archived)
    const arch = accounts.filter((a) => a.archived)
    const nw = totalNetWorth(accounts, transactions, holdings)
    const assets = bals
      .filter((b) => {
        const acc = accounts.find((a) => a.id === b.accountId)
        return acc && !acc.archived && b.balance > 0
      })
      .reduce((s, b) => s + b.balance, 0)
    const liabilities = bals
      .filter((b) => {
        const acc = accounts.find((a) => a.id === b.accountId)
        return acc && !acc.archived && b.balance < 0
      })
      .reduce((s, b) => s + b.balance, 0)
    return { balances: bals, active: act, archived: arch, netWorth: nw, totalAssets: assets, totalLiabilities: liabilities }
  }, [accounts, transactions, holdings])

  function openAdd() {
    setEditAccountId(undefined)
    setSheetOpen(true)
  }

  function openEdit(id: string) {
    setEditAccountId(id)
    setSheetOpen(true)
  }

  if (accounts.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Accounts" description="All your financial accounts in one place" />
        <Empty className="min-h-[60vh] border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Landmark /></EmptyMedia>
            <EmptyTitle>No accounts yet</EmptyTitle>
            <EmptyDescription>Add your first account to start tracking your finances.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={openAdd}><Plus className="size-3.5" />Add account</Button>
          </EmptyContent>
        </Empty>
        <AccountSheet open={sheetOpen} onOpenChange={setSheetOpen} accountId={editAccountId} />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Accounts"
        description="All your financial accounts in one place"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => askAgent("Analyze my accounts and give me insights on my financial health")}>
              Ask the agent
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="outline" size="icon" aria-label="Transfer between accounts" onClick={() => setTransferOpen(true)}>
                    <ArrowLeftRight className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>Transfer between accounts</TooltipContent>
            </Tooltip>
            <Button size="sm" onClick={openAdd}>
              <Plus className="size-3.5" />
              Add account
            </Button>
          </>
        }
      />

      {/* Summary header */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-none border bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">Total assets</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{fmt.money(totalAssets)}</p>
        </div>
        <div className="rounded-none border bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">Total liabilities</p>
          <p className={cn("mt-1 text-lg font-bold tabular-nums", totalLiabilities < 0 && "text-destructive")}>
            {fmt.money(totalLiabilities)}
          </p>
        </div>
        <div className="rounded-none border bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">Net worth</p>
          <p className={cn("mt-1 text-lg font-bold tabular-nums", netWorth < 0 && "text-destructive")}>
            {fmt.money(netWorth)}
          </p>
        </div>
      </div>

      {/* Active accounts */}
      {active.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((account) => {
            const bal = balances.find((b) => b.accountId === account.id)
            return (
              <AccountCard
                key={account.id}
                account={account}
                balance={bal}
                transactions={transactions}
                onEdit={() => openEdit(account.id)}
              />
            )
          })}
        </div>
      )}

      {/* Archived accounts */}
      {archived.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <CreditCard className="size-3.5" />
            {archived.length} archived account{archived.length !== 1 ? "s" : ""}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
              {archived.map((account) => {
                const bal = balances.find((b) => b.accountId === account.id)
                return (
                  <AccountCard
                    key={account.id}
                    account={account}
                    balance={bal}
                    transactions={transactions}
                    onEdit={() => openEdit(account.id)}
                  />
                )
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <AccountSheet open={sheetOpen} onOpenChange={setSheetOpen} accountId={editAccountId} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} accounts={active} />
    </PageShell>
  )
}
