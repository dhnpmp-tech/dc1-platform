'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import { useLanguage } from '../../lib/i18n'

// ── GPU economics (from FOUNDER-STRATEGIC-BRIEF.md, March 2026) ───────────────
// Figures in USD/month at baseline utilisation; SAR = USD × 3.75.
// Revenue range = [min, max] at [60%, 80%] utilisation (except H100/H200 70-90%).
// Electricity is Saudi rate (0.048–0.053 USD/kWh).

interface GpuSpec {
  id: string
  label: string
  vram: string
  tdp_w: number                     // GPU TDP (watts) for electricity calc
  rev_usd_per_mo_at_70: number      // USD/mo revenue at 70% utilisation
  elec_usd_per_mo: number           // Monthly electricity cost (SA rates)
  platform_fee_pct: number          // DC1 take (15%)
  typical_use: string
  hyperscaler_usd_hr: number        // Comparable hyperscaler spot price (reference)
  dcp_usd_hr: number                // DCP floor price
  typical_purchase_usd: number      // New card street price for payback calc
  util_baseline: number             // baseline utilisation used in rev figure (0..1)
}

const GPU_SPECS: GpuSpec[] = [
  {
    id: 'RTX4090',
    label: 'NVIDIA RTX 4090',
    vram: '24 GB',
    tdp_w: 450,
    rev_usd_per_mo_at_70: 265,      // midpoint of $180-$350 at 70%
    elec_usd_per_mo: 30,            // midpoint $25-$35
    platform_fee_pct: 0.15,
    typical_use: 'Internet cafe / gaming centre',
    hyperscaler_usd_hr: 0.74,       // RunPod spot
    dcp_usd_hr: 0.267,
    typical_purchase_usd: 1_800,
    util_baseline: 0.70,
  },
  {
    id: 'RTX4080',
    label: 'NVIDIA RTX 4080',
    vram: '16 GB',
    tdp_w: 320,
    rev_usd_per_mo_at_70: 185,      // midpoint $120-$250
    elec_usd_per_mo: 25,
    platform_fee_pct: 0.15,
    typical_use: 'Gaming centre / home rig',
    hyperscaler_usd_hr: 0.55,
    dcp_usd_hr: 0.20,
    typical_purchase_usd: 1_200,
    util_baseline: 0.70,
  },
  {
    id: 'L40S',
    label: 'NVIDIA L40S',
    vram: '48 GB',
    tdp_w: 350,
    rev_usd_per_mo_at_70: 520,
    elec_usd_per_mo: 38,
    platform_fee_pct: 0.15,
    typical_use: 'Server room / rack',
    hyperscaler_usd_hr: 1.80,
    dcp_usd_hr: 0.75,
    typical_purchase_usd: 7_000,
    util_baseline: 0.70,
  },
  {
    id: 'A100',
    label: 'NVIDIA A100 80 GB',
    vram: '80 GB',
    tdp_w: 400,
    rev_usd_per_mo_at_70: 900,
    elec_usd_per_mo: 52,
    platform_fee_pct: 0.15,
    typical_use: 'Dedicated rack / university',
    hyperscaler_usd_hr: 3.20,
    dcp_usd_hr: 1.25,
    typical_purchase_usd: 15_000,
    util_baseline: 0.70,
  },
  {
    id: 'H100',
    label: 'NVIDIA H100 80 GB',
    vram: '80 GB',
    tdp_w: 700,
    rev_usd_per_mo_at_70: 2_650,    // midpoint $1,800-$3,500
    elec_usd_per_mo: 200,           // midpoint $150-$250
    platform_fee_pct: 0.15,
    typical_use: 'Dedicated rack',
    hyperscaler_usd_hr: 8.00,
    dcp_usd_hr: 3.50,
    typical_purchase_usd: 30_000,
    util_baseline: 0.80,
  },
  {
    id: 'H200',
    label: 'NVIDIA H200 141 GB',
    vram: '141 GB',
    tdp_w: 700,
    rev_usd_per_mo_at_70: 3_500,    // midpoint $2,500-$4,500
    elec_usd_per_mo: 240,           // midpoint $180-$300
    platform_fee_pct: 0.15,
    typical_use: 'Dedicated rack',
    hyperscaler_usd_hr: 12.00,
    dcp_usd_hr: 5.20,
    typical_purchase_usd: 45_000,
    util_baseline: 0.80,
  },
]

