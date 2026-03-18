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
    ];
  },
}

module.exports = nextConfig
