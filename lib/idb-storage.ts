// =====================================================
// IndexedDB Storage Adapter for Zustand persist
// localStorage (5MB 제한) → IndexedDB (사실상 무제한)
// =====================================================

import { createJSONStorage } from "zustand/middleware"

/**
 * idb-keyval 기반 raw StateStorage.
 * getItem/setItem/removeItem이 문자열(JSON) 단위로 동작.
 * localStorage에서 자동 마이그레이션 포함.
 * SSR 환경(typeof window === "undefined")에서는 안전하게 null/noop 반환.
 */
const isServer = typeof window === "undefined"

const idbStateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (isServer) return null
    try {
      // 1. IndexedDB에서 먼저 조회
      const { get: idbGet } = await import("idb-keyval")
      const value = await idbGet<string>(name)
      if (value !== undefined && value !== null) {
        return value
      }

      // 2. IndexedDB에 없으면 localStorage에서 마이그레이션
      if (window.localStorage) {
        const lsValue = window.localStorage.getItem(name)
        if (lsValue) {
          // IndexedDB로 복사하고 localStorage에서 삭제
          const { set: idbSet } = await import("idb-keyval")
          await idbSet(name, lsValue)
          window.localStorage.removeItem(name)
          console.log(`[idb-storage] Migrated "${name}" from localStorage to IndexedDB`)
          return lsValue
        }
      }

      return null
    } catch (err) {
      console.warn("[idb-storage] getItem error, falling back to localStorage:", err)
      if (window.localStorage) {
        return window.localStorage.getItem(name)
      }
      return null
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (isServer) return
    try {
      const { set: idbSet } = await import("idb-keyval")
      await idbSet(name, value)
    } catch (err) {
      console.warn("[idb-storage] setItem error, falling back to localStorage:", err)
      try {
        window.localStorage.setItem(name, value)
      } catch {
        console.error("[idb-storage] Both IndexedDB and localStorage failed for setItem")
      }
    }
  },

  removeItem: async (name: string): Promise<void> => {
    if (isServer) return
    try {
      const { del: idbDel } = await import("idb-keyval")
      await idbDel(name)
    } catch (err) {
      console.warn("[idb-storage] removeItem error:", err)
    }
    window.localStorage?.removeItem(name)
  },
}

/**
 * Zustand persist에서 사용할 storage 객체.
 * createJSONStorage가 JSON 직렬화/역직렬화를 자동 처리.
 */
export const idbStorage = createJSONStorage(() => idbStateStorage)
