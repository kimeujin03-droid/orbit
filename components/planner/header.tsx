"use client"

import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import { ChevronLeft, ChevronRight, CalendarRange, Moon, Sun, Locate, X } from "lucide-react"
import { usePlannerStore, formatDateISO, minToTime } from "@/lib/store"
import { haptic } from "@/lib/haptic"

// "HH:MM" 문자열 → 분(number)
function timeStrToMin(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

// ── 월 달력 팝업 ─────────────────────────────────────────────────────────────
const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"]
const DAY_SHORT = ["일","월","화","수","목","금","토"]

function MonthCalPopup({ selectedISO, onSelect, onClose }: {
  selectedISO: string
  onSelect: (iso: string) => void
  onClose: () => void
}) {
  const todayISO = formatDateISO(new Date())
  const [viewYear, setViewYear] = useState(() => parseInt(selectedISO.slice(0, 4)))
  const [viewMonth, setViewMonth] = useState(() => parseInt(selectedISO.slice(5, 7)) - 1)

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) } else setViewMonth(m => m + 1) }

  // 해당 월의 날짜 그리드 생성
  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const result: (Date | null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= daysInMonth; d++) result.push(new Date(viewYear, viewMonth, d))
    while (result.length % 7 !== 0) result.push(null)
    return result
  }, [viewYear, viewMonth])

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div className="absolute left-2 right-2 top-10 z-50 bg-background rounded-2xl shadow-2xl border border-border/20 p-3">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevMonth} className="w-7 h-7 rounded-full hover:bg-secondary/60 flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold">{viewYear}년 {MONTH_NAMES[viewMonth]}</span>
          <button onClick={nextMonth} className="w-7 h-7 rounded-full hover:bg-secondary/60 flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_SHORT.map((d, i) => (
            <div key={d} className={`text-center text-[10px] font-medium py-0.5 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-muted-foreground"}`}>{d}</div>
          ))}
        </div>
        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((date, i) => {
            if (!date) return <div key={i} />
            const iso = formatDateISO(date)
            const isSelected = iso === selectedISO
            const isToday = iso === todayISO
            const isSun = date.getDay() === 0
            const isSat = date.getDay() === 6
            return (
              <button
                key={i}
                onClick={() => onSelect(iso)}
                className={`flex items-center justify-center w-8 h-8 mx-auto rounded-full text-xs font-medium transition-all ${
                  isSelected ? "bg-primary text-primary-foreground shadow"
                  : isToday ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                  : isSun ? "text-red-400 hover:bg-secondary/50"
                  : isSat ? "text-blue-400 hover:bg-secondary/50"
                  : "text-foreground hover:bg-secondary/50"
                }`}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

// 계획 달성률 계산 훅
function usePlanProgress(dateISO: string) {
  const { blocksByDate } = usePlannerStore()
  return useMemo(() => {
    const blocks = blocksByDate[dateISO] || []
    const planMin  = blocks.filter(b => b.layer === "overlay").reduce((s, b) => s + (b.endMin - b.startMin), 0)
    const execMin  = blocks.filter(b => b.layer === "execute").reduce((s, b) => s + (b.endMin - b.startMin), 0)
    if (planMin === 0 && execMin === 0) return null
    const pct = planMin > 0 ? Math.min(100, Math.round((execMin / planMin) * 100)) : null
    return { planMin, execMin, pct }
  }, [blocksByDate, dateISO])
}

// PMS 예상 배지 훅
function usePmsBadge() {
  const { pmsCycles, conditionLogs } = usePlannerStore()
  return useMemo(() => {
    if (pmsCycles.length === 0) return null
    const sorted = [...pmsCycles].sort((a, b) => a.periodStartISO.localeCompare(b.periodStartISO))
    const last = sorted[sorted.length - 1]

    let avgCycle = 28
    if (sorted.length >= 2) {
      const diffs: number[] = []
      for (let i = 1; i < sorted.length; i++) {
        const a = new Date(sorted[i - 1].periodStartISO)
        const b = new Date(sorted[i].periodStartISO)
        diffs.push(Math.round((b.getTime() - a.getTime()) / 86400000))
      }
      avgCycle = Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length)
    }

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const lastStart = new Date(last.periodStartISO)
    const currentDay = Math.round((today.getTime() - lastStart.getTime()) / 86400000) + 1
    const nextPeriod = new Date(lastStart); nextPeriod.setDate(nextPeriod.getDate() + avgCycle)
    const pmsStart = new Date(nextPeriod); pmsStart.setDate(pmsStart.getDate() - 7)
    const daysUntilPeriod = Math.round((nextPeriod.getTime() - today.getTime()) / 86400000)
    const daysUntilPms = Math.round((pmsStart.getTime() - today.getTime()) / 86400000)

    const todayISO = formatDateISO(today)
    const isPmsToday = conditionLogs.find(c => c.dateISO === todayISO)?.pms ?? false

    // 생리 중 (Day 1~5 기준)
    const periodLen = last.periodEndISO
      ? Math.round((new Date(last.periodEndISO).getTime() - lastStart.getTime()) / 86400000) + 1
      : 5
    const isPeriod = currentDay >= 1 && currentDay <= periodLen

    return { daysUntilPms, daysUntilPeriod, currentDay, avgCycle, isPmsToday, isPeriod }
  }, [pmsCycles, conditionLogs])
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

export function PlannerHeader() {
  const { selectedDate, setSelectedDate, viewMode, setViewMode, setWakeUp, setSleep, wakeUpByDate, sleepByDate } = usePlannerStore()
  const [weekOffset, setWeekOffset] = useState(0)
  const [todayISO, setTodayISO] = useState<string | null>(null)
  const [showCalPop, setShowCalPop] = useState(false)
  const selectedISO = useMemo(() => formatDateISO(selectedDate), [selectedDate])
  const progress = usePlanProgress(selectedISO)
  const pmsBadge = usePmsBadge()

  // 수면/기상 퀵 입력 상태
  const [sleepPickerOpen, setSleepPickerOpen] = useState<"wake" | "sleep" | null>(null)
  const [sleepPickerVal, setSleepPickerVal] = useState("07:00")

  const wakeRaw  = wakeUpByDate?.[selectedISO] ?? null
  const sleepRaw = sleepByDate?.[selectedISO] ?? null
  const wakeTimeStr  = wakeRaw  != null ? minToTime(wakeRaw)  : null
  const sleepTimeStr = sleepRaw != null ? minToTime(sleepRaw) : null

  useEffect(() => {
    setTodayISO(formatDateISO(new Date()))
  }, [])

  // 현재 보여줄 주의 시작일 (일요일 기준)
  const weekDates = useMemo(() => {
    const base = new Date(selectedDate)
    // 현재 주 일요일 구하기
    const sunday = new Date(base)
    sunday.setDate(sunday.getDate() - sunday.getDay() + weekOffset * 7)
    
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [selectedDate, weekOffset])

  // 월 표시
  const displayMonth = useMemo(() => {
    const mid = weekDates[3] // 수요일 기준
    const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]
    return `${mid.getFullYear()}년 ${monthNames[mid.getMonth()]}`
  }, [weekDates])

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setWeekOffset(0)
    if (viewMode === "week") {
      setViewMode("day")
    }
  }

  const handlePrevWeek = () => setWeekOffset((v) => v - 1)
  const handleNextWeek = () => setWeekOffset((v) => v + 1)

  const toggleWeekView = () => {
    if (viewMode === "week") {
      setViewMode("day")
    } else {
      setViewMode("week")
    }
  }

  // 스와이프 지원
  const touchStartX = useRef(0)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 60) {
      if (dx > 0) handlePrevWeek()
      else handleNextWeek()
    }
  }, [])

  return (
    <header className="bg-background border-b border-border/20 flex-shrink-0">
      {/* 1행: 월 표시 + 우측 도구들 */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-1">
        {/* 이전 주 */}
        <button onClick={handlePrevWeek} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary/50 transition-colors flex-shrink-0">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* 월 표시 — 클릭하면 달력 팝업 */}
        <button
          onClick={() => setShowCalPop(v => !v)}
          className="flex items-center gap-0.5 text-[15px] font-bold text-foreground hover:text-primary transition-colors flex-shrink-0"
        >
          {displayMonth}
          <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${showCalPop ? "rotate-90" : ""}`} />
        </button>

        {/* 다음 주 */}
        <button onClick={handleNextWeek} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary/50 transition-colors flex-shrink-0">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="flex-1" />

        {/* PMS 배지 */}
        {pmsBadge && (
          pmsBadge.isPeriod ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary/60 text-muted-foreground select-none">🩸 D{pmsBadge.currentDay}</span>
          ) : (pmsBadge.isPmsToday || pmsBadge.daysUntilPms <= 0) && pmsBadge.daysUntilPeriod > 0 ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary/60 text-muted-foreground select-none">🌊 PMS</span>
          ) : null
        )}

        {/* 오늘 점프 */}
        {todayISO && selectedISO !== todayISO && (
          <button
            onClick={() => { haptic.light(); setSelectedDate(new Date()); setWeekOffset(0) }}
            className="flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-semibold bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          >
            <Locate className="w-3 h-3" />오늘
          </button>
        )}

        {/* 기상/취침 — 컴팩트 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => { haptic.light(); setSleepPickerVal(wakeTimeStr ?? "07:00"); setSleepPickerOpen("wake") }}
            className={`flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${wakeTimeStr ? "bg-secondary/50 text-foreground" : "text-muted-foreground/60 hover:bg-secondary/40"}`}
          >
            <Sun className="w-3 h-3" />{wakeTimeStr ?? "--:--"}
          </button>
          <button
            onClick={() => { haptic.light(); setSleepPickerVal(sleepTimeStr ?? "23:00"); setSleepPickerOpen("sleep") }}
            className={`flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${sleepTimeStr ? "bg-secondary/50 text-foreground" : "text-muted-foreground/60 hover:bg-secondary/40"}`}
          >
            <Moon className="w-3 h-3" />{sleepTimeStr ?? "--:--"}
          </button>
        </div>

        {/* 주간 토글 */}
        <button
          onClick={toggleWeekView}
          className={`flex items-center px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${viewMode === "week" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary/40"}`}
        >
          <CalendarRange className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 수면/기상 인라인 입력 */}
      {sleepPickerOpen && (
        <div className="mx-3 mb-1 flex items-center gap-2 bg-secondary/30 rounded-xl px-3 py-1.5 border border-border/20">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sleepPickerOpen === "wake" ? "bg-amber-400" : "bg-indigo-400"}`} />
          <span className="text-xs text-muted-foreground">{sleepPickerOpen === "wake" ? "기상" : "취침"}</span>
          <input type="time" value={sleepPickerVal} onChange={e => setSleepPickerVal(e.target.value)}
            className="flex-1 bg-transparent text-sm font-mono text-foreground outline-none border-0" autoFocus />
          <button onClick={() => { haptic.success(); if (sleepPickerOpen === "wake") setWakeUp(selectedISO, timeStrToMin(sleepPickerVal)); else setSleep(selectedISO, timeStrToMin(sleepPickerVal)); setSleepPickerOpen(null) }}
            className="px-2 py-0.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium">저장</button>
          <button onClick={() => setSleepPickerOpen(null)} className="text-muted-foreground p-0.5">
            <ChevronRight className="w-3.5 h-3.5 rotate-90" />
          </button>
        </div>
      )}

      {/* 월 달력 팝업 */}
      {showCalPop && (
        <MonthCalPopup
          selectedISO={selectedISO}
          onSelect={(iso) => {
            haptic.light()
            setSelectedDate(new Date(iso))
            setWeekOffset(0)
            setShowCalPop(false)
          }}
          onClose={() => setShowCalPop(false)}
        />
      )}

      {/* 요일 + 날짜 스트립 */}
      <div
        className="grid grid-cols-7 gap-0 px-3 pb-1.5"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {weekDates.map((date, idx) => {
          const dateISO = formatDateISO(date)
          const isToday = dateISO === todayISO
          const isSelected = dateISO === selectedISO
          const isSunday = idx === 0
          const isSaturday = idx === 6
          return (
            <button key={idx} onClick={() => handleDateClick(date)} className="flex flex-col items-center gap-0 py-0.5 transition-colors">
              <span className={`text-[10px] leading-tight font-medium ${isSunday ? "text-red-400" : isSaturday ? "text-blue-400" : "text-muted-foreground/70"}`}>
                {DAY_LABELS[idx]}
              </span>
              <div className={`w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-semibold transition-all ${
                isSelected ? "bg-primary text-primary-foreground shadow-sm"
                : isToday ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                : "text-foreground hover:bg-secondary/40"
              }`}>
                {date.getDate()}
              </div>
            </button>
          )
        })}
      </div>
    </header>
  )
}