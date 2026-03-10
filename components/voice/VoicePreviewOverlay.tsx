"use client"

import { useMemo } from "react"
import {
  X, RotateCcw, Check, AlertTriangle,
  Clock, CalendarDays, Tag, BookOpen, Trash2, CheckCheck,
} from "lucide-react"
import type { ParseResult, ActivityLite } from "@/utils/voiceParseWithTaxonomy"

/* ───── helpers ───── */
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`)
const minToHM = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
const confidenceColor = (c: number) =>
  c >= 0.7 ? "text-emerald-400" : c >= 0.4 ? "text-amber-400" : "text-red-400"

/* ───── props ───── */
interface Props {
  open: boolean
  onClose: () => void
  /** 복수 파싱 결과 */
  results: ParseResult[]
  activities: ActivityLite[]
  /** 선택된 결과들 일괄 확정 */
  onConfirmAll: (list: ParseResult[]) => void
  /** 개별 삭제 */
  onRemove: (idx: number) => void
  onRetry: () => void
}

export function VoicePreviewOverlay({
  open, onClose, results, activities, onConfirmAll, onRemove, onRetry,
}: Props) {
  if (!open || results.length === 0) return null

  const validCount = results.filter(r => r.startMin != null).length

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-200 max-h-[85vh] flex flex-col">

        {/* header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <h3 className="text-base font-bold">
            📋 음성 파싱 결과
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {results.length}건
            </span>
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* scrollable body */}
        <div className="px-5 pb-3 overflow-y-auto flex-1 space-y-3">
          {results.map((parse, idx) => (
            <ResultCard
              key={idx}
              index={idx}
              parse={parse}
              activities={activities}
              onRemove={() => onRemove(idx)}
            />
          ))}
        </div>

        {/* footer */}
        <div className="flex gap-2 px-5 pb-5 pt-2 shrink-0 border-t border-border/20">
          <button
            onClick={onRetry}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            다시 말하기
          </button>
          <button
            onClick={() => onConfirmAll(results.filter(r => r.startMin != null))}
            disabled={validCount === 0}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white text-sm font-bold shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <CheckCheck className="w-4 h-4" />
            {validCount}건 모두 추가
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───── 개별 카드 ───── */
function ResultCard({
  index,
  parse,
  activities,
  onRemove,
}: {
  index: number
  parse: ParseResult
  activities: ActivityLite[]
  onRemove: () => void
}) {
  const actName = useMemo(() => {
    if (parse.activityName) return parse.activityName
    const found = activities.find(a => a.id === parse.activityId)
    return found?.name ?? "—"
  }, [parse, activities])

  const isValid = parse.startMin != null

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${isValid ? "border-border/30 bg-muted/20" : "border-red-500/30 bg-red-500/5 opacity-60"}`}>

      {/* top row: index + title + delete */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{parse.title}</div>
          <div className="text-[11px] text-muted-foreground truncate">&ldquo;{parse.raw}&rdquo;</div>
        </div>
        <button onClick={onRemove} className="shrink-0 p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* detail grid */}
      <div className="grid grid-cols-3 gap-1.5 text-xs">
        {/* 날짜 */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <CalendarDays className="w-3 h-3 text-blue-400" />
          <span>{parse.dateISO}</span>
        </div>

        {/* 시간 */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-3 h-3 text-purple-400" />
          <span>
            {parse.startMin != null ? minToHM(parse.startMin) : "—"}
            {parse.endMin != null ? `~${minToHM(parse.endMin)}` : ""}
          </span>
        </div>

        {/* 활동 */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <BookOpen className="w-3 h-3 text-emerald-400" />
          <span className="truncate">{actName}</span>
        </div>
      </div>

      {/* 분류 + 신뢰도 */}
      <div className="flex items-center gap-3 text-[10px]">
        {parse.workType && (
          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">
            {parse.workType}
          </span>
        )}
        <span className={`${confidenceColor(parse.confidence)}`}>
          신뢰도 {Math.round(parse.confidence * 100)}%
        </span>
      </div>

      {/* 경고 */}
      {parse.warnings.length > 0 && (
        <div className="space-y-0.5">
          {parse.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-400">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
