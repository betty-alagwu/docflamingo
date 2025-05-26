/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Skip type checking during build 
  typescript: {
    ignoreBuildErrors: true,
  },
  // Skip ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Configure images for CI
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        port: '',
      },
    ],
  },

  serverExternalPackages: ['@prisma/client'],
  webpack: (config) => {

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Add optimization for CI builds
    if (process.env.CI === 'true') {
      config.optimization = {
        ...config.optimization,
        minimize: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
