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

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        actionItems: {
          include: {
            assignedTo: { select: { id: true, name: true } },
            job: { select: { jobCode: true, jobName: true } },
            lead: { select: { opportunityTitle: true } },
          },
          orderBy: { priority: 'asc' },
        },
      },
    })

    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

    // KPI scoreboard
    const users = await prisma.user.findMany({ select: { id: true, name: true } })
    const scoreboard = []
    for (const user of users) {
      const open = await prisma.actionItem.count({ where: { assignedToId: user.id, status: 'open' } })
      const completed = await prisma.actionItem.count({ where: { assignedToId: user.id, status: 'complete' } })
      const overdue = await prisma.actionItem.count({
        where: { assignedToId: user.id, status: 'open', dueDate: { lt: new Date() } },
      })
      if (open > 0 || completed > 0) {
        scoreboard.push({ userId: user.id, name: user.name, open, completed, overdue })
      }
    }

    return NextResponse.json({
      ...meeting,
      meetingDate: meeting.meetingDate?.toISOString(),
      createdAt: meeting.createdAt?.toISOString(),
      updatedAt: meeting.updatedAt?.toISOString(),
      actionItems: (meeting.actionItems ?? []).map((a: any) => ({
        ...a,
        dueDate: a.dueDate?.toISOString() ?? null,
        createdAt: a.createdAt?.toISOString(),
        updatedAt: a.updatedAt?.toISOString(),
      })),
      scoreboard,
    })
  } catch (error: any) {
    console.error('Meeting detail error:', error)
    return NextResponse.json({ error: 'Failed to load meeting' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const body = await request.json()
    const { notes, status } = body ?? {}

    const data: any = {}
    if (notes !== undefined) data.notes = notes
    if (status !== undefined) data.status = status

    const meeting = await prisma.meeting.update({ where: { id }, data })
    return NextResponse.json(meeting)
  } catch (error: any) {
    console.error('Update meeting error:', error)
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 })
  }
}
