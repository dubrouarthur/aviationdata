import { defineConfig } from "vite";
import { resolve } from "node:path";

// One page per investigation, plus the home page that presents them.
const PAGES = {
  home: "index.html",
  ciel: "le-ciel-a-deux-vitesses/index.html",
  jet: "courant-jet/index.html",
};

// Absolute site URL for social previews (og:image must be absolute). Vercel exposes the production domain at
// build time; elsewhere the tags fall back to relative paths.
const host = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "";
process.env.VITE_SITE_URL = host
  ? `${host.startsWith("http") ? host : `https://${host}`}`.replace(/\/?$/, "/")
  : "";

// Vercel serves /courant-jet from courant-jet/index.html (cleanUrls, no trailing slash); the dev and
// preview servers do the same, so links behave locally as in production
const cleanUrls = {
  name: "clean-urls",
  configureServer(server) {
    server.middlewares.use(rewrite);
  },
  configurePreviewServer(server) {
    server.middlewares.use(rewrite);
  },
};
const DIRS = Object.values(PAGES)
  .filter((p) => p.includes("/"))
  .map((p) => `/${p.split("/")[0]}`);
function rewrite(req, _res, next) {
  const [path, rest = ""] = req.url.split(/(?=[?#])/);
  if (DIRS.includes(path)) req.url = `${path}/${rest}`;
  next();
}

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [cleanUrls],
  build: {
    outDir: mode === "artifact" ? "dist-artifact" : "dist",
    // artifact pages may not load fonts from other hosts: inline them as data URIs
    assetsInlineLimit: mode === "artifact" ? 200_000 : 0,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: Object.fromEntries(Object.entries(PAGES).map(([k, p]) => [k, resolve(import.meta.dirname, p)])),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.js"],
  },
}));
