import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  distDir: '.next',
  // This tells Next.js where to put the exported static files
  // We need to add a custom export script
  images: {
    unoptimized: true
  },
  trailingSlash: true // Important for Capacitor
}

export default nextConfig
