"use client"

import { useState } from "react"
import { X, Smile, Zap, BookOpen, Heart } from "lucide-react"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import type { LogEntryType, LogEntryCategory, ContentKind } from "@/lib/types"

// ─── 상수 ──────────────────────────────────────────────────────────────────

const MOOD_LABELS = ["", "😞 힘들어", "😕 별로야", "😐 그냥저냥", "🙂 괜찮아", "😊 좋아!"]
const ENERGY_LABELS = ["", "🪫 방전", "😴 피곤", "😐 보통", "⚡ 활기", "🔥 넘침"]
const SYMPTOMS = ["피곤함", "두통", "붓기", "예민함", "무기력", "소화불량", "불안"]
const CONTENT_KINDS: { value: ContentKind; label: string; emoji: string }[] = [
  { value: "book", label: "책", emoji: "📖" },
  { value: "drama", label: "드라마", emoji: "📺" },
  { value: "movie", label: "영화", emoji: "🎬" },
  { value: "youtube", label: "유튜브", emoji: "▶️" },
  { value: "other", label: "기타", emoji: "🎵" },
]

type SheetMode = "menu" | "note" | "mood" | "health" | "content"

// ─── 하위 컴포넌트 ──────────────────────────────────────────────────────────

function ScorePicker({
  value, onChange, labels, label,
}: {
  value?: number
  onChange: (v: number) => void
  labels: string[]
  label: string
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
              value === n
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
            }`}
          >
            {labels[n]}
          </button>
        ))}
      </div>
    </div>
  )
}

function MemoInput({
  value, onChange, placeholder, rows = 2,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "메모 (선택)"}
      rows={rows}
      className="w-full bg-secondary/30 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 resize-none outline-none focus:ring-1 focus:ring-primary/40 transition-all"
    />
  )
}

function SaveButton({ onSave, disabled }: { onSave: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onSave}
      disabled={disabled}
      className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity active:scale-95"
    >
      저장
    </button>
  )
}

// ─── 모드별 폼 ──────────────────────────────────────────────────────────────

function NoteForm({ onSave }: { onSave: () => void }) {
  const { addLogEntry, selectedDate } = usePlannerStore()
  const [memo, setMemo] = useState("")

  const handleSave = () => {
    if (!memo.trim()) return
    addLogEntry({
      dateISO: formatDateISO(selectedDate),
      timeMin: new Date().getHours() * 60 + new Date().getMinutes(),
      type: "note",
      memo: memo.trim(),
      tags: [],
      category: "daily_life",
    })
    onSave()
  }

  return (
    <div className="space-y-3">
      <MemoInput
        value={memo}
        onChange={setMemo}
        placeholder="오늘 있었던 일, 생각, 느낀 점..."
        rows={4}
      />
      <SaveButton onSave={handleSave} disabled={!memo.trim()} />
    </div>
  )
}

function MoodForm({ onSave }: { onSave: () => void }) {
  const { addLogEntry, selectedDate } = usePlannerStore()
  const [mood, setMood] = useState<number | undefined>()
  const [energy, setEnergy] = useState<number | undefined>()
  const [memo, setMemo] = useState("")

  const handleSave = () => {
    if (!mood && !energy) return
    addLogEntry({
      dateISO: formatDateISO(selectedDate),
      timeMin: new Date().getHours() * 60 + new Date().getMinutes(),
      type: "mood",
      memo: memo.trim() || undefined,
      mood: mood as 1 | 2 | 3 | 4 | 5 | undefined,
      energy: energy as 1 | 2 | 3 | 4 | 5 | undefined,
      tags: [],
      category: "emotion",
      meta: mood ? { moodLabel: MOOD_LABELS[mood] } : {},
    })
    onSave()
  }

  return (
    <div className="space-y-3">
      <ScorePicker value={mood} onChange={setMood} labels={MOOD_LABELS} label="기분" />
      <ScorePicker value={energy} onChange={setEnergy} labels={ENERGY_LABELS} label="에너지" />
      <MemoInput value={memo} onChange={setMemo} placeholder="한 줄 메모 (선택)" />
      <SaveButton onSave={handleSave} disabled={!mood && !energy} />
    </div>
  )
}

function HealthForm({ onSave }: { onSave: () => void }) {
  const { addLogEntry, selectedDate } = usePlannerStore()
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [sleepHours, setSleepHours] = useState("")
  const [memo, setMemo] = useState("")

  const toggleSymptom = (s: string) =>
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const handleSave = () => {
    if (symptoms.length === 0 && !sleepHours && !memo.trim()) return
    addLogEntry({
      dateISO: formatDateISO(selectedDate),
      timeMin: new Date().getHours() * 60 + new Date().getMinutes(),
      type: "health",
      memo: memo.trim() || undefined,
      tags: symptoms,
      category: "health",
      meta: {
        symptoms,
        sleepHours: sleepHours ? parseFloat(sleepHours) : undefined,
      },
    })
    onSave()
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">증상</p>
        <div className="flex flex-wrap gap-1.5">
          {SYMPTOMS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSymptom(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                symptoms.includes(s)
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">수면 시간</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={sleepHours}
            onChange={(e) => setSleepHours(e.target.value)}
            placeholder="7.5"
            className="w-24 bg-secondary/30 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40 text-center"
          />
          <span className="text-xs text-muted-foreground">시간</span>
        </div>
      </div>
      <MemoInput value={memo} onChange={setMemo} />
      <SaveButton onSave={handleSave} disabled={symptoms.length === 0 && !sleepHours && !memo.trim()} />
    </div>
  )
}

function ContentForm({ onSave }: { onSave: () => void }) {
  const { addLogEntry, selectedDate } = usePlannerStore()
  const [kind, setKind] = useState<ContentKind>("book")
  const [title, setTitle] = useState("")
  const [progress, setProgress] = useState("")
  const [memo, setMemo] = useState("")

  const handleSave = () => {
    if (!title.trim()) return
    addLogEntry({
      dateISO: formatDateISO(selectedDate),
      timeMin: new Date().getHours() * 60 + new Date().getMinutes(),
      type: "content",
      title: title.trim(),
      memo: memo.trim() || undefined,
      tags: [kind],
      category: "content",
      meta: {
        contentKind: kind,
        progressText: progress.trim() || undefined,
      },
    })
    onSave()
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {CONTENT_KINDS.map((ck) => (
          <button
            key={ck.value}
            onClick={() => setKind(ck.value)}
            className={`flex-1 py-2 rounded-xl text-[11px] font-medium flex flex-col items-center gap-0.5 transition-all ${
              kind === ck.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
            }`}
          >
            <span>{ck.emoji}</span>
            <span>{ck.label}</span>
          </button>
        ))}
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목을 입력하세요"
        className="w-full bg-secondary/30 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/40"
      />
      <input
        type="text"
        value={progress}
        onChange={(e) => setProgress(e.target.value)}
        placeholder="진행 상황 (예: 2화까지, 3장)"
        className="w-full bg-secondary/30 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/40"
      />
      <MemoInput value={memo} onChange={setMemo} placeholder="한 줄 감상 (선택)" />
      <SaveButton onSave={handleSave} disabled={!title.trim()} />
    </div>
  )
}

// ─── 메인 시트 ──────────────────────────────────────────────────────────────

const MENU_ITEMS: { mode: SheetMode; emoji: string; label: string; color: string }[] = [
  { mode: "note", emoji: "📝", label: "메모", color: "bg-blue-500/10 text-blue-400 border-blue-400/20" },
  { mode: "mood", emoji: "💭", label: "감정", color: "bg-purple-500/10 text-purple-400 border-purple-400/20" },
  { mode: "health", emoji: "💊", label: "컨디션", color: "bg-green-500/10 text-green-400 border-green-400/20" },
  { mode: "content", emoji: "🎬", label: "콘텐츠", color: "bg-orange-500/10 text-orange-400 border-orange-400/20" },
]

const MODE_TITLES: Record<SheetMode, string> = {
  menu: "빠른 기록",
  note: "📝 메모",
  mood: "💭 감정 기록",
  health: "💊 컨디션 기록",
  content: "🎬 콘텐츠 기록",
}

interface QuickAddSheetProps {
  open: boolean
  onClose: () => void
}

export function QuickAddSheet({ open, onClose }: QuickAddSheetProps) {
  const [mode, setMode] = useState<SheetMode>("menu")

  const handleClose = () => {
    setMode("menu")
    onClose()
  }

  const handleSaved = () => {
    handleClose()
  }

  if (!open) return null

  return (
    <>
      {/* 딤 배경 */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
        onClick={handleClose}
      />

      {/* 시트 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full w-[90vw] max-w-[430px] mx-4 bg-background rounded-t-3xl shadow-2xl border-t border-border/30 px-5 pb-8 pt-4 transition-all">
        {/* 핸들 */}
        <div className="w-10 h-1 bg-border/50 rounded-full mx-auto mb-4" />

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {mode !== "menu" && (
              <button
                onClick={() => setMode("menu")}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-secondary/50 text-muted-foreground"
              >
                ‹
              </button>
            )}
            <h3 className="text-base font-bold">{MODE_TITLES[mode]}</h3>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-secondary/50 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 콘텐츠 */}
        {mode === "menu" && (
          <div className="grid grid-cols-4 gap-3">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.mode}
                onClick={() => setMode(item.mode)}
                className={`flex flex-col items-center gap-2 py-4 rounded-2xl border font-medium transition-all active:scale-95 ${item.color}`}
              >
                <span className="text-2xl">{item.emoji}</span>
                <span className="text-xs">{item.label}</span>
              </button>
            ))}
          </div>
        )}
        {mode === "note" && <NoteForm onSave={handleSaved} />}
        {mode === "mood" && <MoodForm onSave={handleSaved} />}
        {mode === "health" && <HealthForm onSave={handleSaved} />}
        {mode === "content" && <ContentForm onSave={handleSaved} />}
      </div>
    </>
  )
}
