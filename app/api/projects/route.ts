export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { evaluateSchedule, isActiveJob } from '@/lib/schedule-rules'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const pmId = url.searchParams.get('pm') ?? undefined
    const state = url.searchParams.get('state') ?? undefined
    const status = url.searchParams.get('status') ?? undefined
    const flag = url.searchParams.get('flag') ?? undefined // missing_schedule | no_pm | any
    const activeOnly = url.searchParams.get('active') === 'true'

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
        milestones: { select: { phase: true, title: true, startDate: true, endDate: true } },
      },
    })

    const enriched = jobs.map((j: any) => {
      const active = isActiveJob(j)
      const ev = evaluateSchedule(j, j.milestones)
      const flags: string[] = []
      if (active && !ev.complete) flags.push('missing_schedule')
      if (active && !j.projectManagerId) flags.push('no_pm')
      return { j, active, ev, flags }
    }).filter(({ active, flags }) => {
      if (activeOnly && !active) return false
      if (flag === 'any') return flags.length > 0
      if (flag) return flags.includes(flag)
      return true
    })

    return NextResponse.json({
      flagCounts: {
        missingSchedule: enriched.filter(e => e.flags.includes('missing_schedule')).length,
        noPm: enriched.filter(e => e.flags.includes('no_pm')).length,
      },
      jobs: enriched.map(({ j, active, ev, flags }) => {
        const { milestones: _m, ...rest } = j
        const margin = j.totalRevisedPrice > 0
          ? ((j.totalRevisedPrice - j.actualCosts) / j.totalRevisedPrice) * 100
          : j.projectedProfitPct
        return {
          ...rest,
          isActive: active,
          scheduleKind: ev.type,
          missingPhases: ev.missing,
          totalPhases: ev.phases.length,
          flags,
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
