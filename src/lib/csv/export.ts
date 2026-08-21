/**
 * CSV/JSON export utilities.
 * Pure module: no React, no store.
 */

import type { Transaction, Category, Account } from "@/types/finance"
import { toMajor } from "@/lib/finance/money"

/**
 * Convert transactions to a CSV string with human-readable headers.
 */
export function transactionsToCsv(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  locale: string,
): string {
  const catMap = new Map(categories.map((c) => [c.id, c.name]))
  const accMap = new Map(accounts.map((a) => [a.id, a.name]))

  // `Amount` is machine-readable (dot decimal) so the file re-imports cleanly;
  // `Amount (display)` keeps the locale-formatted value for humans reading it.
  const headers = [
    "Date",
    "Payee",
    "Category",
    "Account",
    "Amount",
    "Amount (display)",
    "Currency",
    "Status",
    "Tags",
    "Memo",
  ]

  const rows = transactions.map((t) => {
    // Machine-readable, dot-decimal, no thousands separators. A locale-formatted
    // amount ("-1 234,56") round-trips badly through a comma-delimited file even
    // when quoted, and spreadsheets re-interpret it against their own locale.
    const amount = toMajor(t.amount).toFixed(2)
    return [
      t.date,
      csvEscape(t.payee),
      csvEscape(catMap.get(t.categoryId ?? "") ?? ""),
      csvEscape(accMap.get(t.accountId) ?? ""),
      amount,
      csvEscape(
        toMajor(t.amount).toLocaleString(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      ),
      t.currency,
      t.status,
      csvEscape(t.tags.join("|")),
      csvEscape(t.memo ?? ""),
    ]
  })

  const lines = [headers.join(","), ...rows.map((r) => r.join(","))]
  return lines.join("\r\n")
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Trigger a CSV download in the browser.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Trigger a JSON download in the browser.
 */
export function downloadJson(filename: string, content: unknown): void {
  const json = JSON.stringify(content, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
