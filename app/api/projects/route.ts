export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const pmId = url.searchParams.get('pm') ?? undefined
    const state = url.searchParams.get('state') ?? undefined
    const status = url.searchParams.get('status') ?? undefined

    const where: any = {}
    if (pmId) where.projectManagerId = pmId
    if (state) where.state = state.toUpperCase()
    if (status) where.status = status

    const targetMarginConfig = await prisma.systemConfig.findUnique({ where: { key: 'target_margin' } })
    const targetMargin = parseFloat(targetMarginConfig?.value ?? '25')

    const jobs = await prisma.job.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        projectManager: { select: { id: true, name: true } },
        _count: { select: { milestones: true, apEntries: true } },
      },
    })

    return NextResponse.json({
      jobs: jobs.map((j: any) => {
        const margin = j.totalRevisedPrice > 0
          ? ((j.totalRevisedPrice - j.actualCosts) / j.totalRevisedPrice) * 100
          : j.projectedProfitPct
        return {
          ...j,
          computedMargin: margin,
          marginHealth: margin >= targetMargin ? 'green' : margin >= 15 ? 'yellow' : 'red',
          createdAt: j.createdAt?.toISOString(),
          updatedAt: j.updatedAt?.toISOString(),
          actualStart: j.actualStart?.toISOString() ?? null,
          actualCompletion: j.actualCompletion?.toISOString() ?? null,
          projectedStart: j.projectedStart?.toISOString() ?? null,
          projectedCompletion: j.projectedCompletion?.toISOString() ?? null,
          createdDate: j.createdDate?.toISOString() ?? null,
        }
      }),
      targetMargin,
    })
  } catch (error: any) {
    console.error('Projects error:', error)
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 })
  }
}
