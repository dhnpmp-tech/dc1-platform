'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  intentSupportCategory,
  persistRoleIntent,
  readRoleIntent,
  RoleIntent,
  trackRoleIntentApplied,
} from '../../lib/role-intent'

type IntentHrefMap = Partial<Record<RoleIntent, string>>

interface RoleIntentLinkProps {
  href: string
  className?: string
  children: ReactNode
  persistIntent?: RoleIntent
  source: string
  roleAwareHrefs?: IntentHrefMap
  applyDestination?: string
}

export default function RoleIntentLink({
  href,
  className,
  children,
  persistIntent,
  source,
  roleAwareHrefs,
  applyDestination = 'link',
}: RoleIntentLinkProps) {
  const [resolvedHref, setResolvedHref] = useState(href)
  const appliedTracked = useRef(false)

  const hrefByIntent = useMemo(() => roleAwareHrefs || {}, [roleAwareHrefs])

  useEffect(() => {
    const intent = readRoleIntent()
    if (!intent) return

    const nextHref =
      hrefByIntent[intent] ||
      (href.includes('/support?') ? `/support?category=${intentSupportCategory(intent)}&source=${source}` : href)

    setResolvedHref(nextHref)

    if (!appliedTracked.current && nextHref !== href) {
      trackRoleIntentApplied(intent, { source, destination: applyDestination })
      appliedTracked.current = true
    }
  }, [applyDestination, href, hrefByIntent, source])

  const handleClick = () => {
    if (!persistIntent) return
    const previousIntent = readRoleIntent()
    persistRoleIntent(persistIntent, {
      source,
      previousIntent,
      reason: previousIntent && previousIntent !== persistIntent ? 'overridden' : 'persisted',
    })
  }

  return (
    <Link href={resolvedHref} onClick={handleClick} className={className}>
      {children}
    </Link>
  )
}
