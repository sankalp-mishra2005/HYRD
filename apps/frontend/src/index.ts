import { serve } from "bun";
import path from "path";
import fs from "fs";

const distDir = path.resolve(import.meta.dir, "../dist");
const indexHtmlPath = path.join(distDir, "index.html");

const server = serve({
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = decodeURIComponent(url.pathname);

    // Healthcheck endpoint for Railway / load balancers
    if (pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Serve static files from dist if requested and exists
    if (pathname !== "/" && pathname !== "") {
      const candidatePath = path.join(distDir, pathname);
      if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
        const file = Bun.file(candidatePath);
        return new Response(file, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": pathname.includes("chunk-") ? "public, max-age=31536000, immutable" : "no-cache",
          },
        });
      }
    }

    // SPA fallback: serve dist/index.html for all client routes
    if (fs.existsSync(indexHtmlPath)) {
      let html = await Bun.file(indexHtmlPath).text();
      const backendUrl = process.env.BACKEND_URL || process.env.VITE_BACKEND_URL;
      if (backendUrl) {
        html = html.replace(
          "<head>",
          `<head><script>window.__BACKEND_URL__ = ${JSON.stringify(backendUrl)};</script>`
        );
      }
      return new Response(html, {
        headers: {
          "Content-Type": "text/html;charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    }

    return new Response("Frontend not built. Please run bun run build.ts", { status: 500 });
  },
});

console.log(`🚀 Production server running at ${server.url}`);
