// =====================================================
// Digital Life Log Planner v2 — Zustand Store
// =====================================================

import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { persist } from "zustand/middleware"
import type {
  Activity,
  Block,
  Tool,
  IndicatorEvent,
  ChecklistItem,
  ChecklistBlock,
  MemosByCell,
  NewEventDraft,
  Layer,
  BlockSource,
  DailyRoutine,
  WeeklyRoutine,
  PlannerTask,
  TaskStatus,
  BudgetEntry,
  FixedExpense,
  BudgetCategory,
  BulkPurchase,
  BulkConsumeLog,
  DailyCondition,
  TimeBudgetGoal,
  PmsCycle,
  BlockEmoji,
  ConsumableItem,
  ConsumablePurchase,
  ConsumableUseLog,
  LogEntry,
  LogEntryType,
  LogEntryCategory,
  CompletedTaskRecord,
  FocusSession,
  Place,
  Movement,
  TransportMode,
} from "./types"

// 기본 활동 카테고리 — taxonomy(scheduleTaxonomy.ts)와 매핑
// TopCategory → Activity:  CLASS→수업, STUDY→공부, ASSIGN→과제, WORK→알바,
// RESEARCH→논문, MOVE→이동, LIFE→생활, EXERCISE→운동, UNKNOWN→미분류
const defaultActivities: Activity[] = [
  // — 학업 관련 —
  { id: "class",    name: "수업",   color: "#93C5FD", isSystem: true, order: 0 },
  { id: "study",    name: "공부",   color: "#60A5FA", isSystem: true, order: 1 },
  { id: "assign",   name: "과제",   color: "#818CF8", isSystem: true, order: 2 },
  // — 근무/연구 —
  { id: "work",     name: "알바",   color: "#F9A8D4", isSystem: true, order: 3 },
  { id: "research", name: "논문",   color: "#C4B5FD", isSystem: true, order: 4 },
  // — 생활 —
  { id: "move",     name: "이동",   color: "#FDE68A", isSystem: true, order: 5 },
  { id: "life",     name: "생활",   color: "#FDBA74", isSystem: true, order: 6 },
  { id: "exercise", name: "운동",   color: "#86EFAC", isSystem: true, order: 7 },
  { id: "sleep",    name: "수면",   color: "#A5B4FC", isSystem: true, order: 8 },
  { id: "rest",     name: "휴식",   color: "#A5F3FC", isSystem: true, order: 9 },
  // — 기타 —
  { id: "unknown",  name: "미분류", color: "#CBD5E1", isSystem: true, order: 10 },
]

// 기본 장소 목록
const defaultPlaces: Place[] = [
  { id: "home",   name: "집",    icon: "🏠", color: "#93C5FD", isSystem: true, order: 0, createdAt: 0 },
  { id: "school", name: "학교",  icon: "🏫", color: "#86EFAC", isSystem: true, order: 1, createdAt: 0 },
  { id: "cafe",   name: "카페",  icon: "☕", color: "#FDE68A", isSystem: true, order: 2, createdAt: 0 },
  { id: "library",name: "도서관",icon: "📚", color: "#C4B5FD", isSystem: true, order: 3, createdAt: 0 },
  { id: "gym",    name: "헬스장",icon: "🏋️", color: "#F9A8D4", isSystem: true, order: 4, createdAt: 0 },
  { id: "work_place", name: "직장", icon: "🏢", color: "#FDBA74", isSystem: true, order: 5, createdAt: 0 },
]

// 유틸리티 함수
export const formatDateISO = (date: Date): string => {
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, "0")
  const d = date.getDate().toString().padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * startHour 기준 "논리적 날짜" 반환.
 * 현재 시각이 startHour 미만이면 전날로 취급.
 * 예: startHour=6, 새벽 3시 → 어제 dateISO
 */
export const getLogicalDateISO = (now: Date, startHour: number): string => {
  if (now.getHours() < startHour) {
    const prev = new Date(now)
    prev.setDate(prev.getDate() - 1)
    return formatDateISO(prev)
  }
  return formatDateISO(now)
}

export const minToTime = (min: number): string => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

