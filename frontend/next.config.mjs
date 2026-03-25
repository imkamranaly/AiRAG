/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Allow images from common domains
  images: {
    remotePatterns: [],
  },
  // Disable x-powered-by header
  poweredByHeader: false,
  // Strict mode for better React dev experience
  reactStrictMode: true,
};

export default nextConfig;
