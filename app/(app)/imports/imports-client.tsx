'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, ListChecks } from 'lucide-react'
import { CollapsibleCard } from '@/components/forecast-filters'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'

type BtExport = { name: string; types: string[]; where: string; filters: string[]; columns: string; feeds: string }

const BT_EXPORTS: BtExport[] = [
  {
    name: 'Jobsites (Jobs List)',
    types: ['jobsites'],
    where: 'Jobs → Jobs List (list view of all jobs) → Export → Excel.',
    filters: [
      'Job Status: All (Open, Closed and Warranty) — not just Open.',
      'Clear any Project Manager, Job Group or date filters.',
    ],
    columns: 'Job Name, Status, Groups (Job Group), Project Manager, Client info, Contract Price, Approved CO Price, Amount Invoiced, Payments Received, Client Balance, Actual Start / Completion.',
    feeds: 'Jobs, PMs, clients, contract values, Receivables, and Job Group "Product Only" (product sales).',
  },
  {
    name: 'Work in Progress (WIP) Report',
    types: ['wip'],
    where: 'Reports → Financial → Work in Progress → Export → Excel.',
    filters: [
      'Jobs: all open jobs (no PM or Job Group filter).',
      'As-of date: today.',
    ],
    columns: 'Job name, Revised price, Projected costs, Actual costs, % complete of job, Earned revenue, Over/under billing.',
    feeds: 'Margins, at-risk jobs, earned revenue (Ready to Bill) and the forecast.',
  },
  {
    name: 'Schedule — All Listed Jobs',
    types: ['schedule'],
    where: 'Schedule → List view → Job picker: All Listed Jobs → Export → Excel.',
    filters: [
      'Date range: none / all dates (include past and future items).',
      'Show completed items: on.',
      'Phase column must be included (items with Phase "AP" become payables).',
    ],
    columns: 'Job, Title, Phase, Start, End, Duration, Complete, Percent Complete, Assigned To.',
    feeds: 'Phase dates for the forecast and schedule flags, plus the AP Calendar.',
  },
  {
    name: 'Lead Opportunities',
    types: ['leads_expanded', 'leads_basic'],
    where: 'Sales → Lead Opportunities → List view → Export → Excel.',
    filters: [
      'Status: All (Open, Sold, Lost, On Hold) — not just Open.',
      'No date or salesperson filter.',
      'Use the column chooser to show all columns before exporting.',
    ],
    columns: 'Opportunity Title, Status, Confidence, Estimated Revenue Min / Max, Salesperson, Related Job, Tags, Projected Sales Date, Last Contacted.',
    feeds: 'Pipeline, follow-up escalation, Tag "Product Only", and weighted leads in the forecast.',
  },
  {
    name: 'Invoices (Owner Invoices)',
    types: ['invoices'],
    where: 'Financial → Invoices (owner/client invoices, All Listed Jobs) → Export → Excel.',
    filters: [
      'Jobs: All Listed Jobs.',
      'Status: All (Draft, Pending/Sent, Partially Paid, Paid) — not just unpaid.',
      'No deadline or date filter.',
    ],
    columns: 'Job, ID#, Title, Status, Total Price, Amount Paid, Invoice Balance, Deadline, Date Paid, OwnerName.',
    feeds: 'Open invoices, due dates and aging (1–30 / 31–60 / 61–90 / 90+ days late) on Receivables.',
  },
]

