"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Trash2, Plus, ChevronLeft, ChevronRight, X, Check } from "lucide-react"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import type { LogEntry } from "@/lib/types"

// ─── 시간 포맷 ─────────────────────────────────────────────────────────────

function minToTimeStr(min: number) {
  const h = Math.floor(min / 60).toString().padStart(2, "0")
  const m = (min % 60).toString().padStart(2, "0")
  return `${h}:${m}`
}

// ─── 메모 카드 (미니멀 메모지 스타일) ────────────────────────────────────────

function MemoCard({ entry, onDelete }: { entry: LogEntry; onDelete: () => void }) {
  const text = entry.memo || entry.title || ""

  return (
    <div className="group relative bg-card rounded-xl border border-border/40 shadow-sm transition-all hover:shadow-md">
      {/* 좌측 줄무늬 장식선 */}
      <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-border/40" />

      <div className="pl-4 pr-3 py-3">
        {/* 상단: 시간 + 삭제 */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            {entry.timeMin != null ? minToTimeStr(entry.timeMin) : ""}
          </span>
          <button
            onClick={onDelete}
            className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground/30 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* 본문 */}
        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed min-h-[1.25rem]">
          {text || <span className="text-muted-foreground/30 italic text-xs">빈 메모</span>}
        </p>
      </div>
    </div>
  )
}

// ─── 새 메모 작성 시트 ──────────────────────────────────────────────────────

function NewMemoSheet({ onSave, onClose }: { onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState("")
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setTimeout(() => textRef.current?.focus(), 100)
  }, [])

  const handleSave = () => {
    if (!text.trim()) return
    onSave(text.trim())
    onClose()
  }

  return (
    <>
      {/* 딤 배경 */}
      <div className="absolute inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />

      {/* 메모 시트 */}
      <div className="absolute inset-x-3 bottom-4 z-50 bg-card rounded-2xl shadow-2xl border border-border/30 overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
          <span className="text-sm font-semibold text-foreground">새 메모</span>
          <div className="flex items-center gap-1">
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full hover:bg-muted/50 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* 줄무늬 배경 텍스트 영역 */}
        <div className="relative px-4 py-3">
          <div className="absolute left-6 top-0 bottom-0 w-[1px] bg-border/20" />
          <textarea
            ref={textRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="지금 떠오르는 것을 메모하세요..."
            rows={5}
            className="w-full pl-4 text-sm bg-transparent outline-none resize-none placeholder:text-muted-foreground/40 leading-[1.75rem]"
            style={{
              backgroundImage: "repeating-linear-gradient(transparent, transparent 1.6875rem, var(--border) 1.6875rem, var(--border) calc(1.6875rem + 1px))",
              backgroundPositionY: "1.625rem",
            }}
          />
        </div>

        {/* 저장 버튼 */}
        <div className="px-4 pb-3">
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-30 hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            저장
          </button>
        </div>
      </div>
    </>
  )
}

// ─── 날짜 헤더 ──────────────────────────────────────────────────────────────

