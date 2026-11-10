'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Clock } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'

export type OpenInvoice = {
  id: string; invoiceNumber: string; title: string | null; status: string; isDraft: boolean; bucket: Bucket
  jobId: string | null; jobCode: string; jobName: string; state: string | null; pmId: string | null; pmName: string | null
  ownerName: string | null; total: number; paid: number; balance: number; deadline: string | null; daysPastDue: number | null
}
type Bucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90' | 'draft'

const BUCKETS: { key: Bucket; label: string; color: string }[] = [
  { key: 'current', label: 'Not yet due', color: 'text-green-700' },
  { key: 'd1_30', label: '1–30 days late', color: 'text-amber-600' },
  { key: 'd31_60', label: '31–60 days late', color: 'text-orange-600' },
  { key: 'd61_90', label: '61–90 days late', color: 'text-red-600' },
  { key: 'd90', label: '90+ days late', color: 'text-red-700' },
  { key: 'draft', label: 'Drafts (not sent)', color: 'text-muted-foreground' },
]

export function OpenInvoices({ invoices, invoiceCount, asOf, pm, state, search }: {
  invoices: OpenInvoice[]; invoiceCount: number; asOf: string | null; pm: string; state: string; search: string
}) {
  const [bucket, setBucket] = useState<Bucket | 'sent'>('sent')

  const base = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invoices.filter(i => {
      if (pm !== 'all' && (pm === 'none' ? i.pmName : i.pmName !== pm)) return false
      if (state !== 'all' && i.state !== state) return false
      if (q && !`${i.jobName} ${i.jobCode} ${i.ownerName ?? ''} ${i.invoiceNumber} ${i.title ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [invoices, pm, state, search])

  const sums = useMemo(() => {
    const s: Record<string, { amount: number; count: number }> = {}
    BUCKETS.forEach(b => { s[b.key] = { amount: 0, count: 0 } })
    base.forEach(i => { s[i.bucket].amount += i.balance; s[i.bucket].count++ })
    return s
  }, [base])

  const sent = base.filter(i => !i.isDraft)
  const sentTotal = sent.reduce((t, i) => t + i.balance, 0)
  const list = bucket === 'sent' ? sent : base.filter(i => i.bucket === bucket)
  const listTotal = list.reduce((t, i) => t + i.balance, 0)

  if (invoiceCount === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Import the BuilderTrend <b className="text-foreground">Invoices</b> export on the <Link href="/imports" className="text-primary hover:underline">Imports</Link> page to see open invoices with due dates and aging.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Open Invoices &amp; Aging</CardTitle>
          <p className="text-xs text-muted-foreground">
            Sent &amp; unpaid: <b className="text-foreground">{formatCurrency(sentTotal)}</b> on {sent.length} invoice{sent.length === 1 ? '' : 's'}{asOf ? ` • Invoices as of ${formatDate(asOf)}` : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {BUCKETS.map(b => (
            <button key={b.key} type="button" onClick={() => setBucket(bucket === b.key ? 'sent' : b.key)}
              className={`rounded-lg border p-3 text-left hover:shadow-sm transition-shadow ${bucket === b.key ? 'ring-2 ring-primary border-transparent' : ''}`}>
              <p className="text-[11px] text-muted-foreground">{b.label}</p>
              <p className={`text-base font-bold ${b.color}`}>{formatCurrency(sums[b.key].amount)}</p>
              <p className="text-[11px] text-muted-foreground">{sums[b.key].count} invoice{sums[b.key].count === 1 ? '' : 's'}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {bucket === 'sent' ? 'all sent, unpaid invoices' : BUCKETS.find(b => b.key === bucket)?.label.toLowerCase()} — click a box to filter, click again to show all sent.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Days Late</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No open invoices in this view.</TableCell></TableRow>
              ) : (
                <>
                  {list.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="text-sm">
                        <div className="font-medium whitespace-nowrap">{i.invoiceNumber}</div>
                        {i.title && <div className="text-xs text-muted-foreground max-w-[200px] truncate" title={i.title}>{i.title}</div>}
                      </TableCell>
                      <TableCell className="text-sm max-w-[240px]">
                        {i.jobId
                          ? <Link href={`/projects/${i.jobId}`} className="text-primary hover:underline line-clamp-2" title={i.jobName}>{i.jobName}</Link>
                          : <span className="line-clamp-2" title={i.jobName}>{i.jobName}</span>}
                        {i.pmName && <div className="text-[11px] text-muted-foreground">PM: {i.pmName}</div>}
                      </TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate" title={i.ownerName ?? ''}>{i.ownerName ?? '—'}</TableCell>
                      <TableCell><Badge variant={i.isDraft ? 'secondary' : 'outline'} className="text-[10px] whitespace-nowrap">{i.status}</Badge></TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(i.total)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(i.paid)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(i.balance)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{i.deadline ? formatDate(i.deadline) : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className={`text-right text-sm ${i.daysPastDue && i.daysPastDue > 0 && !i.isDraft ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {i.daysPastDue == null || i.isDraft ? '—' : i.daysPastDue > 0 ? i.daysPastDue : 'Not due'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell className="text-sm" colSpan={6}>Total ({list.length})</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(listTotal)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
