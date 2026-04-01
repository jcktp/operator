'use client'

import { useEffect } from 'react'

interface Props {
  name: string
}

// Null-rendering client component — scrolls to and briefly highlights a named entity row on mount.
export default function FocusEntity({ name }: Props) {
  useEffect(() => {
    const id = `entity-${name.replace(/\s+/g, '-').toLowerCase()}`
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-indigo-400', 'ring-offset-1', 'rounded-xl')
    const t = setTimeout(() => {
      el.classList.remove('ring-2', 'ring-indigo-400', 'ring-offset-1', 'rounded-xl')
    }, 1800)
    return () => clearTimeout(t)
  }, [name])

  return null
}
