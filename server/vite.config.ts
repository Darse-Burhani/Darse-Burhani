import { defineConfig } from "vite";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";

// Builds the Express backend into a single ESM bundle with Vite.
// - Dev:  `npm run dev`  uses vite-node for instant reloads
// - Prod: `npm run build` bundles via Vite's SSR pipeline, then `node dist/index.js`
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    ssr: true,
    target: "node22",
    rollupOptions: {
      input: "src/index.ts",
      output: {
        format: "es",
        entryFileNames: "index.js",
      },
      external: [
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
        /^@prisma/,
        /^@sentry/,
        /^bcryptjs/,
        /^compression/,
        /^cookie-parser/,
        /^dotenv/,
        /^exceljs/,
        /^express/,
        /^googleapis/,
        /^jsonwebtoken/,
        /^multer/,
        /^nodemailer/,
        /^xlsx/,
      ],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
