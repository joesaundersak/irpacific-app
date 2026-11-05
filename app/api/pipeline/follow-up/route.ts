export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/access-server'
import { CADENCE_OPTIONS } from '@/lib/lead-escalation'

/** Sets (or clears, with cadenceDays 0) the app-owned follow-up cadence for a lead. Does not touch BuilderTrend lead data. */
export async function PUT(request: Request) {
  try {
    const me = await getCurrentUser()
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!me.access.pipeline) return NextResponse.json({ error: 'No access to the Sales Pipeline' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const leadId = typeof body?.leadId === 'string' ? body.leadId : ''
    const cadenceDays = Number(body?.cadenceDays ?? 0)
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    if (cadenceDays !== 0 && !CADENCE_OPTIONS.some(o => o.days === cadenceDays)) {
      return NextResponse.json({ error: 'Invalid follow-up timeline' }, { status: 400 })
    }
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    if (cadenceDays === 0) {
      await prisma.leadFollowUp.deleteMany({ where: { leadId } })
    } else {
      await prisma.leadFollowUp.upsert({
        where: { leadId },
        create: { leadId, cadenceDays, updatedById: me.id },
        update: { cadenceDays, updatedById: me.id },
      })
    }
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Follow-up cadence error:', error)
    return NextResponse.json({ error: 'Failed to save follow-up timeline' }, { status: 500 })
  }
}
