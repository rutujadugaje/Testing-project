import { useMemo, useState, useCallback } from "react"
import { Plus, Pencil, Trash2, AlertCircle } from "lucide-react"
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"

import { PageHeader, PageShell } from "@/components/shared/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Tooltip as UiTooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from "@/components/ui/empty"

import { useFormatters } from "@/hooks/useAppSettings"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { toMajor } from "@/lib/finance/money"
import { CHART_COLORS } from "@/lib/icons"
import { cn } from "@/lib/utils"
import type { Holding } from "@/types/finance"

type AssetClass = Holding["assetClass"]

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: "Equity",
  etf: "ETF",
  bond: "Bond",
  crypto: "Crypto",
  cash: "Cash",
}

const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  equity: CHART_COLORS[0],
  etf: CHART_COLORS[1],
  bond: CHART_COLORS[2],
  crypto: CHART_COLORS[3],
  cash: CHART_COLORS[4],
}

interface HoldingFormState {
  symbol: string
  name: string
  assetClass: AssetClass
  quantity: string
  costBasis: string
  lastPrice: string
  accountId: string
}

const EMPTY_FORM: HoldingFormState = {
  symbol: "",
  name: "",
  assetClass: "equity",
  quantity: "",
  costBasis: "",
  lastPrice: "",
  accountId: "",
}

