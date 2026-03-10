/* TODO: Safe Area - fixed top 요소들은 env(safe-area-inset-top) 고려 필요 */
"use client"

import { useState, useMemo } from "react"
import { Plus, X, ChevronLeft, ChevronRight, Repeat, Pencil, Check } from "lucide-react"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import { BUDGET_CATEGORIES } from "@/lib/types"
import type { BudgetCategory, BudgetEntry, FixedExpense } from "@/lib/types"
import { haptic } from "@/lib/haptic"

// ── 카테고리 정보 헬퍼 ────────────────────────────────────────────────────
function catInfo(name: BudgetCategory) {
  return BUDGET_CATEGORIES.find(c => c.name === name) ?? { name, emoji: "📦", color: "#CBD5E1" }
}

function fmtAmount(n: number) {
  return n.toLocaleString("ko-KR") + "원"
}

// ── 금액 입력 폼 ──────────────────────────────────────────────────────────
function AddEntryForm({
  dateISO,
  onClose,
}: {
  dateISO: string
  onClose: () => void
}) {
  const { addBudgetEntry } = usePlannerStore()
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<BudgetCategory>("식비")
  const [memo, setMemo] = useState("")
  const [isIncome, setIsIncome] = useState(false)

  const handleAdd = () => {
    const n = parseInt(amount.replace(/,/g, ""), 10)
    if (!n || isNaN(n)) return
    addBudgetEntry({
      dateISO,
      amount: isIncome ? -n : n,
      category,
      memo: memo.trim(),
    })
    haptic.success()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-x-4 bottom-16 z-[90] bg-background rounded-2xl shadow-2xl border border-border/20 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/10">
          <p className="text-sm font-bold">새 항목 추가</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* 지출 / 수입 토글 */}
          <div className="flex bg-secondary/30 rounded-xl p-0.5 gap-0.5">
            <button
              onClick={() => setIsIncome(false)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${!isIncome ? "bg-destructive/80 text-white shadow-sm" : "text-muted-foreground"}`}
            >
              지출
            </button>
            <button
              onClick={() => setIsIncome(true)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${isIncome ? "bg-green-500/80 text-white shadow-sm" : "text-muted-foreground"}`}
            >
              수입
            </button>
          </div>

          {/* 금액 */}
          <input
            autoFocus
            type="number"
            inputMode="numeric"
            placeholder="금액 (원)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full text-lg font-bold bg-secondary/10 rounded-xl px-4 py-3 border border-border/20 outline-none focus:ring-1 focus:ring-primary/40 text-center"
          />

          {/* 카테고리 */}
          <div className="grid grid-cols-5 gap-1.5">
            {BUDGET_CATEGORIES.map(cat => (
              <button
                key={cat.name}
                onClick={() => setCategory(cat.name)}
                className={`flex flex-col items-center py-2 rounded-xl text-[10px] font-medium transition-all border ${
                  category === cat.name
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/10 bg-secondary/10 text-muted-foreground"
                }`}
              >
                <span className="text-base mb-0.5">{cat.emoji}</span>
                {cat.name}
              </button>
            ))}
          </div>

          {/* 메모 */}
          <input
            placeholder="메모 (가게명 등)"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            className="w-full text-sm bg-secondary/10 rounded-xl px-3 py-2.5 border border-border/20 outline-none focus:ring-1 focus:ring-primary/40"
          />

          {/* 추가 버튼 */}
          <button
            onClick={handleAdd}
            disabled={!amount}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            추가
          </button>
        </div>
      </div>
    </>
  )
}

