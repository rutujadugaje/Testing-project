/**
 * Ephemeral UI state: panel visibility, the command palette, grid selection and
 * the active date range. Kept out of the finance store because none of it is
 * data — but the agent reads selection and range as runtime context, so it has
 * to live somewhere shared.
 */

import { create } from "zustand"

import { resolvePeriod, type DateRange, type PeriodPreset } from "@/lib/finance/dates"

interface UiState {
  commandOpen: boolean
  agentPanelOpen: boolean
  /** Mobile uses a Drawer instead of the resizable side panel. */
  agentDrawerOpen: boolean
  /** Transaction ids selected in the grid — handed to the agent as context. */
  selectedTransactionIds: string[]
  period: PeriodPreset
  customRange?: DateRange
  /** Prefills the agent composer when a page hands off a question. */
  pendingAgentPrompt?: string

  setCommandOpen: (open: boolean) => void
  toggleCommand: () => void
  setAgentPanelOpen: (open: boolean) => void
  toggleAgentPanel: () => void
  setAgentDrawerOpen: (open: boolean) => void
  setSelectedTransactionIds: (ids: string[]) => void
  clearSelection: () => void
  setPeriod: (period: PeriodPreset) => void
  setCustomRange: (range: DateRange | undefined) => void
  /** Open the agent (panel or drawer) with an optional prefilled prompt. */
  askAgent: (prompt?: string) => void
  consumePendingPrompt: () => string | undefined
}

export const useUiStore = create<UiState>()((set, get) => ({
  commandOpen: false,
  agentPanelOpen: false,
  agentDrawerOpen: false,
  selectedTransactionIds: [],
  period: "month",
  customRange: undefined,
  pendingAgentPrompt: undefined,

  setCommandOpen: (commandOpen) => set({ commandOpen }),
  toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),
  setAgentPanelOpen: (agentPanelOpen) => set({ agentPanelOpen }),
  toggleAgentPanel: () => set((s) => ({ agentPanelOpen: !s.agentPanelOpen })),
  setAgentDrawerOpen: (agentDrawerOpen) => set({ agentDrawerOpen }),
  setSelectedTransactionIds: (selectedTransactionIds) => set({ selectedTransactionIds }),
  clearSelection: () => set({ selectedTransactionIds: [] }),
  setPeriod: (period) => set({ period, customRange: undefined }),
  setCustomRange: (customRange) => set({ customRange }),

  askAgent: (prompt) => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 1024
    set({
      pendingAgentPrompt: prompt,
      ...(isMobile ? { agentDrawerOpen: true } : { agentPanelOpen: true }),
    })
  },

  consumePendingPrompt: () => {
    const prompt = get().pendingAgentPrompt
    if (prompt) set({ pendingAgentPrompt: undefined })
    return prompt
  },
}))

/** Resolve the active period into concrete dates. */
export function useActiveRange(monthStartDay = 1): DateRange {
  const period = useUiStore((s) => s.period)
  const customRange = useUiStore((s) => s.customRange)
  return customRange ?? resolvePeriod(period, new Date(), monthStartDay)
}
