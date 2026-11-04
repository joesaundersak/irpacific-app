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
    if (status) where.status = status
    if (meetingId) where.meetingId = meetingId

    const items = await prisma.actionItem.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      include: {
        assignedTo: { select: { id: true, name: true } },
        job: { select: { id: true, jobCode: true, jobName: true } },
        lead: { select: { id: true, opportunityTitle: true } },
      },
    })

    return NextResponse.json({
      items: items.map((i: any) => ({
        ...i,
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
    const { description, assignedToId, dueDate, priority, meetingId, jobId, leadId, category } = body ?? {}

    if (!description) return NextResponse.json({ error: 'Description required' }, { status: 400 })

    const item = await prisma.actionItem.create({
      data: {
        description,
        assignedToId: assignedToId ?? null,
        createdById: session.user.id,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority ?? 'medium',
        meetingId: meetingId ?? null,
        jobId: jobId ?? null,
        leadId: leadId ?? null,
        category: category ?? 'manual',
        source: 'manual',
      },
    })

    return NextResponse.json(item)
  } catch (error: any) {
    console.error('Create action item error:', error)
    return NextResponse.json({ error: 'Failed to create action item' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, status, description, dueDate, priority, assignedToId } = body ?? {}
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const data: any = {}
    if (status !== undefined) data.status = status
    if (description !== undefined) data.description = description
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null
    if (priority !== undefined) data.priority = priority
    if (assignedToId !== undefined) data.assignedToId = assignedToId

    const item = await prisma.actionItem.update({ where: { id }, data })
    return NextResponse.json(item)
  } catch (error: any) {
    console.error('Update action item error:', error)
    return NextResponse.json({ error: 'Failed to update action item' }, { status: 500 })
  }
}
