"use client"

import { useState, useMemo } from "react"
import { Trash2, TrendingUp, TrendingDown, Minus, Lightbulb, Plus, X } from "lucide-react"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import { Button } from "@/components/ui/button"
import type { DailyCondition, Block, PmsCycle } from "@/lib/types"

// ── 이모지 매핑 ──────────────────────────────────────────────────────────
export const FOCUS_EMOJIS:   Record<number, string> = { 1: "😵", 2: "😟", 3: "😐", 4: "😊", 5: "🤩" }
export const MOOD_EMOJIS:    Record<number, string> = { 1: "😭", 2: "😔", 3: "😐", 4: "🙂", 5: "😄" }
export const FATIGUE_EMOJIS: Record<number, string> = { 1: "⚡",  2: "🙂", 3: "😐", 4: "🥱", 5: "💤" }

export function getConditionEmoji(log: DailyCondition): string {
  return FOCUS_EMOJIS[log.focus] ?? "😐"
}

// ── 생리 주기 계산 ────────────────────────────────────────────────────────
function calcCycleDetails(cycles: PmsCycle[]) {
  if (cycles.length === 0) return null
  const sorted = [...cycles].sort((a, b) => a.periodStartISO.localeCompare(b.periodStartISO))
  const last = sorted[sorted.length - 1]

  let avgCycle = 28
  if (sorted.length >= 2) {
    const diffs = sorted.slice(1).map((c, i) =>
      Math.round((new Date(c.periodStartISO).getTime() - new Date(sorted[i].periodStartISO).getTime()) / 86400000)
    )
    avgCycle = Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length)
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const lastStart  = new Date(last.periodStartISO)
  const currentDay = Math.round((today.getTime() - lastStart.getTime()) / 86400000) + 1
  const nextPeriod = new Date(lastStart); nextPeriod.setDate(nextPeriod.getDate() + avgCycle)
  const ovulation  = new Date(nextPeriod); ovulation.setDate(ovulation.getDate() - 14)
  const pmsStart   = new Date(nextPeriod); pmsStart.setDate(pmsStart.getDate() - 7)

  const daysUntilPeriod    = Math.round((nextPeriod.getTime() - today.getTime()) / 86400000)
  const daysUntilOvulation = Math.round((ovulation.getTime()  - today.getTime()) / 86400000)
  const daysUntilPms       = Math.round((pmsStart.getTime()   - today.getTime()) / 86400000)

  const periodLen = last.periodEndISO
    ? Math.round((new Date(last.periodEndISO).getTime() - lastStart.getTime()) / 86400000) + 1
    : 5

  let phase: "period" | "follicular" | "ovulation" | "pms" | "luteal"
  if (currentDay - 1 < periodLen)                                phase = "period"
  else if (daysUntilOvulation >= -1 && daysUntilOvulation <= 1) phase = "ovulation"
  else if (daysUntilPms <= 0 && daysUntilPeriod > 0)            phase = "pms"
  else if (currentDay - 1 < avgCycle / 2)                       phase = "follicular"
  else                                                            phase = "luteal"

  return {
    avgCycle, currentDay, phase,
    nextPeriodISO:    formatDateISO(nextPeriod),
    ovulationISO:     formatDateISO(ovulation),
    pmsStartISO:      formatDateISO(pmsStart),
    daysUntilPeriod, daysUntilOvulation, daysUntilPms,
  }
}

