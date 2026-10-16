import { defineConfig } from "vite";

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
