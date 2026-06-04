import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pnpm-workspace.yaml 会被误判为额外 lockfile，显式锁定 turbopack 根目录
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
