import { useMemo } from "react"
import { Download, FileText, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

import { PageHeader, PageShell } from "@/components/shared/PageHeader"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { useFormatters } from "@/hooks/useAppSettings"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useActiveRange } from "@/stores/useUiStore"
import {
  summarize,
  categoryBreakdown,
  detectSubscriptions,
  queryTransactions,
} from "@/lib/finance/calc"

import { OverviewTab } from "@/components/reports/OverviewTab"
import { CategoryTab } from "@/components/reports/CategoryTab"
import { PayeeTab } from "@/components/reports/PayeeTab"
import { TrendsTab } from "@/components/reports/TrendsTab"
import { SubscriptionsTab } from "@/components/reports/SubscriptionsTab"
import { AINarrativeCard } from "@/components/reports/AINarrativeCard"
import { exportCategoryCSV, exportReportMarkdown } from "@/components/reports/narrative"

const EXCLUDED_CATEGORY_IDS = ["cat-rent", "cat-taxes", "cat-utilities", "cat-insurance"]

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const fmt = useFormatters()
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)
  const range = useActiveRange(monthStartDay)

  const exportInput = useMemo(() => {
    const txns = queryTransactions(transactions, { includeTransfers: false })
    const current = summarize(txns, categories, range)
    const breakdown = categoryBreakdown(
      txns.filter((t) => t.date >= range.from && t.date <= range.to && t.amount < 0),
      categories,
      "expense",
    )
    const subscriptions = detectSubscriptions(txns, {
      excludeCategoryIds: EXCLUDED_CATEGORY_IDS,
    })
    return {
      current,
      previous: null,
      range,
      breakdown,
      subscriptions,
      currency: fmt.currency,
      locale: fmt.locale,
    }
  }, [transactions, categories, range, fmt.currency, fmt.locale])

  const handleExportCSV = () => {
    const csv = exportCategoryCSV(exportInput)
    downloadBlob(csv, `finora-report-${range.from}.csv`, "text/csv")
    toast.success("Report exported as CSV")
  }

  const handleExportMarkdown = () => {
    const md = exportReportMarkdown(exportInput)
    downloadBlob(md, `finora-report-${range.from}.md`, "text/markdown")
    toast.success("Report exported as Markdown")
  }

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        description="Analyse your finances over any period"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline">
                  <Download />
                  Export
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileSpreadsheet />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportMarkdown}>
                <FileText />
                Export as Markdown
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <AINarrativeCard range={range} />

      <Tabs defaultValue="overview">
        <TabsList className="w-full max-w-lg">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categories">By category</TabsTrigger>
          <TabsTrigger value="payees">By payee</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab range={range} />
        </TabsContent>

        <TabsContent value="categories">
          <CategoryTab range={range} />
        </TabsContent>

        <TabsContent value="payees">
          <PayeeTab range={range} />
        </TabsContent>

        <TabsContent value="trends">
          <TrendsTab range={range} />
        </TabsContent>

        <TabsContent value="subscriptions">
          <SubscriptionsTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
