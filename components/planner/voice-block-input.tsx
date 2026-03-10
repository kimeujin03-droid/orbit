"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { usePlannerStore, formatDateISO, getLogicalDateISO } from "@/lib/store"
import { haptic } from "@/lib/haptic"
import {
  parseVoiceInput,
  type ParseResult,
  type ActivityLite,
} from "@/utils/voiceParseWithTaxonomy"
import { VoicePreviewOverlay } from "@/components/voice/VoicePreviewOverlay"

// ---- topic localStorage ----
const TOPIC_STORE_KEY = "planner_work_topics_v1"

function loadTopics(): string[] {
  try {
    return JSON.parse(localStorage.getItem(TOPIC_STORE_KEY) || "[]")
  } catch {
    return []
  }
}
function saveTopic(t: string) {
  const arr = loadTopics()
  if (!arr.includes(t)) {
    arr.unshift(t)
    localStorage.setItem(TOPIC_STORE_KEY, JSON.stringify(arr.slice(0, 50)))
  }
}

// ===== VoiceBlockInput =====
export function VoiceBlockInput({ date, onDone }: { date: Date; onDone?: () => void }) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [isParsing, setIsParsing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef<any>(null)

  // 복수 결과 수집
  const [previewOpen, setPreviewOpen] = useState(false)
  const [parseResults, setParseResults] = useState<ParseResult[]>([])

  // Refs — 클로저 문제 방지를 위해 모두 ref로 관리
  const pendingTextsRef = useRef<string[]>([])
  const transcriptRef = useRef("")
  const isListeningRef = useRef(false)
  const wantStopRef = useRef(false) // 사용자가 stop 버튼을 눌렀는지
  const didParseRef = useRef(false) // doParse 중복 호출 방지
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { activities, addBlock, pushSnapshot, addLogEntry, setCondition, startHour } = usePlannerStore()

  const activityLites: ActivityLite[] = activities.map(a => ({
    id: a.id,
    name: a.name,
  }))
  const activityLitesRef = useRef(activityLites)
  activityLitesRef.current = activityLites

  const dateRef = useRef(date)
  dateRef.current = date

  const startHourRef = useRef(startHour)
  startHourRef.current = startHour

  // ---- 파싱 로직 (ref 기반, 클로저 safe) ----
  const doParse = useCallback((textsToUse: string[]) => {
    if (textsToUse.length === 0) return
    // 중복 호출 방지 — onend + fallback 타이머가 동시에 호출할 수 있음
    if (didParseRef.current) return
    didParseRef.current = true
    // fallback 타이머 취소
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }

    setIsParsing(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    haptic.light()

    try {
      // 중복 제거: 동일 문장이 여러 번 수집된 경우 1번만 사용
      const unique = [...new Set(textsToUse)]
      const combined = unique.join(" 그리고 ")
      console.log("[Voice] parsing combined:", combined, "(from", textsToUse.length, "→", unique.length, "texts)")

      const parsed = parseVoiceInput(
        combined,
        // startHour 기준 논리적 날짜 — 새벽 3시에 startHour=6이면 어제를 baseDate로
        (() => {
          const now = new Date()
          if (now.getHours() < startHourRef.current) {
            const prev = new Date(now)
            prev.setDate(prev.getDate() - 1)
            return prev
          }
          return dateRef.current
        })(),
        activityLitesRef.current,
      )
      console.log("[Voice] parseVoiceInput result:", parsed)

      if (parsed.kind === "schedule_create") {
        if (parsed.items.length > 0) {
          setParseResults(parsed.items)
          setPreviewOpen(true)
        } else {
          setErrorMsg("시간 정보를 인식하지 못했어요. 다시 시도하세요.")
        }
      } else if (parsed.kind === "condition_log") {
        const p = parsed.payload
        const now = new Date()
        const dateISO = getLogicalDateISO(now, startHourRef.current)
        const timeMin = now.getHours() * 60 + now.getMinutes()

        // 1) LogEntry로 저장 (통합 기록)
        addLogEntry({
          dateISO,
          timeMin,
          type: "health",
          title: "음성 컨디션 기록",
          memo: p.memo,
          tags: p.tags,
          mood: p.mood as 1 | 2 | 3 | 4 | 5 | undefined,
          focus: p.focus as 1 | 2 | 3 | 4 | 5 | undefined,
          energy: p.fatigue ? (6 - p.fatigue) as 1 | 2 | 3 | 4 | 5 : undefined,
          category: "health",
          meta: { source: "voice", fatigue: p.fatigue },
        })

        // 2) DailyCondition도 업데이트 (컨디션 탭 반영)
        setCondition(dateISO, {
          focus: (p.focus ?? 3) as 1 | 2 | 3 | 4 | 5,
          mood: (p.mood ?? 3) as 1 | 2 | 3 | 4 | 5,
          fatigue: (p.fatigue ?? 3) as 1 | 2 | 3 | 4 | 5,
          pms: p.tags.includes("생리"),
          note: p.memo,
        })

        haptic.success()
        setSuccessMsg(`컨디션 기록 저장됨: ${p.tags.length > 0 ? p.tags.join(", ") : p.memo}`)
      } else if (parsed.kind === "suggestion_request") {
        console.log("[Voice] suggestion_request:", parsed.payload)
        setSuccessMsg(`추천 요청: "${parsed.payload.activityQuery}"\n(추천 기능은 준비 중이에요)`)
      } else {
        setErrorMsg("무슨 의미인지 잘 모르겠어요. 다시 말해 주세요.")
      }
    } catch (err) {
      console.error("[Voice] parse error:", err)
      setErrorMsg("음성 명령을 처리하는 중 오류가 발생했어요")
    } finally {
      setIsParsing(false)
      setTranscript("")
      transcriptRef.current = ""
      pendingTextsRef.current = []
    }
  }, [addLogEntry, setCondition])

  // ---- speech recognition setup ----
  useEffect(() => {
    if (typeof window === "undefined") return
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    if (!SR) {
      setSupported(false)
      return
    }

    const rec = new SR()
    rec.lang = "ko-KR"
    rec.interimResults = true
    // continuous=false: 한 번 말하면 자동 종료 → 더 안정적
    rec.continuous = false

    // 마지막으로 수집한 final 텍스트 — 중복 방지용
    let lastFinalText = ""

    rec.onresult = (event: any) => {
      setErrorMsg(null)

      // event.resultIndex 이후만 처리 — 이전 결과 재처리 방지
      let finalText = ""
      let interimText = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) {
          finalText += r[0].transcript
        } else {
          interimText += r[0].transcript
        }
      }

      // 화면 표시: 기존 수집된 텍스트 + 현재 interim
      const collected = pendingTextsRef.current.join(" ")
      const display = (collected + " " + (finalText || interimText)).trim()
      setTranscript(display)
      transcriptRef.current = display

      // final 결과만 수집 — 중복 체크
      if (finalText) {
        const trimmed = finalText.trim()
        if (trimmed && trimmed !== lastFinalText) {
          lastFinalText = trimmed
          pendingTextsRef.current.push(trimmed)
          console.log("[Voice] collected final:", trimmed, "| all pending:", pendingTextsRef.current)
        }
      }
    }

    rec.onerror = (event: any) => {
      const code = event.error as string
      console.warn("[Voice] onerror:", code)

      if (code === "no-speech") {
        // Android에서 자주 발생 — 자동 재시작 시도
        if (isListeningRef.current && !wantStopRef.current) {
          console.log("[Voice] no-speech → auto-restart")
          lastFinalText = ""
          try { rec.start() } catch { /* already running */ }
          return
        }
        setErrorMsg("음성이 감지되지 않았어요. 다시 시도하세요.")
      } else if (code === "not-allowed" || code === "service-not-allowed") {
        setErrorMsg(
          "마이크 권한이 차단되어 있어요.\n브라우저 주소창 🔒 → 마이크 허용 후 다시 시도하세요."
        )
      } else if (code === "network") {
        setErrorMsg("네트워크 오류. 인터넷 연결을 확인하세요.")
      } else if (code === "aborted") {
        return
      } else {
        setErrorMsg(`음성 인식 오류: ${code}`)
      }

      setIsListening(false)
      isListeningRef.current = false
    }

    rec.onend = () => {
      console.log("[Voice] onend — wantStop:", wantStopRef.current, "pending:", pendingTextsRef.current)

      if (wantStopRef.current) {
        // 사용자가 중지 → 수집된 텍스트 파싱
        setIsListening(false)
        isListeningRef.current = false
        wantStopRef.current = false

        const texts = [...pendingTextsRef.current]
        if (texts.length === 0 && transcriptRef.current.trim()) {
          texts.push(transcriptRef.current.trim())
        }
        if (texts.length > 0) {
          setTimeout(() => doParse(texts), 50)
        }
      } else if (isListeningRef.current) {
        // continuous=false 환경에서 자동 종료됨 → 재시작
        // pendingTextsRef는 유지, lastFinalText 리셋
        console.log("[Voice] auto-restart")
        lastFinalText = ""
        try { rec.start() } catch {
          // 재시작 실패 → 현재까지의 결과로 파싱
          setIsListening(false)
          isListeningRef.current = false
          const texts = [...pendingTextsRef.current]
          if (texts.length === 0 && transcriptRef.current.trim()) {
            texts.push(transcriptRef.current.trim())
          }
          if (texts.length > 0) {
            setTimeout(() => doParse(texts), 50)
          }
        }
      }
    }

    recognitionRef.current = rec
    return () => {
      try { rec.stop() } catch { /* ignore */ }
    }
  }, [doParse])

  // ---- commit all ----
  const commitAll = useCallback(
    (list: ParseResult[]) => {
      if (list.length === 0) return
      pushSnapshot()

      // 현재 시각(분) — 블록이 과거면 execute, 미래면 overlay
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()

      // startHour 기준 논리적 오늘 dateISO
      const logicalTodayISO = getLogicalDateISO(now, startHour)
      // 기본 dateISO: 선택된 날짜 (타임라인이 표시하는 날짜와 동일)
      const fallbackDateISO = formatDateISO(date)

      for (const p of list) {
        if (p.startMin == null || p.endMin == null) continue
        // 파서가 반환한 dateISO를 우선, 없으면 현재 선택된 날짜
        const dateISO = p.dateISO || fallbackDateISO
        const activityId = p.activityId || activities[0]?.id || "custom"
        const meta = {
          workType: p.workType,
          workTopic: p.workTopic,
          raw: p.raw,
          title: p.title,
        }

        console.log("[Voice] commitAll block:", {
          dateISO, activityId, startMin: p.startMin, endMin: p.endMin,
          fallbackDateISO, logicalTodayISO, parsedDateISO: p.dateISO,
        })

        // 오늘이 아닌 다른 날이면 → 무조건 계획(overlay)
        const isToday = dateISO === logicalTodayISO

        // 블록 끝이 현재 시간 이전 → 이미 한 것(execute)
        // 블록 시작이 현재 시간 이후 → 할 것(overlay, 계획)
        // 걸쳐있으면 → 하고 있는 것(execute)
        const isPast = isToday && p.endMin <= nowMin
        const isCurrent = isToday && p.startMin <= nowMin && p.endMin > nowMin
        const isFuture = !isToday || p.startMin > nowMin

        if (isPast || isCurrent) {
          // 이미 했거나 하고 있는 것 → execute + overlay 둘 다
          addBlock({ dateISO, activityId, startMin: p.startMin, endMin: p.endMin, layer: "overlay", source: "voice", meta })
          addBlock({ dateISO, activityId, startMin: p.startMin, endMin: p.endMin, layer: "execute", source: "voice", meta })
        } else {
          // 아직 안 한 것 → 계획(overlay)만
          addBlock({ dateISO, activityId, startMin: p.startMin, endMin: p.endMin, layer: "overlay", source: "voice", meta })
        }

        if (p.workTopic) saveTopic(p.workTopic)
      }

      haptic.success()
      setPreviewOpen(false)
      setParseResults([])

      // 마이크 확실히 종료
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch { /* ignore */ }
      }
      setIsListening(false)
      isListeningRef.current = false
      wantStopRef.current = false

      // 다이얼로그 닫기
      onDone?.()
    },
    [addBlock, pushSnapshot, activities, date, startHour, onDone],
  )

  // ---- remove one from preview ----
  const handleRemove = useCallback((idx: number) => {
    setParseResults(prev => prev.filter((_, i) => i !== idx))
  }, [])

  // ---- mic toggle ----
  const toggleListening = async () => {
    if (!supported) {
      setErrorMsg(
        "이 브라우저는 음성 인식을 지원하지 않아요.\nChrome / Edge 브라우저를 사용하세요."
      )
      return
    }
    if (!recognitionRef.current) return
    setErrorMsg(null)
    setSuccessMsg(null)

    if (isListeningRef.current) {
      // ⏹ 멈추기 → onend에서 파싱 수행
      wantStopRef.current = true
      didParseRef.current = false // 새 파싱 세션 시작 — 중복 방지 리셋
      try { recognitionRef.current.stop() } catch { /* ignore */ }
      setIsListening(false)
      isListeningRef.current = false

      // onend가 안 올 수도 있으므로 fallback (onend에서 이미 파싱했으면 didParseRef가 true라 무시됨)
      fallbackTimerRef.current = setTimeout(() => {
        if (!didParseRef.current) {
          wantStopRef.current = false
          const texts = [...pendingTextsRef.current]
          if (texts.length === 0 && transcriptRef.current.trim()) {
            texts.push(transcriptRef.current.trim())
          }
          if (texts.length > 0) {
            doParse(texts)
          }
        }
      }, 800)
    } else {
      // 마이크 권한 확인
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(t => t.stop())
      } catch {
        setErrorMsg(
          "마이크 권한이 필요해요.\n브라우저 주소창 🔒 → 마이크 허용 후 다시 시도하세요."
        )
        return
      }
      try {
        pendingTextsRef.current = []
        transcriptRef.current = ""
        wantStopRef.current = false
        didParseRef.current = false
        setTranscript("")
        recognitionRef.current.start()
        setIsListening(true)
        isListeningRef.current = true
        haptic.light()
      } catch (err) {
        console.error("[Voice] start error:", err)
        setErrorMsg("음성 인식을 시작할 수 없어요. 잠시 후 다시 시도하세요.")
      }
    }
  }

  // ---- retry ----
  const handleRetry = () => {
    setPreviewOpen(false)
    setParseResults([])
    toggleListening()
  }

  return (
    <>
      <div className="space-y-3">
        {/* 음성 입력 버튼 */}
        <button
          onClick={toggleListening}
          disabled={isParsing}
          className={`
            w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-medium transition-all
            ${
              isListening
                ? "bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/30 animate-pulse"
                : "bg-gradient-to-r from-primary to-purple-500 text-white hover:shadow-lg hover:shadow-primary/30"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isParsing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>처리 중...</span>
            </>
          ) : isListening ? (
            <>
              <MicOff className="w-5 h-5" />
              <span>듣는 중… (탭하여 완료)</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              <span>음성으로 일정 추가</span>
            </>
          )}
        </button>

        {/* 실시간 전사 */}
        {transcript && (
          <div className="bg-muted/50 rounded-xl p-3 border border-border/20">
            <div className="text-xs text-muted-foreground mb-1">인식된 내용:</div>
            <div className="text-sm font-medium">{transcript}</div>
          </div>
        )}

        {/* 에러 메시지 */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <div className="text-sm text-red-400 whitespace-pre-line">{errorMsg}</div>
          </div>
        )}

        {/* 성공 메시지 (컨디션 저장, 추천 요청 등) */}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <div className="text-sm text-emerald-400 whitespace-pre-line">✅ {successMsg}</div>
          </div>
        )}

        {/* 사용 예시 */}
        {!isListening && !isParsing && !errorMsg && !successMsg && (
          <div className="bg-muted/30 rounded-xl p-3 border border-border/10">
            <div className="text-xs font-medium text-muted-foreground mb-2">💡 이렇게 말해보세요:</div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>📅 "오후 3시부터 5시까지 전공수업, 그리고 6시부터 7시까지 운동"</div>
              <div>📅 "오전 9시 과외준비 2시간 그리고 12시부터 1시까지 점심"</div>
              <div>🩺 "오늘 너무 피곤해" · "약 안 먹었어"</div>
              <div>💡 "영어 공부 언제 하지" · "빅분 추천해"</div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Overlay (복수 결과) */}
      <VoicePreviewOverlay
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false)
          setParseResults([])
        }}
        results={parseResults}
        activities={activityLites}
        onConfirmAll={commitAll}
        onRemove={handleRemove}
        onRetry={handleRetry}
      />
    </>
  )
}

// ===== 플로팅 버튼 =====
export function VoiceInputFloatingButton({ date }: { date: Date }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-white bg-gradient-to-r from-primary to-purple-500 hover:scale-105 active:scale-95 transition-transform"
      >
        <Mic className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl p-5 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">음성 입력</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <VoiceBlockInput date={date} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
