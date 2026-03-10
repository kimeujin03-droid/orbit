"use client"

import { useState } from "react"
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react"

export type ZoomLevel = "full" | "work" | "detailed"

interface ZoomConfig {
  label: string
  startHour: number
  endHour: number
  hourHeight: number
  segmentsPerHour: number
}

const ZOOM_CONFIGS: Record<ZoomLevel, ZoomConfig> = {
  full: {
    label: "전체 (24시간)",
    startHour: 0,
    endHour: 24,
    hourHeight: 60,
    segmentsPerHour: 6 // 10분 단위
  },
  work: {
    label: "업무 시간 (9-18시)",
    startHour: 9,
    endHour: 18,
    hourHeight: 84,
    segmentsPerHour: 6
  },
  detailed: {
    label: "상세 (5분 단위)",
    startHour: 9,
    endHour: 18,
    hourHeight: 120,
    segmentsPerHour: 12 // 5분 단위
  }
}

// 타임라인 줌 컨트롤
export function TimelineZoomControl({
  currentZoom,
  onZoomChange
}: {
  currentZoom: ZoomLevel
  onZoomChange: (zoom: ZoomLevel) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  
  const currentConfig = ZOOM_CONFIGS[currentZoom]
  
  return (
    <div className="relative">
      {/* 현재 줌 레벨 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
      >
        <Maximize2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{currentConfig.label}</span>
        <span className="sm:hidden">줌</span>
      </button>
      
      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <>
          {/* 배경 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* 메뉴 */}
          <div className="absolute top-full mt-2 right-0 z-50 bg-background border border-border/20 rounded-xl shadow-2xl overflow-hidden min-w-[200px]">
            {(Object.entries(ZOOM_CONFIGS) as [ZoomLevel, ZoomConfig][]).map(([level, config]) => (
              <button
                key={level}
                onClick={() => {
                  onZoomChange(level)
                  setIsOpen(false)
                }}
                className={`
                  w-full flex items-center justify-between px-4 py-3 text-sm transition-colors
                  ${currentZoom === level
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted/50'
                  }
                `}
              >
                <span>{config.label}</span>
                {currentZoom === level && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// 간단한 줌 버튼 (+ / - 만)
export function SimpleZoomButtons({
  currentZoom,
  onZoomChange
}: {
  currentZoom: ZoomLevel
  onZoomChange: (zoom: ZoomLevel) => void
}) {
  const zoomLevels: ZoomLevel[] = ["full", "work", "detailed"]
  const currentIndex = zoomLevels.indexOf(currentZoom)
  
  const canZoomIn = currentIndex < zoomLevels.length - 1
  const canZoomOut = currentIndex > 0
  
  const handleZoomIn = () => {
    if (canZoomIn) {
      onZoomChange(zoomLevels[currentIndex + 1])
    }
  }
  
  const handleZoomOut = () => {
    if (canZoomOut) {
      onZoomChange(zoomLevels[currentIndex - 1])
    }
  }
  
  return (
    <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
      <button
        onClick={handleZoomOut}
        disabled={!canZoomOut}
        className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="축소"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
      
      <div className="px-2 text-xs font-medium text-muted-foreground min-w-[60px] text-center">
        {ZOOM_CONFIGS[currentZoom].label.split(" ")[0]}
      </div>
      
      <button
        onClick={handleZoomIn}
        disabled={!canZoomIn}
        className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="확대"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
    </div>
  )
}

// Timeline 컴포넌트에서 사용하기 위한 Hook
export function useTimelineZoom(initialZoom: ZoomLevel = "full") {
  const [zoom, setZoom] = useState<ZoomLevel>(initialZoom)
  const config = ZOOM_CONFIGS[zoom]
  
  // 표시할 시간 배열 생성
  const visibleHours = Array.from(
    { length: config.endHour - config.startHour },
    (_, i) => config.startHour + i
  )
  
  return {
    zoom,
    setZoom,
    config,
    visibleHours,
    
    // Timeline 컴포넌트에서 사용할 값들
    hourHeight: config.hourHeight,
    segmentsPerHour: config.segmentsPerHour,
    startHour: config.startHour,
    endHour: config.endHour
  }
}

// Timeline 컴포넌트 통합 예시
export function TimelineWithZoom() {
  const {
    zoom,
    setZoom,
    config,
    visibleHours,
    hourHeight,
    segmentsPerHour
  } = useTimelineZoom("full")
  
  return (
    <div className="space-y-4">
      {/* 헤더에 줌 컨트롤 추가 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Timeline</h2>
        
        <div className="flex items-center gap-2">
          <SimpleZoomButtons 
            currentZoom={zoom}
            onZoomChange={setZoom}
          />
          {/* 또는 */}
          <TimelineZoomControl
            currentZoom={zoom}
            onZoomChange={setZoom}
          />
        </div>
      </div>
      
      {/* Timeline 렌더링 */}
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
        {visibleHours.map(hour => (
          <div
            key={hour}
            className="flex border-b border-border/10"
            style={{ height: `${hourHeight}px` }}
          >
            {/* 시간 라벨 */}
            <div className="w-12 flex items-start justify-end pr-2 pt-1">
              <span className="text-xs text-muted-foreground tabular-nums">
                {hour.toString().padStart(2, "0")}:00
              </span>
            </div>
            
            {/* Segments */}
            <div className="flex-1 relative">
              <div className={`absolute inset-0 grid grid-cols-${segmentsPerHour}`}>
                {Array.from({ length: segmentsPerHour }).map((_, segmentIdx) => (
                  <div
                    key={segmentIdx}
                    className={`relative ${segmentIdx > 0 ? 'border-l border-border/20' : ''}`}
                  >
                    {/* 여기에 블록 렌더링 */}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* 줌 정보 */}
      <div className="text-xs text-muted-foreground text-center">
        {config.label} · {config.segmentsPerHour === 6 ? "10분" : "5분"} 단위
      </div>
    </div>
  )
}

// 현재 timeline.tsx에 통합하는 방법:
// 1. useTimelineZoom() hook import
// 2. Timeline 컴포넌트 내에서 const { zoom, setZoom, visibleHours, hourHeight } = useTimelineZoom()
// 3. hours 배열을 visibleHours로 교체
// 4. HOUR_HEIGHT를 hourHeight로 교체
// 5. header에 <TimelineZoomControl> 추가
