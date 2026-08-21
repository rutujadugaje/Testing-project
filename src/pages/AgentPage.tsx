/**
 * /agent — Full-page agent workspace.
 *
 * Desktop: two-pane layout — thread history on the left, chat on the right.
 * Mobile: chat fills the viewport, threads accessible via a Sheet.
 */

import * as React from "react"
import { PlusIcon, MessagesSquareIcon, ListIcon, ChevronDownIcon } from "lucide-react"

import { useAgentStore } from "@/stores/useAgentStore"
import { AgentPanel } from "@/components/agent/AgentPanel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Item, ItemContent, ItemTitle, ItemDescription, ItemGroup } from "@/components/ui/item"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { cn } from "@/lib/utils"

// ─── Tool capability reference ────────────────────────────────────────────────

const READ_TOOLS = [
  { name: "listAccounts", label: "List accounts", desc: "Current balances and net worth" },
  { name: "listCategories", label: "List categories", desc: "All category names and kinds" },
  { name: "queryTransactions", label: "Search transactions", desc: "Powerful filtered search" },
  { name: "runCashflowSummary", label: "Cashflow summary", desc: "Income, expenses, savings rate" },
  { name: "categoryBreakdown", label: "Category breakdown", desc: "Spending by category" },
  { name: "detectSubscriptions", label: "Find subscriptions", desc: "Recurring charges with cadence" },
  { name: "detectAnomalies", label: "Check anomalies", desc: "Duplicates, spikes, unusual charges" },
  { name: "analyzeBudget", label: "Analyse budgets", desc: "Limits, spend, overspent categories" },
  { name: "listGoals", label: "List goals", desc: "Progress and on-track status" },
  { name: "listRules", label: "List rules", desc: "Auto-categorization rules" },
]

const WRITE_TOOLS = [
  { name: "createTransaction", label: "Create transaction", desc: "Record a new transaction" },
  { name: "updateTransactions", label: "Update transactions", desc: "Edit category, payee, tags" },
  { name: "deleteTransactions", label: "Delete transactions", desc: "Requires approval" },
  { name: "suggestCategories", label: "Suggest categories", desc: "AI-powered suggestions" },
  { name: "applyCategories", label: "Apply categories", desc: "Commit suggestions in bulk" },
  { name: "createBudget", label: "Create budget", desc: "Set or infer a monthly limit" },
  { name: "createGoal", label: "Create goal", desc: "Set a savings target" },
  { name: "updateGoalProgress", label: "Update goal", desc: "Record a contribution" },
  { name: "createRule", label: "Create rule", desc: "Auto-categorize future transactions" },
  { name: "splitTransaction", label: "Split transaction", desc: "Split across categories" },
  { name: "exportSummaryMarkdown", label: "Export summary", desc: "Generate a Markdown report" },
]

const NAV_TOOLS = [
  { name: "navigateTo", label: "Navigate", desc: "Jump to any page in the app" },
]

function ToolList({ tools }: { tools: { name: string; label: string; desc: string }[] }) {
  return (
    <div className="flex flex-col gap-1">
      {tools.map((t) => (
        <div key={t.name} className="flex flex-col gap-0.5 py-1">
          <span className="text-xs font-medium">{t.label}</span>
          <span className="text-[10px] text-muted-foreground">{t.desc}</span>
        </div>
      ))}
    </div>
  )
}

function CapabilityReference() {
  return (
    <Accordion multiple defaultValue={["reads"]}>
      <AccordionItem value="reads">
        <AccordionTrigger className="py-2 text-xs">
          <Badge variant="outline" className="mr-2">{READ_TOOLS.length}</Badge>
          Reads
        </AccordionTrigger>
        <AccordionContent>
          <ToolList tools={READ_TOOLS} />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="writes">
        <AccordionTrigger className="py-2 text-xs">
          <Badge variant="outline" className="mr-2">{WRITE_TOOLS.length}</Badge>
          Writes
        </AccordionTrigger>
        <AccordionContent>
          <ToolList tools={WRITE_TOOLS} />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="nav">
        <AccordionTrigger className="py-2 text-xs">
          <Badge variant="outline" className="mr-2">{NAV_TOOLS.length}</Badge>
          Navigation
        </AccordionTrigger>
        <AccordionContent>
          <ToolList tools={NAV_TOOLS} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

// ─── Thread list ──────────────────────────────────────────────────────────────

function ThreadListPanel({ onSelect }: { onSelect?: () => void }) {
  const threads = useAgentStore((s) => s.threads)
  const activeThreadId = useAgentStore((s) => s.activeThreadId)
  const setActiveThread = useAgentStore((s) => s.setActiveThread)
  const createThread = useAgentStore((s) => s.createThread)

  const handleNew = React.useCallback(() => {
    createThread()
    onSelect?.()
  }, [createThread, onSelect])

  const handleSelect = React.useCallback(
    (id: string) => {
      setActiveThread(id)
      onSelect?.()
    },
    [setActiveThread, onSelect],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <MessagesSquareIcon className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Threads</span>
        </div>
        <Tooltip>
          <TooltipTrigger render={
            <Button variant="ghost" size="icon-sm" onClick={handleNew} aria-label="New thread">
              <PlusIcon />
            </Button>
          } />
          <TooltipContent side="bottom">New chat</TooltipContent>
        </Tooltip>
      </div>

      {/* Thread list + capability reference */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {threads.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No threads yet — start a conversation
            </p>
          ) : (
            <ItemGroup>
              {threads.map((t) => (
                <Item
                  key={t.id}
                  size="xs"
                  variant={t.id === activeThreadId ? "muted" : "default"}
                  render={<button onClick={() => handleSelect(t.id)} />}
                  className={cn(
                    "cursor-pointer hover:bg-muted/60",
                    t.id === activeThreadId && "bg-muted",
                  )}
                >
                  <ItemContent>
                    <ItemTitle className="line-clamp-1 text-xs">{t.title}</ItemTitle>
                    <ItemDescription className="text-[10px]">
                      {t.messages.length} msg · {formatRelativeTime(t.updatedAt)}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )}
        </div>

        {/* Capability reference — collapsible, lives in scroll area */}
        <div className="border-t border-border p-2">
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center gap-1 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDownIcon className="size-3" />
              Agent capabilities (22 tools)
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-1">
                <CapabilityReference />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  )
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── AgentPage ────────────────────────────────────────────────────────────────

export default function AgentPage() {
  const [mobileThreadsOpen, setMobileThreadsOpen] = React.useState(false)

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-col">
      {/* Mobile: sheet for thread list */}
      <div className="flex shrink-0 items-center border-b border-border px-3 py-2 lg:hidden">
        <Sheet open={mobileThreadsOpen} onOpenChange={setMobileThreadsOpen}>
          <SheetTrigger render={
            <Button variant="outline" size="sm" aria-label="Open thread list">
              <ListIcon className="size-3.5" />
              Threads
            </Button>
          } />
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Thread history</SheetTitle>
            </SheetHeader>
            <ThreadListPanel onSelect={() => setMobileThreadsOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: two-pane */}
      <div className="hidden min-h-0 flex-1 lg:flex">
        <ResizablePanelGroup orientation="horizontal" className="min-h-0">
          <ResizablePanel
            defaultSize="30%"
            minSize="22%"
            maxSize="42%"
            className="flex min-h-0 flex-col border-r border-border bg-sidebar/30"
          >
            <ThreadListPanel />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="70%" className="flex min-h-0 flex-col">
            <AgentPanel variant="page" />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile: full chat */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <AgentPanel variant="page" />
      </div>
    </div>
  )
}
