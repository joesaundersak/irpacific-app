/* Data-quality checks: imports never reject a record; gaps are listed here, badged in the UI and flagged as action items. */
import { isPlaceholderJobCode } from '@/lib/import-parser'

export function jobMissingInfo(j: any): string[] {
  const missing: string[] = []
  if (isPlaceholderJobCode(j.jobCode)) missing.push('job code (WA/OR#) in the BuilderTrend job name')
  const price = (j.contractPrice ?? 0) + (j.approvedCOPrice ?? 0)
  if (price <= 0 && (j.totalRevisedPrice ?? 0) <= 0 && (j.revisedPrice ?? 0) <= 0) missing.push('contract price')
  if (!j.clientEmail && !j.clientPhone) missing.push('client email/phone')
  if (!j.state) missing.push('state (WA/OR)')
  return missing
}

export function leadMissingInfo(l: any): string[] {
  const missing: string[] = []
  if (l.opportunityTitle?.startsWith('Untitled lead')) missing.push('opportunity title')
  if ((l.estimatedRevMin ?? 0) <= 0 && (l.estimatedRevMax ?? 0) <= 0) missing.push('estimated revenue')
  if (!l.confidence) missing.push('confidence %')
  if (!l.email && !l.phone && !l.cellPhone) missing.push('contact email/phone')
  if (!l.projectedSalesDate && !l.projectStart) missing.push('projected sales date or project start')
  return missing
}

export const JOB_INFO_FIELDS = { jobCode: true, contractPrice: true, approvedCOPrice: true, totalRevisedPrice: true, revisedPrice: true, clientEmail: true, clientPhone: true, state: true } as const
export const LEAD_INFO_FIELDS = { opportunityTitle: true, estimatedRevMin: true, estimatedRevMax: true, confidence: true, email: true, phone: true, cellPhone: true, projectedSalesDate: true, projectStart: true } as const
