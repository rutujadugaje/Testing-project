# Finora — implementation brief for feature agents

You are implementing one feature area of **Finora**, an AI-first personal finance app.
The foundation (types, store, finance math, sample data) is DONE and VERIFIED. Do not change it.

## Non-negotiable ground rules

1. **Never edit these files** (other agents depend on them):
   - `src/types/finance.ts`
   - `src/stores/useFinanceStore.ts`
   - `src/lib/finance/*`
   - `src/data/sample.ts`
   - `src/components/ui/**` (vendored shadcn — treat as read-only)
   Read them as much as you like. If you need a new store action, note it in your final report instead of adding it.
2. **Only create/edit files inside the directories your task assigns you.** Another agent is editing other directories at the same time.
3. **TypeScript is strict.** No `any` in app code. `noUnusedLocals` and `noUnusedParameters` are ON — remove unused imports/vars.
4. **`verbatimModuleSyntax` is ON** — type-only imports MUST be `import type { Foo } from "..."`.
5. **`erasableSyntaxOnly` is ON** — no parameter properties (`constructor(private x)`), no `enum`. Use `const` objects + union types.
6. Run `npx tsc -b` in `/agent/workspace/finora` before you finish. **Your area must contribute zero errors.**
7. Money is **integer minor units** (cents). €12.34 = `1234`. Expenses negative, income positive. Format via `formatMoney(minor, currency, locale)` from `@/lib/finance/money`. NEVER hand-roll currency strings.
8. Use the design tokens only: `bg-background text-foreground border-border bg-card text-muted-foreground bg-primary text-primary-foreground bg-accent bg-muted`, chart colors `var(--chart-1)`..`var(--chart-5)`, `var(--destructive)`. **No hard-coded hex colors, no `bg-blue-500`.** The preset is `base-lyra` / `mist`, font Instrument Sans.

## THE REGISTRY IS BASE UI, NOT RADIX — verified prop shapes

All 60 shadcn components are installed in `src/components/ui`. They are built on `@base-ui/react`, so props differ from Radix-era shadcn. These were verified by compiling them:

- `Select`: `onValueChange` receives **`string | null`**, not `string`. Same for `Combobox`.
  ```tsx
  <Select value={v} onValueChange={(val) => val && setV(val)}>
    <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
    <SelectContent><SelectItem value="a">A</SelectItem></SelectContent>
  </Select>
  ```
- `Combobox` requires an `items` prop, and `ComboboxList` takes a **render-function child**:
  ```tsx
  <Combobox items={options} value={v} onValueChange={(val) => val && setV(val)}>
    <ComboboxTrigger><ComboboxValue /></ComboboxTrigger>
    <ComboboxContent>
      <ComboboxInput />
      <ComboboxEmpty>No results</ComboboxEmpty>
      <ComboboxList>{(item: Opt) => <ComboboxItem key={item.value} value={item}>{item.label}</ComboboxItem>}</ComboboxList>
    </ComboboxContent>
  </Combobox>
  ```
