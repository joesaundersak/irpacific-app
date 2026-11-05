export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const targetMarginConfig = await prisma.systemConfig.findUnique({ where: { key: 'target_margin' } })
    const targetMargin = parseFloat(targetMarginConfig?.value ?? '25')

    // Weighted pipeline
    const leads = await prisma.lead.findMany({
      where: { leadStatus: { not: 'Closed' } },
      select: { weightedValue: true, isStale: true, salespersonId: true },
    })
    const weightedPipeline = leads.reduce((sum: number, l: any) => sum + (l.weightedValue ?? 0), 0)
    const staleLeads = leads.filter((l: any) => l.isStale).length

    // Active projects
    const activeJobs = await prisma.job.count({ where: { status: 'OPEN' } })

    // At-risk jobs
    const allJobs = await prisma.job.findMany({
      where: { status: 'OPEN' },
      select: {
        id: true, jobCode: true, jobName: true, projectManagerId: true,
        totalRevisedPrice: true, actualCosts: true, projectedProfitPct: true,
        percentComplete: true, projectedCompletion: true,
        projectManager: { select: { name: true } },
      },
    })

    const atRiskJobs = allJobs.filter((j: any) => {
      const margin = j.totalRevisedPrice > 0
        ? ((j.totalRevisedPrice - j.actualCosts) / j.totalRevisedPrice) * 100
        : j.projectedProfitPct
      return margin < targetMargin && j.actualCosts > 0
    })

    // Action items by person
    const openActions = await prisma.actionItem.groupBy({
      by: ['assignedToId'],
      where: { status: 'open' },
      _count: true,
    })

    const users = await prisma.user.findMany({
      where: { id: { in: openActions.map((a: any) => a.assignedToId).filter(Boolean) as string[] } },
      select: { id: true, name: true },
    })
    const userNameMap: Record<string, string> = {}
    users.forEach((u: any) => { userNameMap[u.id] = u.name })

    const actionsByPerson = openActions
      .filter((a: any) => a.assignedToId)
      .map((a: any) => ({
        name: userNameMap[a.assignedToId] ?? 'Unassigned',
        count: a._count,
      }))

    // Recent imports
    const recentImports = await prisma.importHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { importedBy: { select: { name: true } } },
    })

    // Top 5 at-risk by margin
    const top5AtRisk = atRiskJobs
      .map((j: any) => {
        const margin = j.totalRevisedPrice > 0
          ? ((j.totalRevisedPrice - j.actualCosts) / j.totalRevisedPrice) * 100
          : j.projectedProfitPct
        return { ...j, margin }
      })
      .sort((a: any, b: any) => a.margin - b.margin)
      .slice(0, 5)

    // Next 5 upcoming milestones
    const upcomingMilestones = await prisma.milestone.findMany({
      where: {
        isComplete: false,
        endDate: { gte: new Date() },
      },
      orderBy: { endDate: 'asc' },
      take: 5,
      include: {
        job: { select: { jobCode: true, jobName: true } },
      },
    })

    const [missingScheduleCount, noPmCount] = await Promise.all([
      prisma.actionItem.count({ where: { source: 'auto-flag', category: 'missing_schedule', status: { not: 'complete' } } }),
      prisma.actionItem.count({ where: { source: 'auto-flag', category: 'no_pm', status: { not: 'complete' } } }),
    ])

    return NextResponse.json({
      missingScheduleCount,
      noPmCount,
      weightedPipeline,
      activeProjects: activeJobs,
      atRiskCount: atRiskJobs.length,
      staleLeads,
      actionsByPerson,
      recentImports: recentImports.map((i: any) => ({
        id: i.id,
        fileName: i.fileName,
        fileType: i.fileType,
        recordsProcessed: i.recordsProcessed,
        importedBy: i.importedBy?.name ?? 'Unknown',
        createdAt: i.createdAt.toISOString(),
      })),
      top5AtRisk: top5AtRisk.map((j: any) => ({
        id: j.id,
        jobCode: j.jobCode,
        jobName: j.jobName,
        pm: j.projectManager?.name ?? 'Unassigned',
        margin: j.margin,
      })),
      upcomingMilestones: upcomingMilestones.map((m: any) => ({
        id: m.id,
        title: m.title,
        phase: m.phase,
        endDate: m.endDate?.toISOString(),
        jobCode: m.job?.jobCode,
        jobName: m.job?.jobName,
      })),
      targetMargin,
    })
  } catch (error: any) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
