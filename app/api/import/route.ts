export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/access-server'
import { safeSyncFlags } from '@/lib/flags'
import { detectFileType, extractJobCode, resolveJobCode, isPlaceholderJobCode, parseExcelBuffer, parseExcelDate, parseAmount, parsePercentage } from '@/lib/import-parser'

/*
 * Imports never reject a record for missing data: every row with anything to identify it is saved,
 * gaps (no job code, price, contact, dates...) become "missing_info" flags via syncAccountabilityFlags.
 * A row that still fails (bad value / DB error) is skipped on its own and reported, never aborting the file.
 */

interface Result { added: number; updated: number; unchanged: number; skipped: number; warnings: string[] }
const newResult = (): Result => ({ added: 0, updated: 0, unchanged: 0, skipped: 0, warnings: [] })
const MAX_ROW_WARNINGS = 15
function skipRow(r: Result, rowNum: number, why: string) {
  r.skipped++
  if (r.skipped <= MAX_ROW_WARNINGS) r.warnings.push(`Row ${rowNum} skipped: ${why}`)
}
const errMsg = (e: any) => String(e?.message ?? e).split('\n').filter(Boolean).pop()?.slice(0, 160) ?? 'error'
const str = (v: any) => String(v ?? '').trim()
const phoneStr = (v: any) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? String(Math.floor(n)) : str(v) || null
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const me = await getCurrentUser()
    if (!me?.access.imports) {
      return NextResponse.json({ error: 'You do not have access to import files' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const { headers, rows } = parseExcelBuffer(buffer)
    const fileType = detectFileType(headers)

    if (fileType === 'unknown') {
      const found = headers.filter(Boolean).slice(0, 12).join(', ')
      return NextResponse.json({
        error: `Could not tell which BuilderTrend report this is (Jobsites, WIP, Schedule, Lead Opportunities or Invoices). Columns found: ${found || 'none'}`,
      }, { status: 400 })
    }

    let result: Result
    if (fileType === 'jobsites') result = await processJobsites(rows)
    else if (fileType === 'wip') result = await processWIP(rows)
    else if (fileType === 'schedule') result = await processSchedule(rows)
    else if (fileType === 'invoices') result = await processInvoices(rows)
    else result = await processLeads(rows, fileType)

    const { added, updated, unchanged, skipped } = result
    const warnings = [...result.warnings]
    if (skipped > MAX_ROW_WARNINGS) warnings.push(`…and ${skipped - MAX_ROW_WARNINGS} more skipped row(s)`)

    // Re-evaluate flags (missing schedule / no PM / missing info) against the fresh data
    const flags = await safeSyncFlags()
    if (flags && (flags.created || flags.resolved)) {
      warnings.push(`Records needing updates: ${flags.created} new flag(s) raised, ${flags.resolved} resolved — see Action Items and the Missing Info badges`)
    }

    try {
      await prisma.importHistory.create({
        data: {
          fileName: file.name,
          fileType,
          recordsProcessed: rows.length,
          recordsAdded: added,
          recordsUpdated: updated,
          recordsUnchanged: unchanged,
          importedById: session.user.id,
          warnings: warnings.length > 0 ? JSON.stringify(warnings) : null,
          status: skipped > 0 ? 'completed_with_warnings' : 'completed',
        },
      })
    } catch (e) { console.error('Import history save failed:', e) }

    return NextResponse.json({
      success: true,
      fileType,
      records: { processed: rows.length, added, updated, unchanged, skipped },
      flags,
      warnings,
    })
  } catch (error: any) {
    console.error('Import error:', error)
    // P2021/P2022 = table/column missing: the database was never updated to this version's schema
    if (error?.code === 'P2021' || error?.code === 'P2022') {
      return NextResponse.json({ error: 'The database structure is out of date for this version of the app. Restart/redeploy the app (it updates the database on start) or run "npm run db:push".' }, { status: 500 })
    }
    return NextResponse.json({ error: errMsg(error) || 'Import failed' }, { status: 500 })
  }
}

async function userNameMap() {
  const users = await prisma.user.findMany({ select: { id: true, name: true } })
  const map: Record<string, string> = {}
  users.forEach((u: any) => { if (u.name) map[u.name.toLowerCase().trim()] = u.id })
  return map
}

async function processJobsites(rows: Record<string, any>[]) {
  const r = newResult()
  const userMap = await userNameMap()
  let placeholders = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const jobName = str(row['Job Name'])
      if (!jobName) { skipRow(r, i + 1, 'blank Job Name'); continue }
      const jobCode = resolveJobCode(jobName)
      if (isPlaceholderJobCode(jobCode)) placeholders++

      const pmName = String(row['Project Manager'] ?? '').split('\n')[0]?.trim() ?? ''
      const pmId = userMap[pmName.toLowerCase()] ?? null
      const state = str(row['State']).toUpperCase()

      const data = {
        jobName,
        state: state === 'WA' || state === 'OR' ? state : null,
        city: str(row['City']) || null,
        streetAddress: str(row['Street Address'] ?? row['Job Address']) || null,
        zip: str(row['Zip']) || null,
        status: str(row['Status']) || 'OPEN',
        jobType: str(row['Job Type']) || null,
        groups: String(row['Groups'] ?? '').replace(/\r\n/g, ', ').trim() || null,
        contractType: str(row['Contract Type']) || null,
        prefix: str(row['Prefix']) || null,
        clientName: str(row['Clients']) || null,
        clientEmail: str(row['Client Email']) || null,
        clientPhone: phoneStr(row['Client Phone']),
        clientCity: str(row['Client City']) || null,
        clientState: str(row['Client State']) || null,
        clientStreet: str(row['Client Street Address']) || null,
        clientZip: phoneStr(row['Client Zip Code']),
        contractPrice: parseAmount(row['Contract Price']),
        approvedCOPrice: parseAmount(row['Approved CO Price']),
        amountInvoiced: parseAmount(row['Amount Invoiced']),
        paymentsReceived: parseAmount(row['Payments Received']),
        clientBalance: parseAmount(row['Client Balance']),
        costsPaid: parseAmount(row['Costs Paid']),
        costsOutstanding: parseAmount(row['Costs Outstanding']),
        totalCosts: parseAmount(row['Total Costs']),
        grossProfit: parseAmount(row['Gross Profit']),
        originalBudget: parseAmount(row['Original Budget Costs']),
        revisedBudget: parseAmount(row['Revised Budget Costs']),
        projectManagerId: pmId,
        projectManagerName: pmName || null,
        actualStart: parseExcelDate(row['Actual Start']),
        actualCompletion: parseExcelDate(row['Actual Completion']),
        projectedStart: parseExcelDate(row['Proj. Start']),
        projectedCompletion: parseExcelDate(row['Proj. Completion']),
        createdDate: parseExcelDate(row['Created']),
      }

      const existing = await prisma.job.findUnique({ where: { jobCode }, select: { id: true } })
      if (existing) {
        // Keep a PM assigned in the app when BuilderTrend has none mapped to a login
        await prisma.job.update({ where: { jobCode }, data: pmId ? data : { ...data, projectManagerId: undefined } })
        r.updated++
      } else {
        await prisma.job.create({ data: { jobCode, ...data } })
        r.added++
      }
    } catch (e) {
      skipRow(r, i + 1, errMsg(e))
    }
  }
  if (placeholders) r.warnings.push(`${placeholders} job(s) have no WA/OR job code in their name — imported with a temporary NC- code and flagged for update`)
  return r
}

