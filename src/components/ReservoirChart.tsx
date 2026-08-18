import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ReservoirLog } from '../db/database'
import { formatShortDate } from '../lib/dates'

interface ReservoirChartProps {
  logs: ReservoirLog[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ dataKey?: string; value?: number }>
  label?: number
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || !label) return null

  const ph = payload.find((item) => item.dataKey === 'ph')?.value
  const ec = payload.find((item) => item.dataKey === 'ec')?.value

  return (
    <div className="chart-tooltip">
      <strong>{formatShortDate(label)}</strong>
      <span>pH {ph?.toFixed(2)}</span>
      <span>EC {ec?.toFixed(2)} mS/cm</span>
    </div>
  )
}

export function ReservoirChart({ logs }: ReservoirChartProps) {
  return (
    <div className="chart-wrap" aria-label="pH and EC history chart">
      <div className="chart-legend" aria-hidden="true">
        <span><i className="legend-line legend-line--ph" />pH</span>
        <span><i className="legend-line legend-line--ec" />EC (mS/cm)</span>
      </div>
      <ResponsiveContainer width="100%" height={248}>
        <LineChart data={logs} margin={{ top: 10, right: 2, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="#dfe7e8" strokeDasharray="4 5" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatShortDate}
            tick={{ fill: '#5e6f75', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#ccd8da' }}
            minTickGap={24}
          />
          <YAxis
            yAxisId="ph"
            domain={[4.5, 8]}
            tick={{ fill: '#007e86', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={38}
          />
          <YAxis
            yAxisId="ec"
            orientation="right"
            domain={[0, 3]}
            tick={{ fill: '#2457c5', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={34}
          />
          <Tooltip content={<ChartTooltip />} />
          <Line
            yAxisId="ph"
            type="monotone"
            dataKey="ph"
            stroke="#008b8f"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: '#fff', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="ec"
            type="monotone"
            dataKey="ec"
            stroke="#2457c5"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: '#fff', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
