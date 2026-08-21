import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  Bot,
  Download,
  Moon,
  Search,
  Sparkles,
  Sun,
  Upload,
  Wand2,
} from "lucide-react"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useThemeSync } from "@/hooks/useAppSettings"
import { NAV_ITEMS } from "@/lib/navigation"
import { useUiStore } from "@/stores/useUiStore"

/** Prompts wired straight into the agent from anywhere in the app. */
const AGENT_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Brief me on this month", prompt: "Give me a briefing on my finances this month." },
  { label: "Categorize uncategorized transactions", prompt: "Categorize all my uncategorized transactions." },
  { label: "Find my subscriptions", prompt: "Find all my recurring subscriptions and what they cost per year." },
  { label: "Check for anomalies", prompt: "Check my recent transactions for duplicates and anything unusual." },
  { label: "How am I doing on budgets?", prompt: "Analyze my budgets this month and tell me where I am overspending." },
  { label: "Where can I save money?", prompt: "Look at my spending and suggest three concrete ways to save money." },
]

export function CommandPalette() {
  const navigate = useNavigate()
  const open = useUiStore((s) => s.commandOpen)
  const setOpen = useUiStore((s) => s.setCommandOpen)
  const toggleCommand = useUiStore((s) => s.toggleCommand)
  const askAgent = useUiStore((s) => s.askAgent)
  const { theme, setTheme } = useThemeSync()

  // ⌘K / Ctrl+K opens the palette; ⌘J toggles the agent panel.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (!meta) return
      const key = event.key.toLowerCase()
      if (key === "k") {
        event.preventDefault()
        toggleCommand()
      } else if (key === "j") {
        event.preventDefault()
        useUiStore.getState().toggleAgentPanel()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggleCommand])

  const run = (action: () => void) => {
    setOpen(false)
    // Let the dialog close before navigating so focus lands correctly.
    requestAnimationFrame(action)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Finora command palette"
      description="Jump to a page or hand a task to the agent"
    >
      <Command>
        <CommandInput placeholder="Search pages, or ask the agent…" />
        <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <Search className="size-4 text-muted-foreground" />
            <p className="text-sm">No matches</p>
            <p className="text-xs text-muted-foreground">Try “budget”, “import” or “subscriptions”</p>
          </div>
        </CommandEmpty>

        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.url}
              value={`${item.title} ${item.description} ${item.keywords?.join(" ") ?? ""}`}
              onSelect={() => run(() => navigate(item.url))}
            >
              <item.icon />
              <span>{item.title}</span>
              <span className="ml-auto truncate text-xs text-muted-foreground">
                {item.description}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ask the agent">
          {AGENT_ACTIONS.map((action) => (
            <CommandItem
              key={action.label}
              value={`agent ai ${action.label} ${action.prompt}`}
              onSelect={() => run(() => askAgent(action.prompt))}
            >
              <Sparkles />
              <span>{action.label}</span>
            </CommandItem>
          ))}
          <CommandItem value="open agent panel chat" onSelect={() => run(() => askAgent())}>
            <Bot />
            <span>Open the agent panel</span>
            <CommandShortcut>⌘J</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            value="import csv transactions upload"
            onSelect={() => run(() => navigate("/transactions?import=1"))}
          >
            <Upload />
            <span>Import a CSV</span>
            <CommandShortcut>⌘I</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="export csv transactions download"
            onSelect={() => run(() => navigate("/transactions?export=1"))}
          >
            <Download />
            <span>Export transactions</span>
          </CommandItem>
          <CommandItem value="rules automation" onSelect={() => run(() => navigate("/rules"))}>
            <Wand2 />
            <span>Manage auto-categorization rules</span>
          </CommandItem>
          <CommandItem
            value="toggle theme dark light appearance"
            onSelect={() => run(() => setTheme(theme === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
            <span>Switch to {theme === "dark" ? "light" : "dark"} mode</span>
          </CommandItem>
        </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
