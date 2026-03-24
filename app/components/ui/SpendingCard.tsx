'use client'

interface DailySpend {
  date: string
  spent_halala: number
  job_count: number
}

interface SpendingCardProps {
  totalSpentHalala: number
  totalJobs: number
  totalTokens: number
  last30Days: DailySpend[]
  loading?: boolean
}

function formatSAR(halala: number): string {
  return (halala / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function SpendingCard({
  totalSpentHalala,
  totalJobs,
  totalTokens,
  last30Days,
  loading = false,
}: SpendingCardProps) {
  // Build 30-day chart: fill in missing days with 0
  const today = new Date()
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (29 - i))
    const iso = d.toISOString().slice(0, 10)
    const found = last30Days.find(r => r.date === iso)
    return { date: iso, spent_halala: found?.spent_halala ?? 0 }
  })

  const maxVal = Math.max(...chartData.map(d => d.spent_halala), 1)
  const hasSpend = chartData.some(d => d.spent_halala > 0)

  // Week labels at 7-day intervals
  const weekLabels = [29, 22, 15, 8, 1].map(daysAgo => {
    const d = new Date(today)
    d.setDate(today.getDate() - daysAgo)
    return { index: 29 - daysAgo, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  })

  if (loading) {
    return (
      <div className="card p-5 space-y-4 animate-pulse">
        <div className="h-4 w-32 bg-dc1-surface-l3 rounded" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-dc1-surface-l3 rounded" />)}
        </div>
        <div className="h-16 bg-dc1-surface-l3 rounded" />
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-dc1-text-primary">Spending — This Month</h3>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dc1-surface-l2 rounded-lg p-3">
          <p className="text-xs text-dc1-text-muted mb-1">Total Spent</p>
          <p className="text-lg font-bold text-dc1-text-primary leading-tight">
            {formatSAR(totalSpentHalala)}
          </p>
          <p className="text-xs text-dc1-text-muted">SAR</p>
        </div>
        <div className="bg-dc1-surface-l2 rounded-lg p-3">
          <p className="text-xs text-dc1-text-muted mb-1">Jobs</p>
          <p className="text-lg font-bold text-dc1-text-primary leading-tight">{totalJobs}</p>
          <p className="text-xs text-dc1-text-muted">completed</p>
        </div>
        <div className="bg-dc1-surface-l2 rounded-lg p-3">
          <p className="text-xs text-dc1-text-muted mb-1">Tokens</p>
          <p className="text-lg font-bold text-dc1-text-primary leading-tight">
            {formatTokens(totalTokens)}
          </p>
          <p className="text-xs text-dc1-text-muted">processed</p>
        </div>
      </div>

      {/* 30-day bar chart */}
      <div>
        <p className="text-xs text-dc1-text-muted mb-2">Daily spend — last 30 days</p>
        {!hasSpend ? (
          <div className="flex items-center justify-center h-14 rounded bg-dc1-surface-l2 text-dc1-text-muted text-xs">
            No spend in the last 30 days
          </div>
        ) : (
          <div className="relative">
            <div
              className="flex items-end gap-px"
              style={{ height: 56 }}
              role="img"
              aria-label="30-day spending bar chart"
            >
              {chartData.map((d, i) => {
                const barH = d.spent_halala > 0
                  ? Math.max(3, (d.spent_halala / maxVal) * 44)
                  : 2
                const isToday = i === 29
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end group"
                    style={{ height: 56 }}
                  >
                    <div
                      className={`w-full rounded-t transition-all ${
                        d.spent_halala > 0
                          ? isToday
                            ? 'bg-dc1-amber'
                            : 'bg-dc1-amber/60 group-hover:bg-dc1-amber/80'
                          : 'bg-dc1-surface-l3'
                      }`}
                      style={{ height: barH }}
                      title={`${d.date}: ${formatSAR(d.spent_halala)} SAR`}
                    />
                  </div>
                )
              })}
            </div>
            {/* Week labels */}
            <div className="flex mt-1" aria-hidden="true">
              {weekLabels.map(({ index, label }) => (
                <div
                  key={label}
                  className="text-[9px] text-dc1-text-muted"
                  style={{ marginLeft: `${(index / 29) * 100}%`, transform: 'translateX(-50%)' }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
