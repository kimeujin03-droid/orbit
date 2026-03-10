"use client"

import { useMemo, useCallback, useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { usePlannerStore, formatDateISO } from "@/lib/store"

const HOUR_HEIGHT = 32
const DAY_LABELS: Record<number, string> = { 0: "일", 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토" }
const VISIBLE_DAYS = 3

export function WeekView() {
  const {
    selectedDate,
    setSelectedDate,
    setViewMode,
    activities,
    blocksByDate,
    startHour,
  } = usePlannerStore()

  // 스와이프 상태
  const swipeStartXRef = useRef<number | null>(null)
  const [dayOffset, setDayOffset] = useState(0) // 현재 주 월요일로부터 오프셋 (0~4)

  // 전체 보기 토글
  const [showFullWeek, setShowFullWeek] = useState(false)

  // 현재 주의 월요일
  const weekStart = useMemo(() => {
    const d = new Date(selectedDate)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }, [selectedDate])

  // 이번 주 7일
  const allWeekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  // 현재 표시할 날짜들
  const visibleDays = useMemo(() => {
    if (showFullWeek) return allWeekDays
    const start = Math.min(dayOffset, allWeekDays.length - VISIBLE_DAYS)
    return allWeekDays.slice(start, start + VISIBLE_DAYS)
  }, [allWeekDays, dayOffset, showFullWeek])

  // 선택 날짜에 맞게 dayOffset 초기화
  useEffect(() => {
    const dayOfWeek = selectedDate.getDay()
    const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 월=0 ... 일=6
    setDayOffset(Math.max(0, Math.min(idx, 4)))
  }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  // 24시간 배열
  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => (startHour + i) % 24)
  }, [startHour])

  const getActivityColor = useCallback(
    (activityId: string) => activities.find((a) => a.id === activityId)?.color || "#6B7280",
    [activities]
  )

  const getActivityName = useCallback(
    (activityId: string) => {
      const act = activities.find((a) => a.id === activityId)
      // 부모가 있으면 부모 이름 표시
      if (act?.parentId) {
        const parent = activities.find((a) => a.id === act.parentId)
        return parent?.name || act.name
      }
      return act?.name || ""
    },
    [activities]
  )

  const goToPrevWeek = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 7)
    setSelectedDate(d)
  }
  const goToNextWeek = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 7)
    setSelectedDate(d)
  }

  const weekTitle = useMemo(() => {
    const m = weekStart.getMonth() + 1
    const w = Math.ceil(weekStart.getDate() / 7)
    return `${weekStart.getFullYear()}.${m}월 ${w}째주`
  }, [weekStart])

  // 요일 헤더 스와이프
  const handleSwipeStart = useCallback((clientX: number) => {
    swipeStartXRef.current = clientX
  }, [])

  const handleSwipeEnd = useCallback((clientX: number) => {
    if (swipeStartXRef.current === null) return
    const dx = clientX - swipeStartXRef.current
    swipeStartXRef.current = null

    if (Math.abs(dx) < 40) return

    if (dx < 0) {
      setDayOffset((prev) => Math.min(prev + 1, 4))
    } else {
      setDayOffset((prev) => Math.max(prev - 1, 0))
    }
  }, [])

  const [todayISO, setTodayISO] = useState<string | null>(null)
  useEffect(() => { setTodayISO(formatDateISO(new Date())) }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 헤더: 주 네비 + 전체보기 버튼 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/20">
        <button onClick={goToPrevWeek} className="p-1 hover:bg-muted rounded-lg">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-semibold">{weekTitle}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowFullWeek(!showFullWeek)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              showFullWeek ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {showFullWeek ? "3일" : "7일"}
          </button>
          <button onClick={goToNextWeek} className="p-1 hover:bg-muted rounded-lg">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 요일 헤더 (스와이프 가능) */}
      <div
        className="flex border-b border-border/20"
        onTouchStart={(e) => !showFullWeek && handleSwipeStart(e.touches[0].clientX)}
        onTouchEnd={(e) => !showFullWeek && handleSwipeEnd(e.changedTouches[0].clientX)}
        onMouseDown={(e) => !showFullWeek && handleSwipeStart(e.clientX)}
        onMouseUp={(e) => !showFullWeek && handleSwipeEnd(e.clientX)}
      >
        {/* 시간 라벨 영역 */}
        <div className="w-7 flex-shrink-0" />

        {/* 이전 화살표 (3일 모드) */}
        {!showFullWeek && (
          <button
            onClick={() => setDayOffset((p) => Math.max(p - 1, 0))}
            className="w-5 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={dayOffset <= 0}
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}

        {visibleDays.map((day, i) => {
          const iso = formatDateISO(day)
          const isToday = iso === todayISO
          const dow = day.getDay()
          return (
            <div
              key={i}
              className="flex-1 text-center py-1 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => {
                setSelectedDate(day)
                setViewMode("day")
              }}
            >
              <span
                className={`text-[9px] ${
                  dow === 0 ? "text-red-400" : dow === 6 ? "text-blue-400" : "text-muted-foreground"
                }`}
              >
                {DAY_LABELS[dow]}
              </span>
              <div
                className={`text-[11px] font-medium mx-auto w-5 h-5 flex items-center justify-center rounded-full leading-none ${
                  isToday ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          )
        })}

        {/* 다음 화살표 (3일 모드) */}
        {!showFullWeek && (
          <button
            onClick={() => setDayOffset((p) => Math.min(p + 1, 4))}
            className="w-5 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={dayOffset >= 4}
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 시간 그리드 */}
      <div
        className="flex-1 overflow-y-auto select-none scrollbar-hide"
        style={{ touchAction: "pan-y" }}
      >
        {hours.map((hour) => (
          <div key={hour} className="flex border-b border-border/10" style={{ height: `${HOUR_HEIGHT}px` }}>
            {/* 시간 라벨 */}
            <div className="w-7 flex-shrink-0 text-[9px] text-muted-foreground/50 text-right pr-0.5 pt-0.5 tabular-nums">
              {hour.toString().padStart(2, "0")}
            </div>

            {/* 이전 화살표 영역 (3일 모드) */}
            {!showFullWeek && <div className="w-5 flex-shrink-0" />}

            {/* 날짜 컬럼 */}
            {visibleDays.map((day, dayIdx) => {
              const dateISO = formatDateISO(day)
              // 주간 뷰: 실행(execute) 블록만 표시, 계획(overlay) 무시
              const dayBlocks = (blocksByDate[dateISO] || []).filter((b) => {
                if (b.layer !== "execute") return false
                const sh = Math.floor(b.startMin / 60)
                const eh = Math.floor((b.endMin - 1) / 60)
                return sh <= hour && eh >= hour
              })

              return (
                <div
                  key={dayIdx}
                  className={`flex-1 relative ${dayIdx > 0 ? "border-l border-border/10" : ""}`}
                  onClick={() => { setSelectedDate(day); setViewMode("day") }}
                >
                  {/* 배경 클릭 힌트 */}
                  <div className="absolute inset-0 hover:bg-primary/5 transition-colors cursor-pointer" />

                  {/* 블록 렌더링 — createdAt 정렬, 활동 이름 표시 */}
                  {dayBlocks
                    .sort((a, b) => a.createdAt - b.createdAt)
                    .map((block, bIdx) => {
                    const hourStart = hour * 60
                    const s = Math.max(0, block.startMin - hourStart)
                    const en = Math.min(60, block.endMin - hourStart)
                    // 이 시간대에서 같은 col 범위 겹치는 블록 (createdAt 정렬)
                    const overlapping = dayBlocks
                      .filter((b2) => {
                        const s2 = Math.max(0, b2.startMin - hourStart)
                        const e2 = Math.min(60, b2.endMin - hourStart)
                        return s2 < en && e2 > s
                      })
                      .sort((a2, b2) => a2.createdAt - b2.createdAt)
                    const overlapIdx = overlapping.indexOf(block)
                    const overlapCnt = overlapping.length
                    // 높이 분할
                    const avail = HOUR_HEIGHT - 4
                    let topPx = 2
                    let hPx = avail
                    if (overlapCnt > 1) {
                      const mainH = (avail * 2) / 3
                      const subH = (avail * 1) / 3 / (overlapCnt - 1)
                      if (overlapIdx === 0) { topPx = 2; hPx = mainH }
                      else { topPx = 2 + mainH + (overlapIdx - 1) * subH; hPx = subH }
                    }
                    // 이름 표시: 첫 번째 블록이고 시작점일 때
                    const name = getActivityName(block.activityId)
                    const isStart = block.startMin <= hourStart // 이 시간 시작 or 이전부터 이어짐
                    const showLabel = overlapIdx === 0 && (block.startMin >= hourStart && s === 0 || isStart)

                    return (
                      <div
                        key={bIdx}
                        className="absolute rounded-[2px] pointer-events-none flex items-center justify-center overflow-hidden"
                        style={{
                          left: `${(s / 60) * 100}%`,
                          width: `${((en - s) / 60) * 100}%`,
                          top: `${topPx}px`,
                          height: `${hPx}px`,
                          backgroundColor: getActivityColor(block.activityId),
                          opacity: 0.85,
                        }}
                      >
                        {showLabel && (
                          <span
                            className="text-[7px] font-bold text-white leading-none truncate px-[1px]"
                            style={{ textShadow: "0 0 2px rgba(0,0,0,0.5)" }}
                          >
                            {name}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* 다음 화살표 영역 (3일 모드) */}
            {!showFullWeek && <div className="w-5 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  )
}
