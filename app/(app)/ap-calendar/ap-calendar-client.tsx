'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Calendar, DollarSign, AlertTriangle, Clock } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'

export function APCalendarClient() {
  const [entries, setEntries] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    fetch('/api/ap')
      .then(r => r.json())
      .then(d => { setEntries(d.entries ?? []); setSummary(d.summary ?? null) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const togglePaid = async (id: string, isPaid: boolean) => {
    try {
      await fetch('/api/ap', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isPaid }),
      })
      toast.success(isPaid ? 'Marked as paid' : 'Marked as unpaid')
      loadData()
    } catch { toast.error('Failed to update') }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="AP Calendar" description="Accounts payable tracking from BuilderTrend schedule entries" />

      <FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-primary"><DollarSign className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Due This Month</p><p className="text-lg font-bold">{formatCurrency(summary?.thisMonthDue)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-blue-600"><Clock className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Due Next Month</p><p className="text-lg font-bold">{formatCurrency(summary?.nextMonthDue)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-red-500"><AlertTriangle className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Overdue</p><p className="text-lg font-bold">{formatCurrency(summary?.overdue)}</p></div>
          </CardContent></Card>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />AP Entries</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : entries.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No AP entries. Import a Schedule export.</TableCell></TableRow>
                  ) : (
                    entries.map((e: any) => (
                      <TableRow key={e.id} className={e.isPaid ? 'opacity-50' : ''}>
                        <TableCell className="text-sm"><span className="font-mono">{e.job?.jobCode}</span></TableCell>
                        <TableCell className="text-sm">{e.vendorName ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(e.amount)}</TableCell>
                        <TableCell className="text-sm">{formatDate(e.dueDate)}</TableCell>
                        <TableCell><Switch checked={e.isPaid} onCheckedChange={(v) => togglePaid(e.id, v)} /></TableCell>
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
