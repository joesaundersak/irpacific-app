'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { BarChart3, Filter, AlertTriangle, Info } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'

const ForecastChart = dynamic(() => import('./forecast-chart'), { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading chart...</div> })

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const formatMonth = (m: string) => { const [y, mo] = m.split('-'); return `${MONTHS[parseInt(mo ?? '1') - 1]} ${y?.slice(2)}` }

export function ForecastClient() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [f, setF] = useState({ includeLeads: false, minConfidence: '60', state: 'all', pm: 'all', type: 'all', months: '12' })

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users ?? [])).catch(console.error)
  }, [])

  useEffect(() => {
    const p = new URLSearchParams()
    p.set('includeLeads', String(f.includeLeads))
    p.set('minConfidence', f.minConfidence)
    p.set('months', f.months)
    if (f.state !== 'all') p.set('state', f.state)
    if (f.pm !== 'all') p.set('pm', f.pm)
    if (f.type !== 'all') p.set('type', f.type)
    setLoading(true)
    fetch(`/api/forecast?${p}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [f])

  const rows: any[] = data?.rows ?? []
  const months: string[] = data?.months ?? []
  const showLeads = f.includeLeads
  const set = (k: keyof typeof f, v: any) => setF(prev => ({ ...prev, [k]: v }))

  return (
    <div className="space-y-6">
      <PageHeader title="Revenue Forecast" description="Progress-billing forecast for scheduled projects, with optional weighted lead opportunities" />

      <FadeIn>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium"><Filter className="h-4 w-4 text-primary" />Filters</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Include Leads</Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch checked={f.includeLeads} onCheckedChange={(v) => set('includeLeads', v)} />
                  <span className="text-xs text-muted-foreground">{f.includeLeads ? 'On' : 'Off'}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lead Confidence</Label>
                <Select value={f.minConfidence} onValueChange={(v) => set('minConfidence', v)} disabled={!f.includeLeads}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['0', '25', '50', '60', '75', '90'].map(c => <SelectItem key={c} value={c}>{c === '0' ? 'All leads' : `${c}% or more`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">State</Label>
                <Select value={f.state} onValueChange={(v) => set('state', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All states</SelectItem>
                    <SelectItem value="WA">Washington</SelectItem>
                    <SelectItem value="OR">Oregon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Project Manager</Label>
                <Select value={f.pm} onValueChange={(v) => set('pm', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All PMs</SelectItem>
                    <SelectItem value="none">No PM assigned</SelectItem>
                    {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Project Type</Label>
                <Select value={f.type} onValueChange={(v) => set('type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="install">Install</SelectItem>
                    <SelectItem value="product">Product sale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horizon</Label>
                <Select value={f.months} onValueChange={(v) => set('months', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['6', '12', '18', '24'].map(m => <SelectItem key={m} value={m}>{m} months</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Scheduled Projects', value: formatCurrency(data?.totals?.projects ?? 0), sub: `${data?.projects?.length ?? 0} projects` },
            { label: 'Weighted Leads', value: showLeads ? formatCurrency(data?.totals?.leads ?? 0) : '—', sub: showLeads ? `${data?.leads?.length ?? 0} leads ≥ ${f.minConfidence}%` : 'Leads off' },
            { label: 'Forecast Total', value: formatCurrency((data?.totals?.projects ?? 0) + (showLeads ? data?.totals?.leads ?? 0 : 0)), sub: `Next ${f.months} months` },
            { label: 'Excluded (No Schedule)', value: formatCurrency(data?.excluded?.value ?? 0), sub: `${data?.excluded?.count ?? 0} projects`, warn: (data?.excluded?.count ?? 0) > 0 },
          ].map((k, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-lg font-bold tracking-tight ${k.warn ? 'text-red-600' : ''}`}>{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </FadeIn>

      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />{f.months}-Month Billing Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading forecast...</div>
            ) : rows.every(r => r.total === 0) ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground text-sm text-center px-6">No forecast revenue for these filters. Only projects with schedule dates are forecast — add phase dates on the project pages, or include leads.</div>
            ) : (
              <ForecastChart data={rows} showLeads={showLeads} />
            )}
            {data?.model && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5 mt-3">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Install projects bill by phase: {data.model.phases.map((p: any) => `${p.label} ${p.bill}%`).join(' · ')}. Actual schedule dates are used for each phase; missing phases use default timeline shares. Product sales bill {data.model.productDeposit}% at PO and the balance at delivery. Already-invoiced or earned amounts are excluded. Leads are weighted by confidence. Adjust in Settings.
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Monthly Breakdown</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Scheduled Projects</TableHead>
                    {showLeads && <TableHead className="text-right">Weighted Leads</TableHead>}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium text-sm">{formatMonth(row.month)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.projects)}</TableCell>
                      {showLeads && <TableCell className="text-right text-sm">{formatCurrency(row.leads)}</TableCell>}
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(row.total)}</TableCell>
                    </TableRow>
                  ))}
                  {(data?.beyond?.projects > 0 || (showLeads && data?.beyond?.leads > 0)) && (
                    <TableRow>
                      <TableCell className="text-sm text-muted-foreground">Beyond horizon</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(data.beyond.projects)}</TableCell>
                      {showLeads && <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(data.beyond.leads)}</TableCell>}
                      <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(data.beyond.projects + (showLeads ? data.beyond.leads : 0))}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Scheduled Projects by Month</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>PM</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    {months.map(m => <TableHead key={m} className="text-right whitespace-nowrap">{formatMonth(m)}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.projects ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={3 + months.length} className="text-center text-sm text-muted-foreground py-6">No scheduled projects match these filters</TableCell></TableRow>
                  ) : (data?.projects ?? []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        <Link href={`/projects/${p.id}`} className="font-medium text-primary hover:underline">{p.jobCode}</Link>
                        <span className="text-muted-foreground"> {p.name?.slice(0, 32)}</span>
                        {p.type === 'product' && <Badge variant="outline" className="ml-1 text-[10px]">Product</Badge>}
                        {p.missing?.length > 0 && <Badge className="ml-1 text-[10px] bg-amber-100 text-amber-700">{p.missing.length} phase{p.missing.length > 1 ? 's' : ''} est.</Badge>}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{p.pm ?? <Badge className="text-[10px] bg-red-100 text-red-700">No PM</Badge>}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(p.remaining)}</TableCell>
                      {p.monthly.map((v: number, i: number) => <TableCell key={i} className="text-right text-xs text-muted-foreground whitespace-nowrap">{v ? formatCurrency(v) : '—'}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {showLeads && (
        <FadeIn>
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Lead Opportunities (≥ {f.minConfidence}% confidence)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opportunity</TableHead>
                      <TableHead className="text-right">Conf.</TableHead>
                      <TableHead className="text-right">Est. Value</TableHead>
                      <TableHead className="text-right">Weighted</TableHead>
                      {months.map(m => <TableHead key={m} className="text-right whitespace-nowrap">{formatMonth(m)}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.leads ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={4 + months.length} className="text-center text-sm text-muted-foreground py-6">No open leads at this confidence level</TableCell></TableRow>
                    ) : (data?.leads ?? []).map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {l.title?.slice(0, 40)}
                          {!l.salesperson && <Badge className="ml-1 text-[10px] bg-red-100 text-red-700">No PM</Badge>}
                        </TableCell>
                        <TableCell className="text-right text-sm">{l.confidence}%</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(l.fullValue)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(l.value)}</TableCell>
                        {l.monthly.map((v: number, i: number) => <TableCell key={i} className="text-right text-xs text-muted-foreground whitespace-nowrap">{v ? formatCurrency(v) : '—'}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {(data?.excluded?.count ?? 0) > 0 && (
        <FadeIn>
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4" />Not in Forecast — {data.excluded.count} projects without a schedule ({formatCurrency(data.excluded.value)} remaining)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>PM</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.excluded.jobs.map((j: any) => (
                      <TableRow key={j.id}>
                        <TableCell className="text-sm">
                          <Link href={`/projects/${j.id}`} className="font-medium text-primary hover:underline">{j.jobCode}</Link>
                          <span className="text-muted-foreground"> {j.name?.slice(0, 40)}</span>
                        </TableCell>
                        <TableCell className="text-sm">{j.pm ?? <Badge className="text-[10px] bg-red-100 text-red-700">No PM</Badge>}</TableCell>
                        <TableCell className="text-sm capitalize">{j.type}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(j.remaining)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  )
}
