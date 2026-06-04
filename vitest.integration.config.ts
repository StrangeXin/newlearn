import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 集成测试：连真实(本地)数据库，跑核心闭环。与单测分开，避免污染 `pnpm test`。
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.itest.ts"],
    globals: true,
    setupFiles: ["tests/setup-int.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
