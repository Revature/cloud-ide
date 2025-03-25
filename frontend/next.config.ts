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
  
  // next.config.ts
  // async rewrites() {
  //   const backendApiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
  //   return [
  //     {
  //       source: '/api/v1/:path*',
  //       destination: `${backendApiUrl}/api/v1/:path*`,
  //     },
  //   ];
  // },
  
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;