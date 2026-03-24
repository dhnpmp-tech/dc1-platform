'use client'

export interface DailySpend {
  day: string
  total_halala: number
  job_count: number
}

function formatSAR(halala: number): string {
  return (halala / 100).toFixed(2)
}

interface SpendingChartProps {
  data: DailySpend[]
  days?: number
}

export default function SpendingChart({ data, days = 7 }: SpendingChartProps) {
  const filledData = (() => {
    const today = new Date()
    const result: { label: string; total_halala: number; job_count: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const iso = d.toISOString().slice(0, 10)
      const found = data.find(r => r.day === iso)
      result.push({
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total_halala: found?.total_halala ?? 0,
        job_count: found?.job_count ?? 0,
      })
    }
    return result
  })()

  const maxVal = Math.max(...filledData.map(d => d.total_halala), 1)
  const hasAnySpend = filledData.some(d => d.total_halala > 0)
  const CHART_H = 100
  const totalHalala = filledData.reduce((s, d) => s + d.total_halala, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-dc1-text-secondary">Last {days} Days</h3>
        <span className="text-sm font-semibold text-dc1-amber">{formatSAR(totalHalala)} SAR</span>
      </div>
      {!hasAnySpend ? (
        <div className="flex items-center justify-center h-24 text-dc1-text-muted text-sm">
          No spend data for this period.
        </div>
      ) : (
        <div
          className="flex items-end gap-1"
          style={{ height: CHART_H + 28 }}
          role="img"
          aria-label={`Daily spend chart for last ${days} days`}
        >
          {filledData.map((d, i) => {
            const barH = d.total_halala > 0
              ? Math.max(4, (d.total_halala / maxVal) * CHART_H)
              : 2
            const isZero = d.total_halala === 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 group" style={{ minWidth: 0 }}>
                <span className={`text-[9px] whitespace-nowrap transition-opacity ${isZero ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`} style={{ color: '#f59e0b' }}>
                  {formatSAR(d.total_halala)}
                </span>
                <div
                  className={`w-full rounded-t transition-all ${isZero ? 'bg-dc1-surface-l3' : 'bg-amber-400 group-hover:bg-amber-300'}`}
                  style={{ height: barH }}
                  title={`${formatSAR(d.total_halala)} SAR — ${d.job_count} job${d.job_count !== 1 ? 's' : ''}`}
                />
                <span className="text-[9px] text-dc1-text-muted truncate w-full text-center mt-0.5">{d.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
