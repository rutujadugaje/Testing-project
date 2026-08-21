import { useState, useEffect, useMemo } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel, FieldDescription, FieldError, FieldGroup } from "@/components/ui/field"
import {
  Combobox,
  ComboboxTrigger,
  ComboboxValue,
  ComboboxContent,
  ComboboxInput,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox"

import type { RuleMatchKind } from "@/types/finance"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { ruleMatches } from "@/lib/finance/calc"
import { toMinor, toMajor } from "@/lib/finance/money"
interface RuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ruleId?: string
}

const MATCH_KIND_LABELS: Record<RuleMatchKind, string> = {
  payee_contains: "Payee contains",
  payee_regex: "Payee matches regex",
  memo_contains: "Memo contains",
  amount_range: "Amount range",
}

interface CategoryOption {
  value: string
  label: string
}

export function RuleDialog({ open, onOpenChange, ruleId }: RuleDialogProps) {
  const rules = useFinanceStore((s) => s.rules)
  const categories = useFinanceStore((s) => s.categories)
  const transactions = useFinanceStore((s) => s.transactions)
  const addRule = useFinanceStore((s) => s.addRule)
  const updateRule = useFinanceStore((s) => s.updateRule)

  const existing = ruleId ? rules.find((r) => r.id === ruleId) : undefined
  const isEdit = !!existing

  const [name, setName] = useState("")
  const [matchKind, setMatchKind] = useState<RuleMatchKind>("payee_contains")
  const [matchValue, setMatchValue] = useState("")
  const [matchMin, setMatchMin] = useState("")
  const [matchMax, setMatchMax] = useState("")
  const [setCategoryId, setSetCategoryId] = useState("")
  const [tagsInput, setTagsInput] = useState("")
  const [priority, setPriority] = useState("100")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const categoryOptions: CategoryOption[] = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  )

  useEffect(() => {
    if (open) {
      if (existing) {
        setName(existing.name)
        setMatchKind(existing.match.kind)
        setMatchValue(existing.match.value ?? "")
        setMatchMin(existing.match.min != null ? String(toMajor(existing.match.min)) : "")
        setMatchMax(existing.match.max != null ? String(toMajor(existing.match.max)) : "")
        setSetCategoryId(existing.setCategoryId ?? "")
        setTagsInput(existing.setTags.join(", "))
        setPriority(String(existing.priority))
      } else {
        setName("")
        setMatchKind("payee_contains")
        setMatchValue("")
        setMatchMin("")
        setMatchMax("")
        setSetCategoryId("")
        setTagsInput("")
        setPriority(String(100 + rules.length))
      }
      setErrors({})
    }
  }, [open, existing, rules.length])

  // Live match preview
  const previewResult = useMemo(() => {
    if (!matchValue && matchKind !== "amount_range") return null
    const testRule = {
      id: "__preview__",
      name: "preview",
      match: {
        kind: matchKind,
        value: matchValue || undefined,
        min: matchMin ? toMinor(parseFloat(matchMin)) : undefined,
        max: matchMax ? toMinor(parseFloat(matchMax)) : undefined,
      },
      setCategoryId: undefined,
      setTags: [],
      priority: 0,
      enabled: true,
      timesApplied: 0,
      createdAt: "",
    }
    try {
      if (matchKind === "payee_regex" && matchValue) {
        new RegExp(matchValue, "i") // validate
      }
      const matches = transactions.filter((t) => ruleMatches(testRule, t))
      return { count: matches.length, payees: [...new Set(matches.slice(0, 5).map((t) => t.payee))] }
    } catch {
      return { error: "Invalid regex pattern" }
    }
  }, [matchKind, matchValue, matchMin, matchMax, transactions])

  function validate() {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = "Name is required"
    if (matchKind !== "amount_range" && !matchValue.trim()) errs.value = "Match value is required"
    if (matchKind === "payee_regex" && matchValue) {
      try { new RegExp(matchValue, "i") } catch { errs.value = "Invalid regex pattern" }
    }
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const setTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)

    const rule = {
      name: name.trim(),
      match: {
        kind: matchKind,
        value: matchKind !== "amount_range" ? matchValue.trim() || undefined : undefined,
        min: matchMin ? toMinor(parseFloat(matchMin)) : undefined,
        max: matchMax ? toMinor(parseFloat(matchMax)) : undefined,
      },
      setCategoryId: setCategoryId || undefined,
      setTags,
      priority: parseInt(priority) || 100,
      enabled: true,
    }

    if (isEdit && ruleId) {
      updateRule(ruleId, rule)
      toast.success("Rule updated")
    } else {
      addRule(rule)
      toast.success("Rule created")
    }
    onOpenChange(false)
  }

  const selectedCat = setCategoryId ? categories.find((c) => c.id === setCategoryId) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit rule" : "New rule"}</DialogTitle>
          <DialogDescription>
            Rules automatically categorize and tag matching transactions.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Rule name</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grocery stores"
            />
            {errors.name && <FieldError>{errors.name}</FieldError>}
          </Field>

          <Field>
            <FieldLabel>Match type</FieldLabel>
            <Select value={matchKind} onValueChange={(v) => v && setMatchKind(v as RuleMatchKind)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MATCH_KIND_LABELS) as RuleMatchKind[]).map((k) => (
                  <SelectItem key={k} value={k}>{MATCH_KIND_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {matchKind === "amount_range" ? (
            <div className="grid grid-cols-2 gap-2">
              <Field>
                <FieldLabel>Min amount</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  value={matchMin}
                  onChange={(e) => setMatchMin(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field>
                <FieldLabel>Max amount</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  value={matchMax}
                  onChange={(e) => setMatchMax(e.target.value)}
                  placeholder="999.99"
                />
              </Field>
            </div>
          ) : (
            <Field>
              <FieldLabel>Match value</FieldLabel>
              {matchKind === "payee_regex" && (
                <FieldDescription>Enter a JavaScript-compatible regular expression.</FieldDescription>
              )}
              <Input
                value={matchValue}
                onChange={(e) => setMatchValue(e.target.value)}
                placeholder={matchKind === "payee_regex" ? "e.g. CARREFOUR|LECLERC" : "e.g. CARREFOUR"}
                className={previewResult && "error" in previewResult ? "border-destructive" : ""}
              />
              {errors.value && <FieldError>{errors.value}</FieldError>}
              {previewResult && "error" in previewResult && (
                <FieldError>{previewResult.error}</FieldError>
              )}
            </Field>
          )}

          {/* Live match preview */}
          {previewResult && !("error" in previewResult) && (
            <div className="rounded-none border border-border bg-muted/50 px-2.5 py-2 space-y-1">
              <p className="text-xs font-medium">
                Matches {previewResult.count} transaction{previewResult.count !== 1 ? "s" : ""}
              </p>
              {previewResult.payees.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {previewResult.payees.map((p) => (
                    <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                  ))}
                  {previewResult.count > 5 && (
                    <span className="text-xs text-muted-foreground">+{previewResult.count - 5} more</span>
                  )}
                </div>
              )}
            </div>
          )}

          <Field>
            <FieldLabel>Set category</FieldLabel>
            <Combobox
              items={categoryOptions}
              value={categoryOptions.find((o) => o.value === setCategoryId) ?? null}
              onValueChange={(val) => {
                if (val) setSetCategoryId(val.value)
              }}
            >
              <ComboboxTrigger className="flex h-8 w-full items-center justify-between gap-2 rounded-none border border-input bg-transparent px-2.5 text-xs">
                {selectedCat ? (
                  <span>{selectedCat.name}</span>
                ) : (
                  <ComboboxValue placeholder="No category change" />
                )}
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput placeholder="Search categories..." />
                <ComboboxEmpty>No categories found</ComboboxEmpty>
                <ComboboxList>
                  {(item: CategoryOption) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>

          <Field>
            <FieldLabel>Add tags (comma-separated)</FieldLabel>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. groceries, food"
            />
          </Field>

          <Field>
            <FieldLabel>Priority</FieldLabel>
            <FieldDescription>Lower number = higher priority. Rules run from lowest to highest.</FieldDescription>
            <Input
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              placeholder="100"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleSave}>{isEdit ? "Save changes" : "Create rule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
