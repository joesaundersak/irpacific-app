export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isOpenLead } from '@/lib/schedule-rules'
import { safeSyncFlags } from '@/lib/flags'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const salespersonId = url.searchParams.get('salesperson') ?? undefined
    const staleOnly = url.searchParams.get('stale') === 'true'
    const status = url.searchParams.get('status') ?? undefined
    const noPmOnly = url.searchParams.get('noPm') === 'true'

    const where: any = {}
    if (salespersonId) where.salespersonId = salespersonId
    if (noPmOnly) where.salespersonId = null
    if (staleOnly) where.isStale = true
    if (status) where.proposalStatus = { contains: status }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        salesperson: { select: { id: true, name: true } },
        linkedJob: { select: { id: true, jobCode: true, jobName: true } },
      },
    })

    const noPm = (l: any) => !l.salespersonId && isOpenLead(l)
    const shown = noPmOnly ? leads.filter(noPm) : leads
    const totalWeighted = leads.reduce((s: number, l: any) => s + (l.weightedValue ?? 0), 0)
    const avgConfidence = leads.length > 0
      ? leads.reduce((s: number, l: any) => s + (l.confidence ?? 0), 0) / leads.length
      : 0

    return NextResponse.json({
      leads: shown.map((l: any) => ({
        ...l,
        noPm: noPm(l),
        createdAt: l.createdAt?.toISOString(),
        updatedAt: l.updatedAt?.toISOString(),
        createdDate: l.createdDate?.toISOString() ?? null,
        lastContacted: l.lastContacted?.toISOString() ?? null,
        lastActivityDate: l.lastActivityDate?.toISOString() ?? null,
        soldDate: l.soldDate?.toISOString() ?? null,
        projectedSalesDate: l.projectedSalesDate?.toISOString() ?? null,
        projectStart: l.projectStart?.toISOString() ?? null,
        substantialCompletion: l.substantialCompletion?.toISOString() ?? null,
      })),
      summary: {
        totalLeads: leads.length,
        weightedPipeline: totalWeighted,
        avgConfidence,
        staleCount: leads.filter((l: any) => l.isStale).length,
        noPmCount: leads.filter(noPm).length,
      },
    })
  } catch (error: any) {
    console.error('Pipeline error:', error)
    return NextResponse.json({ error: 'Failed to load pipeline' }, { status: 500 })
  }
}

/** Assign a PM to a lead (Admin / Office Manager). */
export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = session.user.role
    if (role !== 'Admin' && role !== 'Office Manager') {
      return NextResponse.json({ error: 'Only Admin or Office Manager can assign project managers' }, { status: 403 })
    }
    const { id, salespersonId } = (await request.json()) ?? {}
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.lead.update({ where: { id }, data: { salespersonId: salespersonId || null } })
    await safeSyncFlags()
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Lead update error:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}
