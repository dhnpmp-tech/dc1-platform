import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = process.cwd()
const templatesPagePath = resolve(repoRoot, 'app/renter/marketplace/templates/page.tsx')
const nextConfigPath = resolve(repoRoot, 'next.config.js')

const templatesPage = readFileSync(templatesPagePath, 'utf8')
const nextConfig = readFileSync(nextConfigPath, 'utf8')

const checks = [
  {
    name: 'templates page fetches live catalog API',
    pass: templatesPage.includes("fetch('/api/dc1/templates')"),
  },
  {
    name: 'templates page deploys through live deploy endpoint',
    pass: templatesPage.includes('`/api/dc1/templates/${encodeURIComponent(tmpl.id)}/deploy`'),
  },
  {
    name: 'templates page no longer ships hardcoded static template array fallback',
    pass: !templatesPage.includes('const TEMPLATES: Template[] = ['),
  },
  {
    name: 'next.js rewrites expose /api/templates backend route',
    pass:
      nextConfig.includes("source: '/api/templates/:path*'") &&
      nextConfig.includes("destination: `${backendUrl}/api/templates/:path*`") &&
      nextConfig.includes("source: '/api/templates'") &&
      nextConfig.includes("destination: `${backendUrl}/api/templates`"),
  },
]

const failed = checks.filter((c) => !c.pass)

for (const check of checks) {
  const mark = check.pass ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${check.name}`)
}

if (failed.length > 0) {
  console.error(`\nTemplate catalog wiring smoke failed (${failed.length} check${failed.length === 1 ? '' : 's'}).`)
  process.exit(1)
}

console.log('\nTemplate catalog wiring smoke passed.')
