import { Link, useLocation } from "react-router-dom"
import { Bot, PanelRightClose, PanelRightOpen, Search } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { findNavItem } from "@/lib/navigation"
import { useUiStore } from "@/stores/useUiStore"
import { PeriodSwitcher } from "@/components/layout/PeriodSwitcher"

export function AppHeader() {
  const location = useLocation()
  const { isMobile } = useSidebar()
  const active = findNavItem(location.pathname)

  const toggleCommand = useUiStore((s) => s.toggleCommand)
  const agentPanelOpen = useUiStore((s) => s.agentPanelOpen)
  const toggleAgentPanel = useUiStore((s) => s.toggleAgentPanel)
  const setAgentDrawerOpen = useUiStore((s) => s.setAgentDrawerOpen)

  const showPeriod =
    location.pathname === "/" ||
    location.pathname.startsWith("/reports") ||
    location.pathname.startsWith("/transactions")

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:h-16 lg:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />

      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <Link to="/" className="transition-colors hover:text-foreground">
              Finora
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{active?.title ?? "Not found"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <span className="text-sm font-medium sm:hidden">{active?.title ?? "Finora"}</span>

      <div className="ml-auto flex items-center gap-1.5">
        {showPeriod ? <PeriodSwitcher className="hidden md:flex" /> : null}

        <Menubar className="hidden h-8 border-none bg-transparent shadow-none lg:flex">
          <MenubarMenu>
            <MenubarTrigger className="text-xs font-normal text-muted-foreground">Data</MenubarTrigger>
            <MenubarContent>
              <MenubarItem render={<Link to="/transactions?import=1" />}>
                Import CSV…
                <MenubarShortcut>⌘I</MenubarShortcut>
              </MenubarItem>
              <MenubarItem render={<Link to="/transactions?export=1" />}>Export CSV</MenubarItem>
              <MenubarSeparator />
              <MenubarItem render={<Link to="/settings#data" />}>Backup & restore</MenubarItem>
              <MenubarItem render={<Link to="/rules" />}>Auto-categorization rules</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className="text-xs font-normal text-muted-foreground">Agent</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => useUiStore.getState().askAgent()}>
                Open agent panel
                <MenubarShortcut>⌘J</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  useUiStore.getState().askAgent("Give me a briefing on my finances this month.")
                }
              >
                Daily brief
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  useUiStore.getState().askAgent("Find my subscriptions and flag anything unusual.")
                }
              >
                Find subscriptions
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem render={<Link to="/agent" />}>Full agent workspace</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                onClick={toggleCommand}
                className="gap-2 text-muted-foreground"
                aria-label="Open command palette"
              >
                <Search className="size-3.5" />
                <span className="hidden lg:inline">Search…</span>
                <Kbd className="hidden lg:inline-flex">⌘K</Kbd>
              </Button>
            }
          />
          <TooltipContent>
            Search and run commands <Kbd>⌘K</Kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={agentPanelOpen ? "secondary" : "ghost"}
                size="icon"
                aria-label="Toggle agent panel"
                onClick={() => (isMobile ? setAgentDrawerOpen(true) : toggleAgentPanel())}
              >
                {isMobile ? (
                  <Bot className="size-4" />
                ) : agentPanelOpen ? (
                  <PanelRightClose className="size-4" />
                ) : (
                  <PanelRightOpen className="size-4" />
                )}
              </Button>
            }
          />
          <TooltipContent>
            {agentPanelOpen ? "Hide" : "Show"} finance agent <Kbd>⌘J</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
