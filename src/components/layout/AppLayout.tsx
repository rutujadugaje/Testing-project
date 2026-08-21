import { lazy, Suspense } from "react"
import { Outlet, useLocation } from "react-router-dom"

import { AppHeader } from "@/components/layout/AppHeader"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { CommandPalette } from "@/components/layout/CommandPalette"
// The agent pulls in the AI SDK, which is large and only needed once the user
// actually opens the panel — keep it out of the initial bundle.
const AgentPanel = lazy(() =>
  import("@/components/agent/AgentPanel").then((m) => ({ default: m.AgentPanel })),
)
import { PageSkeleton } from "@/components/shared/PageSkeleton"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Spinner } from "@/components/ui/spinner"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useThemeSync } from "@/hooks/useAppSettings"
import { useUiStore } from "@/stores/useUiStore"

function AgentPanelFallback() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
      <Spinner className="size-3.5" />
      Loading agent…
    </div>
  )
}

/**
 * Shell: sidebar + header + routed content, with the agent docked in a
 * resizable panel on desktop and a Drawer on mobile.
 */
function LayoutBody() {
  const location = useLocation()
  const { isMobile } = useSidebar()
  const agentPanelOpen = useUiStore((s) => s.agentPanelOpen)
  const agentDrawerOpen = useUiStore((s) => s.agentDrawerOpen)
  const setAgentDrawerOpen = useUiStore((s) => s.setAgentDrawerOpen)

  // The dedicated /agent route owns the whole viewport, so the docked panel
  // would be redundant there.
  const showDockedAgent = agentPanelOpen && !isMobile && location.pathname !== "/agent"

  const content = (
    <main className="min-w-0 flex-1 overflow-y-auto">
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </main>
  )

  return (
    <>
      <AppSidebar />
      <SidebarInset className="flex min-h-svh min-w-0 flex-col overflow-hidden">
        <AppHeader />
        {showDockedAgent ? (
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
            <ResizablePanel defaultSize="64%" minSize="38%" className="flex min-w-0 flex-col">
              {content}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize="36%"
              minSize="24%"
              maxSize="55%"
              className="flex min-w-0 flex-col border-l border-border bg-sidebar/40"
            >
              <Suspense fallback={<AgentPanelFallback />}>
                <AgentPanel variant="panel" />
              </Suspense>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">{content}</div>
        )}
      </SidebarInset>

      <Drawer open={agentDrawerOpen} onOpenChange={setAgentDrawerOpen}>
        <DrawerContent className="h-[85svh]">
          <DrawerHeader className="border-b border-border py-3">
            <DrawerTitle className="text-sm">Finance agent</DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <Suspense fallback={<AgentPanelFallback />}>
              <AgentPanel variant="drawer" />
            </Suspense>
          </div>
        </DrawerContent>
      </Drawer>

      <CommandPalette />
    </>
  )
}

export function AppLayout() {
  // Keeps the `dark` class in sync with settings, including OS changes.
  useThemeSync()

  return (
    <TooltipProvider delay={300}>
      <SidebarProvider>
        <LayoutBody />
      </SidebarProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </TooltipProvider>
  )
}
