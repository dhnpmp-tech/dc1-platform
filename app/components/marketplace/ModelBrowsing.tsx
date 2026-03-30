'use client'

import { useEffect, useState, useMemo } from 'react'
import { useLanguage } from '../../lib/i18n'

interface Model {
  model_id: string
  display_name: string
  family: string
  vram_gb: number
  quantization: string
  context_window: number
  use_cases: string[]
  min_gpu_vram_gb: number
  providers_online: number
  avg_price_sar_per_min: number
  status: 'available' | 'no_providers'
  tier?: string
  arabic_capability?: boolean
  cold_start_ms?: number
}

interface ModelCardFeed {
  model_id: string
  summary?: {
    en?: string
    ar?: string
  }
  metrics?: {
    vram_required_gb?: number
    latency_ms?: {
      p50?: number
      p95?: number
      p99?: number
    }
    arabic_quality?: {
      arabic_mmlu_score?: number
      arabicaqa_score?: number
    }
    cost_per_1k_tokens_sar?: number
    cold_start_ms?: number
  }
}

interface Filters {
  tier: string | null
  arabicCapability: boolean
  minVram: number
  computeType: string | null
}

type SortOption = 'price-asc' | 'price-desc' | 'latency-asc' | 'launch-priority' | 'availability'

interface ModelBrowsingProps {
  onSelectModel?: (model: Model) => void
}

