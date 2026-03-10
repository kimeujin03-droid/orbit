"use client"

import { useMemo } from "react"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

// 계획 대비 실행 분석
export function PlanVsExecutionWidget({ date }: { date: Date }) {
  const { blocksByDate, activities } = usePlannerStore()
  
  const analysis = useMemo(() => {
    const dateISO = formatDateISO(date)
    const blocks = blocksByDate[dateISO] || []
    
    // 계획(overlay)과 실행(execute) 분리
    const planBlocks = blocks.filter(b => b.layer === "overlay")
    const execBlocks = blocks.filter(b => b.layer === "execute")
    
    // 총 시간 계산 (분 단위)
    const calcTotalMin = (blocks: typeof planBlocks) => {
      return blocks.reduce((sum, b) => sum + (b.endMin - b.startMin), 0)
    }
    
    const planMin = calcTotalMin(planBlocks)
    const execMin = calcTotalMin(execBlocks)
    
    // 달성률
    const completion = planMin > 0 ? Math.round((execMin / planMin) * 100) : 0
    
    // 활동별 분석
    const activityStats: Record<string, { plan: number; exec: number; name: string }> = {}
    
    // 계획 시간
    planBlocks.forEach(b => {
      if (!activityStats[b.activityId]) {
        const activity = activities.find(a => a.id === b.activityId)
        activityStats[b.activityId] = { 
          plan: 0, 
          exec: 0, 
          name: activity?.name || "알 수 없음" 
        }
      }
      activityStats[b.activityId].plan += (b.endMin - b.startMin)
    })
    
    // 실행 시간
    execBlocks.forEach(b => {
      if (!activityStats[b.activityId]) {
        const activity = activities.find(a => a.id === b.activityId)
        activityStats[b.activityId] = { 
          plan: 0, 
          exec: 0, 
          name: activity?.name || "알 수 없음" 
        }
      }
      activityStats[b.activityId].exec += (b.endMin - b.startMin)
    })
    
    // 가장 미룬 활동 TOP 3
    const delayedActivities = Object.entries(activityStats)
      .map(([id, stat]) => ({
        id,
        name: stat.name,
        planMin: stat.plan,
        execMin: stat.exec,
        diff: stat.plan - stat.exec,
        diffPercent: stat.plan > 0 ? Math.round(((stat.plan - stat.exec) / stat.plan) * 100) : 0
      }))
      .filter(a => a.diff > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 3)
    
    // 가장 초과한 활동
    const exceededActivities = Object.entries(activityStats)
      .map(([id, stat]) => ({
        id,
        name: stat.name,
        planMin: stat.plan,
        execMin: stat.exec,
        diff: stat.exec - stat.plan,
        diffPercent: stat.plan > 0 ? Math.round(((stat.exec - stat.plan) / stat.plan) * 100) : 999
      }))
      .filter(a => a.diff > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 3)
    
    return {
      planMin,
      execMin,
      completion,
      planHours: Math.floor(planMin / 60),
      planRemainMin: planMin % 60,
      execHours: Math.floor(execMin / 60),
      execRemainMin: execMin % 60,
      delayedActivities,
      exceededActivities,
    }
  }, [date, blocksByDate, activities])
  
  // 달성률에 따른 색상
  const getCompletionColor = (percent: number) => {
    if (percent >= 90) return "text-green-500"
    if (percent >= 70) return "text-yellow-500"
    return "text-red-500"
  }
  
  // 아이콘
  const CompletionIcon = analysis.completion >= 90 ? TrendingUp : 
                         analysis.completion >= 70 ? Minus : TrendingDown
  
  return (
    <div className="bg-background rounded-2xl border border-border/20 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">오늘의 실행력</h3>
        <div className={`flex items-center gap-1 ${getCompletionColor(analysis.completion)}`}>
          <CompletionIcon className="w-4 h-4" />
          <span className="text-2xl font-bold tabular-nums">{analysis.completion}%</span>
        </div>
      </div>
      
      {/* 계획 vs 실행 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* 계획 */}
        <div className="bg-muted/30 rounded-xl p-3">
          <div className="text-xs text-muted-foreground mb-1">계획</div>
          <div className="text-xl font-bold tabular-nums">
            {analysis.planHours}시간 {analysis.planRemainMin > 0 && `${analysis.planRemainMin}분`}
          </div>
        </div>
        
        {/* 실행 */}
        <div className="bg-primary/10 rounded-xl p-3">
          <div className="text-xs text-muted-foreground mb-1">실행</div>
          <div className="text-xl font-bold tabular-nums text-primary">
            {analysis.execHours}시간 {analysis.execRemainMin > 0 && `${analysis.execRemainMin}분`}
          </div>
        </div>
      </div>
      
      {/* 진행 바 */}
      <div className="mb-4">
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
            style={{ width: `${Math.min(analysis.completion, 100)}%` }}
          />
        </div>
      </div>
      
      {/* 가장 미룬 활동 */}
      {analysis.delayedActivities.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">⏳ 가장 미룬 활동</div>
          <div className="space-y-1">
            {analysis.delayedActivities.map((act, idx) => (
              <div key={act.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {idx + 1}. {act.name}
                </span>
                <span className="text-red-400 tabular-nums">
                  -{Math.floor(act.diff / 60)}h {act.diff % 60 > 0 && `${act.diff % 60}m`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 가장 초과한 활동 */}
      {analysis.exceededActivities.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">🔥 계획보다 더 한 활동</div>
          <div className="space-y-1">
            {analysis.exceededActivities.map((act, idx) => (
              <div key={act.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {idx + 1}. {act.name}
                </span>
                <span className="text-green-400 tabular-nums">
                  +{Math.floor(act.diff / 60)}h {act.diff % 60 > 0 && `${act.diff % 60}m`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 메시지 */}
      {analysis.completion === 0 && (
        <div className="mt-3 text-center text-xs text-muted-foreground">
          아직 실행 기록이 없어요
        </div>
      )}
      
      {analysis.completion >= 100 && (
        <div className="mt-3 text-center text-xs text-green-500 font-medium">
          🎉 완벽한 하루! 계획을 모두 달성했어요!
        </div>
      )}
    </div>
  )
}
