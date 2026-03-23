'use client'

import { useState } from 'react'
import { useLanguage } from '../../lib/i18n'

interface ProjectionData {
  gpu: string
  vram: string
  vastTypical: string
  runpodComm: string
  dcpFloor: string
  buyerDiscount: string
  uk: { electricityHr: string; monthlyElec: string; monthlyProfit: string }
  euAvg: { electricityHr: string; monthlyElec: string; monthlyProfit: string }
  usa: { electricityHr: string; monthlyElec: string; monthlyProfit: string }
  saudiInd: { electricityHr: string; monthlyElec: string; monthlyProfit: string }
  saudiCCSEZ: { electricityHr: string; monthlyElec: string; monthlyProfit: string }
}

const PROJECTIONS: ProjectionData[] = [
  {
    gpu: 'RTX 3090',
    vram: '24GB',
    vastTypical: '$0.17/hr',
    runpodComm: '$0.22/hr',
    dcpFloor: '$0.105/hr',
    buyerDiscount: '-38.0%',
    uk: { electricityHr: '$0.0563/hr', monthlyElec: '$28.8/mo', monthlyProfit: '$53/mo' },
    euAvg: { electricityHr: '$0.0408/hr', monthlyElec: '$20.8/mo', monthlyProfit: '$58/mo' },
    usa: { electricityHr: '$0.0168/hr', monthlyElec: '$8.6/mo', monthlyProfit: '$76/mo' },
    saudiInd: { electricityHr: '$0.0117/hr', monthlyElec: '$5.9/mo', monthlyProfit: '$81/mo' },
    saudiCCSEZ: { electricityHr: '$0.0105/hr', monthlyElec: '$5.4/mo', monthlyProfit: '$82/mo' },
  },
  {
    gpu: 'RTX 4080',
    vram: '16GB',
    vastTypical: '$0.19/hr',
    runpodComm: '$0.34/hr',
    dcpFloor: '$0.131/hr',
    buyerDiscount: '-31.1%',
    uk: { electricityHr: '$0.0849/hr', monthlyElec: '$43.3/mo', monthlyProfit: '$67/mo' },
    euAvg: { electricityHr: '$0.0613/hr', monthlyElec: '$31.3/mo', monthlyProfit: '$75/mo' },
    usa: { electricityHr: '$0.0253/hr', monthlyElec: '$12.9/mo', monthlyProfit: '$95/mo' },
    saudiInd: { electricityHr: '$0.0168/hr', monthlyElec: '$8.6/mo', monthlyProfit: '$100/mo' },
    saudiCCSEZ: { electricityHr: '$0.0153/hr', monthlyElec: '$7.8/mo', monthlyProfit: '$104/mo' },
  },
  {
    gpu: 'RTX 4090',
    vram: '24GB',
    vastTypical: '$0.35/hr',
    runpodComm: '$0.34/hr',
    dcpFloor: '$0.267/hr',
    buyerDiscount: '-23.7%',
    uk: { electricityHr: '$0.1287/hr', monthlyElec: '$65.8/mo', monthlyProfit: '$98/mo' },
    euAvg: { electricityHr: '$0.1112/hr', monthlyElec: '$56.8/mo', monthlyProfit: '$107/mo' },
    usa: { electricityHr: '$0.0468/hr', monthlyElec: '$23.9/mo', monthlyProfit: '$140/mo' },
    saudiInd: { electricityHr: '$0.0310/hr', monthlyElec: '$15.8/mo', monthlyProfit: '$148/mo' },
    saudiCCSEZ: { electricityHr: '$0.0281/hr', monthlyElec: '$14.4/mo', monthlyProfit: '$149/mo' },
  },
  {
    gpu: 'RTX 5090',
    vram: '32GB',
    vastTypical: '$0.50/hr',
    runpodComm: '$0.69/hr',
    dcpFloor: '$0.394/hr',
    buyerDiscount: '-21.2%',
    uk: { electricityHr: '$0.1835/hr', monthlyElec: '$93.8/mo', monthlyProfit: '$139/mo' },
    euAvg: { electricityHr: '$0.1586/hr', monthlyElec: '$81.0/mo', monthlyProfit: '$152/mo' },
    usa: { electricityHr: '$0.0668/hr', monthlyElec: '$34.1/mo', monthlyProfit: '$200/mo' },
    saudiInd: { electricityHr: '$0.0442/hr', monthlyElec: '$22.6/mo', monthlyProfit: '$211/mo' },
    saudiCCSEZ: { electricityHr: '$0.0401/hr', monthlyElec: '$20.5/mo', monthlyProfit: '$213/mo' },
  },
  {
    gpu: 'A100 SXM',
    vram: '80GB',
    vastTypical: '$0.86/hr',
    runpodComm: '$1.39/hr',
    dcpFloor: '$0.786/hr',
    buyerDiscount: '-8.6%',
    uk: { electricityHr: '$0.3683/hr', monthlyElec: '$188.0/mo', monthlyProfit: '$278/mo' },
    euAvg: { electricityHr: '$0.3182/hr', monthlyElec: '$162.6/mo', monthlyProfit: '$305/mo' },
    usa: { electricityHr: '$0.1340/hr', monthlyElec: '$68.4/mo', monthlyProfit: '$399/mo' },
    saudiInd: { electricityHr: '$0.0885/hr', monthlyElec: '$45.3/mo', monthlyProfit: '$422/mo' },
    saudiCCSEZ: { electricityHr: '$0.0802/hr', monthlyElec: '$40.9/mo', monthlyProfit: '$427/mo' },
  },
  {
    gpu: 'H100 SXM',
    vram: '80GB',
    vastTypical: '$1.55/hr',
    runpodComm: '$2.69/hr',
    dcpFloor: '$1.421/hr',
    buyerDiscount: '-8.3%',
    uk: { electricityHr: '$0.6613/hr', monthlyElec: '$337.7/mo', monthlyProfit: '$498/mo' },
    euAvg: { electricityHr: '$0.5713/hr', monthlyElec: '$291.8/mo', monthlyProfit: '$546/mo' },
    usa: { electricityHr: '$0.2408/hr', monthlyElec: '$123.0/mo', monthlyProfit: '$715/mo' },
    saudiInd: { electricityHr: '$0.1591/hr', monthlyElec: '$81.3/mo', monthlyProfit: '$756/mo' },
    saudiCCSEZ: { electricityHr: '$0.1443/hr', monthlyElec: '$73.8/mo', monthlyProfit: '$766/mo' },
  },
]

