import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { analyzeStyleRequest } from "./scripts/analyze-style-api.ts";
import { loadProjectEnv } from "./scripts/style-photos.ts";

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function styleAnalysisApi(): Plugin {
  const attach = (middlewares: Connect.Server) => {
    loadProjectEnv(dirname(fileURLToPath(new URL("./scripts/analyze-style-api.ts", import.meta.url))));
    middlewares.use("/api/analyze-style", (request: IncomingMessage, response: ServerResponse, next: Connect.NextFunction) => {
      if (request.method !== "POST") {
        next();
        return;
      }

      void (async () => {
        try {
          const raw = await readBody(request);
          const payload = raw ? JSON.parse(raw) as unknown : {};
          const result = await analyzeStyleRequest(request.headers.authorization, payload);
          response.statusCode = result.status;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(result.body));
        } catch {
          response.statusCode = 400;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ error: "Could not read the analysis request." }));
        }
      })();
    });
  };

  return {
    name: "style-analysis-api",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), styleAnalysisApi()],
  server: {
    fs: {
      allow: ["../.."],
    },
  },
});
