"use client"

import React, { useState, useMemo, useCallback } from "react"
import {
  MapPin, Plus, X, ChevronDown, ChevronRight,
  Bus, Car, Bike, Footprints, TrainFront, Pencil, Trash2, Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePlannerStore, formatDateISO, minToTime } from "@/lib/store"
import type { Place, Movement, PlaceGroup, TransportMode, Block } from "@/lib/types"
import { haptic } from "@/lib/haptic"

// ── 교통수단 아이콘/라벨 매핑 ─────────────────────────────────────────────
const TRANSPORT_OPTIONS: { mode: TransportMode; icon: React.ReactNode; label: string }[] = [
  { mode: "walk",   icon: <Footprints className="w-4 h-4" />, label: "도보" },
  { mode: "bus",    icon: <Bus className="w-4 h-4" />,        label: "버스" },
  { mode: "subway", icon: <TrainFront className="w-4 h-4" />, label: "지하철" },
  { mode: "taxi",   icon: <Car className="w-4 h-4" />,        label: "택시" },
  { mode: "bike",   icon: <Bike className="w-4 h-4" />,       label: "자전거" },
  { mode: "car",    icon: <Car className="w-4 h-4" />,        label: "자가용" },
]

// ── 이모지 선택지 ──────────────────────────────────────────────────────────
const PLACE_EMOJIS = ["🏠", "🏫", "☕", "📚", "🏋️", "🏢", "🏥", "🛒", "🍽️", "🎵", "⛪", "🏞️", "🚉", "🎮", "💇", "🏖️"]

// ── PlaceGroup 계산 헬퍼 ──────────────────────────────────────────────────
export function computePlaceGroups(blocks: Block[], places: Place[]): PlaceGroup[] {
  // placeId가 있는 execute 블록만 대상 (시간순 정렬)

  const placed = blocks
    .filter((b) => b.placeId && b.layer === "execute")
    .sort((a, b) => a.startMin - b.startMin)

  if (placed.length === 0) return []

  const groups: PlaceGroup[] = []
  let current: PlaceGroup | null = null

  for (const block of placed) {
    if (current && current.placeId === block.placeId) {
      // 같은 장소 — 그룹 확장
      current.endMin = Math.max(current.endMin, block.endMin)
      current.blockIds.push(block.id)
    } else {
      // 새 장소 그룹 시작
      if (current) groups.push(current)
      const place = places.find((p) => p.id === block.placeId)
      current = {
        placeId: block.placeId!,
        placeName: place?.name ?? "?",
        placeIcon: place?.icon,
        placeColor: place?.color,
        startMin: block.startMin,
        endMin: block.endMin,
        blockIds: [block.id],
      }
    }
  }
  if (current) groups.push(current)
  return groups
}

/**
 * 연속된 execute 블록을 한 뭉탱이(chunk)로 묶어 반환.
 * - 시간순 정렬 후, 이전 블록의 endMin >= 다음 블록의 startMin 이면 같은 chunk
 * - 장소 지정 UI에서 10분 단위가 아니라 "하나의 연속 블록" 단위로 장소를 설정
 */
export interface BlockChunk {
  startMin: number
  endMin: number
  blockIds: string[]
  activityId: string    // 대표 activity (첫 블록)
  activityName: string
  activityColor: string
  placeId?: string      // chunk 내 블록들의 공통 placeId (다르면 undefined)
}

