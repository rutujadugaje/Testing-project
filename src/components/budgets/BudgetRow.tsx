import { MoreHorizontal, Pencil, Trash2, Bot } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

import type { BudgetProgress, IsoMonth } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"
import { useFormatters } from "@/hooks/useAppSettings"
import { categoryIcon } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { monthLabel } from "@/lib/finance/dates"

interface BudgetRowProps {
  progress: BudgetProgress
  onEdit: () => void
  month: IsoMonth
}

export function BudgetRow({ progress, onEdit, month }: BudgetRowProps) {
  const fmt = useFormatters()
  const deleteBudget = useFinanceStore((s) => s.deleteBudget)
  const askAgent = useUiStore((s) => s.askAgent)
  const { budget, category, spent, limit, remaining, ratio, state } = progress

  const Icon = categoryIcon(category?.icon)
  const pct = Math.min(ratio * 100, 100)

  const progressColor =
    state === "over"
      ? "bg-destructive"
      : state === "warning"
        ? "bg-amber-500"
        : "bg-primary"
        : "bg-muted"

  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      {/* Icon + name */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-none"
          style={{ background: category?.color ?? "var(--muted)", color: "white" }}
        >
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{category?.name ?? "Unknown"}</p>
          {budget.note && <p className="truncate text-xs text-muted-foreground">{budget.note}</p>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex flex-1 flex-col gap-1">
        <div className="relative h-1.5 w-full overflow-hidden rounded-none bg-muted">
          <div
            className={cn("h-full transition-all", progressColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">{fmt.money(spent)} spent</span>
          <span className="tabular-nums">of {fmt.money(limit)}</span>
        </div>
      </div>

      {/* Remaining + state */}
      <div className="flex shrink-0 items-center gap-2">
        {state === "over" ? (
          <Badge variant="destructive">{fmt.money(Math.abs(remaining))} over</Badge>
        ) : (
          <span className={cn("text-xs tabular-nums font-medium", state === "warning" && "text-amber-600")}>
            {fmt.money(remaining)} left
          </span>
        )}

        {budget.rollover && (
          <Badge variant="outline" className="text-xs">Rollover</Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Budget options">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => askAgent(`Why am I ${state === "over" ? "over" : "spending so much on"} ${category?.name ?? "this category"} in ${monthLabel(month, fmt.locale)}?`)}>
              <Bot className="size-3.5" />
              Ask agent
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
                  <AlertDialogTitle>Delete this budget?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the {category?.name} budget for {monthLabel(month, fmt.locale)}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => deleteBudget(budget.id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
