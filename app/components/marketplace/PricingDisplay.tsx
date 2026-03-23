'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '../../lib/i18n'

interface CompetitorPricing {
  provider: string
  price_sar_per_hour: number
  color: string
}

interface CostEstimatorProps {
  modelId?: string
  vramGb?: number
  onPriceEstimate?: (totalPrice: number) => void
}

interface PricingDisplayProps {
  modelId?: string
  vramGb?: number
  pricePerHour?: number
  onPriceEstimate?: (totalPrice: number) => void
}

// Buyer economics from FOUNDER-STRATEGIC-BRIEF.md
const BUYER_ECONOMICS = [
  {
    scenario: 'AI Startup (4x A100)',
    hyperscalerYear: 8640,
    dcpYear: 5772,
    savings: 2868,
    savingsPercent: 33,
  },
  {
    scenario: 'ML Team (8x H100)',
    hyperscalerYear: 42048,
    dcpYear: 25536,
    savings: 16512,
    savingsPercent: 39,
  },
  {
    scenario: 'Enterprise (32x H100)',
    hyperscalerYear: 168192,
    dcpYear: 90680,
    savings: 77512,
    savingsPercent: 46,
  },
  {
    scenario: 'Render Farm (16x RTX 4090)',
    hyperscalerYear: 28032,
    dcpYear: 13824,
    savings: 14208,
    savingsPercent: 51,
  },
]

// Competitive pricing comparison (example data)
const COMPETITIVE_PRICING: { [key: string]: CompetitorPricing[] } = {
  'A100': [
    { provider: 'DC1', price_sar_per_hour: 24, color: 'bg-green-100 text-green-700' },
    { provider: 'Vast.ai', price_sar_per_hour: 36, color: 'bg-gray-100 text-gray-700' },
    { provider: 'RunPod', price_sar_per_hour: 48, color: 'bg-gray-100 text-gray-700' },
    { provider: 'AWS', price_sar_per_hour: 144, color: 'bg-red-100 text-red-700' },
  ],
  'H100': [
    { provider: 'DC1', price_sar_per_hour: 80, color: 'bg-green-100 text-green-700' },
    { provider: 'Vast.ai', price_sar_per_hour: 120, color: 'bg-gray-100 text-gray-700' },
    { provider: 'RunPod', price_sar_per_hour: 160, color: 'bg-gray-100 text-gray-700' },
    { provider: 'AWS', price_sar_per_hour: 480, color: 'bg-red-100 text-red-700' },
  ],
  'RTX4090': [
    { provider: 'DC1', price_sar_per_hour: 6, color: 'bg-green-100 text-green-700' },
    { provider: 'Vast.ai', price_sar_per_hour: 10, color: 'bg-gray-100 text-gray-700' },
    { provider: 'RunPod', price_sar_per_hour: 14, color: 'bg-gray-100 text-gray-700' },
  ],
}

