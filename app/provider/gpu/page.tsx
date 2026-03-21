'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout'
import StatCard from '../../components/ui/StatCard'
import { getApiBase, getProviderKey } from '../../../lib/api'
import { useLanguage } from '../../lib/i18n'

// ── SVG Icons ──────────────────────────────────────────────────────────────
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 5v14a1 1 0 001 1h12a1 1 0 001-1V5m-9 9h4" />
  </svg>
)
const LightningIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)
const CurrencyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const GearIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const GpuIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2M9 3a2 2 0 012-2h2a2 2 0 012 2M9 3h6" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6M9 16h6M9 8h6" />
  </svg>
)

// ── Types ───────────────────────────────────────────────────────────────────
interface GpuSample {
  received_at: string
  gpu_util_pct: number | null
  gpu_temp_c: number | null
  gpu_power_w: number | null
  gpu_vram_free_mib: number | null
  gpu_vram_total_mib: number | null
  gpu_count: number | null
  all_gpus: Array<{
    index: number
    util_pct: number
    temp_c: number
    power_w: number
    vram_free_mib: number
    vram_total_mib: number
  }> | null
}

interface GpuMetricsData {
  provider_id: number
  gpu_name: string
  gpu_vram_mib: number
  gpu_count: number
  samples: GpuSample[]
  sample_count: number
}

type TimeRange = '1h' | '24h' | '7d'

// ── Helpers ─────────────────────────────────────────────────────────────────
function sinceParam(range: TimeRange): string {
  const now = Date.now()
  const ms = range === '1h' ? 3600_000 : range === '24h' ? 86400_000 : 7 * 86400_000
  return new Date(now - ms).toISOString()
}

function limitParam(range: TimeRange): number {
  // Heartbeats ≈ every 30s. Max backend limit is 1440.
  return range === '1h' ? 120 : 1440
}

function vramPct(sample: GpuSample): number {
  if (!sample.gpu_vram_total_mib || !sample.gpu_vram_free_mib) return 0
  return Math.round(((sample.gpu_vram_total_mib - sample.gpu_vram_free_mib) / sample.gpu_vram_total_mib) * 100)
}

function getTempColor(temp: number): string {
  if (temp < 70) return '#22c55e'
  if (temp < 80) return '#f59e0b'
  return '#ef4444'
}

// ── SVG Line/Area Chart ──────────────────────────────────────────────────────
interface SparklineProps {
  values: number[]
  color: string
  maxY?: number
  height?: number
  width?: number
  showFill?: boolean
  label?: string
  unit?: string
}

