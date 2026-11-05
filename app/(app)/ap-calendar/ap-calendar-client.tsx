'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Calendar, DollarSign, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'

type Period = 'this_week' | 'next_week' | 'this_month' | 'next_month' | 'next_30' | 'custom'

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function periodRange(p: Period, today: Date, custom: { from: string; to: string }): { from: string; to: string } {
  const dow = today.getDay() // 0 = Sun
  const monday = addDays(today, dow === 0 ? -6 : 1 - dow)
  switch (p) {
    case 'this_week': return { from: ymd(monday), to: ymd(addDays(monday, 6)) }
    case 'next_week': return { from: ymd(addDays(monday, 7)), to: ymd(addDays(monday, 13)) }
    case 'this_month': return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0)) }
    case 'next_month': return { from: ymd(new Date(today.getFullYear(), today.getMonth() + 1, 1)), to: ymd(new Date(today.getFullYear(), today.getMonth() + 2, 0)) }
    case 'next_30': return { from: ymd(today), to: ymd(addDays(today, 30)) }
    case 'custom': return custom
  }
}

const PERIOD_LABELS: Record<Period, string> = {
  this_week: 'This Week', next_week: 'Next Week', this_month: 'This Month', next_month: 'Next Month', next_30: 'Next 30 Days', custom: 'Custom Dates',
}

