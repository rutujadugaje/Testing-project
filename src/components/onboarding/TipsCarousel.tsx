import { useState } from "react"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CommandIcon, BotIcon, UploadIcon, SlidersHorizontalIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

const TIPS = [
  {
    icon: CommandIcon,
    title: "Command Palette",
    body: (
      <p>
        Press{" "}
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>{" "}
        (or{" "}
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
        ) anytime to search accounts, jump to pages, or run quick actions — without touching the mouse.
      </p>
    ),
  },
  {
    icon: BotIcon,
    title: "AI Grid Actions",
    body: (
      <p>
        Select transactions in the grid, then press{" "}
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>J</Kbd>
        </KbdGroup>{" "}
        to ask the agent to categorise, explain, or tag them in bulk. Works entirely offline — no API key required.
      </p>
    ),
  },
  {
    icon: UploadIcon,
    title: "CSV Import",
    body: (
      <p>
        Drop a CSV from your bank into the Transactions page or press{" "}
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>I</Kbd>
        </KbdGroup>
        . Finora detects columns, flips signs, and deduplicates rows so re-importing is always safe.
      </p>
    ),
  },
  {
    icon: SlidersHorizontalIcon,
    title: "Automatic Rules",
    body: (
      <p>
        Rules auto-categorise future imports. The agent can{" "}
        <em>propose</em> rules from your history — go to{" "}
        <strong>Rules</strong> and accept the ones you like. Once set, imports run silently.
      </p>
    ),
  },
]

export function TipsCarousel() {
  const [idx, setIdx] = useState(0)
  const tip = TIPS[idx]
  const Icon = tip.icon

  return (
    <div className="space-y-2">
      <Card size="sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-1">
          <Icon className="size-4 text-muted-foreground" />
          <CardTitle className="text-xs">{tip.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs/relaxed text-muted-foreground">
          {tip.body}
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous tip"
          onClick={() => setIdx((i) => (i - 1 + TIPS.length) % TIPS.length)}
        >
          <ChevronLeftIcon />
        </Button>
        <div className="flex gap-1">
          {TIPS.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to tip ${i + 1}`}
              onClick={() => setIdx(i)}
              className={
                "size-1.5 rounded-full transition-all " +
                (i === idx ? "bg-primary" : "bg-muted-foreground/40")
              }
            />
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next tip"
          onClick={() => setIdx((i) => (i + 1) % TIPS.length)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}
