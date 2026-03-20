'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { DocTreeNode } from '../lib/docs'
import DocsLanguageToggle from './DocsLanguageToggle'

interface SearchDoc {
  title: string
  href: string
  locale: 'en' | 'ar'
}

interface DocsSidebarProps {
  tree: DocTreeNode[]
  docs: SearchDoc[]
  currentPath: string
  currentLocale: 'en' | 'ar'
  englishHref: string | null
  arabicHref: string | null
}

function TreeItem({
  node,
  level,
  expanded,
  onToggle,
  currentPath,
}: {
  node: DocTreeNode
  level: number
  expanded: Set<string>
  onToggle: (key: string) => void
  currentPath: string
}) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.key)
  const isActive = !!node.href && node.href === currentPath

  return (
    <li>
      <div className="flex items-center gap-2" style={{ paddingInlineStart: level * 12 }}>
        {hasChildren ? (
          <button
            onClick={() => onToggle(node.key)}
            className="flex h-6 w-6 items-center justify-center rounded text-dc1-text-muted hover:bg-dc1-surface-l3 hover:text-dc1-text-primary"
            aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
          >
            <svg
              className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
            >
              <path d="M5 3L11 8L5 13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="h-6 w-6" />
        )}

        {node.href ? (
          <Link
            href={node.href}
            className={`block flex-1 rounded px-2 py-1.5 text-sm transition-colors ${
              isActive
                ? 'bg-dc1-amber/15 text-dc1-amber'
                : 'text-dc1-text-secondary hover:bg-dc1-surface-l3 hover:text-dc1-text-primary'
            }`}
          >
            {node.title}
          </Link>
        ) : (
          <span className="block flex-1 rounded px-2 py-1.5 text-sm font-medium text-dc1-text-primary">
            {node.title}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <ul className="mt-1 space-y-1">
          {node.children.map((child) => (
            <TreeItem
              key={child.key}
              node={child}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
              currentPath={currentPath}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function collectExpandableKeys(nodes: DocTreeNode[]): Set<string> {
  const keys = new Set<string>()

  const walk = (node: DocTreeNode) => {
    if (node.children.length > 0) {
      keys.add(node.key)
      node.children.forEach(walk)
    }
  }

  nodes.forEach(walk)
  return keys
}

export default function DocsSidebar({
  tree,
  docs,
  currentPath,
  currentLocale,
  englishHref,
  arabicHref,
}: DocsSidebarProps) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(() => collectExpandableKeys(tree))

  const results = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      return []
    }
    const needle = trimmed.toLowerCase()
    return docs
      .map((doc) => {
        const haystack = doc.title.toLowerCase()
        const index = haystack.indexOf(needle)
        const score = index === -1 ? Number.POSITIVE_INFINITY : index
        return { doc, score }
      })
      .filter((item) => Number.isFinite(item.score))
      .sort((a, b) => a.score - b.score || a.doc.title.localeCompare(b.doc.title))
      .map((item) => item.doc)
  }, [docs, query])

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const localizedDocs = docs.filter((doc) => doc.locale === currentLocale)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dc1-text-secondary">
          Docs
        </h2>
        <DocsLanguageToggle
          currentLocale={currentLocale}
          englishHref={englishHref}
          arabicHref={arabicHref}
        />
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={currentLocale === 'ar' ? 'ابحث في العناوين...' : 'Search docs titles...'}
        className="input"
      />

      {query.trim() ? (
        <ul className="space-y-1">
          {results.map((result) => (
            <li key={result.href}>
              <Link
                href={result.href}
                className={`block rounded px-2 py-1.5 text-sm transition-colors ${
                  result.href === currentPath
                    ? 'bg-dc1-amber/15 text-dc1-amber'
                    : 'text-dc1-text-secondary hover:bg-dc1-surface-l3 hover:text-dc1-text-primary'
                }`}
              >
                {result.title}
              </Link>
            </li>
          ))}
          {results.length === 0 && (
            <li className="rounded border border-dc1-border bg-dc1-surface-l2 px-3 py-2 text-sm text-dc1-text-muted">
              {currentLocale === 'ar' ? 'لا توجد نتائج.' : 'No matching docs found.'}
            </li>
          )}
        </ul>
      ) : (
        <ul className="space-y-1">
          {tree
            .filter((node) => (currentLocale === 'ar' ? node.segment === 'ar' : node.segment !== 'ar'))
            .map((node) => (
              <TreeItem
                key={node.key}
                node={node}
                level={0}
                expanded={expanded}
                onToggle={toggle}
                currentPath={currentPath}
              />
            ))}
          {localizedDocs.length === 0 && (
            <li className="rounded border border-dc1-border bg-dc1-surface-l2 px-3 py-2 text-sm text-dc1-text-muted">
              {currentLocale === 'ar' ? 'لا توجد ملفات توثيق عربية بعد.' : 'No documentation pages found.'}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
