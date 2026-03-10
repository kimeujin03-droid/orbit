"use client"

import { useState, useEffect, useCallback } from "react"
import { usePlannerStore } from "@/lib/store"

// ── 페이지 데이터 ────────────────────────────────────────────────────────────
const pages = [
  {
    id: "welcome",
    emoji: null, // 로고 애니메이션 사용
    title: "삶을 기록하세요.",
    sub: "당신의 하루를 완벽한 궤도 위로 올려드립니다.\n일상 관리의 새로운 시작, Orbit.",
    gradient: "from-indigo-600/20 via-purple-600/10 to-transparent",
  },
  {
    id: "timeblock",
    emoji: "📅",
    title: "드래그 한 번으로\n완성되는 하루",
    sub: "복잡한 입력은 필요 없어요.\n원하는 시간을 쓱 드래그하고 활동 태그를 선택해\n직관적으로 일정을 계획하세요.",
    gradient: "from-blue-600/20 via-cyan-600/10 to-transparent",
  },
  {
    id: "voice",
    emoji: "🎙️",
    title: "말하는 대로,\n똑똑하게 기록",
    sub: '"오후 3시 전공 수업", "나 오늘 너무 피곤해."\n자연스럽게 말만 하세요.\nAI가 일정과 컨디션을 찰떡같이 알아듣고 등록해 줍니다.',
    gradient: "from-violet-600/20 via-purple-600/10 to-transparent",
  },
  {
    id: "tasks",
    emoji: "✅",
    title: "놓치는 일 없이,\n선명하게",
    sub: "미분류, 긴급, 예정된 할 일을 나누어 관리하세요.\n체크리스트를 달성하며 하루의 성취감을 쌓아갈 수 있습니다.",
    gradient: "from-emerald-600/20 via-teal-600/10 to-transparent",
  },
  {
    id: "focus",
    emoji: "🎯",
    title: "완벽한 몰입을 위한 시간",
    sub: "카운트다운과 스톱워치를 활용해\n나만의 집중 목표를 달성하세요.\n활동별로 세션과 집중도를 측정할 수 있습니다.",
    gradient: "from-orange-600/20 via-amber-600/10 to-transparent",
  },
  {
    id: "condition",
    emoji: "💆",
    title: "내 몸과 마음의\n흐름 읽기",
    sub: "매일의 기분과 피로도를 기록하고,\n여성 사용자를 위한 생리 주기 예측 기능으로\n내 몸의 리듬에 맞춰 일정을 조율하세요.",
    gradient: "from-pink-600/20 via-rose-600/10 to-transparent",
  },
  {
    id: "consumable",
    emoji: "📦",
    title: "일상의 사소한\n소모품까지",
    sub: "영양제, 식료품, 생필품...\n언제 사고 얼마나 썼는지 헷갈리셨나요?\n소모품 트래커로 낭비 없이 스마트하게 소비하세요.",
    gradient: "from-amber-600/20 via-yellow-600/10 to-transparent",
  },
  {
    id: "stats",
    emoji: "📊",
    title: "데이터로 확인하는\n나의 궤도",
    sub: "매일 누적된 활동 통계와 기록 스트릭을 확인하세요.\n어제보다 한 걸음 더 나아간 당신의 모습을 보여드립니다.",
    gradient: "from-cyan-600/20 via-blue-600/10 to-transparent",
  },
]

// ── 원자 궤도 로고 SVG ─────────────────────────────────────────────────────
function OrbitLogo({ animate }: { animate: boolean }) {
  return (
    <div className={`relative w-40 h-40 ${animate ? "animate-fade-in-scale" : ""}`}>
      <svg viewBox="0 0 200 200" className="w-full h-full" fill="none">
        {/* 외부 궤도 1 */}
        <ellipse
          cx="100" cy="100" rx="85" ry="35"
          className="stroke-primary/40"
          strokeWidth="1.5"
          transform="rotate(-30 100 100)"
        >
          {animate && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="-30 100 100"
              to="330 100 100"
              dur="20s"
              repeatCount="indefinite"
            />
          )}
        </ellipse>

        {/* 외부 궤도 2 */}
        <ellipse
          cx="100" cy="100" rx="85" ry="35"
          className="stroke-primary/30"
          strokeWidth="1.5"
          transform="rotate(30 100 100)"
        >
          {animate && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="30 100 100"
              to="390 100 100"
              dur="25s"
              repeatCount="indefinite"
            />
          )}
        </ellipse>

        {/* 외부 궤도 3 */}
        <ellipse
          cx="100" cy="100" rx="85" ry="35"
          className="stroke-primary/20"
          strokeWidth="1"
          transform="rotate(90 100 100)"
        >
          {animate && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="90 100 100"
              to="450 100 100"
              dur="30s"
              repeatCount="indefinite"
            />
          )}
        </ellipse>

        {/* 중심 핵 */}
        <circle cx="100" cy="100" r="12" className="fill-primary" opacity="0.9">
          {animate && (
            <animate
              attributeName="r"
              values="11;14;11"
              dur="3s"
              repeatCount="indefinite"
            />
          )}
        </circle>
        <circle cx="100" cy="100" r="6" className="fill-primary-foreground" opacity="0.8" />

        {/* 궤도 위의 전자들 */}
        <circle r="4" className="fill-primary/80">
          {animate && (
            <animateMotion
              dur="4s"
              repeatCount="indefinite"
              path="M100,65 A85,35 -30 1,1 99.9,65"
            />
          )}
        </circle>
        <circle r="3" className="fill-primary/60">
          {animate && (
            <animateMotion
              dur="5s"
              repeatCount="indefinite"
              path="M100,65 A85,35 30 1,1 99.9,65"
            />
          )}
        </circle>
        <circle r="2.5" className="fill-primary/40">
          {animate && (
            <animateMotion
              dur="6s"
              repeatCount="indefinite"
              path="M15,100 A85,35 90 1,1 14.9,100"
            />
          )}
        </circle>
      </svg>
    </div>
  )
}

