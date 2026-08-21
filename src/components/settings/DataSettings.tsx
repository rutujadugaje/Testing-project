import { useState, useRef, useMemo } from "react"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useFormatters } from "@/hooks/useAppSettings"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSet, FieldLegend } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { Kbd } from "@/components/ui/kbd"
import {
  DownloadIcon,
  UploadIcon,
  DatabaseIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

const RESET_CODE = "DELETE"

export function DataSettings() {
  const accounts = useFinanceStore((s) => s.accounts)
  const transactions = useFinanceStore((s) => s.transactions)
  const budgets = useFinanceStore((s) => s.budgets)
  const goals = useFinanceStore((s) => s.goals)
  const rules = useFinanceStore((s) => s.rules)
  const importBatches = useFinanceStore((s) => s.importBatches)
  const exportBackup = useFinanceStore((s) => s.exportBackup)
  const importBackup = useFinanceStore((s) => s.importBackup)
  const loadSampleData = useFinanceStore((s) => s.loadSampleData)
  const resetData = useFinanceStore((s) => s.resetData)

  const { date: fmtDate } = useFormatters()

  const [resetConfirm, setResetConfirm] = useState("")
  const [resetOpen, setResetOpen] = useState(false)

  const [sampleOpen, setSampleOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const stats = useMemo(
    () => [
      { label: "Accounts", count: accounts.length },
      { label: "Transactions", count: transactions.length },
      { label: "Budgets", count: budgets.length },
      { label: "Goals", count: goals.length },
      { label: "Rules", count: rules.length },
      { label: "Import batches", count: importBatches.length },
    ],
    [accounts, transactions, budgets, goals, rules, importBatches],
  )

  function handleExport() {
    const json = exportBackup()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const today = new Date().toISOString().slice(0, 10)
    const a = document.createElement("a")
    a.href = url
    a.download = `finora-backup-${today}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Backup downloaded", {
      description: `finora-backup-${today}.json`,
    })
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const result = importBackup(text)
      if (result.ok) {
        toast.success("Backup imported successfully")
      } else {
        toast.error("Import failed", { description: result.error })
      }
    }
    reader.readAsText(file)
    // Reset the input so the same file can be re-imported
    e.target.value = ""
  }

  function handleLoadSample() {
    loadSampleData()
    setSampleOpen(false)
    toast.success("Sample data loaded", {
      description: "The French household dataset has been applied.",
    })
  }

  function handleReset() {
    if (resetConfirm !== RESET_CODE) return
    resetData({ withSample: false })
    setResetOpen(false)
    setResetConfirm("")
    toast.success("Data reset complete", {
      description: "All financial data has been cleared. Settings are preserved.",
    })
  }

  return (
    <div className="space-y-6">
      {/* Stats block */}
      <FieldSet>
        <FieldLegend>Workspace statistics</FieldLegend>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-none border border-border bg-muted/30 px-3 py-2 space-y-0.5"
            >
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-sm font-semibold tabular-nums">{s.count}</p>
            </div>
          ))}
        </div>
      </FieldSet>

      <Separator />

      {/* Export */}
      <FieldSet>
        <FieldLegend>Backup &amp; restore</FieldLegend>
        <FieldGroup>
          <Field orientation="horizontal">
            <div className="space-y-1">
              <FieldLabel>Export backup</FieldLabel>
              <FieldDescription>
                Download a full JSON snapshot of all your data — accounts, transactions, budgets, goals, and rules.
              </FieldDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0">
              <DownloadIcon />
              Download backup
            </Button>
          </Field>

          <Field orientation="horizontal">
            <div className="space-y-1">
              <FieldLabel>Import backup</FieldLabel>
              <FieldDescription>
                Restore from a previously downloaded JSON backup. This replaces all current data.
              </FieldDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              className="shrink-0"
            >
              <UploadIcon />
              Choose file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={handleImportFile}
            />
          </Field>
        </FieldGroup>
      </FieldSet>

      <Separator />

      {/* Sample data */}
      <FieldSet>
        <FieldLegend>Sample data</FieldLegend>
        <FieldGroup>
          <Alert>
            <TriangleAlertIcon />
            <AlertTitle>Replaces all current data</AlertTitle>
            <AlertDescription>
              Loading sample data will overwrite your existing accounts, transactions, and budgets.
            </AlertDescription>
          </Alert>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSampleOpen(true)}
              className="w-fit"
            >
              <DatabaseIcon />
              Load sample French household
            </Button>
          </div>
        </FieldGroup>
      </FieldSet>

      <Separator />

      {/* Reset */}
      <FieldSet>
        <FieldLegend>Danger zone</FieldLegend>
        <FieldGroup>
          <Alert variant="destructive">
            <Trash2Icon />
            <AlertTitle>Reset all data</AlertTitle>
            <AlertDescription>
              Permanently removes all accounts, transactions, budgets, goals, rules, and import
              history. Your settings and API key are preserved.
            </AlertDescription>
          </Alert>
          <div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setResetOpen(true)}
              className="w-fit"
            >
              <Trash2Icon />
              Reset all data
            </Button>
          </div>
        </FieldGroup>
      </FieldSet>

      {/* Import batches table */}
      {importBatches.length > 0 && (
        <>
          <Separator />
          <FieldSet>
            <FieldLegend>Recent imports</FieldLegend>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Imported</TableHead>
                  <TableHead>Duplicates</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importBatches.slice(0, 10).map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.filename}</TableCell>
                    <TableCell>{batch.importedCount}</TableCell>
                    <TableCell>{batch.duplicateCount}</TableCell>
                    <TableCell>{fmtDate(batch.importedAt.slice(0, 10))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </FieldSet>
        </>
      )}

      {/* Sample data confirm dialog */}
      <AlertDialog open={sampleOpen} onOpenChange={setSampleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load sample data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all your current accounts, transactions, budgets, and goals
              with the French household sample dataset. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSampleOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleLoadSample}>
              Load sample data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset confirm dialog */}
      <AlertDialog open={resetOpen} onOpenChange={(o) => { setResetOpen(o); if (!o) setResetConfirm("") }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all data</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your financial data. Your settings and API key
              will be preserved. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Type <Kbd>{RESET_CODE}</Kbd> to confirm:
            </p>
            <InputOTP
              maxLength={6}
              pattern="[A-Z]*"
              value={resetConfirm}
              onChange={(v) => setResetConfirm(v.toUpperCase())}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setResetOpen(false); setResetConfirm("") }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={resetConfirm !== RESET_CODE}
              onClick={handleReset}
            >
              Reset all data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
