'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { BarChart3 } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'

const ForecastChart = dynamic(() => import('./forecast-chart'), { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading chart...</div> })

interface ForecastData {
  month: string
  conservative: number
  base: number
  optimistic: number
}

export function ForecastClient() {
  const [data, setData] = useState<ForecastData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/forecast')
      .then(r => r.json())
      .then(d => setData(d.forecast ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const formatMonth = (m: string) => {
    const [y, mo] = m.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${months[parseInt(mo ?? '1') - 1]} ${y?.slice(2)}`
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Revenue Forecast" description="Projected revenue across three scenarios" />

      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              12-Month Revenue Projection
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading forecast...</div>
            ) : data.length === 0 ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">No data available. Import project and lead data first.</div>
            ) : (
              <ForecastChart data={data} />
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Monthly Breakdown</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Conservative</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Optimistic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row: ForecastData) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium text-sm">{formatMonth(row.month)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.conservative)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(row.base)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(row.optimistic)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
