export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    // Check that user is PM for this project or Admin
    const job = await prisma.job.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    if (session.user.role === 'PM' && job.projectManagerId !== session.user.id) {
      return NextResponse.json({ error: 'You can only edit milestones for your assigned projects' }, { status: 403 })
    }

    const body = await request.json()
    const { phase, title, startDate, endDate, isComplete, notes, isRequired } = body ?? {}

    const milestone = await prisma.milestone.create({
      data: {
        jobId: id,
        phase: phase ?? 'General',
        title: title ?? '',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isComplete: isComplete ?? false,
        notes: notes ?? null,
        isRequired: isRequired ?? false,
        source: 'manual',
      },
    })

    return NextResponse.json(milestone)
  } catch (error: any) {
    console.error('Create milestone error:', error)
    return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 })
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
    const { milestoneId, ...data } = body ?? {}
    if (!milestoneId) return NextResponse.json({ error: 'milestoneId required' }, { status: 400 })

    const job = await prisma.job.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    if (session.user.role === 'PM' && job.projectManagerId !== session.user.id) {
      return NextResponse.json({ error: 'You can only edit milestones for your assigned projects' }, { status: 403 })
    }

    const updateData: any = {}
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null
    if (data.isComplete !== undefined) updateData.isComplete = data.isComplete
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.title !== undefined) updateData.title = data.title
    if (data.phase !== undefined) updateData.phase = data.phase

    const milestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: updateData,
    })

    return NextResponse.json(milestone)
  } catch (error: any) {
    console.error('Update milestone error:', error)
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 })
  }
}
