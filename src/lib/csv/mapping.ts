/**
 * Column mapping: guess which CSV headers map to which transaction fields,
 * and convert mapped rows into NewTransactionInput objects.
 *
 * Pure module: no React, no store.
 */

import type { ImportColumnMapping } from "@/types/finance"
import type { NewTransactionInput } from "@/stores/useFinanceStore"
import { transactionHash } from "@/lib/finance/hash"
import { parseMoney } from "@/lib/finance/money"
import { parse as dateFnsParse } from "date-fns"

// ---------------------------------------------------------------------------
// Fuzzy header matching
// ---------------------------------------------------------------------------

const DATE_PATTERNS = [
  /^date$/i,
  /^datum$/i,
  /^fecha$/i,
  /^data$/i,
  /^transaction.date/i,
  /^posted/i,
  /^date.op/i,
  /^date.val/i,
  /^date.transaction/i,
  /^booking.date/i,
  /^value.date/i,
  /^op(eration)?.date/i,
]

const AMOUNT_PATTERNS = [
  /^amount$/i,
  /^betrag$/i,
  /^importe$/i,
  /^value$/i,
  /^valeur$/i,
  /^net.amount/i,
  /^montant/i,
  /^amount.eur/i,
  /^montant.eur/i,
  /^sum$/i,
]

const DEBIT_PATTERNS = [
  /^debit$/i,
  /^d[ée]bit$/i,
  /^withdrawal/i,
  /^sortie/i,
  /^d[ée]pense/i,
]

const CREDIT_PATTERNS = [
  /^credit$/i,
  /^cr[ée]dit$/i,
  /^deposit/i,
  /^entr[ée]e/i,
]

const PAYEE_PATTERNS = [
  /^payee$/i,
  /^label$/i,
  /^beschreibung/i,
  /^concepto/i,
  /^descrizione/i,
  /^details?$/i,
  /^narrative/i,
  /^counterparty/i,
  /^transaction$/i,
  /^libell/i,
  /^description/i,
  /^b[ée]n[ée]ficiaire/i,
  /^merchant/i,
  /^contrepartie/i,
  /^name$/i,
  /^wording/i,
  /^reference.tiers/i,
]

const MEMO_PATTERNS = [
  /^memo$/i,
  /^notes$/i,
  /^reference$/i,
  /^r[ée]f[ée]rence/i,
  /^communication$/i,
  /^commentaire/i,
  /^information/i,
  /^detail/i,
]

const CATEGORY_PATTERNS = [
  /^category/i,
  /^cat[ée]gorie/i,
  /^type$/i,
]

function matchHeader(header: string, patterns: RegExp[]): boolean {
  const h = header.trim()
  return patterns.some((p) => p.test(h))
}

function firstMatch(headers: string[], patterns: RegExp[]): string | undefined {
  return headers.find((h) => matchHeader(h, patterns))
}

/**
 * Fuzzy-match CSV headers to ImportColumnMapping fields.
 */
export function guessMapping(headers: string[]): ImportColumnMapping {
  const mapping: ImportColumnMapping = {}

  mapping.date = firstMatch(headers, DATE_PATTERNS)
  mapping.amount = firstMatch(headers, AMOUNT_PATTERNS)
  mapping.debit = firstMatch(headers, DEBIT_PATTERNS)
  mapping.credit = firstMatch(headers, CREDIT_PATTERNS)
  mapping.payee = firstMatch(headers, PAYEE_PATTERNS)
  mapping.memo = firstMatch(headers, MEMO_PATTERNS)
  mapping.category = firstMatch(headers, CATEGORY_PATTERNS)

  // Remove undefined keys
  const result: ImportColumnMapping = {}
  if (mapping.date) result.date = mapping.date
  if (mapping.amount) result.amount = mapping.amount
  if (mapping.debit) result.debit = mapping.debit
  if (mapping.credit) result.credit = mapping.credit
  if (mapping.payee) result.payee = mapping.payee
  if (mapping.memo) result.memo = mapping.memo
  if (mapping.category) result.category = mapping.category

  return result
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

/**
 * Order matters. ISO is unambiguous so it goes first; day-first comes before
 * month-first because this app is EUR/fr-FR by default. `10/07/2026` is
 * genuinely ambiguous — see `detectDateFormat`, which resolves it by looking at
 * the whole column instead of guessing row by row.
 */
const DATE_FORMATS = [
  "yyyy-MM-dd",
  "yyyy/MM/dd",
  "dd/MM/yyyy",
  "dd.MM.yyyy",
  "dd-MM-yyyy",
  "MM/dd/yyyy",
  "d/M/yyyy",
  "M/d/yyyy",
  "dd/MM/yy",
  "MM/dd/yy",
  "d.M.yyyy",
  "yyyyMMdd",
]

/**
 * Decide day-first vs month-first from the entire column.
 *
 * A single `07/09/2026` cannot tell you which is the month, but a column
 * containing `13/07/2026` can: a value above 12 in the first position proves
 * day-first (and vice-versa). Only when the whole column is ambiguous do we fall
 * back to the locale hint.
 */
export function detectDateFormat(
  values: string[],
  localeHint: "day-first" | "month-first" = "day-first",
): string | undefined {
  let sawIso = false
  let dayFirstProof = false
  let monthFirstProof = false
  let separator: "/" | "." | "-" | undefined
  let slashCount = 0

  for (const raw of values) {
    const s = (raw ?? "").trim()
    if (!s) continue
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      sawIso = true
      continue
    }
    const m = s.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{2,4})/)
    if (!m) continue
    const first = Number(m[1])
    const second = Number(m[3])
    separator = m[2] as "/" | "." | "-"
    slashCount++
    if (first > 12) dayFirstProof = true
    if (second > 12) monthFirstProof = true
  }

  if (sawIso && slashCount === 0) return "yyyy-MM-dd"
  if (!separator) return undefined

  // Conflicting evidence means the column is not internally consistent; let the
  // per-row fallback deal with it rather than forcing a wrong format.
  if (dayFirstProof && monthFirstProof) return undefined

  const dayFirst = dayFirstProof || (!monthFirstProof && localeHint === "day-first")
  const pattern = dayFirst ? `dd${separator}MM${separator}yyyy` : `MM${separator}dd${separator}yyyy`
  return pattern
}