- `ResizablePanelGroup` uses **`orientation="horizontal"`**, NOT `direction`.
- `Checkbox`/`Switch`: `checked` + `onCheckedChange(boolean)`. `Toggle`: `pressed` + `onPressedChange(boolean)`.
- `Slider`: `value={[min,max]}` + `onValueChange`.
- `Calendar` is react-day-picker v10: `mode="single" selected={Date} onSelect={(d?: Date) => void}`.
- `Chart` wraps **Recharts 3.8**: `<ChartContainer config={cfg}><AreaChart data={...}>...</AreaChart></ChartContainer>`, tooltips via `<ChartTooltip content={<ChartTooltipContent />} />`.
- Toasts: import `{ toast }` from **`sonner`**; the `<Toaster />` is already mounted in the app shell. (`ui/toast.tsx` is a separate Base UI system — don't mix.)
- Chat primitives that exist: `Message`/`MessageContent`/`MessageAvatar`/`MessageGroup`/`MessageHeader`/`MessageFooter`, `Bubble`/`BubbleContent`/`BubbleGroup`, `Marker`/`MarkerIcon`/`MarkerContent`, `MessageScroller`/`MessageScrollerViewport`/`MessageScrollerContent`/`MessageScrollerItem`/`MessageScrollerButton`, `Attachment*`, `Empty*`, `Item*`, `InputGroup*`, `Field*`, `ButtonGroup*`, `Kbd`, `Spinner`.
- Icons: `lucide-react` v1.

**Before using any component you have not used before, open its file in `src/components/ui/` and read the actual props.** Do not guess.

## Available foundation API

```ts
// @/types/finance — Account, Category, Transaction, Budget, Goal, Holding, Rule,
// ImportBatch, ImportColumnMapping, AppSettings, TransactionQuery, Anomaly,
// DetectedSubscription, BudgetProgress, CashflowPoint, CategoryBreakdownItem,
// CashflowSummary, AgentRuntimeContext, GoalStatus, TransactionStatus, ...

// @/lib/finance/money
toMinor, toMajor, formatMoney, formatMoneyCompact, formatPercent, parseMoney, splitAmount, roundMinor

// @/lib/finance/dates
toIsoDate, fromIsoDate, todayIso, toIsoMonth, monthLabel, formatDisplayDate, formatShortDate,
resolvePeriod(preset, ref?, monthStartDay?), resolveBudgetMonth, monthRange, isWithinRange,
rangeDays, previousRange, recentMonths, pickGranularity, bucketRange, bucketLabel
type PeriodPreset = "week"|"month"|"quarter"|"ytd"|"last30"|"last90"|"all"
type DateRange = { from: IsoDate; to: IsoDate }

// @/lib/finance/calc  (all pure)
queryTransactions(txns, query), sortTransactions, accountBalances, totalNetWorth, balanceSeries,
cashflowSeries(txns, range, granularity?, locale?), summarize(txns, cats, range),
categoryBreakdown(txns, cats, "expense"|"income"), payeeBreakdown(txns, limit?),
budgetProgress(budgets, txns, cats, month, monthStartDay?), budgetHealthScore, suggestBudgetLimit,
goalProjection(goal, ref?), ruleMatches, applyRules, normalizePayee,
detectSubscriptions(txns, { minOccurrences?, excludeCategoryIds? }),
detectAnomalies(txns, { spikeMultiplier?, largeAmount? }),
suggestCategoriesHeuristic(targets, history, categories), proposeRulesFromHistory(txns, cats, rules)

// @/stores/useFinanceStore — useFinanceStore(selector)
// state: accounts, categories, transactions, budgets, goals, holdings, rules, importBatches, settings, revision
// actions: addTransaction, addTransactions, updateTransaction, updateTransactions, deleteTransactions,
//   restoreTransactions, setCategoryForTransactions, addTagToTransactions, removeTagFromTransactions,
//   splitTransaction, createTransfer, setAiSuggestions, acceptAiSuggestions, rejectAiSuggestions,
//   clearAiSuggestions, addAccount, updateAccount, deleteAccount, addCategory, updateCategory,
//   deleteCategory, upsertBudget, deleteBudget, copyBudgets, addGoal, updateGoal, deleteGoal,
//   contributeToGoal, addHolding, updateHolding, deleteHolding, addRule, updateRule, deleteRule,
//   toggleRule, runRules, recordImportBatch, knownExternalIds, updateSettings, resetData,
//   loadSampleData, exportBackup, importBackup
// also exported: newId(prefix), transactionHash(date, amount, payee), defaultSettings, STORAGE_KEY
```

### Zustand usage rule (IMPORTANT — avoids infinite render loops)
Select primitives or stable references. **Never build a new array/object inside a selector**
(`useFinanceStore((s) => s.transactions.filter(...))` re-renders forever). Instead:
```tsx
const transactions = useFinanceStore((s) => s.transactions)      // stable ref
const filtered = useMemo(() => queryTransactions(transactions, q), [transactions, q])
```
For actions, select each one individually: `const addGoal = useFinanceStore((s) => s.addGoal)`.

## Quality bar
- Dense, readable fintech UI. Real empty states (`Empty`) and `Skeleton` loading — never a blank div.
- Every icon-only button gets a `Tooltip` and an `aria-label`.
- Destructive actions go through `AlertDialog`. Bulk mutations show an undo `toast` where feasible.
- Format all money and dates through the helpers with `settings.currency` / `settings.locale`.
- Prefer composing the shadcn kit over hand-rolled markup — this app is also a showcase of the registry.

## Existing app shell (already built — read, don't rewrite)

- `src/App.tsx` — routes. All page components are default exports in `src/pages/*.tsx`. Placeholder pages exist; replace only the ones your task names.
- `src/components/layout/` — AppLayout, AppSidebar, AppHeader, PeriodSwitcher, CommandPalette. **Do not edit** unless your task says so.
- `src/components/shared/PageHeader.tsx` — exports `PageHeader({ title, description, actions, children })` and `PageShell({ children })`. **Use these on every page** for consistent padding/rhythm.
- `src/components/shared/PageSkeleton.tsx` — `PageSkeleton`, `TableSkeleton`.
- `src/hooks/useAppSettings.ts` — **`useFormatters()`** returns `{ money(minor, opts?), moneyCompact, percent(ratio, digits?), date(iso), shortDate(iso), number, currency, locale }`. Use this instead of importing formatters directly. Also `useThemeSync()`, `useDensity()`.
- `src/stores/useUiStore.ts` — `useUiStore(selector)` with `commandOpen`, `agentPanelOpen`, `agentDrawerOpen`, `selectedTransactionIds`, `period`, `customRange`, `pendingAgentPrompt`, and actions `setSelectedTransactionIds`, `clearSelection`, `setPeriod`, `setCustomRange`, `askAgent(prompt?)`, `consumePendingPrompt()`, `toggleAgentPanel`, `setAgentDrawerOpen`, `setCommandOpen`, `toggleCommand`. Also `useActiveRange(monthStartDay)` → `DateRange` for the header's selected period.
  **`askAgent("some question")` is how any page hands a question to the agent** — use it for "Explain this" / "Ask the agent" buttons.
- `src/lib/navigation.ts` — `NAV_ITEMS`, `NAV_GROUPS`, `findNavItem`.
- `src/lib/icons.ts` — `categoryIcon(name)`, `accountIcon(type)`, `ACCOUNT_TYPE_LABELS`, `CHART_COLORS`, `colorForIndex(i)`.
- `src/lib/utils.ts` — `cn(...)`.
- Toaster is mounted globally. `TooltipProvider` wraps the app — just use `<Tooltip>` directly.

### Base UI note: `render` prop instead of `asChild`
This registry uses Base UI, which composes via a **`render`** prop, NOT Radix's `asChild`:
```tsx
// Trigger rendering a router Link:
<Button render={<Link to="/goals" />}>Go to goals</Button>
<DropdownMenuItem render={<Link to="/settings" />}>Settings</DropdownMenuItem>
<TooltipTrigger render={<Button size="icon" aria-label="Edit"><Pencil /></Button>} />
<DialogTrigger render={<Button>Open</Button>} />
```
`<X asChild>` will NOT compile. Verified working examples are in `src/components/layout/AppSidebar.tsx` and `AppHeader.tsx` — copy those patterns.

## Verification (required before you report done)

```bash
cd /agent/workspace/finora
npx tsc -b                 # must add zero errors from your files
node scripts/smoke.mjs --only /your-route   # renders route, fails on console errors
```
A dev server is already running on port 5180 (`pnpm dev` if it died). `scripts/smoke.mjs` screenshots to `shots/`; read the PNG to check your work looks right. Also run `node scripts/smoke.mjs` with no args occasionally to make sure you did not break other routes.
