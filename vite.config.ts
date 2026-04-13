import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@supabase")) return "supabase";
          if (id.includes("node_modules/jspdf") || id.includes("node_modules/html2canvas")) return "pdf";
          if (id.includes("node_modules/xlsx")) return "xlsx";
          if (id.includes("node_modules/@stripe")) return "stripe";
          if (id.includes("node_modules/zod")) return "zod";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "react";
        },
      },
    },
  },
});
