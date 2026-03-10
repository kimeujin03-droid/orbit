"use client"

import { useState, useMemo } from "react"
import { Flag, Eraser, Undo2, Redo2, Sparkles, ChevronDown, ChevronUp, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePlannerStore } from "@/lib/store"
import type { Activity } from "@/lib/types"

export function LeftSidebar() {
  const {
    activeTool,
    setActiveTool,
    activities,
    selectedActivityId,
    setSelectedActivityId,
    history,
    historyIndex,
    undo,
    redo,
  } = usePlannerStore()

  const [collapsed, setCollapsed] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const sortedRootActivities = useMemo(() => {
    return activities
      .filter((a) => !a.parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [activities])

  const getChildren = (parentId: string) => {
    return activities
      .filter((a) => a.parentId === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set<string>()
      // 아코디언: 이미 열려있으면 닫기, 아니면 이것만 열기
      if (!prev.has(id)) next.add(id)
      return next
    })
  }

  const canUndo = historyIndex >= 0
  const canRedo = historyIndex < history.length - 1

  const handleActivityClick = (activity: Activity) => {
    const children = getChildren(activity.id)
    if (children.length > 0) toggleExpand(activity.id)
    setSelectedActivityId(activity.id)
  }

  // 계획/실행 토글
  const isPlanOrExec = activeTool === "plan" || activeTool === "execute"
  const handlePlanExecToggle = () => {
    if (activeTool === "plan") setActiveTool("execute")
    else setActiveTool("plan")
  }

  return (
    <div className="bg-background/80 flex-shrink-0 border-b border-border/10">
      {/* 도구 바 */}
      <div className="flex items-center gap-1 px-2 py-1.5">

        {/* 계획 ↔ 실행 토글 버튼 */}
        <button
          onClick={handlePlanExecToggle}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
            activeTool === "plan"
              ? "bg-indigo-500/90 text-white border-indigo-400 shadow-sm"
              : activeTool === "execute"
              ? "bg-emerald-500/90 text-white border-emerald-400 shadow-sm"
              : "bg-muted text-muted-foreground border-border/30 hover:bg-secondary/60"
          }`}
        >
          <span className="text-[10px] leading-none">
            {activeTool === "plan" ? "📋 계획" : "▶ 실행"}
          </span>
        </button>

        <div className="h-3.5 w-px bg-border/30" />

        {/* 기타 도구 — 지표 / 삭제 / 신규 */}
        {([
          { id: "indicator" as const, icon: Flag,     label: "지표" },
          { id: "erase"     as const, icon: Eraser,   label: "삭제" },
          { id: "new"       as const, icon: Sparkles, label: "신규" },
        ] as { id: "indicator" | "erase" | "new"; icon: typeof Flag; label: string }[]).map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-[11px] transition-all border ${
              activeTool === tool.id
                ? "bg-primary text-primary-foreground border-primary/60 shadow-sm"
                : "text-muted-foreground border-transparent hover:bg-secondary/60"
            }`}
          >
            <tool.icon className="w-3 h-3" />
            <span className="font-medium text-[10px]">{tool.label}</span>
          </button>
        ))}

        <div className="flex-1" />

        {/* Undo / Redo */}
        <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} className="w-6 h-6 rounded-full">
          <Undo2 className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} className="w-6 h-6 rounded-full">
          <Redo2 className="w-3 h-3" />
        </Button>

        {/* 팔레트 접기 */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:bg-secondary transition-colors"
        >
          {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
      </div>

      {/* 카테고리 팔레트 */}
      {!collapsed && (
        <div className="px-2 pb-1.5">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {sortedRootActivities.map((activity) => {
              const children = getChildren(activity.id)
              const isExpanded = expandedIds.has(activity.id)
              const hasChildren = children.length > 0

              return (
                <button
                  key={activity.id}
                  onClick={() => handleActivityClick(activity)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-all flex-shrink-0 ${
                    selectedActivityId === activity.id
                      ? "ring-1 ring-foreground/30 ring-offset-1 ring-offset-background bg-secondary/50"
                      : "hover:bg-secondary/30"
                  }`}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: activity.color }} />
                  <span className="text-[10px] text-foreground/80 whitespace-nowrap font-medium">{activity.name}</span>
                  {hasChildren && (
                    <ChevronRight className={`w-2.5 h-2.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  )}
                </button>
              )
            })}
          </div>

          {sortedRootActivities.map((parent) => {
            const children = getChildren(parent.id)
            const isExpanded = expandedIds.has(parent.id)
            if (!isExpanded || children.length === 0) return null
            return (
              <div key={`sub-${parent.id}`} className="flex items-center gap-1 mt-1 pl-2 overflow-x-auto scrollbar-hide">
                <div className="w-0.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: parent.color, opacity: 0.5 }} />
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedActivityId(child.id)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-all flex-shrink-0 ${
                      selectedActivityId === child.id
                        ? "ring-1 ring-foreground/30 ring-offset-1 ring-offset-background bg-secondary/50"
                        : "hover:bg-secondary/30"
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: child.color }} />
                    <span className="text-[9px] text-foreground/70 whitespace-nowrap font-medium">{child.name}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

