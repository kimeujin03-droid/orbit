"use client"

import React, { useMemo } from "react"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import type { TransportMode } from "@/lib/types"
import { computePlaceGroups } from "./place-view"

// ── 교통수단 이모지 ────────────────────────────────────────────────────────
const TRANSPORT_EMOJI: Record<TransportMode, string> = {
  walk: "🚶",
  bus: "🚌",
  subway: "🚇",
  taxi: "🚕",
  bike: "🚲",
  car: "🚗",
  other: "🚀",
}

interface PlaceGroupFramesProps {
  hourHeight: number   // 한 시간 높이 (px)
  startHour: number    // 타임라인 시작 시간 (hour)
}

/**
 * 장소 그룹 프레임 — 동일 장소의 연속 블록을 점선 테두리로 감싸는 "틀"
 *
 * 렌더링 규칙:
 * - 상단: 첫 블록의 10분 칸 **상단** (10분 스냅)
 * - 하단: 마지막 블록의 10분 칸 **하단** (10분 스냅 올림) — 그리드 칸을 정확히 둘러쌈
 * - 좌우: 시간 라벨(w-8) 바로 오른쪽 ~ 그리드 오른쪽 끝
 * - 장소가 바뀌면 그 시점에서 점선 끊기고 새 프레임 시작
 * - 이동 시간(예: 20분)이면 해당 그리드 칸(2칸)에 이동 표시
 */
export function PlaceGroupFrames({ hourHeight, startHour }: PlaceGroupFramesProps) {
  const {
    selectedDate,
    blocksByDate,
    places,
    movementsByDate,
  } = usePlannerStore()

  const dateISO = formatDateISO(selectedDate)
  const blocks = blocksByDate[dateISO] || []
  const movements = movementsByDate[dateISO] || []

  const placeGroups = useMemo(
    () => computePlaceGroups(blocks, places),
    [blocks, places]
  )

  if (placeGroups.length === 0) return null

  // 분(min)을 Y px 로 변환 — 10분 스냅 기준으로 그리드 칸에 맞춤
  const slotPx = hourHeight / 6  // 1칸 = 10분 높이
  const minToY = (min: number) => {
    // startHour 기준 상대 분 → 칸 수 → px
    const relativeMin = min - startHour * 60
    return (relativeMin / 10) * slotPx
  }

  // 10분 스냅 내림 (칸 상단)
  const snapFloor = (min: number) => Math.floor(min / 10) * 10
  // 10분 스냅 올림 (칸 하단)
  const snapCeil = (min: number) => Math.ceil(min / 10) * 10

  return (
    <>
      {placeGroups.map((group, idx) => {
        // 프레임: 그리드 칸의 상단~하단을 정확히 둘러쌈
        const top = minToY(snapFloor(group.startMin))
        const bottom = minToY(snapCeil(group.endMin))
        const height = bottom - top

        if (height <= 0) return null

        const nextGroup = placeGroups[idx + 1]

        // 이동 찾기 (이 그룹 → 다음 그룹)
        const movementBetween = nextGroup
          ? movements.find(
              (m) =>
                m.fromPlaceId === group.placeId &&
                m.toPlaceId === nextGroup.placeId
            )
          : null

        // 이동 구간: 현재 프레임 하단 ~ 다음 프레임 상단
        const gapTop = nextGroup ? bottom : 0
        const gapBottom = nextGroup ? minToY(snapFloor(nextGroup.startMin)) : 0
        const gapHeight = gapBottom - gapTop

        return (
          <React.Fragment key={idx}>
            {/* ── 장소 프레임: 점선 테두리 ────────────────────── */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: `${top}px`,
                height: `${height}px`,
                left: "32px",
                right: "8px",
                border: `2px dashed ${group.placeColor || "#94A3B8"}`,
                borderRadius: "6px",
                opacity: 0.7,
                zIndex: 2,
              }}
            >
              {/* 장소 이모지 + 이름 라벨 — 상단 왼쪽 */}
              <div
                className="absolute flex items-center gap-0.5 px-1"
                style={{
                  top: "-10px",
                  left: "4px",
                  fontSize: "9px",
                  lineHeight: 1,
                  backgroundColor: "var(--background, #fff)",
                  borderRadius: "4px",
                  color: group.placeColor || "#64748B",
                  fontWeight: 600,
                  zIndex: 3,
                }}
              >
                <span style={{ fontSize: "11px" }}>{group.placeIcon || "📍"}</span>
                <span>{group.placeName}</span>
              </div>
            </div>

            {/* ── 이동 표시 (두 프레임 사이 갭 — 그리드 칸 안에 그림) ─ */}
            {nextGroup && gapHeight > 0 && (
              <div
                className="absolute pointer-events-none flex items-center justify-center"
                style={{
                  top: `${gapTop}px`,
                  height: `${gapHeight}px`,
                  left: "32px",
                  right: "8px",
                  zIndex: 2,
                }}
              >
                {movementBetween ? (
                  <div
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "var(--background, #fff)",
                      border: "1px dashed #94A3B8",
                      fontSize: "9px",
                      color: "#64748B",
                    }}
                  >
                    <span>{TRANSPORT_EMOJI[movementBetween.transport]}</span>
                    <span>{movementBetween.endMin - movementBetween.startMin}분</span>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "var(--background, #fff)",
                      border: "1px dashed #CBD5E1",
                      fontSize: "9px",
                      color: "#94A3B8",
                    }}
                  >
                    <span>🚶</span>
                    <span>이동</span>
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}
