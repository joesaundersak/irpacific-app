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
import { Receipt, AlertTriangle, FileText, Wallet, ArrowUpDown, Info } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'
import { OpenInvoices, type OpenInvoice } from './open-invoices'

type Row = {
  id: string; jobCode: string; jobName: string; state: string | null; status: string; clientName: string | null
  pmId: string | null; pmName: string | null; percentComplete: number; completed: boolean
  contract: number; invoiced: number; paid: number; earned: number; btBalance: number
  outstanding: number; credit: number; readyToBill: number; remaining: number
}
type View = 'outstanding' | 'ready' | 'remaining' | 'credit' | 'all'
type SortKey = 'jobName' | 'clientName' | 'pmName' | 'percentComplete' | 'contract' | 'invoiced' | 'paid' | 'outstanding' | 'readyToBill' | 'remaining' | 'btBalance'

const VIEW_LABELS: Record<View, string> = {
  outstanding: 'Outstanding (invoiced, unpaid)', ready: 'Ready to bill', remaining: 'Remaining to collect', credit: 'Customer credits', all: 'All jobs',
}
const inView = (r: Row, v: View) =>
  v === 'outstanding' ? r.outstanding > 0 : v === 'ready' ? r.readyToBill > 0 : v === 'remaining' ? r.remaining > 0 : v === 'credit' ? r.credit > 0 : true
const DEFAULT_SORT: Record<View, SortKey> = { outstanding: 'outstanding', ready: 'readyToBill', remaining: 'remaining', credit: 'paid', all: 'jobName' }

