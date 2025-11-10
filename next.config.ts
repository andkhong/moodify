import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/moodify',
  assetPrefix: '/moodify',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;