// =====================================================
// Digital Life Log Planner v2 — Type Definitions
// =====================================================

// 기본 ID 타입
export type ActivityId = string
export type BlockId = string
export type WeekKey = string

// 레이어 타입
export type Layer = "plan" | "execute" | "overlay"

// 블록 생성 소스
export type BlockSource = "manual" | "week_plan" | "fixed_schedule" | "template_apply" | "import" | "voice"

// 페인트 스타일
export type PaintStyle = "solid" | "diagonal" | "cross" | "line" | "extension"

// 저항도/에너지 레벨
export type ResistanceLevel = 1 | 2 | 3 | 4 | 5
export type EnergyLevel = 1 | 2 | 3 | 4 | 5

// 도구 타입
export type Tool = "execute" | "plan" | "erase" | "indicator" | "new" | "select" | "memo"

// 드래그 모드
export type DragMode = "paint" | "erase" | null

// =====================================================
// Activity (카테고리)
// =====================================================
export interface Activity {
  id: ActivityId
  name: string
  color: string
  isSystem?: boolean
  parentId?: ActivityId  // 부모 활동 ID (하위 항목)
  order?: number         // 표시 순서
  depth?: number         // 몇 단계까지 펼칠지 (0=펼치지 않음, 1=1단계 등)
  preference?: 1 | 2 | 3 | 4 | 5  // 선호도 1=😑 ~ 5=😍
  preferredPlaces?: string[]  // 선호 장소 ID 목록
  preferredTime?: "morning" | "afternoon" | "evening" | "night"  // 선호 시간대
}

// =====================================================
// Routine (루틴)
// =====================================================
export interface RoutineItem {
  id: string
  activityId: ActivityId
  startMin: number
  endMin: number
}

export interface DailyRoutine {
  id: string
  name: string
  items: RoutineItem[]
}

export interface WeeklyRoutine {
  id: string
  name: string
  dayItems: Record<number, RoutineItem[]> // 0=일 ~ 6=토
}

// =====================================================
// Block (계획/실행/중첩)
// =====================================================
export interface PlanResistance {
  level: ResistanceLevel
  iconId: string
}

export interface BlockPlanRef {
  planBlockId: BlockId
  matchRule: "timeOverlap" | "autoNearest" | "userPinned"
  matchScore?: number
}

export interface BlockExtension {
  baseEndMin?: number
  extendedByMin: number
}

export interface Block {
  id: BlockId
  dateISO: string
  startMin: number  // 0-1440 (24시간 * 60분)
  endMin: number
  activityId: ActivityId
  layer: Layer
  source: BlockSource
  placeId?: string  // 장소 ID (선택)
  paintStyle?: PaintStyle
  planRef?: BlockPlanRef
  resistance?: PlanResistance
  extension?: BlockExtension
  meta?: Record<string, unknown>  // 음성입력 등 부가 정보
  createdAt: number
  updatedAt: number
}

// =====================================================
// Checklist
// =====================================================
export interface ChecklistItem {
  id: string
  text: string
  done: boolean
  time?: string
  createdAt: number
  updatedAt: number
}

export interface ChecklistBlock {
  id: string
  dateISO: string
  startMin: number
  endMin: number
  layer: Layer
  activityId?: ActivityId
  items: { id: string; text: string; done: boolean; durationMin: number }[]
  position: "main" | "sub" // main=본일정 위치, sub=중복일정 위치
  overlapIndex: number     // 어느 겹침 블록(0=첫번째, 1=두번째...) 위에 생성됐는지
  createdAt: number
  updatedAt: number
}

// =====================================================
// Indicator (지표)
// =====================================================
export interface IndicatorEvent {
  id: string
  dateISO: string
  atMin: number
  label: string
  timeText?: string
  createdAt: number
}

// =====================================================
// Memo
// =====================================================
export interface MemoItem {
  id: string
  text: string
  createdAt: number
  updatedAt: number
}

export type CellId = string // "2026-01-15|06|3" 형식
export type MemosByCell = Record<CellId, MemoItem[]>

