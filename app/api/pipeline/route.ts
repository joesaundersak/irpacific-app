export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isOpenLead } from '@/lib/schedule-rules'
import { leadMissingInfo } from '@/lib/missing-info'
import { parseFilters, leadWhere, leadMatches, leadConfidencePct } from '@/lib/shared-filters'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const filters = parseFilters(url.searchParams)
    const staleOnly = url.searchParams.get('stale') === 'true'
    const status = url.searchParams.get('status') ?? undefined
    const noPmOnly = url.searchParams.get('noPm') === 'true'
    const missingOnly = url.searchParams.get('missingInfo') === 'true'

    const where: any = { ...leadWhere(filters) }
    if (noPmOnly) where.salespersonId = null
    if (staleOnly) where.isStale = true
    if (status) where.proposalStatus = { contains: status }

    const allLeads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        salesperson: { select: { id: true, name: true } },
        linkedJob: { select: { id: true, jobCode: true, jobName: true } },
      },
    })
    // Shared filters: minimum confidence % and install/product type (same rules as the Forecast)
    const leads = allLeads.filter((l: any) => leadMatches(l, filters))

    const noPm = (l: any) => !l.salespersonId && isOpenLead(l)
    const missingInfo = (l: any) => (isOpenLead(l) ? leadMissingInfo(l) : [])
    const shown = leads.filter((l: any) => (!noPmOnly || noPm(l)) && (!missingOnly || missingInfo(l).length > 0))
    const totalWeighted = leads.reduce((s: number, l: any) => s + (l.weightedValue ?? 0), 0)
    const avgConfidence = leads.length > 0
      ? leads.reduce((s: number, l: any) => s + leadConfidencePct(l) / 100, 0) / leads.length
      : 0

    return NextResponse.json({
      leads: shown.map((l: any) => ({
        ...l,
        noPm: noPm(l),
        missingInfo: missingInfo(l),
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
        missingInfoCount: leads.filter((l: any) => missingInfo(l).length > 0).length,
      },
    })
  } catch (error: any) {
    console.error('Pipeline error:', error)
    return NextResponse.json({ error: 'Failed to load pipeline' }, { status: 500 })
  }
}