export default function ModelBrowsing({ onSelectModel }: ModelBrowsingProps) {
  const { language, t, dir } = useLanguage()
  const tx = (key: string, en: string, ar: string) => {
    const value = t(key)
    return value === key ? (language === 'ar' ? ar : en) : value
  }
  const [models, setModels] = useState<Model[]>([])
  const [modelCards, setModelCards] = useState<Map<string, ModelCardFeed>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<Filters>({
    tier: null,
    arabicCapability: false,
    minVram: 0,
    computeType: null,
  })

  const [sortBy, setSortBy] = useState<SortOption>('availability')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catalogRes, cardsRes] = await Promise.all([
          fetch('/api/models/catalog'),
          fetch('/api/models/cards'),
        ])

        if (!catalogRes.ok) throw new Error('Failed to fetch model catalog')

        const catalogData = await catalogRes.json()
        setModels(catalogData.models || [])

        if (cardsRes.ok) {
          const cardsData = await cardsRes.json()
          const cardsMap = new Map<string, ModelCardFeed>()
          if (Array.isArray(cardsData.cards)) {
            cardsData.cards.forEach((card: ModelCardFeed) => {
              cardsMap.set(card.model_id, card)
            })
          }
          setModelCards(cardsMap)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredAndSorted = useMemo(() => {
    let result = [...models]

    // Apply filters
    if (filters.tier) {
      result = result.filter(m => m.tier === filters.tier)
    }
    if (filters.arabicCapability) {
      result = result.filter(m => m.arabic_capability === true)
    }
    if (filters.minVram > 0) {
      result = result.filter(m => m.min_gpu_vram_gb >= filters.minVram)
    }
    if (filters.computeType) {
      result = result.filter(m =>
        m.use_cases && m.use_cases.includes(filters.computeType!)
      )
    }

    // Apply sorting
    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.avg_price_sar_per_min - b.avg_price_sar_per_min)
        break
      case 'price-desc':
        result.sort((a, b) => b.avg_price_sar_per_min - a.avg_price_sar_per_min)
        break
      case 'latency-asc':
        result.sort((a, b) => {
          const aLatency = modelCards.get(a.model_id)?.metrics?.latency_ms?.p95 ?? Infinity
          const bLatency = modelCards.get(b.model_id)?.metrics?.latency_ms?.p95 ?? Infinity
          return aLatency - bLatency
        })
        break
      case 'launch-priority':
        result.sort((a, b) => {
          const aTier = ['tier_a', 'tier_b', 'tier_c'].indexOf(a.tier || 'tier_c')
          const bTier = ['tier_a', 'tier_b', 'tier_c'].indexOf(b.tier || 'tier_c')
          return aTier - bTier
        })
        break
      case 'availability':
      default:
        result.sort((a, b) => b.providers_online - a.providers_online)
    }

    return result
  }, [models, filters, sortBy, modelCards])

  const handleSelectModel = (model: Model) => {
    if (onSelectModel) {
      onSelectModel(model)
    }
  }

  const getModelSummary = (modelId: string): string => {
    const card = modelCards.get(modelId)
    const summary = card?.summary?.[language === 'ar' ? 'ar' : 'en']
    return summary || ''
  }

  const vramOptions = [0, 8, 16, 24, 80]
  const computeTypes = ['inference', 'training', 'rendering']

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">{tx('marketplace.loading', 'Loading models...', 'جارٍ تحميل النماذج...')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-status-error/10 border border-status-error/20 rounded-lg text-status-error">
        {tx('marketplace.error_loading_models', 'Error loading models:', 'خطأ أثناء تحميل النماذج:')} {error}
      </div>
    )
  }

  return (
    <div className="space-y-6" dir={dir}>
      {/* Filters and Sort */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Tier Filter */}
        <div>
          <label className="block text-sm font-medium text-dc1-text-secondary mb-2">
            {tx('marketplace.tier', 'Tier', 'الفئة')}
          </label>
          <select
            value={filters.tier || ''}
            onChange={e => setFilters({ ...filters, tier: e.target.value || null })}
            className="input w-full text-sm"
          >
            <option value="">{tx('marketplace.all', 'All', 'الكل')}</option>
            <option value="tier_a">Tier A</option>
            <option value="tier_b">Tier B</option>
            <option value="tier_c">Tier C</option>
          </select>
        </div>

        {/* Min VRAM Filter */}
        <div>
          <label className="block text-sm font-medium text-dc1-text-secondary mb-2">
            {tx('marketplace.min_vram', 'Min VRAM (GB)', 'الحد الأدنى VRAM (جيجابايت)')}
          </label>
          <select
            value={filters.minVram}
            onChange={e => setFilters({ ...filters, minVram: parseInt(e.target.value) })}
            className="input w-full text-sm"
          >
            {vramOptions.map(vram => (
              <option key={vram} value={vram}>
                {vram === 0 ? tx('marketplace.any', 'Any', 'أي') : `${vram} ${language === 'ar' ? 'جيجابايت' : 'GB'}`}
              </option>
            ))}
          </select>
        </div>

        {/* Compute Type Filter */}
        <div>
          <label className="block text-sm font-medium text-dc1-text-secondary mb-2">
            {tx('marketplace.compute_type', 'Compute Type', 'نوع الحوسبة')}
          </label>
          <select
            value={filters.computeType || ''}
            onChange={e => setFilters({ ...filters, computeType: e.target.value || null })}
            className="input w-full text-sm"
          >
            <option value="">{tx('marketplace.all', 'All', 'الكل')}</option>
            {computeTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Arabic Capability */}
        <div>
          <label className="block text-sm font-medium text-dc1-text-secondary mb-2">
            {tx('marketplace.language', 'Language', 'اللغة')}
          </label>
          <button
            onClick={() => setFilters({ ...filters, arabicCapability: !filters.arabicCapability })}
            className={`btn w-full text-sm ${
              filters.arabicCapability
                ? 'btn-primary'
                : 'btn-secondary'
            }`}
          >
            {tx('marketplace.arabic_only', 'Arabic', 'العربية فقط')}
          </button>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm font-medium text-dc1-text-secondary mb-2">
            {tx('marketplace.sort_by', 'Sort By', 'الترتيب حسب')}
          </label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="input w-full text-sm"
          >
            <option value="availability">{tx('marketplace.sort_availability', 'Availability', 'التوفر')}</option>
            <option value="price-asc">{tx('marketplace.sort_price_low', 'Price (Low)', 'السعر (منخفض)')}</option>
            <option value="price-desc">{tx('marketplace.sort_price_high', 'Price (High)', 'السعر (مرتفع)')}</option>
            <option value="latency-asc">{tx('marketplace.sort_latency', 'Latency', 'زمن الاستجابة')}</option>
            <option value="launch-priority">{tx('marketplace.sort_priority', 'Priority', 'الأولوية')}</option>
          </select>
        </div>
      </div>

      {/* Model Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAndSorted.map(model => (
          <div
            key={model.model_id}
            className="p-4 border border-dc1-border rounded-lg hover:shadow-lg transition hover:border-dc1-amber/30"
          >
            {/* Header */}
            <div className="mb-3">
              <h3 className="font-semibold text-gray-900">{model.display_name}</h3>
              <p className="text-xs text-gray-500 mt-1">{model.family}</p>
            </div>

            {/* Summary */}
            {getModelSummary(model.model_id) && (
              <p className="text-sm text-gray-600 mb-3">{getModelSummary(model.model_id)}</p>
            )}

            {/* Metadata */}
            <div className="space-y-2 mb-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">{tx('marketplace.vram', 'VRAM', 'VRAM')}:</span>
                <span className="font-medium">{model.vram_gb} {language === 'ar' ? 'جيجابايت' : 'GB'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{tx('marketplace.price_per_min', 'Price/min', 'السعر/دقيقة')}:</span>
                <span className="font-medium text-green-600">
                  {language === 'ar' ? 'ريال' : 'SAR'} {model.avg_price_sar_per_min.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{tx('marketplace.context_window', 'Context', 'السياق')}:</span>
                <span className="font-medium">{model.context_window} {language === 'ar' ? 'رمز' : 'tokens'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{tx('marketplace.providers_online', 'Providers', 'المزوّدون')}</span>
                <span className={`font-medium ${model.providers_online > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {model.providers_online}
                </span>
              </div>
            </div>

            {/* Use Cases */}
            {model.use_cases && model.use_cases.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1">
                {model.use_cases.map(useCase => (
                  <span
                    key={useCase}
                    className="inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                  >
                    {useCase}
                  </span>
                ))}
              </div>
            )}

            {/* Status */}
            <div className="mb-3">
              {model.status === 'available' ? (
                <span className="inline-block px-2 py-1 bg-status-success/10 text-status-success border border-status-success/20 rounded text-xs font-medium">
                  {tx('marketplace.available', 'Available', 'متاح')}
                </span>
              ) : (
                <span className="inline-block px-2 py-1 bg-status-error/10 text-status-error border border-status-error/20 rounded text-xs font-medium">
                  {tx('marketplace.no_providers', 'No Providers', 'لا يوجد مزوّدون')}
                </span>
              )}
            </div>

            {/* Deploy Button */}
            <button
              onClick={() => handleSelectModel(model)}
              disabled={model.status !== 'available'}
              className="btn btn-primary w-full text-sm disabled:cursor-not-allowed"
            >
              {tx('marketplace.deploy_model', 'Deploy Model', 'انشر النموذج')}
            </button>
          </div>
        ))}
      </div>

      {filteredAndSorted.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">{tx('marketplace.no_models', 'No models found', 'لم يتم العثور على نماذج')}</p>
        </div>
      )}

      {/* Results Count */}
      <div className="text-sm text-gray-600 text-center">
        {tx('marketplace.showing', 'Showing', 'عرض')} {filteredAndSorted.length} {tx('marketplace.of', 'of', 'من')} {models.length} {tx('marketplace.models', 'models', 'نماذج')}
      </div>
    </div>
  )
}
