"use client"

import { useMemo, useCallback, useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"
import { usePlannerStore, formatDateISO } from "@/lib/store"

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"]

export function MonthView() {
  const {
    selectedDate,
    setSelectedDate,
    setViewMode,
    activities,
    checklistByDate,
    blocksByDate,
    toggleChecklistItem,
  } = usePlannerStore()

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(selectedDate)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  // 선택된 날짜 (캘린더 내 탭하면 아래에 상세)
  const [focusDate, setFocusDate] = useState<string | null>(null)

  const getActivityColor = useCallback(
    (activityId: string) => activities.find((a) => a.id === activityId)?.color || "#6B7280",
    [activities]
  )

  const goToPrevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
  const goToNextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
  const goToToday = () => {
    const today = new Date()
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(today)
    setFocusDate(formatDateISO(today))
  }

  const monthTitle = `${viewMonth.getFullYear()}년 ${viewMonth.getMonth() + 1}월`
  const [todayISO, setTodayISO] = useState<string | null>(null)
  useEffect(() => { setTodayISO(formatDateISO(new Date())) }, [])

  // 캘린더 그리드 (6주 × 7일)
  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay() // 0(일)~6(토)
    const lastDate = new Date(year, month + 1, 0).getDate()

    const days: (Date | null)[] = []
    // 이전 달 빈칸
    for (let i = 0; i < firstDay; i++) days.push(null)
    // 이번 달
    for (let d = 1; d <= lastDate; d++) days.push(new Date(year, month, d))
    // 다음 달 빈칸 (6줄 맞추기)
    while (days.length < 42) days.push(null)

    return days
  }, [viewMonth])

  // 날짜별 요약: 활동 색상 dot + 체크리스트 완료율
  const daySummaries = useMemo(() => {
    const map: Record<
      string,
      { colors: string[]; checkTotal: number; checkDone: number; hasBlocks: boolean }
    > = {}

    calendarDays.forEach((day) => {
      if (!day) return
      const iso = formatDateISO(day)
      const blocks = blocksByDate[iso] || []
      const checks = checklistByDate[iso] || []

      const colorSet = new Set<string>()
      blocks.forEach((b) => {
        if (b.layer === "execute") colorSet.add(getActivityColor(b.activityId))
      })

      map[iso] = {
        colors: Array.from(colorSet).slice(0, 3),
        checkTotal: checks.length,
        checkDone: checks.filter((c) => c.done).length,
        hasBlocks: blocks.length > 0,
      }
    })
    return map
  }, [calendarDays, blocksByDate, checklistByDate, getActivityColor])

  // 월간 통계
  const monthlyStats = useMemo(() => {
    let planMin = 0,
      actualMin = 0
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const lastDate = new Date(year, month + 1, 0).getDate()

    for (let d = 1; d <= lastDate; d++) {
      const iso = formatDateISO(new Date(year, month, d))
      const blocks = blocksByDate[iso] || []
      blocks.forEach((b) => {
        const dur = b.endMin - b.startMin
        if (b.layer === "overlay") planMin += dur
        else actualMin += dur
      })
    }

    const pct = planMin > 0 ? Math.min(100, Math.round((actualMin / planMin) * 100)) : actualMin > 0 ? 100 : 0
    return {
      planH: Math.round((planMin / 60) * 10) / 10,
      actualH: Math.round((actualMin / 60) * 10) / 10,
      pct,
    }
  }, [viewMonth, blocksByDate])

  // 포커스 날짜의 체크리스트
  const focusChecklist = useMemo(() => {
    if (!focusDate) return []
    return checklistByDate[focusDate] || []
  }, [focusDate, checklistByDate])

  // 포커스 날짜의 활동 요약
  const focusActivities = useMemo(() => {
    if (!focusDate) return []
    const blocks = blocksByDate[focusDate] || []
    const map: Record<string, { name: string; color: string; min: number }> = {}
    blocks
      .filter((b) => b.layer === "execute")
      .forEach((b) => {
        const act = activities.find((a) => a.id === b.activityId)
        if (!act) return
        if (!map[b.activityId]) map[b.activityId] = { name: act.name, color: act.color, min: 0 }
        map[b.activityId].min += b.endMin - b.startMin
      })
    return Object.values(map).sort((a, b) => b.min - a.min)
  }, [focusDate, blocksByDate, activities])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/20">
        <div className="flex items-center gap-1">
          <button onClick={goToPrevMonth} className="p-1 hover:bg-muted rounded-lg">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goToNextMonth} className="p-1 hover:bg-muted rounded-lg">
            <ChevronRight className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold ml-1">{monthTitle}</h2>
        </div>
        <button
          onClick={goToToday}
          className="px-2.5 py-0.5 text-[11px] font-medium border border-border/50 rounded-lg hover:bg-muted transition-colors"
        >
          오늘
        </button>
      </div>

      {/* 월간 통계 — 컴팩트 */}
      <div className="px-3 py-2 border-b border-border/20 bg-muted/20">
        <div className="flex items-center gap-4 text-center">
          <div className="flex-1">
            <div className="text-[10px] text-muted-foreground">계획</div>
            <div className="text-sm font-semibold text-blue-400">{monthlyStats.planH}h</div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-muted-foreground">실행</div>
            <div className="text-sm font-semibold text-emerald-400">{monthlyStats.actualH}h</div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-muted-foreground">달성</div>
            <div className="text-sm font-semibold text-amber-400">{monthlyStats.pct}%</div>
          </div>
        </div>
        <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all"
            style={{ width: `${monthlyStats.pct}%` }}
          />
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-border/20">
        {DAY_LABELS.map((lbl, i) => (
          <div
            key={i}
            className={`text-center py-1 text-[10px] font-medium ${
              i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-muted-foreground"
            }`}
          >
            {lbl}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 + 하단 상세 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 캘린더 그리드 */}
        <div className="grid grid-cols-7 flex-shrink-0">
          {calendarDays.map((day, idx) => {
            if (!day) {
              return <div key={idx} className="aspect-square border-b border-r border-border/10" />
            }

            const iso = formatDateISO(day)
            const isToday = iso === todayISO
            const isFocus = iso === focusDate
            const summary = daySummaries[iso]
            const dayOfWeek = day.getDay()

            return (
              <div
                key={idx}
                className={`relative aspect-square border-b border-r border-border/10 p-0.5 cursor-pointer transition-colors ${
                  isFocus ? "bg-primary/10" : "hover:bg-muted/30"
                }`}
                onClick={() => {
                  setFocusDate(iso)
                  setSelectedDate(day)
                }}
                onDoubleClick={() => {
                  setSelectedDate(day)
                  setViewMode("day")
                }}
              >
                {/* 날짜 숫자 */}
                <div
                  className={`text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full mx-auto leading-none ${
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : dayOfWeek === 0
                      ? "text-red-400"
                      : dayOfWeek === 6
                      ? "text-blue-400"
                      : ""
                  }`}
                >
                  {day.getDate()}
                </div>

                {/* 활동 색상 점 */}
                {summary && summary.colors.length > 0 && (
                  <div className="flex items-center justify-center gap-[2px] mt-0.5">
                    {summary.colors.map((c, ci) => (
                      <div key={ci} className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                )}

                {/* 체크리스트 완료 표시 */}
                {summary && summary.checkTotal > 0 && (
                  <div className="flex items-center justify-center mt-0.5">
                    {summary.checkDone === summary.checkTotal ? (
                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                    ) : (
                      <span className="text-[7px] text-muted-foreground">
                        {summary.checkDone}/{summary.checkTotal}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 선택 날짜 상세 (하단) */}
        <div className="flex-1 overflow-y-auto border-t border-border/20 scrollbar-hide">
          {focusDate ? (
            <div className="p-3 space-y-3">
              {/* 날짜 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {new Date(focusDate).getMonth() + 1}/{new Date(focusDate).getDate()}
                    ({DAY_LABELS[new Date(focusDate).getDay()]})
                  </span>
                  {focusDate === todayISO && (
                    <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                      오늘
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedDate(new Date(focusDate))
                    setViewMode("day")
                  }}
                  className="text-[11px] text-primary font-medium hover:underline"
                >
                  일간 보기 →
                </button>
              </div>

              {/* 활동 요약 바 */}
              {focusActivities.length > 0 && (
                <div className="space-y-1.5">
                  {focusActivities.map((act, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: act.color }} />
                      <span className="text-xs flex-1 truncate">{act.name}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {Math.floor(act.min / 60) > 0 ? `${Math.floor(act.min / 60)}h ` : ""}
                        {act.min % 60}m
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 체크리스트 */}
              {focusChecklist.length > 0 ? (
                <div className="space-y-1">
                  {focusChecklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      onClick={() => toggleChecklistItem(focusDate, item.id)}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          item.done ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40"
                        }`}
                      >
                        {item.done && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className={`text-xs flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              ) : focusActivities.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">기록이 없습니다</p>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              날짜를 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
