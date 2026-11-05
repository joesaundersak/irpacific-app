/* Schedule accountability rules + phase-based billing model (shared by server and client). */

export type ScheduleType = 'install' | 'product'

export interface PhaseDef {
  key: string
  label: string
  match: RegExp
  bill: number // default % of contract billed in this phase
  time: number // default % of the project timeline
}

// Order matters: a schedule item is assigned to the FIRST phase whose pattern matches (most specific first).
const INSTALL_MATCH_ORDER = ['punch', 'completion', 'installation', 'procurement', 'precon']

export const INSTALL_PHASES: PhaseDef[] = [
  { key: 'precon', label: 'Contracting / Pre-Construction', bill: 10, time: 10,
    match: /contract|pre-?\s?con|pre-?construction|measure|template|kick\s?-?off|site visit|permit|submittal|deposit/ },
  { key: 'procurement', label: 'Procurement', bill: 20, time: 25,
    match: /procure|order|purchas|\bp\.?o\.?\b|deliver|\beta\b|ship|pick\s?-?up|pk up|material|mtls|matrl|fabricat/ },
  { key: 'installation', label: 'Installation', bill: 50, time: 45,
    match: /install|demo|prep\b|start work|begin|start project/ },
  { key: 'punch', label: 'Punch List', bill: 10, time: 10,
    match: /punch|walk\s?-?through|touch\s?-?up/ },
  { key: 'completion', label: 'Completion', bill: 10, time: 10,
    match: /complet|close\s?-?out|turn\s?-?over|finish job|substantial|final inspection/ },
]

export const PRODUCT_PHASES: PhaseDef[] = [
  { key: 'po', label: 'PO Due Date', bill: 50, time: 0, match: /\bp\.?o\.?\b|purchase order|order (material|product)|place order|po due/ },
  { key: 'delivery', label: 'Customer Delivery', bill: 50, time: 0, match: /deliver|pick\s?-?up|pk up|ship/ },
]

const PRODUCT_HINT = /sample|material(s)? only|supply only|product only|product sale|delivery only|cash\s?&?\s?carry|will call/i

const INSTALL_TAG = /\binstall(ation)?\b/i

/**
 * Install vs product sale comes from BuilderTrend only (the app never overrides it).
 * Preferred flag: a BuilderTrend Job Group / Lead Tag named "Product Only" (or "Installation").
 * Fallback: keywords in the job name / job type.
 */
export function classifyJob(job: { scheduleType?: string | null; jobName?: string | null; jobType?: string | null; groups?: string | null; tags?: string | null }): ScheduleType {
  const tagText = `${job.groups ?? ''} ${job.tags ?? ''}`
  if (PRODUCT_HINT.test(tagText)) return 'product'
  if (INSTALL_TAG.test(tagText)) return 'install'
  const text = `${job.jobName ?? ''} ${job.jobType ?? ''}`
  return PRODUCT_HINT.test(text) ? 'product' : 'install'
}

export function phaseDefs(type: ScheduleType): PhaseDef[] {
  return type === 'product' ? PRODUCT_PHASES : INSTALL_PHASES
}

export interface MilestoneLike { phase?: string | null; title?: string | null; startDate?: string | Date | null; endDate?: string | Date | null }

/** Which required phase (if any) a schedule item belongs to. AP rows are never schedule phases. */
export function matchPhase(ms: MilestoneLike, type: ScheduleType): string | null {
  const phase = (ms.phase ?? '').trim()
  if (phase.toUpperCase() === 'AP' || phase.toUpperCase() === 'AR') return null
  const text = `${phase} ${ms.title ?? ''}`.toLowerCase()
  if (type === 'product') {
    for (const p of PRODUCT_PHASES) if (p.match.test(text)) return p.key
    return null
  }
  for (const key of INSTALL_MATCH_ORDER) {
    const p = INSTALL_PHASES.find(x => x.key === key)!
    if (p.match.test(text)) return p.key
  }
  return null
}

export interface PhaseStatus { key: string; label: string; count: number; start: Date | null; end: Date | null }
export interface ScheduleEval { type: ScheduleType; phases: PhaseStatus[]; missing: string[]; hasSchedule: boolean; complete: boolean }

const toDate = (v: any): Date | null => { if (!v) return null; const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? null : d }

export function evaluateSchedule(job: Parameters<typeof classifyJob>[0], milestones: MilestoneLike[]): ScheduleEval {
  const type = classifyJob(job)
  const phases: PhaseStatus[] = phaseDefs(type).map(p => ({ key: p.key, label: p.label, count: 0, start: null, end: null }))
  for (const ms of milestones ?? []) {
    const s = toDate(ms.startDate), e = toDate(ms.endDate) ?? s
    if (!s && !e) continue // undated items don't count as a schedule
    const key = matchPhase(ms, type)
    if (!key) continue
    const ph = phases.find(p => p.key === key)!
    ph.count++
    const start = s ?? e!
    if (!ph.start || start < ph.start) ph.start = start
    if (!ph.end || e! > ph.end) ph.end = e!
  }
  const missing = phases.filter(p => p.count === 0).map(p => p.label)
  return { type, phases, missing, hasSchedule: phases.some(p => p.count > 0), complete: missing.length === 0 }
}

/** Open jobs that still need managing (excludes completed / fully closed-out jobs that remain OPEN in BuilderTrend). */
export function isActiveJob(job: { status?: string | null; actualCompletion?: any; percentComplete?: number | null; groups?: string | null }): boolean {
  if ((job.status ?? '').toUpperCase() !== 'OPEN') return false
  if (job.actualCompletion) return false
  if ((job.percentComplete ?? 0) >= 100) return false
  if (/commission paid/i.test(job.groups ?? '')) return false
  return true
}

export function contractValue(job: { totalRevisedPrice?: number | null; contractPrice?: number | null; approvedCOPrice?: number | null }): number {
  const t = job.totalRevisedPrice ?? 0
  return t > 0 ? t : (job.contractPrice ?? 0) + (job.approvedCOPrice ?? 0)
}

export function isOpenLead(lead: { leadStatus?: string | null; linkedJobId?: string | null; soldDate?: any }): boolean {
  if (lead.linkedJobId || lead.soldDate) return false
  return !/sold|lost|closed|dead|no opportunity|declined/i.test(lead.leadStatus ?? '')
}

/** Config keys for the editable forecast model (Settings page). */
export const FORECAST_CONFIG_KEYS = {
  bill: (k: string) => `fc_${k}_bill`,
  time: (k: string) => `fc_${k}_time`,
  productDeposit: 'fc_product_deposit',
}
