export type TopCategory =
  | "CLASS"
  | "STUDY"
  | "ASSIGN"
  | "WORK"
  | "RESEARCH"
  | "MOVE"
  | "LIFE"
  | "EXERCISE"
  | "UNKNOWN"

export type WorkType =
  | "전공수업"
  | "교양/경영"
  | "실습/프로그래밍"
  | "언어"
  | "자격증"
  | "학교공부"
  | "과제"
  | "시험준비"
  | "과외수업"
  | "과외준비"
  | "소아과"
  | "학원수업"
  | "논문(스타링크)"
  | "앱개발"
  | "버스"
  | "택시"
  | "점심"
  | "저녁"
  | "낮잠"
  | "발레"
  | "기타"

export type InferredTaxonomy = {
  top: TopCategory
  workType?: WorkType
  topic?: string
  confidence: number
  reasons: string[]
}

const normKey = (s: string) => s.toLowerCase().replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "")

function includesAny(t: string, words: string[]) {
  const tk = normKey(t)
  return words.some(w => tk.includes(normKey(w)))
}

function removeWords(text: string, words: string[]) {
  let out = text
  for (const w of words) out = out.replace(new RegExp(w, "gi"), " ")
  return out.replace(/\s+/g, " ").trim()
}

const KW = {
  research: ["논문", "starlink", "스타링크", "rfi", "hera", "리비전", "리뷰", "원고", "실험", "app", "앱", "개발", "리팩터", "버그", "ui", "코딩"],
  work: ["소아과", "병원", "학원", "수학학원", "과외", "학습지", "수업준비", "프린트", "자료", "문제", "강사"],
  assign: ["과제", "레포트", "리포트", "제출", "숙제", "시험", "중간", "기말", "퀴즈", "쪽지시험"],
  classSubjects: ["운영체제", "운체", "os", "정보통신", "정통", "통신", "객체지향", "객프", "oop", "프로그래밍", "통계조사", "통계조사방법", "조사방법", "산업경영", "산경", "산업경영의이해", "온강", "경영"],
  classWords: ["수업", "강의", "전공", "교양", "출석", "강의실", "온강"],
  studyLang: ["일본어", "jlpt", "n1", "n2", "중국어", "hsk"],
  studyCert: ["빅데이터분석기사", "빅분", "빅데이터기사", "자격증"],
  studyWords: ["공부", "예습", "복습", "필기", "암기"],
  bus: ["버스", "대중교통"],
  taxi: ["택시", "카택"],
  lunch: ["점심", "밥"],
  dinner: ["저녁", "석식"],
  nap: ["낮잠", "잠깐잠", "휴식"],
  ballet: ["발레", "바레"],
}

function inferWorkType(title: string, top: TopCategory): { workType?: WorkType; reasons: string[] } {
  const reasons: string[] = []
  if (top === "MOVE") {
    if (includesAny(title, KW.taxi)) return { workType: "택시", reasons: ["이동:택시키워드"] }
    if (includesAny(title, KW.bus)) return { workType: "버스", reasons: ["이동:버스키워드"] }
    return { workType: "기타", reasons }
  }
  if (top === "LIFE") {
    if (includesAny(title, KW.lunch)) return { workType: "점심", reasons: ["생활:점심키워드"] }
    if (includesAny(title, KW.dinner)) return { workType: "저녁", reasons: ["생활:저녁키워드"] }
    if (includesAny(title, KW.nap)) return { workType: "낮잠", reasons: ["생활:낮잠키워드"] }
    return { workType: "기타", reasons }
  }
  if (top === "EXERCISE") return { workType: "발레", reasons: ["운동:발레키워드"] }
  if (top === "RESEARCH") {
    if (includesAny(title, ["starlink", "스타링크", "rfi", "hera", "논문", "리비전", "원고"])) return { workType: "논문(스타링크)", reasons: ["연구:논문키워드"] }
    if (includesAny(title, ["앱", "app", "개발", "리팩터", "버그", "ui", "코딩"])) return { workType: "앱개발", reasons: ["연구:앱키워드"] }
    return { workType: "기타", reasons }
  }
  if (top === "WORK") {
    if (includesAny(title, ["소아과", "병원"])) return { workType: "소아과", reasons: ["알바:소아과키워드"] }
    if (includesAny(title, ["학원", "수학학원", "강사"])) return { workType: "학원수업", reasons: ["알바:학원키워드"] }
    if (includesAny(title, ["학습지", "수업준비", "자료", "문제", "프린트"])) return { workType: "과외준비", reasons: ["알바:준비키워드"] }
    if (includesAny(title, ["과외"])) return { workType: "과외수업", reasons: ["알바:과외키워드"] }
    return { workType: "기타", reasons }
  }
  if (top === "ASSIGN") {
    if (includesAny(title, ["시험", "중간", "기말", "퀴즈", "쪽지"])) return { workType: "시험준비", reasons: ["과제/시험:시험키워드"] }
    return { workType: "과제", reasons: ["과제/시험:과제기본"] }
  }
  if (top === "STUDY") {
    if (includesAny(title, KW.studyLang)) return { workType: "언어", reasons: ["공부:언어키워드"] }
    if (includesAny(title, KW.studyCert)) return { workType: "자격증", reasons: ["공부:자격증키워드"] }
    return { workType: "학교공부", reasons: ["공부:학교공부기본"] }
  }
  if (top === "CLASS") {
    if (includesAny(title, ["객체지향", "객프", "oop", "프로그래밍"])) return { workType: "실습/프로그래밍", reasons: ["수업:프로그래밍키워드"] }
    if (includesAny(title, ["산업경영", "산경", "온강", "경영"])) return { workType: "교양/경영", reasons: ["수업:경영키워드"] }
    return { workType: "전공수업", reasons: ["수업:전공기본"] }
  }
  return { workType: "기타", reasons }
}

