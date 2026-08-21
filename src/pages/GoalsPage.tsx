import { useMemo, useState } from "react"
import { Plus, Target, Bot } from "lucide-react"

import { PageHeader, PageShell } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from "@/components/ui/empty"

import { useFinanceStore } from "@/stores/useFinanceStore"
import { useUiStore } from "@/stores/useUiStore"
import { goalProjection } from "@/lib/finance/calc"

import { GoalCard } from "@/components/goals/GoalCard"
import { GoalSheet } from "@/components/goals/GoalSheet"

export default function GoalsPage() {
  const goals = useFinanceStore((s) => s.goals)
  const accounts = useFinanceStore((s) => s.accounts)
  const askAgent = useUiStore((s) => s.askAgent)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editGoalId, setEditGoalId] = useState<string | undefined>()
  const [activeTab, setActiveTab] = useState("active")

  const { active, completed } = useMemo(() => {
    const act = goals.filter((g) => g.status === "active" || g.status === "paused")
    const comp = goals.filter((g) => g.status === "completed" || g.status === "archived")
    return { active: act, completed: comp }
  }, [goals])

  const projections = useMemo(
    () => new Map(goals.map((g) => [g.id, goalProjection(g)])),
    [goals],
  )

  function openAdd() {
    setEditGoalId(undefined)
    setSheetOpen(true)
  }

  function openEdit(id: string) {
    setEditGoalId(id)
    setSheetOpen(true)
  }

  if (goals.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Goals" description="Track your savings goals and milestones" />
        <Empty className="min-h-[60vh] border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Target /></EmptyMedia>
            <EmptyTitle>No goals yet</EmptyTitle>
            <EmptyDescription>Set a savings goal to track your progress toward what matters most.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={openAdd}><Plus className="size-3.5" />Create a goal</Button>
          </EmptyContent>
        </Empty>
        <GoalSheet open={sheetOpen} onOpenChange={setSheetOpen} goalId={editGoalId} accounts={accounts} />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Goals"
        description="Track your savings goals and milestones"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => askAgent("How am I tracking on my savings goals? Which need more attention?")}>
              <Bot className="size-3.5" />
              Ask the agent
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="size-3.5" />
              Add goal
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          <TabsTrigger value="all">All ({goals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {active.length === 0 ? (
            <Empty className="border py-12">
              <EmptyHeader>
                <EmptyTitle>No active goals</EmptyTitle>
                <EmptyDescription>Create a goal to get started.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={openAdd}><Plus className="size-3.5" />Add goal</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {active.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  projection={projections.get(goal.id)!}
                  onEdit={() => openEdit(goal.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completed.length === 0 ? (
            <Empty className="border py-12">
              <EmptyHeader>
                <EmptyTitle>No completed goals yet</EmptyTitle>
                <EmptyDescription>Keep saving — your completed goals will appear here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {completed.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  projection={projections.get(goal.id)!}
                  onEdit={() => openEdit(goal.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                projection={projections.get(goal.id)!}
                onEdit={() => openEdit(goal.id)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <GoalSheet open={sheetOpen} onOpenChange={setSheetOpen} goalId={editGoalId} accounts={accounts} />
    </PageShell>
  )
}
