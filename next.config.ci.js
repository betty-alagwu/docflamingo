/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Exclude problematic pages from the build
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  // Skip type checking during build (we do it in a separate step)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Skip ESLint during build (we do it in a separate step)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable source maps in CI to speed up build
  productionBrowserSourceMaps: false,
  // Skip static optimization for API routes in CI
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  // Configure webpack to handle problematic modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle server-only modules on the client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
