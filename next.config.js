/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/dc1/:path*',
        destination: 'http://76.13.179.86:8083/api/:path*',
      },
    ];
  },
}

module.exports = nextConfig