function inferTopic(title: string, top: TopCategory, workType?: WorkType): string | undefined {
  const stop = [
    "수업","강의","공부","과제","레포트","리포트","제출","시험","준비","미팅","회의",
    "알바","일","근무","이동","버스","택시","점심","저녁","낮잠","휴식","발레",
    "하기","하는","하자","좀","시간","부터","까지",
  ]
  const extra =
    top === "WORK" ? ["과외","학원","병원","소아과","학습지","수학학원"] :
    top === "RESEARCH" ? ["논문","연구","실험","리비전","원고","앱","개발","코딩","리팩터","버그","ui"] :
    top === "STUDY" ? ["일본어","중국어","jlpt","hsk","빅분","빅데이터분석기사","자격증"] :
    top === "CLASS" ? ["전공","교양","온강","경영","강의실","출석"] :
    []
  const wt = workType ? workType.split("/") : []
  const cleaned = removeWords(title.trim(), [...stop, ...extra, ...wt])
  if (!cleaned || cleaned.length < 2) return undefined
  return cleaned.replace(/\s+/g, " ").trim()
}

export function inferTaxonomy(title: string): InferredTaxonomy {
  const reasons: string[] = []
  if (includesAny(title, KW.research)) {
    reasons.push("우선:연구키워드")
    const { workType, reasons: r2 } = inferWorkType(title, "RESEARCH")
    reasons.push(...r2)
    return { top: "RESEARCH", workType, topic: inferTopic(title, "RESEARCH", workType), confidence: 0.9, reasons }
  }
  if (includesAny(title, KW.work)) {
    reasons.push("우선:알바키워드")
    const { workType, reasons: r2 } = inferWorkType(title, "WORK")
    reasons.push(...r2)
    return { top: "WORK", workType, topic: inferTopic(title, "WORK", workType), confidence: 0.9, reasons }
  }
  if (includesAny(title, KW.assign)) {
    reasons.push("우선:과제/시험키워드")
    const { workType, reasons: r2 } = inferWorkType(title, "ASSIGN")
    reasons.push(...r2)
    return { top: "ASSIGN", workType, topic: inferTopic(title, "ASSIGN", workType), confidence: 0.85, reasons }
  }
  if (includesAny(title, [...KW.classSubjects, ...KW.classWords])) {
    reasons.push("우선:수업키워드")
    const { workType, reasons: r2 } = inferWorkType(title, "CLASS")
    reasons.push(...r2)
    return { top: "CLASS", workType, topic: inferTopic(title, "CLASS", workType), confidence: 0.85, reasons }
  }
  if (includesAny(title, [...KW.studyLang, ...KW.studyCert, ...KW.studyWords])) {
    reasons.push("우선:공부키워드")
    const { workType, reasons: r2 } = inferWorkType(title, "STUDY")
    reasons.push(...r2)
    return { top: "STUDY", workType, topic: inferTopic(title, "STUDY", workType), confidence: 0.8, reasons }
  }
  if (includesAny(title, [...KW.bus, ...KW.taxi])) {
    reasons.push("우선:이동키워드")
    const { workType, reasons: r2 } = inferWorkType(title, "MOVE")
    reasons.push(...r2)
    return { top: "MOVE", workType, topic: inferTopic(title, "MOVE", workType), confidence: 0.9, reasons }
  }
  if (includesAny(title, [...KW.lunch, ...KW.dinner, ...KW.nap])) {
    reasons.push("우선:생활키워드")
    const { workType, reasons: r2 } = inferWorkType(title, "LIFE")
    reasons.push(...r2)
    return { top: "LIFE", workType, topic: inferTopic(title, "LIFE", workType), confidence: 0.9, reasons }
  }
  if (includesAny(title, KW.ballet)) {
    reasons.push("우선:운동키워드")
    const { workType, reasons: r2 } = inferWorkType(title, "EXERCISE")
    reasons.push(...r2)
    return { top: "EXERCISE", workType, topic: inferTopic(title, "EXERCISE", workType), confidence: 0.9, reasons }
  }
  reasons.push("fallback:unknown")
  return { top: "UNKNOWN", workType: "기타", topic: undefined, confidence: 0.35, reasons }
}

export function topToActivityName(top: TopCategory) {
  switch (top) {
    case "CLASS": return "수업"
    case "STUDY": return "공부"
    case "ASSIGN": return "과제"
    case "WORK": return "알바"
    case "RESEARCH": return "논문"
    case "MOVE": return "이동"
    case "LIFE": return "생활"
    case "EXERCISE": return "운동"
    default: return "미분류"
  }
}

export const WORKTYPE_OPTIONS: Record<TopCategory, WorkType[]> = {
  CLASS: ["전공수업", "교양/경영", "실습/프로그래밍", "기타"],
  STUDY: ["언어", "자격증", "학교공부", "기타"],
  ASSIGN: ["과제", "시험준비", "기타"],
  WORK: ["과외수업", "과외준비", "소아과", "학원수업", "기타"],
  RESEARCH: ["논문(스타링크)", "앱개발", "기타"],
  MOVE: ["버스", "택시", "기타"],
  LIFE: ["점심", "저녁", "낮잠", "기타"],
  EXERCISE: ["발레", "기타"],
  UNKNOWN: ["기타"],
}
