import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lint is run separately (npm run lint); keep production builds from being
  // blocked by stylistic rules while we iterate. Type errors still fail the build.
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
};

export default nextConfig;
