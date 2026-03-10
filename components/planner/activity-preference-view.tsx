"use client"

import React, { useState, useMemo } from "react"
import { Star, MapPin, Clock, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import type { Activity, Place } from "@/lib/types"
import { haptic } from "@/lib/haptic"

// ── 시간대 옵션 ──────────────────────────────────────────────────────────
const TIME_PERIOD_OPTIONS: { value: Activity["preferredTime"]; label: string; emoji: string }[] = [
  { value: "morning",   label: "오전",  emoji: "🌅" },
  { value: "afternoon", label: "오후",  emoji: "☀️" },
  { value: "evening",   label: "저녁",  emoji: "🌆" },
  { value: "night",     label: "밤",    emoji: "🌙" },
]

// ── 선호도 라벨 ──────────────────────────────────────────────────────────
const PREFERENCE_LABELS: { value: 1 | 2 | 3 | 4 | 5; label: string; emoji: string }[] = [
  { value: 1, label: "싫음", emoji: "😑" },
  { value: 2, label: "별로", emoji: "😕" },
  { value: 3, label: "보통", emoji: "😐" },
  { value: 4, label: "좋음", emoji: "😊" },
  { value: 5, label: "최고", emoji: "😍" },
]

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export function ActivityPreferenceView() {
  const {
    activities,
    places,
    updateActivity,
    blocksByDate,
    selectedDate,
  } = usePlannerStore()

  const dateISO = formatDateISO(selectedDate)
  const blocks = blocksByDate[dateISO] || []

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)

  // 시간대별 추천 계산 (최근 7일 기준)
  const recommendations = useMemo(() => {
    const now = new Date(selectedDate)
    const result: Record<string, { placeId?: string; timeSlot?: string; count: number }[]> = {}

    for (let d = 0; d < 7; d++) {
      const date = new Date(now)
      date.setDate(date.getDate() - d)
      const dISO = formatDateISO(date)
      const dayBlocks = blocksByDate[dISO] || []

      for (const block of dayBlocks) {
        if (block.layer !== "execute") continue
        if (!result[block.activityId]) result[block.activityId] = []

        const hourOfDay = Math.floor(block.startMin / 60)
        let timeSlot: string
        if (hourOfDay < 12) timeSlot = "morning"
        else if (hourOfDay < 17) timeSlot = "afternoon"
        else if (hourOfDay < 21) timeSlot = "evening"
        else timeSlot = "night"

        result[block.activityId].push({
          placeId: block.placeId,
          timeSlot,
          count: 1,
        })
      }
    }
    return result
  }, [blocksByDate, selectedDate])

  // 활동별 가장 자주 쓴 장소/시간대
  const getTopPlace = (activityId: string): string | undefined => {
    const recs = recommendations[activityId] || []
    const placeCounts: Record<string, number> = {}
    for (const r of recs) {
      if (r.placeId) {
        placeCounts[r.placeId] = (placeCounts[r.placeId] || 0) + 1
      }
    }
    const sorted = Object.entries(placeCounts).sort((a, b) => b[1] - a[1])
    return sorted[0]?.[0]
  }

  const getTopTimeSlot = (activityId: string): string | undefined => {
    const recs = recommendations[activityId] || []
    const timeCounts: Record<string, number> = {}
    for (const r of recs) {
      if (r.timeSlot) {
        timeCounts[r.timeSlot] = (timeCounts[r.timeSlot] || 0) + 1
      }
    }
    const sorted = Object.entries(timeCounts).sort((a, b) => b[1] - a[1])
    return sorted[0]?.[0]
  }

  // 선호도 수정 핸들러
  const handleSetPreference = (activityId: string, preference: 1 | 2 | 3 | 4 | 5) => {
    updateActivity(activityId, { preference })
    haptic.light()
  }

  const handleSetPreferredTime = (activityId: string, time: Activity["preferredTime"]) => {
    const current = activities.find((a) => a.id === activityId)
    updateActivity(activityId, {
      preferredTime: current?.preferredTime === time ? undefined : time,
    })
    haptic.light()
  }

  const handleTogglePreferredPlace = (activityId: string, placeId: string) => {
    const current = activities.find((a) => a.id === activityId)
    const existing = current?.preferredPlaces || []
    const updated = existing.includes(placeId)
      ? existing.filter((id) => id !== placeId)
      : [...existing, placeId]
    updateActivity(activityId, { preferredPlaces: updated })
    haptic.light()
  }

  // 비시스템 활동 먼저, 시스템 활동 나중에
  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => {
      if (a.isSystem && !b.isSystem) return 1
      if (!a.isSystem && b.isSystem) return -1
      return (a.order ?? 0) - (b.order ?? 0)
    })
  }, [activities])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Star className="w-4 h-4" />
          활동 선호 설정
        </h3>
      </div>

      <div className="space-y-1">
        {sortedActivities.map((activity) => {
          const isExpanded = expandedId === activity.id
          const topPlace = getTopPlace(activity.id)
          const topTime = getTopTimeSlot(activity.id)
          const topPlaceObj = topPlace ? places.find((p) => p.id === topPlace) : null
          const topTimeObj = topTime
            ? TIME_PERIOD_OPTIONS.find((t) => t.value === topTime)
            : null

          return (
            <div
              key={activity.id}
              className="rounded-lg border overflow-hidden"
            >
              {/* 활동 헤더 */}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setExpandedId(isExpanded ? null : activity.id)
                  haptic.light()
                }}
              >
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: activity.color }}
                />
                <span className="flex-1 text-left text-sm font-medium">
                  {activity.name}
                </span>

                {/* 선호도 표시 */}
                {activity.preference && (
                  <span className="text-xs">
                    {PREFERENCE_LABELS.find((l) => l.value === activity.preference)?.emoji}
                  </span>
                )}

                {/* 선호 시간대 표시 */}
                {activity.preferredTime && (
                  <span className="text-xs">
                    {TIME_PERIOD_OPTIONS.find((t) => t.value === activity.preferredTime)?.emoji}
                  </span>
                )}

                {/* 선호 장소 수 */}
                {activity.preferredPlaces && activity.preferredPlaces.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    📍{activity.preferredPlaces.length}
                  </span>
                )}

                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {/* 확장 패널 */}
              {isExpanded && (
                <div className="border-t bg-muted/20 px-3 py-3 space-y-3">
                  {/* 선호도 */}
                  <div>
                    <label className="text-xs font-medium mb-1.5 block flex items-center gap-1">
                      <Star className="w-3 h-3" /> 선호도
                    </label>
                    <div className="flex gap-1">
                      {PREFERENCE_LABELS.map((l) => (
                        <button
                          key={l.value}
                          className={`flex-1 flex flex-col items-center py-1.5 rounded-md text-xs transition-all ${
                            activity.preference === l.value
                              ? "bg-primary/10 ring-1 ring-primary"
                              : "bg-muted hover:bg-muted/70"
                          }`}
                          onClick={() => handleSetPreference(activity.id, l.value)}
                        >
                          <span className="text-base">{l.emoji}</span>
                          <span className="text-[10px]">{l.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 선호 시간대 */}
                  <div>
                    <label className="text-xs font-medium mb-1.5 block flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 선호 시간대
                      {topTimeObj && (
                        <span className="text-[10px] text-muted-foreground font-normal ml-1">
                          (추천: {topTimeObj.emoji} {topTimeObj.label})
                        </span>
                      )}
                    </label>
                    <div className="flex gap-1">
                      {TIME_PERIOD_OPTIONS.map((t) => (
                        <button
                          key={t.value}
                          className={`flex-1 flex flex-col items-center py-1.5 rounded-md text-xs transition-all ${
                            activity.preferredTime === t.value
                              ? "bg-primary/10 ring-1 ring-primary"
                              : "bg-muted hover:bg-muted/70"
                          }`}
                          onClick={() => handleSetPreferredTime(activity.id, t.value)}
                        >
                          <span className="text-base">{t.emoji}</span>
                          <span className="text-[10px]">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 선호 장소 */}
                  <div>
                    <label className="text-xs font-medium mb-1.5 block flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> 선호 장소
                      {topPlaceObj && (
                        <span className="text-[10px] text-muted-foreground font-normal ml-1">
                          (자주: {topPlaceObj.icon} {topPlaceObj.name})
                        </span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {places.map((p) => {
                        const isSelected = activity.preferredPlaces?.includes(p.id)
                        return (
                          <button
                            key={p.id}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
                              isSelected
                                ? "bg-primary/10 ring-1 ring-primary"
                                : "bg-muted hover:bg-muted/70"
                            }`}
                            onClick={() => handleTogglePreferredPlace(activity.id, p.id)}
                          >
                            <span>{p.icon || "📍"}</span>
                            <span>{p.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
