/**
 * AiGridToolbar — always-visible AI strip above the transactions grid.
 *
 * Buttons:
 *  - Suggest categories  → facade.suggestCategories, spinner, toast, opens review sheet
 *  - Detect anomalies    → facade.detectAnomalies, opens anomaly panel
 *  - Transform…          → opens NlTransformDialog
 *  - Fill column…        → opens FillColumnDialog
 *  - Propose rules       → proposeRulesFromHistory, shown in a Popover with Accept buttons
 *  - Ask the agent       → useUiStore.askAgent with selection-aware prompt
 *
 * Status line below the buttons: uncategorized count, pending AI suggestions count.
 * When suggestions are pending: Accept all / Accept high confidence (≥80%) / Reject all.
 *
 * Design: compact, AI-flavoured card strip. Clearly labeled as local heuristics,
 * not a cloud model.
 */
import { useMemo, useState } from "react"
import {
  Sparkles,
  AlertTriangle,
  Wand2,
  Tags,
  BookMarked,
  BotMessageSquare,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import type { Transaction } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"
import { facade } from "@/lib/ai/store-facade"
import { proposeRulesFromHistory } from "@/lib/finance/calc"
import { categoryIcon } from "@/lib/icons"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ButtonGroup } from "@/components/ui/button-group"
import { AiSuggestionsReview } from "./AiSuggestionsReview"
import { AiAnomalyPanel } from "./AiAnomalyPanel"
import { NlTransformDialog } from "./NlTransformDialog"
import { FillColumnDialog } from "./FillColumnDialog"

interface AiGridToolbarProps {
  filteredTransactions: Transaction[]
}

