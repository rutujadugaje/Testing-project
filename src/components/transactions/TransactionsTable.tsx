/**
 * The main transactions sheet — TanStack Table v8 + shadcn Table primitives.
 *
 * Modes:
 *  - Pagination (≤300 rows): shadcn Pagination, 50 rows/page.
 *  - Virtualization (>300 rows): @tanstack/react-virtual inside a ScrollArea.
 */
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
  type RowSelectionState,
  getPaginationRowModel,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Columns3,
  Pencil,
  Tag,
  Trash2,
  MoreHorizontal,
  SplitSquareVertical,
  BotMessageSquare,
} from "lucide-react"
import { toast } from "sonner"

import type { Transaction, Category, TransactionStatus } from "@/types/finance"
import type { TransactionPatch } from "@/stores/useFinanceStore"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"
import { useFormatters } from "@/hooks/useAppSettings"
import { categoryIcon } from "@/lib/icons"
import { toMinor, toMajor } from "@/lib/finance/money"
import { cn } from "@/lib/utils"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { TableSkeleton } from "@/components/shared/PageSkeleton"

const PAGE_SIZE = 50
const VIRTUALIZE_THRESHOLD = 300

// ---------------------------------------------------------------------------
// Inline cell editors
// ---------------------------------------------------------------------------

function AmountCell({
  transaction,
  onCommit,
}: {
  transaction: Transaction
  onCommit: (patch: TransactionPatch) => void
}) {
  const fmt = useFormatters()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setValue(String(toMajor(transaction.amount)))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commit = () => {
    const num = parseFloat(value.replace(",", "."))
    if (!isNaN(num)) {
      onCommit({ amount: toMinor(num) })
    }
    setEditing(false)
  }

  const cancel = () => setEditing(false)

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") cancel()
        }}
        onBlur={commit}
        className="h-6 w-24 py-0 text-right tabular-nums"
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      className={cn(
        "w-full text-right tabular-nums text-xs font-medium hover:underline focus:outline-none",
        transaction.amount < 0 ? "text-destructive" : "text-foreground",
      )}
    >
      {fmt.money(transaction.amount)}
    </button>
  )
}

