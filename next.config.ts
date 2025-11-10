import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // ✓ Correct for static exports
  basePath: '/moodify', // Your repository name
  assetPrefix: '/moodify/', // Required for proper asset loading
  images: {
    unoptimized: true, // ✓ Correct - disables image optimization
  },
  trailingSlash: true, // Recommended for GitHub Pages
};

export default nextConfig;
