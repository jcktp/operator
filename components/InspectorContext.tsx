'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type InspectorItem =
  | { type: 'entity'; name: string; entityType: string }
  | { type: 'location'; name: string; reportIds: string[]; reportTitles: Record<string, string>; contextsByReport: Array<{ reportId: string; reportTitle: string; area: string; context: string }> }

interface InspectorContextValue {
  selected: InspectorItem | null
  setSelected: (item: InspectorItem) => void
  close: () => void
  open: boolean
}

const InspectorContext = createContext<InspectorContextValue>({
  selected: null,
  setSelected: () => {},
  close: () => {},
  open: false,
})

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [selected, setSelectedState] = useState<InspectorItem | null>(null)

  const setSelected = (item: InspectorItem) => setSelectedState(item)
  const close = () => setSelectedState(null)
  const open = selected !== null

  return (
    <InspectorContext.Provider value={{ selected, setSelected, close, open }}>
      {children}
    </InspectorContext.Provider>
  )
}

export function useInspector() {
  return useContext(InspectorContext)
}
