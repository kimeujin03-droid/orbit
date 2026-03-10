"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { Clock, Moon, Sun, Trash2, RotateCcw, Palette, Plus, Pencil, ChevronRight, ChevronDown, Download, Upload, CalendarCheck, X, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePlannerStore } from "@/lib/store"
import type { CompletedTaskRecord } from "@/lib/types"
import { BlockTemplateManager } from "./block-template-manager"
import { ActivityPreferenceView } from "./activity-preference-view"

const startHourOptions = Array.from({ length: 24 }, (_, i) => i)

// HSL → Hex 변환
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * Math.max(0, Math.min(1, color))).toString(16).padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function generateFullColorGrid(): string[][] {
  const hues = [0, 15, 30, 45, 60, 90, 120, 160, 195, 210, 240, 270, 300, 330]
  const lightness = [85, 75, 65, 55, 45, 35]
  const saturation = 70
  return hues.map(h => lightness.map(l => hslToHex(h, saturation, l)))
}

function generateSubPalette(baseColor: string, count: number = 10): string[] {
  const hex = baseColor.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  const palette: string[] = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const newS = 40 + t * 50
    const newL = 80 - t * 45
    palette.push(hslToHex(h, newS, newL))
  }
  return palette
}

function generateGrayscaleRow(): string[] {
  return [95, 85, 75, 65, 50, 35].map(l => hslToHex(0, 0, l))
}