async function processWIP(rows: Record<string, any>[]) {
  const r = newResult()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const jobName = str(row['Job name'])
      if (!jobName) { skipRow(r, i + 1, 'blank Job name'); continue }
      const jobCode = resolveJobCode(jobName)

      const data = {
        revisedPrice: parseAmount(row['Revised price']),
        totalRevisedPrice: parseAmount(row['Total revised price']),
        projectedCosts: parseAmount(row['Projected costs']),
        actualCosts: parseAmount(row['Actual costs']),
        amountInvoiced: parseAmount(row['Amount invoiced']),
        percentComplete: Math.min(parseAmount(row['% complete of job']), 100), // Cap at 100%
        projectedProfit: parseAmount(row['Projected profit']),
        projectedProfitPct: parseAmount(row['Projected profit %']),
        earnedRevenue: parseAmount(row['Earned revenue']),
        overUnderBilling: parseAmount(row['Over/under billing']),
        overUnderBillingPct: parseAmount(row['Over/under billing %']),
        profitEarned: parseAmount(row['Profit earned']),
      }

      const existing = await prisma.job.findUnique({ where: { jobCode }, select: { id: true } })
      if (existing) {
        await prisma.job.update({ where: { jobCode }, data })
        r.updated++
      } else {
        // Job not in Jobsites yet: create it so nothing is lost; Jobsites import fills in the rest
        await prisma.job.create({ data: { jobCode, jobName, ...data } })
        r.added++
      }
    } catch (e) {
      skipRow(r, i + 1, errMsg(e))
    }
  }
  return r
}

