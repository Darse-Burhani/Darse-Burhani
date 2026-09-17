import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Vite dev server for the React SPA.
// - `@` aliases the app source tree (same as the old Next.js app)
// - `next/*` imports are shimmed so the existing pages run unchanged
// - `/api` and `/uploads` are proxied to the Vite-powered Express backend
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "next/link": path.resolve(__dirname, "src/shims/next-link.tsx"),
      "next/navigation": path.resolve(__dirname, "src/shims/next-navigation.ts"),
      "next-auth/react": path.resolve(__dirname, "src/shims/next-auth-react.tsx"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      clientPort: 3000,
      protocol: "ws",
    },
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            if (res && "writeHead" in res && !res.headersSent) {
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  success: false,
                  error: "Backend server is starting up or reloading. Please try again in a moment.",
                  code: (err as any)?.code || "PROXY_ERROR",
                }),
              );
            }
          });
        },
      },
      "/uploads": {
        target: process.env.API_PROXY_TARGET || "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("three") || id.includes("@react-three")) {
              return "vendor-three";
            }
            if (id.includes("recharts") || id.includes("d3-")) {
              return "vendor-charts";
            }
            if (id.includes("framer-motion")) {
              return "vendor-framer";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("xlsx") || id.includes("jspdf") || id.includes("html2canvas")) {
              return "vendor-export";
            }
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) {
              return "vendor-react";
            }
          }
        },
      },
    },
  },
});
