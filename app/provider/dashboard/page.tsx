'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../lib/i18n'

export default function ProviderDashboardRedirect() {
  const router = useRouter()
  const { t } = useLanguage()
  useEffect(() => { router.replace('/provider') }, [router])
  return <div className="flex items-center justify-center min-h-screen text-dc1-text-secondary">{t('common.loading')}</div>
}
