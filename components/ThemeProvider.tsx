'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'
export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme          // resolved: the actual applied theme
  mode: ThemeMode       // explicit setting including 'system'
  setMode: (m: ThemeMode) => void
  toggle: () => void    // convenience: cycles light ↔ dark (sets explicit mode)
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  mode: 'system',
  setMode: () => {},
  toggle: () => {},
})

function storedToMode(val: string | null): ThemeMode {
  if (val === 'true') return 'dark'
  if (val === 'false') return 'light'
  return 'system'
}

function modeToStored(m: ThemeMode): string {
  if (m === 'dark') return 'true'
  if (m === 'light') return 'false'
  return 'system'
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme
  children: React.ReactNode
}) {
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [theme, setTheme] = useState<Theme>(initialTheme)

  // On mount: read saved mode from localStorage and resolve the actual theme
  useEffect(() => {
    const saved = localStorage.getItem('dark_mode')
    const m = storedToMode(saved)
    setModeState(m)
    if (m === 'system') {
      setTheme(systemPrefersDark() ? 'dark' : 'light')
    } else {
      setTheme(m)
    }
  }, [])

  // Track system preference changes when in 'system' mode
  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  // Apply theme to DOM and persist
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [theme])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    const resolved = m === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : m
    setTheme(resolved)
    const stored = modeToStored(m)
    localStorage.setItem('dark_mode', stored)
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'dark_mode', value: stored }),
    }).catch(() => {})
  }, [])

  const toggle = useCallback(() => {
    setMode(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setMode])

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
