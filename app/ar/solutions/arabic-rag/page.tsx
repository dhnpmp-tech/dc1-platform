'use client'

/**
 * /ar/solutions/arabic-rag
 *
 * Forces Arabic language context then renders the shared landing page.
 * This route is the canonical Arabic version used for direct deep-links and
 * marketing campaigns targeting Arabic-speaking enterprise prospects.
 */

import { useEffect } from 'react'
import { useLanguage } from '../../../lib/i18n'
import ArabicRagPage from '../../../solutions/arabic-rag/page'

export default function ArabicRagPageAr() {
  const { setLanguage } = useLanguage()

  useEffect(() => {
    setLanguage('ar')
  }, [setLanguage])

  return <ArabicRagPage />
}
