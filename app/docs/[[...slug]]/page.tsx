import { notFound } from 'next/navigation'
import Link from 'next/link'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import DocsSidebar from '../../components/docs/DocsSidebar'
import SimpleMdxRenderer from '../../components/docs/SimpleMdxRenderer'
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
  if (!params.slug || params.slug.length === 0) {
    return (
      <div className="min-h-screen bg-dc1-void">
        <Header />

        <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-8 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dc1-amber">Docs Portal</p>
            <h1 className="mt-3 text-3xl font-bold text-dc1-text-primary sm:text-4xl">DCP Developer Documentation</h1>
            <p className="mt-4 max-w-3xl text-dc1-text-secondary">
              API-first onboarding for providers and renters on container-based GPU infrastructure in Saudi Arabia. Build with a structural energy-cost advantage and first-class Arabic AI model support.
            </p>
            <p className="mt-2 max-w-3xl text-dc1-text-secondary">
              بوابة توثيق ثنائية اللغة (عربي/إنجليزي) لحوسبة GPU بالحاويات داخل السعودية، مع ميزة تكلفة طاقة هيكلية ودعم أساسي لنماذج الذكاء الاصطناعي العربية.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-dc1-border bg-dc1-surface-l2 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dc1-amber">Saudi Energy Advantage</p>
                <p className="mt-2 text-sm text-dc1-text-secondary">Lower structural electricity-cost environment for long-run GPU workloads.</p>
              </div>
              <div className="rounded-lg border border-dc1-border bg-dc1-surface-l2 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dc1-amber">Arabic AI Models</p>
                <p className="mt-2 text-sm text-dc1-text-secondary">ALLaM 7B, Falcon H1, JAIS 13B, and BGE-M3 are supported as first-class paths.</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/quickstart" className="btn btn-primary btn-sm">Start Quickstart</Link>
              <Link href="/docs/api-reference" className="btn btn-secondary btn-sm">View API reference</Link>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="mb-5 text-xl font-semibold text-dc1-text-primary">Documentation Map</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/docs/quickstart" className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-5">
                <h3 className="text-base font-semibold text-dc1-text-primary">Quickstart</h3>
                <p className="mt-1 text-sm text-dc1-text-secondary">Run your first renter job in under 5 minutes.</p>
                <p className="mt-2 text-sm text-dc1-text-secondary">البدء السريع لتشغيل أول مهمة خلال 5 دقائق.</p>
              </Link>
              <Link href="/docs/provider-guide" className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-5">
                <h3 className="text-base font-semibold text-dc1-text-primary">Provider Onboarding</h3>
                <p className="mt-1 text-sm text-dc1-text-secondary">Install daemon, verify heartbeat, and start earning.</p>
                <p className="mt-2 text-sm text-dc1-text-secondary">دليل إعداد المزود: التثبيت، heartbeat، والأرباح.</p>
              </Link>
              <Link href="/docs/renter-guide" className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-5">
                <h3 className="text-base font-semibold text-dc1-text-primary">Renter Onboarding</h3>
                <p className="mt-1 text-sm text-dc1-text-secondary">Registration, balance, job submit, and output retrieval.</p>
                <p className="mt-2 text-sm text-dc1-text-secondary">إعداد المستأجر من التسجيل حتى استلام المخرجات.</p>
              </Link>
              <Link href="/docs/api-reference" className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-5">
                <h3 className="text-base font-semibold text-dc1-text-primary">API Reference</h3>
                <p className="mt-1 text-sm text-dc1-text-secondary">Auth model, endpoint map, and error contract.</p>
                <p className="mt-2 text-sm text-dc1-text-secondary">مرجع API: المصادقة، النقاط الأساسية، وتنسيق الأخطاء.</p>
              </Link>
              <Link href="/docs/architecture-overview" className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-5">
                <h3 className="text-base font-semibold text-dc1-text-primary">Architecture Overview</h3>
                <p className="mt-1 text-sm text-dc1-text-secondary">System map for Next.js, Express, daemon, and sync.</p>
                <p className="mt-2 text-sm text-dc1-text-secondary">نظرة شاملة على بنية النظام ومسار البيانات.</p>
              </Link>
              <Link href="/docs/openapi.yaml" className="rounded-xl border border-dc1-border bg-dc1-surface-l1 p-5">
                <h3 className="text-base font-semibold text-dc1-text-primary">OpenAPI Spec</h3>
                <p className="mt-1 text-sm text-dc1-text-secondary">Machine-readable contract for SDKs and tooling.</p>
                <p className="mt-2 text-sm text-dc1-text-secondary">مواصفة آلية للـ SDK والأدوات.</p>
              </Link>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    )
  }

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
