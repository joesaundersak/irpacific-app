export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const jobId = url.searchParams.get('job') ?? undefined
    const vendor = url.searchParams.get('vendor') ?? undefined
    const month = url.searchParams.get('month') ?? undefined

    const where: any = {}
    if (jobId) where.jobId = jobId
    if (vendor) where.vendorName = { contains: vendor }
    if (month) {
      const [y, m] = month.split('-')
      const start = new Date(parseInt(y ?? '2026'), parseInt(m ?? '1') - 1, 1)
      const end = new Date(parseInt(y ?? '2026'), parseInt(m ?? '1'), 0)
      where.dueDate = { gte: start, lte: end }
    }

    const entries = await prisma.aPEntry.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        job: { select: { jobCode: true, jobName: true } },
      },
    })

    // Summary stats
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0)

    const allEntries = await prisma.aPEntry.findMany({ where: { isPaid: false } })
    const thisMonthDue = allEntries.filter((e: any) => e.dueDate && e.dueDate >= thisMonthStart && e.dueDate <= thisMonthEnd).reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
    const nextMonthDue = allEntries.filter((e: any) => e.dueDate && e.dueDate >= nextMonthStart && e.dueDate <= nextMonthEnd).reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
    const overdue = allEntries.filter((e: any) => e.dueDate && e.dueDate < thisMonthStart).reduce((s: number, e: any) => s + (e.amount ?? 0), 0)

    return NextResponse.json({
      entries: entries.map((e: any) => ({
        ...e,
        dueDate: e.dueDate?.toISOString() ?? null,
        createdAt: e.createdAt?.toISOString(),
        updatedAt: e.updatedAt?.toISOString(),
      })),
      summary: { thisMonthDue, nextMonthDue, overdue },
    })
  } catch (error: any) {
    console.error('AP error:', error)
    return NextResponse.json({ error: 'Failed to load AP data' }, { status: 500 })
  }
}