const REGIONS = [
  { id: 'SA', label: 'Saudi Arabia', label_ar: 'المملكة العربية السعودية', elec_multiplier: 1.0 },
  { id: 'EU', label: 'European Union', label_ar: 'الاتحاد الأوروبي', elec_multiplier: 4.5 },
  { id: 'US', label: 'United States', label_ar: 'الولايات المتحدة', elec_multiplier: 2.2 },
]

const SAR_PER_USD = 3.75

function calcEarnings(gpu: GpuSpec, utilPct: number, region: typeof REGIONS[0]) {
  const util = utilPct / 100
  const scaleFactor = util / gpu.util_baseline

  const grossRevUsd = gpu.rev_usd_per_mo_at_70 * scaleFactor
  const elecUsd = gpu.elec_usd_per_mo * region.elec_multiplier
  const platformFeeUsd = grossRevUsd * gpu.platform_fee_pct
  const netUsd = grossRevUsd - elecUsd - platformFeeUsd
  const annualUsd = netUsd * 12

  // Payback assumes provider already owns the GPU but show months to recoup purchase
  const paybackMonths = netUsd > 0 ? gpu.typical_purchase_usd / netUsd : Infinity

  return {
    grossRevUsd,
    grossRevSar: grossRevUsd * SAR_PER_USD,
    elecUsd,
    elecSar: elecUsd * SAR_PER_USD,
    platformFeeUsd,
    platformFeeSar: platformFeeUsd * SAR_PER_USD,
    netUsd,
    netSar: netUsd * SAR_PER_USD,
    annualUsd,
    annualSar: annualUsd * SAR_PER_USD,
    paybackMonths,
  }
}

function fmt(val: number, decimals = 0): string {
  if (!isFinite(val)) return '—'
  return val.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtSar(val: number): string {
  if (!isFinite(val)) return '—'
  return `${val.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} SAR`
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ChipIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H7a2 2 0 00-2 2v2M9 3h6M9 3v2m6-2h2a2 2 0 012 2v2m0 0h-2m2 0v6m0 0h-2m2 0v2a2 2 0 01-2 2h-2m0 0H9m6 0v2M9 21H7a2 2 0 01-2-2v-2m0 0H3m2 0v-6M5 9H3m2 0V7" />
  </svg>
)

const BoltIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const CashIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
)

const GlobeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProviderEarningsCalculator() {
  const { lang } = useLanguage()
  const isAr = lang === 'ar'

  const [selectedGpuId, setSelectedGpuId] = useState<string>('RTX4090')
  const [utilPct, setUtilPct] = useState<number>(70)
  const [regionId, setRegionId] = useState<string>('SA')

  const gpu = GPU_SPECS.find(g => g.id === selectedGpuId) ?? GPU_SPECS[0]
  const region = REGIONS.find(r => r.id === regionId) ?? REGIONS[0]
  const earnings = useMemo(() => calcEarnings(gpu, utilPct, region), [gpu, utilPct, region])

  const paybackDisplay = earnings.paybackMonths < 1
    ? isAr ? 'أقل من شهر' : '< 1 month'
    : earnings.paybackMonths > 120
    ? isAr ? 'أكثر من 10 سنوات' : '> 10 years'
    : isAr
    ? `${fmt(earnings.paybackMonths)} شهر`
    : `${fmt(earnings.paybackMonths)} months`

  const savingsVsHyperscaler = gpu.hyperscaler_usd_hr > 0
    ? Math.round((1 - gpu.dcp_usd_hr / gpu.hyperscaler_usd_hr) * 100)
    : 0

  return (
    <div className={`min-h-screen bg-dc1-bg text-dc1-text-primary flex flex-col${isAr ? ' rtl' : ''}`}>
      <Header />

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="bg-gradient-to-b from-dc1-surface-l1 to-dc1-bg border-b border-dc1-border py-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 bg-dc1-amber/10 border border-dc1-amber/30 rounded-full px-4 py-1.5 mb-6">
              <BoltIcon />
              <span className="text-sm font-medium text-dc1-amber">
                {isAr ? 'آلة حاسبة لأرباح المزودين' : 'Provider Earnings Calculator'}
              </span>
            </div>
            <h1 className="text-4xl font-bold text-dc1-text-primary mb-4">
              {isAr
                ? 'كم يمكن لبطاقة الرسومات الخاصة بك أن تكسب؟'
                : 'How much can your GPU earn?'}
            </h1>
            <p className="text-dc1-text-secondary text-lg max-w-2xl mx-auto">
              {isAr
                ? 'احسب أرباحك الشهرية من خلال توفير طاقة حوسبة GPU على شبكة DCP. أسعار الكهرباء السعودية تعني هامش ربح لا يضاهى.'
                : 'Calculate your monthly earnings by renting your GPU to AI workloads on the DCP network. Saudi electricity rates create an unmatched profit margin.'}
            </p>
          </div>
        </section>

        {/* ── Calculator ── */}
        <section className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

            {/* Controls */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-dc1-surface-l1 border border-dc1-border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                  <ChipIcon />
                  {isAr ? 'إعدادات الحساب' : 'Calculator Settings'}
                </h2>

                {/* GPU Selector */}
                <div className="mb-5">
                  <label className="block text-sm font-medium text-dc1-text-secondary mb-2">
                    {isAr ? 'طراز بطاقة الرسومات' : 'GPU Model'}
                  </label>
                  <select
                    value={selectedGpuId}
                    onChange={e => setSelectedGpuId(e.target.value)}
                    className="w-full bg-dc1-surface-l2 border border-dc1-border rounded-lg px-3 py-2.5 text-dc1-text-primary focus:outline-none focus:border-dc1-amber transition-colors"
                  >
                    {GPU_SPECS.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.label} ({g.vram})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-dc1-text-muted">{gpu.typical_use}</p>
                </div>

                {/* Utilisation Slider */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-dc1-text-secondary">
                      {isAr ? 'معدل الاستخدام' : 'Utilisation Rate'}
                    </label>
                    <span className="text-lg font-bold text-dc1-amber">{utilPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={100}
                    step={5}
                    value={utilPct}
                    onChange={e => setUtilPct(Number(e.target.value))}
                    className="w-full accent-dc1-amber"
                  />
                  <div className="flex justify-between text-xs text-dc1-text-muted mt-1">
                    <span>30%</span>
                    <span className="text-dc1-text-secondary">{isAr ? 'الاستخدام الموصى به: 70%' : 'Recommended: 70%'}</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Region */}
                <div>
                  <label className="block text-sm font-medium text-dc1-text-secondary mb-2">
                    <span className="flex items-center gap-1.5">
                      <GlobeIcon />
                      {isAr ? 'الموقع الجغرافي' : 'Region'}
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {REGIONS.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setRegionId(r.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          regionId === r.id
                            ? 'bg-dc1-amber/20 border-dc1-amber text-dc1-amber'
                            : 'bg-dc1-surface-l2 border-dc1-border text-dc1-text-secondary hover:border-dc1-amber/50'
                        }`}
                      >
                        {r.id === 'SA' ? (isAr ? 'السعودية' : 'Saudi Arabia') : r.id}
                      </button>
                    ))}
                  </div>
                  {regionId !== 'SA' && (
                    <p className="mt-2 text-xs text-yellow-400/80 bg-yellow-400/5 border border-yellow-400/20 rounded-lg px-3 py-2">
                      {isAr
                        ? 'تكاليف الكهرباء خارج المملكة أعلى بكثير. المزودون في السعودية يتمتعون بأفضل هامش ربح.'
                        : 'Non-Saudi electricity costs are significantly higher. Saudi providers have the best margins.'}
                    </p>
                  )}
                </div>
              </div>

              {/* DCP Price vs Hyperscaler */}
              <div className="bg-dc1-surface-l1 border border-dc1-border rounded-xl p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-dc1-text-muted mb-3">
                  {isAr ? 'سعر DCP مقارنةً بالمنافسين' : 'DCP Price vs Competitors'}
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-dc1-text-secondary">DCP ({gpu.label})</span>
                    <span className="text-sm font-bold text-green-400">${gpu.dcp_usd_hr}/hr</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-dc1-text-secondary">RunPod / Vast.ai</span>
                    <span className="text-sm font-medium text-dc1-text-muted">${gpu.hyperscaler_usd_hr}/hr</span>
                  </div>
                  <div className="mt-3 bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2 text-center">
                    <span className="text-sm font-semibold text-green-400">
                      {isAr
                        ? `${savingsVsHyperscaler}% أرخص للمستأجرين`
                        : `${savingsVsHyperscaler}% cheaper for renters`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-3 space-y-4">
              {/* Net profit highlight */}
              <div className="bg-gradient-to-br from-green-500/10 to-green-700/5 border border-green-500/30 rounded-xl p-6 text-center">
                <p className="text-sm font-semibold uppercase tracking-wide text-green-400/80 mb-1">
                  {isAr ? 'صافي الربح الشهري' : 'Net Monthly Profit'}
                </p>
                <div className="text-5xl font-black text-green-400 my-2">
                  {earnings.netSar >= 0 ? fmtSar(earnings.netSar) : `−${fmtSar(-earnings.netSar)}`}
                </div>
                <p className="text-sm text-dc1-text-secondary">
                  ≈ ${fmt(earnings.netUsd)} USD/month
                </p>
                {earnings.netUsd < 0 && (
                  <p className="mt-2 text-xs text-red-400">
                    {isAr
                      ? 'الهامش سلبي عند هذا المعدل في منطقتك. جرب معدل استخدام أعلى أو غيّر المنطقة.'
                      : 'Margin is negative at this rate in your region. Try higher utilisation or switch to Saudi Arabia.'}
                  </p>
                )}
              </div>

              {/* Breakdown */}
              <div className="bg-dc1-surface-l1 border border-dc1-border rounded-xl p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-dc1-text-muted mb-4">
                  {isAr ? 'تفاصيل الحساب (شهرياً)' : 'Monthly Breakdown'}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-dc1-border/50">
                    <span className="text-sm text-dc1-text-secondary">
                      {isAr ? 'الإيرادات الإجمالية' : 'Gross Revenue'}
                    </span>
                    <span className="font-semibold text-dc1-text-primary">{fmtSar(earnings.grossRevSar)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-dc1-border/50">
                    <span className="text-sm text-dc1-text-secondary flex items-center gap-1.5">
                      <BoltIcon />
                      {isAr ? 'تكلفة الكهرباء' : 'Electricity Cost'}
                      {region.id !== 'SA' && (
                        <span className="text-xs text-yellow-400">({region.label})</span>
                      )}
                    </span>
                    <span className="text-sm text-red-400">−{fmtSar(earnings.elecSar)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-dc1-border/50">
                    <span className="text-sm text-dc1-text-secondary">
                      {isAr ? 'رسوم المنصة (15%)' : 'Platform Fee (15%)'}
                    </span>
                    <span className="text-sm text-red-400">−{fmtSar(earnings.platformFeeSar)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-green-400/5 rounded-lg px-3">
                    <span className="font-semibold text-dc1-text-primary">
                      {isAr ? 'صافي الربح' : 'Net Profit'}
                    </span>
                    <span className={`font-bold text-lg ${earnings.netSar >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {earnings.netSar >= 0 ? fmtSar(earnings.netSar) : `−${fmtSar(-earnings.netSar)}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Annual + payback */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-dc1-surface-l1 border border-dc1-border rounded-xl p-4 text-center">
                  <p className="text-xs text-dc1-text-muted uppercase tracking-wide mb-1">
                    {isAr ? 'الأرباح السنوية' : 'Annual Earnings'}
                  </p>
                  <p className={`text-2xl font-bold ${earnings.annualSar >= 0 ? 'text-dc1-amber' : 'text-red-400'}`}>
                    {earnings.annualSar >= 0 ? fmtSar(earnings.annualSar) : `−${fmtSar(-earnings.annualSar)}`}
                  </p>
                  <p className="text-xs text-dc1-text-muted mt-1">${fmt(earnings.annualUsd)} USD</p>
                </div>
                <div className="bg-dc1-surface-l1 border border-dc1-border rounded-xl p-4 text-center">
                  <p className="text-xs text-dc1-text-muted uppercase tracking-wide mb-1">
                    {isAr ? 'مدة استرداد التكلفة' : 'Hardware Payback'}
                  </p>
                  <p className="text-2xl font-bold text-dc1-text-primary">{paybackDisplay}</p>
                  <p className="text-xs text-dc1-text-muted mt-1">
                    {isAr ? `السعر المرجعي: $${fmt(gpu.typical_purchase_usd)}` : `Ref: $${fmt(gpu.typical_purchase_usd)} new`}
                  </p>
                </div>
              </div>

              {/* Saudi advantage callout */}
              {regionId === 'SA' && (
                <div className="bg-dc1-amber/5 border border-dc1-amber/30 rounded-xl p-4">
                  <p className="text-sm font-semibold text-dc1-amber mb-1">
                    {isAr ? 'ميزة الطاقة السعودية' : 'Saudi Energy Advantage'}
                  </p>
                  <p className="text-xs text-dc1-text-secondary">
                    {isAr
                      ? 'الكهرباء الصناعية في المملكة العربية السعودية 0.048–0.053 دولار/كيلوواط ساعة — أرخص بـ 3.5-6 مرات من أوروبا. هذا هو الخندق الهيكلي لـ DCP.'
                      : 'Saudi industrial electricity is $0.048–0.053/kWh — 3.5–6× cheaper than EU rates. This is DCP\'s structural moat: same GPU hardware, dramatically lower opex.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Comparison Table ── */}
        <section className="max-w-6xl mx-auto px-4 pb-12">
          <h2 className="text-2xl font-bold text-dc1-text-primary mb-6">
            {isAr ? 'مقارنة أرباح المزودين بجميع طرازات GPU' : 'Provider Earnings Across GPU Models'}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-dc1-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dc1-surface-l2 border-b border-dc1-border">
                  <th className="text-left px-4 py-3 font-semibold text-dc1-text-secondary">
                    {isAr ? 'طراز GPU' : 'GPU'}
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-dc1-text-secondary">VRAM</th>
                  <th className="text-right px-4 py-3 font-semibold text-dc1-text-secondary">
                    {isAr ? 'سعر DCP/ساعة' : 'DCP $/hr'}
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-dc1-text-secondary">
                    {isAr ? 'الإيرادات (70%)' : 'Revenue (70%)'}
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-dc1-text-secondary">
                    {isAr ? 'صافي الربح/شهر (السعودية)' : 'Net/mo (Saudi)'}
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-dc1-text-secondary">
                    {isAr ? 'أرباح سنوية' : 'Annual'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {GPU_SPECS.map((g, i) => {
                  const e = calcEarnings(g, 70, REGIONS[0])
                  const isSelected = g.id === selectedGpuId
                  return (
                    <tr
                      key={g.id}
                      onClick={() => setSelectedGpuId(g.id)}
                      className={`border-b border-dc1-border/50 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-dc1-amber/5 border-l-2 border-l-dc1-amber'
                          : i % 2 === 0
                          ? 'bg-dc1-surface-l1 hover:bg-dc1-surface-l2'
                          : 'bg-dc1-bg hover:bg-dc1-surface-l1'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-dc1-text-primary">
                        {isSelected && <span className="text-dc1-amber mr-1">▶</span>}
                        {g.label}
                        <span className="block text-xs text-dc1-text-muted font-normal">{g.typical_use}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-dc1-text-secondary">{g.vram}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-400">${g.dcp_usd_hr}</td>
                      <td className="px-4 py-3 text-right text-dc1-text-primary">{fmtSar(e.grossRevSar)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${e.netSar >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {e.netSar >= 0 ? fmtSar(e.netSar) : `−${fmtSar(-e.netSar)}`}
                      </td>
                      <td className="px-4 py-3 text-right text-dc1-amber font-semibold">{fmtSar(e.annualSar)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-dc1-text-muted mt-2">
            {isAr
              ? '* الأرقام تقديرية عند 70% استخدام مع أسعار الكهرباء السعودية. النتائج الفعلية تتفاوت.'
              : '* Estimates at 70% utilisation, Saudi electricity rates. Actual results vary. Click any row to update the calculator.'}
          </p>
        </section>

        {/* ── CTA ── */}
        <section className="bg-dc1-surface-l1 border-t border-dc1-border">
          <div className="max-w-3xl mx-auto px-4 py-16 text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-green-400/10 rounded-full p-4">
                <CashIcon />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-dc1-text-primary mb-4">
              {isAr ? 'ابدأ الربح من GPU الخاص بك اليوم' : 'Start Earning From Your GPU Today'}
            </h2>
            <p className="text-dc1-text-secondary mb-8 max-w-xl mx-auto">
              {isAr
                ? 'انضم إلى أكثر من 43 مزوداً مسجلاً. الإعداد يستغرق أقل من 5 دقائق. بطاقتك الرسومية تعمل وتجني المال حتى أثناء خمولها.'
                : 'Join 43+ registered providers. Setup takes less than 5 minutes. Your GPU earns while it would otherwise sit idle.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/provider/register"
                className="inline-flex items-center justify-center gap-2 bg-dc1-amber hover:bg-dc1-amber/90 text-dc1-bg font-semibold px-8 py-3.5 rounded-xl transition-colors"
              >
                <BoltIcon />
                {isAr ? 'سجّل كمزود الآن' : 'Register as Provider'}
              </Link>
              <Link
                href="/provider/onboard"
                className="inline-flex items-center justify-center gap-2 bg-dc1-surface-l2 hover:bg-dc1-surface-l3 border border-dc1-border text-dc1-text-primary font-semibold px-8 py-3.5 rounded-xl transition-colors"
              >
                {isAr ? 'دليل البدء السريع' : 'Quick Start Guide'}
              </Link>
            </div>
            <p className="mt-6 text-xs text-dc1-text-muted">
              {isAr
                ? 'متوافق مع PDPL • مدفوعات بالريال السعودي • دعم 24/7'
                : 'PDPL-compliant • SAR payments • 24/7 support'}
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
