import { useMemo } from "react"
import { Upload } from "lucide-react"

import { Link } from "react-router-dom"
import { PageHeader, PageShell } from "@/components/shared/PageHeader"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from "@/components/ui/empty"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { queryTransactions } from "@/lib/finance/calc"

import { KpiCards } from "@/components/dashboard/KpiCards"
import { CashflowChart } from "@/components/dashboard/CashflowChart"
import { SpendingDonut } from "@/components/dashboard/SpendingDonut"
import { BudgetHealth } from "@/components/dashboard/BudgetHealth"
import { AIDailyBrief } from "@/components/dashboard/AIDailyBrief"
import { InsightCarousel } from "@/components/dashboard/InsightCarousel"
import { RecentActivity } from "@/components/dashboard/RecentActivity"

export default function DashboardPage() {
  const transactions = useFinanceStore((s) => s.transactions)

  const hasData = useMemo(
    () => queryTransactions(transactions, { includeTransfers: false }).length > 0,
    [transactions],
  )

  if (!hasData) {
    return (
      <PageShell>
        <PageHeader
          title="Dashboard"
          description="Your financial overview at a glance"
        />
        <Empty className="min-h-[60vh] border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Upload />
            </EmptyMedia>
            <EmptyTitle>No data yet</EmptyTitle>
            <EmptyDescription>
              Load sample data or import your transactions to see your financial dashboard.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-wrap gap-2">
              <Link to="/onboarding" className="inline-flex h-8 items-center gap-1.5 rounded-none bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/80">Get started</Link>
              <Link to="/settings" className="inline-flex h-8 items-center gap-1.5 rounded-none border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted">Settings</Link>
            </div>
          </EmptyContent>
        </Empty>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Dashboard" description="Your financial overview at a glance" />

      {/* KPI row */}
      <KpiCards />

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Cashflow chart — takes 2 columns */}
        <div className="xl:col-span-2">
          <CashflowChart />
        </div>

        {/* Budget health — 1 column */}
        <BudgetHealth />
      </div>

      {/* Spending donut + AI brief */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SpendingDonut />
        <AIDailyBrief />
      </div>

      {/* Insight carousel */}
      <InsightCarousel />

      {/* Recent activity */}
      <RecentActivity />
    </PageShell>
  )
}