// =====================================================
// Cell (렌더링용)
// =====================================================
export interface Cell {
  execute?: ActivityId
  overlay?: ActivityId
  indicator?: {
    timeText: string
    label: string
  }
  memos?: MemoItem[]
}

export type DayGrid = Record<CellId, Cell>

// =====================================================
// Segment (병합된 블록)
// =====================================================
export interface Segment {
  row: number       // hour 0–23
  startCol: number  // 0–5
  endCol: number    // 0–5
  layer: "execute" | "overlay"
  activityId: ActivityId
  blocks: Block[]
}

// =====================================================
// Daily State
// =====================================================
export interface DailyState {
  dateISO: string
  energyLevel?: EnergyLevel
  note?: string
  recordedAt: number
}

// =====================================================
// Completion Event
// =====================================================
export interface CompletionEvent {
  id: string
  dateISO: string
  blockId: BlockId
  atMin: number
  perceivedDone: boolean
  extraMinRequested?: number
  energyLevel?: EnergyLevel
  shortNote?: string
  createdAt: number
}

// =====================================================
// Week Plan
// =====================================================
export interface WeekPlanItem {
  id: string
  dayOfWeek: number // 0-6 (일-토)
  startMin: number
  endMin: number
  activityId: ActivityId
}

export interface WeekPlan {
  weekKey: WeekKey
  items: WeekPlanItem[]
}

// =====================================================
// Fixed Schedule
// =====================================================
export interface FixedSchedule {
  id: string
  name: string
  daysOfWeek: number[]
  startMin: number
  endMin: number
  activityId: ActivityId
  isActive: boolean
}

// =====================================================
// Voice Command
// =====================================================
export type VoiceParseField = "start" | "end" | "activity" | "date"

export interface VoiceParseCandidate {
  startMin?: number
  endMin?: number
  activityName?: string
  dateISO?: string
  confidence?: number
}

export interface VoiceCommandLog {
  id: string
  createdAt: number
  transcript: string
  asrConfidence?: number
  parse: {
    candidate: VoiceParseCandidate
    missingFields: VoiceParseField[]
    warnings?: string[]
  }
  confirmation: {
    status: "confirmed" | "edited" | "canceled"
    final?: {
      dateISO: string
      startMin: number
      endMin: number
      activityName: string
    }
  }
  createdPlanBlockId?: BlockId
}

// =====================================================
// NEW_EVENT Draft (신규 일정 생성용)
// =====================================================
export interface NewEventDraft {
  startMin: number
  endMin: number
  activityId: ActivityId
  title: string
}

// =====================================================
// Drag State
// =====================================================
export interface DragState {
  mode: DragMode
  dateISO: string
  startHour: number
  brush: ActivityId
  tool: Tool
  activeCells: Set<CellId>
  pointerId: number
  isDown: boolean
  pendingStartCell?: CellId
  startX?: number
  startY?: number
}

// =====================================================
// Persisted State V2
// =====================================================
export interface PersistedStateV2 {
  schemaVersion: 2
  activities: Activity[]
  blocksByDate: Record<string, Block[]>
  weekPlans: Record<string, WeekPlan>
  fixedSchedules: FixedSchedule[]
  templateAppliesByDate: Record<string, unknown[]>
  dailyStateByDate: Record<string, DailyState>
  completionEventsByDate: Record<string, CompletionEvent[]>
  indicatorsByDate: Record<string, IndicatorEvent[]>
  checklistByDate: Record<string, ChecklistItem[]>
  checklistBlocksByDate: Record<string, ChecklistBlock[]>
  memosByDate: Record<string, MemosByCell>
  voiceCommandLogsByDate: Record<string, VoiceCommandLog[]>
  startHour: number
  theme: "light" | "dark"
}

// =====================================================
// BulkConsumption (묶음 소비 트래커)
// =====================================================
export interface BulkItem {
  id: string
  name: string           // "도시락", "원두 200g"
  totalAmount: number    // 총 구매금액
  totalCount: number     // 총 수량 (개수)
  category: string       // 자유 분류 (식비, 음료 등)
  purchasedAt: string    // "YYYY-MM-DD" 구매일
  note?: string
  createdAt: number
}

export type BulkUseResult = "used" | "wasted" | "skipped"

