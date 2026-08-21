import { PageHeader, PageShell } from "@/components/shared/PageHeader"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { GeneralSettings } from "@/components/settings/GeneralSettings"
import { AiSettings } from "@/components/settings/AiSettings"
import { DataSettings } from "@/components/settings/DataSettings"
import { AboutSettings } from "@/components/settings/AboutSettings"

export default function SettingsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Settings"
        description="Configure Finora to match your workflow and financial setup."
      />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="pt-4">
          <GeneralSettings />
        </TabsContent>

        <TabsContent value="ai" className="pt-4">
          <AiSettings />
        </TabsContent>

        <TabsContent value="data" className="pt-4">
          <DataSettings />
        </TabsContent>

        <TabsContent value="about" className="pt-4">
          <AboutSettings />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
