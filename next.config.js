/** @type {import('next').NextConfig} */
const fs = require('fs');
const path = require('path');

// Check if we should use a custom config file
const configFile = process.env.NEXT_CONFIG_FILE;

// Default config
let nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        port: '',
      },
    ],
  },
  reactStrictMode: true,
};

// If a custom config file is specified and exists, use it
if (configFile && fs.existsSync(path.resolve(configFile))) {
  console.log(`Using custom Next.js config from ${configFile}`);
  const customConfig = require(`./${configFile}`);

  // Merge configs, with custom config taking precedence
  nextConfig = {
    ...nextConfig,
    ...customConfig,
    // Merge nested objects like 'images' if they exist in both configs
    images: {
      ...(nextConfig.images || {}),
      ...(customConfig.images || {}),
    },
  };
}

module.exports = nextConfig;
