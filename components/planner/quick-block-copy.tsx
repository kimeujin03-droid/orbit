"use client"

import { useState } from "react"
import { usePlannerStore, formatDateISO } from "@/lib/store"
import { Copy, Calendar, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// 빠른 블록 복사 다이얼로그
export function QuickBlockCopy({ 
  targetDate, 
  open, 
  onOpenChange 
}: { 
  targetDate: Date
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { blocksByDate, addBlock, pushSnapshot } = usePlannerStore()
  const [copied, setCopied] = useState(false)
  
  const targetDateISO = formatDateISO(targetDate)
  
  // 복사 가능한 날짜 옵션들
  const copyOptions = [
    {
      label: "어제",
      getDa: () => {
        const d = new Date(targetDate)
        d.setDate(d.getDate() - 1)
        return d
      }
    },
    {
      label: "지난주 같은 요일",
      getDate: () => {
        const d = new Date(targetDate)
        d.setDate(d.getDate() - 7)
        return d
      }
    },
    {
      label: "2주 전 같은 요일",
      getDate: () => {
        const d = new Date(targetDate)
        d.setDate(d.getDate() - 14)
        return d
      }
    },
    {
      label: "한 달 전 같은 날짜",
      getDate: () => {
        const d = new Date(targetDate)
        d.setMonth(d.getMonth() - 1)
        return d
      }
    }
  ]
  
  const handleCopy = (sourceDate: Date) => {
    const sourceISO = formatDateISO(sourceDate)
    const sourceBlocks = blocksByDate[sourceISO] || []
    
    if (sourceBlocks.length === 0) {
      alert("해당 날짜에 블록이 없어요")
      return
    }
    
    // 스냅샷 저장
    pushSnapshot()
    
    // 블록 복사 (새로운 ID 생성)
    sourceBlocks.forEach(block => {
      addBlock({
        ...block,
        id: crypto.randomUUID(),
        dateISO: targetDateISO,
        createdAt: Date.now()
      })
    })
    
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      onOpenChange(false)
    }, 1000)
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[400px] mx-4 rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Copy className="w-4 h-4" />
            블록 복사
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 pt-2">
          {/* 대상 날짜 표시 */}
          <div className="bg-muted/30 rounded-xl p-3">
            <div className="text-xs text-muted-foreground mb-1">복사할 날짜</div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="font-medium">
                {targetDate.getFullYear()}년 {targetDate.getMonth() + 1}월 {targetDate.getDate()}일
              </span>
            </div>
          </div>
          
          {/* 복사 옵션들 */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              어디서 가져올까요?
            </div>
            
            {copyOptions.map((option, idx) => {
              const sourceDate = option.getDate()
              const sourceISO = formatDateISO(sourceDate)
              const blockCount = (blocksByDate[sourceISO] || []).length
              
              return (
                <button
                  key={idx}
                  onClick={() => handleCopy(sourceDate)}
                  disabled={blockCount === 0}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border/20 hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border/20 disabled:hover:bg-transparent"
                >
                  <div className="text-left">
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {sourceDate.getMonth() + 1}월 {sourceDate.getDate()}일
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {blockCount > 0 ? (
                      <span className="text-xs text-primary font-medium">
                        {blockCount}개 블록
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        블록 없음
                      </span>
                    )}
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              )
            })}
          </div>
          
          {/* 성공 메시지 */}
          {copied && (
            <div className="flex items-center justify-center gap-2 text-green-500 py-2">
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">복사 완료!</span>
            </div>
          )}
          
          {/* 안내 */}
          <div className="text-xs text-center text-muted-foreground pt-2">
            복사된 블록은 수정할 수 있어요
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 사용 예시:
// header.tsx나 timeline.tsx에 버튼 추가
export function QuickBlockCopyButton({ date }: { date: Date }) {
  const [open, setOpen] = useState(false)
  
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
      >
        <Copy className="w-3.5 h-3.5" />
        <span>블록 복사</span>
      </button>
      
      <QuickBlockCopy 
        targetDate={date}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
