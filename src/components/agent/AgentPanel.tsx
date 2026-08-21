/**
 * The Finora AI agent chat panel.
 *
 * Mounts in three variants:
 *  - "panel" — resizable desktop dock inside AppLayout
 *  - "drawer" — mobile slide-up drawer inside AppLayout
 *  - "page"  — full-width workspace on /agent
 */

import * as React from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useChat } from "@ai-sdk/react"
import { isToolUIPart, getToolName } from "ai"
import {
  BotIcon,
  UserIcon,
  SendIcon,
  SquareIcon,
  RotateCcwIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  XIcon,
  SparklesIcon,
} from "lucide-react"

import { createFinanceTransport } from "@/lib/ai/agent"
import type { FinoraUIMessage } from "@/lib/ai/agent"
import { TOOL_LABELS } from "@/lib/ai/tools"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"
import { useAgentStore } from "@/stores/useAgentStore"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Marker, MarkerIcon, MarkerContent } from "@/components/ui/marker"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
} from "@/components/ui/message"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller"
import { InputGroup, InputGroupTextarea } from "@/components/ui/input-group"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import { MiniMarkdown } from "./MiniMarkdown"
import { ToolResultCard } from "./ToolResultCard"

// ─── Tool trace ───────────────────────────────────────────────────────────────

interface ToolTraceProps {
  part: ReturnType<typeof isToolUIPart> extends true ? unknown : unknown
  onApprove?: (id: string, approved: boolean) => void
}

function ToolTrace({ part, onApprove }: ToolTraceProps) {
  const p = part as {
    type: string
    toolCallId: string
    state: string
    input?: unknown
    output?: unknown
    errorText?: string
    approval?: { id: string; approved?: boolean }
  }
  const name = getToolName(p as Parameters<typeof getToolName>[0])
  const label = (TOOL_LABELS as Record<string, string>)[name] ?? name
  const isPending = p.state === "input-streaming" || p.state === "input-available"
  const isDone = p.state === "output-available"
  const isError = p.state === "output-error"
  const needsApproval = p.state === "approval-requested"
  const isDenied = p.state === "output-denied"

  return (
    <div className="flex flex-col gap-1">
      <Marker>
        <MarkerIcon>
          {isPending && <Spinner className="size-3" />}
          {isDone && <CheckIcon className="size-3 text-emerald-600" />}
          {isError && <XIcon className="size-3 text-destructive" />}
          {needsApproval && <Spinner className="size-3 text-amber-500" />}
          {isDenied && <XIcon className="size-3 text-muted-foreground" />}
        </MarkerIcon>
        <MarkerContent className={cn(
          isError && "text-destructive",
          isDenied && "text-muted-foreground/60 line-through",
        )}>
          {label}
          {isError && p.errorText && (
            <span className="ml-1 text-muted-foreground">— {p.errorText}</span>
          )}
        </MarkerContent>
      </Marker>

      {/* Approval gate */}
      {needsApproval && p.approval && onApprove && (
        <Alert className="ml-5 border-amber-200 dark:border-amber-900">
          <AlertTitle className="text-xs">Approval required</AlertTitle>
          <AlertDescription>
            This action needs your confirmation before it runs.
          </AlertDescription>
          <div className="mt-2 flex gap-2">
            <Button
              size="xs"
              variant="destructive"
              onClick={() => onApprove(p.approval!.id, false)}
              aria-label="Deny action"
            >
              <XIcon className="size-3" />
              Deny
            </Button>
            <Button
              size="xs"
              onClick={() => onApprove(p.approval!.id, true)}
              aria-label="Approve action"
            >
              <CheckIcon className="size-3" />
              Approve
            </Button>
          </div>
        </Alert>
      )}

      {/* Result card — shown when output is available */}
      {isDone && p.output !== undefined && (
        <div className="ml-5">
          <ToolResultCard toolName={name} output={p.output} />
        </div>
      )}
    </div>
  )
}

// ─── Message renderer ─────────────────────────────────────────────────────────

interface AssistantMessageProps {
  message: FinoraUIMessage
  onApprove: (id: string, approved: boolean) => void
}