function HoldingDialog({
  holding,
  onSave,
  children,
}: {
  holding?: Holding
  onSave: (data: Omit<Holding, "id">) => void
  children: React.ReactNode
}) {
  const accounts = useFinanceStore((s) => s.accounts)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<HoldingFormState>(() =>
    holding
      ? {
          symbol: holding.symbol,
          name: holding.name,
          assetClass: holding.assetClass,
          quantity: String(holding.quantity),
          costBasis: String(toMajor(holding.costBasis)),
          lastPrice: String(toMajor(holding.lastPrice)),
          accountId: holding.accountId,
        }
      : { ...EMPTY_FORM, accountId: accounts[0]?.id ?? "" },
  )

  const investmentAccounts = accounts.filter((a) => a.type === "investment" || a.type === "savings")
  const displayAccounts = investmentAccounts.length > 0 ? investmentAccounts : accounts

  function set(key: keyof HoldingFormState) {
    return (val: string) => setForm((f) => ({ ...f, [key]: val }))
  }

  function handleSave() {
    const qty = parseFloat(form.quantity)
    const cost = parseFloat(form.costBasis)
    const price = parseFloat(form.lastPrice)
    if (!form.symbol || !form.name || isNaN(qty) || isNaN(cost) || isNaN(price)) return

    onSave({
      symbol: form.symbol.toUpperCase(),
      name: form.name,
      assetClass: form.assetClass,
      quantity: qty,
      costBasis: Math.round(cost * 100),
      lastPrice: Math.round(price * 100),
      accountId: form.accountId || (displayAccounts[0]?.id ?? ""),
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)} className="contents">{children}</span>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{holding ? "Edit holding" : "Add holding"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>Symbol</FieldLabel>
            <Input
              placeholder="e.g. CW8"
              value={form.symbol}
              onChange={(e) => set("symbol")(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Asset class</FieldLabel>
            <Select value={form.assetClass} onValueChange={(v) => v && set("assetClass")(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ASSET_CLASS_LABELS) as AssetClass[]).map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {ASSET_CLASS_LABELS[cls]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="col-span-2">
            <FieldLabel>Full name</FieldLabel>
            <Input
              placeholder="e.g. Amundi MSCI World"
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Quantity</FieldLabel>
            <Input
              type="number"
              placeholder="0"
              value={form.quantity}
              onChange={(e) => set("quantity")(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Cost basis (per share)</FieldLabel>
            <Input
              type="number"
              placeholder="0.00"
              value={form.costBasis}
              onChange={(e) => set("costBasis")(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Last price (per share)</FieldLabel>
            <Input
              type="number"
              placeholder="0.00"
              value={form.lastPrice}
              onChange={(e) => set("lastPrice")(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Account</FieldLabel>
            <Select value={form.accountId} onValueChange={(v) => v && set("accountId")(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                {displayAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter showCloseButton>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function InvestmentsPage() {
  const fmt = useFormatters()
  const holdings = useFinanceStore((s) => s.holdings)
  const addHolding = useFinanceStore((s) => s.addHolding)
  const updateHolding = useFinanceStore((s) => s.updateHolding)
  const deleteHolding = useFinanceStore((s) => s.deleteHolding)

  const handleAdd = useCallback(
    (data: Omit<Holding, "id">) => {
      addHolding(data)
    },
    [addHolding],
  )

  const handleUpdate = useCallback(
    (id: string, data: Omit<Holding, "id">) => {
      updateHolding(id, data)
    },
    [updateHolding],
  )

  const totals = useMemo(() => {
    const totalValue = holdings.reduce((s, h) => s + h.quantity * h.lastPrice, 0)
    const totalCost = holdings.reduce((s, h) => s + h.quantity * h.costBasis, 0)
    const unrealised = totalValue - totalCost
    const unrealisedPct = totalCost > 0 ? unrealised / totalCost : 0
    return { totalValue, totalCost, unrealised, unrealisedPct }
  }, [holdings])

  // Allocation by asset class
  const allocationData = useMemo(() => {
    const byClass = new Map<AssetClass, number>()
    for (const h of holdings) {
      byClass.set(h.assetClass, (byClass.get(h.assetClass) ?? 0) + h.quantity * h.lastPrice)
    }
    return [...byClass.entries()].map(([cls, value]) => ({
      name: ASSET_CLASS_LABELS[cls],
      value,
      fill: ASSET_CLASS_COLORS[cls],
    }))
  }, [holdings])

  // Bar chart by holding
  const holdingBarData = useMemo(
    () =>
      holdings
        .map((h) => ({
          name: h.symbol,
          value: toMajor(h.quantity * h.lastPrice),
        }))
        .sort((a, b) => b.value - a.value),
    [holdings],
  )

  const allocChartConfig: ChartConfig = useMemo(
    () =>
      Object.fromEntries(
        allocationData.map((d) => [d.name, { label: d.name, color: d.fill }]),
      ),
    [allocationData],
  )

  const barConfig: ChartConfig = {
    value: { label: "Market value", color: CHART_COLORS[1] },
  }

  if (holdings.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Investments" description="Track your portfolio" />
        <Empty className="min-h-[60vh] border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Plus />
            </EmptyMedia>
            <EmptyTitle>No holdings yet</EmptyTitle>
            <EmptyDescription>Add your first investment to start tracking your portfolio.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <HoldingDialog onSave={handleAdd}>
              <Button>
                <Plus />
                Add holding
              </Button>
            </HoldingDialog>
          </EmptyContent>
        </Empty>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Investments"
        description="Track your portfolio performance"
        actions={
          <HoldingDialog onSave={handleAdd}>
            <Button>
              <Plus />
              Add holding
            </Button>
          </HoldingDialog>
        }
      />

      <Alert>
        <AlertCircle className="size-4" />
        <AlertTitle>Prices are static</AlertTitle>
        <AlertDescription>
          Last prices are entered manually — no live market data in v1. Gain/loss figures are indicative only.
        </AlertDescription>
      </Alert>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Allocation by asset class</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <ChartContainer config={allocChartConfig} className="h-40 w-40 shrink-0">
              <PieChart>
                <Pie data={allocationData} cx="50%" cy="50%" innerRadius="55%" outerRadius="88%" dataKey="value">
                  {allocationData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="var(--background)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload as typeof allocationData[0]
                    const pct = totals.totalValue > 0 ? d.value / totals.totalValue : 0
                    return (
                      <div className="rounded-none border border-border bg-background px-2 py-1.5 text-xs shadow-md">
                        <p className="font-medium">{d.name}</p>
                        <p className="text-muted-foreground">{fmt.money(d.value)} · {fmt.percent(pct, 1)}</p>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ChartContainer>
            <div className="flex flex-1 flex-col gap-1.5">
              {allocationData.map((d) => {
                const pct = totals.totalValue > 0 ? d.value / totals.totalValue : 0
                return (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="size-2 shrink-0 rounded-full" style={{ background: d.fill }} />
                    <span className="flex-1 truncate text-muted-foreground">{d.name}</span>
                    <span className="tabular-nums">{fmt.percent(pct, 1)}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Value by holding</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} className="h-40 w-full">
              <BarChart data={holdingBarData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v: number) => fmt.moneyCompact(Math.round(v * 100))}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(v) => fmt.money(Math.round((v as number) * 100))}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Holdings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Cost basis</TableHead>
                <TableHead className="text-right">Last price</TableHead>
                <TableHead className="text-right">Market value</TableHead>
                <TableHead className="text-right">Gain / Loss</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((h) => {
                const value = h.quantity * h.lastPrice
                const cost = h.quantity * h.costBasis
                const gl = value - cost
                const glPct = cost > 0 ? gl / cost : 0
                const isGain = gl >= 0

                return (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono font-medium">{h.symbol}</TableCell>
                    <TableCell className="max-w-32 truncate">{h.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{ borderColor: ASSET_CLASS_COLORS[h.assetClass], color: ASSET_CLASS_COLORS[h.assetClass] }}
                      >
                        {ASSET_CLASS_LABELS[h.assetClass]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{h.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt.money(h.costBasis)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt.money(h.lastPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmt.money(value)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums font-medium",
                        isGain ? "text-foreground" : "text-destructive",
                      )}
                    >
                      {isGain ? "+" : ""}{fmt.money(gl)}
                      <span className="ml-1 text-xs opacity-70">({isGain ? "+" : ""}{fmt.percent(glPct, 1)})</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <HoldingDialog holding={h} onSave={(data) => handleUpdate(h.id, data)}>
                          <UiTooltip>
                            <TooltipTrigger
                              render={
                                <Button variant="ghost" size="icon-xs" aria-label={`Edit ${h.symbol}`}>
                                  <Pencil />
                                </Button>
                              }
                            />
                            <TooltipContent>Edit</TooltipContent>
                          </UiTooltip>
                        </HoldingDialog>

                        <AlertDialog>
                          <UiTooltip>
                            <AlertDialogTrigger
                              render={
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className="text-destructive"
                                      aria-label={`Delete ${h.symbol}`}
                                    >
                                      <Trash2 />
                                    </Button>
                                  }
                                />
                              }
                            />
                            <TooltipContent>Delete</TooltipContent>
                          </UiTooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {h.symbol}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove {h.name} from your portfolio. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteHolding(h.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6} className="font-medium">Total</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{fmt.money(totals.totalValue)}</TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums font-medium",
                    totals.unrealised >= 0 ? "text-foreground" : "text-destructive",
                  )}
                >
                  {totals.unrealised >= 0 ? "+" : ""}{fmt.money(totals.unrealised)}
                  <span className="ml-1 text-xs opacity-70">
                    ({totals.unrealised >= 0 ? "+" : ""}{fmt.percent(totals.unrealisedPct, 1)})
                  </span>
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  )
}
