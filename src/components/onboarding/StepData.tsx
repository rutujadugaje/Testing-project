import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  DatabaseIcon,
  UploadIcon,
  PlusCircleIcon,
} from "lucide-react"

export type DataChoice = "sample" | "import" | "empty"

interface Props {
  choice: DataChoice | null
  onChange: (choice: DataChoice) => void
}

const OPTIONS: {
  id: DataChoice
  icon: React.ElementType
  title: string
  description: string
  consequence: string
}[] = [
  {
    id: "sample",
    icon: DatabaseIcon,
    title: "Load sample data",
    description: "Start with a realistic French household dataset — accounts, transactions, budgets, and goals included.",
    consequence: "Replaces any accounts or transactions you added in step 2.",
  },
  {
    id: "import",
    icon: UploadIcon,
    title: "Import a CSV",
    description: "You already have bank exports ready. Takes you to the importer after setup.",
    consequence: "Opens the transaction import dialog on finish.",
  },
  {
    id: "empty",
    icon: PlusCircleIcon,
    title: "Start fresh",
    description: "Keep the accounts from step 2 and add transactions manually or import later.",
    consequence: "Nothing is pre-loaded — blank slate.",
  },
]

export function StepData({ choice, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">How would you like to start?</h2>
        <p className="text-xs/relaxed text-muted-foreground">
          Choose how to populate your data. You can always change this later.
        </p>
      </div>

      <div className="grid gap-3">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon
          const selected = choice === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className="text-left w-full"
            >
              <Card
                className={cn(
                  "cursor-pointer transition-all",
                  selected
                    ? "ring-2 ring-primary bg-primary/5"
                    : "hover:bg-muted/50",
                )}
                size="sm"
              >
                <CardHeader className="flex flex-row items-start gap-3">
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-none",
                      selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <CardTitle className="text-xs">{opt.title}</CardTitle>
                    <CardDescription>{opt.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground italic">{opt.consequence}</p>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>
    </div>
  )
}
