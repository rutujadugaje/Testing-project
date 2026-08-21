/**
 * 3-step CSV import wizard:
 * 1. Upload — drag-and-drop + account select
 * 2. Map — column mapping with live preview
 * 3. Confirm — counts + progress + success toast
 */
import { useCallback, useRef, useState } from "react"
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import type { ImportColumnMapping } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { parseCsvFile } from "@/lib/csv/parse"
import { guessMapping, buildTransactions, dedupe, detectDateFormat } from "@/lib/csv/mapping"
import { useFormatters } from "@/hooks/useAppSettings"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Step = 1 | 2 | 3

interface ParsedData {
  headers: string[]
  rows: Record<string, string>[]
  filename: string
  delimiter: string
}

interface ImportCsvDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MAPPING_FIELD_LABELS: { key: keyof ImportColumnMapping; label: string }[] = [
  { key: "date", label: "Date column" },
  { key: "amount", label: "Amount column (signed)" },
  { key: "debit", label: "Debit column" },
  { key: "credit", label: "Credit column" },
  { key: "payee", label: "Payee / Description" },
  { key: "memo", label: "Memo / Notes" },
  { key: "category", label: "Category (optional)" },
]

const DATE_FORMAT_OPTIONS = [
  { value: "dd/MM/yyyy", label: "DD/MM/YYYY (French)" },
  { value: "yyyy-MM-dd", label: "YYYY-MM-DD (ISO)" },
  { value: "MM/dd/yyyy", label: "MM/DD/YYYY (US)" },
  { value: "dd.MM.yyyy", label: "DD.MM.YYYY (German)" },
]

