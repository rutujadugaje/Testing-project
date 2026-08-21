/**
 * AiSuggestionsReview — sheet/panel to review, accept, and reject AI category suggestions.
 *
 * Opened from AiGridToolbar after "Suggest categories" runs.
 * Mutations go through the store's acceptAiSuggestions / rejectAiSuggestions.
 */
import { useMemo, useState } from "react"
import { CheckCircle2, XCircle, Info, Check } from "lucide-react"
import { toast } from "sonner"

import type { Category, Transaction } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useFormatters } from "@/hooks/useAppSettings"
import { categoryIcon } from "@/lib/icons"
import { cn } from "@/lib/utils"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Toggle } from "@/components/ui/toggle"

interface SuggestionRow {
  transaction: Transaction
  category: Category
  confidence: number
  reason: string
}

interface AiSuggestionsReviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Color band for confidence: ≥0.9 strong, ≥0.7 likely, else weak. */
function confidenceBadgeVariant(confidence: number): "default" | "secondary" | "outline" {
  if (confidence >= 0.9) return "default"
  if (confidence >= 0.7) return "secondary"
  return "outline"
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return "Strong"
  if (confidence >= 0.7) return "Likely"
  return "Weak"
}

export function AiSuggestionsReview({ open, onOpenChange }: AiSuggestionsReviewProps) {
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const acceptAiSuggestions = useFinanceStore((s) => s.acceptAiSuggestions)
  const rejectAiSuggestions = useFinanceStore((s) => s.rejectAiSuggestions)
  const fmt = useFormatters()

  const [threshold, setThreshold] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  /** All transactions with a pending AI suggestion. */
  const pending = useMemo((): SuggestionRow[] => {
    return transactions
      .filter((t) => t.aiSuggestedCategoryId && !t.isTransfer)
      .map((t) => {
        const category = categoryMap.get(t.aiSuggestedCategoryId!)
        if (!category) return null
        return {
          transaction: t,
          category,
          confidence: t.aiConfidence ?? 0,
          reason: t.aiReason ?? "",
        }
      })
      .filter((r): r is SuggestionRow => r !== null)
      .sort((a, b) => b.confidence - a.confidence)
  }, [transactions, categoryMap])

  /** Apply confidence threshold filter. */
  const visible = useMemo(
    () => pending.filter((r) => r.confidence >= threshold / 100),
    [pending, threshold],
  )

  const visibleIds = useMemo(() => visible.map((r) => r.transaction.id), [visible])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someVisibleSelected = visibleIds.some((id) => selected.has(id))

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected((prev) => new Set([...prev, ...visibleIds]))
    else setSelected((prev) => { const next = new Set(prev); visibleIds.forEach((id) => next.delete(id)); return next })
  }

  const toggleRow = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleAccept = (ids: string[]) => {
    const count = acceptAiSuggestions(ids)
    toast.success(`Accepted ${count} suggestion${count !== 1 ? "s" : ""}`)
    setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next })
  }

  const handleReject = (ids: string[]) => {
    const count = rejectAiSuggestions(ids)
    toast(`Rejected ${count} suggestion${count !== 1 ? "s" : ""}`)
    setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next })
  }

  const handleAcceptSelected = () => {
    const ids = [...selected].filter((id) => visibleIds.includes(id))
    if (!ids.length) return
    handleAccept(ids)
  }

  const handleRejectSelected = () => {
    const ids = [...selected].filter((id) => visibleIds.includes(id))
    if (!ids.length) return
    handleReject(ids)
  }

  const handleAcceptAll = () => handleAccept(visibleIds)
  const handleRejectAll = () => handleReject(visibleIds)

  const handleAcceptHighConfidence = () => {
    const ids = pending.filter((r) => r.confidence >= 0.8).map((r) => r.transaction.id)
    handleAccept(ids)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            AI Category Suggestions
            {pending.length > 0 && (
              <Badge variant="secondary">{pending.length} pending</Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Review and accept or reject each suggestion. Your decisions are used to improve future recommendations.
          </SheetDescription>
        </SheetHeader>

        {/* Controls */}
        {pending.length > 0 && (
          <div className="px-4 py-3 border-b space-y-3">
            {/* Confidence slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Min confidence</span>
              <Slider
                value={[threshold]}
                min={0}
                max={100}
                step={5}
                onValueChange={(v) => {
                  const val = Array.isArray(v) ? v[0] : v
                  setThreshold(val ?? 0)
                }}
                className="flex-1"
              />
              <span className="text-xs tabular-nums w-8 text-right">{threshold}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {visible.length} of {pending.length} suggestion{pending.length !== 1 ? "s" : ""}
            </p>
            {/* Bulk actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleAcceptAll} disabled={visible.length === 0}>
                <CheckCircle2 className="size-3" />
                Accept all visible
              </Button>
              <Button size="sm" variant="outline" onClick={handleAcceptHighConfidence} disabled={!pending.some((r) => r.confidence >= 0.8)}>
                <CheckCircle2 className="size-3" />
                Accept ≥80%
              </Button>
              <Button size="sm" variant="outline" onClick={handleRejectAll} disabled={visible.length === 0}>
                <XCircle className="size-3" />
                Reject all visible
              </Button>
            </div>
            {someVisibleSelected && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleAcceptSelected}>
                  <CheckCircle2 className="size-3" />
                  Accept {[...selected].filter((id) => visibleIds.includes(id)).length} selected
                </Button>
                <Button size="sm" variant="outline" onClick={handleRejectSelected}>
                  <XCircle className="size-3" />
                  Reject selected
                </Button>
              </div>
            )}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            pending.length === 0 ? (
              <Empty className="min-h-[200px] border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CheckCircle2 className="size-4" />
                  </EmptyMedia>
                  <EmptyTitle>No pending suggestions</EmptyTitle>
                  <EmptyDescription>
                    Run "Suggest categories" from the AI toolbar to get started.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Empty className="min-h-[200px] border-0">
                <EmptyHeader>
                  <EmptyTitle>All suggestions filtered</EmptyTitle>
                  <EmptyDescription>Lower the confidence threshold to see more.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          ) : (
            <div>
              {/* Select all row */}
              <div className="px-4 py-2 border-b flex items-center gap-3 bg-muted/30">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) => toggleAll(!!checked)}
                  aria-label="Select all visible"
                />
                <span className="text-xs text-muted-foreground flex-1">Select all</span>
              </div>
              {visible.map((row) => {
                const Icon = categoryIcon(row.category.icon)
                const isSelected = selected.has(row.transaction.id)
                return (
                  <div
                    key={row.transaction.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 border-b transition-colors",
                      isSelected && "bg-accent/40",
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleRow(row.transaction.id, !!checked)}
                      aria-label={`Select ${row.transaction.payee}`}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium truncate max-w-[160px]">{row.transaction.payee}</span>
                        <span className={cn(
                          "text-xs tabular-nums font-medium",
                          row.transaction.amount < 0 ? "text-destructive" : "text-foreground",
                        )}>
                          {fmt.money(row.transaction.amount)}
                        </span>
                        <span className="text-xs text-muted-foreground">{fmt.shortDate(row.transaction.date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon className="size-3 shrink-0 text-muted-foreground" />
                        <span className="text-xs">{row.category.name}</span>
                        <Tooltip>
                          <TooltipTrigger render={<span />}>
                            <Badge variant={confidenceBadgeVariant(row.confidence)} className="text-[10px] h-4 px-1.5 cursor-default">
                              {confidenceLabel(row.confidence)} {Math.round(row.confidence * 100)}%
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[220px]">
                            <Info className="size-3 inline mr-1" />
                            {row.reason}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Tooltip>
                        <TooltipTrigger render={
                          <Toggle
                            size="sm"
                            variant="outline"
                            pressed={isSelected}
                            onPressedChange={(pressed) => {
                              if (pressed) handleAccept([row.transaction.id])
                            }}
                            aria-label={`Accept: ${row.transaction.payee} → ${row.category.name}`}
                            className="h-6 w-6 p-0 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border-primary/40"
                          >
                            <Check className="size-3.5" />
                          </Toggle>
                        } />
                        <TooltipContent>Accept</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger render={<Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Reject suggestion for ${row.transaction.payee}`}
                          className="h-6 w-6"
                          onClick={() => handleReject([row.transaction.id])}
                        />}>
                          <XCircle className="size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Reject</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer disclaimer */}
        <div className="px-4 py-2 border-t">
          <p className="text-[10px] text-muted-foreground">
            Matched from your own history — no data leaves your browser.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Inline loading state while suggestions are being computed. */
export function SuggestionsLoadingSpinner() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Spinner className="size-3.5" />
      <span>Analysing transactions…</span>
    </div>
  )
}
