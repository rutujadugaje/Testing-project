import { Link, useLocation } from "react-router-dom"
import { Bot, ChevronsUpDown, Landmark, LogOut, Moon, Sun, UserCog } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { useFormatters, useThemeSync } from "@/hooks/useAppSettings"
import { accountBalances, totalNetWorth } from "@/lib/finance/calc"
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/navigation"
import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"

export function AppSidebar() {
  const location = useLocation()
  const formatters = useFormatters()
  const { theme, setTheme } = useThemeSync()

  const accounts = useFinanceStore((s) => s.accounts)
  const transactions = useFinanceStore((s) => s.transactions)
  const holdings = useFinanceStore((s) => s.holdings)
  const toggleCommand = useUiStore((s) => s.toggleCommand)

  const netWorth = totalNetWorth(accounts, transactions, holdings)
  const uncategorized = transactions.filter((t) => !t.categoryId && !t.isTransfer).length
  const balances = accountBalances(accounts, transactions)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Landmark className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">Finora</span>
                <span className="truncate text-xs text-muted-foreground">
                  {formatters.money(netWorth, { maximumFractionDigits: 0 })} net worth
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group.id)
          if (!items.length) return null
          return (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active =
                      item.url === "/"
                        ? location.pathname === "/"
                        : location.pathname.startsWith(item.url)
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={item.description}
                          render={<Link to={item.url} />}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                        {item.url === "/transactions" && uncategorized > 0 ? (
                          <SidebarMenuBadge>{uncategorized}</SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}

        <SidebarSeparator />

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Accounts</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accounts
                .filter((a) => !a.archived)
                .map((account) => {
                  const balance = balances.find((b) => b.accountId === account.id)?.balance ?? 0
                  return (
                    <SidebarMenuItem key={account.id}>
                      <SidebarMenuButton
                        tooltip={`${account.name} — ${formatters.money(balance)}`}
                        className="justify-between"
                        render={<Link to="/accounts" />}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: account.color }}
                          />
                          <span className="truncate">{account.name}</span>
                        </span>
                        <span
                          className={
                            balance < 0
                              ? "shrink-0 text-xs tabular-nums text-destructive"
                              : "shrink-0 text-xs tabular-nums text-muted-foreground"
                          }
                        >
                          {formatters.moneyCompact(balance)}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleCommand} tooltip="Command palette">
              <Bot />
              <span>Quick actions</span>
              <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">⌘K</Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton size="lg">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-accent text-xs">CM</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate font-medium">Camille Moreau</span>
                      <span className="truncate text-xs text-muted-foreground">Local workspace</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="flex items-center justify-between gap-2">
                  <span>Preferences</span>
                  <Badge variant="secondary" className="text-[10px]">
                    Local
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? <Sun /> : <Moon />}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/settings" />}>
                  <UserCog />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link to="/onboarding" />}>
                  <LogOut />
                  Re-run onboarding
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
