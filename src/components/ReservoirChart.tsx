import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ChartMode, ReservoirChartPoint } from '../lib/chartData'
import { formatReadingDateTime, formatShortDate } from '../lib/dates'

interface ReservoirChartProps {
  mode: ChartMode
  points: ReservoirChartPoint[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload?: ReservoirChartPoint }>
  label?: number
  mode: ChartMode
}

function ChartTooltip({ active, payload, label, mode }: TooltipProps) {
  const point = payload?.[0]?.payload
  if (!active || !point || label === undefined) return null

  return (
    <div className="chart-tooltip">
      <strong>
        {mode === 'daily' ? formatShortDate(label) : formatReadingDateTime(label)}
      </strong>
      {mode === 'daily' ? (
        <>
          <span>{point.count} {point.count === 1 ? 'reading' : 'readings'} · daily median</span>
          <span>
            pH {point.ph.toFixed(2)} · range {point.phRange[0].toFixed(2)}–{point.phRange[1].toFixed(2)}
          </span>
          <span>
            EC {point.ec.toFixed(2)} · range {point.ecRange[0].toFixed(2)}–{point.ecRange[1].toFixed(2)}
          </span>
        </>
      ) : (
        <>
          <span>pH {point.ph.toFixed(2)}</span>
          <span>EC {point.ec.toFixed(2)} mS/cm</span>
        </>
      )}
    </div>
  )
}

export function ReservoirChart({ mode, points }: ReservoirChartProps) {
  const showDots = points.length <= 45

  return (
    <div
      className="chart-wrap"
      aria-label={`pH and EC ${mode === 'daily' ? 'daily summary' : 'readings'} chart`}
    >
      <div className="chart-legend" aria-hidden="true">
        <span><i className="legend-line legend-line--ph" />pH</span>
        <span><i className="legend-line legend-line--ec" />EC (mS/cm)</span>
        {mode === 'daily' ? <small>Shading = daily min–max</small> : null}
      </div>
      <ResponsiveContainer width="100%" height={248}>
        <ComposedChart
          data={points}
          margin={{ top: 10, right: 2, left: -14, bottom: 0 }}
        >
          <CartesianGrid stroke="#dfe7e8" strokeDasharray="4 5" vertical={false} />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
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
          <Tooltip content={<ChartTooltip mode={mode} />} />
          {mode === 'daily' ? (
            <>
              <Area
                yAxisId="ph"
                type="linear"
                dataKey="phRange"
                stroke="none"
                fill="#008b8f"
                fillOpacity={0.13}
                isAnimationActive={false}
              />
              <Area
                yAxisId="ec"
                type="linear"
                dataKey="ecRange"
                stroke="none"
                fill="#2457c5"
                fillOpacity={0.1}
                isAnimationActive={false}
              />
            </>
          ) : null}
          <Line
            yAxisId="ph"
            type="linear"
            dataKey="ph"
            stroke="#008b8f"
            strokeWidth={2.5}
            dot={showDots ? { r: 3.5, fill: '#fff', strokeWidth: 2 } : false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="ec"
            type="linear"
            dataKey="ec"
            stroke="#2457c5"
            strokeWidth={2.5}
            dot={showDots ? { r: 3.5, fill: '#fff', strokeWidth: 2 } : false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
