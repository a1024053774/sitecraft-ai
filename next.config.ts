import type { NextConfig } from 'next'
import './lib/code-site-eval-styles.ts'

const nextConfig: NextConfig = {
  // T-167: the test server must not share an ordinary dev server's .next lock.
  distDir: process.env.SITECRAFT_TEST_DIST_DIR || '.next',
  typedRoutes: true,
  output: 'standalone',
  devIndicators: false,
  // Local capture and /quality click-tests use 127.0.0.1:3034; Next otherwise 403s dev chunks.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
}

export default nextConfig
