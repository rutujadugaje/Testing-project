import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field"

import type { Account } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { toMinor } from "@/lib/finance/money"
import { toIsoDate } from "@/lib/finance/dates"

interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
}

export function TransferDialog({ open, onOpenChange, accounts }: TransferDialogProps) {
  const createTransfer = useFinanceStore((s) => s.createTransfer)

  const [fromId, setFromId] = useState("")
  const [toId, setToId] = useState("")
  const [amountMajor, setAmountMajor] = useState("")
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [memo, setMemo] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const errs: Record<string, string> = {}
    if (!fromId) errs.from = "Select a source account"
    if (!toId) errs.to = "Select a destination account"
    if (fromId && toId && fromId === toId) {
      errs.to = "Source and destination must be different"
    }
    const amt = parseFloat(amountMajor)
    if (!amountMajor || isNaN(amt) || amt <= 0) errs.amount = "Amount must be greater than 0"
    return errs
  }

  function handleSubmit() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const amount = toMinor(parseFloat(amountMajor))
    createTransfer({
      fromAccountId: fromId,
      toAccountId: toId,
      amount,
      date: date ? toIsoDate(date) : undefined,
      memo: memo.trim() || undefined,
    })
    toast.success("Transfer created")
    onOpenChange(false)
    // Reset
    setFromId("")
    setToId("")
    setAmountMajor("")
    setDate(new Date())
    setMemo("")
    setErrors({})
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Transfer between accounts</DialogTitle>
          <DialogDescription>Move money from one account to another.</DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>From account</FieldLabel>
            <Select value={fromId} onValueChange={(v) => v && setFromId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.from && <FieldError>{errors.from}</FieldError>}
          </Field>

          <Field>
            <FieldLabel>To account</FieldLabel>
            <Select value={toId} onValueChange={(v) => v && setToId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.to && <FieldError>{errors.to}</FieldError>}
          </Field>

          <Field>
            <FieldLabel>Amount</FieldLabel>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amountMajor}
              onChange={(e) => setAmountMajor(e.target.value)}
              placeholder="0.00"
            />
            {errors.amount && <FieldError>{errors.amount}</FieldError>}
          </Field>

          <Field>
            <FieldLabel>Date</FieldLabel>
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <CalendarIcon className="size-3.5 text-muted-foreground" />
                    {date ? date.toLocaleDateString() : "Pick a date"}
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d?: Date) => setDate(d)}
                />
              </PopoverContent>
            </Popover>
          </Field>

          <Field>
            <FieldLabel>Memo (optional)</FieldLabel>
            <Input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="e.g. Monthly savings transfer"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleSubmit}>Create transfer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
