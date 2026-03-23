'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { getModeConfig, type ModeConfig } from '@/lib/mode'

const ModeContext = createContext<ModeConfig>(getModeConfig('executive'))

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

  return <ModeContext.Provider value={config}>{children}</ModeContext.Provider>
}

export function useMode(): ModeConfig {
  return useContext(ModeContext)
}
