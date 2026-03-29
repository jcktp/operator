'use client'

import { useState, useEffect } from 'react'

export type Settings = Record<string, string>

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({})

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((data: { settings?: Settings }) => {
        setSettings(data.settings ?? {})
      })
      .catch(() => {})
  }, [])

  async function saveSetting(key: string, value: string) {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
  }

  return { settings, saveSetting }
}
