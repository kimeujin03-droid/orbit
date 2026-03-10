import { inferTaxonomy, topToActivityName, type WorkType, type TopCategory } from "./scheduleTaxonomy"

export type ActivityLite = { id: string; name: string; aliases?: string[] }

export type ParseResult = {
  raw: string
  dateISO: string
  title: string
  startMin?: number
  endMin?: number
  durationMin?: number
  activityId?: string
  activityName?: string
  top?: TopCategory
  workType?: WorkType
  workTopic?: string
  confidence: number
  warnings: string[]
  tokens: {
    hasDate: boolean
    hasTime: boolean
    hasDuration: boolean
    hasTitle: boolean
    hasRange: boolean
  }
}

export type VoiceIntent =
  | "schedule_create"
  | "condition_log"
  | "suggestion_request"
  | "unknown"

export type ConditionLogPayload = {
  memo: string
  tags: string[]
  fatigue?: number
  mood?: number
  focus?: number
}

export type SuggestionRequestPayload = {
  activityQuery: string
}

export type VoiceParsedResult =
  | { kind: "schedule_create"; items: ParseResult[] }
  | { kind: "condition_log"; payload: ConditionLogPayload }
  | { kind: "suggestion_request"; payload: SuggestionRequestPayload }
  | { kind: "unknown"; raw: string }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`)

function dateToISO(d: Date) {
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  return `${y}-${m}-${day}`
}

function normalizeText(input: string) {
  let t = input.trim()
  t = t.replace(/\s+/g, " ")
  t = t.replace(/오후\s*/g, "오후 ")
  t = t.replace(/오전\s*/g, "오전 ")
  t = t.replace(/내일\s*/g, "내일 ")
  t = t.replace(/모레\s*/g, "모레 ")
  t = t.replace(/(\d{1,2})\s*시\s*반/g, "$1시 30분")
  return t
}

function extractRelativeDate(text: string, base: Date): { date: Date; hasDate: boolean; rest: string } {
  let rest = text
  let hasDate = false
  const d = new Date(base)

  if (rest.includes("내일")) { d.setDate(d.getDate() + 1); rest = rest.replace("내일", "").trim(); hasDate = true }
  else if (rest.includes("모레")) { d.setDate(d.getDate() + 2); rest = rest.replace("모레", "").trim(); hasDate = true }
  else if (rest.includes("오늘")) { rest = rest.replace("오늘", "").trim(); hasDate = true }

  return { date: d, hasDate, rest }
}

function todToAMPM(tod: string) {
  if (tod === "아침" || tod === "새벽") return "오전"
  if (tod === "점심") return ""
  return "오후"
}

/**
 * 시간을 분(minute-of-day)으로 변환.
 * ampm이 빈 문자열이면 스마트 추론:
 *  - h가 1~6이면 오후로 간주 (13~18시) — "3시" = 15시
 *  - h가 7~11이면 오전으로 간주 — "9시" = 9시
 *  - h가 12이면 낮 12시 그대로
 */
function toMinuteOfDay(hRaw: number, mmRaw: number, ampm: string, warnings: string[]) {
  let h = hRaw
  const mm = clamp(mmRaw, 0, 59)

  if (ampm === "오후") {
    if (h >= 1 && h <= 11) h += 12
  } else if (ampm === "오전") {
    if (h === 12) h = 0
  } else {
    // 오전/오후 없이 숫자만 → 스마트 추론
    if (h >= 1 && h <= 6) h += 12   // 1시~6시 → 13~18시
    // 7~12는 그대로 (7시=07:00, 12시=12:00)
  }

  if (h < 0 || h > 23) {
    warnings.push(`시간 값이 이상해요: ${hRaw}시`)
    h = clamp(h, 0, 23)
  }

  return h * 60 + mm
}

function extractTimeRange(text: string) {
  const warnings: string[] = []
  let rest = text

  const re1 = /(오전|오후)?\s*(\d{1,2})\s*시\s*(\d{1,2})?\s*분?\s*(?:부터|~|-|에서)\s*(오전|오후)?\s*(\d{1,2})\s*시\s*(\d{1,2})?\s*분?\s*(?:까지)?/
  const m1 = rest.match(re1)
  if (m1) {
    const ap1 = m1[1] || ""
    const h1 = parseInt(m1[2], 10)
    const mm1 = m1[3] ? parseInt(m1[3], 10) : 0
    const ap2 = m1[4] || ""
    const h2 = parseInt(m1[5], 10)
    const mm2 = m1[6] ? parseInt(m1[6], 10) : 0

    let startMin = toMinuteOfDay(h1, mm1, ap1, warnings)
    let endMin = toMinuteOfDay(h2, mm2, ap2, warnings)

    // "12시부터 1시까지" → 720~780 (endMin이 startMin보다 작으면 end에 12시간 더하기)
    if (endMin <= startMin && !ap2) {
      const adjusted = endMin + 12 * 60
      if (adjusted <= 24 * 60) endMin = adjusted
    }

    rest = rest.replace(m1[0], "").trim()
    return { hasRange: true, startMin, endMin, rest, warnings }
  }

  const re2 = /(\d{1,2})\s*[:]\s*(\d{1,2})\s*(?:~|-)\s*(\d{1,2})\s*[:]\s*(\d{1,2})/
  const m2 = rest.match(re2)
  if (m2) {
    const h1 = parseInt(m2[1], 10), mm1 = parseInt(m2[2], 10)
    const h2 = parseInt(m2[3], 10), mm2 = parseInt(m2[4], 10)
    const startMin = clamp(h1, 0, 23) * 60 + clamp(mm1, 0, 59)
    const endMin = clamp(h2, 0, 23) * 60 + clamp(mm2, 0, 59)
    rest = rest.replace(m2[0], "").trim()
    return { hasRange: true, startMin, endMin, rest, warnings }
  }

  return { hasRange: false, startMin: undefined as number | undefined, endMin: undefined as number | undefined, rest, warnings }
}

function extractTimePoint(text: string) {
  const warnings: string[] = []
  let rest = text

  const todMatch = rest.match(/(아침|점심|저녁|밤|새벽)\s*(\d{1,2})\s*시\s*(\d{1,2})?\s*분?/)
  if (todMatch) {
    const ap = todToAMPM(todMatch[1])
    const h = parseInt(todMatch[2], 10)
    const mm = todMatch[3] ? parseInt(todMatch[3], 10) : 0
    const startMin = toMinuteOfDay(h, mm, ap, warnings)
    rest = rest.replace(todMatch[0], "").trim()
    return { hasTime: true, startMin, rest, warnings }
  }

  const m = rest.match(/(오전|오후)?\s*(\d{1,2})\s*시\s*(\d{1,2})?\s*분?/)
  if (m) {
    const ap = m[1] || ""
    const h = parseInt(m[2], 10)
    const mm = m[3] ? parseInt(m[3], 10) : 0
    const startMin = toMinuteOfDay(h, mm, ap, warnings)
    rest = rest.replace(m[0], "").trim()
    return { hasTime: true, startMin, rest, warnings }
  }

  return { hasTime: false, startMin: undefined as number | undefined, rest, warnings }
}

function extractDuration(text: string) {
  const warnings: string[] = []
  let rest = text
  let durationMin: number | undefined

  const m1 = rest.match(/(\d{1,2})\s*시간\s*(\d{1,2})\s*분/)
  if (m1) {
    durationMin = parseInt(m1[1], 10) * 60 + parseInt(m1[2], 10)
    rest = rest.replace(m1[0], "").trim()
    return { hasDuration: true, durationMin, rest, warnings }
  }

  const m2 = rest.match(/(\d{1,2})\s*시간/)
  if (m2) {
    durationMin = parseInt(m2[1], 10) * 60
    rest = rest.replace(m2[0], "").trim()
    return { hasDuration: true, durationMin, rest, warnings }
  }

  const m3 = rest.match(/(\d{1,3})\s*분/)
  if (m3) {
    durationMin = parseInt(m3[1], 10)
    rest = rest.replace(m3[0], "").trim()
    return { hasDuration: true, durationMin, rest, warnings }
  }

  return { hasDuration: false, durationMin: undefined as number | undefined, rest, warnings }
}

function findActivityIdByName(activities: ActivityLite[], name: string) {
  const n = name.trim()
  const hit = activities.find(a => a.name === n)
  if (hit) return hit.id
  const hit2 = activities.find(a => a.name.includes(n) || n.includes(a.name))
  return hit2?.id
}

export function parseKoreanScheduleWithTaxonomy(rawText: string, baseDate: Date, activities: ActivityLite[]): ParseResult {
  const warnings: string[] = []
  const text0 = normalizeText(rawText)

  const { date, hasDate, rest: t1 } = extractRelativeDate(text0, baseDate)
  const dateISO = dateToISO(date)

  const range = extractTimeRange(t1)
  warnings.push(...range.warnings)

  let startMin = range.startMin
  let endMin = range.endMin
  let rest = range.rest
  const hasRange = range.hasRange

  let hasTime = false
  if (!hasRange) {
    const tp = extractTimePoint(rest)
    warnings.push(...tp.warnings)
    startMin = tp.startMin
    hasTime = tp.hasTime
    rest = tp.rest
  } else {
    hasTime = true
  }

  const dur = extractDuration(rest)
  warnings.push(...dur.warnings)
  const durationMin = dur.durationMin
  rest = dur.rest

  let title = rest.replace(/에\s*$/g, "").trim()
  if (!title) title = "일정"

  if (startMin != null && endMin == null) {
    if (durationMin != null) endMin = startMin + durationMin
    else {
      endMin = startMin + 60
      warnings.push("기간이 없어 기본 60분으로 잡았어요.")
    }
  }

  if (startMin != null && endMin != null) {
    if (endMin > 24 * 60) {
      warnings.push("종료 시간이 자정을 넘어가서 24:00으로 잘랐어요.")
      endMin = 24 * 60
    }
    if (endMin <= startMin) warnings.push("종료 시간이 시작 시간보다 이르거나 같아요. 시간을 확인하세요.")
  }

  const inferred = inferTaxonomy(title)
  const activityName = topToActivityName(inferred.top)
  const activityId = findActivityIdByName(activities, activityName)

  if (!activityId) warnings.push(`"${activityName}" 활동이 activities에 없어요. (활동 목록에 추가 필요)`)

  const tokens = {
    hasDate,
    hasTime: startMin != null,
    hasDuration: dur.hasDuration,
    hasTitle: !!title && title !== "일정",
    hasRange,
  }

  let confidence = 0.15
  if (tokens.hasTime) confidence += 0.35
  if (tokens.hasDuration) confidence += 0.15
  if (tokens.hasRange) confidence += 0.10
  if (tokens.hasTitle) confidence += 0.10
  if (activityId) confidence += 0.05
  confidence += (inferred.confidence - 0.5) * 0.2
  if (warnings.length) confidence -= Math.min(0.2, warnings.length * 0.05)
  confidence = clamp(confidence, 0, 1)

  return {
    raw: rawText,
    dateISO,
    title,
    startMin,
    endMin,
    durationMin: durationMin ?? (startMin != null && endMin != null ? endMin - startMin : undefined),
    activityId,
    activityName,
    top: inferred.top,
    workType: inferred.workType,
    workTopic: inferred.topic,
    confidence,
    warnings,
    tokens,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 멀티 세그먼트 분리 + 의도(intent) 감지 + 통합 파서
// ────────────────────────────────────────────────────────────────────────────

/**
 * 한 문장을 여러 조각으로 분리
 * 예: "오전 9시 과외준비 2시간 그리고 12시 점심"
 *  → ["오전 9시 과외준비 2시간", "12시 점심"]
 */
export function splitVoiceSegments(raw: string): string[] {
  return raw
    .split(/\s*(?:그리고|그 다음|다음에|,)\s*/g)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 일정 생성 의도인지 / 컨디션 기록인지 / 추천 요청인지 구분
 */
export function detectVoiceIntent(text: string): VoiceIntent {
  const t = normalizeText(text)

  if (/(언제\s*하지|언제\s*하면|뭐부터|추천해|추천)/.test(t)) {
    return "suggestion_request"
  }

  if (
    /(피곤|졸리|아파|약 안 먹|약안먹|생리|기분|우울|짜증|힘들|과몰입|과집중|못 했|못했|못함)/.test(t)
  ) {
    return "condition_log"
  }

  if (/(오전|오후|내일|모레|\d{1,2}시|\d{1,2}분|부터|까지|~|-)/.test(t)) {
    return "schedule_create"
  }

  return "unknown"
}

/**
 * 여러 일정 파싱 — 세그먼트 분리 후 각각 파싱
 */
export function parseMultiSchedule(
  rawText: string,
  baseDate: Date,
  activities: ActivityLite[],
): ParseResult[] {
  const parts = splitVoiceSegments(rawText)

  return parts
    .map((part) => parseKoreanScheduleWithTaxonomy(part, baseDate, activities))
    .filter((r) => r.startMin != null && r.endMin != null)
}

/**
 * 컨디션 기록 추출 — 규칙 기반 최소 구현
 */
export function parseConditionLog(rawText: string): ConditionLogPayload {
  const tags: string[] = []
  let fatigue: number | undefined
  let mood: number | undefined
  let focus: number | undefined

  if (/피곤|졸리|지침|지쳤/.test(rawText)) { tags.push("피곤함"); fatigue = 4 }
  if (/약 안 먹|약안먹/.test(rawText)) tags.push("약 미복용")
  if (/생리/.test(rawText)) tags.push("생리")
  if (/아파|통증|배아파|두통/.test(rawText)) tags.push("통증")
  if (/기분 별로|우울|짜증|속상|힘들/.test(rawText)) { tags.push("기분 저하"); mood = 2 }
  if (/집중 안 돼|집중안돼|과몰입|과집중/.test(rawText)) {
    tags.push("집중 이슈")
    focus = /과몰입|과집중/.test(rawText) ? 5 : 2
  }

  return { memo: rawText, tags, fatigue, mood, focus }
}

/**
 * 추천 요청 추출
 * "영어 공부 언제 하지" → "영어 공부"
 */
export function parseSuggestionRequest(rawText: string): SuggestionRequestPayload {
  const cleaned = rawText
    .replace(/언제\s*하지/g, "")
    .replace(/언제\s*하면/g, "")
    .replace(/뭐부터/g, "")
    .replace(/추천해/g, "")
    .replace(/추천/g, "")
    .trim()
  return { activityQuery: cleaned }
}

/**
 * 최상위 음성 파서 — intent 분기 → 적절한 서브 파서 호출
 */
export function parseVoiceInput(
  rawText: string,
  baseDate: Date,
  activities: ActivityLite[],
): VoiceParsedResult {
  const intent = detectVoiceIntent(rawText)

  if (intent === "schedule_create") {
    return { kind: "schedule_create", items: parseMultiSchedule(rawText, baseDate, activities) }
  }
  if (intent === "condition_log") {
    return { kind: "condition_log", payload: parseConditionLog(rawText) }
  }
  if (intent === "suggestion_request") {
    return { kind: "suggestion_request", payload: parseSuggestionRequest(rawText) }
  }
  return { kind: "unknown", raw: rawText }
}