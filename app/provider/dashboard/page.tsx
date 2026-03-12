'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProviderDashboardRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/provider') }, [router])
  return <div className="flex items-center justify-center min-h-screen text-dc1-text-secondary">Redirecting...</div>
}
