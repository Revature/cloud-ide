// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/ui',
  trailingSlash: true,
  
  images: {
    path: '/ui/_next/image',
    unoptimized: process.env.NODE_ENV !== 'production',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  publicRuntimeConfig: {
    basePath: '/ui',
  },
  
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
  
  
  // Other config...
  
  // Enable API route rewrites
  async rewrites() {
    return [
      {
        source: '/frontend-api/:path*',
        destination: '/frontend-api/:path*',  // This points to your Next.js API routes
      },
    ];
  },

  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;