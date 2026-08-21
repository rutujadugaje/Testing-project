import { useState } from "react"
import { Sparkles, Check, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import type { Category, Rule } from "@/types/finance"

type ProposedRule = Omit<Rule, "id" | "createdAt" | "timesApplied">

interface AIProposalsSectionProps {
  proposals: ProposedRule[]
  categories: Category[]
  onAccept: (proposal: ProposedRule) => void
  onAcceptAll: () => void
}

export function AIProposalsSection({
  proposals,
  categories,
  onAccept,
  onAcceptAll,
}: AIProposalsSectionProps) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [accepted, setAccepted] = useState<Set<number>>(new Set())

  const catLookup = new Map(categories.map((c) => [c.id, c]))

  function handleAccept(idx: number, proposal: ProposedRule) {
    onAccept(proposal)
    setAccepted((prev) => new Set([...prev, idx]))
  }

  function handleDismiss(idx: number) {
    setDismissed((prev) => new Set([...prev, idx]))
  }

  const visible = proposals.filter((_, i) => !dismissed.has(i))
  if (visible.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-sm font-medium">AI-proposed rules</h3>
        </div>
        <Button variant="outline" size="sm" onClick={onAcceptAll}>
          Accept all ({visible.filter((_, i) => !accepted.has(i)).length})
        </Button>
      </div>

      <div className="divide-y divide-border rounded-none border ring-1 ring-foreground/10">
        {proposals.map((proposal, idx) => {
          if (dismissed.has(idx)) return null
          const cat = proposal.setCategoryId ? catLookup.get(proposal.setCategoryId) : null
          const isAccepted = accepted.has(idx)

          const matchDesc =
            proposal.match.kind === "payee_contains"
              ? `Payee contains "${proposal.match.value}"`
              : proposal.match.kind === "payee_regex"
                ? `Payee /${proposal.match.value}/`
                : proposal.match.value ?? ""

          return (
            <div
              key={idx}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium truncate">{proposal.name}</span>
                  <Badge variant="secondary" className="gap-0.5 text-xs shrink-0">
                    <Sparkles className="size-2.5" />AI
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{matchDesc}</p>
                {cat && (
                  <Badge
                    variant="outline"
                    className="text-xs mt-0.5"
                    style={{ borderColor: cat.color, color: cat.color }}
                  >
                    → {cat.name}
                  </Badge>
                )}
              </div>

              {isAccepted ? (
                <Badge variant="secondary" className="gap-1">
                  <Check className="size-3" />Added
                </Badge>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleAccept(idx, proposal)}
                  >
                    <Check className="size-3" />
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Dismiss proposal"
                    onClick={() => handleDismiss(idx)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
