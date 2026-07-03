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

// Read a CSS custom property off the document root so recharts (which needs
// concrete color strings) stays in sync with the light/dark theme tokens.
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null
  const value = Number(payload[0].value)
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        padding: '8px 12px',
        color: 'var(--ink)',
        fontSize: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,.12)',
      }}
    >
      <div style={{ color: 'var(--muted)', marginBottom: 4 }}>Step: {String(label)}</div>
      <div className="av-num" style={{ fontWeight: 700 }}>
        {'€'}{new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(value)}
        <span style={{ color: 'var(--muted)', fontWeight: 500 }}> Net profit</span>
      </div>
    </div>
  )
}

export function SensitivityChart({ data, paramLabel }: SensitivityChartProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Recompute concrete colors from CSS vars whenever the theme flips.
  void resolvedTheme
  const gridStroke = mounted ? cssVar('--line', '#e5e7eb') : '#e5e7eb'
  const axisStroke = mounted ? cssVar('--muted', '#6B7280') : '#6B7280'
  const cyan = mounted ? cssVar('--cyan', '#18b4d8') : '#18b4d8'
  const brand = mounted ? cssVar('--brand', cyan) : cyan

  return (
    <div className="av-panel">
      <div className="av-panel-h">
        <h2>Net profit vs {paramLabel}</h2>
      </div>
      <div className="av-card-b">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis
              dataKey="label"
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 12 }}
            />
            <YAxis
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 12 }}
              tickFormatter={(value: number) =>
                `€${new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`
              }
            />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke={axisStroke} strokeWidth={1} />
            <ReferenceLine x="Base" stroke={brand} strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="netProfit"
              stroke={cyan}
              strokeWidth={2}
              dot={{ fill: cyan, r: 4 }}
              activeDot={{ r: 6, fill: brand }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
