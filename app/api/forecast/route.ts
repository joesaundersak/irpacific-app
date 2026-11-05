export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { evaluateSchedule, isActiveJob, contractValue, isOpenLead } from '@/lib/schedule-rules'
import { loadModel, MonthBuckets, defaultDurationDays, forecastInstall, forecastProduct } from '@/lib/forecast-model'

const DAY = 86400000
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)
const r = (n: number) => Math.round(n)

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp = new URL(request.url).searchParams
    const includeLeads = sp.get('includeLeads') === 'true'
    const minConfidence = Math.min(100, Math.max(0, parseFloat(sp.get('minConfidence') ?? '60') || 0))
    const state = sp.get('state') || ''
    const pm = sp.get('pm') || ''
    const type = sp.get('type') || 'all'
    const monthsCount = Math.min(36, Math.max(3, parseInt(sp.get('months') ?? '12') || 12))

    const configs = await prisma.systemConfig.findMany()
    const configMap: Record<string, string> = {}
    configs.forEach((c: any) => { configMap[c.key] = c.value })
    const model = loadModel(configMap)

    const now = new Date()
    const total = new MonthBuckets(now, monthsCount)
    const months = total.months
    const projRow = new Array(monthsCount).fill(0)
    const leadRow = new Array(monthsCount).fill(0)
    const profitRow = new Array(monthsCount).fill(0)
    const targetMarginPct = parseFloat(configMap.forecast_target_margin || configMap.target_margin || '25') || 0
    const revenueTarget = parseFloat(configMap.forecast_target_revenue_monthly || '0') || 0
    let beyondProjects = 0, beyondLeads = 0

    // ---------- Projects: active jobs WITH a schedule only ----------
    const jobs = await prisma.job.findMany({
      where: {
        status: 'OPEN',
        ...(state ? { state } : {}),
        ...(pm === 'none' ? { projectManagerId: null } : pm ? { projectManagerId: pm } : {}),
      },
      include: {
        projectManager: { select: { name: true } },
        milestones: { select: { phase: true, title: true, startDate: true, endDate: true } },
      },
    })

    const projects: any[] = []
    const excludedJobs: any[] = []
    let excludedValue = 0

    for (const job of jobs as any[]) {
      if (!isActiveJob(job)) continue
      const contract = contractValue(job)
      const billed = Math.min(contract, Math.max(job.amountInvoiced ?? 0, contract * Math.min(100, job.percentComplete ?? 0) / 100))
      const remaining = Math.max(0, contract - billed)
      const ev = evaluateSchedule(job, job.milestones)
      if (type !== 'all' && ev.type !== type) continue
      if (!ev.hasSchedule) {
        if (remaining > 0) {
          excludedValue += remaining
          excludedJobs.push({ id: job.id, jobCode: job.jobCode, name: job.jobName, pm: job.projectManager?.name ?? job.projectManagerName ?? null, remaining: r(remaining), type: ev.type })
        }
        continue
      }
      if (remaining <= 0) continue

      const starts = ev.phases.map(p => p.start).filter(Boolean) as Date[]
      const ends = ev.phases.map(p => p.end).filter(Boolean) as Date[]
      const start = starts.length ? new Date(Math.min(...starts.map(d => d.getTime()))) : (job.projectedStart ?? job.actualStart ?? now)
      let end = ends.length ? new Date(Math.max(...ends.map(d => d.getTime()))) : null
      if (!end || end <= start) end = job.projectedCompletion && job.projectedCompletion > start ? (job.projectedCompletion as Date) : addDays(start, defaultDurationDays(contract))
      const endDate: Date = end as Date

      const b = new MonthBuckets(now, monthsCount)
      if (ev.type === 'product') {
        const po = ev.phases.find(p => p.key === 'po')?.start ?? start
        const delivery = ev.phases.find(p => p.key === 'delivery')?.end ?? endDate
        forecastProduct(b, model, { contract, billed, po, delivery })
      } else {
        forecastInstall(b, model, { contract, billed, start, end: endDate, schedule: ev })
      }
      // Projected profit uses the job's BuilderTrend projected margin; falls back to the target margin when BT has none
      const jobMargin = (job.projectedProfitPct ?? 0) > 0 ? job.projectedProfitPct : targetMarginPct
      b.values.forEach((v, i) => { projRow[i] += v; profitRow[i] += v * jobMargin / 100 })
      beyondProjects += b.beyond
      projects.push({
        id: job.id, jobCode: job.jobCode, name: job.jobName, type: ev.type,
        pm: job.projectManager?.name ?? job.projectManagerName ?? null,
        contract: r(contract), remaining: r(remaining), missing: ev.missing,
        start: start.toISOString(), end: endDate.toISOString(),
        monthly: b.values.map(r), beyond: r(b.beyond),
      })
    }

    // ---------- Leads: open opportunities at or above the confidence threshold ----------
    const leadsOut: any[] = []
    if (includeLeads && type !== 'product') {
      const leads = await prisma.lead.findMany({
        where: {
          ...(state ? { stateOpp: state } : {}),
          ...(pm === 'none' ? { salespersonId: null } : pm ? { salespersonId: pm } : {}),
        },
        include: { salesperson: { select: { name: true } } },
      })
      for (const lead of leads as any[]) {
        if (!isOpenLead(lead)) continue
        const conf = (lead.confidence ?? 0) > 1 ? (lead.confidence ?? 0) / 100 : (lead.confidence ?? 0)
        if (conf * 100 < minConfidence || conf <= 0) continue
        const mid = ((lead.estimatedRevMin ?? 0) + (lead.estimatedRevMax ?? 0)) / 2
        const value = mid * conf
        if (value <= 0) continue
        let start: Date = lead.projectStart ?? (lead.projectedSalesDate ? addDays(lead.projectedSalesDate, 30) : addDays(now, 30))
        if (start < now) start = addDays(now, 30) // stale dates: assume work starts ~30 days out
        let end: Date = lead.substantialCompletion && lead.substantialCompletion > start ? lead.substantialCompletion : addDays(start, defaultDurationDays(mid))
        const b = new MonthBuckets(now, monthsCount)
        forecastInstall(b, model, { contract: value, billed: 0, start, end })
        b.values.forEach((v, i) => { leadRow[i] += v; profitRow[i] += v * targetMarginPct / 100 })
        beyondLeads += b.beyond
        leadsOut.push({
          id: lead.id, title: lead.opportunityTitle, confidence: r(conf * 100),
          salesperson: lead.salesperson?.name ?? lead.salespersonName ?? null,
          fullValue: r(mid), value: r(value), start: start.toISOString(), end: end.toISOString(),
          monthly: b.values.map(r), beyond: r(b.beyond),
        })
      }
    }

    const rows = months.map((month, i) => ({
      month, projects: r(projRow[i]), leads: r(leadRow[i]), total: r(projRow[i] + leadRow[i]),
      profit: r(profitRow[i]), revenueTarget: r(revenueTarget), profitTarget: r(revenueTarget * targetMarginPct / 100),
    }))

    projects.sort((a, b) => b.remaining - a.remaining)
    leadsOut.sort((a, b) => b.value - a.value)
    excludedJobs.sort((a, b) => b.remaining - a.remaining)

    return NextResponse.json({
      months,
      rows,
      projects,
      leads: leadsOut,
      excluded: { count: excludedJobs.length, value: r(excludedValue), jobs: excludedJobs },
      beyond: { projects: r(beyondProjects), leads: r(beyondLeads) },
      totals: {
        projects: r(projRow.reduce((s, v) => s + v, 0)),
        leads: r(leadRow.reduce((s, v) => s + v, 0)),
        profit: r(profitRow.reduce((s, v) => s + v, 0)),
      },
      targets: { revenueMonthly: r(revenueTarget), marginPct: targetMarginPct },
      model: { phases: model.phases.map(p => ({ label: p.label, bill: Math.round(p.bill * 100), time: Math.round(p.time * 100) })), productDeposit: Math.round(model.productDeposit * 100) },
    })
  } catch (error: any) {
    console.error('Forecast error:', error)
    return NextResponse.json({ error: 'Failed to load forecast' }, { status: 500 })
  }
}
