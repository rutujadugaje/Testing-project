/**
 * FillColumnDialog — derive tags or memo for target rows from a deterministic strategy.
 *
 * Strategies:
 *   tag_merchant  → match payee against category keyword patterns → tag (e.g. "groceries")
 *   tag_amount    → small (<20€) / medium (<100€) / large (≥100€)
 *   tag_account   → use account name as tag
 *   tag_month     → use transaction month as tag (e.g. "2026-07")
 *   memo_payee    → copy normalizePayee() into memo when memo is empty
 *
 * Shows a preview of the first ~8 rows before applying.
 * Apply calls addTagToTransactions / updateTransactions.
 * Every mutation gets a toast with real counts.
 */
import { useMemo, useState } from "react"
import { Tags, FileText } from "lucide-react"
import { toast } from "sonner"

import type { Transaction } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useFormatters } from "@/hooks/useAppSettings"
import { normalizePayee } from "@/lib/finance/calc"
import { toMajor } from "@/lib/finance/money"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// ---------------------------------------------------------------------------
// Strategy definitions
// ---------------------------------------------------------------------------

type Strategy =
  | "tag_merchant"
  | "tag_amount"
  | "tag_account"
  | "tag_month"
  | "memo_payee"

const STRATEGIES: { value: Strategy; label: string; description: string; icon: typeof Tags }[] = [
  {
    value: "tag_merchant",
    label: "Tag by merchant type",
    description: "Matches payee name to merchant categories (groceries, transport…)",
    icon: Tags,
  },
  {
    value: "tag_amount",
    label: "Tag by amount band",
    description: "small (<€20), medium (<€100), large (≥€100)",
    icon: Tags,
  },
  {
    value: "tag_account",
    label: "Tag by account",
    description: "Uses the transaction's account name as a tag",
    icon: Tags,
  },
  {
    value: "tag_month",
    label: "Tag by month",
    description: "Uses the transaction month (e.g. 2026-07) as a tag",
    icon: Tags,
  },
  {
    value: "memo_payee",
    label: "Fill memo from payee",
    description: "Copies the normalised payee name into memo when memo is empty",
    icon: FileText,
  },
]

// ---------------------------------------------------------------------------
// Merchant keyword → tag mapping (mirrors KEYWORD_HINTS in calc.ts)
// ---------------------------------------------------------------------------

const MERCHANT_TAGS: { pattern: RegExp; tag: string }[] = [
  { pattern: /carrefour|leclerc|lidl|monoprix|franprix|auchan|intermarch|casino|picard|grocer/i, tag: "groceries" },
  { pattern: /uber\s?eats|deliveroo|just\s?eat|restaurant|brasserie|boulangerie|cafe|starbucks|mcdo|burger/i, tag: "dining" },
  { pattern: /uber(?!\s?eats)|bolt|taxi|ratp|sncf|navigo|blablacar|trainline|velib/i, tag: "transport" },
  { pattern: /total|shell|esso|bp\b|station|essence|fuel|petrol/i, tag: "fuel" },
  { pattern: /netflix|spotify|disney|canal|prime\s?video|deezer|apple|youtube|audible|icloud|dropbox/i, tag: "subscriptions" },
  { pattern: /pharmacie|doctolib|medecin|dentiste|hopital|mutuelle|opticien/i, tag: "health" },
  { pattern: /decathlon|fnac|darty|amazon|zalando|zara|uniqlo|h&m|ikea|leroy/i, tag: "shopping" },
  { pattern: /cinema|ugc|pathe|theatre|concert|museum|steam|playstation|nintendo/i, tag: "entertainment" },
  { pattern: /orange|sfr|bouygues|free\s?mobile|sosh|telecom/i, tag: "telecom" },
  { pattern: /hotel|airbnb|booking|ryanair|easyjet|air\s?france|vol\b|flight/i, tag: "travel" },
]

// ---------------------------------------------------------------------------
// Value computation per strategy
// ---------------------------------------------------------------------------

