/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || 'http://76.13.179.86:8083';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/dc1/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      // Model catalog API — used by ModelBrowsing and marketplace components
      {
        source: '/api/models/:path*',
        destination: `${backendUrl}/api/models/:path*`,
      },
      // Docker template catalog — used by TemplateCatalog component
      {
        source: '/api/templates/:path*',
        destination: `${backendUrl}/api/templates/:path*`,
      },
      {
        source: '/api/templates',
        destination: `${backendUrl}/api/templates`,
      },
    ];
  },
}

module.exports = nextConfig
