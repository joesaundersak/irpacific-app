'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ShoppingCart, CheckCircle2, FileWarning, Send, CircleSlash, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'

type Readiness = 'none' | 'drafts' | 'awaiting' | 'complete'
type Po = {
  id: string; poNumber: string; title: string | null; poStatus: string; statusGroup: string; workStatus: string | null
  performedBy: string | null; createdDate: string | null; cost: number; paidStatus: string | null; costCode: string | null
  varianceCode: string | null; estComplete: string | null
}
type Row = {
  id: string; jobCode: string; jobName: string; state: string | null; active: boolean; type: 'install' | 'product'
  pmName: string | null; salesperson: string | null; start: string | null; percentComplete: number
  readiness: Readiness; total: number; live: number; drafts: number; sent: number; approved: number; paidDrafts: number; voided: number
  poTotal: number; budget: number; coverage: number | null; pos: Po[]
}

const READY: Record<Readiness, { label: string; cls: string }> = {
  none: { label: 'No POs yet', cls: 'bg-red-100 text-red-700 border-red-200' },
  drafts: { label: 'Drafts to release', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  awaiting: { label: 'Awaiting vendor approval', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  complete: { label: 'Ready to proceed', cls: 'bg-green-100 text-green-700 border-green-200' },
}
const GROUP_CLS: Record<string, string> = {
  approved: 'text-green-700', internal: 'text-green-700', sent: 'text-blue-700', draft: 'text-amber-700', recalled: 'text-amber-700', voided: 'text-muted-foreground line-through', other: 'text-foreground',
}
const ORDER: Record<Readiness, number> = { none: 0, drafts: 1, awaiting: 2, complete: 3 }
const LOW_COVERAGE = 80

export function PurchaseOrdersClient() {
  const [rows, setRows] = useState<Row[]>([])
  const [poCount, setPoCount] = useState(0)
  const [unlinked, setUnlinked] = useState(0)
  const [asOf, setAsOf] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scope, setScope] = useState<'active' | 'all'>('active')
  const [readiness, setReadiness] = useState<'all' | 'incomplete' | Readiness>('incomplete')
  const [person, setPerson] = useState('all')
  const [state, setState] = useState('all')
  const [type, setType] = useState('all')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/purchase-orders')
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed to load'); return d })
      .then(d => { setRows(d.rows ?? []); setPoCount(d.poCount ?? 0); setUnlinked(d.unlinkedPos ?? 0); setAsOf(d.asOf ?? null) })
      .catch(e => { console.error(e); setError(e.message) })
      .finally(() => setLoading(false))
  }, [])

  const people = useMemo(() => Array.from(new Set(rows.flatMap(r => [r.pmName, r.salesperson]).filter(Boolean) as string[])).sort(), [rows])
  const states = useMemo(() => Array.from(new Set(rows.map(r => r.state).filter(Boolean) as string[])).sort(), [rows])

  const base = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (scope === 'active' && !r.active) return false
      if (person !== 'all' && (person === 'none' ? r.pmName : r.pmName !== person && r.salesperson !== person)) return false
      if (state !== 'all' && r.state !== state) return false
      if (type !== 'all' && r.type !== type) return false
      if (q && !`${r.jobName} ${r.jobCode} ${r.pos.map(p => `${p.poNumber} ${p.performedBy ?? ''} ${p.title ?? ''}`).join(' ')}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, scope, person, state, type, search])

  const counts = useMemo(() => {
    const c = { none: 0, drafts: 0, awaiting: 0, complete: 0 } as Record<Readiness, number>
    base.forEach(r => { c[r.readiness]++ })
    return c
  }, [base])

  const filtered = useMemo(() => base
    .filter(r => readiness === 'all' ? true : readiness === 'incomplete' ? r.readiness !== 'complete' : r.readiness === readiness)
    .sort((a, b) => ORDER[a.readiness] - ORDER[b.readiness] || a.jobName.localeCompare(b.jobName)), [base, readiness])

  const toggle = (id: string) => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const hasFilters = person !== 'all' || state !== 'all' || type !== 'all' || search || scope !== 'active'
  const pick = (v: typeof readiness) => setReadiness(cur => cur === v ? 'incomplete' : v)

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Orders" description={`Are each job's POs released and approved so the project can proceed? From BuilderTrend — read-only${asOf ? ` • POs as of ${formatDate(asOf)}` : ''}`} />

      {error && <Card><CardContent className="p-4 text-sm text-red-600">{error}</CardContent></Card>}
      {!loading && !error && poCount === 0 && (
        <Card><CardContent className="p-4 text-sm text-amber-800 bg-amber-50">No purchase orders imported yet. Export Purchase Orders from BuilderTrend (see Import Data for the steps) and import the file.</CardContent></Card>
      )}

      <FadeIn>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi active={readiness === 'none'} icon={<CircleSlash className="h-4 w-4" />} color="text-red-600" label="No POs yet" count={counts.none} onClick={() => pick('none')} />
          <Kpi active={readiness === 'drafts'} icon={<FileWarning className="h-4 w-4" />} color="text-amber-600" label="Drafts to release" count={counts.drafts} onClick={() => pick('drafts')} />
          <Kpi active={readiness === 'awaiting'} icon={<Send className="h-4 w-4" />} color="text-blue-600" label="Awaiting vendor approval" count={counts.awaiting} onClick={() => pick('awaiting')} />
          <Kpi active={readiness === 'complete'} icon={<CheckCircle2 className="h-4 w-4" />} color="text-green-600" label="Ready to proceed" count={counts.complete} onClick={() => pick('complete')} />
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" />PO Status by Job</CardTitle>
            <div className="flex flex-wrap items-end gap-3">
              <Filter label="Jobs" value={scope} onChange={v => setScope(v as 'active' | 'all')} width="w-[170px]" options={[['active', 'Active jobs'], ['all', 'All jobs with POs']]} />
              <Filter label="PO status" value={readiness} onChange={v => setReadiness(v as typeof readiness)} width="w-[200px]"
                options={[['incomplete', 'Not ready (needs action)'], ['all', 'All'], ...(Object.keys(READY) as Readiness[]).map(k => [k, READY[k].label] as [string, string])]} />
              <Filter label="PM / salesperson" value={person} onChange={setPerson} width="w-[180px]" options={[['all', 'Everyone'], ...people.map(p => [p, p] as [string, string]), ['none', 'No PM']]} />
              <Filter label="State" value={state} onChange={setState} width="w-[100px]" options={[['all', 'All'], ...states.map(s => [s, s] as [string, string])]} />
              <Filter label="Type" value={type} onChange={setType} width="w-[120px]" options={[['all', 'All'], ['install', 'Install'], ['product', 'Product only']]} />
              <div className="space-y-1">
                <Label className="text-xs">Search</Label>
                <Input className="h-9 w-[200px]" placeholder="Job, PO # or vendor" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setScope('active'); setPerson('all'); setState('all'); setType('all'); setSearch('') }}>Clear</Button>}
              <p className="text-xs text-muted-foreground ml-auto">{filtered.length} jobs</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Job</TableHead>
                    <TableHead>PM</TableHead>
                    <TableHead>Salesperson</TableHead>
                    <TableHead>PO Status</TableHead>
                    <TableHead className="text-right">Drafts</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead className="text-right">PO Total</TableHead>
                    <TableHead className="text-right">Cost Budget</TableHead>
                    <TableHead className="text-right">PO % of Budget</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No jobs match this view.</TableCell></TableRow>
                  ) : filtered.map(r => {
                    const isOpen = open.has(r.id)
                    return (
                      <Fragment key={r.id}>
                        <TableRow className={r.total ? 'cursor-pointer' : ''} onClick={() => r.total && toggle(r.id)}>
                          <TableCell className="px-2">{r.total > 0 && (isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}</TableCell>
                          <TableCell className="text-sm max-w-[280px]">
                            <Link href={`/projects/${r.id}`} onClick={e => e.stopPropagation()} className="text-primary hover:underline line-clamp-2" title={r.jobName}>{r.jobName}</Link>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {r.type === 'product' && <Badge variant="outline" className="text-[10px]">Product only</Badge>}
                              {!r.active && <Badge variant="secondary" className="text-[10px]">Not active</Badge>}
                              {r.start && <span className="text-[11px] text-muted-foreground">Start {formatDate(r.start)}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{r.pmName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{r.salesperson ?? <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell><Badge variant="outline" className={`text-[11px] whitespace-nowrap ${READY[r.readiness].cls}`}>{READY[r.readiness].label}</Badge></TableCell>
                          <TableCell className={`text-right text-sm ${r.drafts ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}>{r.drafts}</TableCell>
                          <TableCell className={`text-right text-sm ${r.sent ? 'text-blue-700 font-medium' : 'text-muted-foreground'}`}>{r.sent}</TableCell>
                          <TableCell className="text-right text-sm">{r.approved + r.paidDrafts}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(r.poTotal)}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{r.budget ? formatCurrency(r.budget) : '—'}</TableCell>
                          <TableCell className={`text-right text-sm ${r.coverage != null && r.coverage < LOW_COVERAGE ? 'text-amber-700 font-medium' : ''}`}>{r.coverage != null ? `${r.coverage}%` : '—'}</TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableCell />
                            <TableCell colSpan={10} className="py-3">
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead className="text-muted-foreground">
                                    <tr className="text-left">
                                      <th className="py-1 pr-3 font-medium">PO #</th><th className="py-1 pr-3 font-medium">Title</th><th className="py-1 pr-3 font-medium">Vendor</th>
                                      <th className="py-1 pr-3 font-medium">PO Status</th><th className="py-1 pr-3 font-medium">Work</th><th className="py-1 pr-3 font-medium">Paid</th>
                                      <th className="py-1 pr-3 font-medium">Created</th><th className="py-1 pr-3 font-medium">Est. Complete</th><th className="py-1 font-medium text-right">Cost</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.pos.map(p => (
                                      <tr key={p.id} className="border-t border-border/60">
                                        <td className="py-1.5 pr-3 whitespace-nowrap">{p.poNumber}</td>
                                        <td className="py-1.5 pr-3 max-w-[220px] truncate" title={p.title ?? ''}>{p.title ?? '—'}{p.varianceCode && <span className="ml-1 text-muted-foreground">(CO)</span>}</td>
                                        <td className="py-1.5 pr-3 max-w-[180px] truncate" title={p.performedBy ?? ''}>{p.performedBy ?? '—'}</td>
                                        <td className={`py-1.5 pr-3 max-w-[220px] truncate ${GROUP_CLS[p.statusGroup] ?? ''}`} title={p.poStatus}>{p.poStatus}</td>
                                        <td className="py-1.5 pr-3 max-w-[160px] truncate" title={p.workStatus ?? ''}>{p.workStatus?.replace(/ by .*/, '') ?? '—'}</td>
                                        <td className="py-1.5 pr-3 whitespace-nowrap">{p.paidStatus ?? '—'}</td>
                                        <td className="py-1.5 pr-3 whitespace-nowrap">{p.createdDate ? formatDate(p.createdDate) : '—'}</td>
                                        <td className="py-1.5 pr-3 whitespace-nowrap">{p.estComplete ? formatDate(p.estComplete) : '—'}</td>
                                        <td className="py-1.5 text-right whitespace-nowrap">{formatCurrency(p.cost)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.15}>
        <Card>
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <p className="flex items-center gap-1 font-medium text-foreground"><Info className="h-3.5 w-3.5 text-primary" />How PO status is decided</p>
            <p><b>No POs yet</b>: the job has no purchase orders (voided ones don&apos;t count). <b>Drafts to release</b>: at least one Draft or Recalled PO that isn&apos;t paid still has to be sent to the vendor. <b>Awaiting vendor approval</b>: POs are sent but not yet approved. <b>Ready to proceed</b>: every PO is Approved, Assigned Internally, or a Draft already marked Fully Paid (receipt-style purchases).</p>
            <p><b>PO % of Budget</b> compares the total of non-voided POs with the job&apos;s cost budget from the Jobsites/WIP export; below {LOW_COVERAGE}% is highlighted because POs may still be missing. Click a job to see its POs.</p>
            <p>Active jobs = open, not completed, under 100% and not &quot;Commission Paid&quot;. Everything is read-only — create or release POs in BuilderTrend and re-import.{unlinked > 0 && ` ${unlinked} PO(s) belong to jobs not in the app yet (import Jobsites).`}</p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

function Filter({ label, value, onChange, options, width }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; width: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={`${width} h-9`}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  )
}

function Kpi({ icon, color, label, count, onClick, active }: { icon: React.ReactNode; color: string; label: string; count: number; onClick: () => void; active: boolean }) {
  return (
    <Card className={`cursor-pointer hover:shadow-md transition-shadow ${active ? 'ring-2 ring-primary' : ''}`} onClick={onClick}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${color}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{count}</p>
          <p className="text-[11px] text-muted-foreground">{count === 1 ? 'job' : 'jobs'}</p>
        </div>
      </CardContent>
    </Card>
  )
}
