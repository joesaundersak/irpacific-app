export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/access-server'
import { prisma } from '@/lib/db'
import { isActiveJob, classifyJob } from '@/lib/schedule-rules'

const r2 = (n: number) => Math.round(n * 100) / 100

/*
 * PO readiness per job, from the BuilderTrend Purchase Orders import (read-only).
 * none     = no live (non-voided) POs yet
 * drafts   = has Draft / Recalled POs that are not paid -> still need to be released to the vendor
 * awaiting = released (Sent) but the vendor has not approved yet
 * complete = every live PO is Approved, Assigned Internally, or a paid Draft (receipt-style PO)
 */
type PoReadiness = 'none' | 'drafts' | 'awaiting' | 'complete'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!user.access.purchaseOrders) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const [jobs, pos, lastImport] = await Promise.all([
      prisma.job.findMany({
        select: {
          id: true, jobCode: true, jobName: true, state: true, status: true, groups: true, jobType: true, scheduleType: true,
          actualCompletion: true, percentComplete: true, projectManagerId: true, projectManagerName: true,
          revisedBudget: true, originalBudget: true, projectedCosts: true, projectedStart: true, actualStart: true,
          projectManager: { select: { id: true, name: true } },
          leadLinks: { select: { salespersonName: true, salesperson: { select: { name: true } } }, take: 1 },
        },
      }),
      prisma.purchaseOrder.findMany({ orderBy: [{ createdDate: 'desc' }] }),
      prisma.importHistory.findFirst({ where: { fileType: 'purchase_orders' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }).catch(() => null),
    ])

    const posByCode = new Map<string, typeof pos>()
    for (const po of pos) {
      if (!posByCode.has(po.jobCode)) posByCode.set(po.jobCode, [])
      posByCode.get(po.jobCode)!.push(po)
    }

    const rows = jobs.map(j => {
      const list = posByCode.get(j.jobCode) ?? []
      const live = list.filter(p => p.statusGroup !== 'voided')
      const paidDraft = (p: (typeof list)[number]) => /fully paid/i.test(p.paidStatus ?? '')
      const isOpenDraft = (p: (typeof list)[number]) => ['draft', 'recalled', 'other'].includes(p.statusGroup) && !paidDraft(p)
      const drafts = live.filter(isOpenDraft).length
      const sent = live.filter(p => p.statusGroup === 'sent').length
      const approved = live.filter(p => p.statusGroup === 'approved' || p.statusGroup === 'internal').length
      const paidDrafts = live.filter(p => ['draft', 'recalled', 'other'].includes(p.statusGroup) && paidDraft(p)).length
      const voided = list.length - live.length
      const readiness: PoReadiness = live.length === 0 ? 'none' : drafts > 0 ? 'drafts' : sent > 0 ? 'awaiting' : 'complete'
      const poTotal = live.reduce((s, p) => s + p.cost, 0)
      const budget = j.revisedBudget || j.originalBudget || j.projectedCosts || 0
      const lead = j.leadLinks[0]
      return {
        id: j.id, jobCode: j.jobCode, jobName: j.jobName, state: j.state,
        active: isActiveJob(j), type: classifyJob(j),
        pmName: j.projectManager?.name ?? j.projectManagerName ?? null,
        salesperson: lead?.salesperson?.name ?? lead?.salespersonName ?? null,
        start: (j.actualStart ?? j.projectedStart)?.toISOString() ?? null,
        percentComplete: j.percentComplete,
        readiness, total: list.length, live: live.length, drafts, sent, approved, paidDrafts, voided,
        poTotal: r2(poTotal), budget: r2(budget), coverage: budget > 0 ? Math.round((poTotal / budget) * 100) : null,
        pos: list.map(p => ({
          id: p.id, poNumber: p.poNumber, title: p.title, poStatus: p.poStatus, statusGroup: p.statusGroup, workStatus: p.workStatus,
          performedBy: p.performedBy, createdDate: p.createdDate?.toISOString() ?? null, cost: r2(p.cost), paidStatus: p.paidStatus,
          costCode: p.costCode, varianceCode: p.varianceCode, estComplete: p.estComplete?.toISOString() ?? null,
        })),
      }
    }).filter(r => r.active || r.total > 0)

    const linkedCodes = new Set(jobs.map(j => j.jobCode))
    const unlinkedPos = pos.filter(p => !linkedCodes.has(p.jobCode)).length

    return NextResponse.json({ rows, poCount: pos.length, unlinkedPos, asOf: lastImport?.createdAt?.toISOString() ?? null })
  } catch (error) {
    console.error('Purchase orders error:', error)
    return NextResponse.json({ error: 'Failed to load purchase orders' }, { status: 500 })
  }
}
