import { useMemo } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Info, CreditCard } from "lucide-react"
import { useFormatters } from "@/hooks/useAppSettings"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { detectSubscriptions } from "@/lib/finance/calc"
import type { DetectedSubscription } from "@/types/finance"

const EXCLUDED_CATEGORY_IDS = ["cat-rent", "cat-taxes", "cat-utilities", "cat-insurance"]

function cadenceBadgeVariant(cadence: DetectedSubscription["cadence"]): "default" | "secondary" | "outline" {
  switch (cadence) {
    case "monthly": return "default"
    case "yearly": return "secondary"
    case "quarterly": return "outline"
    default: return "outline"
  }
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.85) return "High"
  if (confidence >= 0.7) return "Medium"
  return "Low"
}

function confidenceVariant(confidence: number): "default" | "secondary" | "outline" {
  if (confidence >= 0.85) return "default"
  if (confidence >= 0.7) return "secondary"
  return "outline"
}

export function SubscriptionsTab() {
  const fmt = useFormatters()
  const transactions = useFinanceStore((s) => s.transactions)

  const subscriptions = useMemo(
    () =>
      detectSubscriptions(transactions, {
        excludeCategoryIds: EXCLUDED_CATEGORY_IDS,
        minOccurrences: 3,
      }),
    [transactions],
  )

  const totalAnnual = useMemo(
    () => subscriptions.reduce((s, sub) => s + sub.annualCost, 0),
    [subscriptions],
  )

  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-xs text-muted-foreground">
          No recurring subscriptions detected yet. Check back after more transactions are loaded.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Alert>
        <CreditCard className="size-4" />
        <AlertTitle>
          {subscriptions.length} subscription{subscriptions.length > 1 ? "s" : ""} detected
        </AlertTitle>
        <AlertDescription>
          Total annualised cost: <strong>{fmt.money(totalAnnual)}</strong>/year
          &nbsp;· {fmt.money(Math.round(totalAnnual / 12))}/month estimated.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Detected subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payee</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="text-right">Annual</TableHead>
                <TableHead>Next expected</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => {
                const monthly =
                  sub.cadence === "monthly"
                    ? sub.amount
                    : sub.cadence === "yearly"
                    ? Math.round(sub.annualCost / 12)
                    : sub.cadence === "quarterly"
                    ? Math.round(sub.annualCost / 12)
                    : Math.round(sub.annualCost / 12)

                return (
                  <TableRow key={sub.payee}>
                    <TableCell className="font-medium">{sub.payee}</TableCell>
                    <TableCell>
                      <Badge variant={cadenceBadgeVariant(sub.cadence)}>{sub.cadence}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt.money(sub.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt.money(monthly)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt.money(sub.annualCost)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {sub.nextExpectedDate ? fmt.shortDate(sub.nextExpectedDate) : "—"}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 cursor-default">
                          <Badge variant={confidenceVariant(sub.confidence)}>
                            {confidenceLabel(sub.confidence)}
                          </Badge>
                          <Info className="size-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Confidence score: {Math.round(sub.confidence * 100)}% based on {sub.occurrences} occurrences.
                          Cadence: {sub.cadence}, last seen {fmt.shortDate(sub.lastDate)}.
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
