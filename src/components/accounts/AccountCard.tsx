import { useMemo } from "react"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

import type { Account, AccountBalance, Transaction } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useFormatters } from "@/hooks/useAppSettings"
import { accountIcon, ACCOUNT_TYPE_LABELS } from "@/lib/icons"
import { cn } from "@/lib/utils"

interface AccountCardProps {
  account: Account
  balance: AccountBalance | undefined
  transactions: Transaction[]
  onEdit: () => void
}

export function AccountCard({ account, balance, transactions, onEdit }: AccountCardProps) {
  const fmt = useFormatters()
  const deleteAccount = useFinanceStore((s) => s.deleteAccount)

  const Icon = accountIcon(account.type)
  const currentBalance = balance?.balance ?? 0
  const cleared = balance?.clearedBalance ?? 0
  const pending = balance?.pendingBalance ?? 0
  const txCount = balance?.transactionCount ?? 0

  const txCountForAccount = useMemo(
    () => transactions.filter((t) => t.accountId === account.id).length,
    [transactions, account.id],
  )

  return (
    <Card className="relative">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-none"
              style={{ background: account.color, color: "white" }}
            >
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-sm">{account.name}</p>
              {account.institution && (
                <p className="truncate text-xs text-muted-foreground">{account.institution}</p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Account options">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                      <Trash2 className="size-3.5" />
                      Delete
                    </DropdownMenuItem>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {account.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the account and all {txCountForAccount} associated transaction{txCountForAccount !== 1 ? "s" : ""}. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => deleteAccount(account.id)}
                    >
                      Delete account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-3">
        {/* Balance */}
        <div>
          <p className={cn("text-2xl font-bold tabular-nums", currentBalance < 0 && "text-destructive")}>
            {fmt.money(currentBalance)}
          </p>
          {account.reference && (
            <p className="text-xs text-muted-foreground">{account.reference}</p>
          )}
        </div>

        {/* Cleared vs pending split */}
        {pending !== 0 && (
          <div className="flex gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Cleared </span>
              <span className="font-medium tabular-nums">{fmt.money(cleared)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pending </span>
              <span className={cn("font-medium tabular-nums", pending < 0 && "text-destructive")}>
                {fmt.money(pending)}
              </span>
            </div>
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <Tooltip>
            <TooltipTrigger className="text-xs text-muted-foreground">
              {txCount} transactions
            </TooltipTrigger>
            <TooltipContent>Total transactions in this account</TooltipContent>
          </Tooltip>
          <Badge variant="outline">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
