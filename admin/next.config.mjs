import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const adminRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  outputFileTracingRoot: new URL('..', import.meta.url).pathname,
};

export default nextConfig;
