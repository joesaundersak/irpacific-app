'use client'

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'
import { formatCurrency } from '@/lib/format'

interface ForecastChartProps {
  data: { month: string; projects: number; leads: number; total: number; profit: number; revenueTarget?: number; profitTarget?: number }[]
  showLeads: boolean
  showTarget?: boolean
}

const formatMonth = (m: string) => {
  const [y, mo] = m.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(mo ?? '1') - 1]} ${y?.slice(2)}`
}

export default function ForecastChart({ data, showLeads, showTarget }: ForecastChartProps) {
  return (
    <div className="h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
          <XAxis dataKey="month" tickFormatter={formatMonth} tickLine={false} tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={(v: any) => `$${(Number(v) / 1000).toFixed(0)}k`} tickLine={false} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: any) => formatCurrency(Number(v))} labelFormatter={formatMonth} contentStyle={{ fontSize: 11 }} />
          <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="projects" stackId="a" fill="#1A7B84" name="Scheduled Projects" />
          {showLeads && <Bar dataKey="leads" stackId="a" fill="#FF9149" name="Weighted Leads" radius={[3, 3, 0, 0]} />}
          <Line type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} name="Projected Profit" />
          {showTarget && <Line type="stepAfter" dataKey="revenueTarget" stroke="#dc2626" strokeDasharray="6 4" strokeWidth={2} dot={false} name="Revenue Target" />}
          {showTarget && <Line type="stepAfter" dataKey="profitTarget" stroke="#9333ea" strokeDasharray="3 3" strokeWidth={1.5} dot={false} name="Profit Target" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
