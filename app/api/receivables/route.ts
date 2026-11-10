export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/access-server'
import { prisma } from '@/lib/db'

const r2 = (n: number) => Math.round(n * 100) / 100

// Receivables per job, computed from the BuilderTrend Jobsites (invoiced / payments) and WIP (earned revenue) imports. Read-only.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!user.access.receivables) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const jobs = await prisma.job.findMany({
      select: {
        id: true, jobCode: true, jobName: true, state: true, status: true, clientName: true, projectManagerId: true, projectManagerName: true,
        contractPrice: true, approvedCOPrice: true, totalRevisedPrice: true, amountInvoiced: true, paymentsReceived: true, clientBalance: true,
        earnedRevenue: true, percentComplete: true, actualCompletion: true,
        projectManager: { select: { id: true, name: true } },
      },
      orderBy: { jobCode: 'desc' },
    })

    const rows = jobs.map(j => {
      const contract = j.totalRevisedPrice || (j.contractPrice + j.approvedCOPrice)
      const invoiced = j.amountInvoiced
      const paid = j.paymentsReceived
      const rawEarned = j.earnedRevenue || (contract * Math.min(j.percentComplete, 100)) / 100
      const earned = contract > 0 ? Math.min(rawEarned, contract) : rawEarned // WIP can over-recognize past the contract
      return {
        id: j.id,
        jobCode: j.jobCode,
        jobName: j.jobName,
        state: j.state,
        status: j.status,
        clientName: j.clientName,
        pmId: j.projectManager?.id ?? j.projectManagerId ?? null,
        pmName: j.projectManager?.name ?? j.projectManagerName ?? null,
        percentComplete: j.percentComplete,
        completed: !!j.actualCompletion,
        contract: r2(contract),
        invoiced: r2(invoiced),
        paid: r2(paid),
        earned: r2(earned),
        btBalance: r2(j.clientBalance),                  // BuilderTrend "Client Balance" as exported
        outstanding: r2(Math.max(0, invoiced - paid)),   // invoiced, not yet paid
        credit: r2(Math.max(0, paid - invoiced)),        // customer paid more than invoiced
        readyToBill: r2(Math.max(0, earned - invoiced)), // work earned but not yet invoiced
        remaining: r2(Math.max(0, contract - paid)),     // still to collect on the contract
      }
    }).filter(r => r.contract > 0 || r.invoiced > 0 || r.paid > 0)

    const lastImport = await prisma.importHistory.findFirst({ where: { fileType: 'jobsites' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }).catch(() => null)

    // Invoice-level detail from the BuilderTrend Invoices import (linked to jobs by job code)
    const invoiceCount = await prisma.invoice.count().catch(() => 0)
    const openInv = invoiceCount ? await prisma.invoice.findMany({
      where: { status: { not: 'Paid' }, balance: { not: 0 } },
      orderBy: [{ deadline: 'asc' }],
    }) : []
    const jobByCode = new Map(jobs.map(j => [j.jobCode, j]))
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const invoices = openInv.map(inv => {
      const job = jobByCode.get(inv.jobCode)
      const isDraft = inv.status.toLowerCase().includes('draft')
      const daysPastDue = inv.deadline ? Math.floor((today.getTime() - new Date(inv.deadline).getTime()) / 86400000) : null
      const bucket = isDraft ? 'draft' : daysPastDue == null || daysPastDue <= 0 ? 'current' : daysPastDue <= 30 ? 'd1_30' : daysPastDue <= 60 ? 'd31_60' : daysPastDue <= 90 ? 'd61_90' : 'd90'
      return {
        id: inv.id, invoiceNumber: inv.invoiceNumber, title: inv.title, status: inv.status, isDraft, bucket,
        jobId: job?.id ?? null, jobCode: inv.jobCode, jobName: job?.jobName ?? inv.jobName, state: job?.state ?? null,
        pmId: job?.projectManager?.id ?? job?.projectManagerId ?? null, pmName: job?.projectManager?.name ?? job?.projectManagerName ?? null,
        ownerName: inv.ownerName, total: r2(inv.totalPrice), paid: r2(inv.amountPaid), balance: r2(inv.balance),
        deadline: inv.deadline?.toISOString() ?? null, daysPastDue,
      }
    })
    const lastInvImport = await prisma.importHistory.findFirst({ where: { fileType: 'invoices' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }).catch(() => null)

    return NextResponse.json({
      rows, asOf: lastImport?.createdAt?.toISOString() ?? null,
      invoices, invoiceCount, invoicesAsOf: lastInvImport?.createdAt?.toISOString() ?? null,
    })
  } catch (error: any) {
    console.error('Receivables error:', error)
    return NextResponse.json({ error: 'Failed to load receivables' }, { status: 500 })
  }
}
