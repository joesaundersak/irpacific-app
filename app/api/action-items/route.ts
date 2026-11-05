export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const assignedTo = url.searchParams.get('assignedTo') ?? undefined
    const status = url.searchParams.get('status') ?? undefined
    const meetingId = url.searchParams.get('meetingId') ?? undefined

    const where: any = {}
    if (assignedTo) where.assignedToId = assignedTo
    if (status === 'open') where.status = { not: 'complete' }
    else if (status) where.status = status
    if (meetingId) where.meetingId = meetingId
    if (url.searchParams.get('unassigned') === 'true') where.assignedToId = null

    const items = await prisma.actionItem.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      include: {
        assignedTo: { select: { id: true, name: true } },
        job: { select: { id: true, jobCode: true, jobName: true } },
        lead: { select: { id: true, opportunityTitle: true } },
        meeting: { select: { id: true, title: true, meetingDate: true } },
      },
    })

    return NextResponse.json({
      items: items.map((i: any) => ({
        ...i,
        meeting: i.meeting ? { ...i.meeting, meetingDate: i.meeting.meetingDate?.toISOString() ?? null } : null,
        dueDate: i.dueDate?.toISOString() ?? null,
        createdAt: i.createdAt?.toISOString(),
        updatedAt: i.updatedAt?.toISOString(),
      })),
    })
  } catch (error: any) {
    console.error('Action items error:', error)
    return NextResponse.json({ error: 'Failed to load action items' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { description, assignedToId, dueDate, priority, meetingId, jobId, leadId, category, nextMeeting, committed } = body ?? {}

    if (!description) return NextResponse.json({ error: 'Description required' }, { status: 400 })

    // "Add to next meeting": attach to the next upcoming meeting, or leave unattached so the next new meeting picks it up
    let targetMeeting: { id: string; title: string } | null = null
    if (!meetingId && nextMeeting) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      targetMeeting = await prisma.meeting.findFirst({
        where: { meetingDate: { gte: today }, status: { not: 'completed' } },
        orderBy: { meetingDate: 'asc' },
        select: { id: true, title: true },
      })
    }

    const item = await prisma.actionItem.create({
      data: {
        description,
        assignedToId: assignedToId || null,
        createdById: session.user.id,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority ?? 'medium',
        meetingId: meetingId ?? targetMeeting?.id ?? null,
        jobId: jobId ?? null,
        leadId: leadId ?? null,
        category: category ?? 'manual',
        source: 'manual',
        committed: committed === true,
      },
    })

    return NextResponse.json({ ...item, meetingTitle: targetMeeting?.title ?? null })
  } catch (error: any) {
    console.error('Create action item error:', error)
    return NextResponse.json({ error: 'Failed to create action item' }, { status: 500 })
  }
}

const STATUSES = ['open', 'in_progress', 'complete']
const PRIORITIES = ['high', 'medium', 'low']

/** Turn a client patch into validated update data. Returns an error string for bad values. */
async function buildUpdate(body: any): Promise<{ data: any } | { error: string }> {
  const { status, description, dueDate, priority, assignedToId, meetingId, committed } = body ?? {}
  const data: any = {}
  if (committed !== undefined) data.committed = committed === true
  if (status !== undefined) {
    if (!STATUSES.includes(status)) return { error: 'Invalid status' }
    data.status = status
    data.dismissed = status === 'complete' // a person closed it: auto-flag sync won't recreate it
  }
  if (description !== undefined) data.description = description
  if (dueDate !== undefined) {
    if (dueDate && isNaN(new Date(dueDate).getTime())) return { error: 'Invalid due date' }
    data.dueDate = dueDate ? new Date(dueDate) : null
  }
  if (priority !== undefined) {
    if (!PRIORITIES.includes(priority)) return { error: 'Invalid priority' }
    data.priority = priority
  }
  if (assignedToId !== undefined) {
    if (assignedToId && !(await prisma.user.findUnique({ where: { id: assignedToId }, select: { id: true } }))) return { error: 'Unknown user' }
    data.assignedToId = assignedToId || null
    data.assigneeLocked = true // keep this person even when auto-flag sync runs
  }
  if (meetingId !== undefined) {
    if (meetingId && !(await prisma.meeting.findUnique({ where: { id: meetingId }, select: { id: true } }))) return { error: 'Unknown meeting' }
    data.meetingId = meetingId || null
  }
  return { data }
}

export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const built = await buildUpdate(body)
    if ('error' in built) return NextResponse.json({ error: built.error }, { status: 400 })

    const item = await prisma.actionItem.update({ where: { id: body.id }, data: built.data })
    return NextResponse.json(item)
  } catch (error: any) {
    console.error('Update action item error:', error)
    return NextResponse.json({ error: 'Failed to update action item' }, { status: 500 })
  }
}

/** Bulk edit: { ids: string[], patch: { assignedToId?, dueDate?, priority?, status?, meetingId? } } */
export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: any) => typeof x === 'string') : []
    if (ids.length === 0) return NextResponse.json({ error: 'Select at least one item' }, { status: 400 })
    if (ids.length > 1000) return NextResponse.json({ error: 'Too many items at once (max 1000)' }, { status: 400 })
    const { assignedToId, dueDate, priority, status, meetingId, committed } = body?.patch ?? {}
    const built = await buildUpdate({ assignedToId, dueDate, priority, status, meetingId, committed })
    if ('error' in built) return NextResponse.json({ error: built.error }, { status: 400 })
    if (Object.keys(built.data).length === 0) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })

    const result = await prisma.actionItem.updateMany({ where: { id: { in: ids } }, data: built.data })
    return NextResponse.json({ updated: result.count })
  } catch (error: any) {
    console.error('Bulk update action items error:', error)
    return NextResponse.json({ error: 'Failed to update action items' }, { status: 500 })
  }
}
