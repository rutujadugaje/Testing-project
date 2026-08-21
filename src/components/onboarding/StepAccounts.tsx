import { useState } from "react"
import type { AccountType } from "@/types/finance"
import { ACCOUNT_TYPE_LABELS, CHART_COLORS, colorForIndex } from "@/lib/icons"
import { toMinor } from "@/lib/finance/money"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions, ItemGroup } from "@/components/ui/item"
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { PlusIcon, Trash2Icon, BanknoteIcon } from "lucide-react"
import { toast } from "sonner"

export interface DraftAccount {
  name: string
  type: AccountType
  openingBalance: number
  color: string
}

interface Props {
  accounts: DraftAccount[]
  onChange: (accounts: DraftAccount[]) => void
  onLoadSample: () => void
}

const ACCOUNT_TYPES: AccountType[] = ["checking", "savings", "credit", "cash", "investment"]

export function StepAccounts({ accounts, onChange, onLoadSample }: Props) {
  const [name, setName] = useState("")
  const [type, setType] = useState<AccountType>("checking")
  const [balanceStr, setBalanceStr] = useState("")

  const canAdd = name.trim().length > 0

  function handleAdd() {
    if (!canAdd) return
    const balance = parseFloat(balanceStr) || 0
    const draft: DraftAccount = {
      name: name.trim(),
      type,
      openingBalance: toMinor(balance),
      color: colorForIndex(accounts.length),
    }
    onChange([...accounts, draft])
    setName("")
    setBalanceStr("")
    setType("checking")
  }

  function handleRemove(idx: number) {
    onChange(accounts.filter((_, i) => i !== idx))
  }

  function handleSample() {
    onLoadSample()
    toast.success("Sample data loaded", {
      description: "The French household dataset has been applied.",
    })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">Your accounts</h2>
        <p className="text-xs/relaxed text-muted-foreground">
          Add the accounts you want to track. You can add more later from the Accounts page.
        </p>
      </div>

      {/* Add account form */}
      <FieldSet>
        <FieldLegend variant="label">Add an account</FieldLegend>
        <FieldGroup>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                placeholder="e.g. Main Checking"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </Field>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select
                value={type}
                onValueChange={(val) => val && setType(val as AccountType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACCOUNT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Opening balance</FieldLabel>
              <Input
                type="number"
                placeholder="0.00"
                value={balanceStr}
                onChange={(e) => setBalanceStr(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </Field>
          </div>
          <Button onClick={handleAdd} disabled={!canAdd} size="sm" className="w-fit">
            <PlusIcon />
            Add account
          </Button>
        </FieldGroup>
      </FieldSet>

      {/* Account list */}
      {accounts.length > 0 && (
        <>
          <Separator />
          <ItemGroup>
            {accounts.map((acc, idx) => (
              <Item key={idx} variant="outline" size="sm">
                <ItemMedia variant="icon">
                  <BanknoteIcon style={{ color: CHART_COLORS[idx % CHART_COLORS.length] }} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{acc.name}</ItemTitle>
                  <ItemDescription>
                    {ACCOUNT_TYPE_LABELS[acc.type]} · opening balance{" "}
                    {(acc.openingBalance / 100).toFixed(2)}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${acc.name}`}
                    onClick={() => handleRemove(idx)}
                  >
                    <Trash2Icon />
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </>
      )}

      {accounts.length === 0 && (
        <p className="text-xs text-muted-foreground">No accounts added yet.</p>
      )}

      {/* Sample data shortcut */}
      <div className="rounded-none border border-dashed border-border p-3 space-y-2">
        <p className="text-xs font-medium">Not sure where to start?</p>
        <p className="text-xs/relaxed text-muted-foreground">
          Load the sample French household dataset to explore Finora with realistic data.
          You can reset it at any time from Settings.
        </p>
        <Button variant="outline" size="sm" onClick={handleSample}>
          Use the sample French household
        </Button>
      </div>
    </div>
  )
}
