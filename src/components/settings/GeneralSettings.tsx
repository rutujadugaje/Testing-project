import { useMemo } from "react"
import type { AppSettings } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useThemeSync } from "@/hooks/useAppSettings"
import { formatMoney } from "@/lib/finance/money"
import { formatDisplayDate, todayIso } from "@/lib/finance/dates"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSet, FieldLegend } from "@/components/ui/field"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { SunIcon, MoonIcon, MonitorIcon, AlignJustifyIcon, ListIcon } from "lucide-react"

const CURRENCIES = [
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "US Dollar ($)" },
  { value: "GBP", label: "British Pound (£)" },
  { value: "CHF", label: "Swiss Franc (Fr)" },
  { value: "CAD", label: "Canadian Dollar (CA$)" },
]

const LOCALES = [
  { value: "fr-FR", label: "Français (France)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "de-DE", label: "Deutsch (Germany)" },
]

const MONTH_START_DAYS = Array.from({ length: 28 }, (_, i) => i + 1).map((d) => ({
  value: String(d),
  label: d === 1 ? "1st (default)" : `${d}${d === 2 ? "nd" : d === 3 ? "rd" : "th"}`,
}))

export function GeneralSettings() {
  const settings = useFinanceStore((s) => s.settings)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const { setTheme } = useThemeSync()

  const previewMoney = useMemo(
    () => formatMoney(123456, settings.currency, settings.locale),
    [settings.currency, settings.locale],
  )

  const previewDate = useMemo(
    () => formatDisplayDate(todayIso(), settings.locale),
    [settings.locale],
  )

  function patch(p: Partial<AppSettings>) {
    updateSettings(p)
  }

  return (
    <div className="space-y-6">
      {/* Live Preview */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-xs">Live Preview</CardTitle>
          <CardDescription>How your data will look with the current settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Money</p>
              <p className="font-medium tabular-nums">{previewMoney}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Date</p>
              <p className="font-medium">{previewDate}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Format settings */}
      <FieldSet>
        <FieldLegend>Format</FieldLegend>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel>Currency</FieldLabel>
            <Select
              value={settings.currency}
              onValueChange={(val) => val && patch({ currency: val })}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>Locale</FieldLabel>
            <Select
              value={settings.locale}
              onValueChange={(val) => val && patch({ locale: val })}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>
              <span>Budget month start</span>
            </FieldLabel>
            <div className="space-y-1">
              <Select
                value={String(settings.monthStartDay)}
                onValueChange={(val) => val && patch({ monthStartDay: Number(val) })}
              >
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_START_DAYS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Aligns budget periods with your salary date.
              </FieldDescription>
            </div>
          </Field>
        </FieldGroup>
      </FieldSet>

      {/* Appearance */}
      <FieldSet>
        <FieldLegend>Appearance</FieldLegend>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel>Theme</FieldLabel>
            <ToggleGroup
              value={[settings.theme]}
              onValueChange={(val) => {
                const next = val[val.length - 1] as AppSettings["theme"] | undefined
                if (next) setTheme(next)
              }}
              spacing={0}
              variant="outline"
            >
              <ToggleGroupItem value="light" aria-label="Light theme">
                <SunIcon />
                Light
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Dark theme">
                <MoonIcon />
                Dark
              </ToggleGroupItem>
              <ToggleGroupItem value="system" aria-label="System theme">
                <MonitorIcon />
                System
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>Density</FieldLabel>
            <ToggleGroup
              value={[settings.density]}
              onValueChange={(val) => {
                const next = val[val.length - 1] as AppSettings["density"] | undefined
                if (next) patch({ density: next })
              }}
              spacing={0}
              variant="outline"
            >
              <ToggleGroupItem value="comfortable" aria-label="Comfortable density">
                <AlignJustifyIcon />
                Comfortable
              </ToggleGroupItem>
              <ToggleGroupItem value="compact" aria-label="Compact density">
                <ListIcon />
                Compact
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  )
}
