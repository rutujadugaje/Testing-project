import { useState, useEffect, useMemo } from "react"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field"
import {
  Combobox,
  ComboboxTrigger,
  ComboboxValue,
  ComboboxContent,
  ComboboxInput,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox"

import type { IsoMonth } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { suggestBudgetLimit } from "@/lib/finance/calc"
import { toMinor, toMajor } from "@/lib/finance/money"
import { monthLabel } from "@/lib/finance/dates"
import { categoryIcon } from "@/lib/icons"
import { useFormatters } from "@/hooks/useAppSettings"

interface BudgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  budgetId?: string
  month: IsoMonth
}

interface CategoryOption {
  value: string
  label: string
}

export function BudgetDialog({ open, onOpenChange, budgetId, month }: BudgetDialogProps) {
  const fmt = useFormatters()
  const budgets = useFinanceStore((s) => s.budgets)
  const categories = useFinanceStore((s) => s.categories)
  const transactions = useFinanceStore((s) => s.transactions)
  const upsertBudget = useFinanceStore((s) => s.upsertBudget)

  const existing = budgetId ? budgets.find((b) => b.id === budgetId) : undefined
  const isEdit = !!existing

  const [categoryId, setCategoryId] = useState("")
  const [limitMajor, setLimitMajor] = useState("")
  const [rollover, setRollover] = useState(false)
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [suggestion, setSuggestion] = useState<number | null>(null)

  // Categories available for budgeting (budgetable expense, not already budgeted this month)
  const budgetedCatIds = useMemo(() => {
    const ids = new Set(budgets.filter((b) => b.month === month).map((b) => b.categoryId))
    if (isEdit && existing) ids.delete(existing.categoryId)
    return ids
  }, [budgets, month, isEdit, existing])

  const categoryOptions: CategoryOption[] = useMemo(
    () =>
      categories
        .filter((c) => c.kind === "expense" && c.budgetable && !budgetedCatIds.has(c.id))
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, budgetedCatIds],
  )

  useEffect(() => {
    if (open) {
      if (existing) {
        setCategoryId(existing.categoryId)
        setLimitMajor(String(toMajor(existing.limit)))
        setRollover(existing.rollover)
        setNote(existing.note ?? "")
      } else {
        setCategoryId("")
        setLimitMajor("")
        setRollover(false)
        setNote("")
      }
      setErrors({})
      setSuggestion(null)
    }
  }, [open, existing])

  // Compute suggestion when category changes
  useEffect(() => {
    if (!categoryId) { setSuggestion(null); return }
    const s = suggestBudgetLimit(transactions, categoryId, 3)
    setSuggestion(s > 0 ? s : null)
  }, [categoryId, transactions])

  function validate() {
    const errs: Record<string, string> = {}
    if (!categoryId) errs.category = "Select a category"
    const lim = parseFloat(limitMajor)
    if (!limitMajor || isNaN(lim) || lim <= 0) errs.limit = "Limit must be greater than 0"
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    upsertBudget({
      id: budgetId,
      month,
      categoryId,
      limit: toMinor(parseFloat(limitMajor)),
      rollover,
      note: note.trim() || undefined,
    })
    toast.success(isEdit ? "Budget updated" : "Budget created")
    onOpenChange(false)
  }

  const selectedCat = categories.find((c) => c.id === categoryId)
  const SelectedIcon = categoryIcon(selectedCat?.icon)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit budget" : "Add budget"}</DialogTitle>
          <DialogDescription>
            {monthLabel(month, fmt.locale)} budget
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Category</FieldLabel>
            <Combobox
              items={categoryOptions}
              value={categoryOptions.find((o) => o.value === categoryId) ?? null}
              onValueChange={(val) => {
                if (val) {
                  setCategoryId(val.value)
                }
              }}
            >
              <ComboboxTrigger className="flex h-8 w-full items-center justify-between gap-2 rounded-none border border-input bg-transparent px-2.5 text-xs">
                {selectedCat ? (
                  <span className="flex items-center gap-1.5">
                    <SelectedIcon className="size-3.5" />
                    {selectedCat.name}
                  </span>
                ) : (
                  <ComboboxValue placeholder="Select category" />
                )}
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput placeholder="Search categories..." />
                <ComboboxEmpty>No categories found</ComboboxEmpty>
                <ComboboxList>
                  {(item: CategoryOption) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            {errors.category && <FieldError>{errors.category}</FieldError>}
          </Field>

          <Field>
            <FieldLabel>Monthly limit</FieldLabel>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={limitMajor}
              onChange={(e) => setLimitMajor(e.target.value)}
              placeholder="0.00"
            />
            {errors.limit && <FieldError>{errors.limit}</FieldError>}
            {suggestion !== null && (
              <div className="flex items-center gap-2 rounded-none border border-border bg-muted/50 px-2.5 py-1.5">
                <Sparkles className="size-3.5 text-primary shrink-0" />
                <p className="flex-1 text-xs text-muted-foreground">
                  AI suggests <span className="font-medium text-foreground">{fmt.money(suggestion)}</span> (median of last 3 months)
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setLimitMajor(String(toMajor(suggestion)))}
                >
                  Use
                </Button>
              </div>
            )}
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="budget-rollover">Rollover unused</FieldLabel>
            <Switch
              id="budget-rollover"
              checked={rollover}
              onCheckedChange={setRollover}
            />
          </Field>

          <Field>
            <FieldLabel>Note (optional)</FieldLabel>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Including weekly market"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleSave}>{isEdit ? "Save changes" : "Create budget"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