// ── 온보딩 메인 컴포넌트 ───────────────────────────────────────────────────
export function OnboardingScreen() {
  const { setOnboardingDone } = usePlannerStore()
  const [currentPage, setCurrentPage] = useState(0)
  const [direction, setDirection] = useState<"next" | "prev">("next")
  const [isAnimating, setIsAnimating] = useState(false)
  const [logoVisible, setLogoVisible] = useState(false)

  // 첫 페이지 로고 애니메이션
  useEffect(() => {
    const t = setTimeout(() => setLogoVisible(true), 300)
    return () => clearTimeout(t)
  }, [])

  const goTo = useCallback((idx: number) => {
    if (isAnimating || idx === currentPage) return
    setDirection(idx > currentPage ? "next" : "prev")
    setIsAnimating(true)
    setTimeout(() => {
      setCurrentPage(idx)
      setIsAnimating(false)
    }, 250)
  }, [isAnimating, currentPage])

  const next = useCallback(() => {
    if (currentPage < pages.length - 1) goTo(currentPage + 1)
  }, [currentPage, goTo])

  const prev = useCallback(() => {
    if (currentPage > 0) goTo(currentPage - 1)
  }, [currentPage, goTo])

  const finish = useCallback(() => {
    setOnboardingDone()
  }, [setOnboardingDone])

  // 스와이프 감지
  const [touchStart, setTouchStart] = useState<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return
    const dx = e.changedTouches[0].clientX - touchStart
    if (Math.abs(dx) > 60) {
      if (dx < 0) next()
      else prev()
    }
    setTouchStart(null)
  }

  const page = pages[currentPage]
  const isFirst = currentPage === 0
  const isLast = currentPage === pages.length - 1

  return (
    <div
      className="fixed inset-0 z-[100] bg-background text-foreground flex flex-col select-none overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 배경 그라데이션 */}
      <div className={`absolute inset-0 bg-gradient-to-b ${page.gradient} transition-all duration-500 pointer-events-none`} />

      {/* 스킵 버튼 */}
      {!isLast && (
        <button
          onClick={finish}
          className="absolute top-safe right-4 z-10 mt-3 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-full"
        >
          건너뛰기
        </button>
      )}

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative">
        <div
          className={`flex flex-col items-center text-center transition-all duration-300 ${
            isAnimating
              ? direction === "next"
                ? "opacity-0 translate-x-8"
                : "opacity-0 -translate-x-8"
              : "opacity-100 translate-x-0"
          }`}
        >
          {/* 비주얼 영역 */}
          <div className="mb-8">
            {isFirst ? (
              <div className={`transition-all duration-700 ${logoVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}>
                <OrbitLogo animate={logoVisible} />
              </div>
            ) : (
              <div className="w-28 h-28 rounded-3xl bg-secondary/20 backdrop-blur-sm border border-border/10 flex items-center justify-center shadow-lg">
                <span className="text-6xl">{page.emoji}</span>
              </div>
            )}
          </div>

          {/* 브랜드 이름 (첫 페이지만) */}
          {isFirst && (
            <p className={`text-3xl font-black tracking-tight mb-3 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent transition-all duration-700 delay-300 ${
              logoVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}>
              Orbit
            </p>
          )}

          {/* 메인 카피 */}
          <h1 className="text-2xl font-bold leading-tight whitespace-pre-line mb-4">
            {page.title}
          </h1>

          {/* 서브 카피 */}
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line max-w-[300px]">
            {page.sub}
          </p>
        </div>
      </div>

      {/* 하단 영역 */}
      <div className="flex-shrink-0 px-8 pb-safe mb-6 space-y-5">
        {/* 인디케이터 도트 */}
        <div className="flex items-center justify-center gap-2">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === currentPage
                  ? "w-6 h-2 bg-primary"
                  : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>

        {/* 버튼 */}
        {isFirst ? (
          <button
            onClick={next}
            className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-base shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform"
          >
            시작하기
          </button>
        ) : isLast ? (
          <button
            onClick={finish}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-purple-600 text-white font-semibold text-base shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform"
          >
            Orbit과 함께 출발하기 🚀
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={prev}
              className="flex-1 py-3 rounded-2xl bg-secondary/60 text-foreground font-medium text-sm active:scale-[0.98] transition-transform"
            >
              이전
            </button>
            <button
              onClick={next}
              className="flex-[2] py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
