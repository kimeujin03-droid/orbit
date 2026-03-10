"use client"

import { useMemo } from "react"
import { usePlannerStore } from "@/lib/store"
import { Brain, TrendingUp } from "lucide-react"

// 집중 시간 최적화 분석
export function FocusTimeAnalysis({ days = 7 }: { days?: number }) {
  const { focusSlots } = usePlannerStore()
  
  const analysis = useMemo(() => {
    // 최근 N일 데이터 필터
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffISO = cutoffDate.toISOString().slice(0, 10)
    
    const recentSlots = focusSlots.filter(s => s.dateISO >= cutoffISO && s.level > 0)
    
    if (recentSlots.length === 0) {
      return null
    }
    
    // 시간대별 집중도 집계 (24시간)
    const hourlyFocus: Record<number, { total: number; count: number }> = {}
    
    recentSlots.forEach(slot => {
      const hour = Math.floor(slot.slotIndex / 6) // 10분 슬롯 → 시간
      if (!hourlyFocus[hour]) {
        hourlyFocus[hour] = { total: 0, count: 0 }
      }
      hourlyFocus[hour].total += slot.level
      hourlyFocus[hour].count += 1
    })
    
    // 평균 계산
    const hourlyAvg = Object.entries(hourlyFocus).map(([hour, data]) => ({
      hour: parseInt(hour),
      avgFocus: data.total / data.count
    }))
    
    // 집중도 높은 시간대 TOP 3
    const topHours = hourlyAvg
      .sort((a, b) => b.avgFocus - a.avgFocus)
      .slice(0, 3)
    
    // 집중도 낮은 시간대 TOP 3
    const worstHours = hourlyAvg
      .sort((a, b) => a.avgFocus - b.avgFocus)
      .slice(0, 3)
    
    // 전체 평균
    const overallAvg = recentSlots.reduce((sum, s) => sum + s.level, 0) / recentSlots.length
    
    return {
      topHours,
      worstHours,
      overallAvg,
      totalSessions: recentSlots.length
    }
  }, [focusSlots, days])
  
  if (!analysis) {
    return (
      <div className="bg-background rounded-2xl border border-border/20 p-4 text-center">
        <Brain className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          최근 {days}일간 집중도 기록이 없어요
        </p>
      </div>
    )
  }
  
  return (
    <div className="bg-background rounded-2xl border border-border/20 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">나의 집중 패턴</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          최근 {days}일
        </div>
      </div>
      
      {/* 전체 평균 */}
      <div className="bg-gradient-to-r from-primary/10 to-transparent rounded-xl p-3 mb-4">
        <div className="text-xs text-muted-foreground mb-1">평균 집중도</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-primary tabular-nums">
            {analysis.overallAvg.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">/ 5.0</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          총 {analysis.totalSessions}개 세션 기록
        </div>
      </div>
      
      {/* 집중 잘되는 시간 */}
      <div className="mb-4">
        <div className="flex items-center gap-1 mb-2">
          <TrendingUp className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs font-medium text-green-500">집중 잘되는 시간</span>
        </div>
        <div className="space-y-2">
          {analysis.topHours.map((item, idx) => (
            <div key={item.hour} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4">
                  {idx + 1}.
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {item.hour.toString().padStart(2, '0')}:00 ~ {(item.hour + 1).toString().padStart(2, '0')}:00
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-12 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500"
                    style={{ width: `${(item.avgFocus / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-green-500 tabular-nums w-8 text-right">
                  {item.avgFocus.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 집중 안되는 시간 */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs font-medium text-orange-500">⚠️ 집중 어려운 시간</span>
        </div>
        <div className="space-y-2">
          {analysis.worstHours.map((item, idx) => (
            <div key={item.hour} className="flex items-center justify-between opacity-70">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4">
                  {idx + 1}.
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {item.hour.toString().padStart(2, '0')}:00 ~ {(item.hour + 1).toString().padStart(2, '0')}:00
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-12 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500"
                    style={{ width: `${(item.avgFocus / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-orange-500 tabular-nums w-8 text-right">
                  {item.avgFocus.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 팁 */}
      <div className="mt-4 pt-3 border-t border-border/10">
        <p className="text-xs text-muted-foreground">
          💡 중요한 작업은 {analysis.topHours[0].hour}시~{analysis.topHours[0].hour + 1}시에 배치하는 게 좋아요!
        </p>
      </div>
    </div>
  )
}