interface EarningsProjectionsProps {
  isLoading?: boolean
  error?: string | null
}

export default function EarningsProjections({ isLoading = false, error }: EarningsProjectionsProps) {
  const { t, isRTL } = useLanguage()
  const [selectedGpu, setSelectedGpu] = useState<string>('RTX 4090')
  const [selectedMetric, setSelectedMetric] = useState<'profit' | 'electricity' | 'comparison'>('profit')

  const gpuTypes = PROJECTIONS.map(p => p.gpu)
  const currentGpu = PROJECTIONS.find(p => p.gpu === selectedGpu) || PROJECTIONS[2]

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-900">
        <h3 className="font-semibold mb-2">Error loading projections</h3>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-64 bg-dc1-surface-l1 rounded-lg animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-dc1-surface-l1 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-bold ${isRTL ? 'text-right' : 'text-left'}`}>
          {isRTL ? 'توقعات الأرباح الشهرية' : 'Monthly Earnings Projections'}
        </h2>
        <p className={`text-sm text-dc1-text-secondary mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
          {isRTL
            ? 'بناءً على معدل استخدام 70% وأسعار DCP الحالية'
            : 'Based on 70% utilization at current DCP floor prices'}
        </p>
      </div>

      {/* GPU Type Selector */}
      <div className="flex flex-wrap gap-2">
        {gpuTypes.map(gpu => (
          <button
            key={gpu}
            onClick={() => setSelectedGpu(gpu)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedGpu === gpu
                ? 'bg-dc1-amber text-dc1-surface-l2 shadow-md'
                : 'bg-dc1-surface-l1 text-dc1-text-primary border border-dc1-border hover:border-dc1-border-light'
            }`}
          >
            {gpu}
          </button>
        ))}
      </div>

      {/* Metric Selector */}
      <div className="flex flex-wrap gap-2">
        {(['profit', 'electricity', 'comparison'] as const).map(metric => (
          <button
            key={metric}
            onClick={() => setSelectedMetric(metric)}
            className={`px-3 py-1.5 rounded text-sm transition-all ${
              selectedMetric === metric
                ? 'bg-dc1-amber text-dc1-surface-l2'
                : 'bg-dc1-surface-l1 text-dc1-text-secondary border border-dc1-border hover:border-dc1-border-light'
            }`}
          >
            {metric === 'profit' && (isRTL ? 'الربح الشهري' : 'Monthly Profit')}
            {metric === 'electricity' && (isRTL ? 'تكلفة الكهرباء' : 'Electricity Cost')}
            {metric === 'comparison' && (isRTL ? 'مقارنة الأسعار' : 'Price Comparison')}
          </button>
        ))}
      </div>

      {/* Content Section */}
      {selectedMetric === 'profit' && (
        <div className="bg-dc1-surface-l1 rounded-lg p-6 overflow-x-auto">
          <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
            <thead>
              <tr className="border-b border-dc1-border">
                <th className="pb-3 font-semibold text-dc1-text-secondary">
                  {isRTL ? 'المنطقة' : 'Region'}
                </th>
                <th className="pb-3 font-semibold text-dc1-text-secondary px-3">
                  {isRTL ? 'تكلفة الكهرباء/ساعة' : 'Electricity/hr'}
                </th>
                <th className="pb-3 font-semibold text-dc1-text-secondary px-3">
                  {isRTL ? 'التكلفة الشهرية' : 'Monthly Cost'}
                </th>
                <th className="pb-3 font-semibold text-status-success px-3">
                  {isRTL ? 'الربح الشهري' : 'Monthly Profit'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dc1-border">
              {[
                { name: isRTL ? 'المملكة المتحدة' : 'United Kingdom', data: currentGpu.uk },
                { name: isRTL ? 'الاتحاد الأوروبي' : 'EU Average', data: currentGpu.euAvg },
                { name: isRTL ? 'الولايات المتحدة' : 'USA', data: currentGpu.usa },
                { name: isRTL ? 'السعودية (صناعي)' : 'Saudi Industrial', data: currentGpu.saudiInd },
                { name: isRTL ? 'السعودية (CCSEZ)' : 'Saudi CCSEZ', data: currentGpu.saudiCCSEZ },
              ].map(region => (
                <tr key={region.name} className="hover:bg-dc1-surface-l2 transition-colors">
                  <td className="py-3 font-medium">{region.name}</td>
                  <td className="py-3 px-3 text-dc1-text-secondary">{region.data.electricityHr}</td>
                  <td className="py-3 px-3 text-dc1-text-secondary">{region.data.monthlyElec}</td>
                  <td className="py-3 px-3 text-status-success font-semibold">{region.data.monthlyProfit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedMetric === 'electricity' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { name: isRTL ? 'المملكة المتحدة' : 'United Kingdom', data: currentGpu.uk },
            { name: isRTL ? 'الاتحاد الأوروبي' : 'EU Average', data: currentGpu.euAvg },
            { name: isRTL ? 'الولايات المتحدة' : 'USA', data: currentGpu.usa },
            { name: isRTL ? 'السعودية (صناعي)' : 'Saudi Industrial', data: currentGpu.saudiInd },
            { name: isRTL ? 'السعودية (CCSEZ)' : 'Saudi CCSEZ', data: currentGpu.saudiCCSEZ },
          ].map(region => (
            <div key={region.name} className="bg-dc1-surface-l2 rounded-lg p-4 text-center">
              <p className="text-sm text-dc1-text-secondary mb-2">{region.name}</p>
              <p className="text-2xl font-bold text-dc1-amber mb-1">{region.data.monthlyElec}</p>
              <p className="text-xs text-dc1-text-muted">{region.data.electricityHr}</p>
            </div>
          ))}
        </div>
      )}

      {selectedMetric === 'comparison' && (
        <div className="bg-dc1-surface-l1 rounded-lg p-6 overflow-x-auto">
          <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
            <thead>
              <tr className="border-b border-dc1-border">
                <th className="pb-3 font-semibold text-dc1-text-secondary">
                  {isRTL ? 'منصة السعر' : 'Price Platform'}
                </th>
                <th className="pb-3 font-semibold text-dc1-text-secondary px-3">
                  {isRTL ? 'السعر' : 'Price'}
                </th>
                <th className="pb-3 font-semibold text-status-success px-3">
                  {isRTL ? 'خصم المشتري' : 'Buyer Discount'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dc1-border">
              {[
                { name: 'Vast.ai Typical', price: currentGpu.vastTypical, discount: '-' },
                { name: 'RunPod Community', price: currentGpu.runpodComm, discount: '-' },
                { name: 'DCP Floor Price', price: currentGpu.dcpFloor, discount: currentGpu.buyerDiscount },
              ].map(row => (
                <tr key={row.name} className="hover:bg-dc1-surface-l2 transition-colors">
                  <td className="py-3 font-medium">{row.name}</td>
                  <td className="py-3 px-3 text-dc1-amber font-semibold">{row.price}</td>
                  <td className={`py-3 px-3 font-semibold ${row.discount === '-' ? '' : 'text-status-success'}`}>
                    {row.discount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={`text-xs text-dc1-text-secondary mt-4 ${isRTL ? 'text-right' : 'text-left'}`}>
            {isRTL
              ? 'أسعار DCP الأرضية توفر للمشترين 8-38٪ أقل من أي منصة منافسة'
              : 'DCP floor prices offer buyers 8-38% less than any competing marketplace'}
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className={`text-xs text-blue-900 ${isRTL ? 'text-right' : 'text-left'}`}>
          {isRTL
            ? '⚠️ هذه توقعات بناءً على معدل استخدام 70% والأسعار الحالية. قد تختلف الأرباح الفعلية بناءً على عوامل السوق والطلب الفعلي.'
            : '⚠️ These are projections based on 70% utilization at current prices. Actual earnings may vary based on market conditions and real demand.'}
        </p>
      </div>
    </div>
  )
}
