/**
 * NlTransformDialog — natural-language transforms on selected/filtered transactions.
 *
 * Supported patterns (documented here for the user):
 *
 *   split <payee|selected> into <CatA> <X>% / <CatB> <Y>%
 *     → facade.splitTransaction on the first matching transaction (or selected)
 *
 *   categorize <payee|selected> as <Category>
 *     → updateTransactions patch categoryId
 *
 *   tag <payee|selected> as <tag>
 *     → addTagToTransactions
 *
 *   mark <payee|selected> as cleared|pending|reconciled
 *     → updateTransactions patch status
 *
 *   rename payee to <new name>     (applies to selected or filtered)
 *     → updateTransactions patch payee
 *
 * Parse runs live as the user types; a preview is shown before Apply is enabled.
 * No AI model is called — all operations are deterministic.
 */
import { useMemo, useState } from "react"
import { Sparkles, ChevronRight } from "lucide-react"
import { toast } from "sonner"

import type { Category, Transaction } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"
import { useFormatters } from "@/hooks/useAppSettings"
import { facade } from "@/lib/ai/store-facade"
import { normalizePayee } from "@/lib/finance/calc"
import { cn } from "@/lib/utils"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

// ---------------------------------------------------------------------------
// Parser types
// ---------------------------------------------------------------------------

type ParsedInstruction =
  | { kind: "split"; payeeOrSelected: string; parts: { category: string; weight: number }[] }
  | { kind: "categorize"; payeeOrSelected: string; category: string }
  | { kind: "tag"; payeeOrSelected: string; tag: string }
  | { kind: "mark"; payeeOrSelected: string; status: "cleared" | "pending" | "reconciled" }
  | { kind: "rename"; newPayee: string }
  | { kind: "error"; message: string }

/**
 * Deterministic parser — no AI call.
 *
 * Grammar (case-insensitive):
 *   split (selected|<payee>) into <Cat> <N>% / <Cat> <N>% [/ ...]
 *   categorize (selected|<payee>) as <Category>
 *   tag (selected|<payee>) as <tag>
 *   mark (selected|<payee>) as cleared|pending|reconciled
 *   rename payee to <new name>
 */
function parseInstruction(raw: string): ParsedInstruction {
  const s = raw.trim()
  if (!s) return { kind: "error", message: "Type an instruction above." }

  // split
  const splitMatch = s.match(/^split\s+(.+?)\s+into\s+(.+)$/i)
  if (splitMatch) {
    const subject = splitMatch[1].trim()
    const partsRaw = splitMatch[2]
    const partTokens = partsRaw.split(/\s*\/\s*/)
    const parts: { category: string; weight: number }[] = []
    for (const token of partTokens) {
      const m = token.match(/^(.+?)\s+([\d.]+)\s*%$/i)
      if (!m) return { kind: "error", message: `Cannot parse split part: "${token}". Format: Category X%` }
      parts.push({ category: m[1].trim(), weight: parseFloat(m[2]) })
    }
    const total = parts.reduce((s, p) => s + p.weight, 0)
    if (Math.abs(total - 100) > 0.5) return { kind: "error", message: `Split percentages must sum to 100% (got ${total.toFixed(1)}%)` }
    return { kind: "split", payeeOrSelected: subject, parts }
  }

  // categorize
  const catMatch = s.match(/^categor(?:ize|ise)\s+(.+?)\s+as\s+(.+)$/i)
  if (catMatch) {
    return { kind: "categorize", payeeOrSelected: catMatch[1].trim(), category: catMatch[2].trim() }
  }

  // tag
  const tagMatch = s.match(/^tag\s+(.+?)\s+as\s+(.+)$/i)
  if (tagMatch) {
    return { kind: "tag", payeeOrSelected: tagMatch[1].trim(), tag: tagMatch[2].trim() }
  }

  // mark
  const markMatch = s.match(/^mark\s+(.+?)\s+as\s+(cleared|pending|reconciled)$/i)
  if (markMatch) {
    return {
      kind: "mark",
      payeeOrSelected: markMatch[1].trim(),
      status: markMatch[2].toLowerCase() as "cleared" | "pending" | "reconciled",
    }
  }

  // rename
  const renameMatch = s.match(/^rename\s+payee\s+to\s+(.+)$/i)
  if (renameMatch) {
    return { kind: "rename", newPayee: renameMatch[1].trim() }
  }

  return { kind: "error", message: "Instruction not recognized. See the examples below." }
}

// ---------------------------------------------------------------------------
// Preview generator
// ---------------------------------------------------------------------------

