"use client"

import { useMemo } from "react"
import { usePlannerStore } from "@/lib/store"
import { Moon, Zap, TrendingUp } from "lucide-react"

interface SleepProductivityData {
  sleepHours: number // 수면 시간 (소수점)
  avgFocus: number // 평균 집중도
  avgMood: number // 평균 기분
  totalWorkMin: number // 총 작업 시간
  dates: string[] // 해당 날짜들
}

// 수면-생산성 분석
export function SleepProductivityAnalysis({ days = 30 }: { days?: number }) {
  const { wakeUpByDate, sleepByDate, focusSlots, conditionLogs, blocksByDate } = usePlannerStore()
  
  const analysis = useMemo(() => {
    // 최근 N일 데이터
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffISO = cutoffDate.toISOString().slice(0, 10)
    
    // 수면 시간대별 그룹화 (4-5h, 5-6h, 6-7h, 7-8h, 8-9h, 9+h)
    const groups: Record<string, SleepProductivityData> = {
      "4-5h": { sleepHours: 4.5, avgFocus: 0, avgMood: 0, totalWorkMin: 0, dates: [] },
      "5-6h": { sleepHours: 5.5, avgFocus: 0, avgMood: 0, totalWorkMin: 0, dates: [] },
      "6-7h": { sleepHours: 6.5, avgFocus: 0, avgMood: 0, totalWorkMin: 0, dates: [] },
      "7-8h": { sleepHours: 7.5, avgFocus: 0, avgMood: 0, totalWorkMin: 0, dates: [] },
      "8-9h": { sleepHours: 8.5, avgFocus: 0, avgMood: 0, totalWorkMin: 0, dates: [] },
      "9+h": { sleepHours: 9.5, avgFocus: 0, avgMood: 0, totalWorkMin: 0, dates: [] }
    }
    
    // 각 날짜 분석
    Object.keys(wakeUpByDate).forEach(dateISO => {
      if (dateISO < cutoffISO) return
      
      const wakeUp = wakeUpByDate[dateISO]
      const sleep = sleepByDate[dateISO]
      
      if (!wakeUp || !sleep) return
      
      // 수면 시간 계산 (분 단위)
      const sleepMin = wakeUp - sleep
      if (sleepMin < 0 || sleepMin > 1440) return // 비정상 값 제외
      
      const sleepHours = sleepMin / 60
      
      // 그룹 결정
      let group = "9+h"
      if (sleepHours < 5) group = "4-5h"
      else if (sleepHours < 6) group = "5-6h"
      else if (sleepHours < 7) group = "6-7h"
      else if (sleepHours < 8) group = "7-8h"
      else if (sleepHours < 9) group = "8-9h"
      
      // 해당 날짜의 집중도
      const dayFocusSlots = focusSlots.filter(s => s.dateISO === dateISO && s.level > 0)
      const avgFocus = dayFocusSlots.length > 0
        ? dayFocusSlots.reduce((sum, s) => sum + s.level, 0) / dayFocusSlots.length
        : 0
      
      // 해당 날짜의 기분
      const dayCondition = conditionLogs.find(c => c.dateISO === dateISO)
      const avgMood = dayCondition?.mood || 0
      
      // 해당 날짜의 작업 시간
      const dayBlocks = blocksByDate[dateISO] || []
      const workMin = dayBlocks
        .filter(b => b.layer === "execute")
        .reduce((sum, b) => sum + (b.endMin - b.startMin), 0)
      
      // 그룹에 추가
      groups[group].avgFocus += avgFocus
      groups[group].avgMood += avgMood
      groups[group].totalWorkMin += workMin
      groups[group].dates.push(dateISO)
    })
    
    // 평균 계산
    Object.values(groups).forEach(group => {
      const count = group.dates.length
      if (count > 0) {
        group.avgFocus = group.avgFocus / count
        group.avgMood = group.avgMood / count
      }
    })
    
    // 유효한 그룹만 (데이터 있는 것)
    const validGroups = Object.entries(groups)
      .filter(([_, data]) => data.dates.length > 0)
      .map(([label, data]) => ({ label, ...data }))
    
    // 최적 수면 시간 찾기
    const bestGroup = validGroups.reduce((best, current) => {
      const bestScore = best.avgFocus + best.avgMood
      const currentScore = current.avgFocus + current.avgMood
      return currentScore > bestScore ? current : best
    }, validGroups[0])
    
    return {
      groups: validGroups,
      bestGroup,
      hasData: validGroups.length > 0
    }
  }, [days, wakeUpByDate, sleepByDate, focusSlots, conditionLogs, blocksByDate])
  
  if (!analysis.hasData) {
    return (
      <div className="bg-background rounded-2xl border border-border/20 p-4 text-center">
        <Moon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          수면 기록이 부족해요
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          기상/취침 시간을 기록하면 분석할 수 있어요
        </p>
      </div>
    )
  }
  
  return (
    <div className="bg-background rounded-2xl border border-border/20 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">수면과 생산성</h3>
        </div>
        <span className="text-xs text-muted-foreground">최근 {days}일</span>
      </div>
      
      {/* 최적 수면 시간 */}
      {analysis.bestGroup && (
        <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl p-3 mb-4 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-semibold">최고 컨디션</span>
          </div>
          <div className="text-2xl font-bold text-primary mb-1">
            {analysis.bestGroup.label} 수면
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">평균 집중도</span>
              <div className="font-semibold text-primary">
                {analysis.bestGroup.avgFocus.toFixed(1)}/5
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">평균 기분</span>
              <div className="font-semibold text-primary">
                {analysis.bestGroup.avgMood.toFixed(1)}/5
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {analysis.bestGroup.dates.length}일 기록됨
          </div>
        </div>
      )}
      
      {/* 수면 시간대별 통계 */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          수면 시간대별 분석
        </div>
        
        {analysis.groups.map(group => {
          const isBest = group.label === analysis.bestGroup?.label
          const totalScore = group.avgFocus + group.avgMood
          const maxScore = 10 // 5 + 5
          const scorePercent = Math.round((totalScore / maxScore) * 100)
          
          return (
            <div
              key={group.label}
              className={`
                rounded-xl p-3 border transition-all
                ${isBest 
                  ? 'bg-primary/5 border-primary/30' 
                  : 'bg-muted/20 border-border/10'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Moon className={`w-3.5 h-3.5 ${isBest ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${isBest ? 'text-primary' : ''}`}>
                    {group.label}
                  </span>
                  {isBest && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      최적
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {group.dates.length}일
                </span>
              </div>
              
              {/* 점수 바 */}
              <div className="mb-2">
                <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isBest ? 'bg-gradient-to-r from-primary to-purple-500' : 'bg-muted-foreground'
                    }`}
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
              </div>
              
              {/* 상세 지표 */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">집중도</div>
                  <div className="font-semibold tabular-nums">
                    {group.avgFocus.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">기분</div>
                  <div className="font-semibold tabular-nums">
                    {group.avgMood.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">작업</div>
                  <div className="font-semibold tabular-nums">
                    {Math.floor(group.totalWorkMin / group.dates.length / 60)}h
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* 인사이트 */}
      <div className="mt-4 pt-3 border-t border-border/10 text-xs text-muted-foreground space-y-1">
        <div>
          💡 {analysis.bestGroup.label} 수면 시 가장 좋은 컨디션을 보여요
        </div>
        {analysis.groups.some(g => g.sleepHours < 6) && (
          <div className="text-orange-500">
            ⚠️ 6시간 미만 수면은 생산성이 낮아질 수 있어요
          </div>
        )}
      </div>
    </div>
  )
}
