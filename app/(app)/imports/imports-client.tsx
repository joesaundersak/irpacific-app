'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'

export function ImportsClient() {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [lastResult, setLastResult] = useState<any>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => setHistory(d?.recentImports ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
      const data = await res.json()

      if (res.ok) {
        setLastResult(data)
        const flagged = data?.flags?.created ?? 0
        toast.success(`Import complete: ${data?.records?.added ?? 0} added, ${data?.records?.updated ?? 0} updated${flagged ? `, ${flagged} flagged for missing info` : ''}`)
        // Reload history
        fetch('/api/dashboard').then(r => r.json()).then(d => setHistory(d?.recentImports ?? []))
      } else {
        toast.error(data?.error ?? 'Import failed')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  return (
    <div className="space-y-6">
      <PageHeader title="Import Data" description="Upload BuilderTrend export files to sync project and lead data" />

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
                {uploading ? 'Processing file...' : 'Drag & drop a BuilderTrend export here'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports: Jobsites, WIP Report, Schedule, Leads (.xls, .xlsx)
              </p>
              <input
                type="file"
                className="hidden"
                accept=".xls,.xlsx"
                onChange={onFileSelect}
                disabled={uploading}
              />
            </label>
          </CardContent>
        </Card>
      </FadeIn>

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
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" />Import History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Imported By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No imports yet</TableCell></TableRow>
                ) : (
                  history.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-sm font-medium">{h.fileName}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{h.fileType}</Badge></TableCell>
                      <TableCell className="text-sm">{h.recordsProcessed}</TableCell>
                      <TableCell className="text-sm">{h.importedBy}</TableCell>
                      <TableCell className="text-sm">{formatDate(h.createdAt)}</TableCell>
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
