/**
 * Filter bar for the transactions sheet.
 *
 * Builds a TransactionQuery and exposes the filtered rows via the `onChange` callback.
 */
import { useEffect, useMemo, useState } from "react"
import { Search, X, SlidersHorizontal, CalendarDays } from "lucide-react"

import type { Transaction, TransactionQuery, TransactionStatus } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { queryTransactions } from "@/lib/finance/calc"
import { useFormatters } from "@/hooks/useAppSettings"
import { cn } from "@/lib/utils"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Direction = "all" | "income" | "expense"

interface FilterState {
  search: string
  accountIds: string[]
  categoryIds: string[]
  direction: Direction
  statuses: TransactionStatus[]
  from?: string
  to?: string
  amountRange: [number, number]
  uncategorizedOnly: boolean
}

interface TransactionFiltersProps {
  allTransactions: Transaction[]
  onChange: (filtered: Transaction[]) => void
}

const DEFAULT_MAX_AMOUNT = 50000 // major units for the slider display

export function TransactionFilters({ allTransactions, onChange }: TransactionFiltersProps) {
  const accounts = useFinanceStore((s) => s.accounts)
  const categories = useFinanceStore((s) => s.categories)
  const fmt = useFormatters()

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    accountIds: [],
    categoryIds: [],
    direction: "all",
    statuses: [],
    from: undefined,
    to: undefined,
    amountRange: [0, DEFAULT_MAX_AMOUNT],
    uncategorizedOnly: false,
  })

  const [dateRangeOpen, setDateRangeOpen] = useState(false)

  // Build query from filter state
  const query = useMemo<TransactionQuery>(() => {
    const q: TransactionQuery = {}
    if (filters.search.trim()) q.search = filters.search.trim()
    if (filters.accountIds.length) q.accountIds = filters.accountIds
    if (filters.categoryIds.length) q.categoryIds = filters.categoryIds
    if (filters.direction !== "all") q.direction = filters.direction
    if (filters.statuses.length) q.status = filters.statuses
    if (filters.from) q.from = filters.from
    if (filters.to) q.to = filters.to
    if (filters.uncategorizedOnly) q.uncategorizedOnly = true

    return q
  }, [filters])

  // Apply filter
  const filtered = useMemo(() => queryTransactions(allTransactions, query), [allTransactions, query])

  // Emit changes upward
  useEffect(() => {
    onChange(filtered)
  }, [filtered, onChange])

  const update = (partial: Partial<FilterState>) => setFilters((f) => ({ ...f, ...partial }))

  const clearAll = () => setFilters({
    search: "",
    accountIds: [],
    categoryIds: [],
    direction: "all",
    statuses: [],
    from: undefined,
    to: undefined,
    amountRange: [0, DEFAULT_MAX_AMOUNT],
    uncategorizedOnly: false,
  })

  // Active filter badges
  const activeBadges: { label: string; clear: () => void }[] = []
  if (filters.search) activeBadges.push({ label: `"${filters.search}"`, clear: () => update({ search: "" }) })
  if (filters.accountIds.length) activeBadges.push({
    label: `${filters.accountIds.length} account${filters.accountIds.length > 1 ? "s" : ""}`,
    clear: () => update({ accountIds: [] }),
  })
  if (filters.categoryIds.length) activeBadges.push({
    label: `${filters.categoryIds.length} categor${filters.categoryIds.length > 1 ? "ies" : "y"}`,
    clear: () => update({ categoryIds: [] }),
  })
  if (filters.direction !== "all") activeBadges.push({
    label: filters.direction,
    clear: () => update({ direction: "all" }),
  })
  if (filters.statuses.length) activeBadges.push({
    label: `Status: ${filters.statuses.join(", ")}`,
    clear: () => update({ statuses: [] }),
  })
  if (filters.from || filters.to) activeBadges.push({
    label: `${filters.from ?? "…"} → ${filters.to ?? "…"}`,
    clear: () => update({ from: undefined, to: undefined }),
  })
  if (filters.uncategorizedOnly) activeBadges.push({
    label: "Uncategorized only",
    clear: () => update({ uncategorizedOnly: false }),
  })

  const hasFilters = activeBadges.length > 0

  const DIRECTION_OPTIONS: { value: Direction; label: string }[] = [
    { value: "all", label: "All" },
    { value: "income", label: "Income" },
    { value: "expense", label: "Expense" },
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Search payee, memo…"
            className="pl-7 h-8"
          />
          {filters.search && (
            <button
              onClick={() => update({ search: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Direction toggle — manual buttons since ToggleGroup value type is string[] */}
        <div className="flex border border-input rounded-none overflow-hidden">
          {DIRECTION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ direction: opt.value })}
              className={cn(
                "h-8 px-3 text-xs font-medium transition-colors",
                filters.direction === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                "not-first:border-l border-input",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Accounts */}
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button size="sm" variant="outline" className={filters.accountIds.length ? "border-primary" : ""}>
              Accounts
              {filters.accountIds.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{filters.accountIds.length}</Badge>
              )}
            </Button>
          } />
          <DropdownMenuContent>
            <DropdownMenuLabel>Accounts</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {accounts.map((a) => (
              <DropdownMenuCheckboxItem
                key={a.id}
                checked={filters.accountIds.includes(a.id)}
                onCheckedChange={(checked) => {
                  update({
                    accountIds: checked
                      ? [...filters.accountIds, a.id]
                      : filters.accountIds.filter((id) => id !== a.id),
                  })
                }}
              >
                {a.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Categories */}
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button size="sm" variant="outline" className={filters.categoryIds.length ? "border-primary" : ""}>
              Categories
              {filters.categoryIds.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{filters.categoryIds.length}</Badge>
              )}
            </Button>
          } />
          <DropdownMenuContent className="max-h-64 overflow-y-auto">
            <DropdownMenuLabel>Categories</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {categories.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={filters.categoryIds.includes(c.id)}
                onCheckedChange={(checked) => {
                  update({
                    categoryIds: checked
                      ? [...filters.categoryIds, c.id]
                      : filters.categoryIds.filter((id) => id !== c.id),
                  })
                }}
              >
                {c.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status */}
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button size="sm" variant="outline" className={filters.statuses.length ? "border-primary" : ""}>
              Status
            </Button>
          } />
          <DropdownMenuContent>
            {(["cleared", "pending", "reconciled"] as TransactionStatus[]).map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={filters.statuses.includes(s)}
                onCheckedChange={(checked) => {
                  update({
                    statuses: checked
                      ? [...filters.statuses, s]
                      : filters.statuses.filter((x) => x !== s),
                  })
                }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Date range */}
        <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
          <PopoverTrigger
            render={
              <Button
                size="sm"
                variant="outline"
                className={cn(filters.from || filters.to ? "border-primary" : "")}
              >
                <CalendarDays className="size-3.5" />
                {filters.from || filters.to
                  ? `${filters.from ?? "…"} → ${filters.to ?? "…"}`
                  : "Date range"
                }
              </Button>
            }
          />
          <PopoverContent className="w-auto p-3" align="start">
            <div className="flex gap-4">
              <div>
                <p className="text-xs font-medium mb-1">From</p>
                <Calendar
                  mode="single"
                  selected={filters.from ? new Date(filters.from) : undefined}
                  onSelect={(d?: Date) => {
                    if (d) {
                      const iso = d.toISOString().slice(0, 10)
                      update({ from: iso })
                    }
                  }}
                />
              </div>
              <div>
                <p className="text-xs font-medium mb-1">To</p>
                <Calendar
                  mode="single"
                  selected={filters.to ? new Date(filters.to) : undefined}
                  onSelect={(d?: Date) => {
                    if (d) {
                      const iso = d.toISOString().slice(0, 10)
                      update({ to: iso })
                    }
                  }}
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => update({ from: undefined, to: undefined })}
            >
              Clear dates
            </Button>
          </PopoverContent>
        </Popover>

        {/* Amount range */}
        <Popover>
          <PopoverTrigger
            render={
              <Button
                size="sm"
                variant="outline"
                className={
                  filters.amountRange[0] > 0 || filters.amountRange[1] < DEFAULT_MAX_AMOUNT
                    ? "border-primary"
                    : ""
                }
              >
                <SlidersHorizontal className="size-3.5" />
                Amount
              </Button>
            }
          />
          <PopoverContent className="w-64 p-3">
            <p className="text-xs font-medium mb-3">Amount range</p>
            <Slider
              min={0}
              max={DEFAULT_MAX_AMOUNT}
              step={100}
              value={filters.amountRange}
              onValueChange={(v) => update({ amountRange: v as [number, number] })}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{fmt.money(filters.amountRange[0] * 100)}</span>
              <span>{fmt.money(filters.amountRange[1] * 100)}</span>
            </div>
          </PopoverContent>
        </Popover>

        {/* Uncategorized only */}
        <Label className="flex items-center gap-2 cursor-pointer text-muted-foreground">
          <Switch
            checked={filters.uncategorizedOnly}
            onCheckedChange={(checked) => update({ uncategorizedOnly: checked })}
            size="sm"
          />
          Uncategorized
        </Label>

        {/* Clear all */}
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearAll} className="text-muted-foreground">
            <X className="size-3.5" />
            Clear all
          </Button>
        )}
      </div>

      {/* Active filter badges */}
      {activeBadges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeBadges.map((badge) => (
            <Badge key={badge.label} variant="secondary" className="h-5 text-[10px] gap-1 pr-1">
              {badge.label}
              <button onClick={badge.clear} className="ml-0.5 hover:text-destructive">
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
