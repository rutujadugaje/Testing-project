import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns"

import type { IsoDate, IsoMonth } from "@/types/finance"

export const ISO_DATE = "yyyy-MM-dd"

export function toIsoDate(date: Date): IsoDate {
  return format(date, ISO_DATE)
}

export function fromIsoDate(date: IsoDate): Date {
  return parseISO(date)
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date())
}

export function toIsoMonth(date: Date | IsoDate): IsoMonth {
  const d = typeof date === "string" ? fromIsoDate(date) : date
  return format(d, "yyyy-MM")
}

export function monthLabel(month: IsoMonth, locale = "fr-FR"): string {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" })
}

export function formatDisplayDate(date: IsoDate, locale = "fr-FR"): string {
  return fromIsoDate(date).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function formatShortDate(date: IsoDate, locale = "fr-FR"): string {
  return fromIsoDate(date).toLocaleDateString(locale, { day: "2-digit", month: "short" })
}

export type PeriodPreset = "week" | "month" | "quarter" | "ytd" | "last30" | "last90" | "all"

export interface DateRange {
  from: IsoDate
  to: IsoDate
}

/**
 * Resolve a named period into concrete bounds.
 * `monthStartDay` shifts the month window for salary-aligned budgeting: with
 * day 25, "month" runs 25 Jan -> 24 Feb.
 */
export function resolvePeriod(
  preset: PeriodPreset,
  reference: Date = new Date(),
  monthStartDay = 1,
): DateRange {
  switch (preset) {
    case "week":
      return {
        from: toIsoDate(startOfWeek(reference, { weekStartsOn: 1 })),
        to: toIsoDate(endOfWeek(reference, { weekStartsOn: 1 })),
      }
    case "month":
      return resolveBudgetMonth(reference, monthStartDay)
    case "quarter":
      return { from: toIsoDate(startOfQuarter(reference)), to: toIsoDate(endOfQuarter(reference)) }
    case "ytd":
      return { from: toIsoDate(new Date(reference.getFullYear(), 0, 1)), to: toIsoDate(reference) }
    case "last30":
      return { from: toIsoDate(subDays(reference, 29)), to: toIsoDate(reference) }
    case "last90":
      return { from: toIsoDate(subDays(reference, 89)), to: toIsoDate(reference) }
    case "all":
      return { from: "1970-01-01", to: "2999-12-31" }
  }
}

/** The budget month containing `reference`, honouring a custom start day. */
export function resolveBudgetMonth(reference: Date, monthStartDay = 1): DateRange {
  if (monthStartDay <= 1) {
    return { from: toIsoDate(startOfMonth(reference)), to: toIsoDate(endOfMonth(reference)) }
  }
  const day = reference.getDate()
  const start =
    day >= monthStartDay
      ? new Date(reference.getFullYear(), reference.getMonth(), monthStartDay)
      : new Date(reference.getFullYear(), reference.getMonth() - 1, monthStartDay)
  return { from: toIsoDate(start), to: toIsoDate(subDays(addMonths(start, 1), 1)) }
}

/** Bounds of a `YYYY-MM` budget month. */
export function monthRange(month: IsoMonth, monthStartDay = 1): DateRange {
  const [y, m] = month.split("-").map(Number)
  const anchor = new Date(y, m - 1, Math.min(monthStartDay, 28))
  if (monthStartDay <= 1) {
    return { from: toIsoDate(startOfMonth(anchor)), to: toIsoDate(endOfMonth(anchor)) }
  }
  return { from: toIsoDate(anchor), to: toIsoDate(subDays(addMonths(anchor, 1), 1)) }
}

export function isWithinRange(date: IsoDate, range: DateRange): boolean {
  return date >= range.from && date <= range.to
}

export function rangeDays(range: DateRange): number {
  return differenceInCalendarDays(fromIsoDate(range.to), fromIsoDate(range.from)) + 1
}

/** Same-length window immediately before `range`, for period-over-period deltas. */
export function previousRange(range: DateRange): DateRange {
  const days = rangeDays(range)
  const prevTo = subDays(fromIsoDate(range.from), 1)
  return { from: toIsoDate(subDays(prevTo, days - 1)), to: toIsoDate(prevTo) }
}

/** Descending list of the last `count` months, newest first. */
export function recentMonths(count: number, reference: Date = new Date()): IsoMonth[] {
  return Array.from({ length: count }, (_, i) => toIsoMonth(subMonths(reference, i)))
}

export type Granularity = "day" | "week" | "month"

/** Pick a bucket size that yields a readable number of points for a range. */
export function pickGranularity(range: DateRange): Granularity {
  const days = rangeDays(range)
  if (days <= 31) return "day"
  if (days <= 120) return "week"
  return "month"
}

/** Contiguous buckets covering `range`, so charts show gaps as zero. */
export function bucketRange(range: DateRange, granularity: Granularity): DateRange[] {
  const buckets: DateRange[] = []
  const end = fromIsoDate(range.to)
  let cursor = fromIsoDate(range.from)
  let guard = 0

  while (cursor <= end && guard++ < 400) {
    let bucketEnd: Date
    if (granularity === "day") bucketEnd = cursor
    else if (granularity === "week") bucketEnd = endOfWeek(cursor, { weekStartsOn: 1 })
    else bucketEnd = endOfMonth(cursor)

    if (bucketEnd > end) bucketEnd = end
    buckets.push({ from: toIsoDate(cursor), to: toIsoDate(bucketEnd) })
    cursor = addDays(bucketEnd, 1)
  }
  return buckets
}

export function bucketLabel(bucket: DateRange, granularity: Granularity, locale = "fr-FR"): string {
  const d = fromIsoDate(bucket.from)
  if (granularity === "month") return d.toLocaleDateString(locale, { month: "short", year: "2-digit" })
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short" })
}
