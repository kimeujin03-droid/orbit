"use client"

import { useMemo } from "react"
import { usePlannerStore, formatDateISO, minToTime } from "@/lib/store"
import { Clock, Sparkles } from "lucide-react"

interface TimeSlot {
  startMin: number
  endMin: number
  duration: number
}

// 스마트 시간 블록 추천
export function SmartBlockSuggestion({ 
  date, 
  requiredDuration = 60 
}: { 
  date: Date
  requiredDuration?: number // 필요한 시간 (분)
}) {
  const { blocksByDate, focusSlots } = usePlannerStore()
  
  const suggestions = useMemo(() => {
    const dateISO = formatDateISO(date)
    const blocks = blocksByDate[dateISO] || []
    const dayFocusSlots = focusSlots.filter(s => s.dateISO === dateISO)
    
    // 24시간을 10분 단위로 나눔 (144개 슬롯)
    const occupied = new Array(144).fill(false)
    
    // 기존 블록이 차지한 슬롯 마킹
    blocks.forEach(b => {
      const startSlot = Math.floor(b.startMin / 10)
      const endSlot = Math.ceil(b.endMin / 10)
      for (let i = startSlot; i < endSlot; i++) {
        if (i >= 0 && i < 144) occupied[i] = true
      }
    })
    
    // 필요한 슬롯 수
    const requiredSlots = Math.ceil(requiredDuration / 10)
    
    // 빈 시간 찾기
    const availableSlots: TimeSlot[] = []
    let currentStart = -1
    let currentLength = 0
    
    for (let i = 0; i < 144; i++) {
      if (!occupied[i]) {
        if (currentStart === -1) currentStart = i
        currentLength++
      } else {
        if (currentLength >= requiredSlots) {
          availableSlots.push({
            startMin: currentStart * 10,
            endMin: currentStart * 10 + currentLength * 10,
            duration: currentLength * 10
          })
        }
        currentStart = -1
        currentLength = 0
      }
    }
    
    // 마지막 구간 처리
    if (currentLength >= requiredSlots) {
      availableSlots.push({
        startMin: currentStart * 10,
        endMin: currentStart * 10 + currentLength * 10,
        duration: currentLength * 10
      })
    }
    
    // 각 슬롯의 집중도 점수 계산
    const scoredSlots = availableSlots.map(slot => {
      const slotStartIdx = Math.floor(slot.startMin / 10)
      const slotEndIdx = Math.ceil(slot.endMin / 10)
      
      // 해당 시간대의 평균 집중도
      const relevantFocusSlots = dayFocusSlots.filter(
        f => f.slotIndex >= slotStartIdx && f.slotIndex < slotEndIdx
      )
      
      const avgFocus = relevantFocusSlots.length > 0
        ? relevantFocusSlots.reduce((sum, f) => sum + f.level, 0) / relevantFocusSlots.length
        : 0
      
      // 시간대 점수 (오전 9-12시, 오후 2-5시 선호)
      const hour = Math.floor(slot.startMin / 60)
      let timeScore = 0
      if (hour >= 9 && hour < 12) timeScore = 3
      else if (hour >= 14 && hour < 17) timeScore = 2
      else if (hour >= 7 && hour < 9) timeScore = 1
      
      return {
        ...slot,
        focusScore: avgFocus,
        timeScore,
        totalScore: avgFocus * 2 + timeScore
      }
    })
    
    // 점수 높은 순으로 정렬, 상위 3개
    return scoredSlots
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 3)
  }, [date, blocksByDate, focusSlots, requiredDuration])
  
  if (suggestions.length === 0) {
    return (
      <div className="bg-background rounded-2xl border border-border/20 p-4 text-center">
        <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          {requiredDuration}분 이상의 빈 시간이 없어요
        </p>
      </div>
    )
  }
  
  return (
    <div className="bg-background rounded-2xl border border-border/20 p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-yellow-500" />
        <h3 className="text-sm font-semibold">추천 시간대</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {requiredDuration}분 필요
        </span>
      </div>
      
      {/* 추천 목록 */}
      <div className="space-y-2">
        {suggestions.map((slot, idx) => (
          <div 
            key={idx}
            className="bg-gradient-to-r from-primary/5 to-transparent rounded-xl p-3 border border-primary/20 hover:border-primary/40 transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary">
                  #{idx + 1} 추천
                </span>
                {slot.focusScore > 3 && (
                  <span className="text-xs text-yellow-500">⭐ 고집중</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.floor(slot.duration / 60)}시간 {slot.duration % 60 > 0 && `${slot.duration % 60}분`}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium tabular-nums">
                {minToTime(slot.startMin)} ~ {minToTime(slot.endMin)}
              </span>
            </div>
            
            {slot.focusScore > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                평균 집중도: {slot.focusScore.toFixed(1)}/5
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-3 text-xs text-center text-muted-foreground">
        클릭하면 해당 시간에 블록을 추가할 수 있어요
      </div>
    </div>
  )
}
