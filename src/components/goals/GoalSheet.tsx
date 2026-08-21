import { useState, useEffect } from "react"
import { CalendarIcon } from "lucide-react"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel, FieldDescription, FieldError, FieldGroup } from "@/components/ui/field"

import type { Account } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { toMajor, toMinor } from "@/lib/finance/money"
import { CHART_COLORS, colorForIndex } from "@/lib/icons"
import { toIsoDate, fromIsoDate } from "@/lib/finance/dates"

interface GoalSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalId?: string
  accounts: Account[]
}

export function GoalSheet({ open, onOpenChange, goalId, accounts }: GoalSheetProps) {
  const goals = useFinanceStore((s) => s.goals)
  const addGoal = useFinanceStore((s) => s.addGoal)
  const updateGoal = useFinanceStore((s) => s.updateGoal)

  const existing = goalId ? goals.find((g) => g.id === goalId) : undefined
  const isEdit = !!existing

  const [name, setName] = useState("")
  const [targetMajor, setTargetMajor] = useState("")
  const [currentMajor, setCurrentMajor] = useState("0")
  const [deadline, setDeadline] = useState<Date | undefined>()
  const [accountId, setAccountId] = useState<string>("")
  const [monthlyMajor, setMonthlyMajor] = useState("")
  const [color, setColor] = useState(colorForIndex(0))
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      if (existing) {
        setName(existing.name)
        setTargetMajor(String(toMajor(existing.targetAmount)))
        setCurrentMajor(String(toMajor(existing.currentAmount)))
        setDeadline(existing.deadline ? fromIsoDate(existing.deadline) : undefined)
        setAccountId(existing.accountId ?? "")
        setMonthlyMajor(existing.monthlyContribution ? String(toMajor(existing.monthlyContribution)) : "")
        setColor(existing.color)
      } else {
        setName("")
        setTargetMajor("")
        setCurrentMajor("0")
        setDeadline(undefined)
        setAccountId("")
        setMonthlyMajor("")
        setColor(colorForIndex(goals.length))
      }
      setErrors({})
    }
  }, [open, existing, goals.length])

  function validate() {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = "Name is required"
    const target = parseFloat(targetMajor)
    if (!targetMajor || isNaN(target) || target <= 0) errs.target = "Target must be greater than 0"
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const targetAmount = toMinor(parseFloat(targetMajor))
    const currentAmount = toMinor(parseFloat(currentMajor) || 0)
    const monthlyContribution = monthlyMajor ? toMinor(parseFloat(monthlyMajor)) : undefined

    if (isEdit && goalId) {
      updateGoal(goalId, {
        name: name.trim(),
        targetAmount,
        currentAmount,
        deadline: deadline ? toIsoDate(deadline) : undefined,
        accountId: accountId || undefined,
        monthlyContribution,
        color,
      })
      toast.success("Goal updated")
    } else {
      addGoal({
        name: name.trim(),
        targetAmount,
        currentAmount,
        deadline: deadline ? toIsoDate(deadline) : undefined,
        accountId: accountId || undefined,
        status: "active",
        color,
        monthlyContribution,
      })
      toast.success("Goal created")
    }
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit goal" : "New goal"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Update your savings goal." : "Set a target and track your progress."}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 py-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="goal-name">Goal name</FieldLabel>
              <Input
                id="goal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Emergency fund"
              />
              {errors.name && <FieldError>{errors.name}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="goal-target">Target amount</FieldLabel>
              <Input
                id="goal-target"
                type="number"
                step="0.01"
                min="0"
                value={targetMajor}
                onChange={(e) => setTargetMajor(e.target.value)}
                placeholder="e.g. 5000.00"
              />
              {errors.target && <FieldError>{errors.target}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="goal-current">Current amount</FieldLabel>
              <FieldDescription>How much you have already saved.</FieldDescription>
              <Input
                id="goal-current"
                type="number"
                step="0.01"
                min="0"
                value={currentMajor}
                onChange={(e) => setCurrentMajor(e.target.value)}
                placeholder="0.00"
              />
            </Field>

            <Field>
              <FieldLabel>Deadline (optional)</FieldLabel>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button variant="outline" className="w-full justify-start font-normal">
                      <CalendarIcon className="size-3.5 text-muted-foreground" />
                      {deadline ? deadline.toLocaleDateString() : "No deadline"}
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={(d?: Date) => setDeadline(d)}
                  />
                </PopoverContent>
              </Popover>
            </Field>

            <Field>
              <FieldLabel htmlFor="goal-monthly">Monthly contribution</FieldLabel>
              <FieldDescription>How much you plan to contribute each month.</FieldDescription>
              <Input
                id="goal-monthly"
                type="number"
                step="0.01"
                min="0"
                value={monthlyMajor}
                onChange={(e) => setMonthlyMajor(e.target.value)}
                placeholder="0.00"
              />
            </Field>

            {accounts.length > 0 && (
              <Field>
                <FieldLabel>Linked account (optional)</FieldLabel>
                <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field>
              <FieldLabel>Color</FieldLabel>
              <div className="flex gap-2">
                {CHART_COLORS.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${i + 1}`}
                    className="size-6 rounded-full ring-offset-background transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    style={{ background: c, outline: color === c ? "2px solid currentColor" : undefined }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </Field>
          </FieldGroup>
        </div>

        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
          <Button onClick={handleSave}>{isEdit ? "Save changes" : "Create goal"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