function parseDate(raw: string, hintFormat?: string): string | undefined {
  const s = raw.trim()
  if (!s) return undefined

  const formatsToTry = hintFormat ? [hintFormat, ...DATE_FORMATS] : DATE_FORMATS
  const ref = new Date(2000, 0, 1) // ref date for date-fns

  for (const fmt of formatsToTry) {
    try {
      const parsed = dateFnsParse(s, fmt, ref)
      if (!isNaN(parsed.getTime())) {
        // Reject a format that silently rolled over (e.g. day 31 in a 30-day
        // month, or "13" read as a month) rather than accepting a wrong date.
        const y = parsed.getFullYear()
        const m = String(parsed.getMonth() + 1).padStart(2, "0")
        const d = String(parsed.getDate()).padStart(2, "0")
        if (y < 1900 || y > 2200) continue
        return `${y}-${m}-${d}`
      }
    } catch {
      // try next
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Build transactions
// ---------------------------------------------------------------------------

export interface BuildResult {
  rows: NewTransactionInput[]
  errors: { row: number; reason: string }[]
}

/**
 * Convert mapped CSV rows into NewTransactionInput objects.
 */
export function buildTransactions(
  rows: Record<string, string>[],
  mapping: ImportColumnMapping,
  accountId: string,
  currency: string,
): BuildResult {
  const results: NewTransactionInput[] = []
  const errors: { row: number; reason: string }[] = []

  // Resolve the date format from the whole column before parsing any row: a
  // single "07/09/2026" is ambiguous, but the column as a whole usually is not.
  const dateColumn = mapping.date ? rows.map((r) => r[mapping.date!] ?? "") : []
  const detectedFormat = mapping.dateFormat ?? detectDateFormat(dateColumn)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed, +1 for header

    // Date
    const rawDate = mapping.date ? (row[mapping.date] ?? "") : ""
    const date = parseDate(rawDate, detectedFormat)
    if (!date) {
      errors.push({ row: rowNum, reason: `Row ${rowNum}: Cannot parse date "${rawDate}"` })
      continue
    }

    // Amount
    let amount: number | undefined
    const decimalSep = mapping.decimalSeparator

    if (mapping.amount && row[mapping.amount]) {
      amount = parseMoney(row[mapping.amount], decimalSep ? { decimalSeparator: decimalSep } : {})
    } else if (mapping.debit || mapping.credit) {
      const debitRaw = mapping.debit ? (row[mapping.debit] ?? "") : ""
      const creditRaw = mapping.credit ? (row[mapping.credit] ?? "") : ""
      const debit = debitRaw.trim() ? parseMoney(debitRaw, decimalSep ? { decimalSeparator: decimalSep } : {}) : undefined
      const credit = creditRaw.trim() ? parseMoney(creditRaw, decimalSep ? { decimalSeparator: decimalSep } : {}) : undefined

      if (credit != null && credit > 0) {
        amount = credit
      } else if (debit != null && debit !== 0) {
        amount = debit > 0 ? -debit : debit
      }
    }

    if (amount == null || !Number.isFinite(amount)) {
      errors.push({ row: rowNum, reason: `Row ${rowNum}: Cannot parse amount` })
      continue
    }

    if (mapping.invertAmount) {
      amount = -amount
    }

    const payee = (mapping.payee ? (row[mapping.payee] ?? "") : "").trim() || "Unknown"
    const memo = mapping.memo ? (row[mapping.memo] ?? "").trim() || undefined : undefined
    const categoryHint = mapping.category ? (row[mapping.category] ?? "").trim() || undefined : undefined

    const externalId = transactionHash(date, amount, payee)

    const txn: NewTransactionInput = {
      date,
      amount,
      accountId,
      payee,
      memo,
      currency,
      status: "cleared",
      externalId,
      tags: categoryHint ? [categoryHint] : [],
    }

    results.push(txn)
  }

  return { rows: results, errors }
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

export interface DedupeResult {
  unique: NewTransactionInput[]
  duplicates: NewTransactionInput[]
}

/**
 * Separate new rows from rows whose externalId is already known.
 */
export function dedupe(rows: NewTransactionInput[], knownExternalIds: Set<string>): DedupeResult {
  const unique: NewTransactionInput[] = []
  const duplicates: NewTransactionInput[] = []

  for (const row of rows) {
    if (row.externalId && knownExternalIds.has(row.externalId)) {
      duplicates.push(row)
    } else {
      unique.push(row)
    }
  }

  return { unique, duplicates }
}
