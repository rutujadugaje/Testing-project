/**
 * Transaction identity hashing.
 *
 * Lives in its own module because both the sample-data generator and the CSV
 * importer need it, and the store imports the sample data — routing this through
 * the store would create an import cycle (`sample -> store -> sample`), which
 * evaluates as `undefined` at runtime.
 */

/**
 * Stable dedupe key for a transaction.
 *
 * Sample data and CSV imports must produce the *same* id for the same row,
 * otherwise re-importing a statement that is already in the ledger silently
 * creates duplicates.
 */
export function transactionHash(date: string, amount: number, payee: string): string {
  const base = `${date}|${amount}|${payee.toUpperCase().replace(/\s+/g, " ").trim()}`
  let hash = 0
  for (let i = 0; i < base.length; i++) hash = (Math.imul(31, hash) + base.charCodeAt(i)) | 0
  return `txn-${(hash >>> 0).toString(36)}`
}