async function processSchedule(rows: Record<string, any>[]) {
  const r = newResult()
  // Re-import safe: rows are matched to existing records; imported milestones that vanished from
  // BuilderTrend are removed for the jobs in this file. Manually entered milestones are never touched.
  const jobCache = new Map<string, { id: string }>()
  let jobsCreated = 0
  const getJob = async (code: string, jobName: string) => {
    let job = jobCache.get(code)
    if (!job) {
      job = (await prisma.job.findUnique({ where: { jobCode: code }, select: { id: true } })) ?? undefined
      if (!job) {
        // Schedule imported before Jobsites (or job missing there): create a minimal job instead of dropping rows
        job = await prisma.job.create({ data: { jobCode: code, jobName }, select: { id: true } })
        jobsCreated++
      }
      jobCache.set(code, job)
    }
    return job
  }
  const touchedMilestones = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const jobField = str(row['Job'])
      if (!jobField) { skipRow(r, i + 1, 'blank Job'); continue }
      const job = await getJob(resolveJobCode(jobField), jobField)

      const phase = str(row['Phase'])
      const title = str(row['Title'])
      const startDate = parseExcelDate(row['Start'])
      const endDate = parseExcelDate(row['End'])
      const isComplete = row['Complete'] === true || String(row['Complete']).toLowerCase() === 'true'
      const percentComplete = parseAmount(row['Percent Complete'])
      const duration = parseAmount(row['Duration'])
      const assignedTo = str(row['Assigned To']) || null

      if (phase.toUpperCase() === 'AP') {
        const amount = parseAmount(title) // Title stores dollar amount for AP
        const existingAp = await prisma.aPEntry.findFirst({
          where: { jobId: job.id, title, vendorName: assignedTo, dueDate: startDate },
        })
        if (existingAp) {
          // BuilderTrend is the source of truth for paid status
          await prisma.aPEntry.update({ where: { id: existingAp.id }, data: { amount, isPaid: isComplete } })
          r.updated++
        } else {
          await prisma.aPEntry.create({
            data: { jobId: job.id, vendorName: assignedTo, amount, dueDate: startDate, isPaid: isComplete, title },
          })
          r.added++
        }
      } else {
        const data = {
          startDate, endDate, isComplete,
          percentComplete: Math.round(percentComplete),
          duration: Math.round(duration),
          assignedTo,
        }
        const existingMs = await prisma.milestone.findFirst({
          where: { jobId: job.id, source: 'import', phase: phase || 'General', title, startDate, id: { notIn: [...touchedMilestones] } },
        })
        if (existingMs) {
          await prisma.milestone.update({ where: { id: existingMs.id }, data })
          touchedMilestones.add(existingMs.id)
          r.updated++
        } else {
          const created = await prisma.milestone.create({
            data: { jobId: job.id, phase: phase || 'General', title, ...data, source: 'import' },
          })
          touchedMilestones.add(created.id)
          r.added++
        }
      }
    } catch (e) {
      skipRow(r, i + 1, errMsg(e))
    }
  }

  // Remove imported milestones (and duplicates from earlier imports) no longer in BuilderTrend for these jobs.
  // Only safe when every row made it in; otherwise a skipped row's milestone would be wrongly deleted.
  const jobIds = [...jobCache.values()].map(j => j.id)
  if (jobIds.length && r.skipped === 0) {
    try {
      await prisma.milestone.deleteMany({
        where: { jobId: { in: jobIds }, source: 'import', id: { notIn: [...touchedMilestones] } },
      })
    } catch (e) { console.error('Milestone cleanup failed:', e) }
  }
  if (jobsCreated) r.warnings.push(`${jobsCreated} job(s) were not in the app yet and were created from the schedule — import Jobsites to fill in their details`)
  return r
}

