import { useState, useEffect } from "react"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Field, FieldLabel, FieldDescription, FieldError, FieldGroup } from "@/components/ui/field"

import { useFinanceStore } from "@/stores/useFinanceStore"
import { toMajor, toMinor } from "@/lib/finance/money"
import { ACCOUNT_TYPE_LABELS, CHART_COLORS, colorForIndex } from "@/lib/icons"
import type { AccountType } from "@/types/finance"

interface AccountSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId?: string
}

const ACCOUNT_TYPES: AccountType[] = ["checking", "savings", "credit", "cash", "investment"]

export function AccountSheet({ open, onOpenChange, accountId }: AccountSheetProps) {
  const accounts = useFinanceStore((s) => s.accounts)
  const addAccount = useFinanceStore((s) => s.addAccount)
  const updateAccount = useFinanceStore((s) => s.updateAccount)

  const existing = accountId ? accounts.find((a) => a.id === accountId) : undefined
  const isEdit = !!existing

  const [name, setName] = useState("")
  const [institution, setInstitution] = useState("")
  const [reference, setReference] = useState("")
  const [type, setType] = useState<AccountType>("checking")
  const [currency, setCurrency] = useState("EUR")
  const [openingBalanceMajor, setOpeningBalanceMajor] = useState("0")
  const [color, setColor] = useState(colorForIndex(0))
  const [archived, setArchived] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      if (existing) {
        setName(existing.name)
        setInstitution(existing.institution ?? "")
        setReference(existing.reference ?? "")
        setType(existing.type)
        setCurrency(existing.currency)
        setOpeningBalanceMajor(String(toMajor(existing.openingBalance)))
        setColor(existing.color)
        setArchived(existing.archived)
      } else {
        setName("")
        setInstitution("")
        setReference("")
        setType("checking")
        setCurrency("EUR")
        setOpeningBalanceMajor("0")
        setColor(colorForIndex(accounts.length))
        setArchived(false)
      }
      setErrors({})
    }
  }, [open, existing, accounts.length])

  function validate() {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = "Name is required"
    const bal = parseFloat(openingBalanceMajor)
    if (isNaN(bal)) errs.openingBalance = "Must be a valid number"
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const openingBalance = toMinor(parseFloat(openingBalanceMajor))
    if (isEdit && accountId) {
      updateAccount(accountId, { name: name.trim(), institution: institution.trim() || undefined, reference: reference.trim() || undefined, type, currency, openingBalance, color, archived })
      toast.success("Account updated")
    } else {
      addAccount({ name: name.trim(), institution: institution.trim() || undefined, reference: reference.trim() || undefined, type, currency, openingBalance, color })
      toast.success("Account added")
    }
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit account" : "Add account"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Update the account details below." : "Fill in the details for your new account."}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 py-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="acc-name">Account name</FieldLabel>
              <Input
                id="acc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Checking"
              />
              {errors.name && <FieldError>{errors.name}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="acc-institution">Institution</FieldLabel>
              <Input
                id="acc-institution"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. BNP Paribas"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="acc-reference">Reference (last 4 digits / IBAN tail)</FieldLabel>
              <Input
                id="acc-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. ••4417"
              />
            </Field>

            <Field>
              <FieldLabel>Account type</FieldLabel>
              <Select value={type} onValueChange={(v) => v && setType(v as AccountType)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="acc-currency">Currency</FieldLabel>
              <Input
                id="acc-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="EUR"
                className="uppercase"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="acc-balance">Opening balance</FieldLabel>
              <FieldDescription>The account balance before any tracked transactions.</FieldDescription>
              <Input
                id="acc-balance"
                type="number"
                step="0.01"
                value={openingBalanceMajor}
                onChange={(e) => setOpeningBalanceMajor(e.target.value)}
                placeholder="0.00"
              />
              {errors.openingBalance && <FieldError>{errors.openingBalance}</FieldError>}
            </Field>

            {/* Color picker */}
            <Field>
              <FieldLabel>Color</FieldLabel>
              <div className="flex gap-2">
                {CHART_COLORS.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${i + 1}`}
                    className="size-6 rounded-full ring-offset-background transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    style={{ background: c, outline: color === c ? "2px solid currentColor" : undefined }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </Field>

            {isEdit && (
              <Field orientation="horizontal">
                <FieldLabel htmlFor="acc-archived">Archive account</FieldLabel>
                <Switch
                  id="acc-archived"
                  checked={archived}
                  onCheckedChange={setArchived}
                />
              </Field>
            )}
          </FieldGroup>
        </div>

        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
          <Button onClick={handleSave}>{isEdit ? "Save changes" : "Add account"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
