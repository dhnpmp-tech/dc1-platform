interface DocsHeadProps {
  params: {
    slug?: string[]
  }
}

export default function Head({ params }: DocsHeadProps) {
  const slug = params.slug ?? []
  const isQuickstart = slug.length > 0 && slug[0] === 'quickstart'

  const title = isQuickstart ? 'Quickstart | DCP Docs' : 'Docs/API | DCP'
  const description = isQuickstart
    ? 'Deploy your first workload on DCP with the official quickstart guide.'
    : 'API references and integration docs for renter, provider, and enterprise workflows on DCP.'

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
    </>
  )
}