function DayHeader({ dateISO, count }: { dateISO: string; count: number }) {
  const date = new Date(dateISO)
  const day = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()]
  const isToday = dateISO === formatDateISO(new Date())

  return (
    <div className="flex items-center gap-2 py-1">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
        isToday ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-muted-foreground"
      }`}>
        <span>{date.getMonth() + 1}/{date.getDate()}</span>
        <span className="opacity-70">{day}</span>
      </div>
      <div className="flex-1 h-px bg-border/20" />
      <span className="text-[10px] text-muted-foreground/50">{count}개</span>
    </div>
  )
}

// ─── LogEntryView (메인) ────────────────────────────────────────────────────

export function LogEntryView() {
  const { logEntries, addLogEntry, removeLogEntry, selectedDate, setSelectedDate } = usePlannerStore()
  const [viewMode, setViewMode] = useState<"day" | "week">("day")
  const [showNewMemo, setShowNewMemo] = useState(false)

  const todayISO = formatDateISO(selectedDate)

  // 주간 날짜 범위
  const weekDates = useMemo(() => {
    const base = new Date(selectedDate)
    const sunday = new Date(base)
    sunday.setDate(sunday.getDate() - sunday.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday)
      d.setDate(d.getDate() + i)
      return formatDateISO(d)
    })
  }, [selectedDate])

  const targetDates = viewMode === "day" ? [todayISO] : weekDates

  // 날짜 이동
  const movePrev = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - (viewMode === "day" ? 1 : 7))
    setSelectedDate(d)
  }
  const moveNext = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + (viewMode === "day" ? 1 : 7))
    setSelectedDate(d)
  }

  // 범위 라벨
  const rangeLabel = useMemo(() => {
    if (viewMode === "day") {
      const d = new Date(todayISO)
      return `${d.getMonth() + 1}월 ${d.getDate()}일`
    }
    const first = new Date(weekDates[0])
    const last = new Date(weekDates[6])
    return `${first.getMonth() + 1}/${first.getDate()} ~ ${last.getMonth() + 1}/${last.getDate()}`
  }, [viewMode, todayISO, weekDates])

  // 날짜별 필터링
  const filteredByDate = useMemo(() => {
    return logEntries
      .filter((e) => targetDates.includes(e.dateISO))
      .sort((a, b) => {
        if (a.dateISO !== b.dateISO) return b.dateISO.localeCompare(a.dateISO)
        return (b.timeMin ?? 0) - (a.timeMin ?? 0)
      })
  }, [logEntries, targetDates])

  // 날짜별 그룹
  const grouped = useMemo(() => {
    const map = new Map<string, LogEntry[]>()
    for (const dateISO of [...targetDates].reverse()) {
      map.set(dateISO, [])
    }
    for (const entry of filteredByDate) {
      const list = map.get(entry.dateISO)
      if (list) list.push(entry)
    }
    return map
  }, [filteredByDate, targetDates])

  const totalCount = filteredByDate.length

  // 메모 추가
  const handleAddMemo = (text: string) => {
    const now = new Date()
    addLogEntry({
      dateISO: todayISO,
      timeMin: now.getHours() * 60 + now.getMinutes(),
      type: "note",
      memo: text,
      tags: [],
      category: "daily_life",
    })
  }

  return (
    <div className="relative flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">📝 메모</h2>
          <span className="text-[10px] text-muted-foreground/50">
            {totalCount > 0 ? `${totalCount}개` : ""}
          </span>
        </div>

        {/* 뷰모드 + 날짜 네비 */}
        <div className="flex items-center gap-2">
          <div className="flex bg-secondary/40 rounded-xl p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode("day")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === "day" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              일별
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === "week" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              주간
            </button>
          </div>
          <button onClick={movePrev} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary/50">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="flex-1 text-center text-xs font-medium">{rangeLabel}</span>
          <button onClick={moveNext} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary/50">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* 메모 리스트 */}
      <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-4 scrollbar-hide">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-4xl opacity-30">📝</span>
            <p className="text-sm text-muted-foreground text-center">
              아직 메모가 없어요
            </p>
            <p className="text-[11px] text-muted-foreground/50">+ 버튼을 눌러 메모를 작성해보세요</p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([dateISO, entries]) => {
            if (viewMode === "week" && entries.length === 0) return null
            return (
              <div key={dateISO} className="space-y-2">
                {viewMode === "week" && (
                  <DayHeader dateISO={dateISO} count={entries.length} />
                )}
                {entries.length === 0 && viewMode === "day" ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <span className="text-3xl opacity-15">📝</span>
                    <p className="text-xs text-muted-foreground/40">오늘 메모가 없어요</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry) => (
                      <MemoCard
                        key={entry.id}
                        entry={entry}
                        onDelete={() => removeLogEntry(entry.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* 오른쪽 하단 + FAB */}
      {!showNewMemo && (
        <button
          onClick={() => setShowNewMemo(true)}
          className="absolute right-4 bottom-4 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-30"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* 새 메모 시트 */}
      {showNewMemo && (
        <NewMemoSheet
          onSave={handleAddMemo}
          onClose={() => setShowNewMemo(false)}
        />
      )}
    </div>
  )
}

// ─── 홈 패널용 미니 위젯 ────────────────────────────────────────────────────

export function LogEntryHomePanel() {
  const { logEntries, addLogEntry, selectedDate } = usePlannerStore()
  const [memo, setMemo] = useState("")
  const todayISO = formatDateISO(selectedDate)

  const todayEntries = useMemo(() =>
    logEntries
      .filter((e) => e.dateISO === todayISO)
      .sort((a, b) => (b.timeMin ?? 0) - (a.timeMin ?? 0))
      .slice(0, 3),
    [logEntries, todayISO]
  )

  const handleQuickAdd = () => {
    if (!memo.trim()) return
    const now = new Date()
    addLogEntry({
      dateISO: todayISO,
      timeMin: now.getHours() * 60 + now.getMinutes(),
      type: "note",
      memo: memo.trim(),
      tags: [],
      category: "daily_life",
    })
    setMemo("")
  }

  return (
    <div className="space-y-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground/80">📝 오늘의 메모</span>
      </div>

      {/* 빠른 메모 입력 */}
      <div className="flex gap-2">
        <input
          value={memo}
          onChange={e => setMemo(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleQuickAdd() }}
          placeholder="메모 남기기..."
          className="flex-1 text-xs bg-secondary/30 rounded-lg px-3 py-2 outline-none placeholder:text-muted-foreground/50 border border-border/20 focus:border-primary/30"
        />
        <button
          onClick={handleQuickAdd}
          disabled={!memo.trim()}
          className="px-2.5 py-2 rounded-lg bg-primary/10 text-primary text-[10px] font-medium disabled:opacity-30"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* 최근 메모 3개 */}
      {todayEntries.length === 0 ? (
        <p className="text-[10px] text-muted-foreground/40 text-center py-2">
          오늘 첫 메모를 남겨보세요
        </p>
      ) : (
        <div className="space-y-1">
          {todayEntries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 py-1">
              <span className="text-sm">📝</span>
              <span className="flex-1 text-xs text-foreground/80 truncate">
                {entry.memo ?? entry.title ?? "메모"}
              </span>
              <span className="text-[9px] text-muted-foreground/40 font-mono">
                {entry.timeMin != null ? minToTimeStr(entry.timeMin) : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}