function ColorGridPicker({ selectedColor, onSelectColor, subMode, parentColor }: {
  selectedColor: string
  onSelectColor: (c: string) => void
  subMode?: boolean
  parentColor?: string
}) {
  const grid = useMemo(() => {
    if (subMode && parentColor) {
      return [generateSubPalette(parentColor, 10)]
    }
    return [generateGrayscaleRow(), ...generateFullColorGrid()]
  }, [subMode, parentColor])

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">색상</span>
      <div className="max-h-[160px] overflow-y-auto pr-0.5 scrollbar-hide">
        <div className="flex flex-col gap-0.5">
        {grid.map((row, ri) => (
          <div key={ri} className="flex gap-0.5">
            {row.map((color) => (
              <button
                key={color}
                onClick={() => onSelectColor(color)}
                className={`flex-1 aspect-square rounded-sm transition-all min-w-0 ${
                  selectedColor.toLowerCase() === color.toLowerCase()
                    ? "ring-2 ring-foreground ring-offset-1 ring-offset-background scale-110 z-10"
                    : "hover:scale-105"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        ))}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <div className="w-6 h-6 rounded-md border border-border/30" style={{ backgroundColor: selectedColor }} />
        <span className="text-[10px] text-muted-foreground font-mono">{selectedColor.toUpperCase()}</span>
      </div>
    </div>
  )
}

export function SettingsView() {
  const {
    startHour,
    setStartHour,
    theme,
    setTheme,
    activities,
    addActivity,
    updateActivity,
    removeActivity,
    reorderActivities,
    completedTaskHistory,
    clearCompletedHistory,
    selectedDate,
  } = usePlannerStore()

  const [confirmReset, setConfirmReset] = useState(false)
  const [historyFilterDate, setHistoryFilterDate] = useState("")

  // 편집 다이얼로그
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editActivityId, setEditActivityId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("")
  const [editDepth, setEditDepth] = useState(0)

  // 추가 다이얼로그
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addParentId, setAddParentId] = useState<string | undefined>(undefined)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#93C5FD")

  // 펼쳐진 부모
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rootActivities = useMemo(() => {
    return activities.filter((a) => !a.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [activities])

  const getChildren = (parentId: string) => {
    return activities.filter((a) => a.parentId === parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  // ── 활동 드래그 순서 변경 ──
  const settingsDragId = useRef<string | null>(null)
  const settingsDragStartY = useRef(0)
  const [settingsDragOverId, setSettingsDragOverId] = useState<string | null>(null)
  const [settingsDragActiveId, setSettingsDragActiveId] = useState<string | null>(null)

  const handleSettingsDragStart = useCallback((actId: string, clientY: number) => {
    settingsDragId.current = actId
    settingsDragStartY.current = clientY
    setSettingsDragActiveId(actId)
  }, [])

  const handleSettingsDragMove = useCallback((clientY: number) => {
    if (!settingsDragId.current) return
    if (Math.abs(clientY - settingsDragStartY.current) < 8) return
    const elements = document.querySelectorAll("[data-settings-act-id]")
    let closestId: string | null = null
    let closestDist = Infinity
    elements.forEach(el => {
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      const dist = Math.abs(clientY - mid)
      if (dist < closestDist) {
        closestDist = dist
        closestId = el.getAttribute("data-settings-act-id")
      }
    })
    if (closestId && closestId !== settingsDragId.current) {
      setSettingsDragOverId(closestId)
    }
  }, [])

  const handleSettingsDragEnd = useCallback(() => {
    if (settingsDragId.current && settingsDragOverId) {
      const ids = rootActivities.map(a => a.id)
      const fromIdx = ids.indexOf(settingsDragId.current)
      const toIdx = ids.indexOf(settingsDragOverId)
      if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
        ids.splice(fromIdx, 1)
        ids.splice(toIdx, 0, settingsDragId.current)
        reorderActivities(ids)
      }
    }
    settingsDragId.current = null
    setSettingsDragOverId(null)
    setSettingsDragActiveId(null)
  }, [settingsDragOverId, rootActivities, reorderActivities])

  useEffect(() => {
    const onMove = (e: MouseEvent) => handleSettingsDragMove(e.clientY)
    const onUp = () => handleSettingsDragEnd()
    const onTouchMove = (e: TouchEvent) => { if (e.touches.length === 1) handleSettingsDragMove(e.touches[0].clientY) }
    const onTouchEnd = () => handleSettingsDragEnd()
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onTouchEnd)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
    }
  }, [handleSettingsDragMove, handleSettingsDragEnd])

  const openEditDialog = (actId: string) => {
    const act = activities.find((a) => a.id === actId)
    if (!act) return
    setEditActivityId(actId)
    setEditName(act.name)
    setEditColor(act.color)
    setEditDepth(act.depth ?? 0)
    setEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (editActivityId && editName.trim()) {
      updateActivity(editActivityId, { name: editName.trim(), color: editColor, depth: editDepth })
      setEditDialogOpen(false)
      setEditActivityId(null)
    }
  }

  const handleDeleteActivity = () => {
    if (editActivityId) {
      removeActivity(editActivityId)
      setEditDialogOpen(false)
      setEditActivityId(null)
    }
  }

  const openAddDialog = (parentId?: string) => {
    setAddParentId(parentId)
    setNewName("")
    if (parentId) {
      const parent = activities.find((a) => a.id === parentId)
      if (parent) {
        const subPalette = generateSubPalette(parent.color)
        setNewColor(subPalette[0])
      }
    } else {
      setNewColor("#93C5FD")
    }
    setAddDialogOpen(true)
  }

  const handleAddCategory = () => {
    if (newName.trim()) {
      addActivity(newName.trim(), newColor, addParentId)
      setAddDialogOpen(false)
    }
  }

  const editParentColor = useMemo(() => {
    if (!editActivityId) return undefined
    const act = activities.find((a) => a.id === editActivityId)
    if (act?.parentId) {
      const parent = activities.find((a) => a.id === act.parentId)
      return parent?.color
    }
    return undefined
  }, [editActivityId, activities])

  const addParentColor = useMemo(() => {
    if (!addParentId) return undefined
    const parent = activities.find((a) => a.id === addParentId)
    return parent?.color
  }, [addParentId, activities])

  const handleResetAll = () => {
    if (confirmReset) {
      localStorage.clear()
      window.location.reload()
    } else {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 3000)
    }
  }

  // 완료 기록 — 날짜별 그룹
  const historyGrouped = useMemo(() => {
    const filtered = historyFilterDate
      ? completedTaskHistory.filter((r: CompletedTaskRecord) => r.completedAt === historyFilterDate)
      : completedTaskHistory
    const grouped: Record<string, typeof filtered> = {}
    for (const r of filtered) {
      if (!grouped[r.completedAt]) grouped[r.completedAt] = []
      grouped[r.completedAt].push(r)
    }
    return Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(date => ({
      date,
      records: grouped[date],
    }))
  }, [completedTaskHistory, historyFilterDate])

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-hide">
      <div className="p-4 space-y-5">

        {/* 시작 시간 */}
        <div className="p-3 bg-background/50 rounded-lg border border-border/30 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">하루 시작 시간</span>
          </div>
          <p className="text-xs text-muted-foreground">타임라인이 이 시간부터 시작됩니다</p>
          <select
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="w-full h-9 rounded border border-border bg-background text-sm px-2"
          >
            {startHourOptions.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>

        {/* 테마 */}
        <div className="p-3 bg-background/50 rounded-lg border border-border/30 space-y-2">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">테마</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme("light")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm transition-colors ${
                theme === "light"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Sun className="w-4 h-4" />
              라이트
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm transition-colors ${
                theme === "dark"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Moon className="w-4 h-4" />
              다크
            </button>
          </div>
        </div>

        {/* 활동 관리 */}
        <div className="p-3 bg-background/50 rounded-lg border border-border/30 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">활동 관리</span>
            <div className="flex-1" />
            <button
              onClick={() => openAddDialog()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-3 h-3" />새 활동
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-2">드래그하여 순서를 변경할 수 있습니다</p>
          
          <div className="space-y-1">
            {rootActivities.map((act) => {
              const children = getChildren(act.id)
              const hasChildren = children.length > 0
              const isExpanded = expandedIds.has(act.id)
              const isDragOver = settingsDragOverId === act.id
              const isDragging = settingsDragActiveId === act.id

              return (
                <div
                  key={act.id}
                  data-settings-act-id={act.id}
                  className={`transition-all duration-200 ${
                    isDragOver ? "border-t-2 border-primary/50 bg-primary/5 rounded-lg" : ""
                  } ${isDragging ? "opacity-50 scale-[0.97]" : ""}`}
                >
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    {/* 드래그 핸들 */}
                    <div
                      className="flex items-center justify-center w-5 h-5 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
                      onMouseDown={(e) => handleSettingsDragStart(act.id, e.clientY)}
                      onTouchStart={(e) => { if (e.touches.length === 1) handleSettingsDragStart(act.id, e.touches[0].clientY) }}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40" />
                    </div>
                    <button
                      onClick={() => hasChildren && toggleExpand(act.id)}
                      className="w-4 h-4 flex items-center justify-center flex-shrink-0"
                    >
                      {hasChildren ? (
                        isExpanded
                          ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                          : <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      ) : <div className="w-3" />}
                    </button>
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: act.color }} />
                    <span className="text-sm flex-1 truncate">{act.name}</span>
                    {act.depth !== undefined && act.depth > 0 && (
                      <span className="text-[9px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">{act.depth}단</span>
                    )}
                    <button onClick={() => openAddDialog(act.id)} className="text-muted-foreground hover:text-primary transition-colors p-0.5" title="하위 활동 추가">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEditDialog(act.id)} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeActivity(act.id)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  {hasChildren && isExpanded && (
                    <div className="ml-6 mt-0.5 space-y-0.5">
                      {children.map((child) => (
                        <div key={child.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                          <div className="w-0.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: act.color, opacity: 0.4 }} />
                          <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: child.color }} />
                          <span className="text-xs flex-1 truncate">{child.name}</span>
                          <button onClick={() => openEditDialog(child.id)} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => removeActivity(child.id)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 완료 기록 */}
        <div className="p-3 bg-background/50 rounded-lg border border-border/30 space-y-2">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium">완료 기록</span>
            <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-full ml-1">
              {completedTaskHistory.length}개
            </span>
            <div className="flex-1" />
            {completedTaskHistory.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm("완료 기록을 전부 삭제할까요?")) clearCompletedHistory()
                }}
                className="text-[10px] text-destructive/70 hover:text-destructive transition-colors"
              >
                전체 삭제
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">완료 후 다음 날 자동으로 여기에 기록됩니다</p>

          {/* 날짜 필터 */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={historyFilterDate}
              onChange={e => setHistoryFilterDate(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-border bg-background text-xs px-2"
            />
            {historyFilterDate && (
              <button
                onClick={() => setHistoryFilterDate("")}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary/50 text-muted-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 기록 목록 */}
          {completedTaskHistory.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-2xl mb-1">✅</p>
              <p className="text-xs text-muted-foreground">완료 기록이 없어요</p>
            </div>
          ) : historyGrouped.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-3">해당 날짜 기록 없음</p>
          ) : (
            <div className="max-h-[320px] overflow-y-auto space-y-3 pr-1 scrollbar-hide">
              {historyGrouped.map(({ date, records }) => (
                <div key={date}>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1 sticky top-0 bg-background/90 py-0.5">
                    📅 {date}
                    <span className="ml-1 text-muted-foreground/60">({records.length}개)</span>
                  </p>
                  <div className="space-y-1">
                    {records.map(r => {
                      const act = r.activityId ? activities.find(a => a.id === r.activityId) : null
                      return (
                        <div key={r.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-muted/20">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                            style={{ backgroundColor: act?.color ?? "#94A3B8" }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs line-through text-muted-foreground truncate">{r.title}</p>
                            {r.dueDate && (
                              <p className="text-[10px] text-muted-foreground/60">기한: {r.dueDate}</p>
                            )}
                          </div>
                          {act && (
                            <span className="text-[9px] text-muted-foreground/60 flex-shrink-0">{act.name}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 데이터 백업/복원 */}
        <div className="p-3 bg-background/50 rounded-lg border border-border/30 space-y-2">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">데이터 백업/복원</span>
          </div>
          <p className="text-xs text-muted-foreground">전체 데이터를 JSON 파일로 내보내거나 불러올 수 있습니다</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const data = localStorage.getItem("planner-store")
                if (data) {
                  const blob = new Blob([data], { type: "application/json" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `life-log-backup-${new Date().toISOString().split("T")[0]}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }
              }}
              className="flex-1 text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              백업 내보내기
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const input = document.createElement("input")
                input.type = "file"
                input.accept = ".json"
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    try {
                      const text = ev.target?.result as string
                      JSON.parse(text)
                      localStorage.setItem("planner-store", text)
                      window.location.reload()
                    } catch {
                      alert("유효하지 않은 파일입니다")
                    }
                  }
                  reader.readAsText(file)
                }
                input.click()
              }}
              className="flex-1 text-xs"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              백업 불러오기
            </Button>
          </div>
        </div>

        {/* 초기화 */}
        <div className="p-3 bg-background/50 rounded-lg border border-destructive/30 space-y-2">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">데이터 초기화</span>
          </div>
          <p className="text-xs text-muted-foreground">모든 데이터가 삭제되며 복구할 수 없습니다</p>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleResetAll}
            className="w-full"
          >
            {confirmReset ? "정말 초기화하시겠습니까? (다시 클릭)" : "전체 초기화"}
          </Button>
        </div>

        {/* 앱 정보 */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">Digital Life Log Planner</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">v1.0.0</p>
        </div>
      </div>

      {/* 편집 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[360px] mx-4 rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base">카테고리 편집</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Input
              placeholder="이름"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
              autoFocus
              className="h-9 text-sm rounded-xl"
            />
            <ColorGridPicker
              selectedColor={editColor}
              onSelectColor={setEditColor}
              subMode={!!editParentColor}
              parentColor={editParentColor}
            />
            {(() => {
              const act = editActivityId ? activities.find(a => a.id === editActivityId) : null
              if (act && !act.parentId) {
                return (
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">하위 펼침 단계</span>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3].map((d) => (
                        <button
                          key={d}
                          onClick={() => setEditDepth(d)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                            editDepth === d
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                          }`}
                        >
                          {d === 0 ? "없음" : `${d}단`}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              }
              return null
            })()}
            <div className="flex gap-2 pt-1">
              <Button variant="destructive" onClick={handleDeleteActivity} size="sm" className="rounded-xl">
                삭제
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} size="sm" className="rounded-xl">
                취소
              </Button>
              <Button onClick={handleSaveEdit} disabled={!editName.trim()} size="sm" className="rounded-xl">
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 추가 다이얼로그 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[360px] mx-4 rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base">
              {addParentId
                ? `하위 카테고리 추가 (${activities.find(a => a.id === addParentId)?.name})`
                : "새 카테고리"
              }
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-3">
            <Input
              placeholder="카테고리 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              autoFocus
              className="h-9 text-sm"
            />
            <ColorGridPicker
              selectedColor={newColor}
              onSelectColor={setNewColor}
              subMode={!!addParentColor}
              parentColor={addParentColor}
            />
            <Button onClick={handleAddCategory} disabled={!newName.trim()} size="sm" className="rounded-xl">
              추가하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 활동 선호 설정 */}
      <ActivityPreferenceView />

      {/* 블록 템플릿 관리 */}
      <BlockTemplateManager date={selectedDate} />
    </div>
  )
}
