'use client'

import { createContext, useContext, useState } from 'react'

interface EntitiesSearchContextValue {
 query: string
 setQuery: (q: string) => void
}

const EntitiesSearchContext = createContext<EntitiesSearchContextValue>({ query: '', setQuery: () => {} })

export function EntitiesSearchProvider({ children }: { children: React.ReactNode }) {
 const [query, setQuery] = useState('')
 return (
 <EntitiesSearchContext.Provider value={{ query, setQuery }}>
 {children}
 </EntitiesSearchContext.Provider>
 )
}

export function useEntitiesSearch() {
 return useContext(EntitiesSearchContext)
}
