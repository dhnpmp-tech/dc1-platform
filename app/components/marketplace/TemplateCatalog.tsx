'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '../../lib/i18n'

interface Template {
  id: string
  name: string
  description: string
  icon: string
  difficulty: 'easy' | 'intermediate' | 'advanced'
  tier: string
  min_vram_gb: number
  estimated_price_sar_per_hour: number
  tags: string[]
  sort_order: number
}

interface TemplateCatalogProps {
  onSelectTemplate?: (template: Template) => void
}

export default function TemplateCatalog({ onSelectTemplate }: TemplateCatalogProps) {
  const { language, t } = useLanguage()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTier, setSelectedTier] = useState<string | null>(null)

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/templates')
        if (!response.ok) throw new Error('Failed to fetch templates')
        const data = await response.json()
        setTemplates(data.templates || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchTemplates()
  }, [])

  const filteredTemplates = selectedTier
    ? templates.filter(t => t.tier === selectedTier)
    : templates

  const tiers = ['instant', 'cached', 'standard', 'premium']
  const tierLabels: { [key: string]: string } = {
    instant: t('marketplace.tier_instant') || 'Instant',
    cached: t('marketplace.tier_cached') || 'Cached',
    standard: t('marketplace.tier_standard') || 'Standard',
    premium: t('marketplace.tier_premium') || 'Premium',
  }

  const difficultyLabels: { [key: string]: string } = {
    easy: t('marketplace.difficulty_easy') || 'Easy',
    intermediate: t('marketplace.difficulty_intermediate') || 'Intermediate',
    advanced: t('marketplace.difficulty_advanced') || 'Advanced',
  }

  const handleSelectTemplate = (template: Template) => {
    if (onSelectTemplate) {
      onSelectTemplate(template)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">{t('marketplace.loading') || 'Loading templates...'}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {t('marketplace.error_loading_templates') || 'Error loading templates:'} {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tier Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedTier(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            selectedTier === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {t('marketplace.all') || 'All'}
        </button>
        {tiers.map(tier => (
          <button
            key={tier}
            onClick={() => setSelectedTier(tier)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              selectedTier === tier
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tierLabels[tier] || tier.charAt(0).toUpperCase() + tier.slice(1)}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition hover:border-blue-300"
          >
            {/* Header with Icon */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="text-3xl">{template.icon}</div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{template.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-2 mb-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('marketplace.min_vram') || 'Min VRAM'}:</span>
                <span className="font-medium">{template.min_vram_gb} GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('marketplace.price_per_hour') || 'Price/hr'}:</span>
                <span className="font-medium text-green-600">
                  SAR {template.estimated_price_sar_per_hour.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('marketplace.difficulty') || 'Difficulty'}:</span>
                <span className="font-medium text-orange-600">
                  {difficultyLabels[template.difficulty] || template.difficulty}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('marketplace.tier') || 'Tier'}:</span>
                <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  {tierLabels[template.tier] || template.tier}
                </span>
              </div>
            </div>

            {/* Tags */}
            {template.tags && template.tags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1">
                {template.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className="inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
                {template.tags.length > 3 && (
                  <span className="text-xs text-gray-500">+{template.tags.length - 3}</span>
                )}
              </div>
            )}

            {/* Deploy Button */}
            <button
              onClick={() => handleSelectTemplate(template)}
              className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              {t('marketplace.deploy_now') || 'Deploy Now'}
            </button>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">{t('marketplace.no_templates') || 'No templates found'}</p>
        </div>
      )}
    </div>
  )
}
