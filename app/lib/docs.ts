import fs from 'fs'
import path from 'path'

export type DocLocale = 'en' | 'ar'

export interface DocRecord {
  slug: string
  slugParts: string[]
  title: string
  description: string
  locale: DocLocale
  order: number
  body: string
  filePath: string
}

export interface DocTreeNode {
  key: string
  segment: string
  title: string
  href?: string
  children: DocTreeNode[]
}

const DOCS_ROOT = path.join(process.cwd(), 'docs')
const DEFAULT_DOC_SLUG = 'quickstart'

const ALIAS_MAP: Record<string, string> = {
  api: 'api-reference',
}

function listMdxFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...listMdxFiles(fullPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.mdx')) {
      files.push(fullPath)
    }
  }

  return files
}

function titleFromSegment(segment: string): string {
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizeSlugParts(rawParts?: string[]): string[] {
  if (!rawParts || rawParts.length === 0) {
    return [DEFAULT_DOC_SLUG]
  }

  const normalized = rawParts.filter(Boolean)

  if (normalized[0] === 'ar') {
    if (normalized[1]) {
      normalized[1] = ALIAS_MAP[normalized[1]] ?? normalized[1]
    }
    if (normalized.length === 1) {
      normalized.push(DEFAULT_DOC_SLUG)
    }
    return normalized
  }

  normalized[0] = ALIAS_MAP[normalized[0]] ?? normalized[0]
  return normalized
}

function loadDocs(): DocRecord[] {
  if (!fs.existsSync(DOCS_ROOT)) {
    return []
  }

  return listMdxFiles(DOCS_ROOT)
    .map((filePath) => {
      const relativePath = path.relative(DOCS_ROOT, filePath)
      const withoutExt = relativePath.replace(/\.mdx$/, '')
      const slugParts = withoutExt.split(path.sep)
      const slug = slugParts.join('/')

      const raw = fs.readFileSync(filePath, 'utf8')
      const { content, data } = parseFrontmatter(raw)

      const title = typeof data.title === 'string' && data.title.trim().length > 0
        ? data.title.trim()
        : titleFromSegment(slugParts[slugParts.length - 1] || DEFAULT_DOC_SLUG)
      const description = typeof data.description === 'string' ? data.description : ''
      const order = typeof data.order === 'number' ? data.order : 100
      const locale: DocLocale = slugParts[0] === 'ar' ? 'ar' : 'en'

      return {
        slug,
        slugParts,
        title,
        description,
        locale,
        order,
        body: content,
        filePath,
      }
    })
    .sort((a, b) => {
      if (a.locale !== b.locale) {
        return a.locale.localeCompare(b.locale)
      }
      if (a.order !== b.order) {
        return a.order - b.order
      }
      return a.slug.localeCompare(b.slug)
    })
}

function parseFrontmatter(source: string): {
  content: string
  data: Record<string, string | number>
} {
  if (!source.startsWith('---\n')) {
    return { content: source, data: {} }
  }

  const closingMarker = source.indexOf('\n---\n', 4)
  if (closingMarker === -1) {
    return { content: source, data: {} }
  }

  const rawFrontmatter = source.slice(4, closingMarker)
  const content = source.slice(closingMarker + 5)
  const data: Record<string, string | number> = {}

  rawFrontmatter.split('\n').forEach((line) => {
    const separator = line.indexOf(':')
    if (separator === -1) {
      return
    }

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (!key) {
      return
    }

    if (/^\d+$/.test(value)) {
      data[key] = Number(value)
      return
    }

    data[key] = value.replace(/^["']|["']$/g, '')
  })

  return { content, data }
}

function createNode(segment: string, key: string): DocTreeNode {
  return {
    key,
    segment,
    title: titleFromSegment(segment),
    children: [],
  }
}

function buildTree(docs: DocRecord[]): DocTreeNode[] {
  const root: DocTreeNode[] = []

  for (const doc of docs) {
    let level = root

    for (let i = 0; i < doc.slugParts.length; i += 1) {
      const segment = doc.slugParts[i]
      const key = doc.slugParts.slice(0, i + 1).join('/')
      const isLeaf = i === doc.slugParts.length - 1

      let node = level.find((item) => item.key === key)
      if (!node) {
        node = createNode(segment, key)
        level.push(node)
      }

      if (isLeaf) {
        node.title = doc.title
        node.href = `/docs/${doc.slug}`
      }

      level = node.children
    }
  }

  const sortNodes = (nodes: DocTreeNode[]): DocTreeNode[] => {
    return nodes
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((node) => ({
        ...node,
        children: sortNodes(node.children),
      }))
  }

  return sortNodes(root)
}

export function getDocsCatalog() {
  const docs = loadDocs()
  const tree = buildTree(docs)
  return { docs, tree }
}

export function getDocBySlug(rawParts?: string[]) {
  const { docs } = getDocsCatalog()
  const normalized = normalizeSlugParts(rawParts)
  const exactSlug = normalized.join('/')
  const exact = docs.find((doc) => doc.slug === exactSlug)

  if (exact) {
    return exact
  }

  if (normalized[0] === 'ar') {
    const englishFallback = normalized.slice(1).join('/')
    return docs.find((doc) => doc.slug === englishFallback) ?? null
  }

  return null
}

export function getBreadcrumbs(slugParts: string[]): Array<{ label: string; href: string }> {
  const items: Array<{ label: string; href: string }> = []

  for (let i = 0; i < slugParts.length; i += 1) {
    const parts = slugParts.slice(0, i + 1)
    items.push({
      label: titleFromSegment(parts[i]),
      href: `/docs/${parts.join('/')}`,
    })
  }

  return items
}

export function getDocAlternates(slugParts: string[]) {
  const { docs } = getDocsCatalog()

  const englishParts = slugParts[0] === 'ar' ? slugParts.slice(1) : slugParts
  const englishSlug = englishParts.join('/') || DEFAULT_DOC_SLUG
  const arabicSlug = ['ar', ...englishParts].join('/')

  const enExists = docs.some((doc) => doc.slug === englishSlug)
  const arExists = docs.some((doc) => doc.slug === arabicSlug)

  return {
    en: enExists ? `/docs/${englishSlug}` : null,
    ar: arExists ? `/docs/${arabicSlug}` : null,
  }
}

export function normalizeDocSlug(rawParts?: string[]) {
  return normalizeSlugParts(rawParts)
}

export function getDefaultDocHref(locale: DocLocale): string {
  return locale === 'ar' ? `/docs/ar/${DEFAULT_DOC_SLUG}` : `/docs/${DEFAULT_DOC_SLUG}`
}
