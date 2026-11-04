export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { leadId, jobCode } = body ?? {}
    if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 })

    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    // Create or find job
    let job
    if (jobCode) {
      job = await prisma.job.findUnique({ where: { jobCode } })
    }

    if (!job) {
      // Generate a new job code
      const state = lead.stateOpp?.toUpperCase() === 'OR' ? 'OR' : 'WA'
      const lastJob = await prisma.job.findFirst({
        where: { jobCode: { startsWith: state } },
        orderBy: { jobCode: 'desc' },
      })
      const lastNum = lastJob ? parseInt(lastJob.jobCode.replace(/[^\d]/g, '') || '0') : 0
      const newCode = `${state}${String(lastNum + 1).padStart(5, '0')}`

      job = await prisma.job.create({
        data: {
          jobCode: newCode,
          jobName: `${newCode} - ${lead.clientContact ?? lead.opportunityTitle}`,
          state,
          clientName: lead.clientContact ?? lead.firstName ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() : null,
          clientEmail: lead.email,
          clientPhone: lead.phone ?? lead.cellPhone,
          contractPrice: (lead.estimatedRevMin + lead.estimatedRevMax) / 2,
          projectManagerId: lead.salespersonId,
        },
      })
    }

    // Link lead to job
    await prisma.lead.update({
      where: { id: leadId },
      data: { linkedJobId: job.id, leadStatus: 'Converted' },
    })

    return NextResponse.json({ jobId: job.id, jobCode: job.jobCode })
  } catch (error: any) {
    console.error('Convert lead error:', error)
    return NextResponse.json({ error: 'Failed to convert lead' }, { status: 500 })
  }
}