export interface BulkUseLog {
  id: string
  bulkItemId: string
  dateISO: string        // 사용/낭비 날짜
  result: BulkUseResult
  note?: string          // "늦잠", "외식" 등 이유
  createdAt: number
}

// =====================================================
// Budget (가계부)
// =====================================================
export type BudgetCategory =
  | "식비" | "카페" | "교통" | "쇼핑" | "건강" | "구독" | "주거" | "여가" | "기타"

export const BUDGET_CATEGORIES: { name: BudgetCategory; emoji: string; color: string }[] = [
  { name: "식비",   emoji: "🍚", color: "#FDBA74" },
  { name: "카페",   emoji: "☕", color: "#A5F3FC" },
  { name: "교통",   emoji: "🚌", color: "#86EFAC" },
  { name: "쇼핑",   emoji: "🛍", color: "#F9A8D4" },
  { name: "건강",   emoji: "💊", color: "#6EE7B7" },
  { name: "구독",   emoji: "📱", color: "#C4B5FD" },
  { name: "주거",   emoji: "🏠", color: "#93C5FD" },
  { name: "여가",   emoji: "🎮", color: "#FDE68A" },
  { name: "기타",   emoji: "📦", color: "#CBD5E1" },
]

export interface BudgetEntry {
  id: string
  dateISO: string        // "YYYY-MM-DD"
  timeMin?: number       // 몇 시 (0-1440), 없으면 하루 전체
  amount: number         // 양수 = 지출, 음수 = 수입
  category: BudgetCategory
  memo: string
  isFixed?: boolean      // 고정 지출 여부
  createdAt: number
  updatedAt: number
}

export interface FixedExpense {
  id: string
  name: string
  amount: number
  category: BudgetCategory
  cycle: "monthly" | "weekly" | "daily"
  dayOfMonth?: number    // monthly: 몇 일
  dayOfWeek?: number     // weekly: 0=일~6=토
  active: boolean
  createdAt: number
}

// =====================================================
// DailyCondition (에너지/컨디션 일별 기록)
// =====================================================
export interface DailyCondition {
  dateISO: string
  focus: 1 | 2 | 3 | 4 | 5
  mood: 1 | 2 | 3 | 4 | 5
  fatigue: 1 | 2 | 3 | 4 | 5
  pms?: boolean      // PMS 중 여부 (생리 전 증후군)
  note?: string
  updatedAt: number
}

// =====================================================
// PmsCycle (생리 주기 기록 — PMS 계산용)
// =====================================================
export interface PmsCycle {
  id: string
  periodStartISO: string   // 생리 시작일 "YYYY-MM-DD"
  periodEndISO?: string    // 생리 종료일 (선택)
  createdAt: number
}

// =====================================================
// BlockEmoji (실행 블록별 이모지)
// =====================================================
export interface BlockEmoji {
  id: string
  dateISO: string
  blockId: string          // 어느 실행 블록인지 (activityId+hour+col 기반 키)
  emoji: string            // 단일 이모지 문자
  createdAt: number
}

// =====================================================
// ConsumableItem (소모품 트래커)
// =====================================================
export interface ConsumableItem {
  id: string
  name: string             // "원두 200g", "샴푸"
  category: string         // 자유 분류
  note?: string
  createdAt: number
  updatedAt: number
}

export interface ConsumablePurchase {
  id: string
  itemId: string           // 어떤 소모품인지
  qty: number              // 구매 수량 (1팩, 2개 등)
  purchaseDate: string     // "YYYY-MM-DD"
  memo?: string
  createdAt: number
}

export type ConsumableUseResult = "used" | "finished"  // used=1회 사용, finished=다 소진

export interface ConsumableUseLog {
  id: string
  purchaseId: string       // 어느 구매에서
  itemId: string
  dateISO: string          // "YYYY-MM-DD"
  count: number            // 이 날 사용 횟수 (기본 1)
  result: ConsumableUseResult
  note?: string
  createdAt: number
}

// =====================================================
// TimeBudget (시간 예산) — 제거됨
// =====================================================
// TimeBudgetGoal 은 사용하지 않음 (삭제 예정)
export interface TimeBudgetGoal {
  id: string
  activityId: string
  goalMinPerDay: number
  label?: string
  createdAt: number
}

