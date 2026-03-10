"use client"

import { useEffect, useMemo, useState } from "react"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import { AlertCircle, Coffee, X } from "lucide-react"
import { haptic } from "@/lib/haptic"

interface ContinuousWork {
  activityId: string
  activityName: string
  startMin: number
  endMin: number
  duration: number // 분
  color: string
}

// 연속 작업 경고 컴포넌트
export function ContinuousWorkAlert({ date }: { date: Date }) {
  const { blocksByDate, activities, addBlock, pushSnapshot } = usePlannerStore()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  
  const warnings = useMemo(() => {
    const dateISO = formatDateISO(date)
    const blocks = blocksByDate[dateISO] || []
    const executeBlocks = blocks
      .filter(b => b.layer === "execute")
      .sort((a, b) => a.startMin - b.startMin)
    
    if (executeBlocks.length === 0) return []
    
    const continuousWorks: ContinuousWork[] = []
    let current: ContinuousWork | null = null
    
    executeBlocks.forEach(block => {
      const activity = activities.find(a => a.id === block.activityId)
      
      if (!current) {
        // 첫 블록
        current = {
          activityId: block.activityId,
          activityName: activity?.name || "알 수 없음",
          startMin: block.startMin,
          endMin: block.endMin,
          duration: block.endMin - block.startMin,
          color: activity?.color || "#6B7280"
        }
      } else if (
        current.activityId === block.activityId &&
        block.startMin - current.endMin <= 10 // 10분 이내 간격은 연속으로 간주
      ) {
        // 같은 활동이 이어짐
        current.endMin = block.endMin
        current.duration = current.endMin - current.startMin
      } else {
        // 다른 활동 or 간격이 큼
        if (current.duration >= 120) { // 2시간 이상
          continuousWorks.push(current)
        }
        current = {
          activityId: block.activityId,
          activityName: activity?.name || "알 수 없음",
          startMin: block.startMin,
          endMin: block.endMin,
          duration: block.endMin - block.startMin,
          color: activity?.color || "#6B7280"
        }
      }
    })
    
    // 마지막 작업 체크
    if (current && current.duration >= 120) {
      continuousWorks.push(current)
    }
    
    return continuousWorks
  }, [date, blocksByDate, activities])
  
  // 현재 시간 기준으로 진행 중인 경고만 표시
  const activeWarnings = useMemo(() => {
    const now = new Date()
    const today = formatDateISO(now)
    const currentMin = now.getHours() * 60 + now.getMinutes()
    
    if (formatDateISO(date) !== today) {
      // 오늘이 아니면 모든 경고 표시
      return warnings
    }
    
    // 오늘이면 현재 진행 중인 것만
    return warnings.filter(w => 
      currentMin >= w.startMin && currentMin <= w.endMin
    )
  }, [date, warnings])
  
  const visibleWarnings = activeWarnings.filter(
    w => !dismissed.has(`${w.activityId}-${w.startMin}`)
  )
  
  const handleDismiss = (work: ContinuousWork) => {
    haptic.light()
    setDismissed(prev => new Set(prev).add(`${work.activityId}-${work.startMin}`))
  }
  
  const handleAddBreak = (work: ContinuousWork) => {
    haptic.medium()
    pushSnapshot()
    
    // 10분 휴식 블록 추가 (현재 시간 기준)
    const now = new Date()
    const currentMin = now.getHours() * 60 + now.getMinutes()
    
    // 휴식 activity 찾기 (없으면 기본값)
    const breakActivity = activities.find(a => 
      a.name.includes("휴식") || a.name.includes("break")
    )
    
    addBlock({
      dateISO: formatDateISO(date),
      activityId: breakActivity?.id || work.activityId,
      startMin: currentMin,
      endMin: currentMin + 10,
      layer: "execute" as const,
      source: "manual" as const,
    })
    
    handleDismiss(work)
  }
  
  if (visibleWarnings.length === 0) return null
  
  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 space-y-2 scrollbar-hide">
      {visibleWarnings.map(work => {
        const hours = Math.floor(work.duration / 60)
        const mins = work.duration % 60
        
        return (
          <div
            key={`${work.activityId}-${work.startMin}`}
            className="bg-gradient-to-r from-orange-500/20 to-red-500/20 backdrop-blur-xl border-2 border-orange-500/50 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-5"
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-white">연속 작업 경고</div>
                  <div className="text-xs text-orange-200/80">
                    {hours}시간 {mins > 0 && `${mins}분`} 연속 작업 중
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(work)}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* 활동 정보 */}
            <div className="flex items-center gap-2 mb-3 bg-black/20 rounded-lg p-2">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: work.color }}
              />
              <span className="text-sm text-white font-medium truncate">
                {work.activityName}
              </span>
            </div>
            
            {/* 메시지 */}
            <p className="text-sm text-white/90 mb-3">
              장시간 같은 작업을 하면 피로가 쌓여요. 
              <br />
              잠깐 휴식하는 건 어때요? ☕
            </p>
            
            {/* 액션 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={() => handleAddBreak(work)}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium py-2.5 rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg"
              >
                <Coffee className="w-4 h-4" />
                <span>10분 휴식하기</span>
              </button>
              <button
                onClick={() => handleDismiss(work)}
                className="px-4 py-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
              >
                계속하기
              </button>
            </div>
            
            {/* 통계 */}
            <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/60 text-center">
              💡 권장: 50분 작업 후 10분 휴식
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 사용 예시: timeline.tsx나 layout에 추가
export function ContinuousWorkMonitor() {
  const { selectedDate } = usePlannerStore()
  
  return <ContinuousWorkAlert date={selectedDate} />
}
