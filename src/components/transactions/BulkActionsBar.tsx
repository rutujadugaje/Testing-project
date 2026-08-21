/**
 * Bulk actions bar — appears when rows are selected in the transactions table.
 */
import { useState } from "react"
import { Tag, CheckCircle2, Download, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import type { Transaction } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"
import { transactionsToCsv, downloadCsv } from "@/lib/csv/export"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface BulkActionsBarProps {
  selectedTransactions: Transaction[]
}

export function BulkActionsBar({ selectedTransactions }: BulkActionsBarProps) {
  const categories = useFinanceStore((s) => s.categories)
  const accounts = useFinanceStore((s) => s.accounts)
  const settings = useFinanceStore((s) => s.settings)
  const setCategoryForTransactions = useFinanceStore((s) => s.setCategoryForTransactions)
  const addTagToTransactions = useFinanceStore((s) => s.addTagToTransactions)
  const updateTransactions = useFinanceStore((s) => s.updateTransactions)
  const deleteTransactions = useFinanceStore((s) => s.deleteTransactions)
  const restoreTransactions = useFinanceStore((s) => s.restoreTransactions)
  const clearSelection = useUiStore((s) => s.clearSelection)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [tagInput, setTagInput] = useState("")

  const ids = selectedTransactions.map((t) => t.id)
  const count = selectedTransactions.length

  if (count === 0) return null

  const handleCategorize = (categoryId: string) => {
    setCategoryForTransactions(ids, categoryId)
    toast.success(`Categorized ${count} transaction${count !== 1 ? "s" : ""}`)
  }

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (!tag) return
    addTagToTransactions(ids, tag)
    setTagInput("")
    setTagOpen(false)
    toast.success(`Tag "${tag}" added to ${count} transaction${count !== 1 ? "s" : ""}`)
  }

  const handleMarkCleared = () => {
    updateTransactions(ids, { status: "cleared" })
    toast.success(`${count} transaction${count !== 1 ? "s" : ""} marked as cleared`)
  }

  const handleExport = () => {
    const csv = transactionsToCsv(selectedTransactions, categories, accounts, settings.locale)
    downloadCsv(`transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    toast.success(`Exported ${count} transaction${count !== 1 ? "s" : ""}`)
  }

  const handleDelete = () => {
    // Capture before delete for undo
    const deleted = [...selectedTransactions]
    deleteTransactions(ids)
    clearSelection()
    setDeleteOpen(false)
    toast(`Deleted ${count} transaction${count !== 1 ? "s" : ""}`, {
      action: {
        label: "Undo",
        onClick: () => {
          restoreTransactions(deleted)
          toast.success("Restored")
        },
      },
    })
  }

  return (
    <>
      <div className="flex items-center gap-2 rounded-none border bg-card px-3 py-2">
        {/* Count + clear */}
        <Badge variant="secondary" className="gap-1">
          {count} selected
        </Badge>
        <button
          onClick={clearSelection}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Clear selection"
        >
          <X className="size-3.5" />
        </button>

        <div className="flex-1" />

        {/* Grouped actions */}
        <ButtonGroup>
          {/* Categorize */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" variant="outline">Categorize</Button>} />
            <DropdownMenuContent className="max-h-64 overflow-y-auto">
              <DropdownMenuLabel>Set category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleCategorize("")}>
                <span className="text-muted-foreground italic">Uncategorized</span>
              </DropdownMenuItem>
              {categories.map((cat) => (
                <DropdownMenuItem key={cat.id} onClick={() => handleCategorize(cat.id)}>
                  {cat.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add tag */}
          <Popover open={tagOpen} onOpenChange={setTagOpen}>
            <PopoverTrigger render={<Button size="sm" variant="outline" aria-label="Add tag"><Tag className="size-3.5" />Tag</Button>} />
            <PopoverContent className="w-52 p-2">
              <p className="text-xs font-medium mb-2">Add tag to {count} transactions</p>
              <div className="flex gap-1">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Tag name…"
                  className="h-7 text-xs"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTag() }}
                />
                <Button size="sm" onClick={handleAddTag} className="h-7">Add</Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Mark cleared */}
          <Button size="sm" variant="outline" onClick={handleMarkCleared} aria-label="Mark cleared">
            <CheckCircle2 className="size-3.5" />
            Mark cleared
          </Button>

          {/* Export selected */}
          <Button size="sm" variant="outline" onClick={handleExport} aria-label="Export selected">
            <Download className="size-3.5" />
            Export
          </Button>

          <ButtonGroupSeparator />

          {/* Delete */}
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteOpen(true)}
            aria-label={`Delete ${count} selected transactions`}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </ButtonGroup>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} transaction{count !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action can be undone immediately after via the undo toast notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete {count}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
