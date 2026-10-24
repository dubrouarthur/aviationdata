import { defineConfig } from "vite";
import { resolve } from "node:path";
import { ISSUES, PAGES as MAGAZINE } from "./src/site/issues.js";
import { sitePartials } from "./src/site/partials.js";

// The home page, one page per investigation and the magazine's own pages, all listed in issues.js
const PAGES = {
  home: "index.html",
  ...Object.fromEntries([...ISSUES, ...MAGAZINE].map((p) => [p.key, `${p.slug}/index.html`])),
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
  plugins: [cleanUrls, sitePartials(import.meta.dirname, process.env.VITE_SITE_URL)],
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
