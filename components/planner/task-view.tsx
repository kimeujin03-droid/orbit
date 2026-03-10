"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Plus,
  Check,
  Trash2,
  CalendarDays,
  ChevronRight,
  Archive,
  X,
} from "lucide-react"
import { usePlannerStore } from "@/lib/store"
import type { PlannerTask, TaskStatus } from "@/lib/types"
import { haptic } from "@/lib/haptic"
import { RoutineView } from "./routine-view"

type TaskTab = "deadline" | "routine"
type Urgency = "overdue" | "hours" | "today" | "tomorrow" | "two_days" | null

const ACT_PREFIX_RE = /^__act:(.+?)__/

function getActId(task: PlannerTask) {
  return task.note?.match(ACT_PREFIX_RE)?.[1] ?? "__none__"
}

function getPlainNote(task: PlannerTask) {
  return task.note?.replace(ACT_PREFIX_RE, "").trim() || ""
}

function parseDueDate(dueDate: string): Date {
  if (dueDate.includes("T")) return new Date(dueDate)
  return new Date(`${dueDate}T23:59:59`)
}

function getUrgency(dueDate: string, now: Date): Urgency {
  const diffMs = parseDueDate(dueDate).getTime() - now.getTime()

  if (diffMs < 0) return "overdue"

  const diffH = diffMs / 3_600_000
  if (diffH <= 12) return "hours"
  if (diffH < 24) return "today"
  if (diffH < 48) return "tomorrow"
  if (diffH < 72) return "two_days"

  return null
}

function formatDueDate(dueDate?: string) {
  if (!dueDate) return ""

  if (dueDate.includes("T")) {
    const [datePart, timePart] = dueDate.split("T")
    const [, m, d] = datePart.split("-")
    return `${m}/${d} ${timePart}`
  }

  const [, m, d] = dueDate.split("-")
  return `${m}/${d}`
}

function formatUrgencyLabel(dueDate: string, now: Date) {
  const diffMs = parseDueDate(dueDate).getTime() - now.getTime()

  if (diffMs < 0) return "기한 지남"

  const diffH = Math.ceil(diffMs / 3_600_000)
  if (diffH <= 12) return `${diffH}시간 남음`

  const diffD = Math.ceil(diffMs / 86_400_000)
  if (diffD <= 1) return "오늘"
  if (diffD === 2) return "내일"
  return `${diffD - 1}일 후`
}

function urgencyDotClass(u: Urgency) {
  switch (u) {
    case "overdue":
    case "hours":
    case "today":
      return "bg-red-400"
    case "tomorrow":
      return "bg-orange-400"
    case "two_days":
      return "bg-yellow-400"
    default:
      return "bg-muted-foreground/20"
  }
}

function urgencyBadgeClass(u: Urgency) {
  switch (u) {
    case "overdue":
    case "hours":
    case "today":
      return "bg-red-500/10 text-red-400 border-red-500/20"
    case "tomorrow":
      return "bg-orange-500/10 text-orange-400 border-orange-500/20"
    case "two_days":
      return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20"
    default:
      return "bg-secondary/50 text-muted-foreground border-border/20"
  }
}

function sortTasks(tasks: PlannerTask[], now: Date) {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === "done" ? 1 : -1

    if (a.dueDate && b.dueDate) {
      return parseDueDate(a.dueDate).getTime() - parseDueDate(b.dueDate).getTime()
    }

    if (a.dueDate) return -1
    if (b.dueDate) return 1

    return a.title.localeCompare(b.title, "ko")
  })
}

