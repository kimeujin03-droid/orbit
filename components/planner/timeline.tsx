"use client"

import React, { useRef, useState, useCallback, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { X, Plus, Check } from "lucide-react"
import { usePlannerStore, formatDateISO, minToTime, hourSegmentToMin } from "@/lib/store"
import type { Block, Segment, ChecklistBlock } from "@/lib/types"
import { haptic } from "@/lib/haptic"
import { getConditionEmoji } from "./condition-view"
import { ContinuousWorkMonitor } from "./continuous-work-alert"
import { PlaceGroupFrames } from "./place-group-overlay"

const colorOptions = [
  "#93C5FD",  // 밝은 파랑
  "#A5F3FC",  // 밝은 시안
  "#C4B5FD",  // 밝은 보라
  "#86EFAC",  // 밝은 초록
  "#FDE68A",  // 밝은 노랑
  "#A5B4FC",  // 연한 인디고
  "#FDBA74",  // 밝은 주황
  "#F9A8D4",  // 밝은 핑크
]

export function Timeline() {
  // 화면 크기에 따른 동적 hourHeight 계산
  const [hourHeight, setHourHeight] = useState(72)
  
  useEffect(() => {
    const updateHourHeight = () => {
      const vh = window.innerHeight
      // 작은 화면(폰): 60px, 중간(일반): 72px, 큰 화면(태블릿): 84px
      if (vh < 700) {
        setHourHeight(60)
      } else if (vh > 900) {
        setHourHeight(84)
      } else {
        setHourHeight(72)
      }
    }
    
    updateHourHeight()
    window.addEventListener('resize', updateHourHeight)
    return () => window.removeEventListener('resize', updateHourHeight)
  }, [])

  const {
    selectedDate,
    setSelectedDate,
    startHour,
    activeTool,
    selectedActivityId,
    lastPlanExecTool,
    activities,
    blocksByDate,
    indicatorsByDate,
    checklistBlocksByDate,
    paintCell,
    paintOverlayCell,
    eraseCell,
    eraseOverlayCell,
    addIndicator,
    removeIndicator,
    removeBlock,
    addChecklistBlock,
    toggleChecklistBlockItem,
    pushSnapshot,
    conditionLogs,
    blockEmojis,
    setBlockEmoji,
    removeBlockEmoji,
    addTask,
    removeChecklistBlock,
    places,
  } = usePlannerStore()

  const dateISO = formatDateISO(selectedDate)
  const blocks = blocksByDate[dateISO] || []
  const indicators = indicatorsByDate[dateISO] || []
  const checklistBlocks = checklistBlocksByDate[dateISO] || []
  const todayConditionLog = conditionLogs.find(c => c.dateISO === dateISO)
  const todayBlockEmojis = blockEmojis.filter(e => e.dateISO === dateISO)

  // 블록 이모지 팝업 상태
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<{ blockId: string; x: number; y: number } | null>(null)
  const QUICK_EMOJIS = ["😊","😤","😴","🔥","💪","🧘","😩","✅","⚡","🎯","💡","😅"]

  // 체크리스트 블록 롱프레스 메뉴 상태
  const [checklistBlockMenu, setChecklistBlockMenu] = useState<{
    cbId: string
    dateISO: string
    itemText: string
    x: number
    y: number
  } | null>(null)
  const checklistLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false)
  const isPointerDownRef = useRef(false)
  const hasDraggedRef = useRef(false)
  const snapshotPushedRef = useRef(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)
  // 이번 드래그 세션에서 overlay로 칠한 칸 목록 (중복 방지용)
  const dragPaintedCellsRef = useRef<Set<string>>(new Set())

  // 터치 드래그 vs 스크롤 구분을 위한 pending 상태
  const DRAG_THRESHOLD = 8 // px - 이 거리 이상 움직여야 드래그 확정
  const pendingPaintRef = useRef<{ hour: number; segment: number } | null>(null)
  const paintConfirmedRef = useRef(false) // threshold 초과 후 paint 확정 여부

  // NEW_EVENT 드래그 상태
  const [newEventDragging, setNewEventDragging] = useState(false)
  const [newEventStart, setNewEventStart] = useState<{ hour: number; segment: number } | null>(null)
  const [newEventEnd, setNewEventEnd] = useState<{ hour: number; segment: number } | null>(null)
  const [newEventLabel, setNewEventLabel] = useState("")
  const [newEventColor, setNewEventColor] = useState(colorOptions[0])

  // 다이얼로그 상태
  const [indicatorDialog, setIndicatorDialog] = useState<{ hour: number; segment: number } | null>(null)
  const [indicatorLabel, setIndicatorLabel] = useState("")
  const [newEventDialog, setNewEventDialog] = useState(false)
  
  // 체크리스트 다이얼로그 상태
  const [checklistDialog, setChecklistDialog] = useState<{ hour: number; segment: number; hasBlock: boolean; position: "main" | "sub"; overlapIndex: number } | null>(null)
  const [checklistStartMin, setChecklistStartMin] = useState(0)
  const [checklistEndMin, setChecklistEndMin] = useState(60)
  const [checklistItems, setChecklistItems] = useState<{ text: string }[]>([{ text: "" }])

  const timelineRef = useRef<HTMLDivElement>(null)

  // 24시간 배열 생성 (startHour부터 시작)
  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => (startHour + i) % 24)
  }, [startHour])

  // 현재 시간 상태 (10초마다 업데이트로 부드러운 이동)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)

  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 10000) // 10초마다 업데이트 (1분 내에서도 이동)
    return () => clearInterval(timer)
  }, [])

  const isToday = currentTime ? formatDateISO(currentTime) === dateISO : false
  const currentMin = currentTime ? currentTime.getHours() * 60 + currentTime.getMinutes() : -1

  // ── 최초 로드 시 현재 시간 위치로 자동 스크롤 ──
  const didAutoScrollRef = useRef(false)
  useEffect(() => {
    if (!isToday || didAutoScrollRef.current || !timelineRef.current || currentMin < 0) return
    const currentHour = Math.floor(currentMin / 60)
    const hourIndex = hours.indexOf(currentHour)
    if (hourIndex === -1) return
    // 해당 시간 행의 top 위치 - 화면 1/3 정도에 오도록
    const scrollTarget = Math.max(0, hourIndex * hourHeight - timelineRef.current.clientHeight / 3)
    timelineRef.current.scrollTo({ top: scrollTarget, behavior: "smooth" })
    didAutoScrollRef.current = true
  }, [isToday, currentMin, hours, hourHeight])

  // 날짜가 바뀌면 다시 스크롤 허용
  useEffect(() => {
    didAutoScrollRef.current = false
  }, [dateISO])

  // Activity 색상 가져오기
  const getActivityColor = useCallback((activityId: string) => {
    const activity = activities.find((a) => a.id === activityId)
    return activity?.color || "#6B7280"
  }, [activities])

  // Activity 이름 가져오기
  const getActivityName = useCallback((activityId: string) => {
    const activity = activities.find((a) => a.id === activityId)
    return activity?.name || "알 수 없음"
  }, [activities])

  // 블록을 Segment로 병합 — 중복(다른 activity) 시에도 같은 activity끼리 연결
  const getSegmentsForHour = useCallback((hour: number, layer: "execute" | "overlay"): Segment[] => {
    const hourBlocks = blocks.filter((b) => {
      const sh = Math.floor(b.startMin / 60)
      const eh = Math.floor((b.endMin - 1) / 60)
      return b.layer === layer && sh <= hour && eh >= hour
    })

    if (hourBlocks.length === 0) return []

    const hourStart = hour * 60
    const hourEnd = (hour + 1) * 60

    if (layer === "overlay") {
      // overlay: 각 블록을 독립 처리
      // 연속된 칸 + 같은 activityId + createdAt이 매우 가까운(2초 이내) 것끼리만 병합
      // → 서로 다른 드래그 세션(다른 시간에 칠한 것)은 별도 segment
      const sorted = [...hourBlocks].sort((a, b) => a.createdAt - b.createdAt)

      const segments: Segment[] = []

      sorted.forEach((block) => {
        const blockStartInHour = Math.max(block.startMin, hourStart)
        const blockEndInHour = Math.min(block.endMin, hourEnd)
        const startCol = Math.floor((blockStartInHour - hourStart) / 10)
        const endCol = Math.floor((blockEndInHour - hourStart - 1) / 10)

        // 기존 segment 중 이어붙일 수 있는 것 찾기:
        // 같은 activityId + col이 인접 + createdAt 차이 2초 이내
        const mergeable = segments.find((s) => {
          if (s.activityId !== block.activityId) return false
          if (s.endCol < startCol - 1 || startCol > s.endCol + 1) return false
          const lastBlockTime = Math.max(...s.blocks.map(b => b.createdAt))
          return Math.abs(block.createdAt - lastBlockTime) <= 2000
        })

        if (mergeable) {
          mergeable.endCol = Math.max(mergeable.endCol, endCol)
          mergeable.startCol = Math.min(mergeable.startCol, startCol)
          mergeable.blocks.push(block)
        } else {
          segments.push({
            row: hour,
            startCol,
            endCol,
            layer,
            activityId: block.activityId,
            blocks: [block],
          })
        }
      })

      segments.sort((a, b) => {
        if (a.startCol !== b.startCol) return a.startCol - b.startCol
        const aTime = Math.min(...a.blocks.map(bl => bl.createdAt))
        const bTime = Math.min(...b.blocks.map(bl => bl.createdAt))
        return aTime - bTime
      })

      return segments
    }

    // execute: 기존 방식 — activityId별 연속 병합
    const byActivity: Record<string, { startCol: number; endCol: number; block: Block }[]> = {}

    hourBlocks.forEach((block) => {
      const blockStartInHour = Math.max(block.startMin, hourStart)
      const blockEndInHour = Math.min(block.endMin, hourEnd)
      const startCol = Math.floor((blockStartInHour - hourStart) / 10)
      const endCol = Math.floor((blockEndInHour - hourStart - 1) / 10)

      if (!byActivity[block.activityId]) byActivity[block.activityId] = []
      byActivity[block.activityId].push({ startCol, endCol, block })
    })

    const segments: Segment[] = []

    Object.entries(byActivity).forEach(([activityId, entries]) => {
      entries.sort((a, b) => a.startCol - b.startCol)

      entries.forEach(({ startCol, endCol, block }) => {
        const lastSeg = segments.filter(s => s.activityId === activityId).pop()
        if (lastSeg && lastSeg.endCol >= startCol - 1) {
          lastSeg.endCol = Math.max(lastSeg.endCol, endCol)
          lastSeg.blocks.push(block)
        } else {
          segments.push({
            row: hour,
            startCol,
            endCol,
            layer,
            activityId,
            blocks: [block],
          })
        }
      })
    })

    segments.sort((a, b) => a.startCol - b.startCol)
    return segments
  }, [blocks])

  // 🚀 성능 최적화: 모든 시간의 segments를 한 번에 계산
  const segmentsByHour = useMemo(() => {
    const result: Record<number, { execute: Segment[]; overlay: Segment[] }> = {}
    hours.forEach((hour) => {
      result[hour] = {
        execute: getSegmentsForHour(hour, "execute"),
        overlay: getSegmentsForHour(hour, "overlay"),
      }
    })
    return result
  }, [hours, getSegmentsForHour])

  // 셀에 블록이 있는지 확인
  const getCellBlocks = useCallback((hour: number, segment: number) => {
    const min = hourSegmentToMin(hour, segment)
    return {
      execute: blocks.find((b) => b.layer === "execute" && b.startMin <= min && b.endMin > min),
      overlays: blocks.filter((b) => b.layer === "overlay" && b.startMin <= min && b.endMin > min),
      hasAnyBlock: blocks.some((b) => b.startMin <= min && b.endMin > min),
    }
  }, [blocks])

  // 체크리스트 블록 가져오기
  const getChecklistBlocksForHour = useCallback((hour: number) => {
    const hourStart = hour * 60
    const hourEnd = (hour + 1) * 60
    return checklistBlocks.filter(
      (cb) => cb.startMin < hourEnd && cb.endMin > hourStart
    )
  }, [checklistBlocks])

  // Indicator 가져오기
  const getIndicatorForCell = useCallback((hour: number, segment: number) => {
    const min = hourSegmentToMin(hour, segment)
    return indicators.find((i) => {
      const indicatorSegmentStart = Math.floor(i.atMin / 10) * 10
      return indicatorSegmentStart === min
    })
  }, [indicators])

  // 포인터 이벤트 핸들러
  const handlePointerDown = useCallback((e: React.PointerEvent, hour: number, segment: number) => {
    e.preventDefault()
    isPointerDownRef.current = true
    hasDraggedRef.current = false
    snapshotPushedRef.current = false
    startPosRef.current = { x: e.clientX, y: e.clientY }

    const cellBlocks = getCellBlocks(hour, segment)

    // Indicator 모드 — 이미 일정이 있는 셀에서는 작동 안 함
    if (activeTool === "indicator") {
      if (!cellBlocks.hasAnyBlock) {
        setIndicatorDialog({ hour, segment })
      }
      return
    }

    // NEW_EVENT 모드
    if (activeTool === "new") {
      setNewEventStart({ hour, segment })
      setNewEventEnd({ hour, segment })
      setNewEventDragging(true)
      return
    }

    // Long-press 타이머 (체크리스트 생성용) - execute 모드에서만
    if (activeTool === "execute") {
      // 롱프레스 시점의 execute 세그먼트 겹침 정보를 캡처
      const capturedHour = hour
      const capturedSegment = segment
      longPressTimerRef.current = setTimeout(() => {
        if (!hasDraggedRef.current && isPointerDownRef.current) {
          const min = capturedHour * 60 + capturedSegment * 10
          // 현재 store에서 이 칸의 execute segments 겹침 정보 읽기
          const { blocksByDate } = usePlannerStore.getState()
          const dateBlocks = blocksByDate[dateISO] || []
          const execBlocksAtCell = dateBlocks.filter(
            b => b.layer === "execute" && b.startMin <= min && b.endMin > min
          ).sort((a, b) => a.createdAt - b.createdAt)
          // 몇 번째 겹침 블록인지: 전체 겹침 수 기준
          const overlapCount = execBlocksAtCell.length
          // pointerDown 좌표로는 어느 블록(main/sub)인지 알기 어려우므로
          // execute 블록이 1개면 main(0), 2개 이상이면 직전 클릭 Y좌표로 판단
          // 여기서는 단순화: 처음 클릭은 항상 main(0)에서 시작
          const overlapIndex = 0
          const position = overlapCount > 1 ? "sub" : "main"

          setChecklistStartMin(min)
          setChecklistEndMin(min + 10)
          setChecklistItems([{ text: "" }])
          setChecklistDialog({
            hour: capturedHour,
            segment: capturedSegment,
            hasBlock: execBlocksAtCell.length > 0,
            position,
            overlapIndex,
          })
          isPointerDownRef.current = false
        }
      }, 450)
    }

    // Execute/Plan/Erase 모드 - 터치에서는 pending, 마우스에서는 즉시 paint
    if (activeTool === "execute" || activeTool === "plan" || activeTool === "erase") {
      dragPaintedCellsRef.current = new Set() // 새 드래그 세션 시작

      // 터치 입력이면 pending 상태로 — threshold 초과 시 확정
      if (e.pointerType === "touch") {
        pendingPaintRef.current = { hour, segment }
        paintConfirmedRef.current = false
        // 아직 isDragging=false, touchAction="pan-y" 유지 → 스크롤 가능
      } else {
        // 마우스는 즉시 paint (기존 동작)
        pendingPaintRef.current = null
        paintConfirmedRef.current = true
        setIsDragging(true)
        if (!snapshotPushedRef.current) {
          pushSnapshot()
          snapshotPushedRef.current = true
        }
        if (activeTool === "execute" && selectedActivityId) {
          paintCell(dateISO, hour, segment, selectedActivityId)
        } else if (activeTool === "plan" && selectedActivityId) {
          const cellKey = `${hour}-${segment}`
          dragPaintedCellsRef.current.add(cellKey)
          paintOverlayCell(dateISO, hour, segment, selectedActivityId)
        } else if (activeTool === "erase") {
          if (lastPlanExecTool === "plan") eraseOverlayCell(dateISO, hour, segment)
          else eraseCell(dateISO, hour, segment)
        }
      }
    }
  }, [activeTool, getCellBlocks, selectedActivityId, lastPlanExecTool, dateISO, paintCell, paintOverlayCell, eraseCell, eraseOverlayCell, pushSnapshot])

  const handlePointerEnter = useCallback((e: React.PointerEvent, hour: number, segment: number) => {
    // 버튼이 눌려있지 않으면 무시
    if (!(e.buttons & 1) || !isPointerDownRef.current) {
      return
    }

    // 이동했으면 long-press 타이머 취소
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    hasDraggedRef.current = true

    // NEW_EVENT 모드
    if (activeTool === "new" && newEventDragging) {
      setNewEventEnd({ hour, segment })
      return
    }

    // Execute/Plan/Erase 모드
    if (isDragging && (activeTool === "execute" || activeTool === "plan" || activeTool === "erase")) {
      // 첫 드래그 시 스냅샷 저장
      if (!snapshotPushedRef.current) {
        pushSnapshot()
        snapshotPushedRef.current = true
      }

      if (activeTool === "execute" && selectedActivityId) {
        paintCell(dateISO, hour, segment, selectedActivityId)
      } else if (activeTool === "plan" && selectedActivityId) {
        // 이번 드래그 세션에서 이미 칠한 칸이면 중복 추가 안 함
        const cellKey = `${hour}-${segment}`
        if (!dragPaintedCellsRef.current.has(cellKey)) {
          dragPaintedCellsRef.current.add(cellKey)
          paintOverlayCell(dateISO, hour, segment, selectedActivityId)
        }
      } else if (activeTool === "erase") {
        if (lastPlanExecTool === "plan") eraseOverlayCell(dateISO, hour, segment)
        else eraseCell(dateISO, hour, segment)
      }
    }
  }, [activeTool, isDragging, newEventDragging, selectedActivityId, lastPlanExecTool, dateISO, paintCell, paintOverlayCell, eraseCell, eraseOverlayCell, pushSnapshot])

  const handlePointerUp = useCallback((e: React.PointerEvent, hour?: number, segment?: number) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    // NEW_EVENT 드래그 종료
    if (activeTool === "new" && newEventDragging && newEventStart && newEventEnd) {
      setNewEventDragging(false)
      setNewEventDialog(true)
      isPointerDownRef.current = false
      return
    }

    // Execute/Plan/Erase - 상태 정리 + pending tap 처리
    // 터치로 탭만 했을 때 (드래그 없이 떼면) → pending이면 단일 셀 paint
    if (pendingPaintRef.current && !paintConfirmedRef.current && !hasDraggedRef.current) {
      const { hour: pH, segment: pS } = pendingPaintRef.current
      if (!snapshotPushedRef.current) {
        pushSnapshot()
        snapshotPushedRef.current = true
      }
      if (activeTool === "execute" && selectedActivityId) {
        paintCell(dateISO, pH, pS, selectedActivityId)
      } else if (activeTool === "plan" && selectedActivityId) {
        paintOverlayCell(dateISO, pH, pS, selectedActivityId)
      } else if (activeTool === "erase") {
        if (lastPlanExecTool === "plan") eraseOverlayCell(dateISO, pH, pS)
        else eraseCell(dateISO, pH, pS)
      }
    }
    pendingPaintRef.current = null
    paintConfirmedRef.current = false
    isPointerDownRef.current = false
    setIsDragging(false)
    hasDraggedRef.current = false
  }, [activeTool, newEventDragging, newEventStart, newEventEnd, selectedActivityId, lastPlanExecTool, dateISO, paintCell, paintOverlayCell, eraseCell, eraseOverlayCell, pushSnapshot])

  const handleGlobalPointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    if (activeTool === "new" && newEventDragging && newEventStart && newEventEnd) {
      setNewEventDragging(false)
      setNewEventDialog(true)
    }

    // pending tap 처리 (터치 탭 → 단일 셀 paint)
    if (pendingPaintRef.current && !paintConfirmedRef.current && !hasDraggedRef.current) {
      const { hour: pH, segment: pS } = pendingPaintRef.current
      if (!snapshotPushedRef.current) {
        pushSnapshot()
        snapshotPushedRef.current = true
      }
      if (activeTool === "execute" && selectedActivityId) {
        paintCell(dateISO, pH, pS, selectedActivityId)
      } else if (activeTool === "plan" && selectedActivityId) {
        paintOverlayCell(dateISO, pH, pS, selectedActivityId)
      } else if (activeTool === "erase") {
        if (lastPlanExecTool === "plan") eraseOverlayCell(dateISO, pH, pS)
        else eraseCell(dateISO, pH, pS)
      }
    }

    pendingPaintRef.current = null
    paintConfirmedRef.current = false
    isPointerDownRef.current = false
    setIsDragging(false)
    hasDraggedRef.current = false
  }, [activeTool, newEventDragging, newEventStart, newEventEnd, selectedActivityId, lastPlanExecTool, dateISO, paintCell, paintOverlayCell, eraseCell, eraseOverlayCell, pushSnapshot])

  // Indicator 생성
  const handleCreateIndicator = useCallback(() => {
    if (indicatorDialog && indicatorLabel.trim()) {
      const min = hourSegmentToMin(indicatorDialog.hour, indicatorDialog.segment)
      addIndicator(dateISO, min, indicatorLabel.trim())
      setIndicatorLabel("")
      setIndicatorDialog(null)
    }
  }, [indicatorDialog, indicatorLabel, dateISO, addIndicator])

  // NEW_EVENT 저장 - 새 Activity 생성 후 블록 추가
  const handleSaveNewEvent = useCallback(() => {
    if (!newEventStart || !newEventEnd || !newEventLabel.trim()) return

    const { addBlock, addActivity, activities: currentActivities } = usePlannerStore.getState()

    // 시작/끝 계산 (순서 정렬)
    let startMin = hourSegmentToMin(newEventStart.hour, newEventStart.segment)
    let endMin = hourSegmentToMin(newEventEnd.hour, newEventEnd.segment) + 10

    if (startMin > endMin) {
      [startMin, endMin] = [endMin - 10, startMin + 10]
    }

    // 항상 새 Activity 생성 (신규생성은 새 항목을 만드는 것)
    const newActivityId = `activity-${Date.now()}`
    addActivity(newEventLabel.trim(), newEventColor)

    pushSnapshot()
    
    // 새로 생성된 activity 찾기
    const { activities: updatedActivities } = usePlannerStore.getState()
    const newActivity = updatedActivities.find(a => 
      a.name === newEventLabel.trim() && a.color === newEventColor
    )
    
    addBlock({
      dateISO,
      startMin,
      endMin,
      activityId: newActivity?.id || newActivityId,
      layer: "execute",
      source: "manual",
    })

    setNewEventLabel("")
    setNewEventColor(colorOptions[0])
    setNewEventStart(null)
    setNewEventEnd(null)
    setNewEventDialog(false)
  }, [newEventStart, newEventEnd, newEventLabel, newEventColor, dateISO, pushSnapshot])

  // NEW_EVENT 취소
  const handleCancelNewEvent = useCallback(() => {
    setNewEventLabel("")
    setNewEventColor(colorOptions[0])
    setNewEventStart(null)
    setNewEventEnd(null)
    setNewEventDialog(false)
    setNewEventDragging(false)
  }, [])

  // 체크리스트 저장 + 할일 연동
  const handleSaveChecklist = useCallback(() => {
    const validItems = checklistItems.filter((ci) => ci.text.trim())
    if (validItems.length === 0) {
      setChecklistDialog(null)
      return
    }

    const totalDuration = checklistEndMin - checklistStartMin
    const perItemDur = Math.max(10, Math.floor(totalDuration / validItems.length))

    const items = validItems.map((ci, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      text: ci.text.trim(),
      done: false,
      durationMin: perItemDur,
    }))

    addChecklistBlock({
      dateISO,
      startMin: checklistStartMin,
      endMin: checklistEndMin,
      layer: checklistDialog?.hasBlock ? "execute" : "overlay",
      items,
      position: checklistDialog?.position ?? "main",
      overlapIndex: checklistDialog?.overlapIndex ?? 0,
    })

    // 할일 뷰에 자동 연동: 체크리스트 항목을 PlannerTask로 추가
    const startTimeStr = `${String(Math.floor(checklistStartMin / 60)).padStart(2, "0")}:${String(checklistStartMin % 60).padStart(2, "0")}`
    for (const ci of validItems) {
      addTask({
        title: ci.text.trim(),
        status: "todo" as const,
        dueDate: dateISO,
        note: `체크리스트 연동 (${startTimeStr})`,
      })
    }

    setChecklistDialog(null)
    setChecklistItems([{ text: "" }])
    setChecklistStartMin(0)
    setChecklistEndMin(60)
  }, [checklistDialog, checklistItems, checklistStartMin, checklistEndMin, dateISO, addChecklistBlock, addTask])

  // 체크리스트 항목 텍스트 업데이트
  const updateChecklistItem = useCallback((index: number, value: string) => {
    setChecklistItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], text: value }
      return updated
    })
  }, [])

  // NEW_EVENT 드래그 프리뷰 계산
  const newEventPreview = useMemo(() => {
    if (!newEventStart || !newEventEnd) return null

    let startMin = hourSegmentToMin(newEventStart.hour, newEventStart.segment)
    let endMin = hourSegmentToMin(newEventEnd.hour, newEventEnd.segment) + 10

    if (startMin > endMin) {
      [startMin, endMin] = [endMin - 10, startMin + 10]
    }

    return { startMin, endMin }
  }, [newEventStart, newEventEnd])

  // 현재 시간 위치 계산 (startHour 기준) - 해당 시간 칸 내에서 분 단위로 이동
  const currentTimePosition = useMemo(() => {
    if (!isToday) return null
    
    const currentHour = Math.floor(currentMin / 60)
    const hourIndex = hours.indexOf(currentHour)
    if (hourIndex === -1) return null
    
    const minuteInHour = currentMin % 60
    // 세로선: 60분 중 현재 위치 (%)
    const leftPercent = (minuteInHour / 60) * 100
    // 시작 top 위치
    const topOffset = hourIndex * hourHeight
    
    return { 
      hourIndex,
      top: topOffset, 
      leftPercent,
      time: minToTime(currentMin),
      height: hourHeight
    }
  }, [isToday, currentMin, hours])

  // ===== 모바일 터치 드래그 지원 =====
  // 모바일에서는 pointerenter가 터치 드래그 중 발생하지 않으므로
  // touchmove + elementFromPoint 패턴 사용
  const lastTouchCellRef = useRef<string | null>(null)

  // ===== 타임라인 스와이프로 날짜 이동 =====
  const swipeTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const swipeLockRef = useRef<"h" | "v" | null>(null) // 방향 잠금

  const handleTimelineSwipeStart = useCallback((e: React.TouchEvent) => {
    if (isDragging || newEventDragging) return
    swipeTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() }
    swipeLockRef.current = null
  }, [isDragging, newEventDragging])

  const handleTimelineSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeTouchStartRef.current) return
    const dx = e.changedTouches[0].clientX - swipeTouchStartRef.current.x
    const dy = e.changedTouches[0].clientY - swipeTouchStartRef.current.y
    const dt = Date.now() - swipeTouchStartRef.current.time
    swipeTouchStartRef.current = null
    swipeLockRef.current = null

    // 수평 스와이프: 거리 50px 이상, 시간 400ms 이하, 수평>수직
    if (Math.abs(dx) > 50 && dt < 400 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (isDragging || newEventDragging || isPointerDownRef.current) return
      const next = new Date(selectedDate)
      if (dx < 0) next.setDate(next.getDate() + 1)  // 왼쪽 스와이프 → 다음 날
      else         next.setDate(next.getDate() - 1)  // 오른쪽 스와이프 → 이전 날
      setSelectedDate(next)
      haptic.light()
    }
  }, [isDragging, newEventDragging, selectedDate, setSelectedDate])

  // ===== 블록 롱프레스 컨텍스트 메뉴 =====
  const [blockMenu, setBlockMenu] = useState<{
    blockId: string
    dateISO: string
    activityName: string
    x: number
    y: number
  } | null>(null)
  const blockLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBlockPointerDown = useCallback((e: React.PointerEvent, block: Block) => {
    e.stopPropagation()
    const cx = e.clientX
    const cy = e.clientY
    blockLongPressRef.current = setTimeout(() => {
      haptic.heavy()
      const activity = activities.find(a => a.id === block.activityId)
      setBlockMenu({
        blockId: block.id,
        dateISO: block.startMin >= 0 ? dateISO : dateISO,
        activityName: activity?.name ?? "블록",
        x: cx,
        y: cy,
      })
    }, 500)
  }, [activities, dateISO])

  const handleBlockPointerUp = useCallback(() => {
    if (blockLongPressRef.current) {
      clearTimeout(blockLongPressRef.current)
      blockLongPressRef.current = null
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPointerDownRef.current) return
    const tool = activeTool as string
    if (tool !== "execute" && tool !== "plan" && tool !== "erase" && tool !== "new") return

    const touch = e.touches[0]
    const startPos = startPosRef.current

    // === 아직 paint가 확정되지 않은 pending 상태일 때 threshold 검사 ===
    if (pendingPaintRef.current && !paintConfirmedRef.current && startPos) {
      const dx = Math.abs(touch.clientX - startPos.x)
      const dy = Math.abs(touch.clientY - startPos.y)

      // 수직 이동이 threshold 초과 → 스크롤 의도 → paint 취소
      if (dy > DRAG_THRESHOLD && dy > dx * 1.5) {
        pendingPaintRef.current = null
        isPointerDownRef.current = false
        // long-press 타이머도 취소
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current)
          longPressTimerRef.current = null
        }
        return // 스크롤 허용 (e.preventDefault 호출 안 함)
      }

      // 수평 이동이 threshold 초과 → 드래그 paint 확정
      if (dx > DRAG_THRESHOLD || (dx > 4 && dx > dy)) {
        paintConfirmedRef.current = true
        setIsDragging(true)
        // pending 셀 먼저 paint
        const { hour: pH, segment: pS } = pendingPaintRef.current
        if (!snapshotPushedRef.current) {
          pushSnapshot()
          snapshotPushedRef.current = true
        }
        if (activeTool === "execute" && selectedActivityId) {
          paintCell(dateISO, pH, pS, selectedActivityId)
        } else if (activeTool === "plan" && selectedActivityId) {
          const cellKey = `${pH}-${pS}`
          dragPaintedCellsRef.current.add(cellKey)
          paintOverlayCell(dateISO, pH, pS, selectedActivityId)
        } else if (activeTool === "erase") {
          if (lastPlanExecTool === "plan") eraseOverlayCell(dateISO, pH, pS)
          else eraseCell(dateISO, pH, pS)
        }
        pendingPaintRef.current = null
      } else {
        // 아직 threshold 미만 → 아무것도 하지 않고 대기
        return
      }
    }

    // === paint 확정 상태가 아니면 리턴 (스크롤 중) ===
    if (!paintConfirmedRef.current && !newEventDragging) return

    e.preventDefault() // 스크롤 방지 (드래그 모드 확정 후)

    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null
    if (!el) return

    // data-cell 속성으로 셀 식별
    const cellEl = el.closest("[data-cell]") as HTMLElement | null
    if (!cellEl) return

    const cellKey = cellEl.dataset.cell!
    if (cellKey === lastTouchCellRef.current) return
    lastTouchCellRef.current = cellKey

    const [hourStr, segStr] = cellKey.split("-")
    const hour = parseInt(hourStr)
    const segment = parseInt(segStr)

    // long-press 타이머 취소
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    hasDraggedRef.current = true

    if (activeTool === "new" && newEventDragging) {
      setNewEventEnd({ hour, segment })
      return
    }

    if (activeTool === "execute" || activeTool === "plan" || activeTool === "erase") {
      if (!snapshotPushedRef.current) {
        pushSnapshot()
        snapshotPushedRef.current = true
      }
      if (activeTool === "execute" && selectedActivityId) {
        paintCell(dateISO, hour, segment, selectedActivityId)
      } else if (activeTool === "plan" && selectedActivityId) {
        paintOverlayCell(dateISO, hour, segment, selectedActivityId)
      } else if (activeTool === "erase") {
        if (lastPlanExecTool === "plan") eraseOverlayCell(dateISO, hour, segment)
        else eraseCell(dateISO, hour, segment)
      }
    }
  }, [activeTool, newEventDragging, selectedActivityId, lastPlanExecTool, dateISO, paintCell, paintOverlayCell, eraseCell, eraseOverlayCell, pushSnapshot])

  const handleTouchEnd = useCallback(() => {
    lastTouchCellRef.current = null
    handleGlobalPointerUp()
  }, [handleGlobalPointerUp])

  return (
    <>
      {/* NEW_EVENT 드래그 중 시간 캡슐 */}
      {newEventDragging && newEventPreview && (
        <div 
          className="fixed left-1/2 -translate-x-1/2 z-50"
          style={{ top: 'max(env(safe-area-inset-top, 0px) + 1.25rem, 5rem)' }}
        >
          <div className="bg-primary/90 backdrop-blur-sm text-primary-foreground px-4 py-2 rounded-2xl text-sm font-medium shadow-xl flex items-center gap-2 border border-white/10">
            <span className="tabular-nums">{minToTime(newEventPreview.startMin)}</span>
            <span className="text-primary-foreground/60">→</span>
            <span className="tabular-nums">{minToTime(newEventPreview.endMin)}</span>
            <button 
              onClick={handleCancelNewEvent}
              className="ml-1 hover:bg-white/20 rounded-full p-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div
        ref={timelineRef}
        className="flex-1 overflow-y-auto overflow-x-hidden select-none relative scrollbar-hide"
        style={{ 
          touchAction: isDragging || newEventDragging ? "none" : "pan-y",
          WebkitOverflowScrolling: 'touch',
        }}
        onPointerUp={handleGlobalPointerUp}
        onPointerLeave={handleGlobalPointerUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={(e) => { handleTouchEnd(); handleTimelineSwipeEnd(e) }}
        onTouchStart={handleTimelineSwipeStart}
      >
        <div className="relative">
          {/* 장소 그룹 프레임 — 동일 장소 블록을 점선 테두리로 감쌈 */}
          <PlaceGroupFrames hourHeight={hourHeight} startHour={hours[0] || 0} />

          {hours.map((hour) => {
            const executeSegments = segmentsByHour[hour]?.execute || []
            const overlaySegments = segmentsByHour[hour]?.overlay || []
            const hasOverlay = overlaySegments.length > 0

            // 계획 대비 실행 상태 판별
            const getExecStatus = (seg: Segment): "match" | "extra" | "delay" | null => {
              if (overlaySegments.length === 0 && executeSegments.length === 0) return null
              // 같은 activity의 plan이 있는지 확인
              const matchingPlan = overlaySegments.find(
                (o) => o.activityId === seg.activityId && o.startCol <= seg.endCol && o.endCol >= seg.startCol
              )
              if (!matchingPlan) {
                // plan이 전혀 없는데 execute가 있으면 → 추가
                return hasOverlay ? "extra" : null
              }
              // plan 시작보다 execute 시작이 늦으면 → 딜레이
              if (seg.startCol > matchingPlan.startCol) return "delay"
              return "match"
            }

            return (
              <div key={hour} className="flex border-b border-border/10" style={{ height: `${hourHeight}px` }}>
                {/* 시간 라벨 — 컴팩트 */}
                <div className="w-8 flex-shrink-0 flex items-start justify-end pr-1 pt-0.5">
                  <span className="text-[11px] font-light text-muted-foreground/70 tabular-nums">
                    {hour.toString().padStart(2, "0")}
                  </span>
                </div>

                {/* 6개 세그먼트 영역 — 오른쪽 여백 추가 */}
                <div className="flex-1 relative mr-2">
                  {/* 클릭 영역 (6개 세그먼트) — z-20으로 overlay/execute 블록 위에 위치 */}
                  <div className="absolute inset-0 grid grid-cols-6" style={{ zIndex: 20 }}>
                    {Array.from({ length: 6 }).map((_, segment) => {
                      const indicator = getIndicatorForCell(hour, segment)
                      const min = hourSegmentToMin(hour, segment)

                      // NEW_EVENT 드래그 프리뷰 영역 확인
                      const isInNewEventPreview =
                        newEventDragging &&
                        newEventPreview &&
                        min >= newEventPreview.startMin &&
                        min < newEventPreview.endMin

                      return (
                        <div
                          key={segment}
                          data-cell={`${hour}-${segment}`}
                          className={`relative cursor-pointer group ${
                            segment > 0 ? "border-l border-border/30" : ""
                          }`}
                          onPointerDown={(e) => handlePointerDown(e, hour, segment)}
                          onPointerEnter={(e) => handlePointerEnter(e, hour, segment)}
                          onPointerUp={(e) => handlePointerUp(e, hour, segment)}
                        >
                          {/* 호버 효과 */}
                          <div className="absolute inset-[1px] bg-foreground/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm" />

                          {/* NEW_EVENT 드래그 프리뷰 */}
                          {isInNewEventPreview && (
                            <div
                              className="absolute inset-[2px] rounded-md opacity-60"
                              style={{ backgroundColor: newEventColor }}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Overlay(계획) 블록 렌더링 — 반투명, 이름 없음, z-5, 겹침 시 하단 분리 */}
                  {(() => {
                    // 계획 블록 높이: execute와 동일하게 hourHeight 100% → 겹침 시 하단 분리
                    const OVL_H   = hourHeight  // 1번 블록은 칸 100% 꽉 채움
                    const OVL_TOP = 0

                    return overlaySegments.map((segment, idx) => {
                      const widthPercent = ((segment.endCol - segment.startCol + 1) / 6) * 100
                      const leftPercent = (segment.startCol / 6) * 100

                      // 겹치는 overlay segments (같은 col 범위 겹침)
                      const overlapping = overlaySegments.filter(
                        (s) => s.startCol <= segment.endCol && s.endCol >= segment.startCol
                      ).sort((a, b) => {
                        const aMin = Math.min(...a.blocks.map(bl => bl.createdAt))
                        const bMin = Math.min(...b.blocks.map(bl => bl.createdAt))
                        return aMin - bMin
                      })
                      const overlapIndex = overlapping.indexOf(segment)
                      const overlapCount = Math.min(overlapping.length, 2)
                      // 3번째 이상 중복은 표시하지 않음
                      if (overlapIndex >= 2) return null

                      const continuesFromPrev = segment.startCol === 0 && blocks.some(
                        (b) => b.layer === "overlay" && b.activityId === segment.activityId && b.endMin === hour * 60
                      )
                      const continuesToNext = segment.endCol === 5 && blocks.some(
                        (b) => b.layer === "overlay" && b.activityId === segment.activityId && b.startMin === (hour + 1) * 60
                      )
                      const roundLeft  = segment.startCol === 0 ? !continuesFromPrev : true
                      const roundRight = segment.endCol === 5   ? !continuesToNext   : true
                      const borderRadius = `${roundLeft ? "4px" : "0"} ${roundRight ? "4px" : "0"} ${roundRight ? "4px" : "0"} ${roundLeft ? "4px" : "0"}`

                      // 겹침 시 세로 분리: 첫 번째는 칸 꽉 채움, 두 번째부터 하단 얇은 줄
                      let topPx: number
                      let heightPx: number
                      if (overlapCount <= 1) {
                        topPx    = OVL_TOP
                        heightPx = OVL_H
                      } else {
                        const mainH = Math.round(OVL_H * (2 / 3))
                        const subH  = Math.max(8, Math.floor((OVL_H - mainH) / (overlapCount - 1)))
                        if (overlapIndex === 0) {
                          topPx    = OVL_TOP
                          heightPx = mainH
                        } else {
                          topPx    = OVL_TOP + mainH + (overlapIndex - 1) * subH
                          heightPx = subH
                        }
                      }
                      const bottomPx = hourHeight - (topPx + heightPx)

                      return (
                        <div
                          key={`overlay-${idx}`}
                          className="absolute pointer-events-none"
                          style={{
                            backgroundColor: getActivityColor(segment.activityId),
                            opacity: 0.45,
                            top: `${topPx}px`,
                            bottom: `${bottomPx}px`,
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            borderRadius,
                            zIndex: 5,
                          }}
                        />
                      )
                    })
                  })()}

                  {/* Execute(실제) 블록 렌더링 — 계획 모드일 때 숨김, 불투명, z-10, 칸의 80% 높이 중앙 */}
                  {activeTool !== "plan" && (() => {
                    // 실행 블록 높이: hourHeight의 80%, 상하 중앙
                    const EXEC_H   = Math.round(hourHeight * 0.8)
                    const EXEC_TOP = Math.round((hourHeight - EXEC_H) / 2)

                    return executeSegments.map((segment, idx) => {
                      const widthPercent = ((segment.endCol - segment.startCol + 1) / 6) * 100
                      const leftPercent = (segment.startCol / 6) * 100

                      const overlapping = executeSegments.filter(
                        (s) => s.startCol <= segment.endCol && s.endCol >= segment.startCol
                      ).sort((a, b) => {
                        const aMin = Math.min(...a.blocks.map(bl => bl.createdAt))
                        const bMin = Math.min(...b.blocks.map(bl => bl.createdAt))
                        return aMin - bMin
                      })
                      const overlapIndex = overlapping.indexOf(segment)
                      const overlapCount = Math.min(overlapping.length, 2)
                      // 3번째 이상 중복은 표시하지 않음
                      if (overlapIndex >= 2) return null

                      const continuesFromPrev = segment.startCol === 0 && blocks.some(
                        (b) => b.layer === "execute" && b.activityId === segment.activityId && b.endMin === hour * 60
                      )
                      const continuesToNext = segment.endCol === 5 && blocks.some(
                        (b) => b.layer === "execute" && b.activityId === segment.activityId && b.startMin === (hour + 1) * 60
                      )
                      const roundLeft  = segment.startCol === 0 ? !continuesFromPrev : true
                      const roundRight = segment.endCol === 5   ? !continuesToNext   : true
                      const borderRadius = `${roundLeft ? "4px" : "0"} ${roundRight ? "4px" : "0"} ${roundRight ? "4px" : "0"} ${roundLeft ? "4px" : "0"}`

                      // 겹침 시 세로 분리 (80% 영역 안에서)
                      let topPx: number
                      let heightPx: number
                      if (overlapCount <= 1) {
                        topPx    = EXEC_TOP
                        heightPx = EXEC_H
                      } else {
                        const mainH = Math.round(EXEC_H * (2 / 3))
                        const subH  = Math.max(8, Math.floor((EXEC_H - mainH) / (overlapCount - 1)))
                        if (overlapIndex === 0) {
                          topPx    = EXEC_TOP
                          heightPx = mainH
                        } else {
                          topPx    = EXEC_TOP + mainH + (overlapIndex - 1) * subH
                          heightPx = subH
                        }
                      }
                      const bottomPx = hourHeight - (topPx + heightPx)
                      // 롱프레스용: 이 segment의 대표 block
                      const repBlock = segment.blocks[0]

                      return (
                        <div
                          key={`exec-${idx}`}
                          className="absolute overflow-hidden"
                          style={{
                            backgroundColor: getActivityColor(segment.activityId),
                            top: `${topPx}px`,
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            bottom: `${bottomPx}px`,
                            borderRadius,
                            zIndex: 10,
                            pointerEvents: activeTool === "select" ? "auto" : "none",
                            cursor: activeTool === "select" ? "pointer" : "default",
                          }}
                          onPointerDown={activeTool === "select" ? (e) => handleBlockPointerDown(e, repBlock) : undefined}
                          onPointerUp={activeTool === "select" ? handleBlockPointerUp : undefined}
                          onPointerLeave={activeTool === "select" ? handleBlockPointerUp : undefined}
                        >
                          {/* 이름: 왼쪽 상단 */}
                          {(overlapIndex === 0 || heightPx >= 14) && heightPx >= 12 && (
                            <span
                              className="absolute top-[2px] left-[4px] text-[9px] font-semibold leading-none truncate"
                              style={{ color: "#1a1a1a", maxWidth: "calc(100% - 22px)" }}
                            >
                              {/* 장소 이모지 */}
                              {repBlock.placeId && (() => {
                                const pl = places.find(p => p.id === repBlock.placeId)
                                return pl?.icon ? <span className="mr-[2px]">{pl.icon}</span> : null
                              })()}
                              {getActivityName(segment.activityId)}
                            </span>
                          )}
                          {/* 계획 대비 상태 뱃지 */}
                          {(() => {
                            const status = getExecStatus(segment)
                            if (!status || status === "match") return null
                            if (status === "extra") return (
                              <span className="absolute top-0 right-0 text-[6px] leading-none bg-emerald-500 text-white px-[3px] py-[1px] rounded-bl-sm rounded-tr-sm font-bold">추가</span>
                            )
                            if (status === "delay") return (
                              <span className="absolute top-0 right-0 text-[6px] leading-none bg-orange-500 text-white px-[3px] py-[1px] rounded-bl-sm rounded-tr-sm font-bold">딜레이</span>
                            )
                            return null
                          })()}
                          {/* 블록별 이모지 — 오른쪽 상단 */}
                          {heightPx >= 14 && (() => {
                            const blockKey = `${segment.activityId}-${hour}-${segment.startCol}`
                            const status = getExecStatus(segment)
                            const hasStatusBadge = status && status !== "match"
                            const emojiEntry = todayBlockEmojis.find(e => e.blockId === blockKey)
                            return (
                              <button
                                className={`absolute top-0 right-0 text-[11px] leading-none px-[2px] pt-[1px] transition-opacity ${
                                  emojiEntry ? "opacity-100" : "opacity-0 hover:opacity-60"
                                } ${hasStatusBadge ? "hidden" : ""}`}
                                style={{ pointerEvents: "auto" }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                  setEmojiPickerTarget({ blockId: blockKey, x: rect.left, y: rect.bottom })
                                }}
                              >
                                {emojiEntry ? emojiEntry.emoji : "＋"}
                              </button>
                            )
                          })()}
                        </div>
                      )
                    })
                  })()}

                  {/* 체크리스트 블록 렌더링 */}
                  {(() => {
                    const hourStart = hour * 60
                    const hourEnd   = (hour + 1) * 60
                    const COL_W     = 100 / 6

                    // execute 블록 크기 상수 (렌더링과 동일)
                    const EXEC_H   = Math.round(hourHeight * 0.8)
                    const EXEC_TOP = Math.round((hourHeight - EXEC_H) / 2)

                    const CAPSULE_H   = 11  // 캡슐 높이
                    const CAPSULE_GAP = 1   // 캡슐 사이 간격

                    // startMin이 이 hour에 속하는 블록
                    const hourCBs = getChecklistBlocksForHour(hour).filter(
                      (cb) => cb.startMin >= hourStart && cb.startMin < hourEnd
                    )

                    // execute 블록의 top/height 계산 (렌더링과 동일 로직)
                    const getExecBlockRect = (overlapIdx: number, overlapCnt: number): { top: number; height: number } => {
                      if (overlapCnt <= 1) return { top: EXEC_TOP, height: EXEC_H }
                      const mainH = Math.round(EXEC_H * (2 / 3))
                      const subH  = Math.max(8, Math.floor((EXEC_H - mainH) / (overlapCnt - 1)))
                      if (overlapIdx === 0) return { top: EXEC_TOP, height: mainH }
                      return { top: EXEC_TOP + mainH + (overlapIdx - 1) * subH, height: subH }
                    }

                    // overlapIndex별로 그룹핑 — 각 그룹의 총 캡슐 수(items 합) 계산용
                    // key: overlapIndex → { totalItems, cbList }
                    const byOverlap = new Map<number, { totalItems: number; cbList: typeof hourCBs }>()
                    for (const cb of hourCBs) {
                      const oi = cb.overlapIndex ?? 0
                      if (!byOverlap.has(oi)) byOverlap.set(oi, { totalItems: 0, cbList: [] })
                      const g = byOverlap.get(oi)!
                      g.cbList.push(cb)
                      g.totalItems += cb.items.length
                    }
                    // 각 그룹 내 createdAt 순 정렬
                    byOverlap.forEach((g) => g.cbList.sort((a, b) => a.createdAt - b.createdAt))

                    // 렌더링할 캡슐 목록 생성: cb × item 각각 하나씩
                    const capsules: {
                      key: string
                      cbId: string
                      item: typeof hourCBs[0]["items"][0]
                      itemIdx: number
                      slotIdx: number       // 이 overlapIndex 그룹 내 전체 슬롯 인덱스
                      totalSlots: number    // 이 overlapIndex 그룹 내 전체 슬롯 수
                      overlapIdx: number
                      startCol: number
                      spanCols: number
                      leftPct: number
                      widthPct: number
                    }[] = []

                    for (const cb of hourCBs) {
                      const clampedStart = Math.max(cb.startMin, hourStart)
                      const clampedEnd   = Math.min(cb.endMin, hourEnd)
                      const startCol = Math.floor((clampedStart - hourStart) / 10)
                      const endCol   = Math.min(5, Math.ceil((clampedEnd - hourStart) / 10) - 1)
                      const spanCols = Math.max(1, endCol - startCol + 1)
                      const leftPct  = startCol * COL_W
                      const widthPct = spanCols * COL_W

                      const oi    = cb.overlapIndex ?? 0
                      const group = byOverlap.get(oi)!

                      // 이 cb 이전에 같은 overlapIndex 그룹 내 누적 items 수
                      let prevItems = 0
                      for (const prev of group.cbList) {
                        if (prev.id === cb.id) break
                        prevItems += prev.items.length
                      }

                      cb.items.forEach((item, itemIdx) => {
                        capsules.push({
                          key:        `${cb.id}-${item.id}`,
                          cbId:       cb.id,
                          item,
                          itemIdx,
                          slotIdx:    prevItems + itemIdx,
                          totalSlots: group.totalItems,
                          overlapIdx: oi,
                          startCol,
                          spanCols,
                          leftPct,
                          widthPct,
                        })
                      })
                    }

                    return capsules.map(({ key, cbId, item, slotIdx, totalSlots, overlapIdx, leftPct, widthPct, startCol, spanCols }) => {
                      // execute 겹침 수 계산
                      const endCol    = startCol + spanCols - 1
                      const overlapCnt = executeSegments.filter(
                        s => s.startCol <= endCol && s.endCol >= startCol
                      ).length

                      // 이 execute 블록의 top/height
                      const { top: execBlockTop, height: execBlockH } = getExecBlockRect(overlapIdx, overlapCnt)

                      // 캡슐 묶음 전체 높이
                      const totalH   = totalSlots * CAPSULE_H + (totalSlots - 1) * CAPSULE_GAP
                      // exec 블록 세로 중앙에 묶음 배치
                      const bundleTop = execBlockTop + Math.round((execBlockH - totalH) / 2)
                      // 이 슬롯의 캡슐 top
                      const capTop    = bundleTop + slotIdx * (CAPSULE_H + CAPSULE_GAP)

                      return (
                        <div
                          key={key}
                          className="absolute pointer-events-auto"
                          style={{
                            top:    capTop,
                            height: CAPSULE_H,
                            left:   `calc(${leftPct}% + 2px)`,
                            width:  `calc(${widthPct}% - 4px)`,
                            zIndex: 25,
                          }}
                        >
                          <div
                            className="flex items-center gap-1 bg-white/85 backdrop-blur-sm rounded-full px-1 h-full shadow-sm cursor-pointer hover:bg-white/95 transition-colors w-full overflow-hidden"
                            onClick={() => {
                              haptic.success()
                              toggleChecklistBlockItem(dateISO, cbId, item.id)
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation()
                              const cx = e.clientX
                              const cy = e.clientY
                              checklistLongPressRef.current = setTimeout(() => {
                                haptic.heavy()
                                setChecklistBlockMenu({
                                  cbId,
                                  dateISO,
                                  itemText: item.text,
                                  x: cx,
                                  y: cy,
                                })
                              }, 500)
                            }}
                            onPointerUp={() => {
                              if (checklistLongPressRef.current) {
                                clearTimeout(checklistLongPressRef.current)
                                checklistLongPressRef.current = null
                              }
                            }}
                            onPointerLeave={() => {
                              if (checklistLongPressRef.current) {
                                clearTimeout(checklistLongPressRef.current)
                                checklistLongPressRef.current = null
                              }
                            }}
                          >
                            {/* 체크박스 네모 */}
                            <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-[2px] border flex items-center justify-center transition-colors ${
                              item.done
                                ? "border-blue-500 bg-transparent"
                                : "border-slate-400 bg-transparent"
                            }`}>
                              {item.done && (
                                <svg className="w-1.5 h-1.5" viewBox="0 0 6 6" fill="none">
                                  <path d="M1 3l1.5 1.5L5 1.5" stroke="#3B82F6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <span className={`text-[7.5px] leading-tight truncate flex-1 ${
                              item.done
                                ? "line-through text-muted-foreground/40"
                                : "text-slate-700 font-medium"
                            }`}>
                              {item.text}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  })()}

                  {/* Indicator 표시 — 블록 위에 렌더링 */}
                  {Array.from({ length: 6 }).map((_, seg) => {
                    const indicator = getIndicatorForCell(hour, seg)
                    if (!indicator) return null
                    const leftPercent = (seg / 6) * 100
                    const widthPercent = 100 / 6
                    return (
                      <div
                        key={`ind-${seg}`}
                        className="absolute z-30 pointer-events-auto"
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          top: 0,
                        }}
                      >
                        <div className="flex items-center gap-0.5 px-1 py-0.5 bg-amber-500/90 rounded-t-sm">
                          <span className="text-[8px] text-amber-900 font-medium">
                            {minToTime(indicator.atMin)}
                          </span>
                          <span className="text-[8px] font-medium text-amber-900 truncate flex-1">
                            {indicator.label}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeIndicator(dateISO, indicator.id) }}
                            className="hover:bg-amber-600/50 rounded p-0.5"
                          >
                            <X className="w-2.5 h-2.5 text-amber-900" />
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {/* 현재 시간 인디케이터 - 해당 시간 칸 내에서만 세로선 */}
                  {currentTimePosition && currentTimePosition.hourIndex === hours.indexOf(hour) && (
                    <>
                      {/* 세로선 */}
                      <div
                        className="absolute w-0.5 bg-red-500 z-40 pointer-events-none"
                        style={{ 
                          left: `${currentTimePosition.leftPercent}%`,
                          top: 0,
                          bottom: 0,
                        }}
                      />
                      {/* 상단 시간 라벨 */}
                      <div
                        className="absolute z-50 pointer-events-none"
                        style={{ 
                          left: `${currentTimePosition.leftPercent}%`,
                          top: "-16px",
                          transform: "translateX(-50%)",
                        }}
                      >
                        <div className="bg-red-500 text-white text-[9px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap">
                          {currentTimePosition.time}
                        </div>
                      </div>
                      {/* 하단 삼각형 */}
                      <div
                        className="absolute z-40 pointer-events-none"
                        style={{
                          left: `${currentTimePosition.leftPercent}%`,
                          bottom: "0px",
                          transform: "translateX(-50%)",
                          width: 0,
                          height: 0,
                          borderLeft: "5px solid transparent",
                          borderRight: "5px solid transparent",
                          borderTop: "6px solid rgb(239 68 68)",
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Indicator 다이얼로그 */}
      <Dialog open={!!indicatorDialog} onOpenChange={(open) => !open && setIndicatorDialog(null)}>
        <DialogContent className="w-[90vw] max-w-[340px] mx-4 rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base">지표 추가</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            {indicatorDialog && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg w-fit">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-sm text-muted-foreground tabular-nums">
                  {indicatorDialog.hour.toString().padStart(2, "0")}:
                  {(indicatorDialog.segment * 10).toString().padStart(2, "0")}
                </span>
              </div>
            )}
            <Input
              placeholder="지표 이름 (예: 기상, 취침...)"
              value={indicatorLabel}
              onChange={(e) => setIndicatorLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateIndicator()}
              autoFocus
              className="h-9 text-sm rounded-xl"
            />
            <Button onClick={handleCreateIndicator} disabled={!indicatorLabel.trim()} size="sm" className="rounded-xl">
              추가하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NEW_EVENT 다이얼로그 */}
      <Dialog open={newEventDialog} onOpenChange={(open) => !open && handleCancelNewEvent()}>
        <DialogContent className="w-[90vw] max-w-[360px] mx-4 rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base">신규 일정</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            {newEventPreview && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg w-fit">
                <span className="text-sm text-muted-foreground tabular-nums">
                  {minToTime(newEventPreview.startMin)} → {minToTime(newEventPreview.endMin)}
                </span>
              </div>
            )}
            <Input
              placeholder="일정 이름 입력..."
              value={newEventLabel}
              onChange={(e) => setNewEventLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveNewEvent()}
              autoFocus
              className="h-9 text-sm rounded-xl"
            />
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">색상</span>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewEventColor(color)}
                    className={`w-7 h-7 rounded-full transition-all ${
                      newEventColor === color
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={handleCancelNewEvent} className="flex-1 rounded-xl" size="sm">
                취소
              </Button>
              <Button onClick={handleSaveNewEvent} disabled={!newEventLabel.trim()} className="flex-1 rounded-xl" size="sm">
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checklist 다이얼로그 (Long-press) */}
      <Dialog open={!!checklistDialog} onOpenChange={(open) => !open && setChecklistDialog(null)}>
        <DialogContent className="w-[90vw] max-w-[360px] mx-4 rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base">체크리스트 추가</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">

            {/* 시작 시간 고정 표시 + 종료 시간 +/- 조정 */}
            <div className="flex items-center gap-3 bg-muted/30 rounded-xl px-3 py-2">
              <div className="flex flex-col flex-1">
                <span className="text-[10px] text-muted-foreground mb-0.5">시작</span>
                <span className="text-sm font-mono font-semibold tabular-nums">
                  {String(Math.floor(checklistStartMin / 60)).padStart(2, "0")}:{String(checklistStartMin % 60).padStart(2, "0")}
                </span>
              </div>
              <span className="text-muted-foreground/40">→</span>
              <div className="flex flex-col flex-1">
                <span className="text-[10px] text-muted-foreground mb-0.5">종료</span>
                <span className="text-sm font-mono font-semibold tabular-nums">
                  {String(Math.floor(checklistEndMin / 60)).padStart(2, "0")}:{String(checklistEndMin % 60).padStart(2, "0")}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setChecklistEndMin(m => Math.min(checklistStartMin + 60, m + 10))}
                  className="w-7 h-7 rounded-lg bg-muted/50 hover:bg-muted text-sm font-bold flex items-center justify-center"
                >+</button>
                <button
                  onClick={() => setChecklistEndMin(m => Math.max(checklistStartMin + 10, m - 10))}
                  className="w-7 h-7 rounded-lg bg-muted/50 hover:bg-muted text-sm font-bold flex items-center justify-center"
                >−</button>
              </div>
            </div>

            {/* 항목 입력 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">항목</label>
              {checklistItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-muted/20 rounded-xl px-2.5 py-2">
                  <div className="w-4 h-4 rounded border border-border/50 flex-shrink-0" />
                  <Input
                    placeholder={`항목 ${idx + 1}`}
                    value={item.text}
                    onChange={(e) => updateChecklistItem(idx, e.target.value)}
                    className="flex-1 h-7 text-sm border-0 bg-transparent focus-visible:ring-0 px-0"
                    autoFocus={idx === checklistItems.length - 1}
                  />
                  {checklistItems.length > 1 && (
                    <button
                      onClick={() => setChecklistItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-muted-foreground/50 hover:text-destructive transition-colors p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {checklistItems.length < 6 && (
                <button
                  className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-xl transition-colors flex items-center justify-center gap-1"
                  onClick={() => setChecklistItems((prev) => [...prev, { text: "" }])}
                >
                  <Plus className="w-3.5 h-3.5" />
                  항목 추가
                </button>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setChecklistDialog(null)} className="flex-1 rounded-xl" size="sm">
                취소
              </Button>
              <Button
                onClick={handleSaveChecklist}
                disabled={!checklistItems.some((i) => i.text.trim())}
                className="flex-1 rounded-xl"
                size="sm"
              >
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 블록 롱프레스 컨텍스트 메뉴 */}
      {blockMenu && (
        <>
          {/* 배경 딤 */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setBlockMenu(null)}
          />
          {/* 메뉴 카드 */}
          <div
            className="fixed z-[70] bg-background border border-border/30 rounded-2xl shadow-2xl overflow-hidden min-w-[160px]"
            style={{
              left: Math.min(blockMenu.x, window.innerWidth - 180),
              top: Math.min(blockMenu.y, window.innerHeight - 120),
            }}
          >
            <div className="px-4 py-2.5 border-b border-border/20 bg-muted/30">
              <span className="text-xs font-semibold text-foreground truncate block">{blockMenu.activityName}</span>
              <span className="text-[10px] text-muted-foreground">블록 옵션</span>
            </div>
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors text-left"
              onClick={() => {
                haptic.heavy()
                pushSnapshot()
                // 블록 삭제
                removeBlock(blockMenu.blockId, blockMenu.dateISO)
                setBlockMenu(null)
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
              블록 삭제
            </button>
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-orange-500 hover:bg-orange-500/10 transition-colors text-left"
              onClick={() => {
                haptic.heavy()
                pushSnapshot()
                // 블록 + 체크리스트 모두 삭제
                const targetBlock = blocks.find(b => b.id === blockMenu.blockId)
                removeBlock(blockMenu.blockId, blockMenu.dateISO)
                if (targetBlock) {
                  const overlapping = checklistBlocks.filter(
                    cb => cb.startMin < targetBlock.endMin && cb.endMin > targetBlock.startMin
                  )
                  overlapping.forEach(cb => removeChecklistBlock(blockMenu.dateISO, cb.id))
                }
                setBlockMenu(null)
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
              블록 + 체크리스트 삭제
            </button>
          </div>
        </>
      )}

      {/* 블록별 이모지 픽커 팝업 */}
      {emojiPickerTarget && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setEmojiPickerTarget(null)} />
          <div
            className="fixed z-[90] bg-background border border-border/30 rounded-2xl shadow-2xl p-2"
            style={{
              left: Math.min(emojiPickerTarget.x - 60, window.innerWidth - 220),
              top: Math.min(emojiPickerTarget.y + 4, window.innerHeight - 120),
              minWidth: 200,
            }}
          >
            <div className="grid grid-cols-6 gap-1 mb-1.5">
              {QUICK_EMOJIS.map(e => (
                <button key={e}
                  className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-secondary/60 transition-colors"
                  onClick={() => { setBlockEmoji(dateISO, emojiPickerTarget.blockId, e); setEmojiPickerTarget(null) }}
                >{e}</button>
              ))}
            </div>
            {todayBlockEmojis.find(e => e.blockId === emojiPickerTarget.blockId) && (
              <button
                className="w-full text-[11px] text-red-400 hover:bg-red-500/10 rounded-lg py-1 transition-colors"
                onClick={() => { removeBlockEmoji(dateISO, emojiPickerTarget.blockId); setEmojiPickerTarget(null) }}
              >이모지 제거</button>
            )}
          </div>
        </>
      )}

      {/* 체크리스트 블록 롱프레스 메뉴 */}
      {checklistBlockMenu && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setChecklistBlockMenu(null)}
          />
          <div
            className="fixed z-[70] bg-background border border-border/30 rounded-2xl shadow-2xl overflow-hidden min-w-[160px]"
            style={{
              left: Math.min(checklistBlockMenu.x, window.innerWidth - 180),
              top: Math.min(checklistBlockMenu.y, window.innerHeight - 160),
            }}
          >
            <div className="px-4 py-2.5 border-b border-border/20 bg-muted/30">
              <span className="text-xs font-semibold text-foreground truncate block">{checklistBlockMenu.itemText}</span>
              <span className="text-[10px] text-muted-foreground">체크리스트 옵션</span>
            </div>
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors text-left"
              onClick={() => {
                haptic.heavy()
                removeChecklistBlock(checklistBlockMenu.dateISO, checklistBlockMenu.cbId)
                setChecklistBlockMenu(null)
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
              체크리스트 삭제
            </button>
          </div>
        </>
      )}

      {/* 연속 작업 경고 */}
      <ContinuousWorkMonitor />
    </>
  )
}
