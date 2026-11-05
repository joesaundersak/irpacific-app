'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BarChart3, AlertTriangle, Info, Target } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { ForecastFilters, CollapsibleCard } from '@/components/forecast-filters'
import { useSharedFilters, filterParams } from '@/lib/use-shared-filters'

const ForecastChart = dynamic(() => import('./forecast-chart'), { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading chart...</div> })

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const formatMonth = (m: string) => { const [y, mo] = m.split('-'); return `${MONTHS[parseInt(mo ?? '1') - 1]} ${y?.slice(2)}` }

export function ForecastClient() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const { f, set, ready, refresh } = useSharedFilters()
  const [targetForm, setTargetForm] = useState({ revenue: '', margin: '25' })
  const [savingTargets, setSavingTargets] = useState(false)
  const { data: session } = useSession() || {}
  const isAdmin = session?.user?.role === 'Admin'

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users ?? [])).catch(console.error)
  }, [])

  useEffect(() => {
    if (!ready) return
    const p = filterParams(f, { includeLeads: String(f.includeLeads), months: f.months })
    setLoading(true)
    fetch(`/api/forecast?${p}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [f, ready])

  const rows: any[] = data?.rows ?? []
  const months: string[] = data?.months ?? []
  const showLeads = f.includeLeads

  const revenueTarget: number = data?.targets?.revenueMonthly ?? 0
  const targetMargin: number = data?.targets?.marginPct ?? 25
  const hasRevTarget = revenueTarget > 0
  const forecastTotal = (data?.totals?.projects ?? 0) + (showLeads ? data?.totals?.leads ?? 0 : 0)
  const profitTotal: number = data?.totals?.profit ?? 0
  const projMargin = forecastTotal > 0 ? (profitTotal / forecastTotal) * 100 : 0
  const revTargetTotal = revenueTarget * rows.length
  const profitTargetTotal = revTargetTotal * targetMargin / 100
  const monthsOnTarget = rows.filter(r => r.total >= revenueTarget).length

  useEffect(() => {
    if (data?.targets) setTargetForm({ revenue: data.targets.revenueMonthly ? String(data.targets.revenueMonthly) : '', margin: String(data.targets.marginPct ?? 25) })
  }, [data?.targets?.revenueMonthly, data?.targets?.marginPct])

  const saveTargets = async () => {
    const rev = parseFloat(targetForm.revenue || '0')
    const mar = parseFloat(targetForm.margin || '0')
    if (isNaN(rev) || rev < 0 || isNaN(mar) || mar < 0 || mar > 100) { toast.error('Enter a valid revenue target and a margin between 0 and 100'); return }
    setSavingTargets(true)
    try {
      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ forecast_target_revenue_monthly: String(rev), forecast_target_margin: String(mar) }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error ?? 'Failed to save targets'); return }
      toast.success('Targets saved')
      refresh()
    } catch { toast.error('Failed to save targets') } finally { setSavingTargets(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Revenue Forecast" description="Progress-billing forecast for scheduled projects, with optional weighted lead opportunities" />

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
              <div className="h-[400px] flex items-center justify-center text-muted-foreground text-sm text-center px-6">No forecast revenue for these filters. Only projects with schedule dates are forecast — enter the schedule in BuilderTrend and re-import, or include leads.</div>
            ) : (
              <ForecastChart data={rows} showLeads={showLeads} showTarget={hasRevTarget} />
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
        <ForecastFilters f={f} set={set} users={users} storageKey="irp_forecast_filters_open" />
      </FadeIn>
      <FadeIn>
        <CollapsibleCard title="Targets" icon={<Target className="h-4 w-4 text-primary" />} storageKey="irp_forecast_targets_open" summary={hasRevTarget ? `${formatCurrency(revenueTarget)}/mo · ${targetMargin}% margin` : 'No revenue target set'}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Monthly revenue target ($)</Label>
                <Input type="number" min="0" step="1000" className="h-9 w-[170px]" value={targetForm.revenue} onChange={(e) => setTargetForm(t => ({ ...t, revenue: e.target.value }))} disabled={!isAdmin} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Target profit margin (%)</Label>
                <Input type="number" min="0" max="100" step="0.5" className="h-9 w-[150px]" value={targetForm.margin} onChange={(e) => setTargetForm(t => ({ ...t, margin: e.target.value }))} disabled={!isAdmin} />
              </div>
              {isAdmin ? (
                <Button size="sm" onClick={saveTargets} disabled={savingTargets}>{savingTargets ? 'Saving…' : 'Save Targets'}</Button>
              ) : <p className="text-xs text-muted-foreground">Only an Admin can change targets.</p>}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Revenue vs Target ({f.months} mo)</p>
                <p className={`text-lg font-bold ${hasRevTarget ? (forecastTotal >= revTargetTotal ? 'text-green-600' : 'text-red-600') : ''}`}>{hasRevTarget ? `${Math.round((forecastTotal / revTargetTotal) * 100)}%` : '—'}</p>
                <p className="text-xs text-muted-foreground">{hasRevTarget ? `${formatCurrency(forecastTotal)} of ${formatCurrency(revTargetTotal)}` : 'Set a monthly revenue target'}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Projected Profit</p>
                <p className="text-lg font-bold">{formatCurrency(profitTotal)}</p>
                <p className={`text-xs ${forecastTotal > 0 && projMargin < targetMargin ? 'text-red-600' : 'text-muted-foreground'}`}>{forecastTotal > 0 ? `${projMargin.toFixed(1)}% margin (target ${targetMargin}%)` : 'No forecast revenue'}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Profit vs Target ({f.months} mo)</p>
                <p className={`text-lg font-bold ${hasRevTarget ? (profitTotal >= profitTargetTotal ? 'text-green-600' : 'text-red-600') : ''}`}>{hasRevTarget ? `${Math.round((profitTotal / Math.max(1, profitTargetTotal)) * 100)}%` : '—'}</p>
                <p className="text-xs text-muted-foreground">{hasRevTarget ? `${formatCurrency(profitTotal)} of ${formatCurrency(profitTargetTotal)}` : 'Needs a revenue target'}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Months at/above Target</p>
                <p className="text-lg font-bold">{hasRevTarget ? `${monthsOnTarget} / ${rows.length}` : '—'}</p>
                <p className="text-xs text-muted-foreground">{hasRevTarget ? `Target ${formatCurrency(revenueTarget)}/mo` : 'Set a monthly revenue target'}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Projected profit uses each project’s projected margin from BuilderTrend (WIP); projects without one, and leads, use the target margin.</p>
          </div>
        </CollapsibleCard>
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
                    <TableHead className="text-right">Total Revenue</TableHead>
                    {hasRevTarget && <TableHead className="text-right">Revenue Target</TableHead>}
                    {hasRevTarget && <TableHead className="text-right">vs Target</TableHead>}
                    <TableHead className="text-right">Projected Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    {hasRevTarget && <TableHead className="text-right">Profit Target</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any) => {
                    const diff = row.total - (row.revenueTarget ?? 0)
                    const m = row.total > 0 ? (row.profit / row.total) * 100 : 0
                    return (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium text-sm">{formatMonth(row.month)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(row.projects)}</TableCell>
                        {showLeads && <TableCell className="text-right text-sm">{formatCurrency(row.leads)}</TableCell>}
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(row.total)}</TableCell>
                        {hasRevTarget && <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(row.revenueTarget)}</TableCell>}
                        {hasRevTarget && <TableCell className={`text-right text-sm font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>{diff >= 0 ? '+' : '−'}{formatCurrency(Math.abs(diff))}</TableCell>}
                        <TableCell className="text-right text-sm">{formatCurrency(row.profit)}</TableCell>
                        <TableCell className={`text-right text-sm ${row.total > 0 && m < targetMargin ? 'text-red-600' : ''}`}>{row.total > 0 ? `${m.toFixed(1)}%` : '—'}</TableCell>
                        {hasRevTarget && <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(row.profitTarget)}</TableCell>}
                      </TableRow>
                    )
                  })}
                  {(data?.beyond?.projects > 0 || (showLeads && data?.beyond?.leads > 0)) && (
                    <TableRow>
                      <TableCell className="text-sm text-muted-foreground">Beyond horizon</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(data.beyond.projects)}</TableCell>
                      {showLeads && <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(data.beyond.leads)}</TableCell>}
                      <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(data.beyond.projects + (showLeads ? data.beyond.leads : 0))}</TableCell>
                      <TableCell colSpan={hasRevTarget ? 5 : 2} />
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
