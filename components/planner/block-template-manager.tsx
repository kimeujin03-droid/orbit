"use client"

import { useState } from "react"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import { Save, Trash2, Download, Plus, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface BlockTemplate {
  id: string
  name: string
  description?: string
  blocks: Array<{
    activityId: string
    startMin: number
    endMin: number
    layer: "overlay" | "execute"
  }>
  createdAt: number
}

// 블록 템플릿 관리
export function BlockTemplateManager({ date }: { date: Date }) {
  const { blocksByDate, activities, addBlock, pushSnapshot } = usePlannerStore()
  const [templates, setTemplates] = useState<BlockTemplate[]>(() => {
    // localStorage에서 불러오기
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('blockTemplates')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateDesc, setTemplateDesc] = useState("")
  const [applied, setApplied] = useState<string | null>(null)
  
  const dateISO = formatDateISO(date)
  const todayBlocks = blocksByDate[dateISO] || []
  
  // 템플릿 저장
  const saveAsTemplate = () => {
    if (!templateName.trim()) {
      alert("템플릿 이름을 입력하세요")
      return
    }
    
    if (todayBlocks.length === 0) {
      alert("저장할 블록이 없어요")
      return
    }
    
    // 시간을 0 기준으로 정규화 (상대적 시간으로 저장)
    const minStartTime = Math.min(...todayBlocks.map(b => b.startMin))
    
    const newTemplate: BlockTemplate = {
      id: crypto.randomUUID(),
      name: templateName.trim(),
      description: templateDesc.trim() || undefined,
      blocks: todayBlocks.map(b => ({
        activityId: b.activityId,
        startMin: b.startMin - minStartTime, // 상대 시간
        endMin: b.endMin - minStartTime,
        layer: b.layer
      })),
      createdAt: Date.now()
    }
    
    const updated = [...templates, newTemplate]
    setTemplates(updated)
    localStorage.setItem('blockTemplates', JSON.stringify(updated))
    
    setShowSaveDialog(false)
    setTemplateName("")
    setTemplateDesc("")
    alert(`✅ "${newTemplate.name}" 템플릿이 저장되었어요`)
  }
  
  // 템플릿 적용
  const applyTemplate = (template: BlockTemplate, startHour: number = 0) => {
    pushSnapshot()
    
    const baseMin = startHour * 60
    
    template.blocks.forEach(blockTemplate => {
      addBlock({
        id: crypto.randomUUID(),
        dateISO,
        activityId: blockTemplate.activityId,
        startMin: baseMin + blockTemplate.startMin,
        endMin: baseMin + blockTemplate.endMin,
        layer: blockTemplate.layer,
        createdAt: Date.now()
      })
    })
    
    setApplied(template.id)
    setTimeout(() => setApplied(null), 2000)
  }
  
  // 템플릿 삭제
  const deleteTemplate = (id: string) => {
    if (!confirm("이 템플릿을 삭제할까요?")) return
    
    const updated = templates.filter(t => t.id !== id)
    setTemplates(updated)
    localStorage.setItem('blockTemplates', JSON.stringify(updated))
  }
  
  // 템플릿 내보내기 (JSON)
  const exportTemplate = (template: BlockTemplate) => {
    const json = JSON.stringify(template, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `template-${template.name}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // 활동 이름 가져오기
  const getActivityName = (activityId: string) => {
    return activities.find(a => a.id === activityId)?.name || "알 수 없음"
  }
  
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">블록 템플릿</h3>
        <Button
          onClick={() => setShowSaveDialog(true)}
          disabled={todayBlocks.length === 0}
          size="sm"
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          현재 블록 저장
        </Button>
      </div>
      
      {/* 템플릿 목록 */}
      {templates.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-2xl border border-border/10">
          <Save className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            저장된 템플릿이 없어요
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            자주 쓰는 블록 조합을 템플릿으로 저장하세요
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(template => (
            <div
              key={template.id}
              className="bg-background rounded-2xl border border-border/20 p-4 hover:border-primary/40 transition-colors"
            >
              {/* 템플릿 정보 */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold">{template.name}</h4>
                  {template.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {template.description}
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {template.blocks.length}개 블록
                  </div>
                </div>
                
                {/* 액션 버튼들 */}
                <div className="flex gap-1">
                  <button
                    onClick={() => exportTemplate(template)}
                    className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
                    title="내보내기"
                  >
                    <Download className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
              
              {/* 블록 미리보기 */}
              <div className="space-y-1 mb-3 max-h-32 overflow-y-auto">
                {template.blocks.slice(0, 5).map((block, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg px-2 py-1"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: activities.find(a => a.id === block.activityId)?.color || "#6B7280"
                      }}
                    />
                    <span className="text-muted-foreground">
                      {getActivityName(block.activityId)}
                    </span>
                    <span className="text-muted-foreground/60 ml-auto tabular-nums">
                      {Math.floor(block.startMin / 60)}:{(block.startMin % 60).toString().padStart(2, '0')} - {Math.floor(block.endMin / 60)}:{(block.endMin % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                ))}
                {template.blocks.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    +{template.blocks.length - 5}개 더
                  </div>
                )}
              </div>
              
              {/* 적용 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={() => applyTemplate(template, 0)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-medium transition-all
                    ${applied === template.id
                      ? 'bg-green-500 text-white'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }
                  `}
                >
                  {applied === template.id ? (
                    <>
                      <Check className="w-4 h-4" />
                      적용 완료!
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      0시부터 적용
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    const hour = parseInt(prompt("시작 시간을 입력하세요 (0-23):", "9") || "9")
                    if (hour >= 0 && hour <= 23) {
                      applyTemplate(template, hour)
                    }
                  }}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-xl text-sm font-medium transition-colors"
                >
                  시간 지정
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* 저장 다이얼로그 */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="w-[90vw] max-w-[400px] mx-4 rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base">템플릿 저장</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                템플릿 이름 *
              </label>
              <Input
                placeholder="예: 생산적인 월요일"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="h-9"
              />
            </div>
            
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                설명 (선택)
              </label>
              <Input
                placeholder="예: 아침 루틴 + 업무 + 운동"
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                className="h-9"
              />
            </div>
            
            <div className="bg-muted/30 rounded-xl p-3">
              <div className="text-xs text-muted-foreground">
                현재 {todayBlocks.length}개 블록이 저장됩니다
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onClick={saveAsTemplate}
                disabled={!templateName.trim()}
                className="flex-1"
              >
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
