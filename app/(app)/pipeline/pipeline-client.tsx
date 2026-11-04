'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { TrendingUp, AlertCircle, Clock, DollarSign, ArrowUpDown, UserPlus } from 'lucide-react'
import { formatCurrency, formatPercent, formatDate, daysSince } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'

interface Lead {
  id: string; opportunityTitle: string; clientContact: string | null; confidence: number
  estimatedRevMin: number; estimatedRevMax: number; weightedValue: number
  leadStatus: string; proposalStatus: string | null; isStale: boolean
  lastActivityDate: string | null; createdDate: string | null; age: string | null
  salesperson: { id: string; name: string } | null
  linkedJob: { id: string; jobCode: string } | null
  email: string | null; phone: string | null; cellPhone: string | null
}

export function PipelineClient() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ salesperson: '', stale: '', status: '' })
  const [users, setUsers] = useState<any[]>([])

  const loadData = useCallback(() => {
    const params = new URLSearchParams()
    if (filter.salesperson) params.set('salesperson', filter.salesperson)
    if (filter.stale === 'true') params.set('stale', 'true')
    if (filter.status) params.set('status', filter.status)

    fetch(`/api/pipeline?${params}`)
      .then((r) => r.json())
      .then((d) => { setLeads(d.leads ?? []); setSummary(d.summary ?? null) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users ?? [])).catch(console.error)
  }, [])

  const handleConvert = async (leadId: string) => {
    try {
      const res = await fetch('/api/pipeline/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Converted to project ${data.jobCode}`)
        loadData()
      } else {
        toast.error(data.error ?? 'Failed to convert')
      }
    } catch { toast.error('Failed to convert lead') }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Sales Pipeline" description="Track leads, proposals, and conversion opportunities" />

      {/* Summary Strip */}
      <FadeIn>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.1}>
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3">
            <Select value={filter.salesperson} onValueChange={(v) => setFilter(f => ({ ...f, salesperson: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Salespeople" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Salespeople</SelectItem>
                {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filter.stale} onValueChange={(v) => setFilter(f => ({ ...f, stale: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads</SelectItem>
                <SelectItem value="true">Stale Only</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
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
                            {!lead.email && !lead.phone && !lead.cellPhone && (
                              <span title="Missing contact info"><AlertCircle className="h-3 w-3 text-red-400" /></span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{lead.salesperson?.name ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(lead.estimatedRevMin)} – {formatCurrency(lead.estimatedRevMax)}
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatPercent(lead.confidence * 100)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(lead.weightedValue)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{lead.proposalStatus ?? '—'}</Badge></TableCell>
                        <TableCell>
                          {lead.linkedJob ? (
                            <Badge className="text-xs bg-green-100 text-green-700">Converted</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">{lead.leadStatus}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!lead.linkedJob && (
                            <Button size="sm" variant="outline" onClick={() => handleConvert(lead.id)}>
                              <UserPlus className="h-3 w-3 mr-1" /> Convert
                            </Button>
                          )}
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
