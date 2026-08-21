import { useMemo } from "react"
import { Plus, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import type { Category, IsoMonth, Transaction } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { suggestBudgetLimit } from "@/lib/finance/calc"
import { monthRange, isWithinRange } from "@/lib/finance/dates"
import { toMinor } from "@/lib/finance/money"
import { useFormatters } from "@/hooks/useAppSettings"
import { categoryIcon } from "@/lib/icons"

interface UnbudgetedSectionProps {
  transactions: Transaction[]
  categories: Category[]
  month: IsoMonth
  monthStartDay: number
  budgetedCategoryIds: string[]
  onCreateBudget: () => void
}

export function UnbudgetedSection({
  transactions,
  categories,
  month,
  monthStartDay,
  budgetedCategoryIds,
  onCreateBudget,
}: UnbudgetedSectionProps) {
  const fmt = useFormatters()
  const upsertBudget = useFinanceStore((s) => s.upsertBudget)

  const budgetedSet = useMemo(() => new Set(budgetedCategoryIds), [budgetedCategoryIds])

  const unbudgeted = useMemo(() => {
    const range = monthRange(month, monthStartDay)
    const spendByCat = new Map<string, number>()
    for (const t of transactions) {
      if (!t.categoryId || t.isTransfer || t.amount >= 0) continue
      if (!isWithinRange(t.date, range)) continue
      if (budgetedSet.has(t.categoryId)) continue
      const cat = categories.find((c) => c.id === t.categoryId)
      if (!cat || !cat.budgetable) continue
      spendByCat.set(t.categoryId, (spendByCat.get(t.categoryId) ?? 0) + Math.abs(t.amount))
    }
    return [...spendByCat.entries()]
      .map(([catId, spent]) => ({
        category: categories.find((c) => c.id === catId)!,
        spent,
        suggestion: suggestBudgetLimit(transactions, catId, 3),
      }))
      .filter((e) => !!e.category)
      .sort((a, b) => b.spent - a.spent)
  }, [transactions, categories, month, monthStartDay, budgetedSet])

  if (unbudgeted.length === 0) return null

  function quickCreate(catId: string, suggestion: number) {
    const limit = suggestion > 0 ? suggestion : toMinor(50)
    upsertBudget({ month, categoryId: catId, limit, rollover: false })
    toast.success("Budget created")
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">Unbudgeted spending this month</h3>
      <div className="rounded-none border ring-1 ring-foreground/10 divide-y divide-border">
        {unbudgeted.map(({ category, spent, suggestion }) => {
          const Icon = categoryIcon(category.icon)
          return (
            <div key={category.id} className="flex items-center gap-3 px-4 py-2.5">
              <div
                className="flex size-7 shrink-0 items-center justify-center rounded-none"
                style={{ background: category.color, color: "white" }}
              >
                <Icon className="size-3.5" />
              </div>
              <span className="flex-1 text-xs font-medium">{category.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{fmt.money(spent)} spent</span>
              {suggestion > 0 && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Sparkles className="size-2.5" />
                  {fmt.money(suggestion)}
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => quickCreate(category.id, suggestion)}
              >
                <Plus className="size-2.5" />
                Budget
              </Button>
            </div>
          )
        })}
      </div>
      <button
        className="text-xs text-muted-foreground hover:text-foreground underline"
        onClick={onCreateBudget}
      >
        Add custom budget
      </button>
    </div>
  )
}
