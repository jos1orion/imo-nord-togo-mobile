/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  outputFileTracingRoot: new URL('..', import.meta.url).pathname,
};

export default nextConfig;
