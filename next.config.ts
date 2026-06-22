import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-progress',
    ],
  },
}

export default nextConfig
