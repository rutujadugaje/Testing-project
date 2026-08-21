import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Consistent page title block: heading, supporting line, and right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="truncate text-xl font-semibold tracking-tight lg:text-2xl">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Standard page container so every route shares padding and rhythm. */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-6 p-4 lg:p-6", className)}>{children}</div>
}
