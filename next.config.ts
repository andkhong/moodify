import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // <=== enables static exports
  basePath: 'https://github.com/andkhong/moodify', 
  images: {
    unoptimized: true, // Disable image optimization for static export
  },
};

export default nextConfig;