async function processInvoices(rows: Record<string, any>[]) {
  // App-side mirror of the BuilderTrend Invoices report. Jobs are only linked, never created or changed.
  const r = newResult()
  const jobIdByCode = new Map<string, string | null>()
  const touched = new Map<string, Set<string>>() // jobCode -> invoice numbers seen in this file
  let unlinked = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const jobField = str(row['Job'])
      const invoiceNumber = str(row['ID#']).replace(/\s+/g, ' ')
      if (!jobField && !invoiceNumber) continue // totals row
      if (!jobField) { skipRow(r, i + 1, 'blank Job'); continue }
      if (!invoiceNumber) { skipRow(r, i + 1, 'blank ID#'); continue }
      const jobCode = resolveJobCode(jobField)
      if (!jobIdByCode.has(jobCode)) {
        const job = await prisma.job.findUnique({ where: { jobCode }, select: { id: true } })
        jobIdByCode.set(jobCode, job?.id ?? null)
        if (!job) unlinked++
      }
      const data = {
        jobId: jobIdByCode.get(jobCode) ?? null,
        jobName: jobField,
        title: str(row['Title']) || null,
        status: str(row['Status']) || 'Unknown',
        totalPrice: parseAmount(row['Total Price']),
        amountPaid: parseAmount(row['Amount Paid']),
        balance: parseAmount(row['Invoice Balance']),
        deadline: parseExcelDate(row['Deadline']),
        datePaid: parseExcelDate(row['Date Paid']),
        accountingStatus: (str(row['AccountingStatus']) || '').replace(/^-$/, '') || null,
        ownerName: str(row['OwnerName']) || null,
      }
      const existing = await prisma.invoice.findUnique({ where: { jobCode_invoiceNumber: { jobCode, invoiceNumber } }, select: { id: true } })
      if (existing) {
        await prisma.invoice.update({ where: { id: existing.id }, data })
        r.updated++
      } else {
        await prisma.invoice.create({ data: { ...data, jobCode, invoiceNumber } })
        r.added++
      }
      if (!touched.has(jobCode)) touched.set(jobCode, new Set())
      touched.get(jobCode)!.add(invoiceNumber)
    } catch (e) {
      skipRow(r, i + 1, errMsg(e))
    }
  }

  // Invoices deleted in BuilderTrend disappear for the jobs in this file (only when every row imported)
  if (r.skipped === 0) {
    for (const [jobCode, nums] of touched) {
      try {
        await prisma.invoice.deleteMany({ where: { jobCode, invoiceNumber: { notIn: [...nums] } } })
      } catch (e) { console.error('Invoice cleanup failed:', e) }
    }
  }
  if (unlinked) r.warnings.push(`${unlinked} job(s) on these invoices are not in the app yet — import Jobsites so they link to their projects`)
  return r
}

