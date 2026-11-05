import { classifyJob } from '@/lib/schedule-rules'

// Server-side counterpart of lib/use-shared-filters.ts.
export interface ParsedFilters { minConfidence: number; state: string; pm: string; type: string }

export function parseFilters(sp: URLSearchParams, defaultConfidence = 0): ParsedFilters {
  const raw = sp.get('minConfidence')
  return {
    minConfidence: Math.min(100, Math.max(0, raw == null ? defaultConfidence : parseFloat(raw) || 0)),
    state: sp.get('state') || '',
    pm: sp.get('pm') || '',
    type: sp.get('type') || 'all',
  }
}

export function jobWhere(f: ParsedFilters) {
  return {
    ...(f.state ? { state: f.state } : {}),
    ...(f.pm === 'none' ? { projectManagerId: null } : f.pm ? { projectManagerId: f.pm } : {}),
  }
}

export function leadWhere(f: ParsedFilters) {
  return {
    ...(f.state ? { stateOpp: f.state } : {}),
    ...(f.pm === 'none' ? { salespersonId: null } : f.pm ? { salespersonId: f.pm } : {}),
  }
}

/** Lead confidence as a percentage (BT stores a fraction or a whole number). */
export function leadConfidencePct(lead: { confidence?: number | null }): number {
  const c = lead.confidence ?? 0
  return c > 1 ? c : c * 100
}

export function jobMatchesType(job: Parameters<typeof classifyJob>[0], f: ParsedFilters): boolean {
  return f.type === 'all' || classifyJob(job) === f.type
}

export function leadMatches(lead: { confidence?: number | null; opportunityTitle?: string | null; tags?: string | null }, f: ParsedFilters): boolean {
  if (leadConfidencePct(lead) < f.minConfidence) return false
  return f.type === 'all' || classifyJob({ jobName: lead.opportunityTitle, tags: lead.tags }) === f.type
}