function SummaryPill({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "red" | "orange" | "green"
}) {
  const toneClass =
    tone === "red"
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : tone === "orange"
        ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
        : tone === "green"
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-secondary/50 text-foreground border-border/20"

  return (
    <div
      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium backdrop-blur-sm ${toneClass}`}
    >
      {label}
      <span className="ml-1.5 font-bold">{value}</span>
    </div>
  )
}

function SectionHeader({
  title,
  color,
  count,
  doneCount,
  open,
  onToggle,
  onAddClick,
}: {
  title: string
  color: string
  count: number
  doneCount: number
  open: boolean
  onToggle: () => void
  onAddClick: () => void
}) {
  return (
    <div className="px-4 pt-3">
      <div className="rounded-3xl border border-border/15 bg-background/70 shadow-[0_4px_18px_rgba(0,0,0,0.04)] backdrop-blur-sm">
        <div className="flex items-center gap-2 px-3 py-3">
          <button
            onClick={onToggle}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <div
              className="h-9 w-1.5 rounded-full shadow-sm"
              style={{ backgroundColor: color }}
            />
            <ChevronRight
              className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${
                open ? "rotate-90" : ""
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground">
                {title}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                남은 {count} · 완료 {doneCount}
              </div>
            </div>
          </button>

          <button
            onClick={onAddClick}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border/15 bg-secondary/35 text-muted-foreground transition hover:scale-[1.03] hover:bg-secondary/60 hover:text-foreground active:scale-95"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskItem({
  task,
  now,
  color,
  onStatusChange,
  onRemove,
}: {
  task: PlannerTask
  now: Date
  color: string
  onStatusChange: (id: string, status: TaskStatus) => void
  onRemove: (id: string) => void
}) {
  const isDone = task.status === "done"
  const urgency = !isDone && task.dueDate ? getUrgency(task.dueDate, now) : null
  const note = getPlainNote(task)

  return (
    <div className="px-4">
      <div className="rounded-3xl border border-border/15 bg-background/75 px-3.5 py-3.5 shadow-[0_6px_24px_rgba(0,0,0,0.04)] backdrop-blur-sm transition hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
        <div className="flex items-start gap-3">
          <button
            onClick={() => {
              onStatusChange(task.id, isDone ? "todo" : "done")
              haptic.light()
            }}
            className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border transition ${
              isDone
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                : "border-border/25 bg-secondary/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            <Check className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <div
              className={`truncate text-[14px] leading-5 tracking-[-0.01em] ${
                isDone ? "text-muted-foreground line-through" : "text-foreground"
              }`}
            >
              {task.title}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {task.dueDate ? (
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] ${urgencyBadgeClass(
                    urgency,
                  )}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${urgencyDotClass(urgency)}`} />
                  <CalendarDays className="h-3 w-3" />
                  <span>{formatDueDate(task.dueDate)}</span>
                  {!isDone && <span>· {formatUrgencyLabel(task.dueDate, now)}</span>}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border/20 bg-secondary/35 px-2.5 py-1 text-[10px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                  마감 없음
                </div>
              )}
            </div>

            {note && (
              <p className="mt-2.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                {note}
              </p>
            )}
          </div>

          <button
            onClick={() => {
              onRemove(task.id)
              haptic.light()
            }}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

type SheetSection = { id: string; title: string; color: string }
type SheetTree = {
  id: string; title: string; color: string
  children: SheetSection[]
}

