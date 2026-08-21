/**
 * Thread-persistent storage for the agent chat.
 *
 * Keeps the last MAX_THREADS threads in localStorage so the user can pick up
 * a conversation across page reloads. Messages are stored as FinoraUIMessage
 * (the full AI SDK message shape) so we can re-hydrate the chat on mount.
 */

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

import type { FinoraUIMessage } from "@/lib/ai/agent"

const MAX_THREADS = 10

export interface AgentThread {
  id: string
  title: string
  messages: FinoraUIMessage[]
  createdAt: number
  updatedAt: number
}

interface AgentState {
  threads: AgentThread[]
  activeThreadId: string | null

  createThread: () => AgentThread
  setActiveThread: (id: string) => void
  saveMessages: (threadId: string, messages: FinoraUIMessage[]) => void
  deleteThread: (id: string) => void
  renameThread: (id: string, title: string) => void
  clearAll: () => void
}

function deriveTitle(messages: FinoraUIMessage[]): string {
  const first = messages.find((m) => m.role === "user")
  if (!first) return "New chat"
  // Extract text from first user message parts
  let text = ""
  if (Array.isArray(first.parts)) {
    for (const part of first.parts) {
      if (typeof part === "object" && part !== null && "type" in part && part.type === "text" && "text" in part) {
        text = String((part as { text: string }).text)
        break
      }
    }
  }
  if (!text && "content" in first && typeof (first as { content?: unknown }).content === "string") {
    text = String((first as { content: string }).content)
  }
  if (!text) text = "New chat"
  return text.slice(0, 48) + (text.length > 48 ? "…" : "")
}

function makeId(): string {
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      threads: [],
      activeThreadId: null,

      createThread: () => {
        const thread: AgentThread = {
          id: makeId(),
          title: "New chat",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((s) => {
          const trimmed = [thread, ...s.threads].slice(0, MAX_THREADS)
          return { threads: trimmed, activeThreadId: thread.id }
        })
        return thread
      },

      setActiveThread: (id) => set({ activeThreadId: id }),

      saveMessages: (threadId, messages) => {
        set((s) => ({
          threads: s.threads.map((t) => {
            if (t.id !== threadId) return t
            return {
              ...t,
              messages,
              title: deriveTitle(messages) || t.title,
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      deleteThread: (id) => {
        set((s) => {
          const threads = s.threads.filter((t) => t.id !== id)
          const activeThreadId =
            s.activeThreadId === id ? (threads[0]?.id ?? null) : s.activeThreadId
          return { threads, activeThreadId }
        })
      },

      renameThread: (id, title) => {
        set((s) => ({
          threads: s.threads.map((t) => (t.id === id ? { ...t, title } : t)),
        }))
      },

      clearAll: () => set({ threads: [], activeThreadId: null }),
    }),
    {
      name: "finora.agent.v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

/** Convenience: get the active thread or null. */
export function useActiveThread(): AgentThread | null {
  const threads = useAgentStore((s) => s.threads)
  const activeThreadId = useAgentStore((s) => s.activeThreadId)
  return threads.find((t) => t.id === activeThreadId) ?? null
}
