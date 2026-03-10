"use client"

import { useState, useMemo } from "react"
import { Plus, X, Package, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import { Button } from "@/components/ui/button"
import type { ConsumableItem } from "@/lib/types"

// ── 구매별 사용 현황 카드 ────────────────────────────────────────────────
function PurchaseCard({ itemId }: { itemId: string }) {
  const {
    consumablePurchases,
    consumableUseLogs,
    addConsumableUseLog,
    removeConsumableUseLog,
    removeConsumablePurchase,
  } = usePlannerStore()

  const purchases = consumablePurchases
    .filter(p => p.itemId === itemId)
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))

  if (purchases.length === 0) return null

  // 최신 구매
  const latest = purchases[0]
  const latestLogs = consumableUseLogs.filter(l => l.purchaseId === latest.id)

  // 완료 여부: "finished" result 로그가 하나라도 있으면 끝
  const isFinished = latestLogs.some(l => l.result === "finished")

  // 사용 횟수 (finished 로그 제외한 실제 사용 count 합계)
  const useCount = latestLogs
    .filter(l => l.result !== "finished")
    .reduce((s, l) => s + l.count, 0)

  // 구매 개수 (qty = items bought, 개수)
  const qty = latest.qty

  const todayISO = formatDateISO(new Date())

  // 과거 구매 이력 (최신 제외)
  const pastPurchases = purchases.slice(1)
  const pastAvg = useMemo(() => {
    if (pastPurchases.length === 0) return null
    const totals = pastPurchases.map(p => {
      const logs = consumableUseLogs.filter(l => l.purchaseId === p.id && l.result !== "finished")
      return logs.reduce((s, l) => s + l.count, 0)
    })
    const completed = totals.filter(t => t > 0)
    if (!completed.length) return null
    return Math.round(completed.reduce((s, t) => s + t, 0) / completed.length)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pastPurchases.map(p => p.id).join(","), consumableUseLogs.length])

  return (
    <div className="bg-secondary/10 rounded-xl border border-border/10 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold">{latest.purchaseDate} 구매</span>
          {latest.memo && (
            <span className="text-[10px] text-muted-foreground truncate">{latest.memo}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {pastAvg !== null && (
            <span className="text-[10px] text-muted-foreground bg-background/40 px-2 py-0.5 rounded-full">
              이전 평균 {pastAvg}회
            </span>
          )}
          <button
            onClick={() => removeConsumablePurchase(latest.id)}
            className="w-5 h-5 rounded-full hover:bg-red-500/20 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 구매 개수 · 사용 횟수 표시 */}
      <div className="px-3 pt-2.5 pb-1.5">
        {isFinished ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-green-500 dark:text-green-400">✅ 다 사용 완료!</span>
            <span className="text-[10px] text-muted-foreground">구매 {qty}개 · 총 {useCount}회 사용</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="text-center">
                <p className="text-[9px] text-muted-foreground mb-0.5">구매 개수</p>
                <p className="text-base font-bold leading-none">{qty}<span className="text-xs font-normal text-muted-foreground ml-0.5">개</span></p>
              </div>
              <div className="w-px h-8 bg-border/30" />
              <div className="text-center">
                <p className="text-[9px] text-muted-foreground mb-0.5">사용 횟수</p>
                <p className="text-base font-bold leading-none text-primary">{useCount}<span className="text-xs font-normal text-muted-foreground ml-0.5">회</span></p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 사용 버튼 (완료 전에만) */}
      {!isFinished && (
        <div className="px-3 pb-2.5 flex gap-1.5">
          <Button
            size="sm"
            className="flex-1 h-8 rounded-xl text-xs"
            onClick={() => addConsumableUseLog({ purchaseId: latest.id, itemId, dateISO: todayISO, count: 1, result: "used" })}
          >
            ✅ 1회 사용
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 rounded-xl text-xs border-orange-400/40 text-orange-500 hover:bg-orange-500/10"
            onClick={() => addConsumableUseLog({ purchaseId: latest.id, itemId, dateISO: todayISO, count: 0, result: "finished" })}
          >
            🏁 끝
          </Button>
          {latestLogs.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 rounded-xl p-0"
              onClick={() => {
                const last = [...latestLogs].sort((a, b) => b.createdAt - a.createdAt)[0]
                removeConsumableUseLog(last.id)
              }}
            >
              ↩
            </Button>
          )}
        </div>
      )}

      {/* 완료 후 undo 버튼 */}
      {isFinished && latestLogs.length > 0 && (
        <div className="px-3 pb-2.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] rounded-xl text-muted-foreground"
            onClick={() => {
              const last = [...latestLogs].sort((a, b) => b.createdAt - a.createdAt)[0]
              removeConsumableUseLog(last.id)
            }}
          >
            ↩ 되돌리기
          </Button>
        </div>
      )}

      {/* 최근 사용 기록 */}
      {latestLogs.filter(l => l.result !== "finished").length > 0 && (
        <div className="px-3 pb-2 space-y-0.5 max-h-20 overflow-y-auto border-t border-border/10 pt-1.5 scrollbar-hide">
          {[...latestLogs]
            .filter(l => l.result !== "finished")
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 8)
            .map(log => (
              <div key={log.id} className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{log.dateISO}</span>
                <span className="text-[10px] text-muted-foreground">✅ {log.count}회 사용</span>
              </div>
            ))}
        </div>
      )}

      {/* 과거 구매 이력 */}
      {pastPurchases.length > 0 && (
        <div className="px-3 pb-2 border-t border-border/10 pt-1.5">
          <p className="text-[10px] text-muted-foreground mb-1">이전 구매 {pastPurchases.length}건</p>
          <div className="flex gap-1 flex-wrap">
            {pastPurchases.slice(0, 5).map(p => {
              const logs = consumableUseLogs.filter(l => l.purchaseId === p.id && l.result !== "finished")
              const total = logs.reduce((s, l) => s + l.count, 0)
              const done = consumableUseLogs.some(l => l.purchaseId === p.id && l.result === "finished")
              return (
                <span key={p.id} className="text-[9px] bg-secondary/30 px-1.5 py-0.5 rounded-full text-muted-foreground">
                  {p.purchaseDate} {p.qty}개 · {total}회{done ? " ✅" : ""}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 품목 카드 ─────────────────────────────────────────────────────────────
function ItemCard({ item }: { item: ConsumableItem }) {
  const { consumablePurchases, addConsumablePurchase, removeConsumableItem } = usePlannerStore()
  const [expanded, setExpanded] = useState(false)
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [pDate, setPDate] = useState(formatDateISO(new Date()))
  const [pQty, setPQty] = useState("")
  const [pMemo, setPMemo] = useState("")

  const totalPurchases = consumablePurchases.filter(p => p.itemId === item.id).length

  return (
    <div className="bg-secondary/10 rounded-2xl border border-border/10">
      {/* 품목 헤더 */}
      <div className="flex items-center px-3 py-2.5 gap-2">
        <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{item.name}</p>
          <p className="text-[10px] text-muted-foreground">{item.category} · 구매 {totalPurchases}회</p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 text-[11px] px-2 rounded-lg"
            onClick={() => setShowPurchaseForm(v => !v)}>
            <Plus className="w-3 h-3 mr-0.5" />구매
          </Button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary/50 text-muted-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => removeConsumableItem(item.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 구매 폼 */}
      {showPurchaseForm && (
        <div className="px-3 pb-2.5 border-t border-border/10 pt-2 space-y-2">
          <div className="flex gap-1.5">
            <div className="flex-1 space-y-1">
              <p className="text-[10px] text-muted-foreground">구매일</p>
              <input
                type="date"
                value={pDate}
                onChange={e => setPDate(e.target.value)}
                className="w-full text-xs bg-background/60 rounded-lg px-2 py-1.5 border border-border/20 outline-none"
              />
            </div>
            <div className="w-24 space-y-1">
              <p className="text-[10px] text-muted-foreground">구매 개수</p>
              <input
                type="number"
                min="1"
                value={pQty}
                onChange={e => setPQty(e.target.value)}
                placeholder="7"
                className="w-full text-xs bg-background/60 rounded-lg px-2 py-1.5 border border-border/20 outline-none"
              />
            </div>
          </div>
          <input
            value={pMemo}
            onChange={e => setPMemo(e.target.value)}
            placeholder="메모 (선택)"
            className="w-full text-xs bg-background/60 rounded-lg px-2 py-1.5 border border-border/20 outline-none"
          />
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="flex-1 h-8 rounded-xl text-xs"
              onClick={() => setShowPurchaseForm(false)}>취소</Button>
            <Button size="sm" className="flex-1 h-8 rounded-xl text-xs"
              disabled={!pQty || Number(pQty) < 1}
              onClick={() => {
                if (!pQty || Number(pQty) < 1) return
                addConsumablePurchase({ itemId: item.id, qty: Number(pQty), purchaseDate: pDate, memo: pMemo.trim() || undefined })
                setPQty(""); setPMemo(""); setShowPurchaseForm(false); setExpanded(true)
              }}>저장</Button>
          </div>
        </div>
      )}

      {/* 구매 이력 */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/10 pt-2 space-y-2">
          {totalPurchases === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">
              아직 구매 기록이 없어요. + 구매 버튼으로 추가하세요.
            </p>
          ) : (
            <PurchaseCard itemId={item.id} />
          )}
        </div>
      )}
    </div>
  )
}

// ── 전체 소모품 뷰 ────────────────────────────────────────────────────────
export function ConsumableView() {
  const { consumableItems, addConsumableItem } = usePlannerStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newCategory, setNewCategory] = useState("")

  const PRESET_CATEGORIES = ["식품", "음료", "생활용품", "뷰티", "건강", "기타"]

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">📦 소모품 트래커</h3>
          <p className="text-[11px] text-muted-foreground">구매 개수와 사용 횟수를 따로 기록해요</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs"
          onClick={() => setShowAddForm(v => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1" />품목 추가
        </Button>
      </div>

      {/* 품목 추가 폼 */}
      {showAddForm && (
        <div className="bg-secondary/10 rounded-xl border border-border/10 p-3 space-y-2">
          <p className="text-xs font-semibold">새 소모품 품목</p>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="품목명 (예: 원두 200g)"
            className="w-full text-xs bg-background/60 rounded-lg px-3 py-2 border border-border/20 outline-none focus:ring-1 focus:ring-primary/30"
          />
          <div className="flex gap-1 flex-wrap">
            {PRESET_CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setNewCategory(c)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                  newCategory === c
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-secondary/20 border-border/20 text-muted-foreground"
                }`}
              >
                {c}
              </button>
            ))}
            <input
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              placeholder="직접 입력"
              className="text-[11px] bg-background/60 rounded-full px-2.5 py-1 border border-border/20 outline-none w-20"
            />
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="flex-1 h-8 rounded-xl text-xs"
              onClick={() => setShowAddForm(false)}>취소</Button>
            <Button size="sm" className="flex-1 h-8 rounded-xl text-xs"
              disabled={!newName.trim()}
              onClick={() => {
                if (!newName.trim()) return
                addConsumableItem({ name: newName.trim(), category: newCategory.trim() || "기타" })
                setNewName(""); setNewCategory(""); setShowAddForm(false)
              }}>추가</Button>
          </div>
        </div>
      )}

      {/* 품목 목록 */}
      {consumableItems.length === 0 ? (
        <div className="text-center py-10 space-y-2">
          <Package className="w-10 h-10 mx-auto opacity-20" />
          <p className="text-sm text-muted-foreground">소모품을 추가해 보세요</p>
          <p className="text-[11px] text-muted-foreground">구매 개수 기록 → 사용할 때마다 탭 → 끝나면 🏁 끝</p>
        </div>
      ) : (
        <div className="space-y-2">
          {consumableItems.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
