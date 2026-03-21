'use client'

import Link from 'next/link'
import { useMemo } from 'react'

interface DocsLanguageToggleProps {
  currentLocale: 'en' | 'ar'
  englishHref: string | null
  arabicHref: string | null
}

export default function DocsLanguageToggle({
  currentLocale,
  englishHref,
  arabicHref,
}: DocsLanguageToggleProps) {
  const options = useMemo(
    () => [
      { code: 'en', label: 'EN', href: englishHref },
      { code: 'ar', label: 'AR', href: arabicHref },
    ],
    [arabicHref, englishHref]
  )

  return (
    <div className="inline-flex items-center rounded-md border border-dc1-border bg-dc1-surface-l2 p-1">
      {options.map((option) => {
        const isActive = option.code === currentLocale
        const isDisabled = !option.href

        if (isDisabled) {
          return (
            <span
              key={option.code}
              className="rounded px-2.5 py-1 text-xs font-semibold text-dc1-text-muted opacity-60"
              aria-disabled
            >
              {option.label}
            </span>
          )
        }

        return (
          <Link
            key={option.code}
            href={option.href as string}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
              isActive
                ? 'bg-dc1-amber text-white'
                : 'text-dc1-text-secondary hover:bg-dc1-surface-l3 hover:text-dc1-text-primary'
            }`}
          >
            {option.label}
          </Link>
        )
      })}
    </div>
  )
}
