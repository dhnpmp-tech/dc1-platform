import { notFound } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/layout/Header'
import Footer from '@/app/components/layout/Footer'
import DocsSidebar from '@/app/components/docs/DocsSidebar'
import SimpleMdxRenderer from '@/app/components/docs/SimpleMdxRenderer'
import {
  getBreadcrumbs,
  getDocAlternates,
  getDocBySlug,
  getDocsCatalog,
  normalizeDocSlug,
} from '@/app/lib/docs'

interface DocsPageProps {
  params: {
    slug?: string[]
  }
}

export default function DocsPage({ params }: DocsPageProps) {
  const normalizedSlug = normalizeDocSlug(params.slug)
  const doc = getDocBySlug(normalizedSlug)

  if (!doc) {
    notFound()
  }

  const { docs, tree } = getDocsCatalog()
  const breadcrumbs = getBreadcrumbs(doc.slugParts)
  const currentPath = `/docs/${doc.slug}`
  const currentLocale = doc.locale
  const alternates = getDocAlternates(doc.slugParts)

  return (
    <div className="min-h-screen bg-dc1-void">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-dc1-border bg-dc1-surface-l1 p-3 lg:hidden">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-dc1-text-primary">
              {currentLocale === 'ar' ? 'فتح التنقل' : 'Open Navigation'}
            </summary>
            <div className="mt-4">
              <DocsSidebar
                tree={tree}
                docs={docs.map((entry) => ({
                  title: entry.title,
                  href: `/docs/${entry.slug}`,
                  locale: entry.locale,
                }))}
                currentPath={currentPath}
                currentLocale={currentLocale}
                englishHref={alternates.en}
                arabicHref={alternates.ar}
              />
            </div>
          </details>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="hidden h-fit rounded-lg border border-dc1-border bg-dc1-surface-l1 p-4 lg:block">
            <DocsSidebar
              tree={tree}
              docs={docs.map((entry) => ({
                title: entry.title,
                href: `/docs/${entry.slug}`,
                locale: entry.locale,
              }))}
              currentPath={currentPath}
              currentLocale={currentLocale}
              englishHref={alternates.en}
              arabicHref={alternates.ar}
            />
          </aside>

          <article className="rounded-lg border border-dc1-border bg-dc1-surface-l1 p-6 sm:p-8">
            <nav
              className="mb-4 flex flex-wrap items-center gap-2 text-xs text-dc1-text-muted"
              aria-label="Breadcrumb"
            >
              <Link href="/docs" className="hover:text-dc1-amber">
                Docs
              </Link>
              {breadcrumbs.map((item) => (
                <span key={item.href} className="flex items-center gap-2">
                  <span>/</span>
                  <Link href={item.href} className="hover:text-dc1-amber">
                    {item.label}
                  </Link>
                </span>
              ))}
            </nav>

            <h1 className="text-3xl font-bold text-dc1-text-primary">{doc.title}</h1>
            {doc.description && (
              <p className="mt-3 text-base text-dc1-text-secondary">{doc.description}</p>
            )}

            <div className="docs-mdx mt-8">
              <SimpleMdxRenderer source={doc.body} />
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  )
}
