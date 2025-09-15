/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.ctfassets.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'assets.ctfassets.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Enable ISR for content pages
  async rewrites() {
    return [
      {
        source: '/api/revalidate/:path*',
        destination: '/api/revalidate/:path*',
      },
    ]
  },
}

module.exports = nextConfig
