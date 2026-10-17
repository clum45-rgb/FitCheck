import { resolve } from "node:path";
import { build, defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function emitServiceWorker(): Plugin {
  let emitting = false;

  return {
    name: "emit-service-worker",
    async closeBundle() {
      if (emitting) return;
      emitting = true;
      try {
        await build({
          configFile: false,
          logLevel: "warn",
          build: {
            emptyOutDir: false,
            outDir: "dist",
            lib: {
              entry: resolve("src/background/service-worker.ts"),
              formats: ["iife"],
              name: "FitCheckBackground",
              fileName: () => "background/service-worker.js",
            },
            rollupOptions: {
              output: {
                inlineDynamicImports: true,
                extend: true,
              },
            },
          },
        });
      } finally {
        emitting = false;
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), emitServiceWorker()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve("src/content/sidebar.tsx"),
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "content/sidebar.js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
