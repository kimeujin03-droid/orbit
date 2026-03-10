"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import { BudgetView } from "./budget-view"
import { ConditionView } from "./condition-view"
import { ConsumableView } from "./consumable-view"
import { LogEntryView } from "./log-entry-view"
import { WeeklyActivityComparison } from "./activity-time-analysis"
import { PlaceView } from "./place-view"

type StatsRange = "week" | "month"
type StatsTab = "activity" | "budget" | "condition" | "log" | "place"

// 간단한 바 차트 컴포넌트
function HorizontalBar({ label, value, max, color, suffix = "분" }: {
  label: string; value: number; max: number; color: string; suffix?: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  const hours = Math.floor(value / 60)
  const mins = value % 60
  const display = suffix === "분"
    ? (hours > 0 ? `${hours}h ${mins}m` : `${mins}m`)
    : `${value}${suffix}`

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground w-14 truncate text-right">{label}</span>
      <div className="flex-1 h-5 bg-secondary/30 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-foreground font-medium w-14 text-right">{display}</span>
    </div>
  )
}

// 미니 히트맵 (7일 or 30일)
function MiniHeatmap({ data, colors }: { data: { date: string; minutes: number }[]; colors: string }) {
  const maxMin = Math.max(...data.map(d => d.minutes), 1)
  return (
    <div className="flex gap-0.5 flex-wrap">
      {data.map((d, i) => {
        const intensity = d.minutes / maxMin
        const opacity = Math.max(0.1, intensity)
        const dayLabel = new Date(d.date).getDate()
        return (
          <div key={i} className="relative group">
            <div
              className="w-[18px] h-[18px] rounded-[3px] transition-all"
              style={{ backgroundColor: colors, opacity }}
            />
            <span className="text-[7px] text-muted-foreground absolute inset-0 flex items-center justify-center pointer-events-none">
              {dayLabel}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// 달성률 도넛 차트
function DonutChart({ percentage, size = 80, strokeWidth = 8, color }: {
  percentage: number; size?: number; strokeWidth?: number; color: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(percentage, 100) / 100)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" strokeWidth={strokeWidth}
          className="text-secondary/40" stroke="currentColor" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" strokeWidth={strokeWidth}
          stroke={color} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{Math.round(percentage)}%</span>
      </div>
    </div>
  )
}

export function StatsView() {
  const {
    activities, blocksByDate, selectedDate, stepsByDate, wakeUpByDate, sleepByDate,
    logEntries,
  } = usePlannerStore()
  const [range, setRange] = useState<StatsRange>("week")
  const [offset, setOffset] = useState(0)
  const [tab, setTab] = useState<StatsTab>("activity")

  const todayISO = formatDateISO(selectedDate)

  // 날짜 범위 계산
  const dateRange = useMemo(() => {
    const base = new Date(selectedDate)
    const dates: string[] = []

    if (range === "week") {
      const sunday = new Date(base)
      sunday.setDate(sunday.getDate() - sunday.getDay() + offset * 7)
      for (let i = 0; i < 7; i++) {
        const d = new Date(sunday)
        d.setDate(d.getDate() + i)
        dates.push(formatDateISO(d))
      }
    } else {
      const y = base.getFullYear()
      const m = base.getMonth() + offset
      const firstDay = new Date(y, m, 1)
      const lastDay = new Date(y, m + 1, 0)
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const dt = new Date(firstDay)
        dt.setDate(d)
        dates.push(formatDateISO(dt))
      }
    }
    return dates
  }, [selectedDate, range, offset])

  // 범위 라벨
  const rangeLabel = useMemo(() => {
    if (dateRange.length === 0) return ""
    const first = new Date(dateRange[0])
    const last = new Date(dateRange[dateRange.length - 1])
    if (range === "week") {
      const m1 = first.getMonth() + 1
      const d1 = first.getDate()
      const m2 = last.getMonth() + 1
      const d2 = last.getDate()
      return `${m1}/${d1} ~ ${m2}/${d2}`
    } else {
      return `${first.getFullYear()}년 ${first.getMonth() + 1}월`
    }
  }, [dateRange, range])

  // 활동별 총 시간 집계
  const activityStats = useMemo(() => {
    const map = new Map<string, { planMin: number; execMin: number }>()

    for (const dateISO of dateRange) {
      const blocks = blocksByDate[dateISO] || []
      for (const b of blocks) {
        const dur = b.endMin - b.startMin
        if (!map.has(b.activityId)) map.set(b.activityId, { planMin: 0, execMin: 0 })
        const entry = map.get(b.activityId)!
        if (b.layer === "plan") entry.planMin += dur
        else if (b.layer === "execute") entry.execMin += dur
      }
    }

    return [...map.entries()]
      .map(([actId, data]) => {
        const act = activities.find(a => a.id === actId)
        return {
          activityId: actId,
          name: act?.name || actId,
          color: act?.color || "#888",
          ...data,
        }
      })
      .sort((a, b) => b.execMin - a.execMin)
  }, [dateRange, blocksByDate, activities])

  // 총 시간
  const totalExecMin = activityStats.reduce((s, a) => s + a.execMin, 0)
  const totalPlanMin = activityStats.reduce((s, a) => s + a.planMin, 0)
  const maxActivityMin = Math.max(...activityStats.map(a => a.execMin), 1)

  // 달성률 (plan 대비 execute)
  const achievementRate = totalPlanMin > 0 ? (totalExecMin / totalPlanMin) * 100 : 0

  // 일별 데이터 (히트맵용)
  const dailyData = useMemo(() => {
    return dateRange.map(dateISO => {
      const blocks = blocksByDate[dateISO] || []
      const minutes = blocks
        .filter(b => b.layer === "execute")
        .reduce((s, b) => s + (b.endMin - b.startMin), 0)
      return { date: dateISO, minutes }
    })
  }, [dateRange, blocksByDate])

  // 일 평균
  const avgMinPerDay = dateRange.length > 0 ? Math.round(totalExecMin / dateRange.length) : 0

  // 스트릭 계산 (연속 기록 일수)
  const streak = useMemo(() => {
    const allDates = Object.keys(blocksByDate)
      .filter(d => (blocksByDate[d] || []).some(b => b.layer === "execute"))
      .sort()

    if (allDates.length === 0) return { current: 0, longest: 0 }

    // 오늘부터 역순으로 연속일 계산
    const today = formatDateISO(selectedDate)
    let current = 0
    let cursor = today
    while (allDates.includes(cursor)) {
      current++
      const prev = new Date(cursor)
      prev.setDate(prev.getDate() - 1)
      cursor = formatDateISO(prev)
    }

    // 최장 스트릭 계산
    let longest = current
    let streak = 1
    for (let i = 1; i < allDates.length; i++) {
      const prev = new Date(allDates[i - 1])
      prev.setDate(prev.getDate() + 1)
      if (formatDateISO(prev) === allDates[i]) {
        streak++
        longest = Math.max(longest, streak)
      } else {
        streak = 1
      }
    }

    return { current, longest }
  }, [blocksByDate, selectedDate])

  // ── 회고 재료 계산 ────────────────────────────────────────────────────────
  const retrospectData = useMemo(() => {
    const rangeEntries = logEntries.filter(e => dateRange.includes(e.dateISO))

    // 감정 평균
    const moodList = rangeEntries.filter(e => e.mood).map(e => e.mood!)
    const avgMood = moodList.length > 0
      ? moodList.reduce((s, v) => s + v, 0) / moodList.length
      : undefined

    // 자주 등장한 태그 top 5
    const tagCount = new Map<string, number>()
    for (const e of rangeEntries) {
      for (const t of e.tags) {
        tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
      }
    }
    const topTags = [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }))

    // 콘텐츠 기록
    const contents = rangeEntries
      .filter(e => e.type === "content")
      .map(e => ({
        title: e.title ?? "?",
        kind: (e.meta?.contentKind as string) ?? "other",
      }))

    // 하이라이트
    const highlights = rangeEntries.filter(e => e.isHighlight)

    // 가장 기록 많은 날
    const perDay = new Map<string, number>()
    for (const e of rangeEntries) {
      perDay.set(e.dateISO, (perDay.get(e.dateISO) ?? 0) + 1)
    }
    const busiestDay = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0]

    return { avgMood, topTags, contents, highlights, busiestDay }
  }, [logEntries, dateRange])

  // 데이터 내보내기
  const handleExport = () => {
    const exportData = {
      range: rangeLabel,
      dates: dateRange,
      totalExecuteMinutes: totalExecMin,
      totalPlanMinutes: totalPlanMin,
      achievementRate: Math.round(achievementRate),
      activities: activityStats.map(a => ({
        name: a.name,
        planMinutes: a.planMin,
        executeMinutes: a.execMin,
      })),
      daily: dailyData,
      steps: dateRange.map(d => ({ date: d, steps: stepsByDate[d] || 0 })),
      wakeUp: dateRange.map(d => ({ date: d, min: wakeUpByDate[d] ?? null })),
      sleep: dateRange.map(d => ({ date: d, min: sleepByDate[d] ?? null })),
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `life-log-stats-${dateRange[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-hide">
      <div className="p-4 space-y-3">

        {/* 서브탭 + 내보내기 */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 bg-secondary/40 rounded-xl p-0.5 gap-0.5 overflow-x-auto scrollbar-hide">
            {([
              { id: "activity", label: "활동" },
              { id: "condition", label: "컨디션" },
              { id: "budget", label: "가계부" },
              { id: "log", label: "메모" },
              { id: "place", label: "장소" },
            ] as { id: StatsTab; label: string }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  tab === t.id ? "bg-primary/15 text-primary shadow-sm" : "text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "activity" && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground text-[11px] font-medium hover:bg-secondary/80 transition-colors flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>

      {/* 탭 콘텐츠 */}
      {tab === "condition" ? (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 scrollbar-hide">
          <ConditionView />
          <div className="h-4" />
        </div>
      ) : tab === "budget" ? (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 scrollbar-hide">
          <BudgetView />
          <div className="border-t border-border/30 pt-4">
            <ConsumableView />
          </div>
          <div className="h-4" />
        </div>
      ) : tab === "log" ? (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <LogEntryView />
        </div>
      ) : tab === "place" ? (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <PlaceView />
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex bg-secondary/40 rounded-xl p-0.5 gap-0.5">
            <button
              onClick={() => { setRange("week"); setOffset(0) }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                range === "week" ? "bg-primary/15 text-primary shadow-sm" : "text-muted-foreground"
              }`}
            >
              주간
            </button>
            <button
              onClick={() => { setRange("month"); setOffset(0) }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                range === "month" ? "bg-primary/15 text-primary shadow-sm" : "text-muted-foreground"
              }`}
            >
              월간
            </button>
          </div>
          <div className="flex-1" />
          <button onClick={() => setOffset(o => o - 1)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary/50 transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-xs font-medium text-foreground min-w-[90px] text-center">{rangeLabel}</span>
          <button onClick={() => setOffset(o => o + 1)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary/50 transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-secondary/20 rounded-xl p-3 text-center border border-border/20">
            <p className="text-[9px] text-muted-foreground mb-1">총 실행</p>
            <p className="text-base font-bold">{Math.floor(totalExecMin / 60)}<span className="text-xs font-normal text-muted-foreground">h</span> {totalExecMin % 60}<span className="text-xs font-normal text-muted-foreground">m</span></p>
          </div>
          <div className="bg-secondary/20 rounded-xl p-3 text-center border border-border/20">
            <p className="text-[9px] text-muted-foreground mb-1">일 평균</p>
            <p className="text-base font-bold">{Math.floor(avgMinPerDay / 60)}<span className="text-xs font-normal text-muted-foreground">h</span> {avgMinPerDay % 60}<span className="text-xs font-normal text-muted-foreground">m</span></p>
          </div>
          <div className="bg-secondary/20 rounded-xl p-3 flex flex-col items-center justify-center border border-border/20">
            <p className="text-[9px] text-muted-foreground mb-1">달성률</p>
            <DonutChart percentage={achievementRate} size={50} strokeWidth={5} color="hsl(var(--primary))" />
          </div>
        </div>

        {/* 스트릭 카드 */}
        <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-400/20 rounded-xl p-3 flex items-center gap-3">
          <div className="text-2xl select-none">🔥</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">연속 기록 스트릭</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {streak.current > 0
                ? `${streak.current}일째 기록 중 · 최장 ${streak.longest}일`
                : streak.longest > 0
                  ? `최장 기록 ${streak.longest}일 · 오늘 기록을 시작해보세요!`
                  : "아직 기록이 없어요 · 첫 번째 날을 시작해보세요!"}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-bold text-orange-400">{streak.current}</p>
            <p className="text-[9px] text-muted-foreground">일</p>
          </div>
        </div>

        {/* 활동별 시간 바 차트 */}
        <div className="bg-secondary/10 rounded-xl p-3 border border-border/10 space-y-2">
          <h3 className="text-xs font-semibold text-foreground">활동별 실행 시간</h3>
          {activityStats.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">데이터가 없습니다</p>
          ) : (
            <div className="space-y-1.5">
              {activityStats.map(act => (
                <HorizontalBar
                  key={act.activityId}
                  label={act.name}
                  value={act.execMin}
                  max={maxActivityMin}
                  color={act.color}
                />
              ))}
            </div>
          )}
        </div>

        {/* 계획 vs 실행 비교 */}
        {totalPlanMin > 0 && (() => {
          const delayed = activityStats
            .filter(a => a.planMin > 0 && a.planMin > a.execMin)
            .map(a => ({ ...a, diff: a.planMin - a.execMin }))
            .sort((a, b) => b.diff - a.diff)
            .slice(0, 3)
          const exceeded = activityStats
            .filter(a => a.execMin > a.planMin)
            .map(a => ({ ...a, diff: a.execMin - a.planMin }))
            .sort((a, b) => b.diff - a.diff)
            .slice(0, 3)
          const fmtDiff = (m: number) => {
            const h = Math.floor(m / 60)
            const r = m % 60
            return h > 0 ? (r > 0 ? `${h}h ${r}m` : `${h}h`) : `${r}m`
          }
          return (
            <div className="bg-secondary/10 rounded-xl p-3 border border-border/10 space-y-2">
              <h3 className="text-xs font-semibold text-foreground">계획 vs 실행</h3>
              <div className="space-y-1.5">
                {activityStats.filter(a => a.planMin > 0).map(act => {
                  const rate = act.planMin > 0 ? Math.round((act.execMin / act.planMin) * 100) : 0
                  return (
                    <div key={act.activityId} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: act.color }} />
                      <span className="text-[11px] text-muted-foreground flex-1 truncate">{act.name}</span>
                      <div className="flex gap-1 items-center">
                        <span className="text-[10px] text-muted-foreground">{Math.floor(act.planMin/60)}h{act.planMin%60}m</span>
                        <span className="text-[10px] text-muted-foreground">→</span>
                        <span className="text-[10px] font-medium">{Math.floor(act.execMin/60)}h{act.execMin%60}m</span>
                        <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                          rate >= 100 ? "text-green-400 bg-green-500/10" :
                          rate >= 70 ? "text-yellow-400 bg-yellow-500/10" :
                          "text-red-400 bg-red-500/10"
                        }`}>{rate}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 가장 미룬 활동 */}
              {delayed.length > 0 && (
                <div className="pt-2 border-t border-border/10">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">⏳ 가장 미룬 활동</p>
                  <div className="space-y-1">
                    {delayed.map((act, i) => (
                      <div key={act.activityId} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: act.color }} />
                        <span className="text-[11px] text-muted-foreground flex-1 truncate">{act.name}</span>
                        <span className="text-[10px] font-semibold text-red-400 tabular-nums">-{fmtDiff(act.diff)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 계획보다 더 한 활동 */}
              {exceeded.length > 0 && (
                <div className="pt-2 border-t border-border/10">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">🔥 계획보다 더 한 활동</p>
                  <div className="space-y-1">
                    {exceeded.map((act, i) => (
                      <div key={act.activityId} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: act.color }} />
                        <span className="text-[11px] text-muted-foreground flex-1 truncate">{act.name}</span>
                        <span className="text-[10px] font-semibold text-green-400 tabular-nums">+{fmtDiff(act.diff)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── 회고 재료 섹션 ─────────────────────────────────────────────── */}

        {/* 감정 흐름 + 바쁜 날 */}
        {(retrospectData.avgMood != null || retrospectData.busiestDay) && (
          <div className="grid grid-cols-2 gap-2">
            {retrospectData.avgMood != null && (
              <div className="bg-purple-500/5 border border-purple-400/15 rounded-xl p-3 text-center">
                <p className="text-[9px] text-muted-foreground mb-1">평균 기분</p>
                <p className="text-2xl">{["", "😞", "😕", "😐", "🙂", "😊"][Math.round(retrospectData.avgMood)]}</p>
                <p className="text-[10px] font-medium text-purple-400 mt-0.5">
                  {retrospectData.avgMood.toFixed(1)} / 5
                </p>
              </div>
            )}
            {retrospectData.busiestDay && (
              <div className="bg-blue-500/5 border border-blue-400/15 rounded-xl p-3 text-center">
                <p className="text-[9px] text-muted-foreground mb-1">가장 바빴던 날</p>
                <p className="text-sm font-bold text-blue-400 mt-1">
                  {(() => {
                    const d = new Date(retrospectData.busiestDay[0])
                    return `${d.getMonth() + 1}/${d.getDate()}`
                  })()}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  기록 {retrospectData.busiestDay[1]}개
                </p>
              </div>
            )}
          </div>
        )}

        {/* 자주 등장한 태그 */}
        {retrospectData.topTags.length > 0 && (
          <div className="bg-secondary/10 rounded-xl p-3 border border-border/10 space-y-2">
            <h3 className="text-xs font-semibold text-foreground">자주 등장한 태그</h3>
            <div className="flex flex-wrap gap-1.5">
              {retrospectData.topTags.map(({ tag, count }) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/40 text-xs text-foreground/80"
                >
                  {tag}
                  <span className="text-[9px] text-muted-foreground/60">×{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 콘텐츠 기록 요약 */}
        {retrospectData.contents.length > 0 && (
          <div className="bg-secondary/10 rounded-xl p-3 border border-border/10 space-y-2">
            <h3 className="text-xs font-semibold text-foreground">
              콘텐츠 기록
              <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                {retrospectData.contents.length}편
              </span>
            </h3>
            <div className="space-y-1">
              {retrospectData.contents.slice(0, 5).map((c, i) => {
                const kindEmoji: Record<string, string> = {
                  book: "📖", drama: "📺", movie: "🎬", youtube: "▶️", other: "🎵",
                }
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm">{kindEmoji[c.kind] ?? "🎵"}</span>
                    <span className="text-xs text-foreground/80 truncate">{c.title}</span>
                  </div>
                )
              })}
              {retrospectData.contents.length > 5 && (
                <p className="text-[10px] text-muted-foreground/50">
                  +{retrospectData.contents.length - 5}편 더
                </p>
              )}
            </div>
          </div>
        )}

        {/* 하이라이트 후보 */}
        {retrospectData.highlights.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-400/20 rounded-xl p-3 space-y-2">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-1">
              ⭐ 하이라이트
              <span className="text-[10px] font-normal text-muted-foreground">
                {retrospectData.highlights.length}개
              </span>
            </h3>
            <div className="space-y-1.5">
              {retrospectData.highlights.slice(0, 3).map((e) => (
                <div key={e.id} className="flex items-start gap-2">
                  <span className="text-sm mt-0.5">
                    {e.type === "note" ? "📝" : e.type === "mood" ? "💭" : e.type === "content" ? "🎬" : "💊"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/80 truncate">
                      {e.title ?? e.memo ?? "기록"}
                    </p>
                    <p className="text-[9px] text-muted-foreground/50">{e.dateISO}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 하단 여백 */}
        <div className="h-4" />

        {/* 인사이트 섹션 */}
        <WeeklyActivityComparison />

        <div className="h-8" />
        </div>
      )}
    </div>
  )
}
