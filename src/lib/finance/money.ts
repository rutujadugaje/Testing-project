/**
 * Money helpers. All amounts are integer minor units (cents).
 */

/** Round half-away-from-zero so -0.5 -> -1 rather than 0. */
export function roundMinor(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

/** 12.34 -> 1234 */
export function toMinor(major: number): number {
  return roundMinor(major * 100)
}

/** 1234 -> 12.34 */
export function toMajor(minor: number): number {
  return minor / 100
}

export function formatMoney(
  minor: number,
  currency = "EUR",
  locale = "fr-FR",
  options: { signDisplay?: Intl.NumberFormatOptions["signDisplay"]; maximumFractionDigits?: number } = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    signDisplay: options.signDisplay ?? "auto",
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    minimumFractionDigits: options.maximumFractionDigits === 0 ? 0 : 2,
  }).format(toMajor(minor))
}

/** Compact form for chart axes and dense KPI deltas: €1.2k, €340 */
export function formatMoneyCompact(minor: number, currency = "EUR", locale = "fr-FR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(toMajor(minor))
}

export function formatPercent(ratio: number, locale = "fr-FR", digits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: digits,
  }).format(ratio)
}

/**
 * Parse a human/bank-formatted amount into minor units.
 * Handles `1 234,56`, `1,234.56`, `-1.234,56`, `(1 234,56)`, `€1 234,56`,
 * and unicode minus/NBSP that French bank exports love to emit.
 */
export function parseMoney(
  raw: string,
  opts: { decimalSeparator?: "," | "." } = {},
): number | undefined {
  if (raw == null) return undefined
  let s = String(raw).trim()
  if (!s) return undefined

  // Accounting negatives: (12,34)
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }

  // Strip currency symbols, letters, spaces (incl. NBSP/thin space), apostrophes.
  s = s
    .replace(/[−–—]/g, "-")
    .replace(/[   \s']/g, "")
    .replace(/[^\d.,+-]/g, "")

  if (!s || s === "-" || s === "+") return undefined
  if (s.startsWith("-")) {
    negative = !negative
    s = s.slice(1)
  } else if (s.startsWith("+")) {
    s = s.slice(1)
  }

  const decimalSeparator = opts.decimalSeparator ?? inferDecimalSeparator(s)
  const thousands = decimalSeparator === "," ? "." : ","

  s = s.split(thousands).join("")
  if (decimalSeparator === ",") s = s.replace(",", ".")

  // Any leftover separators mean an ambiguous string we should not guess at.
  if ((s.match(/\./g)?.length ?? 0) > 1) return undefined

  const value = Number.parseFloat(s)
  if (!Number.isFinite(value)) return undefined
  return roundMinor(negative ? -value * 100 : value * 100)
}

/**
 * Decide which separator is decimal by looking at the last one and how many
 * digits follow it. `1,234` is thousands; `1,23` is decimal.
 */
function inferDecimalSeparator(s: string): "," | "." {
  const lastComma = s.lastIndexOf(",")
  const lastDot = s.lastIndexOf(".")
  if (lastComma === -1 && lastDot === -1) return "."
  if (lastComma === -1) return "."
  if (lastDot === -1) {
    const decimals = s.length - lastComma - 1
    return decimals === 3 && (s.match(/,/g)?.length ?? 0) === 1 && s.length > 4 ? "." : ","
  }
  return lastComma > lastDot ? "," : "."
}

/** Split an amount into weighted parts whose sum equals the original exactly. */
export function splitAmount(minor: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return weights.map(() => 0)
  const parts = weights.map((w) => roundMinor((minor * w) / total))
  // Push the rounding remainder onto the largest slice.
  const drift = minor - parts.reduce((a, b) => a + b, 0)
  if (drift !== 0) {
    let idx = 0
    for (let i = 1; i < parts.length; i++) {
      if (Math.abs(parts[i]) > Math.abs(parts[idx])) idx = i
    }
    parts[idx] += drift
  }
  return parts
}
