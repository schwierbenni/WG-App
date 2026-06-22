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

interface ChartData {
  name: string
  Gesamt: number
  'Diesen Monat': number
}

export default function StatisticsBarChart({ data }: { data: ChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '12px',
          }}
        />
        <Bar dataKey="Gesamt" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Diesen Monat" fill="#a855f7" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