function Sparkline({ values, color, maxY = 100, height = 80, width = 400, showFill = true, label, unit = '%' }: SparklineProps) {
  if (values.length < 2) {
    return (
      <div className="flex items-center justify-center h-20 text-dc1-text-muted text-sm">
        Not enough data
      </div>
    )
  }
  const n = values.length
  const pts = values.map((v, i) => {
    const x = (i / (n - 1)) * width
    const y = height - (Math.min(v, maxY) / maxY) * (height - 8) - 4
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const areaPoints = [`0,${height}`, ...pts, `${width},${height}`].join(' ')
  const linePoints = pts.join(' ')
  const current = values[values.length - 1]
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  const peak = Math.round(Math.max(...values))

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-dc1-text-secondary">{label}</span>
          <div className="flex gap-4 text-xs text-dc1-text-muted">
            <span>Now <span className="font-semibold" style={{ color }}>{current}{unit}</span></span>
            <span>Avg <span className="font-semibold text-dc1-text-primary">{avg}{unit}</span></span>
            <span>Peak <span className="font-semibold text-dc1-text-primary">{peak}{unit}</span></span>
          </div>
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        {/* Grid lines */}
        {[25, 50, 75].map(pct => {
          const y = height - (pct / maxY) * (height - 8) - 4
          return (
            <line key={pct} x1={0} y1={y} x2={width} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          )
        })}
        {/* Area fill */}
        {showFill && (
          <polygon points={areaPoints} fill={color} fillOpacity={0.12} />
        )}
        {/* Line */}
        <polyline points={linePoints} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        {/* Current value dot */}
        {pts.length > 0 && (() => {
          const last = pts[pts.length - 1].split(',')
          return <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
        })()}
      </svg>
    </div>
  )
}

// ── Multi-GPU Tab ────────────────────────────────────────────────────────────
interface MultiGpuViewProps {
  samples: GpuSample[]
  gpuCount: number
}

function MultiGpuView({ samples, gpuCount }: MultiGpuViewProps) {
  const [selectedGpu, setSelectedGpu] = useState(0)

  if (gpuCount <= 1 || !samples.some(s => s.all_gpus?.length)) {
    return null
  }

  const gpuSamples = samples
    .filter(s => s.all_gpus && s.all_gpus[selectedGpu])
    .map(s => s.all_gpus![selectedGpu])

  if (!gpuSamples.length) return null

  const utilValues = gpuSamples.map(g => g.util_pct ?? 0)
  const tempValues = gpuSamples.map(g => g.temp_c ?? 0)
  const vramPctValues = gpuSamples.map(g =>
    g.vram_total_mib ? Math.round(((g.vram_total_mib - g.vram_free_mib) / g.vram_total_mib) * 100) : 0
  )

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-heading">Per-GPU Breakdown</h2>
        <div className="flex gap-1">
          {Array.from({ length: gpuCount }, (_, i) => (
            <button
              key={i}
              onClick={() => setSelectedGpu(i)}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                selectedGpu === i
                  ? 'bg-dc1-amber text-dc1-void'
                  : 'bg-dc1-surface-l2 text-dc1-text-secondary hover:bg-dc1-surface-l3'
              }`}
            >
              GPU {i}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-6">
        <Sparkline values={utilValues} color="#F5A524" label="Utilization" unit="%" />
        <Sparkline values={tempValues} color={getTempColor(tempValues[tempValues.length - 1] ?? 0)} label="Temperature" unit="°C" maxY={100} />
        <Sparkline values={vramPctValues} color="#38bdf8" label="VRAM Usage" unit="%" />
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ProviderGpuMetrics() {
  const router = useRouter()
  const { t } = useLanguage()
  const [metrics, setMetrics] = useState<GpuMetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('1h')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const navItems = [
    { label: t('nav.dashboard'), href: '/provider', icon: <HomeIcon /> },
    { label: t('nav.jobs'), href: '/provider/jobs', icon: <LightningIcon /> },
    { label: t('nav.earnings'), href: '/provider/earnings', icon: <CurrencyIcon /> },
    { label: t('nav.gpu_metrics'), href: '/provider/gpu', icon: <GpuIcon /> },
    { label: t('nav.settings'), href: '/provider/settings', icon: <GearIcon /> },
  ]

  const fetchMetrics = useCallback(async (range: TimeRange) => {
    const key = getProviderKey()
    if (!key) {
      router.push('/login')
      return
    }
    const base = getApiBase()
    const since = sinceParam(range)
    const limit = limitParam(range)
    try {
      const res = await fetch(
        `${base}/providers/me/gpu-metrics?key=${encodeURIComponent(key)}&since=${encodeURIComponent(since)}&limit=${limit}`
      )
      if (res.status === 401 || res.status === 403) {
        router.push('/login')
        return
      }
      if (res.ok) {
        const data = await res.json()
        // Reverse so oldest → newest for charts
        data.samples = data.samples.slice().reverse()
        setMetrics(data)
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('GPU metrics fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    setLoading(true)
    fetchMetrics(timeRange)
    const interval = setInterval(() => fetchMetrics(timeRange), 30_000)
    return () => clearInterval(interval)
  }, [fetchMetrics, timeRange])

  // Derived chart data from samples
  const samples = metrics?.samples ?? []
  const utilValues = samples.map(s => s.gpu_util_pct ?? 0)
  const tempValues = samples.map(s => s.gpu_temp_c ?? 0)
  const powerValues = samples.map(s => s.gpu_power_w ?? 0)
  const vramPctValues = samples.map(s => vramPct(s))

  const latest = samples[samples.length - 1]
  const currentUtil = latest?.gpu_util_pct ?? 0
  const currentTemp = latest?.gpu_temp_c ?? 0
  const currentPower = latest?.gpu_power_w ?? 0
  const currentVramPct = latest ? vramPct(latest) : 0
  const currentVramGb = latest?.gpu_vram_total_mib && latest?.gpu_vram_free_mib
    ? `${((latest.gpu_vram_total_mib - latest.gpu_vram_free_mib) / 1024).toFixed(1)} / ${(latest.gpu_vram_total_mib / 1024).toFixed(1)} GB`
    : '—'

  const avgUtil = utilValues.length ? Math.round(utilValues.reduce((a, b) => a + b, 0) / utilValues.length) : 0
  const peakUtil = utilValues.length ? Math.max(...utilValues) : 0
  const peakTemp = tempValues.length ? Math.max(...tempValues) : 0
  const maxPower = powerValues.length ? Math.max(...powerValues) : 0

  // X-axis time labels (show ~5 ticks)
  const xLabels: string[] = []
  if (samples.length >= 5) {
    const step = Math.floor(samples.length / 4)
    for (let i = 0; i <= 4; i++) {
      const s = samples[i * step < samples.length ? i * step : samples.length - 1]
      const d = new Date(s.received_at)
      xLabels.push(d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
    }
  }

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} role="provider" userName="Provider">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-dc1-surface-l2 rounded skeleton" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-dc1-surface-l2 rounded skeleton" />)}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout navItems={navItems} role="provider" userName="Provider">
      <div className="space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-dc1-text-primary">{t('provider.gpu_metrics.title')}</h1>
            {metrics?.gpu_name && (
              <p className="text-dc1-text-secondary mt-1">
                {metrics.gpu_name}
                {metrics.gpu_count > 1 && <span className="ml-2 text-dc1-amber text-sm">× {metrics.gpu_count} GPUs</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Time range selector */}
            <div className="flex gap-1 bg-dc1-surface-l2 p-1 rounded-lg">
              {(['1h', '24h', '7d'] as TimeRange[]).map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${
                    timeRange === r
                      ? 'bg-dc1-amber text-dc1-void'
                      : 'text-dc1-text-secondary hover:text-dc1-text-primary'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {/* Live indicator */}
            <div className="flex items-center gap-2 text-sm text-dc1-text-muted">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
              <span>{t('provider.gpu_metrics.live')}</span>
            </div>
          </div>
        </div>

        {/* No data state */}
        {!samples.length && (
          <div className="card text-center py-12">
            <p className="text-dc1-text-secondary">{t('provider.gpu_metrics.no_data')}</p>
            <p className="text-dc1-text-muted text-sm mt-2">
              {t('provider.gpu_metrics.no_data_hint')}
            </p>
          </div>
        )}

        {samples.length > 0 && (
          <>
            {/* Current Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label={t('provider.gpu_metrics.utilization')}
                value={`${currentUtil}%`}
                accent="amber"
                icon={<GpuIcon />}
                trend={{ value: `Avg ${avgUtil}% · Peak ${peakUtil}%`, positive: true }}
              />
              <StatCard
                label={t('provider.gpu_metrics.temperature')}
                value={`${currentTemp}°C`}
                accent={currentTemp >= 80 ? 'error' : currentTemp >= 70 ? 'default' : 'success'}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                }
                trend={{ value: `Peak ${peakTemp}°C`, positive: currentTemp < 80 }}
              />
              <StatCard
                label={t('provider.gpu_metrics.vram_usage')}
                value={`${currentVramPct}%`}
                accent="info"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                }
                trend={{ value: currentVramGb, positive: currentVramPct < 90 }}
              />
              <StatCard
                label={t('provider.gpu_metrics.power_draw')}
                value={`${currentPower}W`}
                accent="default"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
                trend={{ value: `Peak ${maxPower}W`, positive: true }}
              />
            </div>

            {/* GPU Utilization Chart */}
            <div className="card">
              <Sparkline
                values={utilValues}
                color="#F5A524"
                label="GPU Utilization (%)"
                unit="%"
              />
              {xLabels.length > 0 && (
                <div className="flex justify-between mt-1">
                  {xLabels.map((l, i) => (
                    <span key={i} className="text-[10px] text-dc1-text-muted">{l}</span>
                  ))}
                </div>
              )}
            </div>

            {/* VRAM + Temperature Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <Sparkline
                  values={vramPctValues}
                  color="#38bdf8"
                  label="VRAM Usage (%)"
                  unit="%"
                />
                {xLabels.length > 0 && (
                  <div className="flex justify-between mt-1">
                    {xLabels.map((l, i) => (
                      <span key={i} className="text-[10px] text-dc1-text-muted">{l}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="card">
                <Sparkline
                  values={tempValues}
                  color={getTempColor(currentTemp)}
                  label="Temperature (°C)"
                  unit="°C"
                  maxY={100}
                />
                {xLabels.length > 0 && (
                  <div className="flex justify-between mt-1">
                    {xLabels.map((l, i) => (
                      <span key={i} className="text-[10px] text-dc1-text-muted">{l}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Power Chart */}
            {powerValues.some(v => v > 0) && (
              <div className="card">
                <Sparkline
                  values={powerValues}
                  color="#a78bfa"
                  label="Power Draw (W)"
                  unit="W"
                  maxY={Math.max(...powerValues) * 1.2}
                />
                {xLabels.length > 0 && (
                  <div className="flex justify-between mt-1">
                    {xLabels.map((l, i) => (
                      <span key={i} className="text-[10px] text-dc1-text-muted">{l}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Multi-GPU Per-Card Breakdown */}
            {metrics && (
              <MultiGpuView samples={samples} gpuCount={metrics.gpu_count} />
            )}

            {/* Summary Table */}
            <div className="card">
              <h2 className="section-heading mb-4">{t('provider.gpu_metrics.period_summary')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-dc1-surface-l2 rounded-lg p-4">
                  <p className="text-dc1-text-muted mb-1">{t('provider.gpu_metrics.samples_collected')}</p>
                  <p className="text-xl font-bold text-dc1-text-primary">{samples.length}</p>
                </div>
                <div className="bg-dc1-surface-l2 rounded-lg p-4">
                  <p className="text-dc1-text-muted mb-1">{t('provider.gpu_metrics.avg_gpu_util')}</p>
                  <p className="text-xl font-bold text-dc1-amber">{avgUtil}%</p>
                </div>
                <div className="bg-dc1-surface-l2 rounded-lg p-4">
                  <p className="text-dc1-text-muted mb-1">{t('provider.gpu_metrics.peak_temperature')}</p>
                  <p className="text-xl font-bold" style={{ color: getTempColor(peakTemp) }}>{peakTemp}°C</p>
                </div>
                <div className="bg-dc1-surface-l2 rounded-lg p-4">
                  <p className="text-dc1-text-muted mb-1">{t('provider.gpu_metrics.peak_power')}</p>
                  <p className="text-xl font-bold text-dc1-text-primary">{maxPower}W</p>
                </div>
              </div>
              {lastUpdated && (
                <p className="text-xs text-dc1-text-muted mt-4">
                  {t('provider.gpu_metrics.last_updated')} {lastUpdated.toLocaleTimeString()} · {t('provider.gpu_metrics.auto_refresh')}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