async function processLeads(rows: Record<string, any>[], type: string) {
  const r = newResult()
  if (type === 'leads_basic' && rows.length < 100) {
    r.warnings.push('This export may be filtered by date — check BuilderTrend export settings to include all leads')
  }

  const userMap = await userNameMap()
  const staleDaysConfig = await prisma.systemConfig.findUnique({ where: { key: 'stale_lead_days' } })
  const staleDays = parseInt(staleDaysConfig?.value ?? '30', 10)
  let untitled = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const contact = str(row['Client Contact']) || [str(row['First Name']), str(row['Last Name'])].filter(Boolean).join(' ')
      let oppTitle = str(row['Opportunity Title'])
      if (!oppTitle) {
        if (!contact) { skipRow(r, i + 1, 'no opportunity title or client name'); continue }
        oppTitle = `Untitled lead – ${contact}`
        untitled++
      }

      const confidence = parsePercentage(row['Confidence'])
      const revMin = parseAmount(row['Estimated Revenue Min'])
      const revMax = parseAmount(row['Estimated Revenue Max'])
      const weightedValue = ((revMin + revMax) / 2) * confidence

      const spName = String(row['Salesperson'] ?? row['Email'] ?? '').split(',')[0]?.trim() ?? ''
      const spId = userMap[spName.toLowerCase()] ?? null

      const lastContacted = parseExcelDate(row['Last Contacted'])
      const createdDate = parseExcelDate(row['Created Date'])
      const lastActivity = lastContacted ?? createdDate
      const daysSinceActivity = lastActivity ? Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)) : 999

      const data: any = {
        clientContact: str(row['Client Contact']) || null,
        firstName: str(row['First Name']) || null,
        lastName: str(row['Last Name']) || null,
        confidence,
        estimatedRevMin: revMin,
        estimatedRevMax: revMax,
        estimatedRevenue: str(row['Estimated Revenue']) || null,
        weightedValue,
        leadStatus: str(row['Lead Status']) || 'Open',
        proposalStatus: str(row['Proposal Status...']) || null,
        hasBeenContacted: str(row['Has Opportunity Been Contacted?']) || null,
        projectType: str(row['Project Type']) || null,
        source: str(row['Source']) || null,
        salespersonId: spId,
        salespersonName: str(row['Salesperson']) || null,
        createdDate,
        lastContacted,
        lastActivityDate: lastActivity,
        isStale: daysSinceActivity > staleDays,
        age: str(row['Age']) || null,
      }

      if (type === 'leads_expanded') {
        data.email = str(row['Email Address'] ?? row['Email']) || null
        data.phone = str(row['Phone']) || null
        data.cellPhone = str(row['Cell Phone']) || null
        data.cityContact = str(row['City (Contact)']) || null
        data.stateContact = str(row['State (Contact)']) || null
        data.streetContact = str(row['Street Address (Contact)']) || null
        data.zipContact = str(row['Zip (Contact)']) || null
        data.cityOpp = str(row['City(Opp)']) || null
        data.stateOpp = str(row['State(Opp)']) || null
        data.streetOpp = str(row['Street Address(Opp)']) || null
        data.zipOpp = str(row['Zip(Opp)']) || null
        data.notes = str(row['Notes']) || null
        data.tags = str(row['Tags']) || null
        data.soldDate = parseExcelDate(row['Sold Date'])
        data.projectedSalesDate = parseExcelDate(row['Projected Sales Date'])
        data.projectStart = parseExcelDate(row['Project Start*'])
        data.substantialCompletion = parseExcelDate(row['Substantial Completion*'])

        const relCode = extractJobCode(str(row['Related Job']))
        if (relCode) {
          const job = await prisma.job.findUnique({ where: { jobCode: relCode }, select: { id: true } })
          if (job) data.linkedJobId = job.id
        }
      } else {
        data.email = str(row['Email']) || null
        data.projectStart = parseExcelDate(row['Project Start*'])
        data.substantialCompletion = parseExcelDate(row['Substantial Completion*'])
      }

      // Upsert by opportunity title
      const existing = await prisma.lead.findFirst({ where: { opportunityTitle: oppTitle }, select: { id: true } })
      if (existing) {
        // Keep a PM assigned in the app when BuilderTrend has none mapped to a login
        await prisma.lead.update({ where: { id: existing.id }, data: spId ? data : { ...data, salespersonId: undefined } })
        r.updated++
      } else {
        await prisma.lead.create({ data: { opportunityTitle: oppTitle, ...data } })
        r.added++
      }
    } catch (e) {
      skipRow(r, i + 1, errMsg(e))
    }
  }
  if (untitled) r.warnings.push(`${untitled} lead(s) had no opportunity title — imported under the client name and flagged for update`)
  return r
}