export function AiGridToolbar({ filteredTransactions }: AiGridToolbarProps) {
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const rules = useFinanceStore((s) => s.rules)
  const acceptAiSuggestions = useFinanceStore((s) => s.acceptAiSuggestions)
  const rejectAiSuggestions = useFinanceStore((s) => s.rejectAiSuggestions)
  const addRule = useFinanceStore((s) => s.addRule)

  const selectedIds = useUiStore((s) => s.selectedTransactionIds)
  const askAgent = useUiStore((s) => s.askAgent)
  const navigate = useNavigate()

  // Panel state
  const [reviewOpen, setReviewOpen] = useState(false)
  const [anomalyOpen, setAnomalyOpen] = useState(false)
  const [transformOpen, setTransformOpen] = useState(false)
  const [fillOpen, setFillOpen] = useState(false)
  const [rulesPopoverOpen, setRulesPopoverOpen] = useState(false)

  // Action loading state
  const [suggestPending, setSuggestPending] = useState(false)
  const [anomalyPending, setAnomalyPending] = useState(false)

  // Anomaly result (stored after detection)
  const [detectedAnomalies, setDetectedAnomalies] = useState<
    ReturnType<typeof facade.detectAnomalies>["anomalies"]
  >([])

  // -----------------------------------------------------------------------
  // Derived counts (stable refs, no new arrays inside selectors)
  // -----------------------------------------------------------------------

  const uncategorizedCount = useMemo(
    () => transactions.filter((t) => !t.categoryId && !t.isTransfer).length,
    [transactions],
  )

  const pendingSuggestions = useMemo(
    () => transactions.filter((t) => !!t.aiSuggestedCategoryId && !t.isTransfer),
    [transactions],
  )

  const highConfidenceIds = useMemo(
    () => pendingSuggestions.filter((t) => (t.aiConfidence ?? 0) >= 0.8).map((t) => t.id),
    [pendingSuggestions],
  )

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  // Rule proposals (computed fresh on open)
  const ruleProposals = useMemo(
    () => proposeRulesFromHistory(transactions, categories, rules).slice(0, 6),
    [transactions, categories, rules],
  )

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleSuggestCategories = async () => {
    setSuggestPending(true)
    // Small delay so spinner is visible even when the computation is instant
    await new Promise((r) => setTimeout(r, 350))
    const result = facade.suggestCategories({
      transactionIds: selectedIds.length > 0 ? selectedIds : undefined,
    })
    setSuggestPending(false)

    if (result.suggested === 0) {
      toast("No suggestions found", {
        description:
          result.considered === 0
            ? "All selected transactions are already categorized."
            : "Could not match these transactions to any known categories.",
      })
      return
    }

    toast.success(
      `${result.suggested} suggestion${result.suggested !== 1 ? "s" : ""} ready`,
      {
        description: `${result.unmatched} transaction${result.unmatched !== 1 ? "s" : ""} could not be matched. Review and accept or reject each suggestion.`,
        action: { label: "Review", onClick: () => setReviewOpen(true) },
      },
    )
    setReviewOpen(true)
  }

  const handleDetectAnomalies = async () => {
    setAnomalyPending(true)
    await new Promise((r) => setTimeout(r, 200))
    const result = facade.detectAnomalies()
    setDetectedAnomalies(result.anomalies)
    setAnomalyPending(false)

    if (result.count === 0) {
      toast("No anomalies found — data looks clean!")
      return
    }

    toast(`${result.count} anomal${result.count === 1 ? "y" : "ies"} detected`, {
      action: { label: "Review", onClick: () => setAnomalyOpen(true) },
    })
    setAnomalyOpen(true)
  }

  const handleAcceptAll = () => {
    const count = acceptAiSuggestions(pendingSuggestions.map((t) => t.id))
    toast.success(`Accepted all ${count} suggestion${count !== 1 ? "s" : ""}`)
  }

  const handleAcceptHighConfidence = () => {
    if (!highConfidenceIds.length) return
    const count = acceptAiSuggestions(highConfidenceIds)
    toast.success(`Accepted ${count} high-confidence suggestion${count !== 1 ? "s" : ""} (≥80%)`)
  }

  const handleRejectAll = () => {
    const count = rejectAiSuggestions(pendingSuggestions.map((t) => t.id))
    toast(`Rejected ${count} suggestion${count !== 1 ? "s" : ""}`)
  }

  const handleAskAgent = () => {
    const selCount = selectedIds.length
    const prompt =
      selCount > 0
        ? `Analyse the ${selCount} selected transaction${selCount !== 1 ? "s" : ""} and tell me what you notice.`
        : `What patterns do you see in my ${filteredTransactions.length} transactions? Any unusual spending or opportunities to save?`
    askAgent(prompt)
  }

  const handleAcceptRule = (proposal: typeof ruleProposals[0]) => {
    addRule({
      name: proposal.name,
      match: proposal.match,
      setCategoryId: proposal.setCategoryId,
      setTags: proposal.setTags,
      priority: proposal.priority,
      enabled: true,
      aiSuggested: true,
    })
    toast.success(`Rule "${proposal.name}" added`)
    setRulesPopoverOpen(false)
  }

  return (
    <>
      <div className="flex flex-col gap-2 rounded-none border border-primary/20 bg-primary/5 px-3 py-2.5">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 mr-1">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">AI Actions</span>
          </div>
          <Separator orientation="vertical" className="h-4" />

          <ButtonGroup>
          {/* Suggest categories */}
          <Tooltip>
            <TooltipTrigger render={<Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5"
              onClick={handleSuggestCategories}
              disabled={suggestPending}
              aria-label="Suggest categories for uncategorized transactions"
            />}>
              {suggestPending ? <Spinner className="size-3" /> : <Sparkles className="size-3" />}
              Suggest categories
            </TooltipTrigger>
            <TooltipContent>
              {selectedIds.length > 0
                ? `Suggest for ${selectedIds.length} selected row${selectedIds.length !== 1 ? "s" : ""}`
                : `Suggest for all ${uncategorizedCount} uncategorized`}
            </TooltipContent>
          </Tooltip>

          {/* Detect anomalies */}
          <Tooltip>
            <TooltipTrigger render={<Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5"
              onClick={handleDetectAnomalies}
              disabled={anomalyPending}
              aria-label="Detect anomalies in transactions"
            />}>
              {anomalyPending ? <Spinner className="size-3" /> : <AlertTriangle className="size-3" />}
              Detect anomalies
            </TooltipTrigger>
            <TooltipContent>Find duplicates, unusual amounts, uncategorized spend</TooltipContent>
          </Tooltip>

          {/* Transform */}
          <Tooltip>
            <TooltipTrigger render={<Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5"
              onClick={() => setTransformOpen(true)}
              aria-label="Open natural-language transform dialog"
            />}>
              <Wand2 className="size-3" />
              Transform…
            </TooltipTrigger>
            <TooltipContent>Natural-language transforms (split, categorize, tag, rename…)</TooltipContent>
          </Tooltip>

          {/* Fill column */}
          <Tooltip>
            <TooltipTrigger render={<Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5"
              onClick={() => setFillOpen(true)}
              aria-label="Open fill column dialog"
            />}>
              <Tags className="size-3" />
              Fill column…
            </TooltipTrigger>
            <TooltipContent>Derive tags or memo from merchant type, amount, account, or month</TooltipContent>
          </Tooltip>

          {/* Propose rules */}
          <Popover open={rulesPopoverOpen} onOpenChange={setRulesPopoverOpen}>
            <Tooltip>
              <TooltipTrigger render={<PopoverTrigger render={<Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1.5"
                aria-label="Propose automation rules from transaction history"
              />} />}>
                <BookMarked className="size-3" />
                Propose rules
              </TooltipTrigger>
              <TooltipContent>Auto-generate rules from recurring payee patterns</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" side="bottom" className="w-80 p-0">
              <div className="px-3 py-2 border-b flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Rule Proposals</p>
                  <p className="text-[10px] text-muted-foreground">Based on your transaction history</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2 text-primary"
                  onClick={() => { navigate("/rules"); setRulesPopoverOpen(false) }}
                >
                  All rules <ChevronRight className="size-2.5" />
                </Button>
              </div>
              {ruleProposals.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                  Not enough pattern data yet. Categorize more transactions first.
                </div>
              ) : (
                <div className="divide-y max-h-72 overflow-y-auto">
                  {ruleProposals.map((proposal, i) => {
                    const cat = proposal.setCategoryId ? categoryMap.get(proposal.setCategoryId) : undefined
                    const Icon = cat ? categoryIcon(cat.icon) : Sparkles
                    return (
                      <div key={i} className="flex items-center gap-2 px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{proposal.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {cat && <Icon className="size-3 text-muted-foreground shrink-0" />}
                            <span className="text-[10px] text-muted-foreground truncate">
                              {cat?.name ?? "No category"}
                              {proposal.match.value && ` · matches "${proposal.match.value}"`}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 shrink-0"
                          onClick={() => handleAcceptRule(proposal)}
                        >
                          Accept
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="px-3 py-2 border-t">
                <p className="text-[10px] text-muted-foreground">
                  Rules are matched locally — no data leaves your browser.
                </p>
              </div>
            </PopoverContent>
          </Popover>

          {/* Ask the agent */}
          <Tooltip>
            <TooltipTrigger render={<Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5"
              onClick={handleAskAgent}
              aria-label="Ask the AI agent about these transactions"
            />}>
              <BotMessageSquare className="size-3" />
              Ask agent
              {selectedIds.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 text-[9px] h-3.5 px-1">
                  {selectedIds.length}
                </Badge>
              )}
            </TooltipTrigger>
            <TooltipContent>
              {selectedIds.length > 0
                ? `Ask the agent to analyse ${selectedIds.length} selected row${selectedIds.length !== 1 ? "s" : ""}`
                : "Ask the agent about your transactions"}
            </TooltipContent>
          </Tooltip>
          </ButtonGroup>
        </div>

        {/* Status line */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          {uncategorizedCount > 0 && (
            <span>
              <span className="font-medium text-amber-600">{uncategorizedCount}</span>{" "}
              uncategorized
            </span>
          )}
          {uncategorizedCount > 0 && pendingSuggestions.length > 0 && (
            <Separator orientation="vertical" className="h-3" />
          )}
          {pendingSuggestions.length > 0 && (
            <>
              <span>
                <span className="font-medium text-primary">{pendingSuggestions.length}</span>{" "}
                AI suggestion{pendingSuggestions.length !== 1 ? "s" : ""} pending
              </span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  className="text-xs underline-offset-2 hover:underline text-primary"
                  onClick={handleAcceptAll}
                >
                  <CheckCircle2 className="size-3 inline mr-0.5" />
                  Accept all
                </button>
                {highConfidenceIds.length > 0 && (
                  <button
                    className="text-xs underline-offset-2 hover:underline text-primary"
                    onClick={handleAcceptHighConfidence}
                  >
                    <CheckCircle2 className="size-3 inline mr-0.5" />
                    Accept high confidence ({highConfidenceIds.length})
                  </button>
                )}
                <button
                  className="text-xs underline-offset-2 hover:underline text-muted-foreground"
                  onClick={handleRejectAll}
                >
                  <XCircle className="size-3 inline mr-0.5" />
                  Reject all
                </button>
                <button
                  className="text-xs underline-offset-2 hover:underline text-primary"
                  onClick={() => setReviewOpen(true)}
                >
                  Review…
                </button>
              </div>
            </>
          )}
          {uncategorizedCount === 0 && pendingSuggestions.length === 0 && (
            <span className="text-[10px]">All transactions categorized · Matched from your history, no data leaves your browser.</span>
          )}
          {(uncategorizedCount > 0 || pendingSuggestions.length > 0) && (
            <span className="text-[10px] ml-auto opacity-70">Heuristics · local, no model</span>
          )}
        </div>
      </div>

      {/* Panels */}
      <AiSuggestionsReview open={reviewOpen} onOpenChange={setReviewOpen} />
      <AiAnomalyPanel
        open={anomalyOpen}
        onOpenChange={setAnomalyOpen}
        anomalies={detectedAnomalies}
      />
      <NlTransformDialog
        open={transformOpen}
        onOpenChange={setTransformOpen}
        filteredTransactions={filteredTransactions}
      />
      <FillColumnDialog
        open={fillOpen}
        onOpenChange={setFillOpen}
        filteredTransactions={filteredTransactions}
      />
    </>
  )
}
