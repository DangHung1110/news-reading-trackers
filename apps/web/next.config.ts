import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
  reactStrictMode: true,
  transpilePackages: ['@news-tracker/contracts'],
};

export default nextConfig;
