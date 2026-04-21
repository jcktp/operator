import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', '@prisma/client', 'prisma', '@prisma/adapter-better-sqlite3', 'better-sqlite3', 'exiftool-vendored', 'multicast-dns', 'sharp'],
  outputFileTracingExcludes: {
    '/api/files': ['next.config.ts'],
  },
  allowedDevOrigins: ['*.trycloudflare.com', '*.cloudflareaccess.com'],
  turbopack: {},
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
