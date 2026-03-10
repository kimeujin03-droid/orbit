"use client"

import { useEffect } from "react"
import { usePlannerStore } from "@/lib/store"

export function ThemeSync() {
  const theme = usePlannerStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
    // Also update meta theme-color for mobile browsers
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute("content", theme === "dark" ? "#1a1a2e" : "#f5f5f7")
    }
  }, [theme])

  return null
}