function PayeeCell({
  transaction,
  onCommit,
}: {
  transaction: Transaction
  onCommit: (patch: TransactionPatch) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setValue(transaction.payee)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commit = () => {
    if (value.trim()) onCommit({ payee: value.trim() })
    setEditing(false)
  }

  const cancel = () => setEditing(false)

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") cancel()
        }}
        onBlur={commit}
        className="h-6 w-full py-0"
      />
    )
  }

  return (
    <div className="flex flex-col min-w-0">
      <button
        onClick={startEdit}
        className="max-w-[180px] truncate text-left text-xs font-medium hover:underline focus:outline-none"
        title={transaction.payee}
      >
        {transaction.payee}
      </button>
      {transaction.memo && (
        <Tooltip>
          <TooltipTrigger render={<span className="max-w-[180px] truncate text-[10px] text-muted-foreground cursor-default" />}>
            {transaction.memo}
          </TooltipTrigger>
          <TooltipContent>{transaction.memo}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

function CategoryCell({
  transaction,
  categories,
  onCommit,
}: {
  transaction: Transaction
  categories: Category[]
  onCommit: (patch: TransactionPatch) => void
}) {
  const [open, setOpen] = useState(false)
  const category = categories.find((c) => c.id === transaction.categoryId)
  const suggested = categories.find((c) => c.id === transaction.aiSuggestedCategoryId)
  const Icon = categoryIcon(category?.icon ?? suggested?.icon)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            className="flex items-center gap-1.5 text-xs hover:underline focus:outline-none w-full"
            title={category?.name ?? suggested?.name ?? "Uncategorized"}
          />
        }
      >
        {category || suggested ? (
          <>
            <Icon className="size-3 shrink-0 text-muted-foreground" />
            <span className={cn("max-w-[120px] truncate", !category && "text-muted-foreground italic")}>
              {category?.name ?? suggested?.name}
            </span>
            {!category && suggested && (
              <Badge variant="outline" className="ml-1 h-3.5 text-[9px]">AI</Badge>
            )}
          </>
        ) : (
          <span className="text-muted-foreground italic">—</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1">
        <div className="text-xs font-medium text-muted-foreground px-2 py-1">Category</div>
        <div className="max-h-48 overflow-y-auto">
          <button
            className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded-none"
            onClick={() => { onCommit({ categoryId: undefined }); setOpen(false) }}
          >
            <span className="text-muted-foreground italic">Uncategorized</span>
          </button>
          {categories.map((cat) => {
            const CatIcon = categoryIcon(cat.icon)
            return (
              <button
                key={cat.id}
                className="flex w-full items-center gap-2 text-left px-2 py-1.5 text-xs hover:bg-accent rounded-none"
                onClick={() => { onCommit({ categoryId: cat.id }); setOpen(false) }}
              >
                <CatIcon className="size-3 shrink-0" />
                {cat.name}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function DateCell({
  transaction,
  onCommit,
}: {
  transaction: Transaction
  onCommit: (patch: TransactionPatch) => void
}) {
  const fmt = useFormatters()
  const [open, setOpen] = useState(false)

  const selectedDate = useMemo(() => {
    const [y, m, d] = transaction.date.split("-").map(Number)
    return new Date(y, m - 1, d)
  }, [transaction.date])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button className="text-xs hover:underline focus:outline-none text-left" />}>
        {fmt.shortDate(transaction.date)}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d?: Date) => {
            if (d) {
              const y = d.getFullYear()
              const m = String(d.getMonth() + 1).padStart(2, "0")
              const day = String(d.getDate()).padStart(2, "0")
              onCommit({ date: `${y}-${m}-${day}` })
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function TagsCell({
  transaction,
  onCommit,
}: {
  transaction: Transaction
  onCommit: (patch: TransactionPatch) => void
}) {
  const [open, setOpen] = useState(false)
  const [newTag, setNewTag] = useState("")

  const addTag = () => {
    const t = newTag.trim()
    if (t && !transaction.tags.includes(t)) {
      onCommit({ tags: [...transaction.tags, t] })
    }
    setNewTag("")
  }

  const removeTag = (tag: string) => {
    onCommit({ tags: transaction.tags.filter((t) => t !== tag) })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button className="flex flex-wrap gap-1 text-xs hover:opacity-80 focus:outline-none max-w-[120px]" />}>
        {transaction.tags.length === 0 ? (
          <span className="text-muted-foreground italic text-[10px]">—</span>
        ) : (
          transaction.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="h-4 text-[9px]">{tag}</Badge>
          ))
        )}
        {transaction.tags.length > 2 && (
          <Badge variant="outline" className="h-4 text-[9px]">+{transaction.tags.length - 2}</Badge>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2">
        <p className="text-xs font-medium mb-2">Tags</p>
        <div className="flex flex-wrap gap-1 mb-2">
          {transaction.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="h-5 text-[10px] gap-1">
              {tag}
              <button onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">&times;</button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-1">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add tag…"
            className="h-6 text-[10px]"
            onKeyDown={(e) => { if (e.key === "Enter") addTag() }}
          />
          <Button size="sm" variant="outline" onClick={addTag} className="h-6 px-2 text-[10px]">Add</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  // cleared = positive/done (green kept: no semantic success token)
  // pending = warning state (amber kept: no semantic warning token)
  // uncleared = neutral info (muted)
  if (status === "cleared") return <CheckCircle2 className="size-3.5 text-green-600" />
  if (status === "pending") return <Clock className="size-3.5 text-amber-500" />
  return <Circle className="size-3.5 text-muted-foreground" />
}

// ---------------------------------------------------------------------------
// Row context menu
// ---------------------------------------------------------------------------

// Row context menu — returns ONLY the context menu content, trigger is the row itself.
// Usage: wrap the <tr> in <ContextMenu> and put ContextMenuTrigger as the <tr>.
function RowContextMenuContent({
  transaction,
  categories,
}: {
  transaction: Transaction
  categories: Category[]
}) {
  const updateTransaction = useFinanceStore((s) => s.updateTransaction)
  const deleteTransactions = useFinanceStore((s) => s.deleteTransactions)
  const restoreTransactions = useFinanceStore((s) => s.restoreTransactions)
  const addTransactions = useFinanceStore((s) => s.addTransactions)

  const handleDelete = () => {
    const deleted = [{ ...transaction }] as Transaction[]
    deleteTransactions([transaction.id])
    toast("Transaction deleted", {
      action: {
        label: "Undo",
        onClick: () => restoreTransactions(deleted),
      },
    })
  }

  const handleDuplicate = () => {
    addTransactions([{
      date: transaction.date,
      amount: transaction.amount,
      accountId: transaction.accountId,
      payee: transaction.payee,
      categoryId: transaction.categoryId,
      memo: transaction.memo,
      tags: [...transaction.tags],
      status: transaction.status,
      currency: transaction.currency,
    }])
    toast.success("Transaction duplicated")
  }

  return (
    <ContextMenuContent>
      <ContextMenuSub>
        <ContextMenuSubTrigger>Categorize as…</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => updateTransaction(transaction.id, { categoryId: undefined })}>
            <span className="text-muted-foreground italic">Uncategorized</span>
          </ContextMenuItem>
          {categories.map((cat) => {
            const Icon = categoryIcon(cat.icon)
            return (
              <ContextMenuItem
                key={cat.id}
                onClick={() => updateTransaction(transaction.id, { categoryId: cat.id })}
              >
                <Icon className="size-3.5" />
                {cat.name}
              </ContextMenuItem>
            )
          })}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => updateTransaction(transaction.id, { status: "cleared" })}>
        <CheckCircle2 className="size-3.5" /> Mark cleared
      </ContextMenuItem>
      <ContextMenuItem onClick={() => updateTransaction(transaction.id, { status: "pending" })}>
        <Clock className="size-3.5" /> Mark pending
      </ContextMenuItem>
      <ContextMenuItem onClick={() => updateTransaction(transaction.id, { status: "reconciled" })}>
        <Circle className="size-3.5" /> Mark reconciled
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={handleDuplicate}>
        <Copy className="size-3.5" /> Duplicate
      </ContextMenuItem>
      <ContextMenuItem onClick={() => {}} disabled>
        <SplitSquareVertical className="size-3.5" /> Split…
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onClick={handleDelete}>
        <Trash2 className="size-3.5" /> Delete
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

// ---------------------------------------------------------------------------
// Column sort header
// ---------------------------------------------------------------------------

function SortHeader({ label, column }: { label: string; column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void } }) {
  const sorted = column.getIsSorted()
  return (
    <button
      className="flex items-center gap-1 text-left font-medium hover:text-foreground text-xs"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main table component
// ---------------------------------------------------------------------------

interface TransactionsTableProps {
  transactions: Transaction[]
  isLoading?: boolean
  onImport?: () => void
}

export function TransactionsTable({ transactions, isLoading, onImport }: TransactionsTableProps) {
  const categories = useFinanceStore((s) => s.categories)
  const accounts = useFinanceStore((s) => s.accounts)
  const updateTransaction = useFinanceStore((s) => s.updateTransaction)
  const setSelectedIds = useUiStore((s) => s.setSelectedTransactionIds)
  const askAgent = useUiStore((s) => s.askAgent)

  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE })

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const useVirtualization = transactions.length > VIRTUALIZE_THRESHOLD

  const columns = useMemo<ColumnDef<Transaction>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(!!checked)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
    },
    {
      id: "date",
      accessorKey: "date",
      header: ({ column }) => <SortHeader label="Date" column={column} />,
      cell: ({ row }) => (
        <DateCell
          transaction={row.original}
          onCommit={(patch) => updateTransaction(row.original.id, patch)}
        />
      ),
    },
    {
      id: "payee",
      accessorKey: "payee",
      header: ({ column }) => <SortHeader label="Payee" column={column} />,
      cell: ({ row }) => (
        <PayeeCell
          transaction={row.original}
          onCommit={(patch) => updateTransaction(row.original.id, patch)}
        />
      ),
    },
    {
      id: "category",
      accessorKey: "categoryId",
      header: ({ column }) => <SortHeader label="Category" column={column} />,
      cell: ({ row }) => (
        <CategoryCell
          transaction={row.original}
          categories={categories}
          onCommit={(patch) => updateTransaction(row.original.id, patch)}
        />
      ),
    },
    {
      id: "account",
      accessorKey: "accountId",
      header: "Account",
      cell: ({ row }) => {
        const acct = accountMap.get(row.original.accountId)
        if (!acct) return null
        return (
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ background: acct.color }}
            />
            <span className="max-w-[100px] truncate text-xs">{acct.name}</span>
          </div>
        )
      },
    },
    {
      id: "tags",
      accessorKey: "tags",
      header: "Tags",
      cell: ({ row }) => (
        <TagsCell
          transaction={row.original}
          onCommit={(patch) => updateTransaction(row.original.id, patch)}
        />
      ),
      enableSorting: false,
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger render={<span className="flex items-center" />}>
            <StatusBadge status={row.original.status} />
          </TooltipTrigger>
          <TooltipContent className="capitalize">{row.original.status}</TooltipContent>
        </Tooltip>
      ),
    },
    {
      id: "amount",
      accessorKey: "amount",
      header: ({ column }) => (
        <div className="text-right">
          <SortHeader label="Amount" column={column} />
        </div>
      ),
      cell: ({ row }) => (
        <AmountCell
          transaction={row.original}
          onCommit={(patch) => updateTransaction(row.original.id, patch)}
        />
      ),
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover/row:opacity-100 focus:opacity-100"
                aria-label="Row actions"
              />
            }
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => updateTransaction(row.original.id, { status: "cleared" })}>
              <CheckCircle2 className="size-3.5" /> Mark cleared
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateTransaction(row.original.id, { status: "pending" })}>
              <Clock className="size-3.5" /> Mark pending
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                const deleted = [{ ...row.original }] as Transaction[]
                useFinanceStore.getState().deleteTransactions([row.original.id])
                const restore = useFinanceStore.getState().restoreTransactions
                toast("Transaction deleted", {
                  action: { label: "Undo", onClick: () => restore(deleted) },
                })
              }}
            >
              <Trash2 className="size-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
    },
  ], [categories, accountMap, updateTransaction])

  const table = useReactTable({
    data: transactions,
    columns,
    state: {
      sorting,
      rowSelection,
      columnVisibility,
      pagination: useVirtualization ? { pageIndex: 0, pageSize: transactions.length } : pagination,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: useVirtualization ? undefined : setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: useVirtualization ? undefined : getPaginationRowModel(),
    manualPagination: useVirtualization,
    enableRowSelection: true,
  })

  // Sync selection to UI store
  useEffect(() => {
    const ids = table.getSelectedRowModel().rows.map((r) => r.original.id)
    setSelectedIds(ids)
  }, [rowSelection, table, setSelectedIds])

  // Keyboard navigation
  const tableRef = useRef<HTMLTableElement>(null)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const rows = tableRef.current?.querySelectorAll("tbody tr")
      if (!rows?.length) return
      const active = document.activeElement
      const currentIdx = Array.from(rows).findIndex((r) => r === active || r.contains(active))
      const nextIdx = e.key === "ArrowDown" ? currentIdx + 1 : currentIdx - 1
      if (nextIdx >= 0 && nextIdx < rows.length) {
        (rows[nextIdx] as HTMLElement).focus()
      }
    }
  }

  // Virtualization setup
  const parentRef = useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  })

  if (isLoading) return <TableSkeleton />

  if (transactions.length === 0) {
    return (
      <Empty className="border min-h-[300px]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BotMessageSquare className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No transactions found</EmptyTitle>
          <EmptyDescription>
            Try adjusting your filters or import a CSV file.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            {onImport && (
              <Button size="sm" variant="outline" onClick={onImport}>
                Import CSV
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => askAgent("Explain my transaction history")}
            >
              Ask the agent
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    )
  }

  const pageCount = Math.ceil(transactions.length / pagination.pageSize)

  return (
    <div className="flex flex-col gap-3">
      {/* Column visibility */}
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
            <Columns3 className="size-3.5" />
            Columns
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table.getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                >
                  {col.id.charAt(0).toUpperCase() + col.id.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {useVirtualization ? (
        // Virtualized mode
        <div>
          <div ref={parentRef} className="h-[600px] overflow-auto border rounded-none">
            <table className="w-full caption-bottom text-xs" ref={tableRef} onKeyDown={handleKeyDown}>
              <TableHeader className="sticky top-0 z-10 bg-background">
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id} className="bg-background">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <tbody style={{ height: virtualizer.getTotalSize() + "px", position: "relative" }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index]
                  return (
                    <ContextMenu key={row.id}>
                      <ContextMenuTrigger
                        render={
                          <tr
                            data-state={row.getIsSelected() ? "selected" : undefined}
                            tabIndex={0}
                            className={cn(
                              "group/row border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted absolute w-full",
                            )}
                            style={{ top: virtualRow.start + "px" }}
                          />
                        }
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </ContextMenuTrigger>
                      <RowContextMenuContent transaction={row.original} categories={categories} />
                    </ContextMenu>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Showing all {transactions.length} transactions — virtualized mode (list exceeds {VIRTUALIZE_THRESHOLD} rows)
          </p>
        </div>
      ) : (
        // Paginated mode
        <div>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <ContextMenu key={row.id}>
                  <ContextMenuTrigger
                    render={
                      <tr
                        data-state={row.getIsSelected() ? "selected" : undefined}
                        tabIndex={0}
                        className="group/row border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                        onKeyDown={(e) => {
                          if (e.key === " ") {
                            e.preventDefault()
                            row.toggleSelected()
                          }
                        }}
                      />
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </ContextMenuTrigger>
                  <RowContextMenuContent transaction={row.original} categories={categories} />
                </ContextMenu>
              ))}
            </TableBody>
          </Table>

          {/* Page size picker + pagination */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rows per page</span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(v) => v && setPagination((p) => ({ ...p, pageSize: parseInt(v), pageIndex: 0 }))}
              >
                <SelectTrigger size="sm" className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                {table.getRowModel().rows.length} of {transactions.length}
              </span>
            </div>

            {pageCount > 1 && (
              <Pagination className="justify-end w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPagination((p) => ({ ...p, pageIndex: Math.max(0, p.pageIndex - 1) }))}
                      aria-disabled={pagination.pageIndex === 0}
                      className={pagination.pageIndex === 0 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, pageCount) }).map((_, i) => {
                    const page = i
                    const isActive = page === pagination.pageIndex
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          isActive={isActive}
                          onClick={() => setPagination((p) => ({ ...p, pageIndex: page }))}
                        >
                          {page + 1}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  })}
                  {pageCount > 5 && <PaginationItem><PaginationEllipsis /></PaginationItem>}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPagination((p) => ({ ...p, pageIndex: Math.min(pageCount - 1, p.pageIndex + 1) }))}
                      aria-disabled={pagination.pageIndex >= pageCount - 1}
                      className={pagination.pageIndex >= pageCount - 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            Page {pagination.pageIndex + 1} of {pageCount} — paginated mode
          </p>
        </div>
      )}

      {/* AI seam */}
      <div data-slot="ai-grid-toolbar" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog (used by BulkActionsBar)
// ---------------------------------------------------------------------------

export function DeleteConfirmDialog({
  open,
  count,
  onConfirm,
  onCancel,
}: {
  open: boolean
  count: number
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {count} transaction{count !== 1 ? "s" : ""}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action can be undone immediately after via the undo toast.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Re-export Pencil for use in the toolbar
export { Pencil, Tag }
