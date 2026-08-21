import { lazy } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { AppLayout } from "@/components/layout/AppLayout"

// Route-level code splitting keeps the initial bundle lean; the Suspense
// boundary lives in AppLayout.
const DashboardPage = lazy(() => import("@/pages/DashboardPage"))
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage"))
const AccountsPage = lazy(() => import("@/pages/AccountsPage"))
const BudgetsPage = lazy(() => import("@/pages/BudgetsPage"))
const GoalsPage = lazy(() => import("@/pages/GoalsPage"))
const InvestmentsPage = lazy(() => import("@/pages/InvestmentsPage"))
const ReportsPage = lazy(() => import("@/pages/ReportsPage"))
const RulesPage = lazy(() => import("@/pages/RulesPage"))
const AgentPage = lazy(() => import("@/pages/AgentPage"))
const SettingsPage = lazy(() => import("@/pages/SettingsPage"))
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/investments" element={<InvestmentsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  )
}
