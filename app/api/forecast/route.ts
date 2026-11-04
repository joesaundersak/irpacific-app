export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const jobs = await prisma.job.findMany({
      where: { status: 'OPEN' },
      select: {
        totalRevisedPrice: true, actualCosts: true, percentComplete: true,
        projectedCompletion: true, projectedStart: true,
      },
    })

    const leads = await prisma.lead.findMany({
      where: { leadStatus: { not: 'Closed' } },
      select: {
        estimatedRevMin: true, estimatedRevMax: true, confidence: true,
        projectedSalesDate: true, projectStart: true, substantialCompletion: true,
      },
    })

    // Generate monthly forecast for next 12 months
    const now = new Date()
    const months: string[] = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    const forecast = months.map((month: string) => {
      // Conservative: awarded jobs only
      let conservative = 0
      for (const job of jobs) {
        const remaining = (job.totalRevisedPrice ?? 0) - ((job.totalRevisedPrice ?? 0) * (job.percentComplete ?? 0) / 100)
        if (remaining > 0 && job.projectedCompletion) {
          const completionMonth = `${job.projectedCompletion.getFullYear()}-${String(job.projectedCompletion.getMonth() + 1).padStart(2, '0')}`
          const startMonth = job.projectedStart
            ? `${job.projectedStart.getFullYear()}-${String(job.projectedStart.getMonth() + 1).padStart(2, '0')}`
            : months[0]
          if (month >= (startMonth ?? months[0]) && month <= completionMonth) {
            const monthsSpan = Math.max(1, monthDiff(job.projectedStart ?? now, job.projectedCompletion))
            conservative += remaining / monthsSpan
          }
        }
      }

      // Base: + weighted leads
      let baseAdd = 0
      for (const lead of leads) {
        const mid = ((lead.estimatedRevMin ?? 0) + (lead.estimatedRevMax ?? 0)) / 2
        const weighted = mid * (lead.confidence ?? 0)
        if (weighted > 0) baseAdd += weighted / 12
      }

      // Optimistic: + all leads at face value
      let optAdd = 0
      for (const lead of leads) {
        const mid = ((lead.estimatedRevMin ?? 0) + (lead.estimatedRevMax ?? 0)) / 2
        optAdd += mid / 12
      }

      return {
        month,
        conservative: Math.round(conservative),
        base: Math.round(conservative + baseAdd),
        optimistic: Math.round(conservative + optAdd),
      }
    })

    return NextResponse.json({ forecast, months })
  } catch (error: any) {
    console.error('Forecast error:', error)
    return NextResponse.json({ error: 'Failed to load forecast' }, { status: 500 })
  }
}

function monthDiff(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1
}
