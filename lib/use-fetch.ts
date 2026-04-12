'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface UseFetchResult<T> {
  data: T
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Reusable hook for fetch → state → loading pattern.
 * @param url     API URL to fetch from (null/undefined skips the fetch)
 * @param initial Default value while loading
 * @param extract Optional function to pull the desired field from the JSON response
 */
export function useFetch<T>(
  url: string | null | undefined,
  initial: T,
  extract?: (json: Record<string, unknown>) => T,
): UseFetchResult<T> {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(!!url)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef(url)
  urlRef.current = url

  const doFetch = useCallback(() => {
    const currentUrl = urlRef.current
    if (!currentUrl) return
    setLoading(true)
    setError(null)
    fetch(currentUrl)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(json => {
        setData(extract ? extract(json as Record<string, unknown>) : json as T)
      })
      .catch(err => {
        console.error(`useFetch(${currentUrl}):`, err)
        setError(String(err))
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    doFetch()
  }, [doFetch, url])

  return { data, loading, error, refetch: doFetch }
}
