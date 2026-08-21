import { useState } from "react"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSet, FieldLegend } from "@/components/ui/field"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EyeIcon, EyeOffIcon, BotIcon, WifiOffIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

export function AiSettings() {
  const settings = useFinanceStore((s) => s.settings)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const [showKey, setShowKey] = useState(false)

  const isLive = !!settings.aiApiKey

  function handleClearKey() {
    updateSettings({ aiApiKey: "" })
    toast.success("API key cleared", {
      description: "The agent will now run in offline simulation mode.",
    })
  }

  return (
    <div className="space-y-6">
      {/* Status indicator */}
      <Alert>
        {isLive ? <BotIcon /> : <WifiOffIcon />}
        <AlertTitle className="flex items-center gap-2">
          {isLive ? "Live mode" : "Offline simulation mode"}
          <Badge variant={isLive ? "default" : "outline"}>
            {isLive ? "Live" : "Offline"}
          </Badge>
        </AlertTitle>
        <AlertDescription>
          {isLive
            ? "API key is set. The agent sends model calls to the configured base URL."
            : "No API key is set. The agent runs a built-in simulation — no network calls, no cost. You can explore all features offline."}
        </AlertDescription>
      </Alert>

      {/* Security note */}
      <Alert variant="destructive">
        <AlertTitle>Security notice</AlertTitle>
        <AlertDescription>
          A <code>VITE_</code>-prefixed key is embedded in the client bundle and visible
          to anyone who opens DevTools. For production use, proxy model calls through a
          server route that reads the key from an environment variable.
        </AlertDescription>
      </Alert>

      {/* AI configuration */}
      <FieldSet>
        <FieldLegend>Model configuration</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel>API Key</FieldLabel>
            <InputGroup>
              <InputGroupInput
                type={showKey ? "text" : "password"}
                value={settings.aiApiKey}
                onChange={(e) => updateSettings({ aiApiKey: e.target.value })}
                placeholder="sk-…"
                autoComplete="off"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              Your OpenAI, OpenRouter, Groq, or compatible key. Leave empty for offline mode.
            </FieldDescription>
          </Field>

          {settings.aiApiKey && (
            <div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearKey}
                className="w-fit"
              >
                <Trash2Icon />
                Clear key
              </Button>
            </div>
          )}

          <Field>
            <FieldLabel>Base URL</FieldLabel>
            <Input
              value={settings.aiBaseUrl}
              onChange={(e) => updateSettings({ aiBaseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
            <FieldDescription>
              Examples: OpenAI <code>https://api.openai.com/v1</code> · OpenRouter{" "}
              <code>https://openrouter.ai/api/v1</code> · Groq{" "}
              <code>https://api.groq.com/openai/v1</code> · Ollama{" "}
              <code>http://localhost:11434/v1</code>
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Model ID</FieldLabel>
            <Input
              value={settings.aiModel}
              onChange={(e) => updateSettings({ aiModel: e.target.value })}
              placeholder="gpt-4o-mini"
            />
            <FieldDescription>
              The model identifier passed to the API. e.g. <code>gpt-4o-mini</code>,{" "}
              <code>llama3</code>, <code>mixtral-8x7b</code>.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  )
}