export function ImportsClient() {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [lastResult, setLastResult] = useState<any>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const loadHistory = useCallback(() => {
    return fetch('/api/imports/history')
      .then(r => r.json())
      .then(d => setHistory(d?.imports ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const handleUpload = useCallback(async (file: File) => {
    if (!file) return
    const validTypes = ['.xls', '.xlsx', '.csv']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!validTypes.includes(ext)) {
      toast.error('Please upload an Excel file (.xls or .xlsx)')
      return
    }

    setUploading(true)
    setLastResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/import', { method: 'POST', body: formData })
      const text = await res.text()
      let data: any = null
      try { data = JSON.parse(text) } catch { /* non-JSON reply (proxy/timeout page) */ }

      if (res.ok && data?.success) {
        setLastResult(data)
        const flagged = data?.flags?.created ?? 0
        toast.success(`${file.name}: ${data?.records?.added ?? 0} added, ${data?.records?.updated ?? 0} updated${flagged ? `, ${flagged} flagged for missing info` : ''}`)
        // Reload history
        loadHistory()
      } else {
        const msg = data?.error ?? `Server returned ${res.status} ${res.statusText}${text ? ` — ${text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)}` : ''}`
        console.error('Import failed:', file.name, msg)
        setUploadError(prev => (prev ? prev + '\n' : '') + `${file.name}: ${msg}`)
        toast.error(msg)
      }
    } catch (e: any) {
      const msg = `${file.name}: upload failed (${e?.message ?? 'network error'})`
      console.error(msg)
      setUploadError(prev => (prev ? prev + '\n' : '') + msg)
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }, [loadHistory])

  // Several exports can be dropped at once; they are imported one after another
  const handleFiles = useCallback(async (files: FileList | null | undefined) => {
    setUploadError(null)
    for (const file of Array.from(files ?? [])) await handleUpload(file)
  }, [handleUpload])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer?.files)
  }, [handleFiles])

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target?.files)
    e.target.value = ''
  }, [handleFiles])

  return (
    <div className="space-y-6">
      <PageHeader title="Import Data" description="Upload BuilderTrend export files to sync project and lead data" />

      <CollapsibleCard
        title="Required BuilderTrend reports"
        icon={<ListChecks className="h-4 w-4 text-primary" />}
        storageKey="irp_import_reports_open"
        summary={`${BT_EXPORTS.length} exports: ${BT_EXPORTS.map(x => x.name.split(' (')[0].split(' —')[0]).join(', ')}`}
      >
        <p className="text-sm text-muted-foreground mb-4">
          Export these {BT_EXPORTS.length} reports from BuilderTrend as Excel files (.xls or .xlsx) with the filters below, then drop them all in the box at once.
          The app recognizes each file automatically, so file names and order don&apos;t matter. Import them together so the numbers line up.
          If a BuilderTrend menu is named slightly differently in your account, use the closest list view and apply the same filters.
        </p>
        <ol className="grid gap-3 lg:grid-cols-2">
          {BT_EXPORTS.map((x, i) => {
            const last = history.find((h: any) => x.types.includes(h.fileType))
            return (
              <li key={x.name} className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold"><span className="text-primary">{i + 1}.</span> {x.name}</p>
                  {!loading && (last
                    ? <Badge variant="outline" className="text-[10px] whitespace-nowrap">Last imported {new Date(last.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Badge>
                    : <Badge variant="secondary" className="text-[10px] whitespace-nowrap text-amber-700">Not imported yet</Badge>)}
                </div>
                <p className="text-sm"><span className="font-medium">Where:</span> {x.where}</p>
                <div className="text-sm">
                  <span className="font-medium">Filters to set:</span>
                  <ul className="list-disc pl-5 mt-0.5 space-y-0.5">
                    {x.filters.map(f => <li key={f}>{f}</li>)}
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground"><span className="font-medium">Columns needed:</span> {x.columns}</p>
                <p className="text-xs text-muted-foreground"><span className="font-medium">Used for:</span> {x.feeds}</p>
              </li>
            )
          })}
        </ol>
        <p className="text-xs text-muted-foreground mt-4">
          Don&apos;t edit the files before uploading. Missing data never blocks an import; it&apos;s flagged as an action item so it can be fixed in BuilderTrend and re-imported.
        </p>
      </CollapsibleCard>

      {/* Drop Zone */}
      <FadeIn>
        <Card>
          <CardContent className="p-0">
            <label
              className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              {uploading ? (
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              )}
              <p className="text-sm font-medium">
                {uploading ? 'Processing file...' : 'Drag & drop BuilderTrend exports here (one or several)'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports: Jobsites, WIP Report, Schedule, Lead Opportunities, Invoices (.xls, .xlsx)
              </p>
              <input
                type="file"
                className="hidden"
                accept=".xls,.xlsx"
                multiple
                onChange={onFileSelect}
                disabled={uploading}
              />
            </label>
          </CardContent>
        </Card>
      </FadeIn>

      {uploadError && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Import did not complete</p>
          <p className="mt-1 whitespace-pre-line break-words">{uploadError}</p>
        </div>
      )}

      {/* Last Result */}
      {lastResult && (
        <FadeIn>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Import Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">File Type</p>
                  <p className="text-sm font-bold">{lastResult?.fileType ?? '—'}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Processed</p>
                  <p className="text-sm font-bold">{lastResult?.records?.processed ?? 0}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Added</p>
                  <p className="text-sm font-bold text-green-600">{lastResult?.records?.added ?? 0}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Updated</p>
                  <p className="text-sm font-bold text-blue-600">{lastResult?.records?.updated ?? 0}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Unchanged</p>
                  <p className="text-sm font-bold">{lastResult?.records?.unchanged ?? 0}</p>
                </div>
              </div>
              {(lastResult?.records?.skipped ?? 0) > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {lastResult.records.skipped} row(s) could not be read and were skipped — all other rows were imported.
                </p>
              )}
              {(lastResult?.warnings?.length ?? 0) > 0 && (
                <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-700 text-sm font-medium mb-1">
                    <AlertTriangle className="h-4 w-4" /> Notes & records flagged for update
                  </div>
                  {(lastResult?.warnings ?? []).map((w: string, i: number) => (
                    <p key={i} className="text-xs text-amber-600">{w}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Import History */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" />Import History{history.length > 0 && <span className="text-muted-foreground font-normal">({history.length})</span>}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Added / Updated</TableHead>
                  <TableHead>Imported By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : history.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No imports yet</TableCell></TableRow>
                ) : (
                  history.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-sm font-medium">{h.fileName}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{h.fileType}</Badge></TableCell>
                      <TableCell className="text-sm">{h.recordsProcessed}</TableCell>
                      <TableCell className="text-sm"><span className="text-green-600">{h.recordsAdded}</span> / <span className="text-blue-600">{h.recordsUpdated}</span></TableCell>
                      <TableCell className="text-sm">{h.importedBy}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{new Date(h.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
