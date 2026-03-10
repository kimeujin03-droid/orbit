"use client"

import { useState, useMemo } from "react"
import {
  ChevronLeft, ChevronRight, ListChecks, Plus, X,
  Clock, Target, CalendarCheck, CheckCheck
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import type { PlannerTask, TaskStatus } from "@/lib/types"

export function ChecklistPanel({ embedded = false }: { embedded?: boolean }) {
  const {
    selectedDate,
    rightPanelOpen,
    setRightPanelOpen,
    checklistByDate,
    blocksByDate,
    activities,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    // 할일 연동용
    tasks,
    setTaskStatus,
  } = usePlannerStore()

  const dateISO = formatDateISO(selectedDate)
  const checklist = checklistByDate[dateISO] || []
  const blocks = blocksByDate[dateISO] || []

  const [newText, setNewText] = useState("")

  // 오늘 마감인 할일 필터링 (store tasks 에서)
  const todayTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.repeat) return false
      if (!t.dueDate) return false
      return t.dueDate === dateISO
    }).sort((a, b) => {
      // 미완료 우선
      if (a.status === "done" && b.status !== "done") return 1
      if (a.status !== "done" && b.status === "done") return -1
      return 0
    })
  }, [tasks, dateISO])

  const todayTasksDone = todayTasks.filter(t => t.status === "done").length
  const todayTasksTotal = todayTasks.length

  // 업무별 달성률
  const activityStats = useMemo(() => {
    const statsMap: Record<string, { planMin: number; execMin: number; name: string; color: string }> = {}

    blocks.forEach((block) => {
      const duration = block.endMin - block.startMin
      const act = activities.find((a) => a.id === block.activityId)
      if (!act) return

      if (!statsMap[block.activityId]) {
        statsMap[block.activityId] = { planMin: 0, execMin: 0, name: act.name, color: act.color }
      }

      if (block.layer === "overlay") {
        statsMap[block.activityId].planMin += duration
      } else if (block.layer === "execute") {
        statsMap[block.activityId].execMin += duration
      }
    })

    return Object.entries(statsMap)
      .filter(([, v]) => v.planMin > 0 || v.execMin > 0)
      .map(([id, v]) => ({
        id,
        ...v,
        percent: v.planMin > 0
          ? Math.min(100, Math.round((v.execMin / v.planMin) * 100))
          : v.execMin > 0 ? 100 : 0,
      }))
      .sort((a, b) => b.execMin - a.execMin)
  }, [blocks, activities])

  const totalStats = useMemo(() => {
    let planMin = 0, execMin = 0
    activityStats.forEach((s) => { planMin += s.planMin; execMin += s.execMin })
    const percent = planMin > 0 ? Math.min(100, Math.round((execMin / planMin) * 100)) : (execMin > 0 ? 100 : 0)
    return { planMin, execMin, percent }
  }, [activityStats])

  const formatMinutes = (min: number) => {
    const hours = Math.floor(min / 60)
    const mins = min % 60
    if (hours > 0 && mins > 0) return `${hours}시간 ${mins}분`
    if (hours > 0) return `${hours}시간`
    return `${mins}분`
  }

  const handleAdd = () => {
    if (newText.trim()) {
      addChecklistItem(dateISO, newText.trim())
      setNewText("")
    }
  }

  const completedCount = checklist.filter((item) => item.done).length

  // 할일 상태 토글
  const handleTaskToggle = (taskId: string, currentStatus: TaskStatus) => {
    const next: TaskStatus = currentStatus === "done" ? "todo" : "done"
    setTaskStatus(taskId, next)
  }

  // 활동 이름 찾기
  const ACT_PREFIX_RE = /^__act:(.+?)__/
  const getActivityName = (task: PlannerTask) => {
    const actId = task.note?.match(ACT_PREFIX_RE)?.[1]
    if (!actId) return null
    const act = activities.find(a => a.id === actId)
    return act ? { name: act.name, color: act.color } : null
  }

  const panelContent = (
    <div className="p-4 overflow-y-auto scrollbar-hide">
      {/* 업무별 달성률 */}
      <div className="mb-4 p-3 bg-background/50 rounded-lg border border-border/30">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">업무별 달성률</span>
        </div>
        {activityStats.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">아직 기록이 없습니다</p>
        ) : (
          <div className="space-y-3">
            {activityStats.map((stat) => (
              <div key={stat.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stat.color }} />
                    <span className="font-medium truncate w-[90vw] max-w-[100px] mx-4">{stat.name}</span>
                  </div>
                  <span className="text-muted-foreground">{stat.percent}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${stat.percent}%`, backgroundColor: stat.color }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>계획 {formatMinutes(stat.planMin)}</span>
                  <span>실제 {formatMinutes(stat.execMin)}</span>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-border/30">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">전체</span>
                <span className="text-sm font-bold text-primary">{totalStats.percent}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${totalStats.percent}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ 오늘 마감 할일 (할일 탭 연동) ══ */}
      {todayTasksTotal > 0 && (
        <div className="mb-4 p-3 bg-gradient-to-r from-orange-500/5 to-yellow-500/5 rounded-lg border border-orange-500/20">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium">오늘 마감 할일</span>
            </div>
            <span className="text-[10px] font-semibold text-orange-400 bg-orange-500/15 px-2 py-0.5 rounded-full">
              {todayTasksDone}/{todayTasksTotal}
            </span>
          </div>

          {/* 미니 진행바 */}
          <div className="relative h-1.5 bg-muted/30 rounded-full overflow-hidden mb-2.5">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-400 to-yellow-400 transition-all duration-500 rounded-full"
              style={{ width: todayTasksTotal > 0 ? `${Math.round((todayTasksDone / todayTasksTotal) * 100)}%` : "0%" }}
            />
          </div>

          <div className="space-y-1.5">
            {todayTasks.map(task => {
              const actInfo = getActivityName(task)
              const isDone = task.status === "done"
              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors ${
                    isDone ? "opacity-50" : "hover:bg-background/50"
                  }`}
                >
                  <button
                    onClick={() => handleTaskToggle(task.id, task.status)}
                    className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isDone
                        ? "border-emerald-400 bg-emerald-400/20"
                        : "border-orange-300 hover:border-orange-400"
                    }`}
                  >
                    {isDone && <CheckCheck className="w-2.5 h-2.5 text-emerald-400" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs block truncate ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {task.title}
                    </span>
                    {actInfo && (
                      <span className="text-[9px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: actInfo.color }} />
                        {actInfo.name}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 체크리스트 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold">체크리스트</h2>
        </div>
        <span className="text-xs text-muted-foreground">{completedCount}/{checklist.length}</span>
      </div>
      <div className="flex gap-2 mb-3 pb-3 border-b border-border/30">
        <Input placeholder="새 항목 추가..." value={newText} onChange={(e) => setNewText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} className="text-sm flex-1" />
        <Button size="sm" onClick={handleAdd}><Plus className="w-4 h-4" /></Button>
      </div>
      <div className="space-y-2">
        {checklist.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">체크리스트가 비어있습니다</p>
        ) : (
          checklist.map((item) => (
            <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors group">
              <Checkbox checked={item.done} onCheckedChange={() => toggleChecklistItem(dateISO, item.id)} className="w-4 h-4" />
              <div className="flex-1 min-w-0">
                <span className={`text-sm block truncate ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
                {item.time && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{item.time}</span>
                )}
              </div>
              <button onClick={() => removeChecklistItem(dateISO, item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )

  if (embedded) {
    return panelContent
  }

  return (
    <div className={`relative transition-all duration-300 ${rightPanelOpen ? "w-72" : "w-0"}`}>
      <button
        onClick={() => setRightPanelOpen(!rightPanelOpen)}
        className="absolute -left-8 top-1/2 -translate-y-1/2 z-20 bg-secondary hover:bg-secondary/80 rounded-l-lg p-2 transition-colors"
      >
        {rightPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {rightPanelOpen && (
        <div className="h-full bg-secondary/30 border-l border-border/30 overflow-y-auto scrollbar-hide">
          {panelContent}
        </div>
      )}
    </div>
  )
}
