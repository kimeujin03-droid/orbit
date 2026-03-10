"use client"

import { useMemo } from "react"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import { TrendingUp, TrendingDown, Minus, Clock } from "lucide-react"

interface ActivityTimeStats {
  activityId: string
  activityName: string
  color: string
  totalMin: number
  percentage: number
  trend: "up" | "down" | "stable" // 지난 기간 대비
  trendPercent: number
}

// 활동별 투자 시간 분석
export function ActivityTimeAnalysis({ 
  startDate,
  endDate,
  compareWithPrevious = true 
}: { 
  startDate: Date
  endDate: Date
  compareWithPrevious?: boolean
}) {
  const { blocksByDate, activities } = usePlannerStore()
  
  const analysis = useMemo(() => {
    // 기간 내 모든 날짜 생성
    const dates: string[] = []
    const current = new Date(startDate)
    while (current <= endDate) {
      dates.push(formatDateISO(current))
      current.setDate(current.getDate() + 1)
    }
    
    // 활동별 시간 집계
    const activityTimes: Record<string, number> = {}
    let totalMinutes = 0
    
    dates.forEach(dateISO => {
      const blocks = blocksByDate[dateISO] || []
      blocks
        .filter(b => b.layer === "execute") // 실행한 것만
        .forEach(block => {
          const duration = block.endMin - block.startMin
          activityTimes[block.activityId] = (activityTimes[block.activityId] || 0) + duration
          totalMinutes += duration
        })
    })
    
    // 이전 기간과 비교 (선택적)
    let previousActivityTimes: Record<string, number> = {}
    if (compareWithPrevious) {
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const prevStart = new Date(startDate)
      prevStart.setDate(prevStart.getDate() - daysDiff)
      const prevEnd = new Date(startDate)
      prevEnd.setDate(prevEnd.getDate() - 1)
      
      const prevDates: string[] = []
      const curr = new Date(prevStart)
      while (curr <= prevEnd) {
        prevDates.push(formatDateISO(curr))
        curr.setDate(curr.getDate() + 1)
      }
      
      prevDates.forEach(dateISO => {
        const blocks = blocksByDate[dateISO] || []
        blocks
          .filter(b => b.layer === "execute")
          .forEach(block => {
            const duration = block.endMin - block.startMin
            previousActivityTimes[block.activityId] = (previousActivityTimes[block.activityId] || 0) + duration
          })
      })
    }
    
    // 통계 생성
    const stats: ActivityTimeStats[] = Object.entries(activityTimes)
      .map(([activityId, totalMin]) => {
        const activity = activities.find(a => a.id === activityId)
        const prevMin = previousActivityTimes[activityId] || 0
        
        let trend: "up" | "down" | "stable" = "stable"
        let trendPercent = 0
        
        if (compareWithPrevious && prevMin > 0) {
          const diff = totalMin - prevMin
          trendPercent = Math.round((diff / prevMin) * 100)
          
          if (trendPercent > 10) trend = "up"
          else if (trendPercent < -10) trend = "down"
        }
        
        return {
          activityId,
          activityName: activity?.name || "알 수 없음",
          color: activity?.color || "#6B7280",
          totalMin,
          percentage: totalMinutes > 0 ? Math.round((totalMin / totalMinutes) * 100) : 0,
          trend,
          trendPercent
        }
      })
      .sort((a, b) => b.totalMin - a.totalMin)
    
    return {
      stats,
      totalMinutes,
      totalHours: Math.floor(totalMinutes / 60),
      totalRemainMin: totalMinutes % 60
    }
  }, [startDate, endDate, blocksByDate, activities, compareWithPrevious])
  
  const TrendIcon = (trend: "up" | "down" | "stable") => {
    if (trend === "up") return <TrendingUp className="w-3 h-3 text-green-500" />
    if (trend === "down") return <TrendingDown className="w-3 h-3 text-red-500" />
    return <Minus className="w-3 h-3 text-muted-foreground" />
  }
  
  return (
    <div className="bg-background rounded-2xl border border-border/20 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">활동별 투자 시간</h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span className="tabular-nums">
            {analysis.totalHours}h {analysis.totalRemainMin > 0 && `${analysis.totalRemainMin}m`}
          </span>
        </div>
      </div>
      
      {/* 기간 표시 */}
      <div className="text-xs text-muted-foreground mb-3 text-center">
        {startDate.getMonth() + 1}월 {startDate.getDate()}일 ~ {endDate.getMonth() + 1}월 {endDate.getDate()}일
      </div>
      
      {/* 활동 목록 */}
      {analysis.stats.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          이 기간에 기록된 활동이 없어요
        </div>
      ) : (
        <div className="space-y-3">
          {analysis.stats.map((stat, idx) => {
            const hours = Math.floor(stat.totalMin / 60)
            const mins = stat.totalMin % 60
            
            return (
              <div key={stat.activityId} className="space-y-2">
                {/* 활동 정보 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-muted-foreground w-4">
                      {idx + 1}
                    </span>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stat.color }}
                    />
                    <span className="text-sm font-medium truncate">
                      {stat.activityName}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* 트렌드 */}
                    {compareWithPrevious && stat.trend !== "stable" && (
                      <div className="flex items-center gap-0.5">
                        {TrendIcon(stat.trend)}
                        <span className={`text-xs tabular-nums ${
                          stat.trend === "up" ? "text-green-500" : "text-red-500"
                        }`}>
                          {stat.trendPercent > 0 ? "+" : ""}{stat.trendPercent}%
                        </span>
                      </div>
                    )}
                    
                    {/* 시간 */}
                    <span className="text-sm font-semibold tabular-nums min-w-[80px] text-right">
                      {hours}h {mins > 0 && `${mins}m`}
                    </span>
                  </div>
                </div>
                
                {/* 진행 바 */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${stat.percentage}%`,
                        backgroundColor: stat.color
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                    {stat.percentage}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      {/* 인사이트 */}
      {analysis.stats.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/10 space-y-2">
          <div className="text-xs text-muted-foreground">
            💡 가장 많이 한 활동: <span className="font-medium text-foreground">{analysis.stats[0].activityName}</span>
          </div>
          
          {compareWithPrevious && analysis.stats.some(s => s.trend === "up") && (
            <div className="text-xs text-green-500">
              📈 증가한 활동: {analysis.stats.filter(s => s.trend === "up").map(s => s.activityName).join(", ")}
            </div>
          )}
          
          {compareWithPrevious && analysis.stats.some(s => s.trend === "down") && (
            <div className="text-xs text-orange-500">
              📉 감소한 활동: {analysis.stats.filter(s => s.trend === "down").map(s => s.activityName).join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 월간 비교 버전
export function MonthlyActivityComparison() {
  const now = new Date()
  
  // 이번 달
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  
  return (
    <ActivityTimeAnalysis
      startDate={thisMonthStart}
      endDate={thisMonthEnd}
      compareWithPrevious={true}
    />
  )
}

// 주간 비교 버전
export function WeeklyActivityComparison() {
  const now = new Date()
  const dayOfWeek = now.getDay()
  
  // 이번 주 (일요일 시작)
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek)
  const weekEnd = new Date(now)
  
  return (
    <ActivityTimeAnalysis
      startDate={weekStart}
      endDate={weekEnd}
      compareWithPrevious={true}
    />
  )
}
