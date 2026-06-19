/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./tests/setup/vitest.setup.ts",
    include: ["tests/**/*.test.{js,ts,jsx,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        // Next.js インフラ層
        "src/app/**",
        "src/instrumentation.ts",
        "src/instrumentation-client.ts",
        "src/proxy.ts",
        // 初期化・設定ファイル
        "src/lib/auth0.ts",
        "src/lib/prisma.ts",
        "src/lib/queryClient.tsx",
        "src/lib/graphql-client.ts",
        // 型定義のみ
        "src/features/**/types/**",
        // GraphQL インフラ層
        "src/graphql/context.ts",
        "src/graphql/schema.ts",

        // ---- ここから追加 ----
        // shadcn/ui 生成コード（外部ライブラリ扱い）
        "src/components/ui/**",
        // UIのみ・E2Eの責務
        "src/components/navbar.tsx",
        "src/components/async-boundary.tsx",
        "src/errors/error-boundary.tsx",
        "src/errors/sentry-logger.ts",
        "src/lib/ratelimit.ts",
        "src/features/todos/components/TodoIndex.tsx",
        "src/features/todos/components/TodoIndexContainer.tsx",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
});
