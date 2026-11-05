/* Lead follow-up escalation (shared by server and client).
   Escalation grows with time since the last touch (BT last contacted, or the latest action item activity),
   measured against the lead's follow-up cadence. Without a custom cadence, older leads escalate faster. */

export const CADENCE_OPTIONS = [
  { days: 7, label: 'Weekly' },
  { days: 14, label: 'Every 2 weeks' },
  { days: 30, label: 'Monthly' },
  { days: 60, label: 'Every 2 months' },
  { days: 90, label: 'Quarterly' },
  { days: 180, label: 'Every 6 months' },
  { days: 365, label: 'Yearly' },
] as const

export function cadenceLabel(days: number): string {
  return CADENCE_OPTIONS.find(o => o.days === days)?.label ?? `Every ${days} days`
}

export type EscalationLevel = 'none' | 'ok' | 'due' | 'overdue' | 'escalated'

export const LEVEL_LABEL: Record<EscalationLevel, string> = {
  none: 'Closed',
  ok: 'On track',
  due: 'Due soon',
  overdue: 'Overdue',
  escalated: 'Escalated',
}

export interface Escalation {
  level: EscalationLevel
  score: number // days since touch ÷ cadence (× age factor); higher = more urgent
  ageDays: number | null
  lastTouch: string | null
  lastTouchSource: 'action item' | 'BuilderTrend' | 'created' | null
  daysSinceTouch: number | null
  cadenceDays: number
  customCadence: boolean
  nextDue: string | null
  daysUntilDue: number | null
}

const DAY = 86_400_000

export function computeEscalation(input: {
  open: boolean
  createdDate: Date | null
  lastContacted: Date | null
  lastActionAt: Date | null
  cadenceDays: number | null
  defaultDays: number
  now?: number
}): Escalation {
  const now = input.now ?? Date.now()
  const cadence = input.cadenceDays && input.cadenceDays > 0 ? input.cadenceDays : input.defaultDays
  const custom = !!(input.cadenceDays && input.cadenceDays > 0)
  const ageDays = input.createdDate ? Math.max(0, Math.floor((now - input.createdDate.getTime()) / DAY)) : null

  const candidates: { d: Date; src: Escalation['lastTouchSource'] }[] = []
  if (input.lastActionAt) candidates.push({ d: input.lastActionAt, src: 'action item' })
  if (input.lastContacted) candidates.push({ d: input.lastContacted, src: 'BuilderTrend' })
  if (!candidates.length && input.createdDate) candidates.push({ d: input.createdDate, src: 'created' })
  const touch = candidates.sort((a, b) => b.d.getTime() - a.d.getTime())[0] ?? null

  const base = {
    ageDays,
    lastTouch: touch ? touch.d.toISOString() : null,
    lastTouchSource: touch?.src ?? null,
    cadenceDays: cadence,
    customCadence: custom,
  }
  if (!input.open) {
    return { ...base, level: 'none', score: 0, daysSinceTouch: null, nextDue: null, daysUntilDue: null }
  }

  const daysSinceTouch = touch ? Math.max(0, Math.floor((now - touch.d.getTime()) / DAY)) : 9999
  // Age factor applies only to leads on the default cadence: a custom cadence means the team accepted that timeline.
  const ageFactor = custom || ageDays == null ? 1 : ageDays >= 365 ? 1.5 : ageDays >= 180 ? 1.25 : 1
  const score = (daysSinceTouch / cadence) * ageFactor
  const level: EscalationLevel = score < 0.8 ? 'ok' : score < 1 ? 'due' : score < 2 ? 'overdue' : 'escalated'
  const nextDueMs = touch ? touch.d.getTime() + cadence * DAY : now
  return {
    ...base,
    level,
    score: Math.round(score * 100) / 100,
    daysSinceTouch: touch ? daysSinceTouch : null,
    nextDue: new Date(nextDueMs).toISOString(),
    daysUntilDue: Math.ceil((nextDueMs - now) / DAY),
  }
}

export const needsFollowUp = (e: Escalation) => e.level === 'overdue' || e.level === 'escalated'
