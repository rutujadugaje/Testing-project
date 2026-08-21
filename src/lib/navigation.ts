import {
  Bot,
  LayoutDashboard,
  ListOrdered,
  PieChart,
  Receipt,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  Wand2,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  title: string
  url: string
  icon: LucideIcon
  /** Shown in the sidebar and used as the breadcrumb leaf. */
  description: string
  group: "overview" | "money" | "planning" | "system"
  /** Command palette aliases so "spend" finds Transactions. */
  keywords?: string[]
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    description: "Balances, cashflow and today's brief",
    group: "overview",
    keywords: ["home", "overview", "kpi", "summary"],
  },
  {
    title: "Transactions",
    url: "/transactions",
    icon: Receipt,
    description: "The sheet: import, edit and categorize",
    group: "money",
    keywords: ["spend", "grid", "sheet", "csv", "import", "expenses"],
  },
  {
    title: "Accounts",
    url: "/accounts",
    icon: Wallet,
    description: "Balances and transfers",
    group: "money",
    keywords: ["bank", "balance", "transfer", "card"],
  },
  {
    title: "Budgets",
    url: "/budgets",
    icon: PieChart,
    description: "Monthly limits by category",
    group: "planning",
    keywords: ["limit", "envelope", "monthly"],
  },
  {
    title: "Goals",
    url: "/goals",
    icon: Target,
    description: "Savings targets and timelines",
    group: "planning",
    keywords: ["saving", "target", "deadline"],
  },
  {
    title: "Investments",
    url: "/investments",
    icon: TrendingUp,
    description: "Holdings and allocation",
    group: "planning",
    keywords: ["portfolio", "stocks", "etf", "holdings"],
  },
  {
    title: "Reports",
    url: "/reports",
    icon: ListOrdered,
    description: "Period breakdowns with AI narrative",
    group: "planning",
    keywords: ["analysis", "breakdown", "period", "export"],
  },
  {
    title: "Rules",
    url: "/rules",
    icon: Wand2,
    description: "Auto-categorization rules",
    group: "system",
    keywords: ["automation", "auto", "categorize"],
  },
  {
    title: "Agent",
    url: "/agent",
    icon: Bot,
    description: "Full-page agent workspace",
    group: "system",
    keywords: ["ai", "chat", "assistant", "copilot"],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    description: "Currency, locale, theme and data",
    group: "system",
    keywords: ["preferences", "currency", "locale", "theme", "api key", "backup", "reset"],
  },
]

export const ONBOARDING_ITEM: NavItem = {
  title: "Onboarding",
  url: "/onboarding",
  icon: Sparkles,
  description: "First-run setup",
  group: "system",
}

export const NAV_GROUPS: { id: NavItem["group"]; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "money", label: "Money" },
  { id: "planning", label: "Planning" },
  { id: "system", label: "Workspace" },
]

export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/") return NAV_ITEMS[0]
  if (pathname.startsWith("/onboarding")) return ONBOARDING_ITEM
  return NAV_ITEMS.find((item) => item.url !== "/" && pathname.startsWith(item.url))
}
