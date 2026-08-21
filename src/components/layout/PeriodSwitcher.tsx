import { useState } from "react"
import { CalendarRange } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useFormatters } from "@/hooks/useAppSettings"
import { toIsoDate, type PeriodPreset } from "@/lib/finance/dates"
import { cn } from "@/lib/utils"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useActiveRange, useUiStore } from "@/stores/useUiStore"

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "ytd", label: "YTD" },
]

export function PeriodSwitcher({ className }: { className?: string }) {
  const period = useUiStore((s) => s.period)
  const customRange = useUiStore((s) => s.customRange)
  const setPeriod = useUiStore((s) => s.setPeriod)
  const setCustomRange = useUiStore((s) => s.setCustomRange)
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)
  const range = useActiveRange(monthStartDay)
  const formatters = useFormatters()

  const [open, setOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState<Date | undefined>()

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <ToggleGroup
        value={customRange ? [] : [period]}
        onValueChange={(value) => {
          const next = Array.isArray(value) ? value[0] : value
          if (next) setPeriod(next as PeriodPreset)
        }}
        className="h-8"
      >
        {PRESETS.map((preset) => (
          <ToggleGroupItem
            key={preset.value}
            value={preset.value}
            className="h-8 px-2.5 text-xs"
            aria-label={`Show ${preset.label.toLowerCase()}`}
          >
            {preset.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant={customRange ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              aria-label="Pick a custom date range"
            >
              <CalendarRange className="size-3.5" />
              <span className="hidden xl:inline">
                {customRange
                  ? `${formatters.shortDate(range.from)} – ${formatters.shortDate(range.to)}`
                  : "Custom"}
              </span>
            </Button>
          }
        />
        <PopoverContent align="end" className="w-auto p-0">
          <div className="border-b border-border px-3 py-2">
            <p className="text-xs font-medium">
              {draftFrom ? "Now pick the end date" : "Pick the start date"}
            </p>
            <p className="text-xs text-muted-foreground">
              {draftFrom
                ? `Starting ${formatters.date(toIsoDate(draftFrom))}`
                : "Two clicks set a custom window"}
            </p>
          </div>
          <Calendar
            mode="single"
            autoFocus
            selected={draftFrom}
            onSelect={(date) => {
              if (!date) return
              if (!draftFrom) {
                setDraftFrom(date)
                return
              }
              const [from, to] = draftFrom <= date ? [draftFrom, date] : [date, draftFrom]
              setCustomRange({ from: toIsoDate(from), to: toIsoDate(to) })
              setDraftFrom(undefined)
              setOpen(false)
            }}
          />
          <Separator />
          <div className="flex justify-between gap-2 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setDraftFrom(undefined)
                setCustomRange(undefined)
                setOpen(false)
              }}
            >
              Reset
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setCustomRange({ from: "1970-01-01", to: "2999-12-31" })
                setOpen(false)
              }}
            >
              All time
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
