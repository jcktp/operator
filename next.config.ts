import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', '@prisma/client', 'prisma'],
  allowedDevOrigins: ['*.trycloudflare.com', '*.cloudflareaccess.com'],
  turbopack: {},
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
