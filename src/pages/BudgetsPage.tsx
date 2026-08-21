import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Plus, Copy, Bot } from "lucide-react"

import { PageHeader, PageShell } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Progress } from "@/components/ui/progress"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from "@/components/ui/empty"

import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"
import { budgetProgress, budgetHealthScore, elapsedRatioOfRange } from "@/lib/finance/calc"
import { recentMonths, monthLabel, monthRange, toIsoMonth } from "@/lib/finance/dates"
import { useFormatters } from "@/hooks/useAppSettings"
import { toast } from "sonner"

import { BudgetRow } from "@/components/budgets/BudgetRow"
import { BudgetDialog } from "@/components/budgets/BudgetDialog"
import { UnbudgetedSection } from "@/components/budgets/UnbudgetedSection"

export default function BudgetsPage() {
  const fmt = useFormatters()
  const budgets = useFinanceStore((s) => s.budgets)
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const settings = useFinanceStore((s) => s.settings)
  const copyBudgets = useFinanceStore((s) => s.copyBudgets)
  const askAgent = useUiStore((s) => s.askAgent)

  const months = useMemo(() => recentMonths(12), [])
  const [month, setMonth] = useState(() => toIsoMonth(new Date()))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editBudgetId, setEditBudgetId] = useState<string | undefined>()

  const currentMonthIdx = months.indexOf(month)

  function prevMonth() {
    if (currentMonthIdx < months.length - 1) setMonth(months[currentMonthIdx + 1])
  }
  function nextMonth() {
    if (currentMonthIdx > 0) setMonth(months[currentMonthIdx - 1])
  }

  const progress = useMemo(
    () => budgetProgress(budgets, transactions, categories, month, settings.monthStartDay),
    [budgets, transactions, categories, month, settings.monthStartDay],
  )

  const healthScore = useMemo(
    () => budgetHealthScore(progress, elapsedRatioOfRange(monthRange(month, settings.monthStartDay))),
    [progress, month, settings.monthStartDay],
  )

  const totalBudgeted = useMemo(() => progress.reduce((s, p) => s + p.limit, 0), [progress])
  const totalSpent = useMemo(() => progress.reduce((s, p) => s + p.spent, 0), [progress])
  const totalRemaining = useMemo(() => totalBudgeted - totalSpent, [totalBudgeted, totalSpent])

  function handleCopyFromLastMonth() {
    const lastMonth = months[currentMonthIdx + 1]
    if (!lastMonth) { toast.error("No previous month available"); return }
    const copied = copyBudgets(lastMonth, month)
    if (copied === 0) toast.info("All categories already budgeted this month")
    else toast.success(`Copied ${copied} budget${copied !== 1 ? "s" : ""} from ${monthLabel(lastMonth, fmt.locale)}`)
  }

  function openAdd() {
    setEditBudgetId(undefined)
    setDialogOpen(true)
  }

  function openEdit(budgetId: string) {
    setEditBudgetId(budgetId)
    setDialogOpen(true)
  }

  return (
    <PageShell>
      <PageHeader
        title="Budgets"
        description="Track your spending against monthly limits"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => askAgent("Why am I over budget this month? Which categories need attention?")}>
              <Bot className="size-3.5" />
              Ask the agent
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyFromLastMonth}>
              <Copy className="size-3.5" />
              Copy from last month
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="size-3.5" />
              Add budget
            </Button>
          </>
        }
      />

      {/* Month switcher */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={prevMonth} aria-label="Previous month" disabled={currentMonthIdx >= months.length - 1}>
          <ChevronLeft className="size-4" />
        </Button>
        <NativeSelect
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
          aria-label="Select month"
        >
          {months.map((m) => (
            <NativeSelectOption key={m} value={m}>{monthLabel(m, fmt.locale)}</NativeSelectOption>
          ))}
        </NativeSelect>
        <Button variant="ghost" size="icon-sm" onClick={nextMonth} aria-label="Next month" disabled={currentMonthIdx <= 0}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-none border bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">Budgeted</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{fmt.money(totalBudgeted)}</p>
        </div>
        <div className="rounded-none border bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">Spent</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{fmt.money(totalSpent)}</p>
        </div>
        <div className="rounded-none border bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">Remaining</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{fmt.money(totalRemaining)}</p>
        </div>
        <div className="rounded-none border bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">Budget health</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{healthScore}%</p>
          <Progress value={healthScore} className="mt-1.5 h-1" />
        </div>
      </div>

      {/* Budget list */}
      {progress.length === 0 ? (
        <Empty className="min-h-[40vh] border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Plus /></EmptyMedia>
            <EmptyTitle>No budgets for {monthLabel(month, fmt.locale)}</EmptyTitle>
            <EmptyDescription>Create your first budget or copy from last month.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={openAdd}><Plus className="size-3.5" />Add budget</Button>
              <Button variant="outline" size="sm" onClick={handleCopyFromLastMonth}>
                <Copy className="size-3.5" />Copy from last month
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-none border ring-1 ring-foreground/10 divide-y divide-border">
          {progress.map((p) => (
            <BudgetRow
              key={p.budget.id}
              progress={p}
              onEdit={() => openEdit(p.budget.id)}
              month={month}
            />
          ))}
        </div>
      )}

      {/* Unbudgeted spending */}
      <UnbudgetedSection
        transactions={transactions}
        categories={categories}
        month={month}
        monthStartDay={settings.monthStartDay}
        budgetedCategoryIds={progress.map((p) => p.budget.categoryId)}
        onCreateBudget={openAdd}
      />

      <BudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        budgetId={editBudgetId}
        month={month}
      />
    </PageShell>
  )
}
