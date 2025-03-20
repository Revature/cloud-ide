import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/ui', // Set the base path to /ui

  images: {
    path: '/ui/_next/image',
    unoptimized: process.env.NODE_ENV !== 'production', // For development
  },
  
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
  
  // Configure rewrites to proxy API requests to the backend
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
  
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;