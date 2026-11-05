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

const BT_EXPORTS = [
  {
    name: 'Jobsites',
    where: 'Jobs → Jobs List. Show all jobs (open and closed) with all columns, then Export to Excel.',
    feeds: 'Job codes, names, PM, client, contract price, status and Job Groups ("Product Only" marks product sales).',
  },
  {
    name: 'Work in Progress (WIP) Report',
    where: 'Reports → Work in Progress report for all open jobs, then Export to Excel.',
    feeds: 'Revised price, projected and actual costs, invoiced amount and % complete (margin, at-risk jobs and the forecast).',
  },
  {
    name: 'Schedule – All Listed Jobs',
    where: 'Schedule → List view with All Listed Jobs selected, then Export to Excel.',
    feeds: 'Phase dates (Contracting/Pre-Con, Procurement, Installation, Punch List, Completion, PO Due Date, Customer Delivery) and AP items (Phase = AP).',
  },
  {
    name: 'Lead Opportunities',
    where: 'Sales → Lead Opportunities list with all columns shown (including Related Job, Tags, Confidence and estimated revenue), then Export to Excel.',
    feeds: 'Sales pipeline, confidence %, salesperson, Tags ("Product Only") and weighted leads in the forecast.',
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
        title="What to export from BuilderTrend"
        icon={<ListChecks className="h-4 w-4 text-primary" />}
        storageKey="irp_import_help_open"
        summary="4 exports: Jobsites, WIP, Schedule, Lead Opportunities"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Export these four reports from BuilderTrend as Excel files (.xls or .xlsx) and drop them all in the box below at once.
          The app recognizes each file automatically, so file names and order don&apos;t matter. Import all four together so the numbers line up.
        </p>
        <ol className="grid gap-3 md:grid-cols-2">
          {BT_EXPORTS.map((x, i) => (
            <li key={x.name} className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-semibold"><span className="text-primary">{i + 1}.</span> {x.name}</p>
              <p className="text-sm mt-1"><span className="font-medium">Where:</span> {x.where}</p>
              <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">Used for:</span> {x.feeds}</p>
            </li>
          ))}
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
                Supports: Jobsites, WIP Report, Schedule, Leads (.xls, .xlsx)
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
