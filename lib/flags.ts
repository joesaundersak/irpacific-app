/* Accountability flags: missing schedule phases and missing PM become (and auto-resolve) action items. */
import { prisma } from '@/lib/db'
import { evaluateSchedule, isActiveJob, isOpenLead } from '@/lib/schedule-rules'
import { jobMissingInfo, leadMissingInfo, JOB_INFO_FIELDS, LEAD_INFO_FIELDS } from '@/lib/missing-info'

export const FLAG_SOURCE = 'auto-flag'
export const FLAG_CATEGORIES = ['missing_schedule', 'no_pm', 'missing_info']

interface Desired { key: string; description: string; assignedToId: string | null; category: string; jobId?: string; leadId?: string; priority: string }

async function findAdminId(): Promise<string | null> {
  const admins = await prisma.user.findMany({
    where: { role: { name: 'Admin' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  })
  const real = admins.find((a: any) => !a.email.endsWith('@example.com'))
  return (real ?? admins[0])?.id ?? null
}

export async function syncAccountabilityFlags(): Promise<{ created: number; resolved: number; updated: number }> {
  const adminId = await findAdminId()
  const desired: Desired[] = []

  const jobs = await prisma.job.findMany({
    where: { status: 'OPEN' },
    select: {
      id: true, jobName: true, status: true, actualCompletion: true, percentComplete: true, groups: true,
      jobType: true, scheduleType: true, projectManagerId: true, projectManagerName: true, ...JOB_INFO_FIELDS,
      milestones: { select: { phase: true, title: true, startDate: true, endDate: true } },
    },
  })
  for (const job of jobs) {
    if (!isActiveJob(job)) continue
    const label = `${job.jobCode} - ${job.jobName}`
    const ev = evaluateSchedule(job, job.milestones)
    if (ev.missing.length > 0) {
      desired.push({
        key: `missing_schedule:job:${job.id}`, category: 'missing_schedule', jobId: job.id, priority: 'high',
        assignedToId: job.projectManagerId ?? adminId,
        description: ev.hasSchedule
          ? `Complete schedule for ${label}: add dates for ${ev.missing.join(', ')}`
          : `No schedule for ${label}: enter dates for ${ev.missing.join(', ')}`,
      })
    }
    if (!job.projectManagerId) {
      desired.push({
        key: `no_pm:job:${job.id}`, category: 'no_pm', jobId: job.id, priority: 'high', assignedToId: adminId,
        description: job.projectManagerName
          ? `Assign a project manager to ${label} (BuilderTrend lists "${job.projectManagerName}", who has no app login)`
          : `Assign a project manager to ${label}`,
      })
    }
    const info = jobMissingInfo(job)
    if (info.length > 0) {
      desired.push({
        key: `missing_info:job:${job.id}`, category: 'missing_info', jobId: job.id, priority: 'medium',
        assignedToId: job.projectManagerId ?? adminId,
        description: `Update ${label} in BuilderTrend: missing ${info.join(', ')}`,
      })
    }
  }

  const leads = await prisma.lead.findMany({
    select: { id: true, leadStatus: true, linkedJobId: true, soldDate: true, salespersonId: true, salespersonName: true, ...LEAD_INFO_FIELDS },
  })
  for (const lead of leads) {
    if (!isOpenLead(lead)) continue
    const info = leadMissingInfo(lead)
    if (info.length > 0) {
      desired.push({
        key: `missing_info:lead:${lead.id}`, category: 'missing_info', leadId: lead.id, priority: 'low',
        assignedToId: lead.salespersonId ?? adminId,
        description: `Update lead "${lead.opportunityTitle}" in BuilderTrend: missing ${info.join(', ')}`,
      })
    }
    if (lead.salespersonId) continue
    desired.push({
      key: `no_pm:lead:${lead.id}`, category: 'no_pm', leadId: lead.id, priority: 'medium', assignedToId: adminId,
      description: lead.salespersonName
        ? `Assign a project manager to lead: ${lead.opportunityTitle} (BuilderTrend lists "${lead.salespersonName}", who has no app login)`
        : `Assign a project manager to lead: ${lead.opportunityTitle}`,
    })
  }

  // Older imports created one-off "missing contact" items; missing_info flags now cover them and auto-resolve
  await prisma.actionItem.updateMany({
    where: { source: 'import', category: 'missing_contact', status: { not: 'complete' } },
    data: { status: 'complete' },
  })

  const existing = await prisma.actionItem.findMany({
    where: { source: FLAG_SOURCE, category: { in: FLAG_CATEGORIES }, status: { not: 'complete' } },
    select: { id: true, category: true, jobId: true, leadId: true, description: true, assignedToId: true },
  })
  const existingByKey = new Map<string, any>()
  for (const e of existing) {
    const key = e.jobId ? `${e.category}:job:${e.jobId}` : `${e.category}:lead:${e.leadId}`
    if (existingByKey.has(key)) { await prisma.actionItem.update({ where: { id: e.id }, data: { status: 'complete' } }); continue }
    existingByKey.set(key, e)
  }

  let created = 0, resolved = 0, updated = 0
  const desiredKeys = new Set(desired.map(d => d.key))
  for (const [key, e] of existingByKey) {
    if (!desiredKeys.has(key)) {
      await prisma.actionItem.update({ where: { id: e.id }, data: { status: 'complete' } })
      resolved++
    }
  }
  const toCreate: any[] = []
  for (const d of desired) {
    const e = existingByKey.get(d.key)
    if (!e) {
      toCreate.push({ description: d.description, assignedToId: d.assignedToId, category: d.category, source: FLAG_SOURCE, jobId: d.jobId ?? null, leadId: d.leadId ?? null, priority: d.priority })
    } else if (e.description !== d.description || e.assignedToId !== d.assignedToId) {
      await prisma.actionItem.update({ where: { id: e.id }, data: { description: d.description, assignedToId: d.assignedToId } })
      updated++
    }
  }
  if (toCreate.length) { await prisma.actionItem.createMany({ data: toCreate }); created = toCreate.length }
  return { created, resolved, updated }
}

/** Never let flag syncing break the request that triggered it. */
export async function safeSyncFlags() {
  try { return await syncAccountabilityFlags() } catch (e) { console.error('Flag sync failed:', e); return null }
}
