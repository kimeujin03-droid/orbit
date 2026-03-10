"use client"

import { useEffect, useState, useRef } from "react"
import { ListChecks, X, Smile, Plus } from "lucide-react"
import { LeftSidebar } from "./planner/left-sidebar"
import { Timeline } from "./planner/timeline"
import { WeekView } from "./planner/week-view"
import { MonthView } from "./planner/month-view"
import { SettingsView } from "./planner/settings-view"
import { FocusView } from "./planner/focus-view"
import { StatsView } from "./planner/stats-view"
import { TaskView } from "./planner/task-view"
import { PlannerHeader } from "./planner/header"
import { ChecklistPanel } from "./planner/checklist-panel"
import { BottomNavigation } from "./planner/bottom-navigation"
import { ConditionHomePanel, getConditionEmoji } from "./planner/condition-view"
import { VoiceInputFloatingButton } from "./planner/voice-block-input"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import { OnboardingScreen } from "@/components/onboarding"

// ── 서브 뷰 상단 타이틀 바 ────────────────────────────────────────────────────
const VIEW_TITLES: Partial<Record<string, string>> = {
  settings: "설정",
  focus: "집중",
  stats: "통계",
  tasks: "할일",
}

function SubViewHeader({ viewMode }: { viewMode: string }) {
  const title = VIEW_TITLES[viewMode]
  if (!title) return null
  return (
    <div className="flex-shrink-0 flex items-center px-4 h-10 border-b border-border/20 bg-background">
      <span className="text-sm font-semibold text-foreground">{title}</span>
    </div>
  )
}

// ── 스피드 다이얼 FAB ────────────────────────────────────────────────────────
interface SpeedDialFabProps {
  conditionEmoji: React.ReactNode
  onMemo: () => void
  onCondition: () => void
  onChecklist: () => void
  date: Date
}

