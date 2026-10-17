import { defineConfig } from "vite";

// Absolute site URL for social previews (og:image must be absolute). Vercel exposes the production domain at
// build time; elsewhere the tags fall back to relative paths.
const host = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "";
process.env.VITE_SITE_URL = host ? `${host.startsWith("http") ? host : `https://${host}`}`.replace(/\/?$/, "/") : "";

export default defineConfig(({ mode }) => ({
  base: "./",
  build: {
    outDir: mode === "artifact" ? "dist-artifact" : "dist",
    // artifact pages may not load fonts from other hosts: inline them as data URIs
    assetsInlineLimit: mode === "artifact" ? 200_000 : 0,
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.js"],
  },
}));