function AssistantMessage({ message, onApprove }: AssistantMessageProps) {
  // Show the trace while the agent is working so the user sees progress, then
  // fold it away once the answer lands — an expanded trace pushes the actual
  // reply off-screen, which is the opposite of helpful.
  const [toolsOpen, setToolsOpen] = React.useState(true)
  // Gather tool parts and text parts
  const toolParts: unknown[] = []
  const textParts: { text: string }[] = []
  let hasStepStart = false

  for (const part of message.parts) {
    const p = part as { type: string; text?: string }
    if (p.type === "step-start") {
      hasStepStart = true
      continue
    }
    if (p.type === "text" && p.text) {
      textParts.push({ text: p.text })
      continue
    }
    if (isToolUIPart(part as Parameters<typeof isToolUIPart>[0])) {
      toolParts.push(part)
    }
  }

  const hasAnswer = textParts.length > 0
  const collapsedOnAnswer = React.useRef(false)
  React.useEffect(() => {
    if (hasAnswer && !collapsedOnAnswer.current) {
      collapsedOnAnswer.current = true
      setToolsOpen(false)
    }
  }, [hasAnswer])

  return (
    <MessageGroup>
      <Message align="start">
        <MessageAvatar className="size-7 bg-primary/10">
          <BotIcon className="size-3.5 text-primary" />
        </MessageAvatar>
        <MessageContent>
          {/* Tool trace — collapsible when there are many */}
          {toolParts.length > 0 && (
            <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {hasStepStart && <Marker variant="separator" className="flex-1" />}
                <CollapsibleTrigger className="flex items-center gap-1 hover:text-foreground transition-colors">
                  {toolsOpen ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
                  <span>{toolParts.length} tool{toolParts.length !== 1 ? "s" : ""}</span>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="flex flex-col gap-2 py-1">
                  {toolParts.map((tp, i) => (
                    <ToolTrace key={i} part={tp} onApprove={onApprove} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Text reply */}
          {textParts.length > 0 && (
            <Bubble variant="ghost">
              <BubbleContent className="text-xs leading-relaxed p-0">
                {textParts.map((tp, i) => (
                  <MiniMarkdown key={i} text={tp.text} />
                ))}
              </BubbleContent>
            </Bubble>
          )}
        </MessageContent>
      </Message>
    </MessageGroup>
  )
}

function UserMessage({ message }: { message: FinoraUIMessage }) {
  const text = message.parts
    .filter((p): p is { type: "text"; text: string } => (p as { type: string }).type === "text")
    .map((p) => p.text)
    .join("")

  return (
    <MessageGroup>
      <Message align="end">
        <MessageContent>
          <Bubble variant="default" align="end">
            <BubbleContent className="text-xs">{text}</BubbleContent>
          </Bubble>
        </MessageContent>
        <MessageAvatar className="size-7 bg-muted">
          <UserIcon className="size-3.5 text-muted-foreground" />
        </MessageAvatar>
      </Message>
    </MessageGroup>
  )
}

// ─── Starter prompts ──────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  "How am I doing this month?",
  "Find my subscriptions",
  "Categorize what's missing",
  "Where can I save money?",
  "Check for anomalies",
  "Show my budget status",
]

// ─── AgentPanel ───────────────────────────────────────────────────────────────

export function AgentPanel({ variant }: { variant: "panel" | "drawer" | "page" }) {
  const location = useLocation()
  const navigate = useNavigate()
  const settings = useFinanceStore((s) => s.settings)
  const selectedTransactionIds = useUiStore((s) => s.selectedTransactionIds)

  // Agent store — thread management
  const threads = useAgentStore((s) => s.threads)
  const activeThreadId = useAgentStore((s) => s.activeThreadId)
  const createThread = useAgentStore((s) => s.createThread)
  const setActiveThread = useAgentStore((s) => s.setActiveThread)
  const saveMessages = useAgentStore((s) => s.saveMessages)
  const deleteThread = useAgentStore((s) => s.deleteThread)
  const renameThread = useAgentStore((s) => s.renameThread)

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null

  // Stable key for ids — avoids recreating transport on every render
  const selectedIdsKey = React.useMemo(
    () => selectedTransactionIds.slice().sort().join(","),
    [selectedTransactionIds],
  )

  // Transport — rebuilt only when relevant settings change
  const { transport, live, label } = React.useMemo(
    () =>
      createFinanceTransport({
        settings,
        route: location.pathname,
        selectedTransactionIds,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.aiApiKey, settings.aiBaseUrl, settings.aiModel, settings.currency, settings.locale, location.pathname, selectedIdsKey],
  )

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    regenerate,
    setMessages,
    clearError,
    addToolApprovalResponse,
  } = useChat<FinoraUIMessage>({ transport })

  // ── Hydrate from persisted thread on mount / switch ──────────────────────
  const hydratedRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (activeThread && hydratedRef.current !== activeThread.id) {
      hydratedRef.current = activeThread.id
      if (activeThread.messages.length > 0) {
        setMessages(activeThread.messages)
      } else {
        setMessages([])
      }
    }
  }, [activeThread, setMessages])

  // ── Persist messages on status transitions ───────────────────────────────
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => {
    if (!activeThreadId || messages.length === 0) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveMessages(activeThreadId, messages)
    }, 400)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [messages, activeThreadId, saveMessages])

  // ── Navigate on navigateTo tool output ───────────────────────────────────
  const handledNavigations = React.useRef<Set<string>>(new Set())
  React.useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant") continue
      for (const part of msg.parts) {
        const p = part as { type: string; toolCallId?: string; state?: string; output?: unknown }
        if (!isToolUIPart(part as Parameters<typeof isToolUIPart>[0])) continue
        const name = getToolName(part as Parameters<typeof getToolName>[0])
        if (name !== "navigateTo") continue
        if (p.state !== "output-available") continue
        const tcId = p.toolCallId ?? ""
        if (handledNavigations.current.has(tcId)) continue
        handledNavigations.current.add(tcId)
        const out = p.output as { navigate?: string } | undefined
        if (out?.navigate) {
          navigate(out.navigate)
        }
      }
    }
  }, [messages, navigate])

  // ── Consume pendingAgentPrompt from UiStore ───────────────────────────────
  const consumePending = useUiStore((s) => s.consumePendingPrompt)
  React.useEffect(() => {
    const prompt = consumePending()
    if (!prompt) return
    // Ensure there's an active thread
    let tid = activeThreadId
    if (!tid) {
      const t = createThread()
      tid = t.id
    }
    sendMessage({ text: prompt })
  // Only run once on mount; deps intentionally minimal
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Also watch for new pending prompts that arrive while mounted
  const pendingPrompt = useUiStore((s) => s.pendingAgentPrompt)
  const prevPendingRef = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    if (pendingPrompt && pendingPrompt !== prevPendingRef.current) {
      prevPendingRef.current = pendingPrompt
      const prompt = consumePending()
      if (prompt) {
        if (!activeThreadId) createThread()
        sendMessage({ text: prompt })
      }
    }
  }, [pendingPrompt, consumePending, activeThreadId, createThread, sendMessage])

  // ── Composer state ────────────────────────────────────────────────────────
  const [draft, setDraft] = React.useState("")
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const isStreaming = status === "streaming" || status === "submitted"

  const handleSend = React.useCallback(() => {
    const text = draft.trim()
    if (!text || isStreaming) return
    if (!activeThreadId) createThread()
    setDraft("")
    sendMessage({ text })
    if (textareaRef.current) textareaRef.current.style.height = ""
  }, [draft, isStreaming, activeThreadId, createThread, sendMessage])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleInput = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    // Auto-grow
    const el = e.target
    el.style.height = ""
    el.style.height = Math.min(el.scrollHeight, 140) + "px"
  }, [])

  // ── Approval handler ──────────────────────────────────────────────────────
  const handleApprove = React.useCallback(
    (id: string, approved: boolean) => {
      addToolApprovalResponse({ id, approved })
    },
    [addToolApprovalResponse],
  )

  // ── New chat ──────────────────────────────────────────────────────────────
  const handleNewChat = React.useCallback(() => {
    const t = createThread()
    setMessages([])
    hydratedRef.current = t.id
    setDraft("")
  }, [createThread, setMessages])

  // ── Rename thread ─────────────────────────────────────────────────────────
  const [renaming, setRenaming] = React.useState(false)
  const [renameValue, setRenameValue] = React.useState("")
  const startRename = React.useCallback(() => {
    if (!activeThread) return
    setRenameValue(activeThread.title)
    setRenaming(true)
  }, [activeThread])
  const commitRename = React.useCallback(() => {
    if (activeThreadId && renameValue.trim()) renameThread(activeThreadId, renameValue.trim())
    setRenaming(false)
  }, [activeThreadId, renameValue, renameThread])

  // ── Starter prompt action ─────────────────────────────────────────────────
  const sendStarter = React.useCallback(
    (prompt: string) => {
      if (!activeThreadId) createThread()
      sendMessage({ text: prompt })
    },
    [activeThreadId, createThread, sendMessage],
  )

  // ─────────────────────────────────────────────────────────────────────────
  const isEmpty = messages.length === 0

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        variant === "panel" && "h-full",
        variant === "drawer" && "h-full",
        variant === "page" && "h-full flex-1",
      )}
    >
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <SparklesIcon className="size-3.5 text-primary" />
        {renaming ? (
          <input
            className="flex-1 bg-transparent text-xs font-medium outline-none"
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === "Enter") commitRename() }}
          />
        ) : (
          <span className="flex-1 truncate text-xs font-medium">
            {activeThread?.title ?? "Finance agent"}
          </span>
        )}

        {/* Live / offline badge */}
        {live ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Live
          </Badge>
        ) : (
          <Tooltip>
            <TooltipTrigger render={
              <Badge variant="secondary" className="shrink-0 cursor-help text-[10px]">
                Offline mode
              </Badge>
            } />
            <TooltipContent side="bottom">
              Add an API key in Settings → AI to enable a real model
            </TooltipContent>
          </Tooltip>
        )}

        {/* Thread dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button variant="ghost" size="icon-sm" aria-label="Thread menu">
              <ChevronDownIcon />
            </Button>
          } />
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Threads</DropdownMenuLabel>
            {threads.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => {
                  setActiveThread(t.id)
                  hydratedRef.current = null // force re-hydration
                }}
                className={t.id === activeThreadId ? "bg-accent" : ""}
              >
                <span className="truncate">{t.title}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={startRename}>
              Rename current
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                if (activeThreadId) {
                  deleteThread(activeThreadId)
                  setMessages([])
                }
              }}
            >
              Delete current
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* New chat */}
        <Tooltip>
          <TooltipTrigger render={
            <Button variant="ghost" size="icon-sm" aria-label="New chat" onClick={handleNewChat}>
              <PlusIcon />
            </Button>
          } />
          <TooltipContent side="bottom">New chat</TooltipContent>
        </Tooltip>
      </div>

      {/* ── Message list ── */}
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <div className="flex min-h-0 flex-1 flex-col">
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="px-3 py-4">
            {isEmpty ? (
              <MessageScrollerItem>
                <Empty>
                  <EmptyMedia>
                    <SparklesIcon className="size-8 text-primary" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle>Finance agent</EmptyTitle>
                    <EmptyDescription>
                      {live
                        ? `Powered by ${label}. Ask anything about your finances.`
                        : "Running in offline mode — real tools, built-in router."}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <div className="flex flex-wrap justify-center gap-2">
                      {STARTER_PROMPTS.map((prompt) => (
                        <Button
                          key={prompt}
                          variant="outline"
                          size="xs"
                          onClick={() => sendStarter(prompt)}
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </EmptyContent>
                </Empty>
              </MessageScrollerItem>
            ) : (
              messages.map((msg) => (
                <MessageScrollerItem key={msg.id} messageId={msg.id}>
                  {msg.role === "user" ? (
                    <UserMessage message={msg} />
                  ) : (
                    <AssistantMessage message={msg} onApprove={handleApprove} />
                  )}
                </MessageScrollerItem>
              ))
            )}

            {/* Loading indicator while submitting */}
            {status === "submitted" && (
              <MessageScrollerItem>
                <MessageGroup>
                  <Message align="start">
                    <MessageAvatar className="size-7 bg-primary/10">
                      <BotIcon className="size-3.5 text-primary" />
                    </MessageAvatar>
                    <MessageContent>
                      <Marker>
                        <MarkerIcon><Spinner className="size-3" /></MarkerIcon>
                        <MarkerContent>Thinking…</MarkerContent>
                      </Marker>
                    </MessageContent>
                  </Message>
                </MessageGroup>
              </MessageScrollerItem>
            )}

          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
        </div>
      </MessageScrollerProvider>

      {/* ── Error banner ── */}
      {error && (
        <div className="shrink-0 px-3 py-2">
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
            <div className="mt-2 flex gap-2">
              <Button
                size="xs"
                variant="outline"
                onClick={() => { clearError(); regenerate() }}
              >
                <RotateCcwIcon className="size-3" /> Retry
              </Button>
              <Button size="xs" variant="ghost" onClick={clearError}>
                Dismiss
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* ── Composer ── */}
      <div className="shrink-0 border-t border-border p-3">
        <InputGroup className="min-h-[60px] items-start rounded border-border">
          <InputGroupTextarea
            ref={textareaRef}
            placeholder={isStreaming ? "Agent is working…" : "Ask anything about your finances…"}
            value={draft}
            disabled={isStreaming}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            className="min-h-[36px] py-2"
            aria-label="Message input"
          />
          <div className="flex shrink-0 items-end gap-1 self-end pb-1 pr-1">
            {isStreaming ? (
              <Tooltip>
                <TooltipTrigger render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={stop}
                    aria-label="Stop generation"
                  >
                    <SquareIcon className="size-3.5" />
                  </Button>
                } />
                <TooltipContent side="top">Stop</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleSend}
                    disabled={!draft.trim()}
                    aria-label="Send message"
                  >
                    <SendIcon className="size-3.5" />
                  </Button>
                } />
                <TooltipContent side="top">Send (Enter)</TooltipContent>
              </Tooltip>
            )}
          </div>
        </InputGroup>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Shift+Enter for newline · Enter to send
        </p>
      </div>
    </div>
  )
}