function computeValue(
  t: Transaction,
  strategy: Strategy,
  accountName: string,
): string | null {
  switch (strategy) {
    case "tag_merchant": {
      const hint = MERCHANT_TAGS.find((h) => h.pattern.test(t.payee) || h.pattern.test(t.memo ?? ""))
      return hint?.tag ?? null
    }
    case "tag_amount": {
      const abs = Math.abs(toMajor(t.amount))
      if (abs < 20) return "small"
      if (abs < 100) return "medium"
      return "large"
    }
    case "tag_account":
      return accountName || null
    case "tag_month":
      return t.date.slice(0, 7) // YYYY-MM
    case "memo_payee":
      if (t.memo?.trim()) return null // only fill when empty
      return normalizePayee(t.payee).toLowerCase()
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface FillColumnDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Currently filtered / visible transactions — these are the targets. */
  filteredTransactions: Transaction[]
}

export function FillColumnDialog({ open, onOpenChange, filteredTransactions }: FillColumnDialogProps) {
  const transactions = useFinanceStore((s) => s.transactions)
  const accounts = useFinanceStore((s) => s.accounts)
  const addTagToTransactions = useFinanceStore((s) => s.addTagToTransactions)
  const updateTransactions = useFinanceStore((s) => s.updateTransactions)
  const fmt = useFormatters()

  const [strategy, setStrategy] = useState<Strategy>("tag_merchant")

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  // Compute target rows: if filteredTransactions is a subset use it, else all
  const targets = filteredTransactions.length > 0 ? filteredTransactions : transactions

  /** Map transaction id → computed value. */
  const computed = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const t of targets) {
      const acct = accountMap.get(t.accountId)
      map.set(t.id, computeValue(t, strategy, acct?.name ?? ""))
    }
    return map
  }, [targets, strategy, accountMap])

  const willChange = useMemo(
    () => targets.filter((t) => computed.get(t.id) !== null),
    [targets, computed],
  )

  /** Preview rows: first 8 that will change. */
  const previewRows = useMemo(() => willChange.slice(0, 8), [willChange])

  const isTagStrategy = strategy !== "memo_payee"

  const handleApply = () => {
    if (!willChange.length) {
      toast("Nothing to update — no matching rows found.")
      onOpenChange(false)
      return
    }

    if (isTagStrategy) {
      // Group by tag value so we call addTagToTransactions once per tag
      const byTag = new Map<string, string[]>()
      for (const t of willChange) {
        const tag = computed.get(t.id)!
        const list = byTag.get(tag) ?? []
        list.push(t.id)
        byTag.set(tag, list)
      }
      let totalTagged = 0
      for (const [tag, ids] of byTag) {
        totalTagged += addTagToTransactions(ids, tag)
      }
      toast.success(`Tagged ${totalTagged} transaction${totalTagged !== 1 ? "s" : ""}`)
    } else {
      // memo_payee: set memo per transaction individually (values differ per row)
      let count = 0
      for (const t of willChange) {
        const val = computed.get(t.id)
        if (val) count += updateTransactions([t.id], { memo: val })
      }
      toast.success(`Filled memo for ${count} transaction${count !== 1 ? "s" : ""}`)
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="size-4" />
            Fill Column
          </DialogTitle>
          <DialogDescription>
            Derive tags or memo for {targets.length} transaction{targets.length !== 1 ? "s" : ""} using a deterministic strategy.
            Preview what will be written before applying.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Strategy picker */}
          <RadioGroup
            value={strategy}
            onValueChange={(v) => v && setStrategy(v as Strategy)}
            className="gap-2"
          >
            {STRATEGIES.map((s) => (
              <label
                key={s.value}
                className="flex items-start gap-3 cursor-pointer rounded-none border border-border px-3 py-2.5 hover:bg-muted/50 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5 transition-colors"
              >
                <RadioGroupItem value={s.value} className="mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground">{s.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>

          {/* Summary */}
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary">{willChange.length} rows will change</Badge>
            {targets.length - willChange.length > 0 && (
              <span className="text-muted-foreground">
                {targets.length - willChange.length} skipped (no match or already set)
              </span>
            )}
          </div>

          {/* Preview table */}
          {previewRows.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                Preview (first {previewRows.length} rows)
              </p>
              <div className="border rounded-none overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] h-7">Date</TableHead>
                      <TableHead className="text-[10px] h-7">Payee</TableHead>
                      <TableHead className="text-[10px] h-7">Amount</TableHead>
                      <TableHead className="text-[10px] h-7">
                        {isTagStrategy ? "Tag" : "Memo"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((t) => (
                      <TableRow key={t.id} className="text-[10px]">
                        <TableCell className="py-1">{fmt.shortDate(t.date)}</TableCell>
                        <TableCell className="py-1 max-w-[120px] truncate">{t.payee}</TableCell>
                        <TableCell className="py-1 tabular-nums">{fmt.money(t.amount)}</TableCell>
                        <TableCell className="py-1">
                          <Badge variant="outline" className="text-[9px] h-4">
                            {computed.get(t.id) ?? "—"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {willChange.length > 8 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  …and {willChange.length - 8} more
                </p>
              )}
            </div>
          )}

          {willChange.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No rows match this strategy in the current view.
            </p>
          )}

          <p className="text-[10px] text-muted-foreground">
            All values are computed from your data locally — no data leaves your browser.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={willChange.length === 0}>
            Apply to {willChange.length} row{willChange.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
