"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Check, Clock } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { Category, TimeBlock as TimeBlockType, Task } from "@/lib/types"

interface TimeBlockProps {
  block: TimeBlockType
  category: Category | undefined
  isFirst: boolean
  isLast: boolean
  isOverlay?: boolean
  style?: React.CSSProperties
  onUpdate: (blockId: string, updates: Partial<TimeBlockType>) => void
  hour?: number
  segment?: number
}

export function TimeBlock({
  block,
  category,
  isFirst,
  isLast,
  isOverlay = false,
  style,
  onUpdate,
  hour,
  segment,
}: TimeBlockProps) {
  const [newTask, setNewTask] = useState("")
  const [newTaskTime, setNewTaskTime] = useState("")
  const [popoverOpen, setPopoverOpen] = useState(false)

  const displayColor = block.customColor || category?.color || "#6B7280"
  const displayName = block.customLabel || category?.name || "임시"

  const blockHour = hour ?? block.hour
  const blockSegment = segment ?? block.segment
  const defaultTime = `${blockHour.toString().padStart(2, "0")}:${(blockSegment * 10).toString().padStart(2, "0")}`

  useEffect(() => {
    if (popoverOpen && !newTaskTime) {
      setNewTaskTime(defaultTime)
    }
  }, [popoverOpen, defaultTime, newTaskTime])

  const handleAddTask = () => {
    if (newTask.trim()) {
      const task: Task = {
        id: `task-${Date.now()}`,
        text: newTask.trim(),
        completed: false,
        scheduledTime: newTaskTime || undefined,
      }
      onUpdate(block.id, { tasks: [...block.tasks, task] })
      setNewTask("")
      setNewTaskTime(defaultTime)
    }
  }

  const handleToggleTask = (taskId: string) => {
    const updatedTasks = block.tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    onUpdate(block.id, { tasks: updatedTasks })
  }

  const handleTaskClickOutside = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    handleToggleTask(taskId)
  }

  if (isOverlay) {
    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <div
            className="cursor-pointer hover:brightness-110 transition-all z-10 flex flex-col p-1.5 overflow-hidden rounded-md shadow-sm"
            style={{
              backgroundColor: displayColor,
              ...style,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] font-medium truncate leading-tight" style={{ color: "#1a1a1a" }}>
              {displayName}
            </span>
            {block.tasks.length > 0 && (
              <div className="flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                {block.tasks.slice(0, 2).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-1 cursor-pointer"
                    onClick={(e) => handleTaskClickOutside(e, task.id)}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-sm border border-black/30 flex items-center justify-center flex-shrink-0 ${task.completed ? "bg-black/20" : ""}`}
                    >
                      {task.completed && <Check className="w-1.5 h-1.5 text-black/70" />}
                    </div>
                    <span
                      className={`text-[8px] truncate ${task.completed ? "line-through opacity-60" : ""}`}
                      style={{ color: "#1a1a1a" }}
                    >
                      {task.text}
                    </span>
                  </div>
                ))}
                {block.tasks.length > 2 && (
                  <span className="text-[7px]" style={{ color: "#1a1a1a" }}>
                    +{block.tasks.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: displayColor }} />
              <span className="font-medium text-sm">{displayName}</span>
              <span className="text-xs text-muted-foreground ml-auto">{defaultTime}</span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">할 일</span>
              <div className="space-y-1.5 max-h-32 overflow-auto">
                {block.tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => handleToggleTask(task.id)}
                      className="w-4 h-4"
                    />
                    <span className={`text-sm flex-1 ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                      {task.text}
                    </span>
                    {task.scheduledTime && <span className="text-xs text-muted-foreground">{task.scheduledTime}</span>}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="새 할 일..."
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                    className="text-sm flex-1"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="time"
                    value={newTaskTime}
                    onChange={(e) => setNewTaskTime(e.target.value)}
                    className="text-sm flex-1"
                  />
                  <Button size="sm" onClick={handleAddTask}>
                    추가
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <div
          className="cursor-pointer hover:brightness-95 transition-all flex flex-col overflow-hidden rounded-md z-10"
          style={{
            backgroundColor: displayColor,
            ...style,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-1">
            <span
              className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium"
              style={{ backgroundColor: "rgba(0,0,0,0.2)", color: "#1a1a1a" }}
            >
              {displayName}
            </span>
          </div>

          {block.tasks.length > 0 && (
            <div className="px-1.5 py-0.5 space-y-0.5">
              {block.tasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-1 cursor-pointer"
                  onClick={(e) => handleTaskClickOutside(e, task.id)}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-sm border border-black/30 flex items-center justify-center flex-shrink-0 ${task.completed ? "bg-black/20" : ""}`}
                  >
                    {task.completed && <Check className="w-2 h-2 text-black/70" />}
                  </div>
                  <span
                    className={`text-[8px] truncate ${task.completed ? "line-through opacity-60" : ""}`}
                    style={{ color: "#1a1a1a" }}
                  >
                    {task.scheduledTime && <span className="mr-0.5">{task.scheduledTime}</span>}
                    {task.text}
                  </span>
                </div>
              ))}
              {block.tasks.length > 3 && (
                <span className="text-[8px]" style={{ color: "#1a1a1a" }}>
                  +{block.tasks.length - 3}개 더
                </span>
              )}
            </div>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: displayColor }} />
            <span className="font-semibold">{displayName}</span>
            <span className="text-xs text-muted-foreground ml-auto">{defaultTime}</span>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">할 일</span>
            <div className="space-y-1.5 max-h-32 overflow-auto">
              {block.tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => handleToggleTask(task.id)}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm flex-1 ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                    {task.text}
                  </span>
                  {task.scheduledTime && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {task.scheduledTime}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Input
                placeholder="새 할 일..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                className="text-sm"
              />
              <div className="flex gap-2 items-center">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input
                  type="time"
                  value={newTaskTime}
                  onChange={(e) => setNewTaskTime(e.target.value)}
                  className="text-sm flex-1"
                />
                <Button size="sm" onClick={handleAddTask}>
                  추가
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
