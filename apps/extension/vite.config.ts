import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const appRoot = fileURLToPath(new URL(".", import.meta.url));

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
          root: appRoot,
          logLevel: "warn",
          build: {
            emptyOutDir: false,
            outDir: resolve(appRoot, "dist"),
            lib: {
              entry: resolve(appRoot, "src/background/service-worker.ts"),
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
  root: appRoot,
  plugins: [react(), emitServiceWorker()],
  build: {
    outDir: resolve(appRoot, "dist"),
    emptyOutDir: true,
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(appRoot, "src/content/sidebar.tsx"),
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "content/sidebar.js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