// ── EmojiRow ─────────────────────────────────────────────────────────────
function EmojiRow({ label, emojis, value, onChange }: {
  label: string; emojis: Record<number, string>
  value: 1|2|3|4|5|undefined; onChange: (v: 1|2|3|4|5) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="flex gap-1">
        {([1, 2, 3, 4, 5] as const).map(n => (
          <button key={n} onClick={() => onChange(n)}
            className={`flex-1 flex flex-col items-center py-1.5 rounded-xl border transition-all ${
              value === n
                ? "bg-primary/20 border-primary/60 scale-105 shadow-sm"
                : "bg-secondary/20 border-border/20 hover:bg-secondary/40"
            }`}>
            <span className="text-xl">{emojis[n]}</span>
            <span className="text-[9px] text-muted-foreground mt-0.5">{n}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 생리 주기 대시보드 ────────────────────────────────────────────────────
const PHASE_INFO = {
  period:     { label: "🩸 생리 중",    color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-400/30" },
  follicular: { label: "🌱 난포기",      color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-400/20" },
  ovulation:  { label: "✨ 배란기",      color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-400/30" },
  pms:        { label: "🌊 PMS 의심",   color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-400/30" },
  luteal:     { label: "🌙 황체기",      color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-400/20" },
} as const

const PHASE_COLOR = {
  period: "#f87171", follicular: "#4ade80", ovulation: "#facc15", pms: "#a78bfa", luteal: "#818cf8",
} as const

type CycleDetail = NonNullable<ReturnType<typeof calcCycleDetails>>

function CycleDashboard({ detail, cycleCount }: { detail: CycleDetail; cycleCount: number }) {
  const pi = PHASE_INFO[detail.phase]

  const dateCards = [
    {
      icon: "✨", label: "배란기",
      days: detail.daysUntilOvulation, date: detail.ovulationISO,
      active: detail.daysUntilOvulation >= -1 && detail.daysUntilOvulation <= 1,
      activeCls: "bg-yellow-500/20 border-yellow-400/40",
    },
    {
      icon: "🌊", label: "PMS 예상",
      days: detail.daysUntilPms, date: detail.pmsStartISO,
      active: detail.daysUntilPms <= 0 && detail.daysUntilPeriod > 0,
      activeCls: "bg-purple-500/20 border-purple-400/40",
      warn: detail.daysUntilPms > 0 && detail.daysUntilPms <= 5,
      warnCls: "bg-purple-500/10 border-purple-400/20",
    },
    {
      icon: "🩸", label: "다음 생리",
      days: detail.daysUntilPeriod, date: detail.nextPeriodISO,
      active: detail.daysUntilPeriod <= 0,
      activeCls: "bg-red-500/10 border-red-400/20",
      warn: detail.daysUntilPeriod > 0 && detail.daysUntilPeriod <= 3,
      warnCls: "bg-red-500/20 border-red-400/40",
    },
  ]

  return (
    <div className={`rounded-xl p-3.5 border space-y-3 ${pi.bg} ${pi.border}`}>
      {/* Day + 단계 뱃지 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">현재 주기</p>
          <p className="text-2xl font-black leading-none">
            Day {detail.currentDay}
            <span className="text-xs font-normal text-muted-foreground ml-1">/ {detail.avgCycle}일</span>
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${pi.color} ${pi.bg} ${pi.border}`}>
          {pi.label}
        </span>
      </div>

      {/* 주기 진행 바 */}
      <div className="space-y-1">
        <div className="h-2 bg-background/40 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, ((detail.currentDay - 1) / detail.avgCycle) * 100)}%`,
              background: PHASE_COLOR[detail.phase],
            }} />
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground">
          {["생리", "난포기", "배란", "황체기", "PMS"].map(t => <span key={t}>{t}</span>)}
        </div>
      </div>

      {/* 날짜 카드 3개 */}
      <div className="grid grid-cols-3 gap-2">
        {dateCards.map(card => {
          const cls = card.active
            ? card.activeCls
            : card.warn && card.warnCls
              ? card.warnCls
              : "bg-background/30 border-border/20"
          const text =
            card.days === 0 ? "오늘"
            : card.days > 0 ? `${card.days}일 후`
            : card.label === "PMS 예상" && detail.daysUntilPeriod > 0 ? "진행 중"
            : card.label === "다음 생리" ? `+${Math.abs(card.days)}일`
            : `${Math.abs(card.days)}일 지남`
          return (
            <div key={card.label} className={`rounded-xl p-2 text-center border ${cls}`}>
              <p className="text-[9px] text-muted-foreground">{card.icon} {card.label}</p>
              <p className="text-[11px] font-bold mt-0.5">{text}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{card.date.slice(5)}</p>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        평균 주기 <span className="font-semibold text-foreground">{detail.avgCycle}일</span>
        {cycleCount >= 2 ? ` · ${cycleCount}회 기록 기반` : " · 기록 1회 (28일 기본값)"}
      </p>
    </div>
  )
}

// ── 생리 주기 트래커 섹션 ─────────────────────────────────────────────────
function PmsCycleSection() {
  const { pmsCycles, addPmsCycle, removePmsCycle } = usePlannerStore()
  const [newStart, setNewStart]       = useState("")
  const [newEnd, setNewEnd]           = useState("")
  const [showHistory, setShowHistory] = useState(false)

  const sorted = [...pmsCycles].sort((a, b) => b.periodStartISO.localeCompare(a.periodStartISO))
  const detail = calcCycleDetails(pmsCycles)

  const handleAdd = () => {
    if (!newStart) return
    addPmsCycle({ periodStartISO: newStart, periodEndISO: newEnd || undefined })
    setNewStart(""); setNewEnd("")
  }

  return (
    <div className="space-y-3">
      {detail
        ? <CycleDashboard detail={detail} cycleCount={pmsCycles.length} />
        : (
          <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-400/20 text-center">
            <p className="text-2xl mb-1.5">🩸</p>
            <p className="text-xs font-semibold mb-1">생리 주기를 기록해보세요</p>
            <p className="text-[10px] text-muted-foreground">시작일을 입력하면 배란기 · PMS · 다음 생리를 예측해 드려요</p>
          </div>
        )
      }

      {/* 기록 추가 */}
      <div className="bg-secondary/10 rounded-xl p-3 border border-border/10 space-y-2">
        <p className="text-xs font-semibold">➕ 생리 기록 추가</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">시작일 *</p>
            <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)}
              className="w-full text-xs bg-background/60 rounded-lg px-2 py-1.5 border border-border/20 outline-none focus:ring-1 focus:ring-purple-400/40" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">종료일 (선택)</p>
            <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)}
              className="w-full text-xs bg-background/60 rounded-lg px-2 py-1.5 border border-border/20 outline-none focus:ring-1 focus:ring-purple-400/40" />
          </div>
        </div>
        <Button size="sm" disabled={!newStart} onClick={handleAdd}
          className="w-full h-8 rounded-lg text-xs bg-purple-500/80 hover:bg-purple-500">
          <Plus className="w-3.5 h-3.5 mr-1" />기록 추가
        </Button>
      </div>

      {/* 이력 토글 */}
      {sorted.length > 0 && (
        <div className="space-y-1">
          <button onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <span>{showHistory ? "▲" : "▼"}</span>
            기록 이력 {sorted.length}회
          </button>
          {showHistory && (
            <div className="space-y-1 max-h-36 overflow-y-auto scrollbar-hide">
              {sorted.map((c, i) => {
                const dur = c.periodEndISO
                  ? `${Math.round((new Date(c.periodEndISO).getTime() - new Date(c.periodStartISO).getTime()) / 86400000) + 1}일`
                  : ""
                return (
                  <div key={c.id} className="flex items-center justify-between bg-secondary/20 rounded-lg px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">#{sorted.length - i}</span>
                      <span className="text-[11px] font-medium">🩸 {c.periodStartISO}</span>
                      {c.periodEndISO && (
                        <span className="text-[10px] text-muted-foreground">~ {c.periodEndISO.slice(5)} ({dur})</span>
                      )}
                    </div>
                    <button onClick={() => removePmsCycle(c.id)}
                      className="w-5 h-5 rounded-full hover:bg-red-500/20 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 패턴 분석 카드 ───────────────────────────────────────────────────────
function CorrelationCard({ conditionLogs, blocksByDate }: {
  conditionLogs: DailyCondition[]; blocksByDate: Record<string, Block[]>
}) {
  const analysis = useMemo(() => {
    if (conditionLogs.length < 3) return null

    const highFocus = conditionLogs.filter(c => c.focus >= 4)
    const lowFocus  = conditionLogs.filter(c => c.focus <= 2)

    const avgExecMin = (dates: string[]) => {
      if (!dates.length) return 0
      return Math.round(dates.reduce((sum, d) => {
        const blocks = blocksByDate[d] || []
        return sum + blocks
          .filter((b: Block) => b.layer === "execute")
          .reduce((s: number, b: Block) => s + (b.endMin - b.startMin), 0)
      }, 0) / dates.length)
    }

    const highExec = avgExecMin(highFocus.map(c => c.dateISO))
    const lowExec  = avgExecMin(lowFocus.map(c => c.dateISO))

    const hourlyExec: number[] = Array(24).fill(0)
    Object.values(blocksByDate).forEach(blocks => {
      ;(blocks as Block[]).filter(b => b.layer === "execute").forEach(b => {
        const sh = Math.floor(b.startMin / 60)
        const eh = Math.min(Math.ceil(b.endMin / 60), 24)
        for (let h = sh; h < eh; h++) hourlyExec[h]++
      })
    })
    const totalDays = Object.keys(blocksByDate).length || 1
    const workRates = hourlyExec.slice(6, 22).map(v => v / totalDays)
    const validRates = workRates.filter(v => v > 0)
    const minRate = validRates.length ? Math.min(...validRates) : 0
    const minHour = workRates.findIndex(v => v === minRate) + 6

    const avgFocus   = conditionLogs.reduce((s, c) => s + c.focus,   0) / conditionLogs.length
    const avgMood    = conditionLogs.reduce((s, c) => s + c.mood,    0) / conditionLogs.length
    const avgFatigue = conditionLogs.reduce((s, c) => s + c.fatigue, 0) / conditionLogs.length

    return {
      highFocusDays: highFocus.length, lowFocusDays: lowFocus.length,
      highExec, lowExec, execDiff: highExec - lowExec,
      minHour, minRate, avgFocus, avgMood, avgFatigue,
    }
  }, [conditionLogs, blocksByDate])

  if (!analysis) {
    return (
      <div className="bg-secondary/10 rounded-xl p-3 border border-border/10 text-center py-5">
        <Lightbulb className="w-6 h-6 mx-auto mb-2 opacity-30" />
        <p className="text-xs text-muted-foreground">3일 이상 기록하면 패턴 분석이 시작돼요</p>
      </div>
    )
  }

  const sc = (v: number, rev = false) =>
    rev ? (v >= 4 ? "text-red-400"   : v <= 2 ? "text-green-500" : "text-yellow-400")
        : (v >= 4 ? "text-green-500" : v <= 2 ? "text-red-400"   : "text-yellow-400")

  return (
    <div className="space-y-2.5">
      {/* 평균 요약 */}
      <div className="bg-secondary/10 rounded-xl p-3 border border-border/10">
        <h4 className="text-xs font-semibold mb-2">📈 평균 컨디션 ({conditionLogs.length}일)</h4>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "집중도", v: analysis.avgFocus,   rev: false, e: "🎯" },
            { label: "기분",   v: analysis.avgMood,    rev: false, e: "😊" },
            { label: "피로",   v: analysis.avgFatigue, rev: true,  e: "😴" },
          ].map(item => (
            <div key={item.label} className="text-center bg-background/40 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground">{item.e} {item.label}</p>
              <p className={`text-lg font-bold ${sc(item.v, item.rev)}`}>{item.v.toFixed(1)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 집중도-실행 상관 */}
      {analysis.highFocusDays > 0 && analysis.lowFocusDays > 0 && (
        <div className="bg-secondary/10 rounded-xl p-3 border border-border/10">
          <h4 className="text-xs font-semibold mb-2">🔗 집중도 ↔ 실행 상관</h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">집중 높은 날 ({analysis.highFocusDays}일)</span>
              <span className="text-xs font-semibold text-green-500">{Math.floor(analysis.highExec/60)}h {analysis.highExec%60}m</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">집중 낮은 날 ({analysis.lowFocusDays}일)</span>
              <span className="text-xs font-semibold text-red-400">{Math.floor(analysis.lowExec/60)}h {analysis.lowExec%60}m</span>
            </div>
            <div className="flex items-center gap-1.5 pt-1 border-t border-border/20">
              {analysis.execDiff > 0 ? <TrendingUp  className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                : analysis.execDiff < 0 ? <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                : <Minus className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
              <p className="text-[10px] text-muted-foreground">
                집중 높은 날{" "}
                <span className={analysis.execDiff >= 0 ? "text-green-500 font-semibold" : "text-red-400 font-semibold"}>
                  {Math.abs(analysis.execDiff)}분 {analysis.execDiff >= 0 ? "더 많음" : "더 적음"}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 자동 추천 */}
      <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
        <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">💡 자동 추천</h4>
        <div className="space-y-1">
          {analysis.minRate < 0.3 && (
            <p className="text-[11px] text-muted-foreground">
              📉 <span className="font-medium">{analysis.minHour}~{analysis.minHour + 1}시</span>에 실행률이 낮아요.
            </p>
          )}
          {analysis.avgFatigue >= 3.5 && <p className="text-[11px] text-muted-foreground">😴 평균 피로도가 높아요. 수면을 30분 늘려보세요.</p>}
          {analysis.avgFocus < 2.5    && <p className="text-[11px] text-muted-foreground">🎯 집중도가 낮아요. 오전에 집중 블록을 배치해 보세요.</p>}
          {analysis.avgFocus >= 4 && analysis.avgFatigue <= 2 && <p className="text-[11px] text-muted-foreground">✨ 컨디션 최상이에요!</p>}
          {analysis.avgFocus >= 2.5 && analysis.avgFatigue < 3.5 && analysis.minRate >= 0.3 && (
            <p className="text-[11px] text-muted-foreground">📊 데이터가 쌓일수록 더 정확한 추천을 드릴게요.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── draft 타입 / 헬퍼 ─────────────────────────────────────────────────────
type ConditionDraft = {
  focus:   1|2|3|4|5|undefined
  mood:    1|2|3|4|5|undefined
  fatigue: 1|2|3|4|5|undefined
  note:    string
}
const emptyDraft = (): ConditionDraft => ({ focus: undefined, mood: undefined, fatigue: undefined, note: "" })
const logToDraft = (log: DailyCondition | undefined): ConditionDraft =>
  log ? { focus: log.focus, mood: log.mood, fatigue: log.fatigue, note: log.note || "" } : emptyDraft()

// ── 통계 탭 전체 뷰 ──────────────────────────────────────────────────────
export function ConditionView() {
  const { selectedDate, conditionLogs, blocksByDate } = usePlannerStore()
  const todayISO = formatDateISO(selectedDate)
  const todayLog = conditionLogs.find(c => c.dateISO === todayISO)

  const weekDates = useMemo(() => {
    const base = new Date(selectedDate)
    const sun  = new Date(base); sun.setDate(sun.getDate() - sun.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sun); d.setDate(d.getDate() + i); return formatDateISO(d)
    })
  }, [selectedDate])

  return (
    <div className="space-y-4">
      {/* 오늘 컨디션 (읽기 전용 — 일 그리드에서 기록) */}
      <div className="bg-secondary/10 rounded-xl p-3 border border-border/10 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold">오늘 컨디션</h4>
          <span className="text-[10px] text-muted-foreground">{todayISO}</span>
        </div>
        {todayLog ? (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "집중도", emoji: FOCUS_EMOJIS[todayLog.focus], value: todayLog.focus },
              { label: "기분", emoji: MOOD_EMOJIS[todayLog.mood], value: todayLog.mood },
              { label: "피로", emoji: FATIGUE_EMOJIS[todayLog.fatigue], value: todayLog.fatigue },
            ].map(item => (
              <div key={item.label} className="text-center bg-background/40 rounded-xl p-2.5 border border-border/10">
                <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                <p className="text-2xl leading-none">{item.emoji}</p>
                <p className="text-[10px] font-semibold text-foreground mt-1">{item.value} / 5</p>
              </div>
            ))}
            {todayLog.note && (
              <div className="col-span-3 text-[11px] text-muted-foreground bg-background/30 rounded-lg px-3 py-2 border border-border/10">
                💬 {todayLog.note}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-2xl mb-1 opacity-30">📊</p>
            <p className="text-xs text-muted-foreground">오늘 컨디션을 아직 기록하지 않았어요</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">일(타임라인) 화면에서 기록해보세요</p>
          </div>
        )}
      </div>

      {/* 이번 주 히스토리 */}
      <div className="bg-secondary/10 rounded-xl p-3 border border-border/10">
        <h4 className="text-xs font-semibold mb-2.5">이번 주 컨디션</h4>
        <div className="flex gap-1">
          {weekDates.map((d, i) => {
            const log     = conditionLogs.find(c => c.dateISO === d)
            const isToday = d === todayISO
            const avg     = log ? (log.focus + log.mood + (6 - log.fatigue)) / 3 : 0
            const color   = log ? (avg >= 4 ? "#22c55e" : avg >= 2.5 ? "#eab308" : "#f87171") : undefined
            return (
              <div key={d} className="flex-1 flex flex-col items-center gap-1">
                <span className={`text-[10px] ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                  {["일","월","화","수","목","금","토"][i]}
                </span>
                <div className={`w-full aspect-square rounded-lg border flex items-center justify-center transition-all ${isToday ? "border-primary/50" : "border-border/20"}`}
                  style={{ backgroundColor: color ? `${color}33` : "transparent", borderColor: color ? `${color}66` : undefined }}>
                  {log
                    ? <span className="text-base leading-none">{getConditionEmoji(log)}</span>
                    : <span className="text-[10px] text-muted-foreground/40">—</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 생리 주기 트래커 */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold">🩸 생리 주기 트래커</h4>
        <PmsCycleSection />
      </div>

      {/* 패턴 분석 */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold">🔍 패턴 분석 &amp; 추천</h4>
        <CorrelationCard conditionLogs={conditionLogs} blocksByDate={blocksByDate} />
      </div>
    </div>
  )
}

// ── 홈 화면용 컴팩트 패널 ─────────────────────────────────────────────────
export function ConditionHomePanel({ onClose }: { onClose: () => void }) {
  const { selectedDate, conditionLogs, setCondition } = usePlannerStore()
  const todayISO = formatDateISO(selectedDate)
  const todayLog = conditionLogs.find(c => c.dateISO === todayISO)
  const [draft, setDraft] = useState<ConditionDraft>(() => logToDraft(todayLog))

  const canSave = draft.focus !== undefined && draft.mood !== undefined && draft.fatigue !== undefined

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold">오늘 컨디션은?</h3>
        <button onClick={onClose}
          className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
          ✕
        </button>
      </div>
      <EmojiRow label="🎯 집중도" emojis={FOCUS_EMOJIS}   value={draft.focus}   onChange={v => setDraft(d => ({ ...d, focus: v }))} />
      <EmojiRow label="😊 기분"   emojis={MOOD_EMOJIS}    value={draft.mood}    onChange={v => setDraft(d => ({ ...d, mood: v }))} />
      <EmojiRow label="😴 피로"   emojis={FATIGUE_EMOJIS} value={draft.fatigue} onChange={v => setDraft(d => ({ ...d, fatigue: v }))} />
      <Button className="w-full h-9 rounded-xl text-sm font-semibold" disabled={!canSave}
        onClick={() => {
          if (!canSave) return
          setCondition(todayISO, { focus: draft.focus!, mood: draft.mood!, fatigue: draft.fatigue! })
          onClose()
        }}>
        저장
      </Button>
    </div>
  )
}