interface Preview {
  summary: string
  affectedCount: number
  details?: string
}

function buildPreview(
  parsed: ParsedInstruction,
  selectedIds: string[],
  filteredTransactions: Transaction[],
  allTransactions: Transaction[],
  categories: Category[],
  fmt: ReturnType<typeof useFormatters>,
): Preview | null {
  if (parsed.kind === "error") return null

  const isSelected = (s: string) => /^selected$/i.test(s)

  const resolveTargets = (subject: string): Transaction[] => {
    if (isSelected(subject)) {
      return allTransactions.filter((t) => selectedIds.includes(t.id))
    }
    const needle = normalizePayee(subject)
    const pool = filteredTransactions.length > 0 ? filteredTransactions : allTransactions
    return pool.filter((t) => normalizePayee(t.payee).includes(needle))
  }

  if (parsed.kind === "split") {
    const targets = resolveTargets(parsed.payeeOrSelected)
    if (!targets.length) return { summary: "No matching transactions found.", affectedCount: 0 }
    const t = targets[0]
    const parts = parsed.parts
      .map((p) => {
        const amount = Math.round((t.amount * p.weight) / 100)
        return `${p.category} ${p.weight}% (${fmt.money(amount)})`
      })
      .join(" / ")
    return {
      summary: `Will split "${t.payee}" into: ${parts}`,
      affectedCount: 1,
      details: targets.length > 1 ? `(only the first matching transaction will be split)` : undefined,
    }
  }

  if (parsed.kind === "categorize") {
    const targets = resolveTargets(parsed.payeeOrSelected)
    const cat = categories.find(
      (c) => c.name.toLowerCase() === parsed.category.toLowerCase() ||
        c.name.toLowerCase().includes(parsed.category.toLowerCase()),
    )
    if (!cat) return { summary: `Category "${parsed.category}" not found.`, affectedCount: 0 }
    return {
      summary: `Will set category to "${cat.name}" for ${targets.length} transaction${targets.length !== 1 ? "s" : ""}`,
      affectedCount: targets.length,
    }
  }

  if (parsed.kind === "tag") {
    const targets = resolveTargets(parsed.payeeOrSelected)
    return {
      summary: `Will add tag "${parsed.tag}" to ${targets.length} transaction${targets.length !== 1 ? "s" : ""}`,
      affectedCount: targets.length,
    }
  }

  if (parsed.kind === "mark") {
    const targets = resolveTargets(parsed.payeeOrSelected)
    return {
      summary: `Will mark ${targets.length} transaction${targets.length !== 1 ? "s" : ""} as ${parsed.status}`,
      affectedCount: targets.length,
    }
  }

  if (parsed.kind === "rename") {
    const targets = selectedIds.length > 0
      ? allTransactions.filter((t) => selectedIds.includes(t.id))
      : filteredTransactions.length > 0
        ? filteredTransactions
        : allTransactions
    return {
      summary: `Will rename payee to "${parsed.newPayee}" for ${targets.length} transaction${targets.length !== 1 ? "s" : ""}`,
      affectedCount: targets.length,
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Examples chips
// ---------------------------------------------------------------------------

const EXAMPLES = [
  "Split selected into Transport 80% / Restaurants 20%",
  "Categorize Carrefour as Groceries",
  "Tag selected as business",
  "Mark selected as cleared",
  "Rename payee to Netflix",
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface NlTransformDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The currently filtered transactions in the grid (for payee matching). */
  filteredTransactions: Transaction[]
}

export function NlTransformDialog({ open, onOpenChange, filteredTransactions }: NlTransformDialogProps) {
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const updateTransactions = useFinanceStore((s) => s.updateTransactions)
  const addTagToTransactions = useFinanceStore((s) => s.addTagToTransactions)
  const selectedIds = useUiStore((s) => s.selectedTransactionIds)
  const fmt = useFormatters()

  const [instruction, setInstruction] = useState("")

  const parsed = useMemo(() => parseInstruction(instruction), [instruction])

  const preview = useMemo(
    () => buildPreview(parsed, selectedIds, filteredTransactions, transactions, categories, fmt),
    [parsed, selectedIds, filteredTransactions, transactions, categories, fmt],
  )

  const canApply = parsed.kind !== "error" && (preview?.affectedCount ?? 0) > 0

  const handleApply = () => {
    if (!canApply) return
    // After canApply check, parsed.kind is guaranteed not "error"
    const instruction = parsed as Exclude<ParsedInstruction, { kind: "error" }>

    const isSelected = (s: string) => /^selected$/i.test(s)

    const resolveTargets = (subject: string): Transaction[] => {
      if (isSelected(subject)) return transactions.filter((t) => selectedIds.includes(t.id))
      const needle = normalizePayee(subject)
      const pool = filteredTransactions.length > 0 ? filteredTransactions : transactions
      return pool.filter((t) => normalizePayee(t.payee).includes(needle))
    }

    if (instruction.kind === "split") {
      const targets = resolveTargets(instruction.payeeOrSelected)
      if (!targets.length) { toast.error("No matching transaction found."); return }
      const t = targets[0]
      const result = facade.splitTransaction({
        transactionId: t.id,
        parts: instruction.parts.map((p) => ({ categoryOrName: p.category, weight: p.weight })),
      })
      if (result.ok) {
        toast.success(`Split "${t.payee}" into ${result.parts.length} parts`)
      } else {
        toast.error(result.error)
        return
      }
    }

    if (instruction.kind === "categorize") {
      const targets = resolveTargets(instruction.payeeOrSelected)
      const cat = categories.find(
        (c) => c.name.toLowerCase() === instruction.category.toLowerCase() ||
          c.name.toLowerCase().includes(instruction.category.toLowerCase()),
      )
      if (!cat) { toast.error(`Category "${instruction.category}" not found.`); return }
      const count = updateTransactions(targets.map((t) => t.id), { categoryId: cat.id })
      toast.success(`Categorized ${count} transaction${count !== 1 ? "s" : ""} as ${cat.name}`)
    }

    if (instruction.kind === "tag") {
      const targets = resolveTargets(instruction.payeeOrSelected)
      const count = addTagToTransactions(targets.map((t) => t.id), instruction.tag)
      toast.success(`Tagged ${count} transaction${count !== 1 ? "s" : ""} as "${instruction.tag}"`)
    }

    if (instruction.kind === "mark") {
      const targets = resolveTargets(instruction.payeeOrSelected)
      const count = updateTransactions(targets.map((t) => t.id), { status: instruction.status })
      toast.success(`Marked ${count} transaction${count !== 1 ? "s" : ""} as ${instruction.status}`)
    }

    if (instruction.kind === "rename") {
      const targets = selectedIds.length > 0
        ? transactions.filter((t) => selectedIds.includes(t.id))
        : filteredTransactions.length > 0
          ? filteredTransactions
          : transactions
      const count = updateTransactions(targets.map((t) => t.id), { payee: instruction.newPayee })
      toast.success(`Renamed payee to "${instruction.newPayee}" for ${count} transaction${count !== 1 ? "s" : ""}`)
    }

    setInstruction("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Transform Transactions
          </DialogTitle>
          <DialogDescription>
            Type a natural-language instruction to apply to the selected or filtered rows.
            Preview appears as you type — no changes until you press Apply.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Instruction input */}
          <div className="space-y-1.5">
            <Input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canApply) handleApply() }}
              placeholder="e.g. Categorize Carrefour as Groceries"
              className="text-xs"
              autoFocus
            />
            {/* Parse error */}
            {instruction.length > 3 && parsed.kind === "error" && (
              <p className="text-xs text-destructive">{parsed.message}</p>
            )}
          </div>

          {/* Live preview */}
          {preview && (
            <div className={cn(
              "rounded-none border px-3 py-2 text-xs space-y-1",
              preview.affectedCount === 0 ? "border-destructive/50 bg-destructive/5 text-destructive" : "border-border bg-muted/40"
            )}>
              <div className="flex items-start gap-2">
                <ChevronRight className="size-3 mt-0.5 shrink-0" />
                <span>{preview.summary}</span>
              </div>
              {preview.details && (
                <p className="text-muted-foreground pl-5 text-[10px]">{preview.details}</p>
              )}
              {preview.affectedCount > 0 && (
                <p className="text-muted-foreground pl-5 text-[10px]">
                  Affects {preview.affectedCount} row{preview.affectedCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

          {/* Example chips */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Examples</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setInstruction(ex)}
                  className="text-[10px] px-2 py-0.5 rounded-none border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Context hint */}
          <div className="flex gap-2 flex-wrap">
            {selectedIds.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {selectedIds.length} row{selectedIds.length !== 1 ? "s" : ""} selected
              </Badge>
            )}
            {filteredTransactions.length > 0 && filteredTransactions.length !== useFinanceStore.getState().transactions.length && (
              <Badge variant="outline" className="text-[10px]">
                {filteredTransactions.length} rows in filter
              </Badge>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground">
            All transforms run locally — no data leaves your browser.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!canApply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