// =====================================================
// BulkTracker (묶음소비 트래커)
// =====================================================

// 묶음 구매 1개 (도시락 5개, 원두 200g 등)
export interface BulkPurchase {
  id: string
  name: string           // "편의점 도시락"
  totalAmount: number    // 총 구매금액 (원)
  totalQty: number       // 총 수량
  unit: string           // "개", "잔", "회" 등
  category: BudgetCategory
  purchaseDate: string   // "YYYY-MM-DD"
  expiryDate?: string    // 유통기한 "YYYY-MM-DD" (선택)
  note?: string
  createdAt: number
  updatedAt: number
}

// 소비 로그: 먹었어요 / 못 먹었어요
export type BulkConsumeResult = "consumed" | "wasted"

export interface BulkConsumeLog {
  id: string
  purchaseId: string     // 어느 묶음에서
  dateISO: string        // "YYYY-MM-DD"
  result: BulkConsumeResult
  note?: string          // "늦잠", "약속생김" 등 사유
  createdAt: number
}

// =====================================================
// Task (할일/마감)
// =====================================================
export type TaskStatus = "todo" | "doing" | "done"
export type TaskRepeat = "daily" | "weekly" | null

export interface PlannerTask {
  id: string
  title: string
  status: TaskStatus
  dueDate?: string        // "YYYY-MM-DD"
  repeat?: TaskRepeat
  repeatDays?: number[]   // 0=일 ~ 6=토 (weekly 반복 시 요일 선택)
  priority?: "high" | "normal"
  note?: string
  activityId?: string     // 연결된 활동 카테고리
  completedAt?: string    // "YYYY-MM-DD" 완료 날짜
  createdAt: number
  updatedAt: number
}

// 완료된 할일 기록 (아카이브용)
export interface CompletedTaskRecord {
  id: string
  title: string
  dueDate?: string
  completedAt: string   // "YYYY-MM-DD"
  note?: string
  activityId?: string
}

// =====================================================
// LogEntry (통합 기록 엔티티)
// =====================================================

export type LogEntryType =
  | "note"        // 메모/한 줄 일기
  | "mood"        // 감정 기록
  | "health"      // 컨디션/건강
  | "content"     // 콘텐츠 (책/드라마/영화)
  | "session"     // 세션 자동 기록
  | "task_result" // 할일 완료/중단 기록
  | "event"       // 특별한 일

export type LogEntryCategory =
  | "productivity"
  | "emotion"
  | "health"
  | "relationship"
  | "content"
  | "daily_life"

export type ContentKind = "book" | "drama" | "movie" | "youtube" | "other"

export interface LogEntry {
  id: string
  createdAt: number
  updatedAt: number
  dateISO: string          // "YYYY-MM-DD"
  timeMin?: number         // 몇 시 몇 분 (0-1440), 없으면 당일 전체
  type: LogEntryType

  title?: string
  memo?: string

  // 기존 엔티티 연결
  activityId?: string      // 기존 activity 연결
  taskId?: string          // 기존 task 연결

  tags: string[]

  // 감정/에너지 (선택)
  mood?: 1 | 2 | 3 | 4 | 5
  energy?: 1 | 2 | 3 | 4 | 5
  focus?: 1 | 2 | 3 | 4 | 5

  category: LogEntryCategory

  // 타입별 세부 정보
  meta?: Record<string, unknown>

  // 하이라이트 후보 여부 (직접 북마크 or 자동 추출)
  isHighlight?: boolean
}

// meta 사용 예시 (실제 타입은 meta 안에 들어감):
//   content → { contentKind: ContentKind, progressText?: string }
//   health  → { symptoms?: string[], sleepHours?: number }
//   mood    → { moodLabel?: string, reason?: string }
//   session → { durationMin: number, completed: boolean }
//   task_result → { result: "done" | "abandoned" | "partial" }

// =====================================================
// DailySummary (일일 자동 집계)
// =====================================================

export interface DailySummary {
  dateISO: string
  entryCount: number
  sessionCount: number
  totalSessionMin: number

