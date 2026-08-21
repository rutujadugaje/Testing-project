import { Link } from "react-router-dom"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { WandSparklesIcon } from "lucide-react"

const STACK = [
  { name: "Vite", description: "Build tool & dev server" },
  { name: "React 19", description: "UI framework" },
  { name: "TypeScript", description: "Type-safe JavaScript" },
  { name: "Tailwind v4", description: "Utility-first CSS" },
  { name: "shadcn/ui base-lyra", description: "Component library preset" },
  { name: "Vercel AI SDK 7", description: "AI agent runtime" },
  { name: "Zustand", description: "State management" },
  { name: "TanStack Table", description: "Headless table engine" },
  { name: "Recharts", description: "Chart library" },
]

const SHORTCUTS = [
  {
    keys: ["⌘", "K"],
    action: "Open command palette",
  },
  {
    keys: ["⌘", "J"],
    action: "Open AI agent panel",
  },
  {
    keys: ["⌘", "I"],
    action: "Import CSV",
  },
]

const FAQ = [
  {
    q: "Where is my data stored?",
    a: "All your data is stored in your browser's localStorage. Finora is local-first — nothing leaves your device except model API calls when you have an API key configured.",
  },
  {
    q: "Is my API key safe?",
    a: "The API key is stored in localStorage and only sent directly to the model provider you configured. However, a VITE_-prefixed key baked into the bundle is visible in client-side code. For production use, consider proxying model calls through a server route so the key never reaches the client.",
  },
  {
    q: "Can I use Finora offline?",
    a: "Yes. Finora is fully functional without an internet connection. The AI agent runs in offline simulation mode by default — no API key is required to explore all features.",
  },
  {
    q: "How does CSV deduplication work?",
    a: "When you import a CSV, Finora computes a stable hash from each row's date, amount, and payee. Rows whose hash already exists in your transaction store are flagged as duplicates and skipped. Re-importing the same file is always safe.",
  },
]

export function AboutSettings() {
  return (
    <div className="space-y-6">
      {/* App identity */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <WandSparklesIcon className="size-5 text-primary" />
          <h2 className="text-sm font-semibold">Finora</h2>
          <Badge variant="outline">v1.0</Badge>
        </div>
        <p className="text-xs/relaxed text-muted-foreground">
          An AI-first personal finance app. Local, private, and offline-capable.
          Your data, with an agent that actually works.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-fit mt-1"
          render={<Link to="/onboarding" />}
        >
          Re-run setup wizard
        </Button>
      </div>

      <Separator />

      {/* Keyboard shortcuts */}
      <div className="space-y-3">
        <p className="text-xs font-medium">Keyboard shortcuts</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shortcut</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SHORTCUTS.map(({ keys, action }) => (
              <TableRow key={action}>
                <TableCell>
                  <KbdGroup>
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </KbdGroup>
                </TableCell>
                <TableCell className="text-muted-foreground">{action}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Separator />

      {/* Stack */}
      <div className="space-y-3">
        <p className="text-xs font-medium">Built with</p>
        <div className="grid grid-cols-2 gap-1.5">
          {STACK.map((item) => (
            <div key={item.name} className="flex flex-col gap-0.5">
              <span className="text-xs font-medium">{item.name}</span>
              <span className="text-xs text-muted-foreground">{item.description}</span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* FAQ */}
      <div className="space-y-2">
        <p className="text-xs font-medium">FAQ</p>
        <Accordion>
          {FAQ.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>
                <p>{item.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}
