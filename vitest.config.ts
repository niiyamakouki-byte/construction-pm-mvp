import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "virtual:pwa-register": resolve(__dirname, "src/__mocks__/virtual-pwa-register.ts"),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "jsdom",
  },
});