function CostEstimator({ modelId, vramGb, onPriceEstimate }: CostEstimatorProps) {
  const { t } = useLanguage()
  const [hours, setHours] = useState(1)
  const [minutes, setMinutes] = useState(0)
  const [tokens, setTokens] = useState(1000)
  const [estimateMode, setEstimateMode] = useState<'duration' | 'tokens'>('duration')

  // Example pricing: 1 SAR per hour base, scaled by VRAM
  const basePrice = vramGb ? (vramGb / 8) * 1.5 : 1.5
  const costPerHour = basePrice
  const costPerMin = costPerHour / 60
  const costPer1KTokens = vramGb ? 0.01 * (vramGb / 8) : 0.01

  const totalDurationMinutes = hours * 60 + minutes
  const durationCost = totalDurationMinutes * costPerMin
  const tokenCost = (tokens / 1000) * costPer1KTokens
  const estimatedTotal = estimateMode === 'duration' ? durationCost : tokenCost

  useEffect(() => {
    if (onPriceEstimate) {
      onPriceEstimate(estimatedTotal)
    }
  }, [estimatedTotal, onPriceEstimate])

  return (
    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h4 className="font-semibold text-gray-900 mb-3">{t('marketplace.cost_estimator') || 'Cost Estimator'}</h4>

      {/* Mode Toggle */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setEstimateMode('duration')}
          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
            estimateMode === 'duration'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-300 text-gray-700'
          }`}
        >
          {t('marketplace.by_duration') || 'By Duration'}
        </button>
        <button
          onClick={() => setEstimateMode('tokens')}
          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
            estimateMode === 'tokens'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-300 text-gray-700'
          }`}
        >
          {t('marketplace.by_tokens') || 'By Tokens'}
        </button>
      </div>

      {/* Duration Mode */}
      {estimateMode === 'duration' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('marketplace.hours') || 'Hours'}
            </label>
            <input
              type="number"
              min="0"
              max="168"
              value={hours}
              onChange={e => setHours(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('marketplace.minutes') || 'Minutes'}
            </label>
            <input
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={e => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>
      )}

      {/* Token Mode */}
      {estimateMode === 'tokens' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('marketplace.num_tokens') || 'Number of Tokens'}
          </label>
          <input
            type="number"
            min="1"
            max="1000000"
            value={tokens}
            onChange={e => setTokens(Math.max(1, parseInt(e.target.value) || 1000))}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
      )}

      {/* Breakdown */}
      <div className="mt-3 space-y-2 text-xs">
        {estimateMode === 'duration' && (
          <>
            <div className="flex justify-between text-gray-600">
              <span>{t('marketplace.per_hour') || 'Per hour'}:</span>
              <span>SAR {costPerHour.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{t('marketplace.duration') || 'Duration'}:</span>
              <span>
                {hours > 0 && `${hours}h `}
                {minutes > 0 && `${minutes}m`}
                {hours === 0 && minutes === 0 && '0m'}
              </span>
            </div>
          </>
        )}
        {estimateMode === 'tokens' && (
          <div className="flex justify-between text-gray-600">
            <span>{t('marketplace.per_1k_tokens') || 'Per 1K tokens'}:</span>
            <span>SAR {costPer1KTokens.toFixed(4)}</span>
          </div>
        )}
      </div>

      {/* Total */}
      <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between">
        <span className="font-semibold text-gray-900">{t('marketplace.estimated_total') || 'Estimated Total'}:</span>
        <span className="text-lg font-bold text-green-600">SAR {estimatedTotal.toFixed(2)}</span>
      </div>
    </div>
  )
}

export default function PricingDisplay({ modelId, vramGb, pricePerHour, onPriceEstimate }: PricingDisplayProps) {
  const { t } = useLanguage()
  const [estimatedPrice, setEstimatedPrice] = useState(0)

  useEffect(() => {
    if (onPriceEstimate && estimatedPrice > 0) {
      onPriceEstimate(estimatedPrice)
    }
  }, [estimatedPrice, onPriceEstimate])

  const gpuType = vramGb && vramGb >= 80 ? 'H100' : vramGb && vramGb >= 48 ? 'A100' : 'RTX4090'
  const competitorPrices = COMPETITIVE_PRICING[gpuType] || []

  return (
    <div className="space-y-6">
      {/* Competitive Pricing */}
      {competitorPrices.length > 0 && (
        <div className="p-4 border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-4">
            {t('marketplace.competitive_pricing') || 'Market Comparison'} ({gpuType})
          </h3>
          <div className="space-y-2">
            {competitorPrices.map(comp => {
              const discount = comp.provider === 'DC1'
                ? ((competitorPrices[1]?.price_sar_per_hour - comp.price_sar_per_hour) / competitorPrices[1]?.price_sar_per_hour * 100).toFixed(0)
                : null
              return (
                <div key={comp.provider} className="flex items-center justify-between p-2 rounded">
                  <span className="font-medium text-gray-900">{comp.provider}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">SAR {comp.price_sar_per_hour}</span>
                    {discount && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                        Save {discount}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cost Estimator */}
      <CostEstimator
        modelId={modelId}
        vramGb={vramGb}
        onPriceEstimate={setEstimatedPrice}
      />

      {/* Buyer Economics */}
      <div className="p-4 border border-gray-200 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-4">
          {t('marketplace.buyer_economics') || 'Annual Savings Examples'}
        </h3>
        <div className="space-y-3">
          {BUYER_ECONOMICS.map(scenario => (
            <div key={scenario.scenario} className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{scenario.scenario}</h4>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-bold">
                  {scenario.savingsPercent}% {t('marketplace.savings') || 'Save'}
                </span>
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>{t('marketplace.hyperscaler') || 'Hyperscaler'}: SAR {scenario.hyperscalerYear.toLocaleString()}/yr</span>
                  <span>{t('marketplace.dcp') || 'DC1'}: SAR {scenario.dcpYear.toLocaleString()}/yr</span>
                </div>
                <div className="text-green-600 font-medium">
                  {t('marketplace.annual_savings') || 'Annual Savings'}: SAR {scenario.savings.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-gray-700">
          💡 {t('marketplace.pricing_info') || 'Pricing is real-time based on provider costs and market conditions. DC1 offers 33-51% savings vs hyperscalers through energy arbitrage in Saudi Arabia.'}
        </p>
      </div>
    </div>
  )
}
