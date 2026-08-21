import { Checkbox } from "@/components/ui/checkbox"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemGroup } from "@/components/ui/item"
import { CheckCircle2Icon, CircleIcon } from "lucide-react"

interface ChecklistItem {
  label: string
  description: string
  done: boolean
}

interface Props {
  currency: string
  hasAccounts: boolean
  hasTransactions: boolean
  hasApiKey: boolean
}

export function StepFinish({ currency, hasAccounts, hasTransactions, hasApiKey }: Props) {
  const items: ChecklistItem[] = [
    {
      label: "Currency set",
      description: `Your display currency is ${currency}.`,
      done: true,
    },
    {
      label: "At least one account",
      description: hasAccounts
        ? "You have accounts configured."
        : "No accounts added yet — you can add them from the Accounts page.",
      done: hasAccounts,
    },
    {
      label: "Transaction data",
      description: hasTransactions
        ? "You have transactions in your workspace."
        : "No transactions yet — import a CSV or add them manually.",
      done: hasTransactions,
    },
    {
      label: "AI agent key",
      description: hasApiKey
        ? "API key configured — the agent will use live model calls."
        : "No key set — the agent will run in offline simulation mode (no cost, works great for exploring).",
      done: hasApiKey,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">You&apos;re all set!</h2>
        <p className="text-xs/relaxed text-muted-foreground">
          Here&apos;s a quick summary of your setup. You can revisit any of these from Settings.
        </p>
      </div>

      {/* Checklist */}
      <ItemGroup>
        {items.map((item) => (
          <Item key={item.label} variant="outline" size="sm">
            <ItemMedia variant="icon">
              <Checkbox
                checked={item.done}
                readOnly
                aria-label={item.label}
                className="pointer-events-none"
              />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className={item.done ? "" : "text-muted-foreground"}>
                {item.done ? (
                  <CheckCircle2Icon className="size-3 text-primary" />
                ) : (
                  <CircleIcon className="size-3 text-muted-foreground" />
                )}
                {item.label}
              </ItemTitle>
              <ItemDescription>{item.description}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>

      {/* Quick tips */}
      <div className="rounded-none border border-border bg-muted/30 p-3 space-y-2">
        <p className="text-xs font-medium">Keyboard shortcuts to know</p>
        <div className="grid gap-1.5">
          {[
            {
              keys: ["⌘", "K"],
              label: "Command palette — search everything",
            },
            {
              keys: ["⌘", "J"],
              label: "Open the AI agent panel",
            },
            {
              keys: ["⌘", "I"],
              label: "Import a CSV",
            },
          ].map(({ keys, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
              <KbdGroup>
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </KbdGroup>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs/relaxed text-muted-foreground pt-1">
          The AI agent works offline without an API key — it uses a built-in simulation mode
          so you can explore all features freely.
        </p>
      </div>
    </div>
  )
}
