/**
 * CSV parsing — wraps PapaParse with auto-delimiter detection.
 * Pure module: no React, no store.
 */
import Papa from "papaparse"

export interface ParseResult {
  headers: string[]
  rows: Record<string, string>[]
  delimiter: string
}

const SUPPORTED_DELIMITERS = [",", ";", "\t"] as const

/**
 * Parse a CSV file. Auto-detects delimiter by trying comma, semicolon, and tab;
 * picks the one that produces the most columns on the first data row.
 */
export async function parseCsvFile(file: File): Promise<ParseResult> {
  const text = await file.text()

  // Auto-detect delimiter: pick the one that gives the most columns in line 1
  const firstLine = text.split("\n")[0] ?? ""
  let bestDelimiter: string = ","
  let bestCount = 0
  for (const delim of SUPPORTED_DELIMITERS) {
    const count = firstLine.split(delim).length
    if (count > bestCount) {
      bestCount = count
      bestDelimiter = delim
    }
  }

  return new Promise<ParseResult>((resolve, reject) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      delimiter: bestDelimiter,
      complete: (result) => {
        const headers = result.meta.fields ?? []
        resolve({
          headers,
          rows: result.data as Record<string, string>[],
          delimiter: bestDelimiter,
        })
      },
      error: (err: Error) => {
        reject(new Error(err.message))
      },
    })
  })
}
