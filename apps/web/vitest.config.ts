/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path';
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: './tests/setup/vitest.setup.ts',
    include: ["tests/**/*.test.{js,ts,jsx,tsx}"],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
})