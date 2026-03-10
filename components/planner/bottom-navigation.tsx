"use client"

import { Home, Timer, BarChart3, Settings, ClipboardList } from "lucide-react"
import { usePlannerStore } from "@/lib/store"

export function BottomNavigation() {
  const { viewMode, setViewMode } = usePlannerStore()

  // day/week는 "홈"으로 통합 (헤더에서 날짜/주간 전환)
  const isHome = viewMode === "day" || viewMode === "week" || viewMode === "month"

  const tabs = [
    { id: "day" as const, label: "홈", icon: Home, active: isHome },
    { id: "tasks" as const, label: "할일", icon: ClipboardList, active: viewMode === "tasks" },
    { id: "focus" as const, label: "집중", icon: Timer, active: viewMode === "focus" },
    { id: "stats" as const, label: "통계", icon: BarChart3, active: viewMode === "stats" },
    { id: "settings" as const, label: "설정", icon: Settings, active: viewMode === "settings" },
  ]

  return (
    <div className="flex-shrink-0 bg-background/95 backdrop-blur-md border-t border-border/30 pb-safe">
      <div className="flex items-center justify-around px-1 h-12">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`flex flex-col items-center justify-center gap-0.5 w-14 h-full rounded-lg transition-colors ${
              tab.active
                ? "text-primary"
                : "text-muted-foreground/60 active:text-foreground"
            }`}
          >
            <tab.icon className={`w-[22px] h-[22px] transition-all ${tab.active ? "scale-105" : ""}`} strokeWidth={tab.active ? 2.2 : 1.8} />
            <span className={`text-[9px] leading-none ${tab.active ? "font-semibold" : "font-medium"}`}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
