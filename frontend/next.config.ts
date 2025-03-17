import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
  // Configure rewrites to proxy API requests to the backend
  async rewrites() {
    // Default backend URL if environment variable is not set
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
    
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;