'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggle: () => {} })

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme
  children: React.ReactNode
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  // On first mount: if no explicit setting has been saved, follow system preference
  // and listen for changes so the app tracks OS dark/light switching automatically.
  useEffect(() => {
    const saved = localStorage.getItem('dark_mode')
    if (saved === null) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      setTheme(mq.matches ? 'dark' : 'light')
      const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('dark_mode', theme === 'dark' ? 'true' : 'false')
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'dark_mode', value: theme === 'dark' ? 'true' : 'false' }),
    }).catch(() => {})
  }, [theme])

  const toggle = useCallback(() => {
    // Once the user manually toggles, write to localStorage so system-follow stops
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
