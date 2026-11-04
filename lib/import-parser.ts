/* BuilderTrend import file parser */
import * as XLSX from 'xlsx'

export type FileType = 'jobsites' | 'wip' | 'schedule' | 'leads_expanded' | 'leads_basic' | 'unknown'

// Known header signatures for auto-detect
const SIGNATURES: Record<FileType, string[]> = {
  jobsites: ['Job Name', 'Client Email', 'Client Phone', 'Groups', 'Contract Price'],
  wip: ['Job name', 'Revised price', 'Projected costs', 'Actual costs', '% complete of job'],
  schedule: ['Job', 'Title', 'Complete', 'Phase', 'Duration', 'Start', 'End'],
  leads_expanded: ['Opportunity Title', 'Confidence', 'Estimated Revenue Min', 'Estimated Revenue Max', 'Related Job', 'Salesperson'],
  leads_basic: ['Opportunity Title', 'Confidence', 'Estimated Revenue Min', 'Estimated Revenue Max', 'Salesperson'],
  unknown: [],
}

export function detectFileType(headers: string[]): FileType {
  const headerSet = new Set(headers.map((h: string) => h?.trim()))
  // Check most specific first
  if (headerSet.has('Related Job') && headerSet.has('Opportunity Title')) return 'leads_expanded'
  if (headerSet.has('Job Name') && headerSet.has('Client Email') && headerSet.has('Groups')) return 'jobsites'
  if (headerSet.has('Job name') && headerSet.has('Projected costs') && headerSet.has('% complete of job')) return 'wip'
  if (headerSet.has('Job') && headerSet.has('Phase') && headerSet.has('Duration') && headerSet.has('Start')) return 'schedule'
  if (headerSet.has('Opportunity Title') && headerSet.has('Confidence')) return 'leads_basic'
  return 'unknown'
}

export function extractJobCode(jobName: string): string | null {
  if (!jobName) return null
  const match = jobName.match(/((?:WA|OR)\d+)/i)
  return match ? match[1].toUpperCase().replace(/([A-Z]{2})(\d+)[A-Za-z]*$/, '$1$2') : null
}

export function parseExcelBuffer(buffer: Buffer): { headers: string[]; rows: Record<string, any>[] } {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName ?? '']
  if (!sheet) return { headers: [], rows: [] }

  // Try multiple header row positions (1, 2, 3 — 0-indexed)
  const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]
  
  let headerRowIdx = 0
  let bestScore = 0
  for (let i = 0; i < Math.min(5, allRows.length); i++) {
    const row = allRows[i] ?? []
    const nonEmpty = row.filter((c: any) => c !== '' && c != null).length
    // Also check if row contains known keywords
    const rowStr = row.join(' ').toLowerCase()
    let score = nonEmpty
    if (rowStr.includes('job') || rowStr.includes('title') || rowStr.includes('opportunity')) score += 10
    if (score > bestScore) {
      bestScore = score
      headerRowIdx = i
    }
  }

  const headers = (allRows[headerRowIdx] ?? []).map((h: any) => String(h ?? '').trim())
  const rows: Record<string, any>[] = []
  for (let i = headerRowIdx + 1; i < allRows.length; i++) {
    const row = allRows[i] ?? []
    // Skip empty rows
    if (row.every((c: any) => c === '' || c == null)) continue
    const obj: Record<string, any> = {}
    headers.forEach((h: string, idx: number) => {
      if (h) obj[h] = row[idx] ?? null
    })
    rows.push(obj)
  }
  return { headers, rows }
}

export function parseExcelDate(val: any): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  if (typeof val === 'number') {
    // Excel serial date
    const epoch = new Date(1899, 11, 30)
    epoch.setDate(epoch.getDate() + val)
    return epoch
  }
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

export function parseAmount(val: any): number {
  if (val == null || val === '') return 0
  if (typeof val === 'number') return val
  const cleaned = String(val).replace(/[^\d.\-]/g, '')
  return parseFloat(cleaned) || 0
}

export function parsePercentage(val: any): number {
  if (val == null || val === '') return 0
  if (typeof val === 'number') return val > 1 ? val / 100 : val
  const cleaned = String(val).replace(/[^\d.\-]/g, '')
  const num = parseFloat(cleaned) || 0
  return num > 1 ? num / 100 : num
}
