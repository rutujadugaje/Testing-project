/**
 * AiAnomalyPanel — sheet listing detected anomalies grouped by severity.
 *
 * Anomalies are detected locally via detectAnomalies (heuristics, no model).
 * "Show these rows" sets the grid selection via useUiStore.
 * "Delete duplicate" goes through AlertDialog + undo toast.
 * "Ask the agent" fires askAgent with context.
 */
import { useMemo, useState } from "react"
import {
  AlertTriangle,
  BadgeAlert,
  ChevronRight,
  Trash2,
  ExternalLink,
  BotMessageSquare,
} from "lucide-react"
import { toast } from "sonner"

import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"
import { cn } from "@/lib/utils"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"

interface AiAnomalyPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Anomalies returned by facade.detectAnomalies() */
  anomalies: ReturnType<typeof import("@/lib/ai/store-facade").facade.detectAnomalies>["anomalies"]
}

type Severity = "high" | "medium" | "low"

const SEVERITY_ORDER: Severity[] = ["high", "medium", "low"]

const SEVERITY_LABEL: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

const SEVERITY_COLOR: Record<Severity, string> = {
  high: "text-destructive",
  medium: "text-amber-600",
  low: "text-muted-foreground",
}

interface DeleteConfirmProps {
  open: boolean
  anomaly: AiAnomalyPanelProps["anomalies"][0] | null
  onConfirm: () => void
  onCancel: () => void
}

