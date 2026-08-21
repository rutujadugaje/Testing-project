import {
  Banknote,
  Building2,
  Clapperboard,
  CreditCard,
  Fuel,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  LineChart,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Train,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react"

import type { AccountType } from "@/types/finance"

/** Icons referenced by `Category.icon`, resolved by name so data stays serialisable. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Banknote,
  Clapperboard,
  Fuel,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Train,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Zap,
}

export function categoryIcon(name: string | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Receipt
}

export const ACCOUNT_ICONS: Record<AccountType, LucideIcon> = {
  checking: Building2,
  savings: PiggyBank,
  credit: CreditCard,
  cash: Banknote,
  investment: LineChart,
}

export function accountIcon(type: AccountType): LucideIcon {
  return ACCOUNT_ICONS[type] ?? Building2
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit: "Credit card",
  cash: "Cash",
  investment: "Investment",
}

/** Palette for new accounts/categories/goals, kept inside the preset's tokens. */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

export function colorForIndex(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}
