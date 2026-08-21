/**
 * Transactions page — the main financial data sheet.
 *
 * URL params:
 *  ?import=1  — auto-opens the CSV import dialog
 *  ?export=1  — exports the currently filtered rows on mount
 *
 * AI seam: <div data-slot="ai-grid-toolbar" /> is rendered inside
 * TransactionsTable above the rows — mount an AI toolbar there.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Download, Upload, Bot } from "lucide-react"
import { toast } from "sonner"

import type { Transaction } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"
import { useFormatters } from "@/hooks/useAppSettings"
import { transactionsToCsv, downloadCsv } from "@/lib/csv/export"

import { PageHeader, PageShell } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { TransactionsTable } from "@/components/transactions/TransactionsTable"
import { TransactionFilters } from "@/components/transactions/TransactionFilters"
import { BulkActionsBar } from "@/components/transactions/BulkActionsBar"
import { ImportCsvDialog } from "@/components/transactions/ImportCsvDialog"
import { AiGridToolbar } from "@/components/transactions/AiGridToolbar"

export default function TransactionsPage() {
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const accounts = useFinanceStore((s) => s.accounts)
  const settings = useFinanceStore((s) => s.settings)
  const selectedIds = useUiStore((s) => s.selectedTransactionIds)
  const askAgent = useUiStore((s) => s.askAgent)

  const fmt = useFormatters()
  const location = useLocation()
  const navigate = useNavigate()

  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>(transactions)
  const [importOpen, setImportOpen] = useState(false)

  const handleFilterChange = useCallback((filtered: Transaction[]) => {
    setFilteredTransactions(filtered)
  }, [])

  // Handle URL params
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get("import") === "1") {
      setImportOpen(true)
    }
    if (params.get("export") === "1") {
      const csv = transactionsToCsv(filteredTransactions, categories, accounts, settings.locale)
      downloadCsv(`transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv)
      toast.success(`Exported ${filteredTransactions.length} transactions`)
      // Remove the export param
      const next = new URLSearchParams(location.search)
      next.delete("export")
      navigate({ search: next.toString() }, { replace: true })
    }
  // We intentionally only run this on mount and on search param changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  const handleImportClose = (open: boolean) => {
    setImportOpen(open)
    if (!open) {
      // Clear the ?import=1 param
      const params = new URLSearchParams(location.search)
      params.delete("import")
      navigate({ search: params.toString() }, { replace: true })
    }
  }

  const handleExport = () => {
    const csv = transactionsToCsv(filteredTransactions, categories, accounts, settings.locale)
    downloadCsv(`transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    toast.success(`Exported ${filteredTransactions.length} transactions`)
  }

  // Selected transactions (stable reference)
  const selectedTransactions = useMemo(
    () => transactions.filter((t) => selectedIds.includes(t.id)),
    [transactions, selectedIds],
  )

  // Page description: count + total
  const totalAmount = useMemo(
    () => filteredTransactions.reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions],
  )

  const description = `${filteredTransactions.length} transaction${filteredTransactions.length !== 1 ? "s" : ""} · Net ${fmt.money(totalAmount)}`

  return (
    <PageShell>
      <PageHeader
        title="Transactions"
        description={description}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-3.5" />
              Import CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
            >
              <Download className="size-3.5" />
              Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => askAgent("What patterns do you see in my transactions?")}
              aria-label="Open AI actions"
            >
              <Bot className="size-3.5" />
              AI actions
            </Button>
          </>
        }
      />

      {/* Filters */}
      <TransactionFilters
        allTransactions={transactions}
        onChange={handleFilterChange}
      />

      {/* Bulk actions bar (shown when rows are selected) */}
      {selectedTransactions.length > 0 && (
        <BulkActionsBar selectedTransactions={selectedTransactions} />
      )}

      {/* AI toolbar — replace the placeholder seam */}
      <AiGridToolbar filteredTransactions={filteredTransactions} />

      {/* Table */}
      <TransactionsTable
        transactions={filteredTransactions}
        onImport={() => setImportOpen(true)}
      />

      {/* CSV import dialog */}
      <ImportCsvDialog open={importOpen} onOpenChange={handleImportClose} />
    </PageShell>
  )
}