export function APCalendarClient() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState<string>('')
  const [period, setPeriod] = useState<Period>('this_month')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [filters, setFilters] = useState({ status: 'all', search: '', from: '', to: '' })

  useEffect(() => {
    setToday(ymd(new Date()))
    fetch('/api/ap')
      .then(r => r.json())
      .then(d => setEntries(d.entries ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo(() => entries.map((e: any) => {
    const due = e.dueDate ? ymd(new Date(e.dueDate)) : ''
    const status = e.isPaid ? 'paid' : (due && today && due < today ? 'overdue' : 'unpaid')
    return { ...e, due, status }
  }), [entries, today])

  const range = useMemo(() => today ? periodRange(period, new Date(today + 'T00:00:00'), custom) : { from: '', to: '' }, [period, today, custom])

  const kpis = useMemo(() => {
    const inRange = (d: string) => !!d && (!range.from || d >= range.from) && (!range.to || d <= range.to)
    const sum = (list: any[]) => list.reduce((s, e) => s + (e.amount ?? 0), 0)
    const dueInPeriod = rows.filter(e => !e.isPaid && inRange(e.due))
    const paidInPeriod = rows.filter(e => e.isPaid && inRange(e.due))
    const overdue = rows.filter(e => e.status === 'overdue')
    const unpaid = rows.filter(e => !e.isPaid)
    return {
      dueInPeriod: { amount: sum(dueInPeriod), count: dueInPeriod.length },
      paidInPeriod: { amount: sum(paidInPeriod), count: paidInPeriod.length },
      overdue: { amount: sum(overdue), count: overdue.length },
      unpaid: { amount: sum(unpaid), count: unpaid.length },
    }
  }, [rows, range])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return rows.filter(e => {
      if (filters.status !== 'all' && e.status !== filters.status) return false
      if (filters.from && (!e.due || e.due < filters.from)) return false
      if (filters.to && (!e.due || e.due > filters.to)) return false
      if (q) {
        const hay = `${e.vendorName ?? ''} ${e.title ?? ''} ${e.job?.jobCode ?? ''} ${e.job?.jobName ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, filters])

  const filteredTotal = filtered.reduce((s, e) => s + (e.amount ?? 0), 0)
  const hasFilters = filters.status !== 'all' || filters.search || filters.from || filters.to

  return (
    <div className="space-y-6">
      <PageHeader title="AP Calendar" description="Accounts payable from the BuilderTrend schedule — status is read from BuilderTrend" actions={
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">KPI period</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIOD_LABELS) as Period[]).map(p => <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {period === 'custom' && (
            <>
              <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" className="h-9 w-[150px]" value={custom.from} onChange={(e) => setCustom(c => ({ ...c, from: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" className="h-9 w-[150px]" value={custom.to} onChange={(e) => setCustom(c => ({ ...c, to: e.target.value }))} /></div>
            </>
          )}
        </div>
      } />

      <FadeIn>
        <p className="text-xs text-muted-foreground mb-2">
          {PERIOD_LABELS[period]}{range.from || range.to ? `: ${range.from ? formatDate(range.from + 'T12:00:00') : '…'} – ${range.to ? formatDate(range.to + 'T12:00:00') : '…'}` : ''}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={<DollarSign className="h-4 w-4" />} color="text-primary" label={`Due — ${PERIOD_LABELS[period]}`} value={kpis.dueInPeriod} />
          <Kpi icon={<CheckCircle className="h-4 w-4" />} color="text-green-600" label={`Paid — ${PERIOD_LABELS[period]}`} value={kpis.paidInPeriod} />
          <Kpi icon={<AlertTriangle className="h-4 w-4" />} color="text-red-500" label="Overdue (unpaid, past due)" value={kpis.overdue} onClick={() => setFilters(f => ({ ...f, status: 'overdue' }))} />
          <Kpi icon={<Clock className="h-4 w-4" />} color="text-blue-600" label="Total Unpaid" value={kpis.unpaid} onClick={() => setFilters(f => ({ ...f, status: 'unpaid' }))} />
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />AP Entries</CardTitle>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Search vendor / job</Label>
                <Input className="h-9 w-[220px]" placeholder="Vendor, job code or name" value={filters.search} onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))} />
              </div>
              <div className="space-y-1"><Label className="text-xs">Due from</Label><Input type="date" className="h-9 w-[150px]" value={filters.from} onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Due to</Label><Input type="date" className="h-9 w-[150px]" value={filters.to} onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))} /></div>
              {hasFilters && <Button variant="ghost" size="sm" onClick={() => setFilters({ status: 'all', search: '', from: '', to: '' })}>Clear</Button>}
              <p className="text-xs text-muted-foreground ml-auto">{filtered.length} entries • {formatCurrency(filteredTotal)}</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status (BuilderTrend)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{entries.length === 0 ? 'No AP entries. Import a BuilderTrend Schedule export.' : 'No entries match these filters.'}</TableCell></TableRow>
                  ) : (
                    filtered.map((e: any) => (
                      <TableRow key={e.id} className={e.status === 'overdue' ? 'bg-red-50' : ''}>
                        <TableCell className="text-sm">
                          {e.jobId ? <Link href={`/projects/${e.jobId}`} className="font-mono text-primary hover:underline">{e.job?.jobCode}</Link> : <span className="font-mono">{e.job?.jobCode ?? '—'}</span>}
                        </TableCell>
                        <TableCell className="text-sm">{e.vendorName ?? '—'}</TableCell>
                        <TableCell className="text-sm max-w-[260px] truncate" title={e.title ?? ''}>{e.title ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(e.amount)}</TableCell>
                        <TableCell className="text-sm">{formatDate(e.dueDate)}</TableCell>
                        <TableCell>
                          {e.status === 'paid' ? <Badge className="text-xs bg-green-100 text-green-700">Paid</Badge>
                            : e.status === 'overdue' ? <Badge className="text-xs bg-red-100 text-red-700">Overdue</Badge>
                            : <Badge variant="secondary" className="text-xs">Unpaid</Badge>}
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

function Kpi({ icon, color, label, value, onClick }: { icon: React.ReactNode; color: string; label: string; value: { amount: number; count: number }; onClick?: () => void }) {
  return (
    <Card className={onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={onClick}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${color}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{formatCurrency(value.amount)}</p>
          <p className="text-[11px] text-muted-foreground">{value.count} {value.count === 1 ? 'entry' : 'entries'}</p>
        </div>
      </CardContent>
    </Card>
  )
}
