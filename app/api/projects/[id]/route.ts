export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const targetMarginConfig = await prisma.systemConfig.findUnique({ where: { key: 'target_margin' } })
    const targetMargin = parseFloat(targetMarginConfig?.value ?? '25')

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        projectManager: { select: { id: true, name: true } },
        milestones: { orderBy: { startDate: 'asc' } },
        apEntries: { orderBy: { dueDate: 'asc' } },
        actionItems: {
          where: { status: 'open' },
          include: { assignedTo: { select: { name: true } } },
        },
        leadLinks: { select: { id: true, opportunityTitle: true } },
      },
    })

    if (!job) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const margin = job.totalRevisedPrice > 0
      ? ((job.totalRevisedPrice - job.actualCosts) / job.totalRevisedPrice) * 100
      : job.projectedProfitPct

    const serialized = {
      ...job,
      computedMargin: margin,
      marginHealth: margin >= targetMargin ? 'green' : margin >= 15 ? 'yellow' : 'red',
      targetMargin,
      createdAt: job.createdAt?.toISOString(),
      updatedAt: job.updatedAt?.toISOString(),
      actualStart: job.actualStart?.toISOString() ?? null,
      actualCompletion: job.actualCompletion?.toISOString() ?? null,
      projectedStart: job.projectedStart?.toISOString() ?? null,
      projectedCompletion: job.projectedCompletion?.toISOString() ?? null,
      createdDate: job.createdDate?.toISOString() ?? null,
      milestones: (job.milestones ?? []).map((m: any) => ({
        ...m,
        startDate: m.startDate?.toISOString() ?? null,
        endDate: m.endDate?.toISOString() ?? null,
        createdAt: m.createdAt?.toISOString(),
        updatedAt: m.updatedAt?.toISOString(),
      })),
      apEntries: (job.apEntries ?? []).map((a: any) => ({
        ...a,
        dueDate: a.dueDate?.toISOString() ?? null,
        createdAt: a.createdAt?.toISOString(),
        updatedAt: a.updatedAt?.toISOString(),
      })),
      actionItems: (job.actionItems ?? []).map((a: any) => ({
        ...a,
        dueDate: a.dueDate?.toISOString() ?? null,
        createdAt: a.createdAt?.toISOString(),
        updatedAt: a.updatedAt?.toISOString(),
      })),
    }

    return NextResponse.json(serialized)
  } catch (error: any) {
    console.error('Project detail error:', error)
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 })
  }
}
