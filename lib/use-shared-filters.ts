'use client'

import { useCallback, useEffect, useState } from 'react'

// One set of filters shared by Forecast, Sales Pipeline and Dashboard (saved in this browser).
export interface SharedFilters {
  includeLeads: boolean
  minConfidence: string
  state: string
  pm: string
  type: string
  months: string
}

export const DEFAULT_FILTERS: SharedFilters = { includeLeads: false, minConfidence: '60', state: 'all', pm: 'all', type: 'all', months: '12' }
const KEY = 'irp_filters'

export function useSharedFilters() {
  const [f, setF] = useState<SharedFilters>(DEFAULT_FILTERS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY)
      if (saved) setF({ ...DEFAULT_FILTERS, ...JSON.parse(saved) })
    } catch (e) { console.error('Could not read saved filters', e) }
    setReady(true)
  }, [])

  const set = useCallback(<K extends keyof SharedFilters>(k: K, v: SharedFilters[K]) => {
    setF(prev => {
      const next = { ...prev, [k]: v }
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch (e) { console.error('Could not save filters', e) }
      return next
    })
  }, [])

  const refresh = useCallback(() => setF(prev => ({ ...prev })), [])

  return { f, set, ready, refresh }
}

/** Query string for the shared filters (state/pm/type only when not 'all'). */
export function filterParams(f: SharedFilters, extra?: Record<string, string>): URLSearchParams {
  const p = new URLSearchParams(extra)
  p.set('minConfidence', f.minConfidence)
  if (f.state !== 'all') p.set('state', f.state)
  if (f.pm !== 'all') p.set('pm', f.pm)
  if (f.type !== 'all') p.set('type', f.type)
  return p
}
