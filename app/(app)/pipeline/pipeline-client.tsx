'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { TrendingUp, AlertCircle, Clock, DollarSign, ArrowUpDown, UserX } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'
import { AddActionItemDialog } from '@/components/add-action-item-dialog'
import { Label } from '@/components/ui/label'
import { ForecastFilters } from '@/components/forecast-filters'
import { useSharedFilters, filterParams } from '@/lib/use-shared-filters'

interface Lead {
  id: string; opportunityTitle: string; clientContact: string | null; confidence: number
  estimatedRevMin: number; estimatedRevMax: number; weightedValue: number
  leadStatus: string; proposalStatus: string | null; isStale: boolean
  lastActivityDate: string | null; createdDate: string | null; age: string | null
  salesperson: { id: string; name: string } | null
  linkedJob: { id: string; jobCode: string } | null
  email: string | null; phone: string | null; cellPhone: string | null
  noPm: boolean; salespersonName: string | null; missingInfo: string[]
}

export function PipelineClient() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ stale: '', status: '' })
  const [users, setUsers] = useState<any[]>([])
  const { f, set, ready } = useSharedFilters()

  const loadData = useCallback((isStale: () => boolean = () => false) => {
    const params = filterParams(f)
    if (filter.stale === 'true') params.set('stale', 'true')
    if (filter.stale === 'nopm') params.set('noPm', 'true')
    if (filter.stale === 'missing') params.set('missingInfo', 'true')
    if (filter.status) params.set('status', filter.status)

    fetch(`/api/pipeline?${params}`)
      .then((r) => r.json())
      .then((d) => { if (isStale()) return; setLeads(d.leads ?? []); setSummary(d.summary ?? null) })
      .catch(console.error)
      .finally(() => { if (!isStale()) setLoading(false) })
  }, [filter, f])

  useEffect(() => {
    if (!ready) return
    let stale = false
    loadData(() => stale)
    return () => { stale = true }
  }, [loadData, ready])
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users ?? [])).catch(console.error)
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Sales Pipeline" description="Track leads, proposals, and conversion opportunities" />

      {/* Summary Strip */}
      <FadeIn>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-primary"><TrendingUp className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Total Leads</p><p className="text-lg font-bold">{summary?.totalLeads ?? 0}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-green-600"><DollarSign className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Weighted Pipeline</p><p className="text-lg font-bold">{formatCurrency(summary?.weightedPipeline)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-blue-600"><ArrowUpDown className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Avg Confidence</p><p className="text-lg font-bold">{formatPercent((summary?.avgConfidence ?? 0) * 100)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-amber-500"><Clock className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Stale Leads</p><p className="text-lg font-bold">{summary?.staleCount ?? 0}</p></div>
          </CardContent></Card>
          <Card className="cursor-pointer" onClick={() => setFilter(f => ({ ...f, stale: 'nopm' }))}><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-red-600"><UserX className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">No PM Assigned</p><p className="text-lg font-bold text-red-600">{summary?.noPmCount ?? 0}</p></div>
          </CardContent></Card>
          <Card className="cursor-pointer" onClick={() => setFilter(f => ({ ...f, stale: 'missing' }))}><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-amber-600"><AlertCircle className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Missing Info</p><p className="text-lg font-bold text-amber-600">{summary?.missingInfoCount ?? 0}</p></div>
          </CardContent></Card>
        </div>
      </FadeIn>

      {/* Filters (shared with Dashboard and Forecast) */}
      <FadeIn delay={0.1}>
        <ForecastFilters
          f={f}
          set={set}
          users={users}
          fields={['minConfidence', 'state', 'pm', 'type']}
          pmLabel="Salesperson / PM"
          storageKey="irp_pipeline_filters_open"
          extra={
            <div className="space-y-1.5">
              <Label className="text-xs">Show</Label>
              <Select value={filter.stale || 'all'} onValueChange={(v) => setFilter(prev => ({ ...prev, stale: v === 'all' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Leads</SelectItem>
                  <SelectItem value="true">Stale Only</SelectItem>
                  <SelectItem value="nopm">No PM Assigned</SelectItem>
                  <SelectItem value="missing">Missing Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
      </FadeIn>

      {/* Leads Table */}
      <FadeIn delay={0.2}>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Opportunity</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="text-right">Est. Revenue</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                    <TableHead className="text-right">Weighted</TableHead>
                    <TableHead>Proposal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : leads.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No leads found. Import a BuilderTrend Leads export to get started.</TableCell></TableRow>
                  ) : (
                    leads.map((lead) => (
                      <TableRow key={lead.id} className={lead.isStale ? 'bg-amber-50' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-sm font-medium max-w-[250px] truncate">{lead.opportunityTitle}</p>
                              <p className="text-xs text-muted-foreground">{lead.clientContact ?? '—'}</p>
                            </div>
                            {lead.isStale && <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">Stale</Badge>}
                            {(lead.missingInfo?.length ?? 0) > 0 ? (
                              <Badge className="text-[10px] bg-amber-100 text-amber-800 whitespace-nowrap" title={`Missing: ${lead.missingInfo.join(', ')}`}>Missing info</Badge>
                            ) : !lead.email && !lead.phone && !lead.cellPhone && (
                              <span title="Missing contact info"><AlertCircle className="h-3 w-3 text-red-400" /></span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {lead.noPm ? (
                            <Badge className="text-[10px] bg-red-100 text-red-700" title={lead.salespersonName ? `BuilderTrend: ${lead.salespersonName} (not matched to a user) — fix in BuilderTrend` : 'No salesperson in BuilderTrend — fix in BuilderTrend'}>No PM</Badge>
                          ) : (lead.salesperson?.name ?? '—')}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(lead.estimatedRevMin)} – {formatCurrency(lead.estimatedRevMax)}
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatPercent(lead.confidence * 100)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(lead.weightedValue)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{lead.proposalStatus ?? '—'}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-xs">{lead.leadStatus}</Badge>
                            {lead.linkedJob && <Badge className="text-xs bg-green-100 text-green-700">{lead.linkedJob.jobCode}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <AddActionItemDialog
                            leadId={lead.id}
                            users={users}
                            defaultAssigneeId={lead.salesperson?.id}
                            defaultDescription={`Follow up: ${lead.opportunityTitle}`}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
