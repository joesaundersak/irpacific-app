'use client'

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/format'

interface ForecastChartProps {
  data: { month: string; conservative: number; base: number; optimistic: number }[]
}

const formatMonth = (m: string) => {
  const [y, mo] = m.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(mo ?? '1') - 1]} ${y?.slice(2)}`
}

export default function ForecastChart({ data }: ForecastChartProps) {
  return (
    <div className="h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 30 }}>
          <XAxis dataKey="month" tickFormatter={formatMonth} tickLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tickFormatter={(v: any) => `$${(Number(v) / 1000).toFixed(0)}k`} tickLine={false} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: any) => formatCurrency(Number(v))} labelFormatter={formatMonth} contentStyle={{ fontSize: 11 }} />
          <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="optimistic" stroke="#FF9149" fill="#FF914920" name="Optimistic" />
          <Area type="monotone" dataKey="base" stroke="#1A7B84" fill="#1A7B8430" name="Base (Weighted)" />
          <Area type="monotone" dataKey="conservative" stroke="#60B5FF" fill="#60B5FF30" name="Conservative" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
