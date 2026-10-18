import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const appRoot = fileURLToPath(new URL(".", import.meta.url));

function stripCrossorigin(): Plugin {
  return {
    name: "strip-crossorigin",
    enforce: "post",
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".html")) continue;
        const html = typeof file.source === "string" ? file.source : new TextDecoder().decode(file.source);
        file.source = html.replaceAll(" crossorigin", "");
      }
    },
  };
}

function emitServiceWorker(): Plugin {
  return {
    name: "emit-service-worker",
    async closeBundle() {
      const outfile = resolve(appRoot, "dist/background/service-worker.js");
      mkdirSync(resolve(appRoot, "dist/background"), { recursive: true });
      await esbuild({
        entryPoints: [resolve(appRoot, "src/background/service-worker.ts")],
        outfile,
        bundle: true,
        format: "esm",
        platform: "browser",
        target: "es2022",
      });
    },
  };
}

export default defineConfig({
  root: appRoot,
  envDir: resolve(appRoot, "../desktop"),
  base: "./",
  plugins: [react(), stripCrossorigin(), emitServiceWorker()],
  build: {
    outDir: resolve(appRoot, "dist"),
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: resolve(appRoot, "index.html"),
    },
  },
});