export function ReceivablesClient() {
  const [rows, setRows] = useState<Row[]>([])
  const [asOf, setAsOf] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<OpenInvoice[]>([])
  const [invoiceCount, setInvoiceCount] = useState(0)
  const [invoicesAsOf, setInvoicesAsOf] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('outstanding')
  const [pm, setPm] = useState('all')
  const [state, setState] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'outstanding', dir: 'desc' })

  useEffect(() => {
    fetch('/api/receivables')
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed to load'); return d })
      .then(d => {
        setRows(d.rows ?? []); setAsOf(d.asOf ?? null)
        setInvoices(d.invoices ?? []); setInvoiceCount(d.invoiceCount ?? 0); setInvoicesAsOf(d.invoicesAsOf ?? null)
      })
      .catch(e => { console.error(e); setError(e.message) })
      .finally(() => setLoading(false))
  }, [])

  const pms = useMemo(() => Array.from(new Set(rows.map(r => r.pmName).filter(Boolean) as string[])).sort(), [rows])
  const states = useMemo(() => Array.from(new Set(rows.map(r => r.state).filter(Boolean) as string[])).sort(), [rows])

  const base = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (pm !== 'all' && (pm === 'none' ? r.pmName : r.pmName !== pm)) return false
      if (state !== 'all' && r.state !== state) return false
      if (q && !`${r.jobName} ${r.jobCode} ${r.clientName ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, pm, state, search])

  const kpis = useMemo(() => {
    const k = (v: View, f: keyof Row) => { const l = base.filter(r => inView(r, v)); return { amount: l.reduce((s, r) => s + (r[f] as number), 0), count: l.length } }
    return { outstanding: k('outstanding', 'outstanding'), ready: k('ready', 'readyToBill'), remaining: k('remaining', 'remaining'), credit: k('credit', 'credit') }
  }, [base])

  const filtered = useMemo(() => {
    const list = base.filter(r => inView(r, view))
    const { key, dir } = sort
    return [...list].sort((a, b) => {
      const av = a[key] ?? '', bv = b[key] ?? ''
      const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return dir === 'asc' ? c : -c
    })
  }, [base, view, sort])

  const totals = useMemo(() => filtered.reduce((t, r) => ({
    contract: t.contract + r.contract, invoiced: t.invoiced + r.invoiced, paid: t.paid + r.paid, outstanding: t.outstanding + r.outstanding,
    readyToBill: t.readyToBill + r.readyToBill, remaining: t.remaining + r.remaining, btBalance: t.btBalance + r.btBalance,
  }), { contract: 0, invoiced: 0, paid: 0, outstanding: 0, readyToBill: 0, remaining: 0, btBalance: 0 }), [filtered])

  const pickView = (v: View) => { setView(v); setSort({ key: DEFAULT_SORT[v], dir: v === 'all' ? 'asc' : 'desc' }) }
  const toggleSort = (key: SortKey) => setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: ['jobName', 'clientName', 'pmName'].includes(key) ? 'asc' : 'desc' })
  const hasFilters = pm !== 'all' || state !== 'all' || search

  const SortHead = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <TableHead className={right ? 'text-right' : ''}>
      <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 hover:text-foreground ${sort.key === k ? 'text-foreground font-semibold' : ''}`}>
        {label}<ArrowUpDown className="h-3 w-3" />
      </button>
    </TableHead>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Receivables" description={`Customer invoicing and payments from BuilderTrend — read-only${asOf ? ` • Jobsites data as of ${formatDate(asOf)}` : ''}`} />

      {error && <Card><CardContent className="p-4 text-sm text-red-600">{error}</CardContent></Card>}

      <FadeIn>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi active={view === 'outstanding'} icon={<AlertTriangle className="h-4 w-4" />} color="text-red-500" label="Outstanding (invoiced, unpaid)" value={kpis.outstanding} onClick={() => pickView('outstanding')} />
          <Kpi active={view === 'ready'} icon={<FileText className="h-4 w-4" />} color="text-amber-600" label="Ready to Bill (earned, not invoiced)" value={kpis.ready} onClick={() => pickView('ready')} />
          <Kpi active={view === 'remaining'} icon={<Receipt className="h-4 w-4" />} color="text-primary" label="Remaining to Collect on Contracts" value={kpis.remaining} onClick={() => pickView('remaining')} />
          <Kpi active={view === 'credit'} icon={<Wallet className="h-4 w-4" />} color="text-green-600" label="Customer Credits (paid ahead)" value={kpis.credit} onClick={() => pickView('credit')} />
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" />Receivables by Job</CardTitle>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Show</Label>
                <Select value={view} onValueChange={(v) => pickView(v as View)}>
                  <SelectTrigger className="w-[230px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(VIEW_LABELS) as View[]).map(v => <SelectItem key={v} value={v}>{VIEW_LABELS[v]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Project manager</Label>
                <Select value={pm} onValueChange={setPm}>
                  <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All PMs</SelectItem>
                    {pms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    <SelectItem value="none">No PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Search</Label>
                <Input className="h-9 w-[220px]" placeholder="Job or client" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setPm('all'); setState('all'); setSearch('') }}>Clear</Button>}
              <p className="text-xs text-muted-foreground ml-auto">{filtered.length} jobs</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead k="jobName" label="Job" />
                    <SortHead k="clientName" label="Client" />
                    <SortHead k="pmName" label="PM" />
                    <SortHead k="percentComplete" label="% Done" right />
                    <SortHead k="contract" label="Contract" right />
                    <SortHead k="invoiced" label="Invoiced" right />
                    <SortHead k="paid" label="Paid" right />
                    <SortHead k="outstanding" label="Outstanding" right />
                    <SortHead k="readyToBill" label="Ready to Bill" right />
                    <SortHead k="remaining" label="Remaining" right />
                    <SortHead k="btBalance" label="BT Client Balance" right />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">{rows.length === 0 ? 'No receivables data. Import a BuilderTrend Jobsites export.' : 'No jobs match this view.'}</TableCell></TableRow>
                  ) : (
                    <>
                      {filtered.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm max-w-[260px]">
                            <Link href={`/projects/${r.id}`} className="text-primary hover:underline line-clamp-2" title={r.jobName}>{r.jobName}</Link>
                            {r.completed && <Badge variant="secondary" className="mt-1 text-[10px]">Completed</Badge>}
                          </TableCell>
                          <TableCell className="text-sm max-w-[180px] truncate" title={r.clientName ?? ''}>{r.clientName ?? '—'}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{r.pmName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-right text-sm">{Math.round(r.percentComplete)}%</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(r.contract)}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(r.invoiced)}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(r.paid)}</TableCell>
                          <TableCell className={`text-right text-sm font-medium ${r.outstanding > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{formatCurrency(r.outstanding)}</TableCell>
                          <TableCell className={`text-right text-sm ${r.readyToBill > 0 ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}>{formatCurrency(r.readyToBill)}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(r.remaining)}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(r.btBalance)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell className="text-sm" colSpan={4}>Total ({filtered.length})</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(totals.contract)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(totals.invoiced)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(totals.paid)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(totals.outstanding)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(totals.readyToBill)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(totals.remaining)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(totals.btBalance)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {!loading && (
        <FadeIn delay={0.12}>
          <OpenInvoices invoices={invoices} invoiceCount={invoiceCount} asOf={invoicesAsOf} pm={pm} state={state} search={search} />
        </FadeIn>
      )}

      <FadeIn delay={0.15}>
        <Card>
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <p className="flex items-center gap-1 font-medium text-foreground"><Info className="h-3.5 w-3.5 text-primary" />How these numbers are calculated</p>
            <p><b>Outstanding</b> = Amount Invoiced − Payments Received (Jobsites export). <b>Ready to Bill</b> = Earned Revenue (WIP export) − Invoiced. <b>Remaining</b> = Revised Contract − Paid. <b>Credits</b> = Paid − Invoiced when the customer paid ahead.</p>
            <p><b>BT Client Balance</b> is shown exactly as BuilderTrend exports it; it can include unbilled change orders, so it may differ from Outstanding.</p>
            <p><b>Open Invoices &amp; Aging</b> come from the BuilderTrend Invoices export: balance on Pending/Sent and Partially Paid invoices, aged by the invoice Deadline. Draft invoices haven&apos;t been sent, so they&apos;re listed separately and not counted as late. The job filters above apply to both tables.</p>
            <p>Everything is read-only — make changes in BuilderTrend and re-import.</p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

function Kpi({ icon, color, label, value, onClick, active }: { icon: React.ReactNode; color: string; label: string; value: { amount: number; count: number }; onClick: () => void; active: boolean }) {
  return (
    <Card className={`cursor-pointer hover:shadow-md transition-shadow ${active ? 'ring-2 ring-primary' : ''}`} onClick={onClick}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${color}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{formatCurrency(value.amount)}</p>
          <p className="text-[11px] text-muted-foreground">{value.count} {value.count === 1 ? 'job' : 'jobs'}</p>
        </div>
      </CardContent>
    </Card>
  )
}