export function ImportCsvDialog({ open, onOpenChange }: ImportCsvDialogProps) {
  const accounts = useFinanceStore((s) => s.accounts)
  const settings = useFinanceStore((s) => s.settings)
  const addTransactions = useFinanceStore((s) => s.addTransactions)
  const recordImportBatch = useFinanceStore((s) => s.recordImportBatch)
  const knownExternalIds = useFinanceStore((s) => s.knownExternalIds)
  const runRules = useFinanceStore((s) => s.runRules)
  const fmt = useFormatters()

  const [step, setStep] = useState<Step>(1)
  const [parsed, setParsed] = useState<ParsedData | null>(null)
  const [mapping, setMapping] = useState<ImportColumnMapping>({})
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "")
  const [isParsing, setIsParsing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [importResult, setImportResult] = useState<{
    imported: number
    duplicates: number
    errors: number
    autoCategorized: number
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setIsParsing(true)
    try {
      const result = await parseCsvFile(file)
      const guessed = guessMapping(result.headers)
      setMapping(guessed)
      setParsed({ headers: result.headers, rows: result.rows, filename: file.name, delimiter: result.delimiter })
      setStep(2)
    } catch (err) {
      toast.error("Failed to parse CSV: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setIsParsing(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith(".csv")) handleFile(file)
  }, [handleFile])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const updateMapping = (key: keyof ImportColumnMapping, value: string | boolean) => {
    setMapping((m) => ({ ...m, [key]: value }))
  }

  // Which day/month order the file appears to use, so an ambiguous column
  // (10/07/2026) is not silently read the wrong way round.
  const detectedDateFormat =
    parsed && mapping.date
      ? detectDateFormat(parsed.rows.map((r) => r[mapping.date!] ?? ""))
      : undefined

  // Build preview for step 2
  const previewData = parsed ? (() => {
    const { rows: built } = buildTransactions(
      parsed.rows.slice(0, 5),
      mapping,
      accountId,
      settings.currency,
    )
    return built
  })() : []

  const handleImport = async () => {
    if (!parsed || !accountId) return
    setStep(3)
    setProgress(10)

    const { rows: built, errors } = buildTransactions(
      parsed.rows,
      mapping,
      accountId,
      settings.currency,
    )

    setProgress(40)

    const knownIds = knownExternalIds()
    const { unique, duplicates } = dedupe(built, knownIds)

    setProgress(60)

    // Import
    const newIds = addTransactions(unique)

    setProgress(75)

    // Record batch
    recordImportBatch({
      filename: parsed.filename,
      rowCount: parsed.rows.length,
      importedCount: unique.length,
      duplicateCount: duplicates.length,
      importedAt: new Date().toISOString(),
      accountId,
      mapping,
    })

    setProgress(90)

    // Auto-categorize via rules
    const autoCategorized = runRules({ transactionIds: newIds })

    setProgress(100)

    setImportResult({
      imported: unique.length,
      duplicates: duplicates.length,
      errors: errors.length,
      autoCategorized,
    })

    toast.success(
      `Imported ${unique.length} transactions, ${duplicates.length} duplicates skipped, ${autoCategorized} auto-categorized`
    )
  }

  const handleClose = () => {
    setStep(1)
    setParsed(null)
    setMapping({})
    setProgress(0)
    setImportResult(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
          <DialogDescription>
            {step === 1 && "Upload a bank export CSV file"}
            {step === 2 && "Map the columns to transaction fields"}
            {step === 3 && (importResult ? "Import complete" : "Importing transactions…")}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-medium",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : step > s
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {s}
              </span>
              <span className={cn(step === s ? "text-foreground font-medium" : "text-muted-foreground")}>
                {s === 1 ? "Upload" : s === 2 ? "Map" : "Confirm"}
              </span>
              {s < 3 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            {/* Target account */}
            <div className="flex items-center gap-3">
              <Label className="font-medium w-24 shrink-0" htmlFor="csv-account">Target account</Label>
              <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-col items-center justify-center gap-3 rounded-none border-2 border-dashed border-border p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {isParsing ? (
                <Spinner className="size-6" />
              ) : (
                <>
                  <Upload className="size-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Drop a CSV file here</p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Supports comma, semicolon, and tab-delimited files</p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileInput}
            />

            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={isParsing}
            >
              {isParsing ? <Spinner /> : <Upload className="size-4" />}
              Choose file
            </Button>
          </div>
        )}

        {/* Step 2: Map */}
        {step === 2 && parsed && (
          <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto">
            {/* File info */}
            <Attachment state="done">
              <AttachmentMedia>
                <FileText className="size-4" />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{parsed.filename}</AttachmentTitle>
                <AttachmentDescription>
                  {parsed.rows.length} rows, delimiter: {parsed.delimiter === "\t" ? "tab" : `"${parsed.delimiter}"`}
                </AttachmentDescription>
              </AttachmentContent>
            </Attachment>

            {/* Column mapping */}
            <div className="grid grid-cols-2 gap-2">
              {MAPPING_FIELD_LABELS.map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1">
                  <Label className="font-medium" htmlFor={`csv-map-${key}`}>{label}</Label>
                  <Select
                    value={(mapping[key] as string | undefined) ?? ""}
                    onValueChange={(v) => updateMapping(key, v || "")}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue placeholder="— not mapped —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— not mapped —</SelectItem>
                      {parsed.headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Options row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label className="font-medium" htmlFor="csv-date-format">Date format</Label>
                <Select
                  value={mapping.dateFormat ?? ""}
                  onValueChange={(v) => updateMapping("dateFormat", v ?? "")}
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="Auto-detect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Auto-detect</SelectItem>
                    {DATE_FORMAT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Day-first vs month-first is genuinely ambiguous for dates like
                    10/07 — say which way we read it so a wrong guess is visible
                    before the rows land in the ledger. */}
                {!mapping.dateFormat && detectedDateFormat ? (
                  <p className="text-[11px] text-muted-foreground">
                    Detected <span className="font-medium">{detectedDateFormat}</span> from this file
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <Label className="font-medium" htmlFor="csv-decimal-sep">Decimal separator</Label>
                <Select
                  value={mapping.decimalSeparator ?? ""}
                  onValueChange={(v) => updateMapping("decimalSeparator", (v as "," | "." | "") || "")}
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="Auto-detect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Auto-detect</SelectItem>
                    <SelectItem value=",">Comma (1 234,56)</SelectItem>
                    <SelectItem value=".">Period (1,234.56)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={mapping.invertAmount ?? false}
                onCheckedChange={(v) => updateMapping("invertAmount", v)}
                size="sm"
              />
              Invert amounts (bank reports expenses as positive)
            </Label>

            {/* Live preview */}
            {previewData.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">Preview (first {previewData.length} rows)</p>
                <div className="overflow-x-auto border rounded-none">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Payee</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((txn, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{txn.date}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{txn.payee}</TableCell>
                          <TableCell className={cn(
                            "text-xs text-right tabular-nums",
                            txn.amount < 0 ? "text-destructive" : "text-foreground"
                          )}>
                            {fmt.money(txn.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Confirm / Progress */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            {importResult ? (
              <>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CheckCircle2 className="size-5 text-green-600" />
                  Import complete
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-none border p-3">
                    <p className="text-lg font-semibold">{importResult.imported}</p>
                    <p className="text-xs text-muted-foreground">Rows imported</p>
                  </div>
                  <div className="rounded-none border p-3">
                    <p className="text-lg font-semibold">{importResult.duplicates}</p>
                    <p className="text-xs text-muted-foreground">Duplicates skipped</p>
                  </div>
                  <div className="rounded-none border p-3">
                    <p className="text-lg font-semibold">{importResult.autoCategorized}</p>
                    <p className="text-xs text-muted-foreground">Auto-categorized</p>
                  </div>
                  <div className="rounded-none border p-3">
                    <p className="text-lg font-semibold">{importResult.errors}</p>
                    <p className="text-xs text-muted-foreground">Parse errors</p>
                  </div>
                </div>
                {importResult.errors > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Some rows had errors</AlertTitle>
                    <AlertDescription>
                      {importResult.errors} row{importResult.errors !== 1 ? "s" : ""} could not be parsed and were skipped.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Spinner />
                  Importing transactions…
                </div>
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">{progress}% complete</p>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleImport} disabled={!mapping.date || (!mapping.amount && !mapping.debit && !mapping.credit) || !accountId}>
                Import {parsed?.rows.length ?? 0} rows
              </Button>
            </>
          )}
          {step === 3 && importResult && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Local cn utility (needed since we can't import from utils in a component file easily)
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ")
}
