'use client'

import { createContext, useContext, useState } from 'react'

interface DispatchContextType {
  open: boolean
  setOpen: (open: boolean) => void
  aiContext: string
  setAiContext: (ctx: string) => void
  pendingMessage: string
  setPendingMessage: (msg: string) => void
}

const DispatchContext = createContext<DispatchContextType>({
  open: false,
  setOpen: () => {},
  aiContext: '',
  setAiContext: () => {},
  pendingMessage: '',
  setPendingMessage: () => {},
})

export function DispatchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [aiContext, setAiContext] = useState('')
  const [pendingMessage, setPendingMessage] = useState('')
  return (
    <DispatchContext.Provider value={{ open, setOpen, aiContext, setAiContext, pendingMessage, setPendingMessage }}>
      {children}
    </DispatchContext.Provider>
  )
}

export function useDispatch() {
  return useContext(DispatchContext)
}