  avgMood?: number
  avgEnergy?: number
  avgFocus?: number

  topCategories: LogEntryCategory[]
  topTags: string[]

  highlightEntryIds: string[]

  // 자동 생성 요약 텍스트 (나중에 AI 확장용, 지금은 수동/규칙기반)
  autoSummaryText?: string
}

// =====================================================
// MonthlySummary (월간 자동 집계)
// =====================================================

export interface MonthlySummary {
  month: string            // "2026-03"
  totalEntries: number
  totalSessions: number
  totalSessionMin: number

  topCategories: { name: LogEntryCategory; count: number }[]
  topTags: { name: string; count: number }[]
  contentItems: string[]   // 기록된 콘텐츠 제목 목록
  highlightEntryIds: string[]
  highlightDates: string[] // 하이라이트 있는 날짜

  avgMood?: number
  avgEnergy?: number
  avgFocus?: number

  busiestDate?: string     // 기록 가장 많은 날
  quietestDate?: string    // 기록 가장 적은 날 (기록 있는 날 중)
}

// =====================================================
// YearbookData (연말 다이어리 export 준비)
// =====================================================

export interface YearbookData {
  year: number
  monthlySummaries: MonthlySummary[]
  highlights: LogEntry[]
  topTags: string[]
  topCategories: LogEntryCategory[]
  representativeEntries: LogEntry[]  // 월별 대표 기록 1~3개
}

// =====================================================
// Legacy Types (하위 호환)
// =====================================================
export interface Category {
  id: string
  name: string
  color: string
}

export interface Task {
  id: string
  text: string
  completed: boolean
  scheduledTime?: string
}

export interface TimeBlock {
  id: string
  hour: number
  segment: number
  categoryId: string
  isOverlay: boolean
  memo: string
  tasks: Task[]
  hasIndicator?: boolean
  customLabel?: string
  customColor?: string
  isPlan?: boolean
}

export interface Indicator {
  id: string
  hour: number
  segment: number
  label: string
}

export interface WeeklyPlan {
  id: string
  dayOfWeek: number
  hour: number
  segment: number
  categoryId: string
  tasks: Task[]
}

// =====================================================
// Place (장소)
// =====================================================
export interface Place {
  id: string
  name: string           // "집", "학교", "카페"
  icon?: string          // 이모지 아이콘
  color?: string         // 장소 고유 색상
  isSystem?: boolean     // 기본 장소 여부
  order?: number
  createdAt: number
}

// =====================================================
// Movement (이동 기록)
// =====================================================
export type TransportMode = "walk" | "bus" | "subway" | "taxi" | "bike" | "car" | "other"

export interface Movement {
  id: string
  dateISO: string
  fromPlaceId: string
  toPlaceId: string
  transport: TransportMode
  startMin: number       // 이동 시작 (0-1440)
  endMin: number         // 이동 종료 (0-1440)
  createdAt: number
}

// =====================================================
// PlaceGroup (computed — 같은 장소 연속 블록 그룹)
// =====================================================
export interface PlaceGroup {
  placeId: string
  placeName: string
  placeIcon?: string
  placeColor?: string
  startMin: number
  endMin: number
  blockIds: string[]
}

// =====================================================
// FocusSession (timestamp 기반 집중 세션)
// =====================================================
export interface FocusSlot {
  slotIndex: number           // 0 = 첫 10분 구간
  level: 0 | 1 | 2 | 3 | 4 | 5
  startedAt: number
}

export interface FocusSession {
  id: string
  activityId: string
  mode: "countdown" | "stopwatch"
  targetMinutes: number       // 목표 시간 (분)
  startedAt: number           // 집중 시작 timestamp (ms)
  endsAt: number              // 목표 종료 timestamp (ms)
  pausedAt: number | null     // 일시정지 시작 timestamp (null = 정지 아님)
  totalPausedMs: number       // 누적 일시정지 시간 (ms)
  isRunning: boolean          // 진행 중 (일시정지 포함)
  isPaused: boolean           // 일시정지 상태
  focusSlots: FocusSlot[]     // 10분 구간별 집중도
  dailyGoalHours: number      // 오늘 목표 시간
}
