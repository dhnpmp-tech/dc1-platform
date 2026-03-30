'use client'

import { useLanguage } from '../../lib/i18n'

interface ProviderAvailabilityBadgeProps {
  /** Number of providers online for this model (from model catalog data) */
  count: number
  /** Whether to show the full "check back soon" message when offline */
  showOfflineMessage?: boolean
  className?: string
}

/**
 * Displays a green/grey availability dot with provider count.
 * Green = at least 1 provider online, grey = none.
 */
export default function ProviderAvailabilityBadge({
  count,
  showOfflineMessage = false,
  className = '',
}: ProviderAvailabilityBadgeProps) {
  const { isRTL } = useLanguage()
  const online = count > 0
  const providerWord = isRTL ? 'مزود' : `provider${count === 1 ? '' : 's'}`
  const availableWord = isRTL ? 'متاح' : 'available'
  const offlineLabel = isRTL ? 'لا يوجد مزودون متصلون' : 'No providers online'
  const offlineCheckBackLabel = isRTL ? 'لا يوجد مزودون متصلون — تحقق لاحقًا' : 'No providers online — check back soon'

  if (!online && showOfflineMessage) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-dc1-text-muted ${className}`}>
        <span className="inline-block w-2 h-2 rounded-full bg-dc1-text-muted/40 shrink-0" />
        {offlineCheckBackLabel}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        online ? 'text-status-success' : 'text-dc1-text-muted'
      } ${className}`}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
          online ? 'bg-status-success animate-pulse' : 'bg-dc1-text-muted/40'
        }`}
      />
      {online ? `${count} ${providerWord} ${availableWord}` : offlineLabel}
    </span>
  )
}