export const timeToMin = (time: string): number => {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

export const snapTo10Min = (min: number): number => {
  return Math.round(min / 10) * 10
}

export const hourSegmentToMin = (hour: number, segment: number): number => {
  return hour * 60 + segment * 10
}

export const minToHourSegment = (min: number): { hour: number; segment: number } => {
  const hour = Math.floor(min / 60)
  const segment = Math.floor((min % 60) / 10)
  return { hour, segment }
}

// 스토어 인터페이스
interface PlannerStore {
  // 기본 상태
  selectedDate: Date
  startHour: number
  viewMode: "day" | "week" | "month" | "settings" | "routine" | "focus" | "stats" | "tasks" | "place"
  activeTool: Tool
  selectedActivityId: string | null
  lastPlanExecTool: "plan" | "execute"  // erase가 참조하는 마지막 plan/execute 모드
  theme: "light" | "dark"
  
  // 데이터
  activities: Activity[]
  blocksByDate: Record<string, Block[]>
  indicatorsByDate: Record<string, IndicatorEvent[]>
  checklistByDate: Record<string, ChecklistItem[]>
  checklistBlocksByDate: Record<string, ChecklistBlock[]>
  memosByDate: Record<string, MemosByCell>
  dailyRoutines: DailyRoutine[]
  weeklyRoutines: WeeklyRoutine[]
  stepsByDate: Record<string, number> // 일별 걸음 수
  wakeUpByDate: Record<string, number> // 일별 기상 시각 (분)
  sleepByDate: Record<string, number> // 일별 취침 시각 (분)
  tasks: PlannerTask[] // 할일/마감 목록
  budgetEntries: BudgetEntry[]    // 가계부 항목
  fixedExpenses: FixedExpense[]   // 고정 지출
  bulkPurchases: BulkPurchase[]   // 묶음소비 구매 목록
  bulkConsumeLogs: BulkConsumeLog[] // 묶음소비 기록
  conditionLogs: DailyCondition[]   // 일별 컨디션 기록
  timeBudgetGoals: TimeBudgetGoal[] // 시간 예산 목표
  pmsCycles: PmsCycle[]             // 생리 주기 기록 (PMS 계산용)
  blockEmojis: BlockEmoji[]         // 실행 블록별 이모지
  consumableItems: ConsumableItem[] // 소모품 품목
  consumablePurchases: ConsumablePurchase[] // 소모품 구매 기록
  consumableUseLogs: ConsumableUseLog[]     // 소모품 사용 기록
  logEntries: LogEntry[]                    // 통합 기록 엔트리
  places: Place[]                            // 장소 목록
  movementsByDate: Record<string, Movement[]> // 일별 이동 기록
  
  // UI 상태
  rightPanelOpen: boolean
  newEventDraft: NewEventDraft | null
  isDragging: boolean
  dragStartMin: number | null
  dragEndMin: number | null
  
  // Undo/Redo
  history: Record<string, Block[]>[]
  historyIndex: number
  
  // 액션 - 기본
  setSelectedDate: (date: Date) => void
  setStartHour: (hour: number) => void
  setViewMode: (mode: "day" | "week" | "month" | "settings" | "routine" | "focus" | "stats" | "tasks" | "place") => void
  setActiveTool: (tool: Tool) => void
  setSelectedActivityId: (id: string | null) => void
  setTheme: (theme: "light" | "dark") => void
  setRightPanelOpen: (open: boolean) => void
  
  // 액션 - Activity
  addActivity: (name: string, color: string, parentId?: string) => void
  updateActivity: (id: string, updates: Partial<Activity>) => void
  removeActivity: (id: string) => void
  reorderActivities: (orderedIds: string[]) => void
  
  // 액션 - Block
  addBlock: (block: Omit<Block, "id" | "createdAt" | "updatedAt">) => void
  updateBlock: (id: string, dateISO: string, updates: Partial<Block>) => void
  removeBlock: (id: string, dateISO: string) => void
  paintCell: (dateISO: string, hour: number, segment: number, activityId: string) => void
  paintOverlayCell: (dateISO: string, hour: number, segment: number, activityId: string) => void
  eraseCell: (dateISO: string, hour: number, segment: number) => void
  eraseOverlayCell: (dateISO: string, hour: number, segment: number) => void
  
  // 액션 - NEW_EVENT
  setNewEventDraft: (draft: NewEventDraft | null) => void
  saveNewEvent: () => void
  
  // 액션 - 드래그
  startDrag: (min: number) => void
  updateDrag: (min: number) => void
  endDrag: () => void
  
  // 액션 - Indicator
  addIndicator: (dateISO: string, atMin: number, label: string) => void
  removeIndicator: (dateISO: string, id: string) => void
  
  // 액션 - Checklist
  addChecklistItem: (dateISO: string, text: string, time?: string) => void
  toggleChecklistItem: (dateISO: string, id: string) => void
  removeChecklistItem: (dateISO: string, id: string) => void
  
  // 액션 - ChecklistBlock
  addChecklistBlock: (block: Omit<ChecklistBlock, "id" | "createdAt" | "updatedAt">) => void
  toggleChecklistBlockItem: (dateISO: string, blockId: string, itemId: string) => void
  removeChecklistBlock: (dateISO: string, blockId: string) => void
  
  // 액션 - 하루 리셋 (startHour 기준)
  clearDayData: (dateISO: string) => void
  
  // 액션 - Routine
  addDailyRoutine: (name: string) => void
  updateDailyRoutine: (id: string, updates: Partial<DailyRoutine>) => void
  removeDailyRoutine: (id: string) => void
  addWeeklyRoutine: (name: string) => void
  updateWeeklyRoutine: (id: string, updates: Partial<WeeklyRoutine>) => void
  removeWeeklyRoutine: (id: string) => void
  addRoutineItem: (routineId: string, type: "daily" | "weekly", dayIndex: number, item: Omit<import("./types").RoutineItem, "id">) => void
  removeRoutineItem: (routineId: string, type: "daily" | "weekly", dayIndex: number, itemId: string) => void
  setDailyRoutineItems: (routineId: string, items: Omit<import("./types").RoutineItem, "id">[]) => void
  setWeeklyRoutineDayItems: (routineId: string, dayIndex: number, items: Omit<import("./types").RoutineItem, "id">[]) => void
  applyDailyRoutineToDate: (routineId: string, dateISO: string) => void
  applyWeeklyRoutineToDate: (routineId: string, startDateISO: string) => void
  
  // 액션 - Undo/Redo
  pushSnapshot: () => void
  undo: () => void
  redo: () => void
  
  // 액션 - 걸음수 / 기상·취침
  setSteps: (dateISO: string, steps: number) => void
  setWakeUp: (dateISO: string, min: number) => void
  setSleep: (dateISO: string, min: number) => void

  // 액션 - 할일/마감
  addTask: (task: Omit<PlannerTask, "id" | "createdAt" | "updatedAt">) => void
  updateTask: (id: string, updates: Partial<PlannerTask>) => void
  removeTask: (id: string) => void
  setTaskStatus: (id: string, status: TaskStatus) => void
  reorderTasks: (orderedIds: string[]) => void
  cleanupDoneTasks: () => void
  completedTaskHistory: CompletedTaskRecord[]
  clearCompletedHistory: () => void

  // 액션 - 가계부
  addBudgetEntry: (entry: Omit<BudgetEntry, "id" | "createdAt" | "updatedAt">) => void
  updateBudgetEntry: (id: string, updates: Partial<BudgetEntry>) => void
  removeBudgetEntry: (id: string) => void
  addFixedExpense: (expense: Omit<FixedExpense, "id" | "createdAt">) => void
  updateFixedExpense: (id: string, updates: Partial<FixedExpense>) => void
  removeFixedExpense: (id: string) => void

  // 액션 - 묶음소비 트래커
  addBulkPurchase: (purchase: Omit<BulkPurchase, "id" | "createdAt" | "updatedAt">) => void
  updateBulkPurchase: (id: string, updates: Partial<BulkPurchase>) => void
  removeBulkPurchase: (id: string) => void
  addBulkConsumeLog: (log: Omit<BulkConsumeLog, "id" | "createdAt">) => void
  removeBulkConsumeLog: (id: string) => void

  // 액션 - 컨디션 기록
  setCondition: (dateISO: string, data: Omit<DailyCondition, "dateISO" | "updatedAt">) => void
  removeCondition: (dateISO: string) => void

  // 액션 - 시간 예산
  addTimeBudgetGoal: (goal: Omit<TimeBudgetGoal, "id" | "createdAt">) => void
  updateTimeBudgetGoal: (id: string, updates: Partial<TimeBudgetGoal>) => void
  removeTimeBudgetGoal: (id: string) => void

  // 액션 - PMS 주기
  addPmsCycle: (cycle: Omit<PmsCycle, "id" | "createdAt">) => void
  updatePmsCycle: (id: string, updates: Partial<Omit<PmsCycle, "id" | "createdAt">>) => void
  removePmsCycle: (id: string) => void

  // 액션 - 블록별 이모지
  setBlockEmoji: (dateISO: string, blockId: string, emoji: string) => void
  removeBlockEmoji: (dateISO: string, blockId: string) => void

  // 액션 - 소모품 트래커
  addConsumableItem: (item: Omit<ConsumableItem, "id" | "createdAt" | "updatedAt">) => void
  updateConsumableItem: (id: string, updates: Partial<ConsumableItem>) => void
  removeConsumableItem: (id: string) => void
  addConsumablePurchase: (purchase: Omit<ConsumablePurchase, "id" | "createdAt">) => void
  removeConsumablePurchase: (id: string) => void
  addConsumableUseLog: (log: Omit<ConsumableUseLog, "id" | "createdAt">) => void
  removeConsumableUseLog: (id: string) => void

  // 액션 - LogEntry (통합 기록)
  addLogEntry: (entry: Omit<LogEntry, "id" | "createdAt" | "updatedAt">) => void
  updateLogEntry: (id: string, updates: Partial<LogEntry>) => void
  removeLogEntry: (id: string) => void
  toggleLogHighlight: (id: string) => void

  // 액션 - 장소 (Place)
  addPlace: (place: Omit<Place, "id" | "createdAt">) => void
  updatePlace: (id: string, updates: Partial<Place>) => void
  removePlace: (id: string) => void
  reorderPlaces: (orderedIds: string[]) => void

  // 액션 - 이동 기록 (Movement)
  addMovement: (movement: Omit<Movement, "id" | "createdAt">) => void
  updateMovement: (id: string, dateISO: string, updates: Partial<Movement>) => void
  removeMovement: (id: string, dateISO: string) => void

  // 액션 - 블록 장소 지정
  setBlockPlace: (blockId: string, dateISO: string, placeId: string | undefined) => void
  setBlocksPlace: (blockIds: string[], dateISO: string, placeId: string | undefined) => void

  // 헬퍼 - 장소
  getPlaceById: (id: string) => Place | undefined
  getMovementsForDate: (dateISO: string) => Movement[]

  // 액션 - 집중 세션 (timestamp 기반)
  focusSession: FocusSession | null
  startFocusSession: (activityId: string, mode: "countdown" | "stopwatch", targetMinutes: number, dailyGoalHours: number) => void
  pauseFocusSession: () => void
  resumeFocusSession: () => void
  endFocusSession: () => void
  clearFocusSession: () => void
  updateFocusSlot: (slotIndex: number, level: 0 | 1 | 2 | 3 | 4 | 5) => void
  
  // 헬퍼
  getBlocksForDate: (dateISO: string) => Block[]
  getActivityById: (id: string) => Activity | undefined
  getIndicatorsForDate: (dateISO: string) => IndicatorEvent[]
  getChecklistForDate: (dateISO: string) => ChecklistItem[]
}

export const usePlannerStore = create<PlannerStore>()(
  persist(
    immer((set, get) => ({
      // 기본 상태 초기값
      selectedDate: new Date(),
      startHour: 6,
      viewMode: "day",
      activeTool: "execute",
      selectedActivityId: "class",
      lastPlanExecTool: "execute" as const,
      theme: "light",
      
      // 데이터 초기값
      activities: defaultActivities,
      blocksByDate: {},
      indicatorsByDate: {},
      checklistByDate: {},
      checklistBlocksByDate: {},
      memosByDate: {},
      dailyRoutines: [],
      weeklyRoutines: [],
      stepsByDate: {},
      wakeUpByDate: {},
      sleepByDate: {},
      tasks: [],
      budgetEntries: [],
      fixedExpenses: [],
      bulkPurchases: [],
      bulkConsumeLogs: [],
      conditionLogs: [],
      timeBudgetGoals: [],
      pmsCycles: [],
      blockEmojis: [],
      consumableItems: [],
      consumablePurchases: [],
      consumableUseLogs: [],
      logEntries: [],
      completedTaskHistory: [],
      focusSession: null as FocusSession | null,
      places: defaultPlaces,
      movementsByDate: {},
      
      // UI 상태 초기값
      rightPanelOpen: false,
      newEventDraft: null,
      isDragging: false,
      dragStartMin: null,
      dragEndMin: null,
      
      // Undo/Redo 초기값
      history: [],
      historyIndex: -1,
      
      // 액션 - 기본
      setSelectedDate: (date) => set({ selectedDate: date }),
      setStartHour: (hour) => set({ startHour: hour }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setActiveTool: (tool) => set((state) => {
        state.activeTool = tool
        if (tool === "plan" || tool === "execute") state.lastPlanExecTool = tool
      }),
      setSelectedActivityId: (id) => set({ selectedActivityId: id }),
      setTheme: (theme) => set({ theme: theme }),
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
      
      // 액션 - Activity
      addActivity: (name, color, parentId) => set((state) => {
        const newActivity: Activity = {
          id: `activity-${Date.now()}`,
          name,
          color,
          parentId,
          order: state.activities.length,
        }
        state.activities.push(newActivity)
      }),
      
      updateActivity: (id, updates) => set((state) => {
        const index = state.activities.findIndex((a) => a.id === id)
        if (index !== -1) {
          Object.assign(state.activities[index], updates)
        }
      }),
      
      removeActivity: (id) => set((state) => {
        const activity = state.activities.find((a) => a.id === id)
        if (activity) {
          // 하위 활동도 함께 삭제
          const idsToRemove = new Set<string>([id])
          const findChildren = (parentId: string) => {
            state.activities.forEach((a) => {
              if (a.parentId === parentId) {
                idsToRemove.add(a.id)
                findChildren(a.id)
              }
            })
          }
          findChildren(id)
          state.activities = state.activities.filter((a) => !idsToRemove.has(a.id))
        }
      }),
      
      reorderActivities: (orderedIds) => set((state) => {
        orderedIds.forEach((id, index) => {
          const act = state.activities.find((a) => a.id === id)
          if (act) act.order = index
        })
      }),
      
      // 액션 - Block
      addBlock: (blockData) => set((state) => {
        const now = Date.now()
        const block: Block = {
          ...blockData,
          id: `block-${now}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: now,
          updatedAt: now,
        }
        if (!state.blocksByDate[blockData.dateISO]) {
          state.blocksByDate[blockData.dateISO] = []
        }
        state.blocksByDate[blockData.dateISO].push(block)
      }),
      
      updateBlock: (id, dateISO, updates) => set((state) => {
        const blocks = state.blocksByDate[dateISO]
        if (blocks) {
          const index = blocks.findIndex((b) => b.id === id)
          if (index !== -1) {
            Object.assign(blocks[index], updates, { updatedAt: Date.now() })
          }
        }
      }),
      
      removeBlock: (id, dateISO) => set((state) => {
        if (state.blocksByDate[dateISO]) {
          state.blocksByDate[dateISO] = state.blocksByDate[dateISO].filter((b) => b.id !== id)
        }
      }),
      
      paintCell: (dateISO, hour, segment, activityId) => set((state) => {
        const startMin = hourSegmentToMin(hour, segment)
        const endMin = startMin + 10
        
        if (!state.blocksByDate[dateISO]) {
          state.blocksByDate[dateISO] = []
        }
        
        const blocks = state.blocksByDate[dateISO]
        
        // 같은 위치, 같은 activity, 같은 layer의 블록이 이미 있으면 무시
        const exactDuplicate = blocks.find(
          (b) => b.layer === "execute" && b.activityId === activityId && b.startMin === startMin && b.endMin === endMin
        )
        
        if (!exactDuplicate) {
          // 새 execute 블록 생성 (다른 블록이 있어도 중복 허용)
          const now = Date.now()
          const newBlock: Block = {
            id: `block-${now}-${Math.random().toString(36).substr(2, 9)}`,
            dateISO,
            startMin,
            endMin,
            activityId,
            layer: "execute" as Layer,
            source: "manual" as BlockSource,
            createdAt: now,
            updatedAt: now,
          }
          blocks.push(newBlock)
        }
      }),
      
      eraseCell: (dateISO, hour, segment) => set((state) => {
        const startMin = hourSegmentToMin(hour, segment)
        
        if (state.blocksByDate[dateISO]) {
          // execute layer만 지움 (overlay는 건드리지 않음)
          state.blocksByDate[dateISO] = state.blocksByDate[dateISO].filter((b) => {
            return !(b.layer === "execute" && b.startMin <= startMin && b.endMin > startMin)
          })
        }
      }),

      paintOverlayCell: (dateISO, hour, segment, activityId) => set((state) => {
        const startMin = hourSegmentToMin(hour, segment)
        const endMin = startMin + 10

        if (!state.blocksByDate[dateISO]) {
          state.blocksByDate[dateISO] = []
        }

        const blocks = state.blocksByDate[dateISO]

        // 같은 위치 + 같은 activity + overlay인 블록이 이미 있으면 무시 (동일 카테고리 중복 방지)
        const exactDuplicate = blocks.find(
          (b) => b.layer === "overlay" && b.activityId === activityId && b.startMin === startMin && b.endMin === endMin
        )
        if (exactDuplicate) return

        // 같은 위치에 다른 activity의 overlay는 허용 (다른 카테고리끼리만 분리)
        const now = Date.now()
        const newBlock: Block = {
          id: `block-${now}-${Math.random().toString(36).substr(2, 9)}`,
          dateISO,
          startMin,
          endMin,
          activityId,
          layer: "overlay" as Layer,
          source: "manual" as BlockSource,
          createdAt: now,
          updatedAt: now,
        }
        state.blocksByDate[dateISO].push(newBlock)
      }),

      eraseOverlayCell: (dateISO, hour, segment) => set((state) => {
        const startMin = hourSegmentToMin(hour, segment)

        if (state.blocksByDate[dateISO]) {
          state.blocksByDate[dateISO] = state.blocksByDate[dateISO].filter((b) => {
            return !(b.layer === "overlay" && b.startMin <= startMin && b.endMin > startMin)
          })
        }
      }),
      
      // 액션 - NEW_EVENT
      setNewEventDraft: (draft) => set({ newEventDraft: draft }),
      
      saveNewEvent: () => set((state) => {
        if (!state.newEventDraft) return
        
        const { startMin, endMin, activityId, title } = state.newEventDraft
        const dateISO = formatDateISO(state.selectedDate)
        const now = Date.now()
        
        if (!state.blocksByDate[dateISO]) {
          state.blocksByDate[dateISO] = []
        }
        
        const newBlock: Block = {
          id: `block-${now}-${Math.random().toString(36).substr(2, 9)}`,
          dateISO,
          startMin,
          endMin,
          activityId,
          layer: "execute" as Layer,
          source: "manual" as BlockSource,
          createdAt: now,
          updatedAt: now,
        }
        
        state.blocksByDate[dateISO].push(newBlock)
        state.newEventDraft = null
      }),
      
      // 액션 - 드래그
      startDrag: (min) => set({ isDragging: true, dragStartMin: min, dragEndMin: min }),
      updateDrag: (min) => set({ dragEndMin: min }),
      endDrag: () => set({ isDragging: false, dragStartMin: null, dragEndMin: null }),
      
      // 액션 - Indicator
      addIndicator: (dateISO, atMin, label) => set((state) => {
        if (!state.indicatorsByDate[dateISO]) {
          state.indicatorsByDate[dateISO] = []
        }
        const now = Date.now()
        state.indicatorsByDate[dateISO].push({
          id: `indicator-${now}`,
          dateISO,
          atMin,
          label,
          timeText: minToTime(atMin),
          createdAt: now,
        })
      }),
      
      removeIndicator: (dateISO, id) => set((state) => {
        if (state.indicatorsByDate[dateISO]) {
          state.indicatorsByDate[dateISO] = state.indicatorsByDate[dateISO].filter((i) => i.id !== id)
        }
      }),
      
      // 액션 - Checklist
      addChecklistItem: (dateISO, text, time) => set((state) => {
        if (!state.checklistByDate[dateISO]) {
          state.checklistByDate[dateISO] = []
        }
        const now = Date.now()
        state.checklistByDate[dateISO].push({
          id: `checklist-${now}`,
          text,
          done: false,
          time,
          createdAt: now,
          updatedAt: now,
        })
      }),
      
      toggleChecklistItem: (dateISO, id) => set((state) => {
        const items = state.checklistByDate[dateISO]
        if (items) {
          const item = items.find((i) => i.id === id)
          if (item) {
            item.done = !item.done
            item.updatedAt = Date.now()
          }
        }
      }),
      
      removeChecklistItem: (dateISO, id) => set((state) => {
        if (state.checklistByDate[dateISO]) {
          state.checklistByDate[dateISO] = state.checklistByDate[dateISO].filter((i) => i.id !== id)
        }
      }),
      
      // 액션 - ChecklistBlock
      addChecklistBlock: (blockData) => set((state) => {
        const now = Date.now()
        const block: ChecklistBlock = {
          ...blockData,
          id: `checklistblock-${now}`,
          createdAt: now,
          updatedAt: now,
        }
        if (!state.checklistBlocksByDate[blockData.dateISO]) {
          state.checklistBlocksByDate[blockData.dateISO] = []
        }
        state.checklistBlocksByDate[blockData.dateISO].push(block)
      }),
      
      toggleChecklistBlockItem: (dateISO, blockId, itemId) => set((state) => {
        const blocks = state.checklistBlocksByDate[dateISO]
        if (blocks) {
          const block = blocks.find((b) => b.id === blockId)
          if (block) {
            const item = block.items.find((i) => i.id === itemId)
            if (item) {
              item.done = !item.done
              block.updatedAt = Date.now()
            }
          }
        }
      }),
      
      removeChecklistBlock: (dateISO, blockId) => set((state) => {
        if (state.checklistBlocksByDate[dateISO]) {
          state.checklistBlocksByDate[dateISO] = state.checklistBlocksByDate[dateISO].filter(
            (b) => b.id !== blockId
          )
        }
      }),
      
      // 하루 리셋 — 신규 생성(non-system activity) 블록 제거
      clearDayData: (dateISO) => set((state) => {
        const systemIds = new Set(defaultActivities.map((a) => a.id))
        // 신규 생성 activity로 만든 블록만 제거 (system activity 블록은 유지)
        if (state.blocksByDate[dateISO]) {
          state.blocksByDate[dateISO] = state.blocksByDate[dateISO].filter(
            (b) => systemIds.has(b.activityId)
          )
        }
        // 신규 생성 activity 자체도 제거
        state.activities = state.activities.filter(
          (a) => a.isSystem || systemIds.has(a.id)
        )
      }),
      
      // 액션 - Routine
      addDailyRoutine: (name) => set((state) => {
        state.dailyRoutines.push({ id: `dr-${Date.now()}`, name, items: [] })
      }),
      
      updateDailyRoutine: (id, updates) => set((state) => {
        const idx = state.dailyRoutines.findIndex((r) => r.id === id)
        if (idx !== -1) Object.assign(state.dailyRoutines[idx], updates)
      }),
      
      removeDailyRoutine: (id) => set((state) => {
        state.dailyRoutines = state.dailyRoutines.filter((r) => r.id !== id)
      }),
      
      addWeeklyRoutine: (name) => set((state) => {
        state.weeklyRoutines.push({ id: `wr-${Date.now()}`, name, dayItems: {} })
      }),
      
      updateWeeklyRoutine: (id, updates) => set((state) => {
        const idx = state.weeklyRoutines.findIndex((r) => r.id === id)
        if (idx !== -1) Object.assign(state.weeklyRoutines[idx], updates)
      }),
      
      removeWeeklyRoutine: (id) => set((state) => {
        state.weeklyRoutines = state.weeklyRoutines.filter((r) => r.id !== id)
      }),
      
      addRoutineItem: (routineId, type, dayIndex, item) => set((state) => {
        const newItem = { ...item, id: `ri-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` }
        if (type === "daily") {
          const routine = state.dailyRoutines.find((r) => r.id === routineId)
          if (routine) routine.items.push(newItem)
        } else {
          const routine = state.weeklyRoutines.find((r) => r.id === routineId)
          if (routine) {
            if (!routine.dayItems[dayIndex]) routine.dayItems[dayIndex] = []
            routine.dayItems[dayIndex].push(newItem)
          }
        }
      }),
      
      removeRoutineItem: (routineId, type, dayIndex, itemId) => set((state) => {
        if (type === "daily") {
          const routine = state.dailyRoutines.find((r) => r.id === routineId)
          if (routine) routine.items = routine.items.filter((i) => i.id !== itemId)
        } else {
          const routine = state.weeklyRoutines.find((r) => r.id === routineId)
          if (routine && routine.dayItems[dayIndex]) {
            routine.dayItems[dayIndex] = routine.dayItems[dayIndex].filter((i) => i.id !== itemId)
          }
        }
      }),
      
      setDailyRoutineItems: (routineId, items) => set((state) => {
        const routine = state.dailyRoutines.find((r) => r.id === routineId)
        if (routine) {
          routine.items = items.map((item, i) => ({
            ...item,
            id: `ri-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          }))
        }
      }),
      
      setWeeklyRoutineDayItems: (routineId, dayIndex, items) => set((state) => {
        const routine = state.weeklyRoutines.find((r) => r.id === routineId)
        if (routine) {
          routine.dayItems[dayIndex] = items.map((item, i) => ({
            ...item,
            id: `ri-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          }))
        }
      }),
      
      applyDailyRoutineToDate: (routineId, dateISO) => set((state) => {
        const routine = state.dailyRoutines.find((r) => r.id === routineId)
        if (!routine) return
        const now = Date.now()
        if (!state.blocksByDate[dateISO]) state.blocksByDate[dateISO] = []
        routine.items.forEach((item, i) => {
          const block: Block = {
            id: `block-routine-${now}-${i}`,
            dateISO,
            startMin: item.startMin,
            endMin: item.endMin,
            activityId: item.activityId,
            layer: "plan" as Layer,
            source: "template_apply" as BlockSource,
            createdAt: now + i,
            updatedAt: now + i,
          }
          state.blocksByDate[dateISO].push(block)
        })
      }),
      
      applyWeeklyRoutineToDate: (routineId, startDateISO) => set((state) => {
        const routine = state.weeklyRoutines.find((r) => r.id === routineId)
        if (!routine) return
        const now = Date.now()
        const startDate = new Date(startDateISO)
        Object.entries(routine.dayItems).forEach(([dayStr, items]) => {
          const dayOffset = parseInt(dayStr)
          const date = new Date(startDate)
          date.setDate(date.getDate() + ((dayOffset - startDate.getDay() + 7) % 7))
          const dISO = formatDateISO(date)
          if (!state.blocksByDate[dISO]) state.blocksByDate[dISO] = []
          items.forEach((item, i) => {
            const block: Block = {
              id: `block-routine-${now}-${dayOffset}-${i}`,
              dateISO: dISO,
              startMin: item.startMin,
              endMin: item.endMin,
              activityId: item.activityId,
              layer: "plan" as Layer,
              source: "template_apply" as BlockSource,
              createdAt: now + dayOffset * 100 + i,
              updatedAt: now + dayOffset * 100 + i,
            }
            state.blocksByDate[dISO].push(block)
          })
        })
      }),
      
      // 액션 - Undo/Redo
      pushSnapshot: () => set((state) => {
        const snapshot = JSON.parse(JSON.stringify(state.blocksByDate))
        const newHistory = state.history.slice(0, state.historyIndex + 1)
        newHistory.push(snapshot)
        state.history = newHistory
        state.historyIndex = newHistory.length - 1
      }),
      
      undo: () => set((state) => {
        if (state.historyIndex > 0) {
          state.historyIndex -= 1
          state.blocksByDate = JSON.parse(JSON.stringify(state.history[state.historyIndex]))
        } else if (state.historyIndex === 0) {
          state.historyIndex = -1
          state.blocksByDate = {}
        }
      }),
      
      redo: () => set((state) => {
        if (state.historyIndex < state.history.length - 1) {
          state.historyIndex += 1
          state.blocksByDate = JSON.parse(JSON.stringify(state.history[state.historyIndex]))
        }
      }),
      
      // 걸음수 / 기상·취침
      setSteps: (dateISO, steps) => set((state) => {
        state.stepsByDate[dateISO] = steps
      }),
      setWakeUp: (dateISO, min) => set((state) => {
        state.wakeUpByDate[dateISO] = min
      }),
      setSleep: (dateISO, min) => set((state) => {
        state.sleepByDate[dateISO] = min
      }),

      // 액션 - 할일/마감
      addTask: (task) => set((state) => {
        const now = Date.now()
        state.tasks.push({
          ...task,
          id: `task-${now}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: now,
          updatedAt: now,
        })
      }),
      updateTask: (id, updates) => set((state) => {
        const task = state.tasks.find(t => t.id === id)
        if (task) Object.assign(task, { ...updates, updatedAt: Date.now() })
      }),
      removeTask: (id) => set((state) => {
        state.tasks = state.tasks.filter(t => t.id !== id)
      }),
      setTaskStatus: (id, status) => set((state) => {
        const task = state.tasks.find(t => t.id === id)
        if (task) {
          task.status = status
          task.updatedAt = Date.now()
          if (status === "done") {
            task.completedAt = new Date().toISOString().split("T")[0]
          } else {
            delete task.completedAt
          }
        }
      }),
      reorderTasks: (orderedIds) => set((state) => {
        const idxMap = new Map(orderedIds.map((id, i) => [id, i]))
        state.tasks.sort((a, b) => {
          const ai = idxMap.get(a.id)
          const bi = idxMap.get(b.id)
          if (ai != null && bi != null) return ai - bi
          if (ai != null) return -1
          if (bi != null) return 1
          return 0
        })
      }),
      cleanupDoneTasks: () => set((state) => {
        const today = new Date().toISOString().split("T")[0]
        const expired = state.tasks.filter(
          t => t.status === "done" && t.completedAt && t.completedAt < today
        )
        for (const t of expired) {
          const actMatch = t.note?.match(/__act:([^_]+)__/)
          state.completedTaskHistory.unshift({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            completedAt: t.completedAt!,
            note: t.note,
            activityId: actMatch ? actMatch[1] : undefined,
          })
        }
        state.tasks = state.tasks.filter(
          t => !(t.status === "done" && t.completedAt && t.completedAt < today)
        )
      }),
      clearCompletedHistory: () => set((state) => {
        state.completedTaskHistory = []
      }),
      
      // 헬퍼
      getBlocksForDate: (dateISO) => {
        return get().blocksByDate[dateISO] || []
      },
      
      getActivityById: (id) => {
        return get().activities.find((a) => a.id === id)
      },
      
      getIndicatorsForDate: (dateISO) => {
        return get().indicatorsByDate[dateISO] || []
      },
      
      getChecklistForDate: (dateISO) => {
        return get().checklistByDate[dateISO] || []
      },

      // 액션 - 가계부
      addBudgetEntry: (entry) => set((state) => {
        const now = Date.now()
        state.budgetEntries.push({
          ...entry,
          id: `budget-${now}-${Math.random().toString(36).substr(2, 6)}`,
          createdAt: now,
          updatedAt: now,
        })
      }),
      updateBudgetEntry: (id, updates) => set((state) => {
        const idx = state.budgetEntries.findIndex(e => e.id === id)
        if (idx !== -1) Object.assign(state.budgetEntries[idx], { ...updates, updatedAt: Date.now() })
      }),
      removeBudgetEntry: (id) => set((state) => {
        state.budgetEntries = state.budgetEntries.filter(e => e.id !== id)
      }),
      addFixedExpense: (expense) => set((state) => {
        state.fixedExpenses.push({
          ...expense,
          id: `fixed-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          createdAt: Date.now(),
        })
      }),
      updateFixedExpense: (id, updates) => set((state) => {
        const idx = state.fixedExpenses.findIndex(e => e.id === id)
        if (idx !== -1) Object.assign(state.fixedExpenses[idx], updates)
      }),
      removeFixedExpense: (id) => set((state) => {
        state.fixedExpenses = state.fixedExpenses.filter(e => e.id !== id)
      }),

      // ── 묶음소비 트래커 ──────────────────────────────────
      addBulkPurchase: (purchase) => set((state) => {
        const now = Date.now()
        state.bulkPurchases.push({
          ...purchase,
          id: `bulk-${now}-${Math.random().toString(36).substr(2, 6)}`,
          createdAt: now,
          updatedAt: now,
        })
      }),
      updateBulkPurchase: (id, updates) => set((state) => {
        const idx = state.bulkPurchases.findIndex(p => p.id === id)
        if (idx !== -1) Object.assign(state.bulkPurchases[idx], { ...updates, updatedAt: Date.now() })
      }),
      removeBulkPurchase: (id) => set((state) => {
        state.bulkPurchases = state.bulkPurchases.filter(p => p.id !== id)
        state.bulkConsumeLogs = state.bulkConsumeLogs.filter(l => l.purchaseId !== id)
      }),
      addBulkConsumeLog: (log) => set((state) => {
        state.bulkConsumeLogs.push({
          ...log,
          id: `bcl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          createdAt: Date.now(),
        })
      }),
      removeBulkConsumeLog: (id) => set((state) => {
        state.bulkConsumeLogs = state.bulkConsumeLogs.filter(l => l.id !== id)
      }),

      // ── DailyCondition 액션 ──────────────────────────────────────────────
      setCondition: (dateISO, data) => set((state) => {
        const idx = state.conditionLogs.findIndex(c => c.dateISO === dateISO)
        if (idx !== -1) {
          Object.assign(state.conditionLogs[idx], { ...data, updatedAt: Date.now() })
        } else {
          state.conditionLogs.push({ dateISO, ...data, updatedAt: Date.now() })
        }
      }),
      removeCondition: (dateISO) => set((state) => {
        state.conditionLogs = state.conditionLogs.filter(c => c.dateISO !== dateISO)
      }),

      // ── TimeBudgetGoal 액션 ──────────────────────────────────────────────
      addTimeBudgetGoal: (goal) => set((state) => {
        state.timeBudgetGoals.push({
          ...goal,
          id: `tbg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          createdAt: Date.now(),
        })
      }),
      updateTimeBudgetGoal: (id, updates) => set((state) => {
        const idx = state.timeBudgetGoals.findIndex(g => g.id === id)
        if (idx !== -1) Object.assign(state.timeBudgetGoals[idx], updates)
      }),
      removeTimeBudgetGoal: (id) => set((state) => {
        state.timeBudgetGoals = state.timeBudgetGoals.filter(g => g.id !== id)
      }),

      // ── PmsCycle 액션 ────────────────────────────────────────────────────
      addPmsCycle: (cycle) => set((state) => {
        state.pmsCycles.push({
          ...cycle,
          id: `pms-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          createdAt: Date.now(),
        })
      }),
      updatePmsCycle: (id, updates) => set((state) => {
        const idx = state.pmsCycles.findIndex(c => c.id === id)
        if (idx !== -1) Object.assign(state.pmsCycles[idx], updates)
      }),
      removePmsCycle: (id) => set((state) => {
        state.pmsCycles = state.pmsCycles.filter(c => c.id !== id)
      }),

      // ── BlockEmoji 액션 ──────────────────────────────────────────────────
      setBlockEmoji: (dateISO, blockId, emoji) => set((state) => {
        const idx = state.blockEmojis.findIndex(e => e.dateISO === dateISO && e.blockId === blockId)
        if (idx !== -1) {
          state.blockEmojis[idx].emoji = emoji
        } else {
          state.blockEmojis.push({
            id: `be-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            dateISO, blockId, emoji, createdAt: Date.now(),
          })
        }
      }),
      removeBlockEmoji: (dateISO, blockId) => set((state) => {
        state.blockEmojis = state.blockEmojis.filter(e => !(e.dateISO === dateISO && e.blockId === blockId))
      }),

      // ── ConsumableItem 액션 ─────────────────────────────────────────────
      addConsumableItem: (item) => set((state) => {
        state.consumableItems.push({
          ...item,
          id: `ci-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }),
      updateConsumableItem: (id, updates) => set((state) => {
        const idx = state.consumableItems.findIndex(i => i.id === id)
        if (idx !== -1) Object.assign(state.consumableItems[idx], { ...updates, updatedAt: Date.now() })
      }),
      removeConsumableItem: (id) => set((state) => {
        state.consumableItems = state.consumableItems.filter(i => i.id !== id)
        state.consumablePurchases = state.consumablePurchases.filter(p => p.itemId !== id)
        state.consumableUseLogs = state.consumableUseLogs.filter(l => l.itemId !== id)
      }),

      // ── ConsumablePurchase 액션 ──────────────────────────────────────────
      addConsumablePurchase: (purchase) => set((state) => {
        state.consumablePurchases.push({
          ...purchase,
          id: `cp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          createdAt: Date.now(),
        })
      }),
      removeConsumablePurchase: (id) => set((state) => {
        state.consumablePurchases = state.consumablePurchases.filter(p => p.id !== id)
        state.consumableUseLogs = state.consumableUseLogs.filter(l => l.purchaseId !== id)
      }),

      // ── ConsumableUseLog 액션 ────────────────────────────────────────────
      addConsumableUseLog: (log) => set((state) => {
        state.consumableUseLogs.push({
          ...log,
          id: `cul-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          createdAt: Date.now(),
        })
      }),
      removeConsumableUseLog: (id) => set((state) => {
        state.consumableUseLogs = state.consumableUseLogs.filter(l => l.id !== id)
      }),

      // ── LogEntry 액션 ────────────────────────────────────────────────────
      addLogEntry: (entry) => set((state) => {
        state.logEntries.push({
          ...entry,
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }),
      updateLogEntry: (id, updates) => set((state) => {
        const idx = state.logEntries.findIndex(e => e.id === id)
        if (idx !== -1) {
          Object.assign(state.logEntries[idx], { ...updates, updatedAt: Date.now() })
        }
      }),
      removeLogEntry: (id) => set((state) => {
        state.logEntries = state.logEntries.filter(e => e.id !== id)
      }),
      toggleLogHighlight: (id) => set((state) => {
        const idx = state.logEntries.findIndex(e => e.id === id)
        if (idx !== -1) {
          state.logEntries[idx].isHighlight = !state.logEntries[idx].isHighlight
          state.logEntries[idx].updatedAt = Date.now()
        }
      }),

      // ── 집중 세션 (timestamp 기반) ─────────────────────────────────────
      startFocusSession: (activityId, mode, targetMinutes, dailyGoalHours) => set((state) => {
        const now = Date.now()
        state.focusSession = {
          id: `focus-${now}-${Math.random().toString(36).substr(2, 6)}`,
          activityId,
          mode,
          targetMinutes,
          startedAt: now,
          endsAt: now + targetMinutes * 60 * 1000,
          pausedAt: null,
          totalPausedMs: 0,
          isRunning: true,
          isPaused: false,
          focusSlots: [],
          dailyGoalHours,
        }
      }),
      pauseFocusSession: () => set((state) => {
        if (state.focusSession && state.focusSession.isRunning && !state.focusSession.isPaused) {
          state.focusSession.pausedAt = Date.now()
          state.focusSession.isPaused = true
        }
      }),
      resumeFocusSession: () => set((state) => {
        if (state.focusSession && state.focusSession.isPaused && state.focusSession.pausedAt) {
          const pausedDuration = Date.now() - state.focusSession.pausedAt
          state.focusSession.totalPausedMs += pausedDuration
          // 일시정지 동안 흐른 시간만큼 endsAt 연장
          state.focusSession.endsAt += pausedDuration
          state.focusSession.pausedAt = null
          state.focusSession.isPaused = false
        }
      }),
      endFocusSession: () => set((state) => {
        if (state.focusSession) {
          state.focusSession.isRunning = false
          state.focusSession.isPaused = false
        }
      }),
      clearFocusSession: () => set((state) => {
        state.focusSession = null
      }),
      updateFocusSlot: (slotIndex, level) => set((state) => {
        if (!state.focusSession) return
        const slots = state.focusSession.focusSlots
        const existing = slots.findIndex(s => s.slotIndex === slotIndex)
        if (existing !== -1) {
          slots[existing] = { slotIndex, level, startedAt: Date.now() }
        } else {
          slots.push({ slotIndex, level, startedAt: Date.now() })
        }
      }),

      // ── 장소 (Place) 액션 ─────────────────────────────────────────────
      addPlace: (place) => set((state) => {
        state.places.push({
          ...place,
          id: `place-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          createdAt: Date.now(),
        })
      }),
      updatePlace: (id, updates) => set((state) => {
        const idx = state.places.findIndex((p: Place) => p.id === id)
        if (idx !== -1) Object.assign(state.places[idx], updates)
      }),
      removePlace: (id) => set((state) => {
        state.places = state.places.filter((p: Place) => p.id !== id)
        // 관련 이동 기록도 정리
        Object.keys(state.movementsByDate).forEach((dateISO) => {
          state.movementsByDate[dateISO] = state.movementsByDate[dateISO].filter(
            (m: Movement) => m.fromPlaceId !== id && m.toPlaceId !== id
          )
        })
        // 블록에서 해당 장소 해제
        Object.keys(state.blocksByDate).forEach((dateISO) => {
          state.blocksByDate[dateISO].forEach((b: Block) => {
            if (b.placeId === id) b.placeId = undefined
          })
        })
      }),
      reorderPlaces: (orderedIds) => set((state) => {
        orderedIds.forEach((id: string, index: number) => {
          const p = state.places.find((pl: Place) => pl.id === id)
          if (p) p.order = index
        })
      }),

      // ── 이동 기록 (Movement) 액션 ────────────────────────────────────────
      addMovement: (movement) => set((state) => {
        if (!state.movementsByDate[movement.dateISO]) {
          state.movementsByDate[movement.dateISO] = []
        }
        state.movementsByDate[movement.dateISO].push({
          ...movement,
          id: `mv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          createdAt: Date.now(),
        })
      }),
      updateMovement: (id, dateISO, updates) => set((state) => {
        const movements = state.movementsByDate[dateISO]
        if (movements) {
          const idx = movements.findIndex((m: Movement) => m.id === id)
          if (idx !== -1) Object.assign(movements[idx], updates)
        }
      }),
      removeMovement: (id, dateISO) => set((state) => {
        if (state.movementsByDate[dateISO]) {
          state.movementsByDate[dateISO] = state.movementsByDate[dateISO].filter(
            (m: Movement) => m.id !== id
          )
        }
      }),

      // ── 블록 장소 지정 ──────────────────────────────────────────────────
      setBlockPlace: (blockId, dateISO, placeId) => set((state) => {
        const blocks = state.blocksByDate[dateISO]
        if (blocks) {
          const block = blocks.find((b: Block) => b.id === blockId)
          if (block) {
            block.placeId = placeId
            block.updatedAt = Date.now()
          }
        }
      }),

      setBlocksPlace: (blockIds, dateISO, placeId) => set((state) => {
        const blocks = state.blocksByDate[dateISO]
        if (blocks) {
          const now = Date.now()
          for (const block of blocks) {
            if (blockIds.includes(block.id)) {
              block.placeId = placeId
              block.updatedAt = now
            }
          }
        }
      }),

      // ── 장소 헬퍼 ──────────────────────────────────────────────────────
      getPlaceById: (id) => {
        return get().places.find((p: Place) => p.id === id)
      },
      getMovementsForDate: (dateISO) => {
        return get().movementsByDate[dateISO] || []
      },
    })),
    {
      name: "life-log-planner-storage",
      version: 2,
      migrate: (persisted: any, version: number) => {
        // v0/v1 → v2: 기본 활동 목록이 taxonomy 기반으로 변경됨
        if (version < 2) {
          const oldActs: Activity[] = persisted.activities ?? []
          // 기존 활동 id 세트
          const existingIds = new Set(oldActs.map((a: Activity) => a.id))
          // 새 기본 활동 중 아직 없는 것만 추가
          const toAdd = defaultActivities.filter(a => !existingIds.has(a.id))
          // 기존 활동 이름도 업데이트 (예: work "업무" → "알바")
          const updatedOld = oldActs.map((a: Activity) => {
            const match = defaultActivities.find(d => d.id === a.id)
            if (match && a.isSystem) {
              return { ...a, name: match.name, color: match.color, order: match.order }
            }
            return a
          })
          // 삭제된 옛 시스템 활동 (hobby, health, meal, custom) → 유지하되 order 뒤로
          const maxOrder = defaultActivities.length
          const final = updatedOld.map((a: Activity, i: number) => {
            if (a.isSystem && !defaultActivities.find(d => d.id === a.id)) {
              return { ...a, order: maxOrder + i }
            }
            return a
          })
          persisted.activities = [...final, ...toAdd]
        }
        return persisted
      },
      partialize: (state) => ({
        activities: state.activities,
        blocksByDate: state.blocksByDate,
        indicatorsByDate: state.indicatorsByDate,
        checklistByDate: state.checklistByDate,
        checklistBlocksByDate: state.checklistBlocksByDate,
        startHour: state.startHour,
        theme: state.theme,
        dailyRoutines: state.dailyRoutines,
        weeklyRoutines: state.weeklyRoutines,
        stepsByDate: state.stepsByDate,
        wakeUpByDate: state.wakeUpByDate,
        sleepByDate: state.sleepByDate,
        tasks: state.tasks,
        budgetEntries: state.budgetEntries,
        fixedExpenses: state.fixedExpenses,
        bulkPurchases: state.bulkPurchases,
        bulkConsumeLogs: state.bulkConsumeLogs,
        conditionLogs: state.conditionLogs,
        timeBudgetGoals: state.timeBudgetGoals,
        pmsCycles: state.pmsCycles,
        blockEmojis: state.blockEmojis,
        consumableItems: state.consumableItems,
        consumablePurchases: state.consumablePurchases,
        consumableUseLogs: state.consumableUseLogs,
        logEntries: state.logEntries,
        focusSession: state.focusSession,
        places: state.places,
        movementsByDate: state.movementsByDate,
      }),
    }
  )
)
