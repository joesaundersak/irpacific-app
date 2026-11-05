'use client'

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'
import { formatCurrency } from '@/lib/format'

interface ForecastChartProps {
  data: { month: string; projects: number; leads: number; total: number }[]
  showLeads: boolean
}

const formatMonth = (m: string) => {
  const [y, mo] = m.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(mo ?? '1') - 1]} ${y?.slice(2)}`
}

export default function ForecastChart({ data, showLeads }: ForecastChartProps) {
  return (
    <div className="h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
          <XAxis dataKey="month" tickFormatter={formatMonth} tickLine={false} tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={(v: any) => `$${(Number(v) / 1000).toFixed(0)}k`} tickLine={false} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: any) => formatCurrency(Number(v))} labelFormatter={formatMonth} contentStyle={{ fontSize: 11 }} />
          <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="projects" stackId="a" fill="#1A7B84" name="Scheduled Projects" />
          {showLeads && <Bar dataKey="leads" stackId="a" fill="#FF9149" name="Weighted Leads" radius={[3, 3, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
