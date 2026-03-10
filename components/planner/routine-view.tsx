"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import { Plus, Trash2, Play, ChevronDown, ChevronRight, Clock, X, Save, Eraser } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePlannerStore, formatDateISO, minToTime } from "@/lib/store"
import type { RoutineItem } from "@/lib/types"

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"]
const HOUR_HEIGHT = 48 // px per hour for routine grid (compact)
const SEGMENTS_PER_HOUR = 6 // 10min segments

// 그리?�에???�용???� ?�이??
interface GridCell {
  activityId: string
}

export function RoutineView({ initialTab = "daily" }: { initialTab?: "daily" | "weekly" } = {}) {
  const {
    activities,
    dailyRoutines,
    weeklyRoutines,
    addDailyRoutine,
    removeDailyRoutine,
    addWeeklyRoutine,
    removeWeeklyRoutine,
    setDailyRoutineItems,
    setWeeklyRoutineDayItems,
    applyDailyRoutineToDate,
    applyWeeklyRoutineToDate,
    selectedDate,
    startHour,
  } = usePlannerStore()

  const [activeTab, setActiveTab] = useState<"daily" | "weekly">(initialTab)
  const [newRoutineName, setNewRoutineName] = useState("")
  const [expandedRoutines, setExpandedRoutines] = useState<Set<string>>(new Set())

  // 그리???�집 모드
  const [editMode, setEditMode] = useState<{
    routineId: string
    type: "daily" | "weekly"
    dayIndex: number
  } | null>(null)

  // 그리???�태: hour -> segment -> activityId
  const [gridCells, setGridCells] = useState<Record<string, GridCell>>({})
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [isErasing, setIsErasing] = useState(false)
  const [isPainting, setIsPainting] = useState(false)
  const [weeklyEditDay, setWeeklyEditDay] = useState(0) // 주간 ?�집 ???�택???�일

  const gridRef = useRef<HTMLDivElement>(null)

  const rootActivities = useMemo(() => {
    return activities.filter((a) => !a.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [activities])

  const getChildren = useCallback((parentId: string) => {
    return activities.filter((a) => a.parentId === parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [activities])

  const getActivityColor = (id: string) => activities.find((a) => a.id === id)?.color || "#6B7280"
  const getActivityName = (id: string) => activities.find((a) => a.id === id)?.name || "?"

  // 24?�간 배열 (startHour 기�? ?�환)
  const hours24 = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => (startHour + i) % 24)
  }, [startHour])

  const cellKey = (hour: number, seg: number) => `${hour}-${seg}`

  // RoutineItem[] ??gridCells 변??
  const loadItemsToGrid = useCallback((items: RoutineItem[]) => {
    const cells: Record<string, GridCell> = {}
    items.forEach((item) => {
      for (let min = item.startMin; min < item.endMin; min += 10) {
        const h = Math.floor(min / 60)
        const s = Math.floor((min % 60) / 10)
        cells[cellKey(h, s)] = { activityId: item.activityId }
      }
    })
    setGridCells(cells)
  }, [])

  // gridCells ??RoutineItem[] 변??(?�속??같�? ?�동???�나??블록?�로)
  const gridToItems = useCallback((): Omit<RoutineItem, "id">[] => {
    // 모든 ?�???�간?�으�??�렬
    const entries: { min: number; activityId: string }[] = []
    Object.entries(gridCells).forEach(([key, cell]) => {
      const [h, s] = key.split("-").map(Number)
      entries.push({ min: h * 60 + s * 10, activityId: cell.activityId })
    })
    entries.sort((a, b) => a.min - b.min)

    if (entries.length === 0) return []

    const items: Omit<RoutineItem, "id">[] = []
    let currentActivity = entries[0].activityId
    let currentStart = entries[0].min
    let currentEnd = entries[0].min + 10

    for (let i = 1; i < entries.length; i++) {
      const entry = entries[i]
      if (entry.activityId === currentActivity && entry.min === currentEnd) {
        currentEnd = entry.min + 10
      } else {
        items.push({ activityId: currentActivity, startMin: currentStart, endMin: currentEnd })
        currentActivity = entry.activityId
        currentStart = entry.min
        currentEnd = entry.min + 10
      }
    }
    items.push({ activityId: currentActivity, startMin: currentStart, endMin: currentEnd })

    return items
  }, [gridCells])

  // 그리???�집 ?�작
  const startEdit = (routineId: string, type: "daily" | "weekly", dayIndex: number = 0) => {
    setEditMode({ routineId, type, dayIndex })
    setWeeklyEditDay(dayIndex)
    setSelectedActivityId(activities[0]?.id || null)
    setIsErasing(false)

    // 기존 ?�이??로드
    if (type === "daily") {
      const routine = dailyRoutines.find((r) => r.id === routineId)
      loadItemsToGrid(routine?.items || [])
    } else {
      const routine = weeklyRoutines.find((r) => r.id === routineId)
      loadItemsToGrid(routine?.dayItems[dayIndex] || [])
    }
  }

  // 주간 ?�집 ???�일 ?�환
  const switchWeeklyDay = (dayIndex: number) => {
    if (!editMode) return
    // ?�재 ?�일 ?�이???�??
    saveCurrentDayToStore()
    // ???�일 로드
    setWeeklyEditDay(dayIndex)
    const routine = weeklyRoutines.find((r) => r.id === editMode.routineId)
    loadItemsToGrid(routine?.dayItems[dayIndex] || [])
  }

  // ?�재 그리?????�토?�에 ?�??
  const saveCurrentDayToStore = () => {
    if (!editMode) return
    const items = gridToItems()
    if (editMode.type === "daily") {
      setDailyRoutineItems(editMode.routineId, items)
    } else {
      setWeeklyRoutineDayItems(editMode.routineId, weeklyEditDay, items)
    }
  }

  // ?�?�하�??�집 모드 종료
  const handleSave = () => {
    saveCurrentDayToStore()
    setEditMode(null)
    setGridCells({})
  }

  // 취소
  const handleCancel = () => {
    setEditMode(null)
    setGridCells({})
  }

  // ?� ?�인??
  const paintAtCell = useCallback((hour: number, seg: number) => {
    const key = cellKey(hour, seg)
    setGridCells((prev) => {
      const next = { ...prev }
      if (isErasing) {
        delete next[key]
      } else if (selectedActivityId) {
        next[key] = { activityId: selectedActivityId }
      }
      return next
    })
  }, [isErasing, selectedActivityId])

  // ?�인???�벤??(?�스?�톱 + 모바??
  const isPointerDownRef = useRef(false)
  const lastTouchCellRef = useRef<string | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent, hour: number, seg: number) => {
    if (!selectedActivityId && !isErasing) return
    e.preventDefault()
    isPointerDownRef.current = true
    setIsPainting(true)
    paintAtCell(hour, seg)
  }, [paintAtCell, selectedActivityId, isErasing])

  const handlePointerEnter = useCallback((e: React.PointerEvent, hour: number, seg: number) => {
    if (!(e.buttons & 1) || !isPointerDownRef.current || !isPainting) return
    paintAtCell(hour, seg)
  }, [isPainting, paintAtCell])

  const handlePointerUp = useCallback(() => {
    isPointerDownRef.current = false
    setIsPainting(false)
    lastTouchCellRef.current = null
  }, [])

  // 모바???�치 ?�래�?(elementFromPoint ?�턴 ???�간 ?�?�라?�과 ?�일)
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPointerDownRef.current) return
    if (!selectedActivityId && !isErasing) return
    e.preventDefault()

    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null
    if (!el) return

    const cellEl = el.closest("[data-rcell]") as HTMLElement | null
    if (!cellEl) return

    const cellKeyVal = cellEl.dataset.rcell!
    if (cellKeyVal === lastTouchCellRef.current) return
    lastTouchCellRef.current = cellKeyVal

    const [hourStr, segStr] = cellKeyVal.split("-")
    paintAtCell(parseInt(hourStr), parseInt(segStr))
  }, [selectedActivityId, isErasing, paintAtCell])

  const handleTouchEnd = useCallback(() => {
    isPointerDownRef.current = false
    setIsPainting(false)
    lastTouchCellRef.current = null
  }, [])

  // 루틴 목록 ?��?
  const toggleRoutine = (id: string) => {
    setExpandedRoutines((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddRoutine = () => {
    if (!newRoutineName.trim()) return
    if (activeTab === "daily") {
      addDailyRoutine(newRoutineName.trim())
    } else {
      addWeeklyRoutine(newRoutineName.trim())
    }
    setNewRoutineName("")
  }

  const handleApply = (routineId: string, type: "daily" | "weekly") => {
    const dateISO = formatDateISO(selectedDate)
    if (type === "daily") {
      applyDailyRoutineToDate(routineId, dateISO)
    } else {
      applyWeeklyRoutineToDate(routineId, dateISO)
    }
  }

  // ========== 그리???�집 모드 UI ==========
  if (editMode) {
    const routineName = editMode.type === "daily"
      ? dailyRoutines.find((r) => r.id === editMode.routineId)?.name
      : weeklyRoutines.find((r) => r.id === editMode.routineId)?.name

    return (
      <div className="flex flex-col h-full bg-background">
        {/* 배너 */}
        <div className="bg-red-500/90 text-white px-4 py-2 flex items-center gap-2 shadow-md z-10">
          <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          <span className="text-sm font-bold flex-1">루틴 생성 중입니다</span>
          <span className="text-xs opacity-80">{routineName}</span>
        </div>

        {/* 주간 ?�집 ???�일 ??*/}
        {editMode.type === "weekly" && (
          <div className="flex px-2 pt-2 gap-1">
            {DAY_LABELS.map((label, idx) => (
              <button
                key={idx}
                onClick={() => switchWeeklyDay(idx)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  weeklyEditDay === idx
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : idx === 0 ? "text-red-400 bg-secondary/30" : idx === 6 ? "text-blue-400 bg-secondary/30" : "text-muted-foreground bg-secondary/30"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ?�동 ?�레??(가�??�크�? */}
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto border-b border-border/20 flex-shrink-0">
          {/* 지?�개 */}
          <button
            onClick={() => { setIsErasing(true); setSelectedActivityId(null) }}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium flex-shrink-0 transition-all ${
              isErasing
                ? "bg-destructive/20 text-destructive ring-1.5 ring-destructive/40"
                : "bg-secondary/40 text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            <Eraser className="w-3 h-3" />지우기
          </button>
          {/* ?�동 �?*/}
          {rootActivities.map((act) => {
            const children = getChildren(act.id)
            return (
              <div key={act.id} className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => { setSelectedActivityId(act.id); setIsErasing(false) }}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                    selectedActivityId === act.id && !isErasing
                      ? "ring-1.5 ring-foreground/40 bg-secondary/60"
                      : "bg-secondary/30 hover:bg-secondary/50"
                  }`}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: act.color }} />
                  {act.name}
                </button>
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => { setSelectedActivityId(child.id); setIsErasing(false) }}
                    className={`flex items-center gap-0.5 px-1.5 py-1.5 rounded-lg text-[9px] transition-all ${
                      selectedActivityId === child.id && !isErasing
                        ? "ring-1.5 ring-foreground/40 bg-secondary/60"
                        : "bg-secondary/20 hover:bg-secondary/40"
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: child.color }} />
                    {child.name}
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        {/* 그리??*/}
        <div
          ref={gridRef}
          className="flex-1 overflow-y-auto relative select-none scrollbar-hide"
          style={{ touchAction: isPainting ? "none" : "pan-y" }}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {hours24.map((hour, hourIdx) => {
            return (
              <div
                key={hour}
                className="flex items-stretch border-b border-border/20"
                style={{ height: HOUR_HEIGHT }}
              >
                {/* ?�간 ?�이�?*/}
                <div className="w-8 flex-shrink-0 flex items-start justify-end pr-1 pt-0.5">
                  <span className="text-[9px] text-muted-foreground tabular-nums">
                    {String(hour).padStart(2, "0")}
                  </span>
                </div>
                {/* 6�??�그먼트 */}
                <div className="flex flex-1">
                  {Array.from({ length: SEGMENTS_PER_HOUR }).map((_, seg) => {
                    const key = cellKey(hour, seg)
                    const cell = gridCells[key]
                    const bgColor = cell ? getActivityColor(cell.activityId) : "transparent"
                    return (
                      <div
                        key={seg}
                        data-rcell={`${hour}-${seg}`}
                        className={`flex-1 border-r border-border/10 transition-colors cursor-pointer ${
                          !cell ? "hover:bg-muted/20" : ""
                        }`}
                        style={{
                          backgroundColor: bgColor,
                          opacity: cell ? 0.7 : 1,
                        }}
                        onPointerDown={(e) => handlePointerDown(e, hour, seg)}
                        onPointerEnter={(e) => handlePointerEnter(e, hour, seg)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* ?�단 버튼 */}
        <div className="flex gap-2 p-3 border-t border-border/20 bg-background">
          <Button variant="outline" onClick={handleCancel} className="flex-1 rounded-xl gap-1">
            <X className="w-4 h-4" />취소
          </Button>
          <Button onClick={handleSave} className="flex-1 rounded-xl gap-1">
            <Save className="w-4 h-4" />저장
          </Button>
        </div>
      </div>
    )
  }

  // ========== 루틴 목록 UI ==========
  return (
    <div className="flex flex-col h-full bg-background">
      {/* ?�더 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs text-muted-foreground mt-0.5">
          반복되는 일정을 루틴으로 등록하고 관리하세요
        </p>
      </div>

      {/* ??*/}
      <div className="flex mx-4 rounded-xl bg-secondary/50 p-0.5">
        <button
          onClick={() => setActiveTab("daily")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "daily" ? "bg-primary/15 text-primary" : "text-muted-foreground"
          }`}
        >
          일간 루틴
        </button>
        <button
          onClick={() => setActiveTab("weekly")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "weekly" ? "bg-primary/15 text-primary" : "text-muted-foreground"
          }`}
        >
          주간 루틴
        </button>
      </div>

      {/* 루틴 추�? */}
      <div className="flex gap-2 mx-4 mt-3">
        <Input
          placeholder={activeTab === "daily" ? "일간 루틴 이름" : "주간 루틴 이름"}
          value={newRoutineName}
          onChange={(e) => setNewRoutineName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddRoutine()}
          className="h-8 text-xs rounded-xl flex-1"
        />
        <Button onClick={handleAddRoutine} size="sm" className="h-8 rounded-xl text-xs px-3">
          <Plus className="w-3 h-3 mr-1" />추가
        </Button>
      </div>

      {/* 루틴 목록 */}
      <div className="flex-1 overflow-y-auto px-4 mt-3 pb-20 space-y-2 scrollbar-hide">
        {activeTab === "daily" && dailyRoutines.map((routine) => {
          const isExpanded = expandedRoutines.has(routine.id)
          return (
            <div key={routine.id} className="border border-border/20 rounded-xl overflow-hidden bg-card/50">
              <div className="flex items-center gap-2 px-3 py-2">
                <button onClick={() => toggleRoutine(routine.id)} className="flex-shrink-0">
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  }
                </button>
                <span className="text-sm font-medium flex-1">{routine.name}</span>
                <span className="text-[10px] text-muted-foreground">{routine.items.length}개</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] rounded-lg px-2"
                  onClick={() => startEdit(routine.id, "daily")}
                >
                  편집
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] rounded-lg px-2"
                  onClick={() => handleApply(routine.id, "daily")}
                >
                  <Play className="w-2.5 h-2.5 mr-0.5" />적용
                </Button>
                <button onClick={() => removeDailyRoutine(routine.id)} className="text-destructive/60 hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {isExpanded && (
                <div className="border-t border-border/20 px-3 py-2 space-y-1">
                  {routine.items.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-2">
                     루틴생성 중 - 편집 버튼을 눌러 그리드로 일정을 추가해보세요
                    </p>
                  ) : (
                    [...routine.items]
                      .sort((a, b) => a.startMin - b.startMin)
                      .map((item) => (
                        <div key={item.id} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-secondary/30">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getActivityColor(item.activityId) }} />
                          <span className="text-[10px] font-medium flex-1">{getActivityName(item.activityId)}</span>
                          <span className="text-[9px] text-muted-foreground tabular-nums">
                            {minToTime(item.startMin)} ~ {minToTime(item.endMin)}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          )
        })}

        {activeTab === "weekly" && weeklyRoutines.map((routine) => {
          const isExpanded = expandedRoutines.has(routine.id)
          const totalItems = Object.values(routine.dayItems).reduce((sum, items) => sum + items.length, 0)
          return (
            <div key={routine.id} className="border border-border/20 rounded-xl overflow-hidden bg-card/50">
              <div className="flex items-center gap-2 px-3 py-2">
                <button onClick={() => toggleRoutine(routine.id)} className="flex-shrink-0">
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  }
                </button>
                <span className="text-sm font-medium flex-1">{routine.name}</span>
                <span className="text-[10px] text-muted-foreground">{totalItems}개</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] rounded-lg px-2"
                  onClick={() => startEdit(routine.id, "weekly", 0)}
                >
                  편집
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] rounded-lg px-2"
                  onClick={() => handleApply(routine.id, "weekly")}
                >
                  <Play className="w-2.5 h-2.5 mr-0.5" />적용
                </Button>
                <button onClick={() => removeWeeklyRoutine(routine.id)} className="text-destructive/60 hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {isExpanded && (
                <div className="border-t border-border/20 px-3 py-2 space-y-1">
                  {totalItems === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-2">
                      루틴생성 중 - 편집 버튼을 눌러 그리드로 일정을 추가해보세요
                    </p>
                  ) : (
                    DAY_LABELS.map((dayLabel, dayIdx) => {
                      const dayItems = routine.dayItems[dayIdx] || []
                      if (dayItems.length === 0) return null
                      return (
                        <div key={dayIdx} className="space-y-0.5">
                          <span className={`text-[10px] font-medium ${
                            dayIdx === 0 ? "text-red-400" : dayIdx === 6 ? "text-blue-400" : "text-muted-foreground"
                          }`}>
                            {dayLabel}요일
                          </span>
                          {[...(dayItems)].sort((a, b) => a.startMin - b.startMin).map((item) => (
                            <div key={item.id} className="flex items-center gap-2 px-2 py-0.5 rounded-lg bg-secondary/20 ml-2">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getActivityColor(item.activityId) }} />
                              <span className="text-[9px] flex-1">{getActivityName(item.activityId)}</span>
                              <span className="text-[8px] text-muted-foreground tabular-nums">
                                {minToTime(item.startMin)}~{minToTime(item.endMin)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}

        {((activeTab === "daily" && dailyRoutines.length === 0) || (activeTab === "weekly" && weeklyRoutines.length === 0)) && (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">등록된 루틴이 없습니다</p>
            <p className="text-[10px] mt-1 opacity-60">위에서 이름을 입력하고 추가하세요</p>
          </div>
        )}
      </div>
    </div>
  )
}
