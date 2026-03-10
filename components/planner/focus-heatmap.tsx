"use client"

import { useMemo } from "react"
import { usePlannerStore, formatDateISO } from "@/lib/store"

// 집중도 히트맵 - 주간 보기
export function FocusHeatmap({ startDate }: { startDate?: Date }) {
  const { focusSlots, activities } = usePlannerStore()
  
  // 7일치 날짜 배열 생성
  const dates = useMemo(() => {
    const base = startDate || new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base)
      d.setDate(base.getDate() - 6 + i)
      return d
    })
  }, [startDate])
  
  // 시간대: 13시간(1시간~13시간, 세로)
  const hourSlots = Array.from({ length: 13 }, (_, i) => i + 1)
  
  // 각 날짜, 각 시간의 집중도 계산
  const heatmapData = useMemo(() => {
    const data: Record<string, Record<number, number>> = {}
    
    dates.forEach(date => {
      const dateISO = formatDateISO(date)
      const daySlots = focusSlots.filter(s => s.dateISO === dateISO)
      
      data[dateISO] = {}
      
      // 시간대별로 집계
      hourSlots.forEach(hour => {
        // 해당 시간의 10분 슬롯들 (6개)
        const startSlot = (hour - 1) * 6
        const endSlot = hour * 6
        
        const relevantSlots = daySlots.filter(
          s => s.slotIndex >= startSlot && s.slotIndex < endSlot
        )
        
        if (relevantSlots.length === 0) {
          data[dateISO][hour] = 0 // 기록 없음
        } else {
          // 평균 집중도 계산
          const avgLevel = relevantSlots.reduce((sum, s) => sum + s.level, 0) / relevantSlots.length
          data[dateISO][hour] = avgLevel
        }
      })
    })
    
    return data
  }, [dates, focusSlots, hourSlots])
  
  // 레벨에 따른 색상 (보라색 계열)
  const getLevelColor = (level: number): string => {
    if (level === 0) return "#27272a" // 기록 없음 - 어두운 회색
    if (level < 1.5) return "#6366f155" // 약한 보라
    if (level < 2.5) return "#6366f188" // 중간 보라
    if (level < 3.5) return "#6366f1bb" // 강한 보라
    return "#6366f1ee" // 매우 강한 보라
  }
  
  // 요일 라벨
  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"]
  
  return (
    <div className="bg-background rounded-2xl border border-border/20 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">집중도</h3>
        <span className="text-xs text-muted-foreground">
          {dates[0].getMonth() + 1}월 {dates[0].getDate()}일 ~ {dates[6].getMonth() + 1}월 {dates[6].getDate()}일
        </span>
      </div>
      
      {/* 히트맵 그리드 */}
      <div className="flex gap-2">
        {/* 시간 라벨 (세로) */}
        <div className="flex flex-col gap-[2px] pt-6">
          {hourSlots.map(hour => (
            <div 
              key={hour}
              className="h-6 flex items-center justify-end pr-1"
            >
              <span className="text-[9px] text-muted-foreground tabular-nums">
                {hour}시간째
              </span>
            </div>
          ))}
        </div>
        
        {/* 날짜별 열 */}
        {dates.map((date, dayIndex) => {
          const dateISO = formatDateISO(date)
          const dayData = heatmapData[dateISO] || {}
          const dayLabel = dayLabels[date.getDay()]
          
          return (
            <div key={dateISO} className="flex-1 flex flex-col gap-[2px]">
              {/* 날짜 헤더 */}
              <div className="h-6 flex flex-col items-center justify-center pb-1">
                <span className="text-[10px] text-muted-foreground">{dayLabel}</span>
                <span className="text-[9px] text-muted-foreground/60">{date.getDate()}</span>
              </div>
              
              {/* 시간 셀들 */}
              {hourSlots.map(hour => {
                const level = dayData[hour] || 0
                
                return (
                  <div
                    key={hour}
                    className="h-6 rounded-sm border border-border/10 transition-all"
                    style={{ backgroundColor: getLevelColor(level) }}
                    title={`${dateISO} ${hour}시간째: ${level > 0 ? `집중도 ${level.toFixed(1)}` : '기록 없음'}`}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      
      {/* 범례 */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/10">
        <span className="text-[10px] text-muted-foreground">낮음</span>
        <div className="flex gap-1">
          {[0, 1.5, 2.5, 3.5, 4.5].map((level, i) => (
            <div
              key={i}
              className="w-4 h-3 rounded-sm"
              style={{ backgroundColor: getLevelColor(level) }}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">높음</span>
      </div>
    </div>
  )
}