function DeleteDuplicateDialog({ open, anomaly, onConfirm, onCancel }: DeleteConfirmProps) {
  if (!anomaly) return null
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete duplicate transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete {anomaly.transactionCount - 1} duplicate{anomaly.transactionCount > 2 ? "s" : ""} of "{anomaly.title.replace("Possible duplicate: ", "")}". You can undo immediately after.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>Delete duplicates</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function AiAnomalyPanel({ open, onOpenChange, anomalies }: AiAnomalyPanelProps) {
  const transactions = useFinanceStore((s) => s.transactions)
  const deleteTransactions = useFinanceStore((s) => s.deleteTransactions)
  const restoreTransactions = useFinanceStore((s) => s.restoreTransactions)
  const setSelectedIds = useUiStore((s) => s.setSelectedTransactionIds)
  const askAgent = useUiStore((s) => s.askAgent)

  const [deleteTarget, setDeleteTarget] = useState<AiAnomalyPanelProps["anomalies"][0] | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<Severity, typeof anomalies>()
    for (const sev of SEVERITY_ORDER) map.set(sev, [])
    for (const a of anomalies) {
      const sev = (a.severity as Severity) ?? "low"
      const list = map.get(sev)
      if (list) list.push(a)
    }
    return map
  }, [anomalies])

  const counts = useMemo(() => {
    const total: Record<Severity, number> = { high: 0, medium: 0, low: 0 }
    for (const sev of SEVERITY_ORDER) total[sev] = grouped.get(sev)?.length ?? 0
    return total
  }, [grouped])

  const handleFocusTransactions = (ids: string[]) => {
    setSelectedIds(ids)
    onOpenChange(false)
    toast(`Selected ${ids.length} transaction${ids.length !== 1 ? "s" : ""} in the grid`)
  }

  const handleDeleteDuplicate = (anomaly: AiAnomalyPanelProps["anomalies"][0]) => {
    setDeleteTarget(anomaly)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    // Keep the first transaction, delete the rest (duplicates)
    const idsToDelete = deleteTarget.transactionIds.slice(1)
    const doomed = transactions.filter((t) => idsToDelete.includes(t.id))
    const removed = deleteTransactions(idsToDelete)
    toast(`Deleted ${removed} duplicate${removed !== 1 ? "s" : ""}`, {
      action: {
        label: "Undo",
        onClick: () => restoreTransactions(doomed),
      },
    })
    setDeleteTarget(null)
  }

  const handleAskAgent = (anomaly: AiAnomalyPanelProps["anomalies"][0]) => {
    askAgent(`Explain this anomaly and suggest what to do: ${anomaly.title}. ${anomaly.description}`)
    onOpenChange(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="px-4 pt-4 pb-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <BadgeAlert className="size-4" />
              Anomalies Detected
              {anomalies.length > 0 && (
                <Badge variant="secondary">{anomalies.length}</Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              Heuristic checks on your data — duplicates, unusual amounts, and uncategorized spend.
            </SheetDescription>
          </SheetHeader>

          {/* Summary counts */}
          {anomalies.length > 0 && (
            <div className="px-4 py-3 border-b flex gap-4">
              {SEVERITY_ORDER.map((sev) => (
                counts[sev] > 0 && (
                  <div key={sev} className="flex items-center gap-1.5">
                    <AlertTriangle className={cn("size-3", SEVERITY_COLOR[sev])} />
                    <span className="text-xs">
                      <span className="font-medium">{counts[sev]}</span>{" "}
                      <span className="text-muted-foreground">{SEVERITY_LABEL[sev].toLowerCase()}</span>
                    </span>
                  </div>
                )
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {anomalies.length === 0 ? (
              <Empty className="min-h-[200px] border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <AlertTriangle className="size-4" />
                  </EmptyMedia>
                  <EmptyTitle>No anomalies found</EmptyTitle>
                  <EmptyDescription>Your transaction data looks clean!</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="divide-y">
                {SEVERITY_ORDER.map((sev) => {
                  const items = grouped.get(sev) ?? []
                  if (!items.length) return null
                  return (
                    <div key={sev}>
                      <div className="px-4 py-2 bg-muted/30 flex items-center gap-2">
                        <AlertTriangle className={cn("size-3", SEVERITY_COLOR[sev])} />
                        <span className="text-xs font-medium">{SEVERITY_LABEL[sev]} severity</span>
                        <span className="text-xs text-muted-foreground">({items.length})</span>
                      </div>
                      {items.map((anomaly) => (
                        <AnomalyItem
                          key={anomaly.id}
                          anomaly={anomaly}
                          onFocus={() => handleFocusTransactions(anomaly.transactionIds)}
                          onDelete={anomaly.kind === "duplicate" ? () => handleDeleteDuplicate(anomaly) : undefined}
                          onAskAgent={() => handleAskAgent(anomaly)}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="px-4 py-2 border-t">
            <p className="text-[10px] text-muted-foreground">
              Detected locally from your own history — no data leaves your browser.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <DeleteDuplicateDialog
        open={!!deleteTarget}
        anomaly={deleteTarget}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

function AnomalyItem({
  anomaly,
  onFocus,
  onDelete,
  onAskAgent,
}: {
  anomaly: AiAnomalyPanelProps["anomalies"][0]
  onFocus: () => void
  onDelete?: () => void
  onAskAgent: () => void
}) {
  return (
    <div className="px-4 py-3 border-b last:border-0 space-y-2">
      <Alert className="border-0 p-0 gap-2 bg-transparent rounded-none">
        <AlertTitle className="text-xs font-medium">{anomaly.title}</AlertTitle>
        <AlertDescription className="text-[11px]">
          {anomaly.description}
          {anomaly.amount && (
            <span className="ml-1 font-medium text-destructive">
              ({anomaly.amount})
            </span>
          )}
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] px-2"
          onClick={onFocus}
          aria-label={`Show ${anomaly.transactionCount} related transaction${anomaly.transactionCount !== 1 ? "s" : ""} in grid`}
        >
          <ExternalLink className="size-2.5" />
          Show {anomaly.transactionCount} row{anomaly.transactionCount !== 1 ? "s" : ""}
          <ChevronRight className="size-2.5" />
        </Button>
        {onDelete && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={onDelete}
            aria-label="Delete duplicate transaction"
          >
            <Trash2 className="size-2.5" />
            Delete duplicate
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] px-2 text-muted-foreground"
          onClick={onAskAgent}
          aria-label="Ask the AI agent about this anomaly"
        >
          <BotMessageSquare className="size-2.5" />
          Ask agent
        </Button>
      </div>
    </div>
  )
}
