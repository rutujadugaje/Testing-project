import { useMemo, useState } from "react"
import { Plus, Play, Bot, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { PageHeader, PageShell } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from "@/components/ui/empty"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Button as ButtonComp } from "@/components/ui/button"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"
import { proposeRulesFromHistory } from "@/lib/finance/calc"
import { useFormatters } from "@/hooks/useAppSettings"

import { RuleDialog } from "@/components/rules/RuleDialog"
import { AIProposalsSection } from "@/components/rules/AIProposalsSection"

function matchDescription(rule: { match: { kind: string; value?: string; min?: number; max?: number } }, fmt: ReturnType<typeof useFormatters>): string {
  switch (rule.match.kind) {
    case "payee_contains":
      return `Payee contains "${rule.match.value ?? ""}"`
    case "payee_regex":
      return `Payee matches /${rule.match.value ?? ""}/`
    case "memo_contains":
      return `Memo contains "${rule.match.value ?? ""}"`
    case "amount_range": {
      const min = rule.match.min != null ? fmt.money(rule.match.min) : null
      const max = rule.match.max != null ? fmt.money(rule.match.max) : null
      if (min && max) return `Amount ${min} – ${max}`
      if (min) return `Amount ≥ ${min}`
      if (max) return `Amount ≤ ${max}`
      return "Amount range"
    }
    default:
      return "Unknown matcher"
  }
}

export default function RulesPage() {
  const fmt = useFormatters()
  const rules = useFinanceStore((s) => s.rules)
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const toggleRule = useFinanceStore((s) => s.toggleRule)
  const deleteRule = useFinanceStore((s) => s.deleteRule)
  const runRules = useFinanceStore((s) => s.runRules)
  const addRule = useFinanceStore((s) => s.addRule)
  const askAgent = useUiStore((s) => s.askAgent)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editRuleId, setEditRuleId] = useState<string | undefined>()

  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => a.priority - b.priority),
    [rules],
  )

  const proposals = useMemo(
    () => proposeRulesFromHistory(transactions, categories, rules),
    [transactions, categories, rules],
  )

  function handleRunRules() {
    const changed = runRules({ overwrite: false })
    toast.success(changed > 0 ? `Applied rules to ${changed} transaction${changed !== 1 ? "s" : ""}` : "No transactions were changed")
  }

  function openAdd() {
    setEditRuleId(undefined)
    setDialogOpen(true)
  }

  function openEdit(id: string) {
    setEditRuleId(id)
    setDialogOpen(true)
  }

  const catLookup = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  return (
    <PageShell>
      <PageHeader
        title="Rules"
        description="Automatically categorize and tag transactions"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => askAgent("Help me set up rules to automatically categorize my transactions")}>
              <Bot className="size-3.5" />
              Ask the agent
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <ButtonComp variant="outline" size="sm" aria-label="Run rules now" onClick={handleRunRules}>
                    <Play className="size-3.5" />
                    Run rules
                  </ButtonComp>
                }
              />
              <TooltipContent>Apply all enabled rules to existing transactions</TooltipContent>
            </Tooltip>
            <Button size="sm" onClick={openAdd}>
              <Plus className="size-3.5" />
              Add rule
            </Button>
          </>
        }
      />

      {/* Rules table */}
      {rules.length === 0 ? (
        <Empty className="min-h-[40vh] border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Sparkles /></EmptyMedia>
            <EmptyTitle>No rules yet</EmptyTitle>
            <EmptyDescription>
              Rules automatically categorize and tag transactions. Check the AI proposals below to get started.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={openAdd}><Plus className="size-3.5" />Add rule</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-none border ring-1 ring-foreground/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">On</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Match</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden lg:table-cell">Tags</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Applied</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRules.map((rule) => {
                const cat = rule.setCategoryId ? catLookup.get(rule.setCategoryId) : null
                return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(v) => toggleRule(rule.id, v)}
                        size="sm"
                        aria-label={`${rule.enabled ? "Disable" : "Enable"} rule ${rule.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{rule.name}</span>
                        {rule.aiSuggested && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Sparkles className="size-2.5" />
                            AI
                          </Badge>
                        )}
                      </div>
                      <p className="sm:hidden text-xs text-muted-foreground mt-0.5">{matchDescription(rule, fmt)}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{matchDescription(rule, fmt)}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {cat ? (
                        <Badge variant="outline" style={{ borderColor: cat.color, color: cat.color }}>
                          {cat.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {rule.setTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                        {rule.setTags.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right tabular-nums text-xs text-muted-foreground">
                      {rule.timesApplied}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label="Rule options">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(rule.id)}>
                            <Pencil className="size-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                                  <Trash2 className="size-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              }
                            />
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete rule?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete the rule "{rule.name}"? This won't undo any changes already made.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction variant="destructive" onClick={() => deleteRule(rule.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* AI proposals */}
      {proposals.length > 0 && (
        <AIProposalsSection
          proposals={proposals}
          categories={categories}
          onAccept={(proposal) => {
            addRule(proposal)
            toast.success(`Rule "${proposal.name}" added`)
          }}
          onAcceptAll={() => {
            for (const p of proposals) addRule(p)
            toast.success(`Added ${proposals.length} rules`)
          }}
        />
      )}

      <RuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ruleId={editRuleId}
      />
    </PageShell>
  )
}
