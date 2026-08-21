import { useCallback, useEffect, useMemo } from "react"

import { formatMoney, formatMoneyCompact, formatPercent } from "@/lib/finance/money"
import { formatDisplayDate, formatShortDate } from "@/lib/finance/dates"
import { useFinanceStore } from "@/stores/useFinanceStore"

/**
 * Formatting bound to the user's currency and locale, so no component has to
 * remember to thread settings through by hand.
 */
export function useFormatters() {
  const currency = useFinanceStore((s) => s.settings.currency)
  const locale = useFinanceStore((s) => s.settings.locale)

  return useMemo(
    () => ({
      currency,
      locale,
      money: (minor: number, options?: { signDisplay?: Intl.NumberFormatOptions["signDisplay"]; maximumFractionDigits?: number }) =>
        formatMoney(minor, currency, locale, options),
      moneyCompact: (minor: number) => formatMoneyCompact(minor, currency, locale),
      percent: (ratio: number, digits = 0) => formatPercent(ratio, locale, digits),
      date: (iso: string) => formatDisplayDate(iso, locale),
      shortDate: (iso: string) => formatShortDate(iso, locale),
      number: (value: number) => new Intl.NumberFormat(locale).format(value),
    }),
    [currency, locale],
  )
}

/** Applies the `dark` class from settings, following the OS when set to system. */
export function useThemeSync() {
  const theme = useFinanceStore((s) => s.settings.theme)
  const updateSettings = useFinanceStore((s) => s.updateSettings)

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia("(prefers-color-scheme: dark)")

    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches)
      root.classList.toggle("dark", dark)
      root.style.colorScheme = dark ? "dark" : "light"
    }

    apply()
    if (theme !== "system") return
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [theme])

  const setTheme = useCallback(
    (next: "light" | "dark" | "system") => updateSettings({ theme: next }),
    [updateSettings],
  )

  const toggleTheme = useCallback(() => {
    const isDark = document.documentElement.classList.contains("dark")
    updateSettings({ theme: isDark ? "light" : "dark" })
  }, [updateSettings])

  return { theme, setTheme, toggleTheme }
}

/** Density affects table row padding across the app. */
export function useDensity() {
  const density = useFinanceStore((s) => s.settings.density)
  return {
    density,
    isCompact: density === "compact",
    rowPadding: density === "compact" ? "py-1.5" : "py-2.5",
  }
}
