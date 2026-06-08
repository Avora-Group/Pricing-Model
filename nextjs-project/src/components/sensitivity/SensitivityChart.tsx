'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

export interface DataPoint {
  label: string
  paramValue: number
  eurPerBh: number
  netProfit: number
}

interface SensitivityChartProps {
  data: DataPoint[]
  paramLabel: string
}

export function SensitivityChart({ data, paramLabel }: SensitivityChartProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = !mounted || resolvedTheme === 'dark'

  const gridStroke = isDark ? '#374151' : '#e5e7eb'
  const axisStroke = isDark ? '#9CA3AF' : '#6B7280'
  const tickFill = isDark ? '#9CA3AF' : '#6B7280'
  const tooltipBg = isDark ? '#1F2937' : '#ffffff'
  const tooltipBorder = isDark ? '#374151' : '#e5e7eb'
  const tooltipColor = isDark ? '#F3F4F6' : '#111827'

  return (
    <div className="av-panel p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
        Net profit vs {paramLabel}
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="label"
            stroke={axisStroke}
            tick={{ fill: tickFill, fontSize: 12 }}
          />
          <YAxis
            stroke={axisStroke}
            tick={{ fill: tickFill, fontSize: 12 }}
            tickFormatter={(value: number) =>
              `\u20AC${new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: '8px',
              color: tooltipColor,
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [
              `\u20AC${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Number(value))}`,
              'Net profit',
            ]}
            labelFormatter={(label) => `Step: ${String(label)}`}
          />
          <ReferenceLine y={0} stroke={axisStroke} strokeWidth={1} />
          <ReferenceLine x="Base" stroke="#6366F1" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="netProfit"
            stroke="#818CF8"
            strokeWidth={2}
            dot={{ fill: '#818CF8', r: 4 }}
            activeDot={{ r: 6, fill: '#A5B4FC' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
