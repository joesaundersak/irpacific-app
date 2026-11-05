export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { safeSyncFlags, FLAG_SOURCE } from '@/lib/flags'
import { loadEscalations } from '@/lib/lead-escalation-server'
import { needsFollowUp, cadenceLabel } from '@/lib/lead-escalation'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const meetings = await prisma.meeting.findMany({
      orderBy: { meetingDate: 'desc' },
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { actionItems: true } },
      },
    })

    return NextResponse.json({
      meetings: meetings.map((m: any) => ({
        ...m,
        meetingDate: m.meetingDate?.toISOString(),
        createdAt: m.createdAt?.toISOString(),
        updatedAt: m.updatedAt?.toISOString(),
      })),
    })
  } catch (error: any) {
    console.error('Meetings error:', error)
    return NextResponse.json({ error: 'Failed to load meetings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { title, meetingDate, meetingType, notes } = body ?? {}

    const meeting = await prisma.meeting.create({
      data: {
        title: title ?? 'Weekly Meeting',
        meetingDate: meetingDate ? new Date(meetingDate) : new Date(),
        meetingType: meetingType ?? 'weekly',
        notes: notes ?? null,
        createdById: session.user.id,
      },
    })

    // Auto-carry incomplete action items from the last meeting
    const lastMeeting = await prisma.meeting.findFirst({
      where: { id: { not: meeting.id } },
      orderBy: { meetingDate: 'desc' },
    })
    if (lastMeeting) {
      const carryover = await prisma.actionItem.findMany({
        where: { meetingId: lastMeeting.id, status: { not: 'complete' } },
      })
      for (const item of carryover) {
        await prisma.actionItem.update({
          where: { id: item.id },
          data: { meetingId: meeting.id },
        })
      }
    }

    // Auto-generate action items from system alerts
    await generateAutoActionItems(meeting.id)

    // Accountability flags (missing schedule / no PM): refresh and put all open ones on this meeting's agenda
    await safeSyncFlags()
    await prisma.actionItem.updateMany({
      where: { source: FLAG_SOURCE, status: { not: 'complete' }, meetingId: null },
      data: { meetingId: meeting.id },
    })
    // Manually added items waiting for "the next meeting" (e.g. from the pipeline or project pages)
    await prisma.actionItem.updateMany({
      where: { source: 'manual', status: { not: 'complete' }, meetingId: null },
      data: { meetingId: meeting.id },
    })

    return NextResponse.json({ id: meeting.id })
  } catch (error: any) {
    console.error('Create meeting error:', error)
    return NextResponse.json({ error: `Failed to create meeting: ${error?.message ?? 'unknown error'}` }, { status: 500 })
  }
}

async function generateAutoActionItems(meetingId: string) {
  const targetMarginConfig = await prisma.systemConfig.findUnique({ where: { key: 'target_margin' } })
  const targetMargin = parseFloat(targetMarginConfig?.value ?? '25')

  // 1. Lead follow-ups overdue (uses each lead's follow-up timeline + last action item activity)
  const openLeads = await prisma.lead.findMany({ where: { leadStatus: { not: 'Closed' } } })
  const esc = await loadEscalations(openLeads)
  const staleLeads = openLeads.filter((l: any) => needsFollowUp(esc[l.id]))
  for (const lead of staleLeads) {
    const e = esc[lead.id]
    const desc = `Follow up on lead: ${lead.opportunityTitle} (${e.daysSinceTouch ?? '?'} days since last touch; timeline ${cadenceLabel(e.cadenceDays).toLowerCase()})`
    const existing = await prisma.actionItem.findFirst({ where: { description: desc, status: 'open', meetingId } })
    if (!existing) {
      await prisma.actionItem.create({
        data: {
          description: desc,
          assignedToId: lead.salespersonId,
          category: 'stale_lead',
          source: 'auto',
          meetingId,
          leadId: lead.id,
          priority: e.level === 'escalated' ? 'high' : 'medium',
        },
      })
    }
  }

  // 2. Margin alerts
  const atRiskJobs = await prisma.job.findMany({
    where: { status: 'OPEN' },
    include: { projectManager: true },
  })
  for (const job of atRiskJobs) {
    const margin = job.totalRevisedPrice > 0
      ? ((job.totalRevisedPrice - job.actualCosts) / job.totalRevisedPrice) * 100
      : job.projectedProfitPct
    if (margin < targetMargin && job.actualCosts > 0) {
      const desc = `Review at-risk margin on ${job.jobCode}: ${margin.toFixed(1)}% (target: ${targetMargin}%)`
      const existing = await prisma.actionItem.findFirst({ where: { description: { startsWith: `Review at-risk margin on ${job.jobCode}` }, status: 'open', meetingId } })
      if (!existing) {
        await prisma.actionItem.create({
          data: {
            description: desc,
            assignedToId: job.projectManagerId,
            category: 'margin_alert',
            source: 'auto',
            meetingId,
            jobId: job.id,
            priority: 'high',
          },
        })
      }
    }
  }

  // 3. Overdue milestones
  const overdue = await prisma.milestone.findMany({
    where: {
      isComplete: false,
      endDate: { lt: new Date() },
    },
    include: { job: { include: { projectManager: true } } },
  })
  for (const ms of overdue) {
    const desc = `Overdue milestone: ${ms.title} on ${ms.job?.jobCode ?? 'Unknown'}`
    const existing = await prisma.actionItem.findFirst({ where: { description: desc, status: 'open', meetingId } })
    if (!existing) {
      await prisma.actionItem.create({
        data: {
          description: desc,
          assignedToId: ms.job?.projectManagerId,
          category: 'overdue_milestone',
          source: 'auto',
          meetingId,
          jobId: ms.job?.id,
          priority: 'high',
        },
      })
    }
  }
}
