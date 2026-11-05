export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { safeSyncFlags } from '@/lib/flags'
import { detectFileType, extractJobCode, parseExcelBuffer, parseExcelDate, parseAmount, parsePercentage } from '@/lib/import-parser'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = session.user.role
    if (role !== 'Admin' && role !== 'Office Manager') {
      return NextResponse.json({ error: 'Only Admin and Office Manager can import files' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const { headers, rows } = parseExcelBuffer(buffer)
    const fileType = detectFileType(headers)

    if (fileType === 'unknown') {
      return NextResponse.json({ error: 'Could not detect file type. Please upload a valid BuilderTrend export.' }, { status: 400 })
    }

    let added = 0, updated = 0, unchanged = 0
    const warnings: string[] = []

    if (fileType === 'jobsites') {
      const result = await processJobsites(rows, session.user.id)
      added = result.added; updated = result.updated; unchanged = result.unchanged
      warnings.push(...result.warnings)
    } else if (fileType === 'wip') {
      const result = await processWIP(rows)
      added = result.added; updated = result.updated; unchanged = result.unchanged
    } else if (fileType === 'schedule') {
      const result = await processSchedule(rows)
      added = result.added; updated = result.updated; unchanged = result.unchanged
    } else if (fileType === 'leads_expanded' || fileType === 'leads_basic') {
      const result = await processLeads(rows, fileType)
      added = result.added; updated = result.updated; unchanged = result.unchanged
      warnings.push(...result.warnings)
    }

    // Re-evaluate accountability flags (missing schedule / no PM) against the fresh data
    const flags = await safeSyncFlags()
    if (flags && (flags.created || flags.resolved)) {
      warnings.push(`Accountability flags: ${flags.created} new action item(s), ${flags.resolved} resolved`)
    }

    // Save import history
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
        status: 'completed',
      },
    })

    return NextResponse.json({
      success: true,
      fileType,
      records: { processed: rows.length, added, updated, unchanged },
      warnings,
    })
  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json({ error: error?.message ?? 'Import failed' }, { status: 500 })
  }
}