function AddTaskSheet({
  open,
  onClose,
  tree,
  defaultSectionId,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  tree: SheetTree[]
  defaultSectionId: string
  onSubmit: (sectionId: string, title: string, dueDate: string, memo: string) => void
}) {
  const [expandedParent, setExpandedParent] = useState<string | null>(null)
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [memo, setMemo] = useState("")
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setExpandedParent(null)
      setSectionId(defaultSectionId !== "__none__" ? defaultSectionId : null)
      setTitle("")
      setDueDate("")
      setMemo("")
      // 만약 defaultSectionId가 자식이면 부모도 열기
      if (defaultSectionId && defaultSectionId !== "__none__") {
        for (const parent of tree) {
          if (parent.id === defaultSectionId) {
            if (parent.children.length === 0) {
              setExpandedParent(parent.id)
              setSectionId(parent.id)
            } else {
              setExpandedParent(parent.id)
              setSectionId(null)
            }
            break
          }
          const child = parent.children.find(c => c.id === defaultSectionId)
          if (child) {
            setExpandedParent(parent.id)
            setSectionId(child.id)
            break
          }
        }
      }
    }
  }, [open, defaultSectionId, tree])

  useEffect(() => {
    if (sectionId && open) {
      setTimeout(() => titleRef.current?.focus(), 150)
    }
  }, [sectionId, open])

  if (!open) return null

  const findColor = (id: string | null) => {
    if (!id) return "#8B5CF6"
    for (const p of tree) {
      if (p.id === id) return p.color
      const c = p.children.find(ch => ch.id === id)
      if (c) return c.color
    }
    return "#8B5CF6"
  }
  const currentColor = findColor(sectionId)

  const handleSubmit = () => {
    const trimmed = title.trim()
    if (!trimmed || !sectionId) return
    onSubmit(sectionId, trimmed, dueDate, memo.trim())
  }

  const handleParentClick = (parent: SheetTree) => {
    if (parent.children.length === 0) {
      // 자식 없는 부모 → 바로 선택 + 폼 열기
      if (sectionId === parent.id) {
        setSectionId(null)
        setExpandedParent(null)
      } else {
        setExpandedParent(parent.id)
        setSectionId(parent.id)
      }
    } else {
      // 자식 있는 부모 → 토글 열기/닫기
      if (expandedParent === parent.id) {
        setExpandedParent(null)
        setSectionId(null)
      } else {
        setExpandedParent(parent.id)
        setSectionId(null)
      }
    }
  }

  const handleChildClick = (childId: string) => {
    setSectionId(sectionId === childId ? null : childId)
  }

  // 입력 폼 JSX
  const renderForm = () => (
    <div className="mt-2 ml-2 mr-1 space-y-2.5 pb-1">
      <div
        className="rounded-2xl border border-border/15 bg-background/70 p-3"
        style={{ boxShadow: `inset 3px 0 0 ${currentColor}` }}
      >
        <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">제목</label>
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
          placeholder="예: 일본어 단어 복습"
          className="h-10 w-full rounded-xl border border-border/15 bg-secondary/20 px-3 text-sm outline-none placeholder:text-muted-foreground/45 focus:border-primary/30"
        />
      </div>
      <div className="rounded-2xl border border-border/15 bg-background/70 p-3">
        <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">마감일 · 시간</label>
        <input
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-10 w-full rounded-xl border border-border/15 bg-secondary/20 px-3 text-sm outline-none text-foreground focus:border-primary/30"
        />
      </div>
      <div className="rounded-2xl border border-border/15 bg-background/70 p-3">
        <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">메모 (선택)</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          placeholder="간단한 메모..."
          className="w-full resize-none rounded-xl border border-border/15 bg-secondary/20 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/45 focus:border-primary/30"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onClose}
          className="h-11 flex-1 rounded-2xl border border-border/15 bg-secondary/25 text-sm text-muted-foreground transition hover:text-foreground"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="h-11 flex-1 rounded-2xl text-sm font-semibold text-white shadow-sm transition disabled:opacity-40"
          style={{ backgroundColor: currentColor }}
        >
          추가하기
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50">
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
      />

      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto scrollbar-hide rounded-t-[28px] border border-border/15 bg-background/95 px-5 pb-6 pt-4 shadow-[0_-12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/20" />

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">
              새 할 일
            </h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {sectionId ? "제목과 마감일을 입력하세요" : "카테고리를 선택하세요"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/15 bg-secondary/35 text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── 카테고리 트리 (부모 → 자식 아코디언) ── */}
        <div className="space-y-1.5 mb-3">
          {tree.map((parent) => {
            const isExpanded = expandedParent === parent.id
            const hasChildren = parent.children.length > 0
            const isDirectSelected = sectionId === parent.id && !hasChildren

            return (
              <div key={parent.id}>
                {/* 부모 행 */}
                <button
                  onClick={() => handleParentClick(parent)}
                  className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                    isDirectSelected
                      ? "border-transparent text-white shadow-sm"
                      : isExpanded
                        ? "border-border/25 bg-secondary/40 text-foreground"
                        : "border-border/15 bg-secondary/20 text-foreground hover:bg-secondary/35"
                  }`}
                  style={isDirectSelected ? { backgroundColor: parent.color } : undefined}
                >
                  <span
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isDirectSelected ? "white" : parent.color }}
                  />
                  <span className="flex-1 text-[13px] font-medium truncate">{parent.title}</span>
                  {hasChildren && (
                    <span className="text-[10px] text-muted-foreground mr-1">{parent.children.length}</span>
                  )}
                  <ChevronRight
                    className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${
                      isExpanded || isDirectSelected ? "rotate-90" : ""
                    } ${isDirectSelected ? "text-white/70" : "text-muted-foreground"}`}
                  />
                </button>

                {/* 자식 없는 부모가 선택됐을 때 → 바로 폼 */}
                {isDirectSelected && renderForm()}

                {/* 자식 있는 부모가 열렸을 때 → 자식 목록 */}
                {isExpanded && hasChildren && (
                  <div className="mt-1 ml-4 space-y-1">
                    {parent.children.map((child) => {
                      const isChildSelected = sectionId === child.id
                      return (
                        <div key={child.id}>
                          <button
                            onClick={() => handleChildClick(child.id)}
                            className={`w-full flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                              isChildSelected
                                ? "border-transparent text-white shadow-sm"
                                : "border-border/10 bg-background/60 text-foreground hover:bg-secondary/30"
                            }`}
                            style={isChildSelected ? { backgroundColor: child.color } : undefined}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: isChildSelected ? "white" : child.color }}
                            />
                            <span className="flex-1 text-[12px] font-medium truncate">{child.title}</span>
                            {isChildSelected && (
                              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-white/70 flex-shrink-0" />
                            )}
                          </button>

                          {/* 자식 선택됐을 때 → 폼 */}
                          {isChildSelected && renderForm()}
                        </div>
                      )
                    })}

                    {/* 부모 자체에 할일 추가 옵션 */}
                    <button
                      onClick={() => {
                        setSectionId(sectionId === parent.id ? null : parent.id)
                      }}
                      className={`w-full flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left transition-all ${
                        sectionId === parent.id
                          ? "border-transparent text-white shadow-sm"
                          : "border-dashed border-border/20 text-muted-foreground hover:text-foreground hover:bg-secondary/20"
                      }`}
                      style={sectionId === parent.id ? { backgroundColor: parent.color } : undefined}
                    >
                      <Plus className="h-3 w-3 flex-shrink-0" />
                      <span className="text-[11px]">{parent.title} 직접 추가</span>
                    </button>
                    {sectionId === parent.id && renderForm()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function TaskView() {
  const {
    tasks,
    addTask,
    removeTask,
    setTaskStatus,
    cleanupDoneTasks,
    activities,
  } = usePlannerStore()

  const [tab, setTab] = useState<TaskTab>("deadline")
  const [now, setNow] = useState(new Date())
  const [showCompleted, setShowCompleted] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetSectionId, setSheetSectionId] = useState("__none__")

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const activityMap = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; color: string; parentId?: string | null; order?: number }
    >()
    activities.forEach((a: any) => {
      map.set(a.id, a)
    })
    return map
  }, [activities])

  const sections = useMemo(() => {
    const base = activities
      .map((a: any) => {
        const parent = a.parentId ? activityMap.get(a.parentId) : null
        const label = parent ? `${parent.name} / ${a.name}` : a.name

        return {
          id: a.id,
          title: label,
          color: a.color || "#8B5CF6",
          order: a.order ?? 0,
        }
      })
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ko"))

    return [
      ...base,
      {
        id: "__none__",
        title: "미분류",
        color: "#6B7280",
        order: 999999,
      },
    ]
  }, [activities, activityMap])

  /* ── tree for AddTaskSheet ── */
  const sectionTree = useMemo((): SheetTree[] => {
    const roots = activities
      .filter((a: any) => !a.parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "ko"))

    const tree: SheetTree[] = roots.map((r: any) => {
      const kids = activities
        .filter((a: any) => a.parentId === r.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "ko"))
        .map((c: any) => ({ id: c.id, title: c.name, color: c.color || "#8B5CF6" }))

      return {
        id: r.id,
        title: r.name,
        color: r.color || "#8B5CF6",
        children: kids,
      }
    })

    tree.push({ id: "__none__", title: "미분류", color: "#6B7280", children: [] })
    return tree
  }, [activities])

  const grouped = useMemo(() => {
    const map = new Map<string, PlannerTask[]>()

    for (const section of sections) {
      map.set(section.id, [])
    }

    for (const task of tasks) {
      const actId = getActId(task)
      if (!map.has(actId)) {
        map.set(actId, [])
      }
      map.get(actId)!.push(task)
    }

    for (const [key, value] of map) {
      map.set(key, sortTasks(value, now))
    }

    return map
  }, [tasks, sections, now])

  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((t) => t.status === "done").length
    const remaining = total - done

    const urgent = tasks.filter((t) => {
      if (t.status === "done" || !t.dueDate) return false
      const u = getUrgency(t.dueDate, now)
      return u === "overdue" || u === "hours" || u === "today"
    }).length

    const soon = tasks.filter((t) => {
      if (t.status === "done" || !t.dueDate) return false
      const u = getUrgency(t.dueDate, now)
      return u === "tomorrow" || u === "two_days"
    }).length

    return { total, done, remaining, urgent, soon }
  }, [tasks, now])

  const visibleSections = useMemo(() => {
    return sections.filter((section) => {
      const list = grouped.get(section.id) ?? []
      if (showCompleted) return list.length > 0
      return list.some((t) => t.status !== "done")
    })
  }, [sections, grouped, showCompleted])

  const openAddSheet = (sectionId: string) => {
    setSheetSectionId(sectionId)
    setSheetOpen(true)
    haptic.light()
  }

  const handleAddTask = (
    actId: string,
    title: string,
    dueDate: string,
    memo: string,
  ) => {
    const prefix = actId !== "__none__" ? `__act:${actId}__` : ""
    const note = `${prefix}${memo}`.trim() || undefined

    addTask({
      title,
      status: "todo",
      dueDate: dueDate || undefined,
      note,
    })

    setOpenSections((prev) => ({
      ...prev,
      [actId]: true,
    }))
    setSheetOpen(false)
    haptic.success()
  }

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? true),
    }))
  }

  if (tab === "routine") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="border-b border-border/10 px-4 pb-3 pt-4">
          <div className="inline-flex rounded-2xl bg-secondary/35 p-1">
            <button
              onClick={() => setTab("deadline")}
              className="rounded-xl px-4 py-2 text-sm text-muted-foreground transition"
            >
              Tasks
            </button>
            <button className="rounded-xl bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm">
              Routine
            </button>
          </div>
        </div>
        <RoutineView />
      </div>
    )
  }

  return (
    <>
      <div className="relative flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top,rgba(120,119,198,0.06),transparent_35%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent)]">
        <div className="border-b border-border/10 px-4 pb-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-[20px] font-semibold tracking-[-0.03em] text-foreground">
                Tasks
              </h1>
              <p className="mt-1 text-[12px] text-muted-foreground">
                해야 할 일만 또렷하게 보이게 정리한 화면
              </p>
            </div>

            <div className="inline-flex rounded-2xl bg-secondary/35 p-1">
              <button className="rounded-xl bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm">
                Tasks
              </button>
              <button
                onClick={() => setTab("routine")}
                className="rounded-xl px-4 py-2 text-sm text-muted-foreground transition"
              >
                Routine
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <SummaryPill label="남은 일" value={stats.remaining} />
            <SummaryPill label="긴급" value={stats.urgent} tone="red" />
            <SummaryPill label="예정" value={stats.soon} tone="orange" />
            <SummaryPill label="완료" value={stats.done} tone="green" />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className={`rounded-2xl border px-3 py-2 text-xs transition ${
                showCompleted
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border/20 bg-secondary/25 text-muted-foreground hover:text-foreground"
              }`}
            >
              {showCompleted ? "완료 포함 보기" : "완료 숨기기"}
            </button>

            {stats.done > 0 && (
              <button
                onClick={() => {
                  cleanupDoneTasks()
                  haptic.success()
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-border/20 bg-secondary/25 px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
              >
                <Archive className="h-3.5 w-3.5" />
                완료 항목 정리
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide pb-28">
          {visibleSections.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
              <p className="text-4xl">📋</p>
              <p className="mt-4 text-sm font-medium text-foreground">
                표시할 할 일이 없어요
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                아래 + 버튼으로 새 할 일을 바로 추가할 수 있습니다
              </p>
            </div>
          ) : (
            <div className="py-2">
              {visibleSections.map((section) => {
                const rawTasks = grouped.get(section.id) ?? []
                const todoTasks = rawTasks.filter((t) => t.status !== "done")
                const doneTasks = rawTasks.filter((t) => t.status === "done")
                const list = showCompleted ? rawTasks : todoTasks
                const open = openSections[section.id] ?? true

                if (list.length === 0 && !showCompleted) return null

                return (
                  <div key={section.id} className="mb-2">
                    <SectionHeader
                      title={section.title}
                      color={section.color}
                      count={todoTasks.length}
                      doneCount={doneTasks.length}
                      open={open}
                      onToggle={() => toggleSection(section.id)}
                      onAddClick={() => openAddSheet(section.id)}
                    />

                    {open && (
                      <div className="mt-2 flex flex-col gap-2">
                        {list.map((task) => (
                          <TaskItem
                            key={task.id}
                            task={task}
                            now={now}
                            color={section.color}
                            onStatusChange={setTaskStatus}
                            onRemove={removeTask}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <button
          onClick={() => openAddSheet("__none__")}
          className="absolute right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition hover:scale-105 active:scale-95"
          style={{ bottom: "calc(4rem + var(--sab, 0px) + 8px)" }}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <AddTaskSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        tree={sectionTree}
        defaultSectionId={sheetSectionId}
        onSubmit={handleAddTask}
      />
    </>
  )
}