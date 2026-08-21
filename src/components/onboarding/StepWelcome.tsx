import type { AppSettings } from "@/types/finance"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemGroup } from "@/components/ui/item"
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSet, FieldLegend } from "@/components/ui/field"
import { SparklesIcon, BotIcon, TrendingUpIcon } from "lucide-react"

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

interface Props {
  currency: string
  locale: string
  monthStartDay: number
  onChange: (patch: Partial<AppSettings>) => void
}

export function StepWelcome({ currency, locale, monthStartDay, onChange }: Props) {
  return (
    <div className="space-y-6">
      {/* Pitch */}
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">
          Your money, with an agent that actually works.
        </h2>
        <p className="text-xs/relaxed text-muted-foreground">
          Finora is a local-first personal finance app. Your data stays in your browser —
          no account needed, no cloud sync. The AI agent runs offline by default.
        </p>
      </div>

      {/* Feature highlights */}
      <ItemGroup>
        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <SparklesIcon className="text-primary" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Smart Spreadsheet</ItemTitle>
            <ItemDescription>
              A transaction grid with inline editing, bulk AI categorisation, and CSV import — all in one place.
            </ItemDescription>
          </ItemContent>
        </Item>
        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <BotIcon className="text-primary" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>AI Agent</ItemTitle>
            <ItemDescription>
              Ask questions in plain language. Works fully offline in simulation mode; add an OpenAI or Ollama key for live answers.
            </ItemDescription>
          </ItemContent>
        </Item>
        <Item variant="outline" size="sm">
          <ItemMedia variant="icon">
            <TrendingUpIcon className="text-primary" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Insights & Budgets</ItemTitle>
            <ItemDescription>
              Cashflow charts, budget tracking, goals, and subscription detection — everything computed from your data, locally.
            </ItemDescription>
          </ItemContent>
        </Item>
      </ItemGroup>

      {/* Settings */}
      <FieldSet>
        <FieldLegend variant="label">Preferences</FieldLegend>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel>Currency</FieldLabel>
            <Select
              value={currency}
              onValueChange={(val) => val && onChange({ currency: val })}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select currency" />
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
              value={locale}
              onValueChange={(val) => val && onChange({ locale: val })}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select locale" />
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
            <FieldLabel>Budget month starts</FieldLabel>
            <div className="space-y-1">
              <Select
                value={String(monthStartDay)}
                onValueChange={(val) => val && onChange({ monthStartDay: Number(val) })}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Day" />
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
                Set to your salary date for budget months that align with your pay cycle.
              </FieldDescription>
            </div>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  )
}