async function processJobsites(rows: Record<string, any>[], userId: string) {
  let added = 0, updated = 0, unchanged = 0
  const warnings: string[] = []

  // Get user map for PM assignment
  const users = await prisma.user.findMany({ select: { id: true, name: true } })
  const userMap: Record<string, string> = {}
  users.forEach((u: any) => { userMap[u.name.toLowerCase().trim()] = u.id })

  for (const row of rows) {
    const jobName = String(row['Job Name'] ?? '').trim()
    if (!jobName) continue
    const jobCode = extractJobCode(jobName)
    if (!jobCode) continue

    const pmName = String(row['Project Manager'] ?? '').split('\n')[0]?.trim() ?? ''
    const pmId = userMap[pmName.toLowerCase()] ?? null

    const state = String(row['State'] ?? '').toUpperCase().trim()
    const clientEmail = String(row['Client Email'] ?? '').trim() || null
    const clientPhone = row['Client Phone'] ? String(Math.floor(Number(row['Client Phone']))) : null

    const data = {
      jobName,
      state: state === 'WA' || state === 'OR' ? state : null,
      city: String(row['City'] ?? '').trim() || null,
      streetAddress: String(row['Street Address'] ?? row['Job Address'] ?? '').trim() || null,
      zip: row['Zip'] ? String(row['Zip']).trim() : null,
      status: String(row['Status'] ?? 'OPEN').trim(),
      jobType: String(row['Job Type'] ?? '').trim() || null,
      groups: String(row['Groups'] ?? '').replace(/\r\n/g, ', ').trim() || null,
      contractType: String(row['Contract Type'] ?? '').trim() || null,
      prefix: String(row['Prefix'] ?? '').trim() || null,
      clientName: String(row['Clients'] ?? '').trim() || null,
      clientEmail,
      clientPhone,
      clientCity: String(row['Client City'] ?? '').trim() || null,
      clientState: String(row['Client State'] ?? '').trim() || null,
      clientStreet: String(row['Client Street Address'] ?? '').trim() || null,
      clientZip: row['Client Zip Code'] ? String(Math.floor(Number(row['Client Zip Code']))) : null,
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

    const existing = await prisma.job.findUnique({ where: { jobCode } })
    if (existing) {
      // Keep a PM assigned in the app when BuilderTrend has none mapped to a login
      await prisma.job.update({ where: { jobCode }, data: pmId ? data : { ...data, projectManagerId: undefined } })
      updated++
    } else {
      await prisma.job.create({ data: { jobCode, ...data } })
      added++
    }

    // Flag missing contact info
    if (!clientEmail && !clientPhone) {
      const description = `Missing contact info (email and phone) for job ${jobCode} - ${jobName}`
      const existingAction = await prisma.actionItem.findFirst({
        where: { description, status: 'open' },
      })
      if (!existingAction && pmId) {
        await prisma.actionItem.create({
          data: {
            description,
            assignedToId: pmId,
            category: 'missing_contact',
            source: 'import',
            jobId: (await prisma.job.findUnique({ where: { jobCode } }))?.id,
            priority: 'medium',
          },
        })
      }
    }
  }

  return { added, updated, unchanged, warnings }
}

async function processWIP(rows: Record<string, any>[]) {
  let added = 0, updated = 0, unchanged = 0

  for (const row of rows) {
    const jobName = String(row['Job name'] ?? '').trim()
    if (!jobName) continue
    const jobCode = extractJobCode(jobName)
    if (!jobCode) continue

    const rawPct = parseAmount(row['% complete of job'])
    const percentComplete = Math.min(rawPct, 100) // Cap at 100%

    const data = {
      revisedPrice: parseAmount(row['Revised price']),
      totalRevisedPrice: parseAmount(row['Total revised price']),
      projectedCosts: parseAmount(row['Projected costs']),
      actualCosts: parseAmount(row['Actual costs']),
      amountInvoiced: parseAmount(row['Amount invoiced']),
      percentComplete,
      projectedProfit: parseAmount(row['Projected profit']),
      projectedProfitPct: parseAmount(row['Projected profit %']),
      earnedRevenue: parseAmount(row['Earned revenue']),
      overUnderBilling: parseAmount(row['Over/under billing']),
      overUnderBillingPct: parseAmount(row['Over/under billing %']),
      profitEarned: parseAmount(row['Profit earned']),
    }

    // Extract PM from WIP if present
    const pmName = String(row['Project managers'] ?? '').trim()

    const existing = await prisma.job.findUnique({ where: { jobCode } })
    if (existing) {
      await prisma.job.update({ where: { jobCode }, data })
      updated++
    } else {
      // Create minimal record
      await prisma.job.create({ data: { jobCode, jobName, ...data } })
      added++
    }
  }

  return { added, updated, unchanged }
}

async function processSchedule(rows: Record<string, any>[]) {
  let added = 0, updated = 0, unchanged = 0
  // Re-import safe: rows are matched to existing records; imported milestones that vanished from
  // BuilderTrend are removed for the jobs in this file. Manually entered milestones are never touched.
  const jobCache = new Map<string, any>()
  const getJob = async (code: string) => {
    if (!jobCache.has(code)) jobCache.set(code, await prisma.job.findUnique({ where: { jobCode: code }, select: { id: true } }))
    return jobCache.get(code)
  }
  const touchedMilestones = new Set<string>()
  const sameTime = (a: Date | null) => a ?? null

  for (const row of rows) {
    const jobField = String(row['Job'] ?? '').trim()
    if (!jobField) continue
    const jobCode = extractJobCode(jobField)

    const phase = String(row['Phase'] ?? '').trim()
    const title = String(row['Title'] ?? '').trim()
    const startDate = parseExcelDate(row['Start'])
    const endDate = parseExcelDate(row['End'])
    const isComplete = row['Complete'] === true || String(row['Complete']).toLowerCase() === 'true'
    const percentComplete = parseAmount(row['Percent Complete'])
    const duration = parseAmount(row['Duration'])
    const assignedTo = String(row['Assigned To'] ?? '').trim() || null

    if (phase.toUpperCase() === 'AP') {
      // AP entry
      if (!jobCode) continue
      const job = await getJob(jobCode)
      if (!job) continue

      const amount = parseAmount(title) // Title stores dollar amount for AP
      const existingAp = await prisma.aPEntry.findFirst({
        where: { jobId: job.id, title, vendorName: assignedTo, dueDate: sameTime(startDate) },
      })
      if (existingAp) {
        // Keep an in-app "paid" mark even if BuilderTrend hasn't caught up
        await prisma.aPEntry.update({ where: { id: existingAp.id }, data: { amount, isPaid: existingAp.isPaid || isComplete } })
        updated++
      } else {
        await prisma.aPEntry.create({
          data: { jobId: job.id, vendorName: assignedTo, amount, dueDate: startDate, isPaid: isComplete, title },
        })
        added++
      }
    } else {
      // Milestone / schedule item
      if (!jobCode) continue
      const job = await getJob(jobCode)
      if (!job) continue

      const data = {
        startDate, endDate, isComplete,
        percentComplete: Math.round(percentComplete),
        duration: Math.round(duration),
        assignedTo,
      }
      const existingMs = await prisma.milestone.findFirst({
        where: { jobId: job.id, source: 'import', phase: phase || 'General', title, startDate: sameTime(startDate), id: { notIn: [...touchedMilestones] } },
      })
      if (existingMs) {
        await prisma.milestone.update({ where: { id: existingMs.id }, data })
        touchedMilestones.add(existingMs.id)
        updated++
      } else {
        const created = await prisma.milestone.create({
          data: { jobId: job.id, phase: phase || 'General', title, ...data, source: 'import' },
        })
        touchedMilestones.add(created.id)
        added++
      }
    }
  }

  // Remove imported milestones (and duplicates from earlier imports) no longer in BuilderTrend for these jobs
  const jobIds = [...jobCache.values()].filter(Boolean).map((j: any) => j.id)
  if (jobIds.length) {
    await prisma.milestone.deleteMany({
      where: { jobId: { in: jobIds }, source: 'import', id: { notIn: [...touchedMilestones] } },
    })
  }

  return { added, updated, unchanged }
}

async function processLeads(rows: Record<string, any>[], type: string) {
  let added = 0, updated = 0, unchanged = 0
  const warnings: string[] = []

  // Warn if basic leads with few rows
  if (type === 'leads_basic' && rows.length < 100) {
    warnings.push('This export may be filtered by date \u2014 check BuilderTrend export settings to include all leads')
  }

  const users = await prisma.user.findMany({ select: { id: true, name: true } })
  const userMap: Record<string, string> = {}
  users.forEach((u: any) => { userMap[u.name.toLowerCase().trim()] = u.id })

  const staleDaysConfig = await prisma.systemConfig.findUnique({ where: { key: 'stale_lead_days' } })
  const staleDays = parseInt(staleDaysConfig?.value ?? '30', 10)

  for (const row of rows) {
    const oppTitle = String(row['Opportunity Title'] ?? '').trim()
    if (!oppTitle) continue

    const confidence = parsePercentage(row['Confidence'])
    const revMin = parseAmount(row['Estimated Revenue Min'])
    const revMax = parseAmount(row['Estimated Revenue Max'])
    const midRev = (revMin + revMax) / 2
    const weightedValue = midRev * confidence

    // Determine salesperson
    const spName = String(row['Salesperson'] ?? row['Email'] ?? '').split(',')[0]?.trim() ?? ''
    const spId = userMap[spName.toLowerCase()] ?? null

    // Check staleness
    const lastContacted = parseExcelDate(row['Last Contacted'])
    const createdDate = parseExcelDate(row['Created Date'])
    const lastActivity = lastContacted ?? createdDate
    const daysSinceActivity = lastActivity ? Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)) : 999
    const isStale = daysSinceActivity > staleDays

    const data: any = {
      clientContact: String(row['Client Contact'] ?? '').trim() || null,
      firstName: String(row['First Name'] ?? '').trim() || null,
      lastName: String(row['Last Name'] ?? '').trim() || null,
      confidence,
      estimatedRevMin: revMin,
      estimatedRevMax: revMax,
      estimatedRevenue: String(row['Estimated Revenue'] ?? '').trim() || null,
      weightedValue,
      leadStatus: String(row['Lead Status'] ?? 'Open').trim(),
      proposalStatus: String(row['Proposal Status...'] ?? '').trim() || null,
      hasBeenContacted: String(row['Has Opportunity Been Contacted?'] ?? '').trim() || null,
      projectType: String(row['Project Type'] ?? '').trim() || null,
      source: String(row['Source'] ?? '').trim() || null,
      salespersonId: spId,
      salespersonName: String(row['Salesperson'] ?? '').trim() || null,
      createdDate,
      lastContacted,
      lastActivityDate: lastActivity,
      isStale,
      age: String(row['Age'] ?? '').trim() || null,
    }

    // Expanded leads have more fields
    if (type === 'leads_expanded') {
      data.email = String(row['Email Address'] ?? row['Email'] ?? '').trim() || null
      data.phone = String(row['Phone'] ?? '').trim() || null
      data.cellPhone = String(row['Cell Phone'] ?? '').trim() || null
      data.cityContact = String(row['City (Contact)'] ?? '').trim() || null
      data.stateContact = String(row['State (Contact)'] ?? '').trim() || null
      data.streetContact = String(row['Street Address (Contact)'] ?? '').trim() || null
      data.zipContact = String(row['Zip (Contact)'] ?? '').trim() || null
      data.cityOpp = String(row['City(Opp)'] ?? '').trim() || null
      data.stateOpp = String(row['State(Opp)'] ?? '').trim() || null
      data.streetOpp = String(row['Street Address(Opp)'] ?? '').trim() || null
      data.zipOpp = String(row['Zip(Opp)'] ?? '').trim() || null
      data.notes = String(row['Notes'] ?? '').trim() || null
      data.tags = String(row['Tags'] ?? '').trim() || null
      data.soldDate = parseExcelDate(row['Sold Date'])
      data.projectedSalesDate = parseExcelDate(row['Projected Sales Date'])
      data.projectStart = parseExcelDate(row['Project Start*'])
      data.substantialCompletion = parseExcelDate(row['Substantial Completion*'])

      // Link to job if Related Job exists
      const relatedJob = String(row['Related Job'] ?? '').trim()
      if (relatedJob) {
        const relCode = extractJobCode(relatedJob)
        if (relCode) {
          const job = await prisma.job.findUnique({ where: { jobCode: relCode } })
          if (job) data.linkedJobId = job.id
        }
      }
    } else {
      data.email = String(row['Email'] ?? '').trim() || null
      data.projectStart = parseExcelDate(row['Project Start*'])
      data.substantialCompletion = parseExcelDate(row['Substantial Completion*'])
    }

    // Upsert by opportunity title
    const existing = await prisma.lead.findFirst({ where: { opportunityTitle: oppTitle } })
    if (existing) {
      // Keep a PM assigned in the app when BuilderTrend has none mapped to a login
      await prisma.lead.update({ where: { id: existing.id }, data: spId ? data : { ...data, salespersonId: undefined } })
      updated++
    } else {
      await prisma.lead.create({ data: { opportunityTitle: oppTitle, ...data } })
      added++
    }

    // Auto-action items for missing contact
    if (!data.email && !data.phone && !data.cellPhone && spId) {
      const desc = `Missing contact info for lead: ${oppTitle}`
      const existingAction = await prisma.actionItem.findFirst({ where: { description: desc, status: 'open' } })
      if (!existingAction) {
        const lead = await prisma.lead.findFirst({ where: { opportunityTitle: oppTitle } })
        await prisma.actionItem.create({
          data: {
            description: desc,
            assignedToId: spId,
            category: 'missing_contact',
            source: 'import',
            leadId: lead?.id,
            priority: 'low',
          },
        })
      }
    }
  }

  return { added, updated, unchanged, warnings }
}
