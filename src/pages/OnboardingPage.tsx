import { useState, useMemo } from "react"
import { useNavigate, Link } from "react-router-dom"
import { toast } from "sonner"

import { useFinanceStore } from "@/stores/useFinanceStore"
import { PageShell } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

import { StepWelcome } from "@/components/onboarding/StepWelcome"
import { StepAccounts, type DraftAccount } from "@/components/onboarding/StepAccounts"
import { StepData, type DataChoice } from "@/components/onboarding/StepData"
import { StepFinish } from "@/components/onboarding/StepFinish"
import { TipsCarousel } from "@/components/onboarding/TipsCarousel"

import type { AppSettings } from "@/types/finance"
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, InfoIcon } from "lucide-react"

const STEPS = ["Welcome", "Accounts", "Data", "Finish"] as const
type StepName = (typeof STEPS)[number]

export default function OnboardingPage() {
  const navigate = useNavigate()

  // Store selectors
  const settings = useFinanceStore((s) => s.settings)
  const accounts = useFinanceStore((s) => s.accounts)
  const transactions = useFinanceStore((s) => s.transactions)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const addAccount = useFinanceStore((s) => s.addAccount)
  const loadSampleData = useFinanceStore((s) => s.loadSampleData)

  // Local wizard state
  const [step, setStep] = useState(0)
  const [localSettings, setLocalSettings] = useState<Partial<AppSettings>>({
    currency: settings.currency,
    locale: settings.locale,
    monthStartDay: settings.monthStartDay,
  })
  const [draftAccounts, setDraftAccounts] = useState<DraftAccount[]>([])
  const [dataChoice, setDataChoice] = useState<DataChoice | null>(null)

  const currentCurrency = localSettings.currency ?? settings.currency
  const currentLocale = localSettings.locale ?? settings.locale
  const currentMonthStartDay = localSettings.monthStartDay ?? settings.monthStartDay

  // Step validity
  const stepValid = useMemo(() => {
    if (step === 0) return true
    if (step === 1) return true // accounts are optional
    if (step === 2) return dataChoice !== null
    if (step === 3) return true
    return true
  }, [step, dataChoice])

  function handleSettingsChange(patch: Partial<AppSettings>) {
    setLocalSettings((prev) => ({ ...prev, ...patch }))
  }

  function handleSampleData() {
    loadSampleData()
    setDraftAccounts([])
    setDataChoice("sample")
  }

  async function handleFinish() {
    // Persist local settings
    updateSettings({
      currency: currentCurrency,
      locale: currentLocale,
      monthStartDay: currentMonthStartDay,
    })

    // Add draft accounts (only if not using sample data)
    if (dataChoice !== "sample") {
      for (const acc of draftAccounts) {
        addAccount({
          name: acc.name,
          type: acc.type,
          currency: currentCurrency,
          openingBalance: acc.openingBalance,
          color: acc.color,
        })
      }
    }

    updateSettings({ onboardingComplete: true })

    toast.success("Setup complete!", {
      description: "Welcome to Finora. Your workspace is ready.",
    })

    if (dataChoice === "import") {
      navigate("/transactions?import=1")
    } else {
      navigate("/")
    }
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      void handleFinish()
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1)
  }

  const progressValue = ((step + 1) / STEPS.length) * 100

  const stepName: StepName = STEPS[step]

  return (
    <PageShell>
      <div className="mx-auto max-w-xl space-y-6">
        {/* Already-done banner */}
        {settings.onboardingComplete && (
          <Alert>
            <InfoIcon />
            <AlertTitle>Setup already complete</AlertTitle>
            <AlertDescription>
              Your workspace is already configured.{" "}
              <Link to="/" className="underline underline-offset-3 hover:text-foreground">
                Go to the dashboard
              </Link>{" "}
              or continue below to re-run the wizard.
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              Step {step + 1} of {STEPS.length} — {stepName}
            </span>
            <span className="text-xs text-muted-foreground">
              {Math.round(progressValue)}%
            </span>
          </div>

          {/* Step rail */}
          <div className="flex gap-1.5">
            {STEPS.map((name, idx) => (
              <div
                key={name}
                className="relative flex-1"
              >
                <div
                  className={
                    "h-1 rounded-none transition-all " +
                    (idx <= step ? "bg-primary" : "bg-muted")
                  }
                />
                <span
                  className={
                    "mt-1 block text-center text-xs " +
                    (idx === step
                      ? "text-foreground font-medium"
                      : idx < step
                      ? "text-primary"
                      : "text-muted-foreground")
                  }
                >
                  {name}
                </span>
              </div>
            ))}
          </div>

          <Progress value={progressValue} className="sr-only" aria-label="Onboarding progress" />
        </div>

        <Separator />

        {/* Step content */}
        <div className="min-h-80">
          {step === 0 && (
            <StepWelcome
              currency={currentCurrency}
              locale={currentLocale}
              monthStartDay={currentMonthStartDay}
              onChange={handleSettingsChange}
            />
          )}
          {step === 1 && (
            <StepAccounts
              accounts={draftAccounts}
              onChange={setDraftAccounts}
              onLoadSample={handleSampleData}
            />
          )}
          {step === 2 && (
            <StepData
              choice={dataChoice}
              onChange={setDataChoice}
            />
          )}
          {step === 3 && (
            <StepFinish
              currency={currentCurrency}
              hasAccounts={accounts.length > 0 || draftAccounts.length > 0}
              hasTransactions={transactions.length > 0}
              hasApiKey={!!settings.aiApiKey}
            />
          )}
        </div>

        {/* Tips carousel */}
        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-3 font-medium">Tips</p>
          <TipsCarousel />
        </div>

        <Separator />

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            disabled={step === 0}
          >
            <ArrowLeftIcon />
            Back
          </Button>

          <Button
            size="sm"
            onClick={handleNext}
            disabled={!stepValid}
          >
            {step === STEPS.length - 1 ? (
              <>
                <CheckIcon />
                Finish setup
              </>
            ) : (
              <>
                Next
                <ArrowRightIcon />
              </>
            )}
          </Button>
        </div>
      </div>
    </PageShell>
  )
}
