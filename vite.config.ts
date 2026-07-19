import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icons/*.png"],
      manifest: {
        name: "LapoSite",
        short_name: "LapoSite",
        description: "建設現場のプロジェクト管理ツール。工程・タスク・天気・見積を一元管理。",
        theme_color: "#346538",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        lang: "ja",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Custom push / notificationclick handlers, imported into the generated SW.
        importScripts: ["/push-sw.js"],
        // Offline SPA deep-links fall back to the precached shell (denylist API routes).
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Recently viewed案件/工程表/ドキュメント: cached copy shows instantly, revalidated in background.
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-api-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Auth/storage/realtime endpoints must always hit network.
            urlPattern: /^https:\/\/.*\.supabase\.co\/(auth|storage|realtime)\/.*/i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "font-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  base: "/",
  build: {
    modulePreload: {
      resolveDependencies(filename, deps) {
        if (filename.includes("pdf-estimate")) return [];
        return deps;
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("vite/preload-helper")) return "vite-preload-helper";
          if (id.includes("node_modules/@supabase")) return "supabase";
          if (id.includes("node_modules/html2canvas")) return "html2canvas";
          if (id.includes("node_modules/canvg")) return "canvg";
          if (id.includes("node_modules/dompurify")) return "dompurify";
          if (id.includes("src/estimate/pdf-estimate")) return "pdf-estimate";
          if (id.includes("src/estimate/noto-sans-jp-font")) return "pdf-font";
          if (id.includes("node_modules/xlsx")) return "xlsx";
          if (id.includes("node_modules/@stripe")) return "stripe";
          if (id.includes("node_modules/zod")) return "zod";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "react";
        },
      },
    },
  },
});
