import { useState } from "react"
import { MoreHorizontal, Plus, Pause, Play, Trash2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
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
import { Field, FieldLabel } from "@/components/ui/field"

import type { Goal } from "@/types/finance"
import type { GoalProjection } from "@/lib/finance/calc"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useFormatters } from "@/hooks/useAppSettings"
import { toMinor } from "@/lib/finance/money"
import { monthLabel } from "@/lib/finance/dates"
import { cn } from "@/lib/utils"

interface GoalCardProps {
  goal: Goal
  projection: GoalProjection
  onEdit: () => void
}

export function GoalCard({ goal, projection, onEdit }: GoalCardProps) {
  const fmt = useFormatters()
  const updateGoal = useFinanceStore((s) => s.updateGoal)
  const deleteGoal = useFinanceStore((s) => s.deleteGoal)
  const contributeToGoal = useFinanceStore((s) => s.contributeToGoal)

  const [contribMajor, setContribMajor] = useState("")
  const [contribOpen, setContribOpen] = useState(false)

  const { ratio, remaining, monthsRemaining, requiredMonthly, onTrack } = projection
  const pct = Math.min(ratio * 100, 100)
  const isCompleted = goal.status === "completed"
  const isPaused = goal.status === "paused"

  function handleContribute() {
    const amt = parseFloat(contribMajor)
    if (!amt || amt <= 0) return
    const minor = toMinor(amt)
    contributeToGoal(goal.id, minor)
    const willComplete = goal.currentAmount + minor >= goal.targetAmount
    if (willComplete) {
      toast.success(`Goal "${goal.name}" completed! 🎉`, { duration: 5000 })
    } else {
      toast.success(`Added ${fmt.money(minor)} to ${goal.name}`)
    }
    setContribMajor("")
    setContribOpen(false)
  }

  function togglePause() {
    if (isPaused) {
      updateGoal(goal.id, { status: "active" })
      toast.success("Goal resumed")
    } else {
      updateGoal(goal.id, { status: "paused" })
      toast.success("Goal paused")
    }
  }

  return (
    <Card className={cn(isCompleted && "opacity-75")}>
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="size-2.5 rounded-full shrink-0"
              style={{ background: goal.color }}
            />
            <p className="font-medium text-sm truncate">{goal.name}</p>
          </div>
          <div className="flex items-center gap-1">
            {isCompleted && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="size-2.5" />
                Done
              </Badge>
            )}
            {isPaused && <Badge variant="outline">Paused</Badge>}
            {!isCompleted && !isPaused && (
              <Badge variant={onTrack ? "secondary" : "destructive"}>
                {onTrack ? "On track" : "Off track"}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Goal options">
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
                {!isCompleted && (
                  <DropdownMenuItem onClick={togglePause}>
                    {isPaused ? <><Play className="size-3.5" />Resume</> : <><Pause className="size-3.5" />Pause</>}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                        <Trash2 className="size-3.5" />Delete
                      </DropdownMenuItem>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete goal?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the "{goal.name}" goal.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => deleteGoal(goal.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-3">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full transition-all rounded-full"
              style={{ width: `${pct}%`, background: goal.color }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">{fmt.money(goal.currentAmount)}</span>
            <span className="tabular-nums font-medium">{fmt.percent(ratio, 1)}</span>
            <span className="tabular-nums">{fmt.money(goal.targetAmount)}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {!isCompleted && (
            <>
              <div>
                <p className="text-muted-foreground">Remaining</p>
                <p className="font-medium tabular-nums">{fmt.money(remaining)}</p>
              </div>
              {monthsRemaining !== undefined && (
                <div>
                  <p className="text-muted-foreground">Months left</p>
                  <p className="font-medium tabular-nums">{monthsRemaining}</p>
                </div>
              )}
              {requiredMonthly !== undefined && (
                <div>
                  <p className="text-muted-foreground">Required/month</p>
                  <p className={cn("font-medium tabular-nums", !onTrack && "text-destructive")}>
                    {fmt.money(requiredMonthly)}
                  </p>
                </div>
              )}
              {goal.monthlyContribution !== undefined && goal.monthlyContribution > 0 && (
                <div>
                  <p className="text-muted-foreground">Planned/month</p>
                  <p className="font-medium tabular-nums">{fmt.money(goal.monthlyContribution)}</p>
                </div>
              )}
            </>
          )}
          {goal.deadline && (
            <div>
              <p className="text-muted-foreground">Deadline</p>
              <p className="font-medium">{fmt.date(goal.deadline)}</p>
            </div>
          )}
          {projection.projectedCompletion && !isCompleted && (
            <div>
              <p className="text-muted-foreground">Projected done</p>
              <p className="font-medium">{monthLabel(projection.projectedCompletion.slice(0, 7), fmt.locale)}</p>
            </div>
          )}
        </div>

        {/* Contribute quick action */}
        {!isCompleted && (
          <Popover open={contribOpen} onOpenChange={setContribOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" size="sm" className="w-full h-7">
                  <Plus className="size-3.5" />
                  Add contribution
                </Button>
              }
            />
            <PopoverContent className="w-56 space-y-2">
              <p className="text-xs font-medium">Add to {goal.name}</p>
              <Field>
                <FieldLabel>Amount</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={contribMajor}
                  onChange={(e) => setContribMajor(e.target.value)}
                  placeholder="0.00"
                  onKeyDown={(e) => e.key === "Enter" && handleContribute()}
                  autoFocus
                />
              </Field>
              <Button size="sm" className="w-full h-7" onClick={handleContribute}>
                Contribute
              </Button>
            </PopoverContent>
          </Popover>
        )}
      </CardContent>
    </Card>
  )
}