export function computeBlockChunks(
  blocks: Block[],
  activities: { id: string; name: string; color?: string }[],
): BlockChunk[] {
  const execBlocks = blocks
    .filter((b) => b.layer === "execute")
    .sort((a, b) => a.startMin - b.startMin)

  if (execBlocks.length === 0) return []

  const chunks: BlockChunk[] = []
  let cur: BlockChunk | null = null

  for (const block of execBlocks) {
    const act = activities.find((a) => a.id === block.activityId)

    if (cur && block.startMin <= cur.endMin) {
      // 연속 — chunk 확장
      cur.endMin = Math.max(cur.endMin, block.endMin)
      cur.blockIds.push(block.id)
      // placeId 공통 체크: 하나라도 다르면 undefined
      if (cur.placeId !== block.placeId) cur.placeId = undefined
    } else {
      // 새 chunk
      if (cur) chunks.push(cur)
      cur = {
        startMin: block.startMin,
        endMin: block.endMin,
        blockIds: [block.id],
        activityId: block.activityId,
        activityName: act?.name || "?",
        activityColor: act?.color || "#CBD5E1",
        placeId: block.placeId,
      }
    }
  }
  if (cur) chunks.push(cur)
  return chunks
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export function PlaceView() {
  const {
    selectedDate,
    places,
    blocksByDate,
    movementsByDate,
    activities,
    addPlace,
    updatePlace,
    removePlace,
    addMovement,
    updateMovement,
    removeMovement,
    setBlockPlace,
    setBlocksPlace,
  } = usePlannerStore()

  const dateISO = formatDateISO(selectedDate)
  const blocks = blocksByDate[dateISO] || []
  const movements = movementsByDate[dateISO] || []
  const executeBlocks = blocks.filter((b) => b.layer === "execute")

  // 연속 블록 뭉탱이 계산
  const blockChunks = useMemo(
    () => computeBlockChunks(blocks, activities),
    [blocks, activities]
  )

  // UI 상태
  const [showPlaceManager, setShowPlaceManager] = useState(false)
  const [showMovementDialog, setShowMovementDialog] = useState(false)
  const [editingPlace, setEditingPlace] = useState<Place | null>(null)
  const [newPlaceName, setNewPlaceName] = useState("")
  const [newPlaceIcon, setNewPlaceIcon] = useState("📍")
  const [newPlaceColor, setNewPlaceColor] = useState("#93C5FD")
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  // 이동 추가 폼
  const [mvFrom, setMvFrom] = useState("")
  const [mvTo, setMvTo] = useState("")
  const [mvTransport, setMvTransport] = useState<TransportMode>("bus")
  const [mvStartTime, setMvStartTime] = useState("09:00")
  const [mvEndTime, setMvEndTime] = useState("09:30")

  // PlaceGroup 계산
  const placeGroups = useMemo(
    () => computePlaceGroups(blocks, places),
    [blocks, places]
  )

  // ── 장소 추가 ────────────────────────────────────────────────────────
  const handleAddPlace = useCallback(() => {
    if (!newPlaceName.trim()) return
    addPlace({
      name: newPlaceName.trim(),
      icon: newPlaceIcon,
      color: newPlaceColor,
      order: places.length,
    })
    setNewPlaceName("")
    setNewPlaceIcon("📍")
    setNewPlaceColor("#93C5FD")
    haptic.light()
  }, [newPlaceName, newPlaceIcon, newPlaceColor, places.length, addPlace])

  // ── 장소 삭제 ────────────────────────────────────────────────────────
  const handleRemovePlace = useCallback((id: string) => {
    if (places.find((p) => p.id === id)?.isSystem) return
    removePlace(id)
    haptic.light()
  }, [places, removePlace])

  // ── 이동 추가 ────────────────────────────────────────────────────────
  const handleAddMovement = useCallback(() => {
    if (!mvFrom || !mvTo) return
    const [sh, sm] = mvStartTime.split(":").map(Number)
    const [eh, em] = mvEndTime.split(":").map(Number)
    addMovement({
      dateISO,
      fromPlaceId: mvFrom,
      toPlaceId: mvTo,
      transport: mvTransport,
      startMin: sh * 60 + sm,
      endMin: eh * 60 + em,
    })
    setShowMovementDialog(false)
    haptic.light()
  }, [mvFrom, mvTo, mvTransport, mvStartTime, mvEndTime, dateISO, addMovement])

  // 장소 색상 옵션
  const PLACE_COLORS = [
    "#93C5FD", "#A5F3FC", "#C4B5FD", "#86EFAC",
    "#FDE68A", "#FDBA74", "#F9A8D4", "#A5B4FC",
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── 헤더 ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          <h2 className="font-semibold text-base">장소 · 이동</h2>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPlaceManager(true)}
            className="text-xs"
          >
            장소 관리
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMovementDialog(true)}
            className="text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            이동 추가
          </Button>
        </div>
      </div>

      {/* ── 장소 그룹 타임라인 ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {placeGroups.length === 0 && movements.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>블록에 장소를 지정하면</p>
            <p>하루의 동선이 보여요</p>
          </div>
        ) : (
          <>
            {/* 장소 그룹 + 이동 인터리브 */}
            {placeGroups.map((group, idx) => {
              const isExpanded = expandedGroup === group.placeId + idx
              // 이 그룹과 다음 그룹 사이의 이동 찾기
              const nextGroup = placeGroups[idx + 1]
              const movementBetween = nextGroup
                ? movements.find(
                    (m) =>
                      m.fromPlaceId === group.placeId &&
                      m.toPlaceId === nextGroup.placeId &&
                      m.startMin >= group.endMin - 10 &&
                      m.endMin <= nextGroup.startMin + 10
                  )
                : null

              return (
                <React.Fragment key={group.placeId + idx}>
                  {/* 장소 그룹 카드 */}
                  <div
                    className="rounded-xl border overflow-hidden transition-all"
                    style={{ borderLeftWidth: 4, borderLeftColor: group.placeColor || "#CBD5E1" }}
                  >
                    <button
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setExpandedGroup(isExpanded ? null : group.placeId + idx)
                        haptic.light()
                      }}
                    >
                      <span className="text-lg">{group.placeIcon || "📍"}</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm">{group.placeName}</div>
                        <div className="text-xs text-muted-foreground">
                          {minToTime(group.startMin)} – {minToTime(group.endMin)}
                          <span className="ml-2">
                            ({Math.round((group.endMin - group.startMin) / 60 * 10) / 10}시간)
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {group.blockIds.length}개 블록
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>

                    {/* 확장 시 — 블록 리스트 */}
                    {isExpanded && (
                      <div className="border-t bg-muted/20 px-3 py-2 space-y-1">
                        {group.blockIds.map((bid) => {
                          const block = blocks.find((b) => b.id === bid)
                          if (!block) return null
                          const act = activities.find((a) => a.id === block.activityId)
                          return (
                            <div
                              key={bid}
                              className="flex items-center gap-2 text-xs py-1"
                            >
                              <div
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: act?.color || "#CBD5E1" }}
                              />
                              <span className="font-medium">{act?.name || "?"}</span>
                              <span className="text-muted-foreground">
                                {minToTime(block.startMin)} – {minToTime(block.endMin)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* 이동 표시 (장소 그룹 사이) */}
                  {nextGroup && (
                    <div className="flex items-center gap-2 px-6 py-1">
                      <div className="flex-1 border-t border-dashed" />
                      {movementBetween ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-2.5 py-1">
                          {TRANSPORT_OPTIONS.find((t) => t.mode === movementBetween.transport)?.icon}
                          <span>
                            {minToTime(movementBetween.startMin)} → {minToTime(movementBetween.endMin)}
                          </span>
                          <span className="text-[10px]">
                            ({movementBetween.endMin - movementBetween.startMin}분)
                          </span>
                          <button
                            className="ml-1 hover:text-destructive"
                            onClick={() => removeMovement(movementBetween.id, dateISO)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          onClick={() => {
                            setMvFrom(group.placeId)
                            setMvTo(nextGroup.placeId)
                            setMvStartTime(minToTime(group.endMin))
                            setMvEndTime(minToTime(nextGroup.startMin))
                            setShowMovementDialog(true)
                          }}
                        >
                          <Plus className="w-3 h-3" />
                          이동 추가
                        </button>
                      )}
                      <div className="flex-1 border-t border-dashed" />
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </>
        )}

        {/* ── 연속 블록 뭉탱이별 장소 지정 ─────────────────────── */}
        <div className="mt-4 pt-4 border-t">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            블록 장소 지정
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            연속된 실행 블록을 터치하여 장소를 지정하세요
          </p>
          <div className="space-y-1">
            {blockChunks.map((chunk, idx) => {
              const place = chunk.placeId
                ? places.find((p) => p.id === chunk.placeId)
                : null
              return (
                <ChunkPlaceRow
                  key={idx}
                  chunk={chunk}
                  placeName={place?.name}
                  placeIcon={place?.icon}
                  places={places}
                  dateISO={dateISO}
                  onSetPlace={(blockIds, dateISO, placeId) => {
                    setBlocksPlace(blockIds, dateISO, placeId)
                    haptic.light()
                  }}
                />
              )
            })}
            {blockChunks.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                오늘 실행된 블록이 없습니다
              </p>
            )}
          </div>
        </div>

        {/* ── 하루 동선 요약 ──────────────────────────────────────── */}
        {placeGroups.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-semibold mb-2">🗺️ 하루 동선</h3>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {placeGroups.map((g, i) => (
                <React.Fragment key={i}>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: (g.placeColor || "#CBD5E1") + "20",
                      color: g.placeColor || "#64748B",
                    }}
                  >
                    {g.placeIcon || "📍"} {g.placeName}
                  </span>
                  {i < placeGroups.length - 1 && (
                    <span className="text-muted-foreground">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 장소 관리 다이얼로그 ──────────────────────────────────── */}
      <Dialog open={showPlaceManager} onOpenChange={setShowPlaceManager}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>장소 관리</DialogTitle>
          </DialogHeader>

          {/* 새 장소 추가 */}
          <div className="space-y-3 pb-3 border-b">
            <div className="flex gap-2">
              {/* 이모지 선택 */}
              <div className="flex flex-wrap gap-1 max-w-[200px]">
                {PLACE_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    className={`w-8 h-8 rounded-md text-lg hover:bg-muted/70 transition-colors ${
                      newPlaceIcon === emoji ? "ring-2 ring-primary bg-muted" : ""
                    }`}
                    onClick={() => setNewPlaceIcon(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                value={newPlaceName}
                onChange={(e) => setNewPlaceName(e.target.value)}
                placeholder="장소 이름"
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleAddPlace()}
              />
              <Button size="sm" onClick={handleAddPlace} disabled={!newPlaceName.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-1.5">
              {PLACE_COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    newPlaceColor === c ? "ring-2 ring-offset-1 ring-primary scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewPlaceColor(c)}
                />
              ))}
            </div>
          </div>

          {/* 장소 리스트 */}
          <div className="space-y-1 mt-2">
            {places
              .slice()
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((place) => (
                <PlaceListItem
                  key={place.id}
                  place={place}
                  onUpdate={updatePlace}
                  onRemove={handleRemovePlace}
                />
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 이동 추가 다이얼로그 ──────────────────────────────────── */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>이동 추가</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 출발지 */}
            <div>
              <label className="text-xs font-medium mb-1 block">출발 장소</label>
              <div className="flex flex-wrap gap-1.5">
                {places.map((p) => (
                  <button
                    key={p.id}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs transition-all ${
                      mvFrom === p.id
                        ? "ring-2 ring-primary bg-primary/10"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                    onClick={() => setMvFrom(p.id)}
                  >
                    <span>{p.icon || "📍"}</span>
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 도착지 */}
            <div>
              <label className="text-xs font-medium mb-1 block">도착 장소</label>
              <div className="flex flex-wrap gap-1.5">
                {places.map((p) => (
                  <button
                    key={p.id}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs transition-all ${
                      mvTo === p.id
                        ? "ring-2 ring-primary bg-primary/10"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                    onClick={() => setMvTo(p.id)}
                  >
                    <span>{p.icon || "📍"}</span>
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 교통수단 */}
            <div>
              <label className="text-xs font-medium mb-1 block">교통수단</label>
              <div className="flex flex-wrap gap-1.5">
                {TRANSPORT_OPTIONS.map((t) => (
                  <button
                    key={t.mode}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                      mvTransport === t.mode
                        ? "ring-2 ring-primary bg-primary/10"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                    onClick={() => setMvTransport(t.mode)}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 시간 */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium mb-1 block">출발 시각</label>
                <Input
                  type="time"
                  value={mvStartTime}
                  onChange={(e) => setMvStartTime(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium mb-1 block">도착 시각</label>
                <Input
                  type="time"
                  value={mvEndTime}
                  onChange={(e) => setMvEndTime(e.target.value)}
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleAddMovement}
              disabled={!mvFrom || !mvTo || mvFrom === mvTo}
            >
              이동 추가
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── 연속 블록 뭉탱이 장소 지정 행 ────────────────────────────────────────
function ChunkPlaceRow({
  chunk,
  placeName,
  placeIcon,
  places,
  dateISO,
  onSetPlace,
}: {
  chunk: BlockChunk
  placeName?: string
  placeIcon?: string
  places: Place[]
  dateISO: string
  onSetPlace: (blockIds: string[], dateISO: string, placeId: string | undefined) => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const durationMin = chunk.endMin - chunk.startMin

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div
        className="w-3 h-3 rounded-sm flex-shrink-0"
        style={{ backgroundColor: chunk.activityColor }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">
          {chunk.activityName}
          {chunk.blockIds.length > 1 && (
            <span className="text-[10px] text-muted-foreground ml-1">
              ({chunk.blockIds.length}블록)
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {minToTime(chunk.startMin)} – {minToTime(chunk.endMin)}
          <span className="ml-1">({Math.floor(durationMin / 60)}시간{durationMin % 60 > 0 ? ` ${durationMin % 60}분` : ""})</span>
        </div>
      </div>

      {/* 장소 표시/선택 */}
      <div className="relative">
        <button
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
            placeName
              ? "bg-muted"
              : "border border-dashed border-muted-foreground/40 text-muted-foreground"
          }`}
          onClick={() => setShowPicker(!showPicker)}
        >
          {placeName ? (
            <>
              <span>{placeIcon || "📍"}</span>
              <span>{placeName}</span>
            </>
          ) : (
            <>
              <MapPin className="w-3 h-3" />
              <span>장소</span>
            </>
          )}
        </button>

        {showPicker && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-background border rounded-lg shadow-lg py-1 min-w-[140px]">
            {places
              .slice()
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((p) => (
                <button
                  key={p.id}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors ${
                    chunk.placeId === p.id ? "bg-muted font-medium" : ""
                  }`}
                  onClick={() => {
                    onSetPlace(chunk.blockIds, dateISO, p.id)
                    setShowPicker(false)
                  }}
                >
                  <span>{p.icon || "📍"}</span>
                  <span>{p.name}</span>
                  {chunk.placeId === p.id && <Check className="w-3 h-3 ml-auto" />}
                </button>
              ))}
            {chunk.placeId && (
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-muted"
                onClick={() => {
                  onSetPlace(chunk.blockIds, dateISO, undefined)
                  setShowPicker(false)
                }}
              >
                <X className="w-3 h-3" />
                장소 해제
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 장소 리스트 아이템 ────────────────────────────────────────────────────
function PlaceListItem({
  place,
  onUpdate,
  onRemove,
}: {
  place: Place
  onUpdate: (id: string, updates: Partial<Place>) => void
  onRemove: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(place.name)

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50">
      <span className="text-lg">{place.icon || "📍"}</span>
      {editing ? (
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="flex-1 h-7 text-sm"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onUpdate(place.id, { name: editName })
              setEditing(false)
            }
            if (e.key === "Escape") setEditing(false)
          }}
          onBlur={() => {
            onUpdate(place.id, { name: editName })
            setEditing(false)
          }}
        />
      ) : (
        <span className="flex-1 text-sm">{place.name}</span>
      )}
      <div
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: place.color || "#CBD5E1" }}
      />
      {!place.isSystem && (
        <div className="flex gap-0.5">
          <button
            className="p-1 hover:bg-muted rounded"
            onClick={() => setEditing(true)}
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            className="p-1 hover:bg-destructive/10 hover:text-destructive rounded"
            onClick={() => onRemove(place.id)}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}