// ── 고정 지출 관리 시트 ───────────────────────────────────────────────────
function FixedExpenseSheet({ onClose }: { onClose: () => void }) {
  const { fixedExpenses, addFixedExpense, updateFixedExpense, removeFixedExpense } = usePlannerStore()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<BudgetCategory>("구독")
  const [cycle, setCycle] = useState<"monthly" | "weekly" | "daily">("monthly")

  const handleAdd = () => {
    const n = parseInt(amount.replace(/,/g, ""), 10)
    if (!name.trim() || !n) return
    addFixedExpense({ name: name.trim(), amount: n, category, cycle, active: true })
    setName(""); setAmount(""); setShowForm(false)
    haptic.success()
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-x-4 bottom-16 top-16 z-[90] flex flex-col bg-background rounded-2xl shadow-2xl border border-border/20 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/10 flex-shrink-0">
          <p className="text-sm font-bold flex items-center gap-2"><Repeat className="w-4 h-4" /> 고정 지출</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
          {fixedExpenses.length === 0 && !showForm && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-3xl mb-2">💳</p>
              <p className="text-sm text-muted-foreground">고정 지출이 없어요</p>
              <p className="text-xs text-muted-foreground/60">넷플릭스, 교통카드 등 매달 나가는 비용</p>
            </div>
          )}

          {fixedExpenses.map(exp => {
            const cat = catInfo(exp.category)
            const cycleLabel = exp.cycle === "monthly" ? "매월" : exp.cycle === "weekly" ? "매주" : "매일"
            return (
              <div key={exp.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/10 border border-border/10">
                <span className="text-xl">{cat.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{exp.name}</p>
                  <p className="text-[10px] text-muted-foreground">{cycleLabel} · {exp.category}</p>
                </div>
                <p className="text-sm font-bold text-destructive">{fmtAmount(exp.amount)}</p>
                <button
                  onClick={() => updateFixedExpense(exp.id, { active: !exp.active })}
                  className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 ${exp.active ? "bg-primary" : "bg-muted"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mx-0.5 ${exp.active ? "translate-x-3" : "translate-x-0"}`} />
                </button>
                <button onClick={() => { removeFixedExpense(exp.id); haptic.medium() }} className="text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}

          {/* 추가 폼 */}
          {showForm && (
            <div className="p-3 rounded-xl bg-secondary/10 border border-border/20 space-y-2">
              <input placeholder="이름 (넷플릭스 등)" value={name} onChange={e => setName(e.target.value)}
                className="w-full text-sm bg-background rounded-lg px-3 py-2 border border-border/20 outline-none" />
              <input type="number" placeholder="금액 (원)" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full text-sm bg-background rounded-lg px-3 py-2 border border-border/20 outline-none" />
              <div className="grid grid-cols-3 gap-1">
                {(["monthly", "weekly", "daily"] as const).map(c => (
                  <button key={c} onClick={() => setCycle(c)}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-all border ${cycle === c ? "border-primary bg-primary/10 text-primary" : "border-border/10 text-muted-foreground"}`}>
                    {c === "monthly" ? "매월" : c === "weekly" ? "매주" : "매일"}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1">
                {BUDGET_CATEGORIES.map(cat => (
                  <button key={cat.name} onClick={() => setCategory(cat.name)}
                    className={`flex flex-col items-center py-1.5 rounded-lg text-[9px] border transition-all ${category === cat.name ? "border-primary bg-primary/10 text-primary" : "border-border/10 text-muted-foreground"}`}>
                    <span className="text-sm">{cat.emoji}</span>{cat.name}
                  </button>
                ))}
              </div>
              <button onClick={handleAdd} disabled={!name || !amount}
                className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-40">
                추가
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/10 flex-shrink-0">
          <button onClick={() => setShowForm(v => !v)}
            className="w-full py-2.5 rounded-xl border border-dashed border-border/40 text-sm text-muted-foreground flex items-center justify-center gap-2 hover:bg-secondary/20 transition-colors">
            <Plus className="w-4 h-4" /> 고정 지출 추가
          </button>
        </div>
      </div>
    </>
  )
}

// ── 메인 가계부 뷰 ────────────────────────────────────────────────────────
export function BudgetView() {
  const { budgetEntries, removeBudgetEntry, fixedExpenses, selectedDate } = usePlannerStore()

  // 월 네비게이션
  const [monthOffset, setMonthOffset] = useState(0)
  const baseDate = useMemo(() => {
    const d = new Date(selectedDate)
    d.setMonth(d.getMonth() + monthOffset)
    return d
  }, [selectedDate, monthOffset])

  const year = baseDate.getFullYear()
  const month = baseDate.getMonth() // 0-based
  const monthLabel = `${year}년 ${month + 1}월`

  // 이번 달 항목들
  const monthEntries = useMemo(() => {
    return budgetEntries.filter(e => {
      const d = new Date(e.dateISO)
      return d.getFullYear() === year && d.getMonth() === month
    }).sort((a, b) => b.dateISO.localeCompare(a.dateISO))
  }, [budgetEntries, year, month])

  // 합계
  const totalExpense = monthEntries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const totalIncome = monthEntries.filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0)

  // 고정 지출 이번 달 합계
  const fixedTotal = fixedExpenses.filter(e => e.active && e.cycle === "monthly").reduce((s, e) => s + e.amount, 0)

  // 카테고리별 합계
  const categoryStats = useMemo(() => {
    const map = new Map<BudgetCategory, number>()
    monthEntries.filter(e => e.amount > 0).forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount)
    })
    return [...map.entries()]
      .map(([cat, total]) => ({ cat, total, info: catInfo(cat) }))
      .sort((a, b) => b.total - a.total)
  }, [monthEntries])

  const maxCat = categoryStats[0]?.total || 1

  // 일별 그룹
  const entriesByDate = useMemo(() => {
    const map = new Map<string, BudgetEntry[]>()
    monthEntries.forEach(e => {
      if (!map.has(e.dateISO)) map.set(e.dateISO, [])
      map.get(e.dateISO)!.push(e)
    })
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [monthEntries])

  const [showAddForm, setShowAddForm] = useState(false)
  const [showFixed, setShowFixed] = useState(false)
  const todayISO = formatDateISO(selectedDate)

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-hide">
      <div className="p-4 space-y-4">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setMonthOffset(o => o - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary/50">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-bold">{monthLabel}</span>
            <button onClick={() => setMonthOffset(o => o + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary/50">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFixed(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary/40 text-xs font-medium text-muted-foreground hover:bg-secondary/60 transition-colors">
              <Repeat className="w-3 h-3" /> 고정
            </button>
            <button onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-3 h-3" /> 추가
            </button>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-destructive/10 rounded-xl p-3 text-center border border-destructive/10">
            <p className="text-[9px] text-muted-foreground mb-1">이번 달 지출</p>
            <p className="text-sm font-bold text-destructive">{fmtAmount(totalExpense)}</p>
          </div>
          <div className="bg-green-500/10 rounded-xl p-3 text-center border border-green-500/10">
            <p className="text-[9px] text-muted-foreground mb-1">수입</p>
            <p className="text-sm font-bold text-green-500">{fmtAmount(totalIncome)}</p>
          </div>
          <div className="bg-secondary/20 rounded-xl p-3 text-center border border-border/10">
            <p className="text-[9px] text-muted-foreground mb-1">고정 지출</p>
            <p className="text-sm font-bold">{fmtAmount(fixedTotal)}</p>
          </div>
        </div>

        {/* 카테고리별 바 */}
        {categoryStats.length > 0 && (
          <div className="bg-secondary/10 rounded-xl p-3 border border-border/10 space-y-2">
            <h3 className="text-xs font-semibold">카테고리별 지출</h3>
            {categoryStats.map(({ cat, total, info }) => (
              <div key={cat} className="flex items-center gap-2">
                <span className="text-sm w-5 text-center flex-shrink-0">{info.emoji}</span>
                <div className="flex-1 h-4 bg-secondary/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(total / maxCat) * 100}%`, backgroundColor: info.color }}
                  />
                </div>
                <span className="text-[10px] font-medium w-20 text-right flex-shrink-0 text-foreground">
                  {fmtAmount(total)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 일별 내역 */}
        {entriesByDate.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-4xl mb-3">💰</p>
            <p className="text-sm text-muted-foreground">이번 달 내역이 없어요</p>
            <p className="text-xs text-muted-foreground/60 mt-1">+ 추가 버튼으로 기록하세요</p>
          </div>
        ) : (
          entriesByDate.map(([dateISO, entries]) => {
            const d = new Date(dateISO)
            const dayLabel = `${d.getMonth() + 1}/${d.getDate()} (${["일","월","화","수","목","금","토"][d.getDay()]})`
            const dayTotal = entries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0)
            const isToday = dateISO === todayISO

            return (
              <div key={dateISO} className="space-y-1.5">
                {/* 날짜 헤더 */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {isToday ? "오늘 · " : ""}{dayLabel}
                  </span>
                  <span className="text-[10px] text-destructive font-medium">{fmtAmount(dayTotal)}</span>
                </div>

                {/* 항목들 */}
                {entries.map(entry => {
                  const cat = catInfo(entry.category)
                  return (
                    <div key={entry.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-background/60 border border-border/10 group">
                      <span className="text-base flex-shrink-0">{cat.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.memo || entry.category}</p>
                        <p className="text-[10px] text-muted-foreground">{entry.category}</p>
                      </div>
                      <p className={`text-sm font-bold flex-shrink-0 ${entry.amount < 0 ? "text-green-500" : "text-foreground"}`}>
                        {entry.amount < 0 ? "+" : "-"}{fmtAmount(Math.abs(entry.amount))}
                      </p>
                      <button
                        onClick={() => { removeBudgetEntry(entry.id); haptic.medium() }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })
        )}

        <div className="h-4" />
      </div>

      {/* 팝업들 */}
      {showAddForm && <AddEntryForm dateISO={todayISO} onClose={() => setShowAddForm(false)} />}
      {showFixed && <FixedExpenseSheet onClose={() => setShowFixed(false)} />}
    </div>
  )
}
