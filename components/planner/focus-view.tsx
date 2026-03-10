"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Play, Pause, RotateCcw, Check, ChevronDown, ChevronUp, Clock } from "lucide-react"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import { haptic } from "@/lib/haptic"
import type { FocusSlot } from "@/lib/types"

type FocusMode = "countdown" | "stopwatch"

const PREF_EMOJIS: Record<number, string> = { 1: "\uD83D\uDE11", 2: "\uD83D\uDE10", 3: "\uD83D\uDE0A", 4: "\u2764\uFE0F", 5: "\uD83D\uDE0D" }
// 1=😑, 2=😐, 3=😊, 4=❤️, 5=😍

// ── 집중 타임라인 그리드 ────────────────────────────────────
function FocusGrid({
  slots, currentSlotIndex, isRunning, dailyGoalMin, color, prefEmoji,
}: {
  slots: FocusSlot[]
  currentSlotIndex: number
  isRunning: boolean
  dailyGoalMin: number
  color: string
  prefEmoji?: string
}) {
  const slotMap = useMemo(() => {
    const m = new Map<number, FocusSlot>()
    for (const s of slots) m.set(s.slotIndex, s)
    return m
  }, [slots])

  const totalSlots = Math.max(6, Math.ceil(dailyGoalMin / 10))
  const filledCount = slots.filter(s => s.level > 0).length
  const totalHours = Math.ceil(totalSlots / 6)
  const hours = Array.from({ length: totalHours }, (_, i) => i)

  return (
    <div className="w-full space-y-1.5">
      {/* 헤더 + 진행률 */}
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-muted-foreground flex-shrink-0">타임라인</p>
        <div className="flex-1 h-1.5 bg-secondary/30 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${totalSlots > 0 ? (filledCount / totalSlots) * 100 : 0}%`, backgroundColor: color }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0">
          {filledCount}/{totalSlots}
        </p>
      </div>

      {/* 그리드 */}
      <div className="space-y-[3px]">
        {hours.map(hour => {
          const baseIdx = hour * 6
          return (
            <div key={hour} className="flex items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-muted-foreground/60 w-4 text-right flex-shrink-0 font-mono">
                {hour}h
              </span>
              <div className="flex-1 grid grid-cols-6 gap-[3px]">
                {Array.from({ length: 6 }, (_, si) => {
                  const idx = baseIdx + si
                  if (idx >= totalSlots) return <div key={si} className="h-5" />
                  const slot = slotMap.get(idx)
                  const isCurrent = isRunning && idx === currentSlotIndex
                  const level = slot?.level ?? null

                  let bg: string
                  let content: React.ReactNode = null

                  if (level !== null && level > 0) {
                    const alphas = [0, 0.25, 0.42, 0.58, 0.76, 0.93]
                    const hexA = Math.round(alphas[level] * 255).toString(16).padStart(2, "0")
                    bg = color + hexA
                    // 첫 슬롯에 선호도 이모지 표시
                    if (idx === 0 && prefEmoji) {
                      content = <span className="text-[9px] leading-none">{prefEmoji}</span>
                    }
                  } else if (level === 0) {
                    bg = "var(--secondary)"
                    content = <div className="w-2 h-px opacity-40" style={{ backgroundColor: "var(--muted-foreground)" }} />
                  } else if (isCurrent) {
                    bg = color + "18"
                    content = <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
                  } else {
                    bg = "var(--secondary)"
                  }

                  return (
                    <div
                      key={si}
                      className={`h-5 rounded-[3px] flex items-center justify-center transition-all duration-300 ${
                        isCurrent ? "ring-1 ring-white/20 scale-110" : ""
                      }`}
                      style={{ backgroundColor: bg, opacity: level === null && !isCurrent ? 0.35 : 1 }}
                    >
                      {content}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────────────
export function FocusView() {
  const {
    activities, blocksByDate, selectedDate, addBlock, selectedActivityId, updateActivity,
    focusSession, startFocusSession, pauseFocusSession, resumeFocusSession,
    endFocusSession, clearFocusSession, updateFocusSlot,
  } = usePlannerStore()

  const [mode, setMode]                   = useState<FocusMode>("countdown")
  const [targetMinutes, setTargetMinutes] = useState(25)
  const [selectedActId, setSelectedActId] = useState<string | null>(selectedActivityId)
  const [showPicker, setShowPicker]       = useState(false)
  const [sessionsDone, setSessionsDone]   = useState(0)
  const [dailyGoalHours, setDailyGoalHours] = useState(3)

  // ── timestamp 기반 남은/경과 시간 계산 (매초 tick) ──────────────────
  const [tick, setTick] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // 실제 경과 시간(초) — timestamp 기반으로 계산
  const elapsedSec = useMemo(() => {
    if (!focusSession) return 0
    const { startedAt, totalPausedMs, isPaused, pausedAt } = focusSession
    const now = tick
    if (isPaused && pausedAt) {
      // 일시정지 중이면 pausedAt 시점까지만 계산
      return Math.floor((pausedAt - startedAt - totalPausedMs) / 1000)
    }
    // 진행 중
    return Math.max(0, Math.floor((now - startedAt - totalPausedMs) / 1000))
  }, [focusSession, tick])

  // 남은 시간(초) — countdown 모드
  const remainingSec = useMemo(() => {
    if (!focusSession) return 0
    if (focusSession.mode === "stopwatch") return 0
    return Math.max(0, focusSession.targetMinutes * 60 - elapsedSec)
  }, [focusSession, elapsedSec])

  // localStorage에서 dailyGoalHours 복원
  useEffect(() => {
    const saved = localStorage.getItem("focus-daily-goal-hours")
    if (saved) setDailyGoalHours(Number(saved))
  }, [])
  const updateDailyGoal = useCallback((h: number) => {
    setDailyGoalHours(h)
    localStorage.setItem("focus-daily-goal-hours", String(h))
    haptic.light()
  }, [])
  const circleRef    = useRef<SVGSVGElement | null>(null)
  const isDragging   = useRef(false)

  // 원형 타이머 크기 상수
  const SETUP_R = 88
  const SETUP_SIZE = SETUP_R * 2 + 24 // 200
  const RUN_R = 56
  const RUN_SIZE = RUN_R * 2 + 28 // 140

  // 현재 10분 구간 인덱스
  const currentSlotIndex = Math.floor(elapsedSec / 600)

  // 알림 권한
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission()
    }
  }, [])

  const sendNotification = useCallback((actName: string) => {
    haptic.completion()
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("\uD83C\uDF89 집중 완료!", { body: `${actName} \u2014 ${focusSession?.targetMinutes ?? targetMinutes}분 세션 완료!`, icon: "/icon.svg" })
    }
  }, [targetMinutes, focusSession])

  // ── 앱 재진입 시 세션 복구 + 자동 완료 체크 ──────────────────────
  const sessionRecoveredRef = useRef(false)
  useEffect(() => {
    if (!focusSession || sessionRecoveredRef.current) return
    sessionRecoveredRef.current = true

    // 복원된 세션이 running 상태인데 이미 endsAt를 지났으면 자동 종료
    if (focusSession.isRunning && focusSession.mode === "countdown") {
      const now = Date.now()
      if (now >= focusSession.endsAt) {
        // 이미 시간 지남 → 자동 종료 처리
        saveBlockFromSession(focusSession.startedAt, focusSession.targetMinutes * 60, focusSession.activityId)
        setSessionsDone(s => s + 1)
        endFocusSession()
        const actName = activities.find(a => a.id === focusSession.activityId)?.name ?? "집중"
        sendNotification(actName)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSession])

  // 카운트다운 자동 완료 감지 (실시간)
  const completedRef = useRef(false)
  useEffect(() => {
    if (!focusSession || !focusSession.isRunning || focusSession.isPaused) {
      completedRef.current = false
      return
    }
    if (focusSession.mode !== "countdown") return
    if (remainingSec <= 0 && elapsedSec > 0 && !completedRef.current) {
      completedRef.current = true
      saveBlockFromSession(focusSession.startedAt, focusSession.targetMinutes * 60, focusSession.activityId)
      setSessionsDone(s => s + 1)
      endFocusSession()
      const actName = activities.find(a => a.id === focusSession.activityId)?.name ?? "집중"
      sendNotification(actName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec, elapsedSec])

  // 10분 구간 자동 기록 (레벨 5 기본)
  const lastAutoSlotRef = useRef(-1)
  useEffect(() => {
    if (!focusSession || !focusSession.isRunning || focusSession.isPaused) return
    const prevSlotIdx = Math.floor(Math.max(0, elapsedSec - 1) / 600)
    const curSlotIdx = Math.floor(elapsedSec / 600)
    if (curSlotIdx > prevSlotIdx && curSlotIdx > lastAutoSlotRef.current) {
      if (!focusSession.focusSlots.some(s => s.slotIndex === prevSlotIdx)) {
        updateFocusSlot(prevSlotIdx, 5)
      }
      lastAutoSlotRef.current = curSlotIdx
    }
  }, [elapsedSec, focusSession, updateFocusSlot])

  // 블록 저장 (timestamp 기반)
  const saveBlockFromSession = useCallback((startedAtMs: number, durationSec: number, activityId: string) => {
    const startDate = new Date(startedAtMs)
    const startMin = startDate.getHours() * 60 + startDate.getMinutes()
    const endMin   = startMin + Math.ceil(durationSec / 60)
    const dateISO  = formatDateISO(startDate)
    addBlock({
      dateISO,
      startMin: Math.max(0, startMin),
      endMin:   Math.min(1440, endMin),
      activityId,
      layer: "execute",
      source: "manual",
    })
  }, [addBlock])

  const handlePlayPause = () => {
    if (focusSession) {
      if (focusSession.isRunning && !focusSession.isPaused) {
        // 일시정지
        pauseFocusSession()
        if (elapsedSec > 60) {
          saveBlockFromSession(focusSession.startedAt, elapsedSec, focusSession.activityId)
        }
      } else if (focusSession.isPaused) {
        // 이어하기
        resumeFocusSession()
      }
    } else {
      // 새 세션 시작
      if (!selectedActId) return
      startFocusSession(selectedActId, mode, targetMinutes, dailyGoalHours)
      lastAutoSlotRef.current = -1
      sessionRecoveredRef.current = true
      completedRef.current = false
    }
  }

  const handleReset = () => {
    clearFocusSession()
    lastAutoSlotRef.current = -1
    sessionRecoveredRef.current = false
    completedRef.current = false
  }

  const handleComplete = () => {
    if (focusSession && elapsedSec > 0) {
      saveBlockFromSession(focusSession.startedAt, elapsedSec, focusSession.activityId)
      setSessionsDone(s => s + 1)
    }
    clearFocusSession()
    lastAutoSlotRef.current = -1
    sessionRecoveredRef.current = false
    completedRef.current = false
  }

  // 집중도 버튼 (1~5) 클릭 → 현재 구간에 레벨 기록
  const handleSetCurrentLevel = (level: 1 | 2 | 3 | 4 | 5) => {
    haptic.light()
    updateFocusSlot(currentSlotIndex, level)
  }

  // 이탈 버튼 → 0
  const handleDefocus = () => {
    haptic.medium()
    updateFocusSlot(currentSlotIndex, 0)
  }

  // ── 원형 드래그로 분 조절 ──────────────────────────────
  const getAngleFromEvent = useCallback((clientX: number, clientY: number) => {
    const svg = circleRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    // 12시 방향 = 0도, 시계방향 증가
    let angle = Math.atan2(clientX - cx, -(clientY - cy)) * (180 / Math.PI)
    if (angle < 0) angle += 360
    return angle
  }, [])

  const angleToMinutes = useCallback((angle: number): number => {
    // 전체 360도 = maxMin, 5분 단위로 스냅
    const maxMin = mode === "countdown" ? 90 : 480
    const raw = Math.round((angle / 360) * maxMin)
    const snapped = Math.round(raw / 5) * 5
    return Math.max(5, Math.min(maxMin, snapped))
  }, [mode])

  const handleCircleDragStart = useCallback((clientX: number, clientY: number) => {
    if (focusSession) return // 세션 진행 중엔 드래그 불가
    const svg = circleRef.current
    if (!svg) return
    const angle = getAngleFromEvent(clientX, clientY)
    if (angle === null) return
    const rect = svg.getBoundingClientRect()
    const svgCx = rect.left + rect.width / 2
    const svgCy = rect.top + rect.height / 2
    const dist = Math.sqrt((clientX - svgCx) ** 2 + (clientY - svgCy) ** 2)
    if (dist < 30 || dist > SETUP_R + 50) return
    isDragging.current = true
    setTargetMinutes(angleToMinutes(angle))
    haptic.light()
  }, [focusSession, SETUP_R, getAngleFromEvent, angleToMinutes])

  const handleCircleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging.current) return
    const angle = getAngleFromEvent(clientX, clientY)
    if (angle !== null) {
      setTargetMinutes(angleToMinutes(angle))
    }
  }, [getAngleFromEvent, angleToMinutes])

  const handleCircleDragEnd = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false
      haptic.light()
    }
  }, [])

  // Global mouse/touch move & up
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleCircleDragMove(e.clientX, e.clientY)
    const onMouseUp   = () => handleCircleDragEnd()
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) handleCircleDragMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onTouchEnd  = () => handleCircleDragEnd()
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onTouchEnd)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
    }
  }, [handleCircleDragMove, handleCircleDragEnd])

  // 표시 시간
  const displayTime = useMemo(() => {
    if (focusSession) {
      if (focusSession.mode === "countdown") {
        const r = remainingSec
        return `${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`
      }
      return `${String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:${String(elapsedSec % 60).padStart(2, "0")}`
    }
    if (mode === "countdown") {
      return `${String(targetMinutes).padStart(2, "0")}:00`
    }
    return "00:00"
  }, [focusSession, remainingSec, elapsedSec, mode, targetMinutes])

  const progress = useMemo(() => {
    if (!focusSession) return 0
    if (focusSession.mode === "countdown") return Math.min(1, elapsedSec / (focusSession.targetMinutes * 60))
    return Math.min(1, elapsedSec / 3600)
  }, [elapsedSec, focusSession])

  // 원형 드래그 시 보여줄 각도 (설정 화면)
  const setupAngle = useMemo(() => {
    const maxMin = mode === "countdown" ? 90 : 480
    return (targetMinutes / maxMin) * 360
  }, [targetMinutes, mode])

  // 오늘 통계
  const todayFocusMin = useMemo(() => {
    const todayISO = formatDateISO(selectedDate)
    return (blocksByDate[todayISO] || []).filter(b => b.layer === "execute")
      .reduce((s, b) => s + (b.endMin - b.startMin), 0)
  }, [blocksByDate, selectedDate])

  // 평균 집중도 (이탈 제외)
  const focusSlots = focusSession?.focusSlots ?? []
  const avgFocus = useMemo(() => {
    const rated = focusSlots.filter(s => s.level > 0)
    if (!rated.length) return null
    return (rated.reduce((s, x) => s + x.level, 0) / rated.length).toFixed(1)
  }, [focusSlots])

  // 이탈 횟수
  const defocusCount = useMemo(() => focusSlots.filter(s => s.level === 0).length, [focusSlots])

  const selectedAct    = activities.find(a => a.id === (focusSession?.activityId ?? selectedActId))
  const rootActivities = activities.filter(a => !a.parentId)
  const actColor       = selectedAct?.color || "hsl(var(--primary))"

  // 세션 상태 편의 변수
  const isRunning     = focusSession?.isRunning && !focusSession?.isPaused
  const isPaused      = focusSession?.isPaused ?? false
  const isComplete    = focusSession?.mode === "countdown" && remainingSec <= 0 && elapsedSec > 0
  const isActiveSession = !!focusSession

  // 현재 구간에 기록된 레벨
  const currentLevel = focusSlots.find(s => s.slotIndex === currentSlotIndex)?.level ?? null

  // 실시간 시계
  const nowStr = useMemo(() => {
    const d = new Date(tick)
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
  }, [tick])

  const startTimeStr = focusSession
    ? (() => {
        const d = new Date(focusSession.startedAt)
        return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
      })()
    : null

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col items-center justify-between w-full px-5 pt-3 pb-4 gap-3 max-w-[430px] mx-auto flex-1">

        {!isActiveSession ? (
          /* ━━━ 화면 1: 실행 전 ━━━ */
          <>
            {/* 모드 탭 */}
            <div className="flex bg-secondary/20 rounded-xl p-1 gap-1 w-full">
              {(["countdown", "stopwatch"] as FocusMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setTargetMinutes(m === "countdown" ? 25 : 120); haptic.light() }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    mode === m ? "bg-secondary/50 text-foreground shadow-sm" : "text-muted-foreground/70"
                  }`}
                >
                  {m === "countdown" ? "카운트다운" : "스톱워치"}
                </button>
              ))}
            </div>

            {/* 오늘 목표 시간 */}
            <div className="w-full">
              <p className="text-[10px] text-muted-foreground mb-1.5">오늘 집중 목표</p>
              <div className="flex gap-1.5 w-full">
                {[1, 2, 3, 4, 5, 6, 8].map(h => (
                  <button
                    key={h}
                    onClick={() => updateDailyGoal(h)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      dailyGoalHours === h ? "shadow-sm" : "bg-secondary/15 text-muted-foreground/60"
                    }`}
                    style={dailyGoalHours === h ? { backgroundColor: actColor + "25", color: actColor } : undefined}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            {/* 활동 선택 */}
            <div className="relative w-full">
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-secondary/20 rounded-xl border border-border/15 hover:bg-secondary/30 active:scale-[0.98] transition-all"
              >
                {selectedAct ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedAct.color }} />
                    <span className="text-sm font-semibold flex-1 text-left truncate">{selectedAct.name}</span>
                    {selectedAct.preference && (
                      <span className="text-base flex-shrink-0">{PREF_EMOJIS[selectedAct.preference]}</span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground/70 flex-1 text-left">{"\uD65C\uB3D9\uC744 \uC120\uD0DD\uD558\uC138\uC694"}</span>
                )}
                {showPicker
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground/50" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground/50" />}
              </button>
              {showPicker && (
                <div className="absolute top-full mt-1 left-0 right-0 z-30 bg-background border border-border/20 rounded-xl shadow-2xl max-h-[280px] overflow-y-auto scrollbar-hide">
                  {rootActivities.map(act => (
                    <div key={act.id}>
                      <div className={`flex items-center hover:bg-secondary/20 transition-colors ${selectedActId === act.id ? "bg-secondary/25" : ""}`}>
                        <button
                          onClick={() => { setSelectedActId(act.id); setShowPicker(false); haptic.light() }}
                          className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
                        >
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: act.color }} />
                          <span className="text-sm font-medium truncate">{act.name}</span>
                        </button>
                        {/* 선호도 이모지 선택 */}
                        <div className="flex items-center gap-0.5 pr-3 flex-shrink-0">
                          {([1, 2, 3, 4, 5] as const).map(p => (
                            <button
                              key={p}
                              onClick={(e) => { e.stopPropagation(); updateActivity(act.id, { preference: act.preference === p ? undefined : p } as any); haptic.light() }}
                              className={`w-6 h-6 flex items-center justify-center rounded-md text-xs transition-all ${
                                act.preference === p ? "bg-secondary/40 scale-110" : "opacity-30 hover:opacity-70"
                              }`}
                            >
                              {PREF_EMOJIS[p]}
                            </button>
                          ))}
                        </div>
                      </div>
                      {activities.filter(a => a.parentId === act.id).map(child => (
                        <div key={child.id} className={`flex items-center hover:bg-secondary/20 transition-colors ${selectedActId === child.id ? "bg-secondary/25" : ""}`}>
                          <button
                            onClick={() => { setSelectedActId(child.id); setShowPicker(false); haptic.light() }}
                            className="flex-1 flex items-center gap-2.5 pl-10 pr-2 py-2.5 text-left min-w-0"
                          >
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: child.color }} />
                            <span className="text-xs font-medium truncate">{child.name}</span>
                          </button>
                          <div className="flex items-center gap-0.5 pr-3 flex-shrink-0">
                            {([1, 2, 3, 4, 5] as const).map(p => (
                              <button
                                key={p}
                                onClick={(e) => { e.stopPropagation(); updateActivity(child.id, { preference: child.preference === p ? undefined : p } as any); haptic.light() }}
                                className={`w-5 h-5 flex items-center justify-center rounded text-[10px] transition-all ${
                                  child.preference === p ? "bg-secondary/40 scale-110" : "opacity-30 hover:opacity-70"
                                }`}
                              >
                                {PREF_EMOJIS[p]}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 시간 프리셋 선택 */}
            <div className="w-full">
              {mode === "countdown" ? (
                <div className="flex gap-2 w-full">
                  {[15, 25, 30, 45, 60].map(min => (
                    <button
                      key={min}
                      onClick={() => { setTargetMinutes(min); haptic.light() }}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        targetMinutes === min ? "shadow-sm" : "bg-secondary/15 text-muted-foreground/60"
                      }`}
                      style={targetMinutes === min ? { backgroundColor: actColor + "25", color: actColor } : undefined}
                    >
                      {min}분
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2 w-full">
                  {[60, 120, 180, 240, 360, 480].map(min => (
                    <button
                      key={min}
                      onClick={() => { setTargetMinutes(min); haptic.light() }}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        targetMinutes === min ? "shadow-sm" : "bg-secondary/15 text-muted-foreground/60"
                      }`}
                      style={targetMinutes === min ? { backgroundColor: actColor + "25", color: actColor } : undefined}
                    >
                      {min / 60}h
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 원형 타이머 (드래그로 분 조절 가능) */}
            <div className="flex-1 flex items-center justify-center">
              <div className="relative select-none" style={{ touchAction: "none" }}>
                <svg
                  ref={circleRef}
                  width={SETUP_SIZE}
                  height={SETUP_SIZE}
                  className="-rotate-90 cursor-grab active:cursor-grabbing"
                  onMouseDown={(e) => handleCircleDragStart(e.clientX, e.clientY)}
                  onTouchStart={(e) => { if (e.touches.length === 1) handleCircleDragStart(e.touches[0].clientX, e.touches[0].clientY) }}
                >
                  {/* 배경 원 */}
                  <circle
                    cx={SETUP_SIZE / 2} cy={SETUP_SIZE / 2} r={SETUP_R}
                    fill="none" strokeWidth="5" stroke="var(--secondary)" opacity="0.3"
                  />
                  {/* 진행 호 (설정된 분량 표시) */}
                  <circle
                    cx={SETUP_SIZE / 2} cy={SETUP_SIZE / 2} r={SETUP_R}
                    fill="none" stroke={actColor} strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * SETUP_R}
                    strokeDashoffset={2 * Math.PI * SETUP_R * (1 - setupAngle / 360)}
                    opacity="0.5"
                    className="transition-all duration-150"
                  />
                  {/* 드래그 핸들 (색상 호의 끝점) */}
                  {(() => {
                    const angleRad = setupAngle * (Math.PI / 180)
                    const hx = SETUP_SIZE / 2 + SETUP_R * Math.cos(angleRad)
                    const hy = SETUP_SIZE / 2 + SETUP_R * Math.sin(angleRad)
                    return (
                      <>
                        {/* 투명 터치 확대 영역 */}
                        <circle cx={hx} cy={hy} r="22" fill="transparent" />
                        {/* 보이는 핸들 */}
                        <circle
                          cx={hx} cy={hy} r="12"
                          fill={actColor} stroke="white" strokeWidth="2.5"
                          className="drop-shadow-lg"
                        />
                      </>
                    )
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[42px] font-mono font-light tracking-tight leading-none text-foreground">
                    {displayTime}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1.5">
                    {mode === "countdown"
                      ? `${targetMinutes}분 집중`
                      : targetMinutes % 60 === 0
                        ? `${targetMinutes / 60}시간 목표`
                        : `${Math.floor(targetMinutes / 60)}시간 ${targetMinutes % 60}분 목표`}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 mt-0.5">
                    드래그하여 조절
                  </span>
                </div>
              </div>
            </div>

            {/* 시작 버튼 */}
            <button
              onClick={handlePlayPause}
              disabled={!selectedActId}
              className="w-full py-3.5 rounded-xl text-white text-sm font-bold active:scale-[0.97] transition-all disabled:opacity-20 shadow-lg flex items-center justify-center gap-2"
              style={{ backgroundColor: selectedActId ? actColor : undefined }}
            >
              <Play className="w-4.5 h-4.5" />
              집중 시작
            </button>

            {/* 오늘 통계 */}
            <div className="w-full space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-secondary/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (todayFocusMin / (dailyGoalHours * 60)) * 100)}%`,
                      backgroundColor: todayFocusMin >= dailyGoalHours * 60 ? "#34d399" : actColor,
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
                  {Math.floor(todayFocusMin / 60) > 0 ? `${Math.floor(todayFocusMin / 60)}h` : ""}{todayFocusMin % 60}m / {dailyGoalHours}h
                </span>
              </div>
              <div className="flex items-center justify-around py-2 bg-secondary/12 rounded-xl">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">달성률</p>
                  <p className="text-sm font-bold tabular-nums" style={{ color: todayFocusMin >= dailyGoalHours * 60 ? "#34d399" : actColor }}>
                    {Math.min(100, Math.round((todayFocusMin / (dailyGoalHours * 60)) * 100))}%
                  </p>
                </div>
                <div className="w-px h-5 bg-border/15" />
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">세션</p>
                  <p className="text-sm font-bold tabular-nums">{sessionsDone}회</p>
                </div>
                <div className="w-px h-5 bg-border/15" />
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">집중도</p>
                  <p className="text-sm font-bold tabular-nums" style={{ color: avgFocus ? actColor : undefined }}>
                    {avgFocus ?? "\u2014"}
                  </p>
                </div>
              </div>
            </div>

            {/* 현재 시각 */}
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-xs font-mono text-muted-foreground/50">{nowStr}</span>
            </div>
          </>
        ) : (
          /* ━━━ 화면 2: 실행 중 ━━━ */
          <>
            {/* 상단: 활동 + 시각 */}
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: actColor }} />
                <span className="text-sm font-bold truncate">{selectedAct?.name || "\uC9D1\uC911"}</span>
                {selectedAct?.preference && (
                  <span className="text-sm flex-shrink-0">{PREF_EMOJIS[selectedAct.preference]}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isRunning && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                {isPaused && <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                <span className="text-xs font-mono text-muted-foreground">{nowStr}</span>
                {startTimeStr && <span className="text-[10px] text-muted-foreground/60">({startTimeStr}~)</span>}
              </div>
            </div>

            {/* 원형 타이머 + 컨트롤 */}
            <div className="w-full flex items-center gap-4">
              {/* 원형 타이머 */}
              <div className="relative flex-shrink-0">
                <svg width={RUN_SIZE} height={RUN_SIZE} className="-rotate-90">
                  <circle
                    cx={RUN_SIZE / 2} cy={RUN_SIZE / 2} r={RUN_R}
                    fill="none" strokeWidth="4.5" stroke="var(--secondary)" opacity="0.25"
                  />
                  <circle
                    cx={RUN_SIZE / 2} cy={RUN_SIZE / 2} r={RUN_R}
                    fill="none"
                    stroke={isComplete ? "#34d399" : actColor}
                    strokeWidth="4.5" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * RUN_R}
                    strokeDashoffset={2 * Math.PI * RUN_R * (1 - progress)}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-mono font-semibold tracking-tight leading-none ${isComplete ? "text-emerald-400" : "text-foreground"}`}>
                    {displayTime}
                  </span>
                  {isComplete && <span className="text-[10px] text-emerald-400 font-semibold mt-0.5">완료!</span>}
                  {isPaused && !isComplete && <span className="text-[10px] text-amber-400 font-semibold mt-0.5">일시정지</span>}
                </div>
              </div>

              {/* 컨트롤 */}
              <div className="flex-1 flex flex-col gap-2">
                <button
                  onClick={handlePlayPause}
                  className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm active:scale-[0.97] transition-all text-white"
                  style={{ backgroundColor: isRunning ? "#f59e0b" : actColor }}
                >
                  {isRunning
                    ? <><Pause className="w-4 h-4" /> 일시정지</>
                    : <><Play className="w-4 h-4" /> 이어하기</>}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    className="flex-1 py-2 rounded-xl bg-secondary/15 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">리셋</span>
                  </button>
                  <button
                    onClick={handleComplete}
                    className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    style={{ backgroundColor: "#34d39920" }}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-semibold">완료</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 집중 타임라인 그리드 */}
            <FocusGrid
              slots={focusSlots}
              currentSlotIndex={currentSlotIndex}
              isRunning={!!isRunning}
              dailyGoalMin={(focusSession?.dailyGoalHours ?? dailyGoalHours) * 60}
              color={actColor}
              prefEmoji={selectedAct?.preference ? PREF_EMOJIS[selectedAct.preference] : undefined}
            />

            {/* 집중도 선택 */}
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  {currentSlotIndex * 10}~{currentSlotIndex * 10 + 10}분 집중도
                </p>
                {defocusCount > 0 && (
                  <span className="text-[10px] text-muted-foreground/60">이탈 {defocusCount}회</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {/* 이탈 */}
                <button
                  onClick={isRunning ? handleDefocus : undefined}
                  disabled={!isRunning}
                  className={`w-9 h-9 rounded-lg text-xs font-bold transition-all disabled:opacity-20 flex items-center justify-center ${
                    currentLevel === 0
                      ? "bg-secondary/50 text-foreground"
                      : "bg-secondary/15 text-muted-foreground/50"
                  }`}
                >
                  \u2715
                </button>
                {/* 1~5 */}
                {([1, 2, 3, 4, 5] as const).map(lv => {
                  const isSelected = currentLevel === lv
                  const alpha = [0, 0.15, 0.30, 0.45, 0.65, 0.90][lv]
                  const hexA = Math.round(alpha * 255).toString(16).padStart(2, "0")
                  return (
                    <button
                      key={lv}
                      onClick={() => isRunning && handleSetCurrentLevel(lv)}
                      disabled={!isRunning}
                      className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all disabled:opacity-20 ${
                        isSelected ? "ring-1 ring-white/20" : ""
                      }`}
                      style={{
                        backgroundColor: isSelected ? actColor + hexA : actColor + "10",
                        color: isSelected && lv >= 4 ? "#fff" : isSelected ? "#e4e4e7" : "var(--muted-foreground)",
                        opacity: isSelected ? 1 : 0.6,
                      }}
                    >
                      {lv}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 하단 통계 */}
            <div className="w-full flex items-center justify-around py-2 bg-secondary/12 rounded-xl">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">목표</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: todayFocusMin >= dailyGoalHours * 60 ? "#34d399" : actColor }}>
                  {Math.min(100, Math.round((todayFocusMin / (dailyGoalHours * 60)) * 100))}%
                </p>
              </div>
              <div className="w-px h-4 bg-border/15" />
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">세션</p>
                <p className="text-sm font-bold tabular-nums">{sessionsDone}회</p>
              </div>
              <div className="w-px h-4 bg-border/15" />
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">집중도</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: avgFocus ? actColor : undefined }}>
                  {avgFocus ?? "\u2014"}
                </p>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
