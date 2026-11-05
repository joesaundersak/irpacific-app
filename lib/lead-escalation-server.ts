import { prisma } from '@/lib/db'
import { isOpenLead } from '@/lib/schedule-rules'
import { computeEscalation, type Escalation } from '@/lib/lead-escalation'

interface LeadLike {
  id: string
  leadStatus?: string | null
  linkedJobId?: string | null
  soldDate?: Date | null
  createdDate?: Date | null
  createdAt?: Date | null
  lastContacted?: Date | null
}

/** Computes follow-up escalation for each lead (keyed by lead id). */
export async function loadEscalations(leads: LeadLike[]): Promise<Record<string, Escalation>> {
  const ids = leads.map(l => l.id)
  const out: Record<string, Escalation> = {}
  if (!ids.length) return out

  const [cfg, followUps, items] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: 'stale_lead_days' } }),
    prisma.leadFollowUp.findMany({ where: { leadId: { in: ids } }, select: { leadId: true, cadenceDays: true } }),
    // Follow-up activity: manual action items created on the lead, or any lead item completed
    prisma.actionItem.findMany({
      where: { leadId: { in: ids }, OR: [{ source: 'manual' }, { status: 'complete' }] },
      select: { leadId: true, createdAt: true, updatedAt: true, status: true },
    }),
  ])
  const defaultDays = Math.max(1, parseInt(cfg?.value ?? '30', 10) || 30)
  const cadence = new Map(followUps.map(f => [f.leadId, f.cadenceDays]))
  const lastAction = new Map<string, Date>()
  for (const it of items) {
    if (!it.leadId) continue
    const d = it.status === 'complete' && it.updatedAt > it.createdAt ? it.updatedAt : it.createdAt
    const prev = lastAction.get(it.leadId)
    if (!prev || d > prev) lastAction.set(it.leadId, d)
  }

  for (const l of leads) {
    out[l.id] = computeEscalation({
      open: isOpenLead(l),
      createdDate: l.createdDate ?? l.createdAt ?? null,
      lastContacted: l.lastContacted ?? null,
      lastActionAt: lastAction.get(l.id) ?? null,
      cadenceDays: cadence.get(l.id) ?? null,
      defaultDays,
    })
  }
  return out
}
