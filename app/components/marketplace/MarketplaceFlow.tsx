'use client'

import { useState, useCallback } from 'react'
import { useLanguage } from '../../lib/i18n'
import TemplateCatalog from './TemplateCatalog'
import ModelBrowsing from './ModelBrowsing'
import PricingDisplay from './PricingDisplay'

type FlowStep = 'browse-templates' | 'browse-models' | 'pricing' | 'deploy-estimate' | 'deploy-confirm'

interface SelectedItem {
  type: 'template' | 'model'
  data: any
}

interface DeployEstimate {
  model_id: string
  duration_minutes: number
  estimated_cost_sar: number
  provider_id?: number
  warm_cache_available: boolean
  estimated_cold_start_ms: number
}

interface MarketplaceFlowProps {
  onDeploySubmit?: (deployRequest: any) => void
}

export default function MarketplaceFlow({ onDeploySubmit }: MarketplaceFlowProps) {
  const { t } = useLanguage()

  const [currentStep, setCurrentStep] = useState<FlowStep>('browse-templates')
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)
  const [deployEstimate, setDeployEstimate] = useState<DeployEstimate | null>(null)
  const [estimatedPrice, setEstimatedPrice] = useState(0)
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)

  const handleSelectTemplate = useCallback((template: any) => {
    setSelectedItem({ type: 'template', data: template })
    setCurrentStep('browse-models')
  }, [])

  const handleSelectModel = useCallback((model: any) => {
    setSelectedItem({ type: 'model', data: model })
    setCurrentStep('pricing')
  }, [])

  const handleEstimatePrice = useCallback((price: number) => {
    setEstimatedPrice(price)
  }, [])

  const handleProceedToDeploy = async () => {
    if (!selectedItem || selectedItem.type !== 'model') return

    setCurrentStep('deploy-estimate')
    setDeploying(true)
    setDeployError(null)

    try {
      // GET /api/models/:model_id/deploy/estimate — read-only, params via query string
      const encodedId = encodeURIComponent(selectedItem.data.model_id)
      const response = await fetch(
        `/api/models/${encodedId}/deploy/estimate?duration_minutes=60`
      )

      if (!response.ok) {
        throw new Error('Failed to estimate deployment cost')
      }

      const estimate = await response.json()
      setDeployEstimate(estimate)
      setCurrentStep('deploy-confirm')
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Unknown error')
      setCurrentStep('pricing')
    } finally {
      setDeploying(false)
    }
  }

  const handleConfirmDeploy = async () => {
    if (!selectedItem || !deployEstimate) return

    setDeploying(true)
    setDeployError(null)

    try {
      const response = await fetch(
        `/api/models/${selectedItem.data.model_id}/deploy`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            duration_minutes: 60,
            // Additional deployment params
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to submit deployment request')
      }

      const result = await response.json()

      if (onDeploySubmit) {
        onDeploySubmit(result)
      }

      // Reset flow
      setCurrentStep('browse-templates')
      setSelectedItem(null)
      setDeployEstimate(null)
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDeploying(false)
    }
  }

  const handleBackStep = () => {
    switch (currentStep) {
      case 'browse-models':
        setCurrentStep('browse-templates')
        setSelectedItem(null)
        break
      case 'pricing':
        setCurrentStep('browse-models')
        break
      case 'deploy-estimate':
      case 'deploy-confirm':
        setCurrentStep('pricing')
        setDeployEstimate(null)
        break
      default:
        break
    }
  }

  const currentItemName = selectedItem
    ? selectedItem.type === 'template'
      ? selectedItem.data.name
      : selectedItem.data.display_name
    : null

  return (
    <div className="max-w-6xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-gray-900">
            {currentStep === 'browse-templates' && '1️⃣ ' + (t('marketplace.select_template') || 'Select Template')}
            {currentStep === 'browse-models' && '2️⃣ ' + (t('marketplace.select_model') || 'Select Model')}
            {currentStep === 'pricing' && '3️⃣ ' + (t('marketplace.review_pricing') || 'Review Pricing')}
            {currentStep === 'deploy-estimate' && '4️⃣ ' + (t('marketplace.deployment_estimate') || 'Deployment Estimate')}
            {currentStep === 'deploy-confirm' && '5️⃣ ' + (t('marketplace.confirm_deploy') || 'Confirm Deploy')}
          </span>
          {currentItemName && (
            <span className="text-xs text-gray-500">{currentItemName}</span>
          )}
        </div>
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{
              width: currentStep === 'browse-templates' ? '20%' :
                     currentStep === 'browse-models' ? '40%' :
                     currentStep === 'pricing' ? '60%' :
                     currentStep === 'deploy-estimate' ? '80%' : '100%'
            }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {/* Browse Templates */}
        {currentStep === 'browse-templates' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {t('marketplace.template_catalog') || 'Template Catalog'}
            </h2>
            <TemplateCatalog onSelectTemplate={handleSelectTemplate} />
          </div>
        )}

        {/* Browse Models */}
        {currentStep === 'browse-models' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('marketplace.select_model') || 'Select a Model'}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('marketplace.template_selected') || 'Template'}: <span className="font-semibold">{currentItemName}</span>
            </p>
            <ModelBrowsing onSelectModel={handleSelectModel} />
          </div>
        )}

        {/* Pricing Review */}
        {currentStep === 'pricing' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('marketplace.review_pricing') || 'Review Pricing'}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('marketplace.model_selected') || 'Model'}: <span className="font-semibold">{currentItemName}</span>
            </p>
            <PricingDisplay
              modelId={selectedItem?.data.model_id}
              vramGb={selectedItem?.data.vram_gb || selectedItem?.data.min_vram_gb}
              onPriceEstimate={handleEstimatePrice}
            />
          </div>
        )}

        {/* Deploy Estimate */}
        {currentStep === 'deploy-estimate' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('marketplace.deployment_estimate') || 'Deployment Estimate'}
            </h2>
            {deploying ? (
              <div className="text-center py-8">
                <div className="text-gray-500">{t('marketplace.calculating') || 'Calculating estimate...'}</div>
              </div>
            ) : deployError ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {deployError}
              </div>
            ) : deployEstimate ? (
              <div className="space-y-4">
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    {t('marketplace.deployment_details') || 'Deployment Details'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('marketplace.estimated_cost') || 'Estimated Cost'}:</span>
                      <span className="font-semibold text-green-600">
                        SAR {deployEstimate.estimated_cost_sar.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('marketplace.duration') || 'Duration'}:</span>
                      <span>{deployEstimate.duration_minutes} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('marketplace.cold_start') || 'Est. Cold Start'}:</span>
                      <span>{deployEstimate.estimated_cold_start_ms}ms</span>
                    </div>
                    {deployEstimate.warm_cache_available && (
                      <div className="flex justify-between text-green-600">
                        <span className="font-medium">✓ {t('marketplace.warm_cache') || 'Warm Cache Available'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Deploy Confirmation */}
        {currentStep === 'deploy-confirm' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('marketplace.confirm_deploy') || 'Confirm Deployment'}
            </h2>
            {deployEstimate && (
              <div className="space-y-4">
                <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-3">
                    {t('marketplace.ready_to_deploy') || 'Ready to Deploy'}
                  </h3>
                  <div className="space-y-2 text-sm text-green-800">
                    <p><span className="font-medium">{t('marketplace.model') || 'Model'}:</span> {currentItemName}</p>
                    <p><span className="font-medium">{t('marketplace.estimated_cost') || 'Estimated Cost'}:</span> SAR {deployEstimate.estimated_cost_sar.toFixed(2)}</p>
                    <p><span className="font-medium">{t('marketplace.duration') || 'Duration'}:</span> {deployEstimate.duration_minutes} minutes</p>
                  </div>
                </div>

                {deployError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {deployError}
                  </div>
                )}

                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                  {t('marketplace.deploy_terms') || 'By clicking Deploy, you agree to the service terms. Charges will be applied to your account.'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-3 justify-between">
        <button
          onClick={handleBackStep}
          disabled={currentStep === 'browse-templates' || deploying}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {t('marketplace.back') || 'Back'}
        </button>

        <div className="flex gap-3">
          {currentStep === 'pricing' && (
            <button
              onClick={handleProceedToDeploy}
              disabled={deploying}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {deploying ? (t('marketplace.calculating') || 'Calculating...') : (t('marketplace.next') || 'Next')}
            </button>
          )}

          {currentStep === 'deploy-confirm' && (
            <button
              onClick={handleConfirmDeploy}
              disabled={deploying}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
            >
              {deploying ? (t('marketplace.deploying') || 'Deploying...') : (t('marketplace.deploy_now') || 'Deploy Now')}
            </button>
          )}

          {(currentStep === 'browse-templates' || currentStep === 'browse-models' || currentStep === 'deploy-estimate') && (
            <button
              onClick={() => {
                if (currentStep === 'browse-templates') {
                  setCurrentStep('browse-models')
                } else if (currentStep === 'browse-models') {
                  setCurrentStep('pricing')
                } else if (currentStep === 'deploy-estimate') {
                  setCurrentStep('deploy-confirm')
                }
              }}
              disabled={!selectedItem || deploying}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {t('marketplace.next') || 'Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
