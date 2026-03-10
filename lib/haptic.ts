// 햅틱 피드백 유틸리티 (모바일 진동 API)
// navigator.vibrate는 모바일에서만 작동

export const haptic = {
  /** 가벼운 탭 — 버튼 클릭 */
  light: () => {
    try { navigator.vibrate?.(8) } catch {}
  },
  /** 중간 — 항목 선택/토글 */
  medium: () => {
    try { navigator.vibrate?.(20) } catch {}
  },
  /** 무거운 — 롱프레스/삭제 */
  heavy: () => {
    try { navigator.vibrate?.(40) } catch {}
  },
  /** 성공 — 체크 완료, 저장 */
  success: () => {
    try { navigator.vibrate?.([10, 30, 10]) } catch {}
  },
  /** 경고 — 실패, 오류 */
  warning: () => {
    try { navigator.vibrate?.([30, 20, 30, 20, 60]) } catch {}
  },
  /** 오류 — 권한 거부, 인식 실패 */
  error: () => {
    try { navigator.vibrate?.([50, 30, 50]) } catch {}
  },
  /** 완료 알림 — 타이머 종료 */
  completion: () => {
    try { navigator.vibrate?.([50, 50, 50, 50, 200]) } catch {}
  },
}
