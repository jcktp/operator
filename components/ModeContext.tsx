'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getModeConfig, type ModeConfig } from '@/lib/mode'

interface ModeContextValue {
  config: ModeConfig
  setMode: (mode: string) => void
}

const ModeContext = createContext<ModeContextValue>({
  config: getModeConfig('executive'),
  setMode: () => {},
})

export function ModeProvider({
  initialMode,
  children,
}: {
  initialMode: string | null
  children: React.ReactNode
}) {
  const [config, setConfig] = useState(getModeConfig(initialMode))

  useEffect(() => {
    setConfig(getModeConfig(initialMode))
  }, [initialMode])

  const setMode = useCallback((mode: string) => {
    setConfig(getModeConfig(mode))
  }, [])

  return <ModeContext.Provider value={{ config, setMode }}>{children}</ModeContext.Provider>
}

export function useMode(): ModeConfig {
  return useContext(ModeContext).config
}

export function useSetMode(): (mode: string) => void {
  return useContext(ModeContext).setMode
}
