import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/hackathon",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/hackathon/api/:path*",
      },
    ];
  },
};

export default nextConfig;
