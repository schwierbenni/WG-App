'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface ChartData {
  name: string
  Betrag: number
}

export default function ExpensesBarChart({ data }: { data: ChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}€`}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), 'Betrag']}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
        />
        <Bar dataKey="Betrag" radius={[4, 4, 0, 0]} fill="#6366f1" />
      </BarChart>
    </ResponsiveContainer>
  )
}
