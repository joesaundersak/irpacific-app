export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/access-server'

/**
 * Deletes all imported BuilderTrend data and everything built on it (meetings, action items, import history).
 * Users, roles and settings are kept so the team can log in and re-import.
 */
export async function POST(request: Request) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (me.role !== 'Admin') return NextResponse.json({ error: 'Only an Admin can reset the system' }, { status: 403 })
    const { confirm } = (await request.json().catch(() => ({}))) ?? {}
    if (confirm !== 'RESET') return NextResponse.json({ error: 'Type RESET to confirm' }, { status: 400 })

    const [actionItems, milestones, apEntries, meetings, leads, jobs, imports] = await prisma.$transaction([
      prisma.actionItem.deleteMany({}),
      prisma.milestone.deleteMany({}),
      prisma.aPEntry.deleteMany({}),
      prisma.meeting.deleteMany({}),
      prisma.lead.deleteMany({}),
      prisma.job.deleteMany({}),
      prisma.importHistory.deleteMany({}),
    ])
    console.log(`System reset by ${me.email}`)
    return NextResponse.json({
      success: true,
      deleted: {
        actionItems: actionItems.count, milestones: milestones.count, apEntries: apEntries.count,
        meetings: meetings.count, leads: leads.count, jobs: jobs.count, imports: imports.count,
      },
    })
  } catch (e) {
    console.error('Reset error:', e)
    return NextResponse.json({ error: 'Reset failed: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 })
  }
}