function SpeedDialFab({ conditionEmoji, onMemo, onCondition, onChecklist, date }: SpeedDialFabProps) {
  const [open, setOpen] = useState(false)

  const items = [
    { label: "메모", emoji: "📝", onClick: () => { setOpen(false); onMemo() } },
    { label: "기분", emoji: conditionEmoji, onClick: () => { setOpen(false); onCondition() } },
    { label: "할일", emoji: "✓",  onClick: () => { setOpen(false); onChecklist() } },
  ]

  return (
    <>
      {/* 딤 배경 */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="absolute right-4 z-50 flex flex-col items-end gap-2" style={{ bottom: "calc(4rem + var(--sab, 0px) + 8px)" }}>
        {/* 서브 아이템들 — open 시 아래→위로 순서 (checklist=아래, memo=위) */}
        {items.map((item, i) => (
          <div
            key={item.label}
            className="flex items-center gap-2 transition-all duration-200"
            style={{
              opacity: open ? 1 : 0,
              transform: open ? "translateX(0) scale(1)" : "translateX(40px) scale(0.8)",
              transitionDelay: open ? `${i * 40}ms` : `${(items.length - 1 - i) * 20}ms`,
              pointerEvents: open ? "auto" : "none",
            }}
          >
            <span className="text-[11px] font-medium text-foreground/70 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow border border-border/20 whitespace-nowrap">
              {item.label}
            </span>
            <button
              onClick={item.onClick}
              className="w-10 h-10 rounded-full bg-background border border-border/30 shadow-lg flex items-center justify-center text-lg hover:scale-110 transition-transform"
            >
              {typeof item.emoji === "string" ? item.emoji : item.emoji}
            </button>
          </div>
        ))}

        {/* 음성 입력 버튼 — + 버튼 바로 위, 동일 사이즈 */}
        <VoiceInputFloatingButton date={date} />

        {/* 메인 + 버튼 */}
        <button
          onClick={() => setOpen(v => !v)}
          className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${
            open
              ? "bg-destructive text-destructive-foreground rotate-45"
              : "bg-primary text-primary-foreground hover:scale-105"
          }`}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </>
  )
}

// ── 메모 인라인 패널 ─────────────────────────────────────────────────────────
function MemoPanel({ onClose }: { onClose: () => void }) {
  const { addLogEntry, selectedDate } = usePlannerStore()
  const [text, setText] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 80)
  }, [])

  const handleSave = () => {
    if (!text.trim()) { onClose(); return }
    addLogEntry({
      dateISO: formatDateISO(selectedDate),
      timeMin: new Date().getHours() * 60 + new Date().getMinutes(),
      type: "note",
      memo: text.trim(),
      tags: [],
      category: "daily_life",
    })
    setText("")
    onClose()
  }

  return (
    <>
      <div className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="absolute inset-x-3 z-50 bg-background rounded-2xl shadow-2xl border border-border/20 p-3 flex flex-col gap-2" style={{ bottom: "calc(4rem + var(--sab, 0px) + 8px)" }}>
        <p className="text-xs font-semibold text-muted-foreground">📝 메모</p>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="지금 떠오르는 것..."
          rows={3}
          className="w-full bg-secondary/30 rounded-xl px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-1.5 rounded-lg bg-secondary/50 text-xs text-muted-foreground hover:bg-secondary/70 transition-colors">취소</button>
          <button onClick={handleSave} disabled={!text.trim()} className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors">저장</button>
        </div>
      </div>
    </>
  )
}

export function LifeLogPlanner() {
  const { viewMode, startHour, clearDayData, selectedDate, conditionLogs, onboardingDone } = usePlannerStore()
  const [showChecklist, setShowChecklist] = useState(false)
  const [showCondition, setShowCondition] = useState(false)
  const [showMemo, setShowMemo] = useState(false)

  // ── 온보딩 미완료 시 온보딩 화면 렌더 ─────────────────────────
  if (!onboardingDone) {
    return <OnboardingScreen />
  }

  const todayISO = formatDateISO(selectedDate)
  const todayLog = conditionLogs.find(c => c.dateISO === todayISO)
  const conditionEmoji = todayLog
    ? <span className="text-lg">{getConditionEmoji(todayLog)}</span>
    : <Smile className="w-5 h-5" />

  // startHour 기준 하루 리셋: 신규생성 항목 자동 제거
  useEffect(() => {
    const checkReset = () => {
      const now = new Date()
      const currentHour = now.getHours()
      const currentMin = now.getMinutes()
      
      if (currentHour === startHour && currentMin === 0) {
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayISO = formatDateISO(yesterday)
        
        const resetKey = `day-reset-${yesterdayISO}`
        if (!localStorage.getItem(resetKey)) {
          clearDayData(yesterdayISO)
          localStorage.setItem(resetKey, "done")
        }
      }
    }

    const timer = setInterval(checkReset, 60000)
    checkReset()
    return () => clearInterval(timer)
  }, [startHour, clearDayData])

  return (
    <div className="flex items-center justify-center h-screen bg-background sm:bg-neutral-100 sm:dark:bg-neutral-900">
      {/* 안드로이드 앱 프레임 */}
      <div className="relative w-full max-w-[430px] h-full max-h-[932px] bg-background text-foreground flex flex-col overflow-hidden shadow-2xl rounded-none sm:rounded-[2rem] border-0 sm:border border-border/20">
        
        {/* 상태바 safe-area 여백 */}
        <div className="flex-shrink-0 pt-safe bg-background" />

        {/* 헤더 */}
        {viewMode !== "settings" && viewMode !== "focus" && viewMode !== "stats" && viewMode !== "tasks"
          ? <PlannerHeader />
          : <SubViewHeader viewMode={viewMode} />
        }

        {/* 도구 + 팔레트 바 (일간만) */}
        {viewMode === "day" && <LeftSidebar />}

        {/* 메인 콘텐츠 */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-hide">
          {viewMode === "day" && <Timeline />}
          {viewMode === "week" && <WeekView />}
          {viewMode === "month" && <MonthView />}
          {viewMode === "settings" && <SettingsView />}
          {viewMode === "focus" && <FocusView />}
          {viewMode === "stats" && <StatsView />}
          {viewMode === "tasks" && <TaskView />}
        </div>

        {/* ── 스피드 다이얼 FAB (day 뷰만) ───────────────────────── */}
        {viewMode === "day" && !showChecklist && !showCondition && !showMemo && (
          <SpeedDialFab
            conditionEmoji={conditionEmoji}
            onMemo={() => setShowMemo(true)}
            onCondition={() => setShowCondition(true)}
            onChecklist={() => setShowChecklist(true)}
            date={selectedDate}
          />
        )}

        {/* 메모 패널 */}
        {showMemo && <MemoPanel onClose={() => setShowMemo(false)} />}

        {/* 감정체크 패널 */}
        {viewMode === "day" && showCondition && (
          <>
            <div className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowCondition(false)} />
            <div className="absolute inset-x-3 z-50 bg-background rounded-2xl shadow-2xl border border-border/20 overflow-hidden" style={{ bottom: "calc(4rem + var(--sab, 0px) + 8px)" }}>
              <ConditionHomePanel onClose={() => setShowCondition(false)} />
            </div>
          </>
        )}

        {/* 체크리스트 팝업 */}
        {viewMode === "day" && showChecklist && (
          <>
            <div className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowChecklist(false)} />
            <div className="absolute inset-x-3 top-16 z-50 bg-background rounded-2xl shadow-2xl border border-border/20 flex flex-col overflow-hidden" style={{ bottom: "calc(4rem + var(--sab, 0px) + 8px)" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">체크리스트</span>
                </div>
                <button onClick={() => setShowChecklist(false)} className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ChecklistPanel embedded />
              </div>
            </div>
          </>
        )}

        {/* 하단 네비게이션 */}
        <BottomNavigation />
      </div>
    </div>
  )
}