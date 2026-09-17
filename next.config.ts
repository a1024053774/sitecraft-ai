import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Local capture and /quality click-tests use 127.0.0.1:3034; Next otherwise 403s dev chunks.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
}

export default nextConfig
