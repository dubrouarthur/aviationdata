// The countries of Europe and its neighbours, for the maps of the fourth investigation: world-atlas
// (Natural Earth 1:50m, public domain) cut to the box the map shows, coordinates rounded to 0.01°
// (about 1 km). Writes web/public/geo/europe-50m.json. Run: node web/scripts/make_europe_geo.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { feature } from "topojson-client";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..");
const topo = JSON.parse(readFileSync(join(web, "node_modules/world-atlas/countries-50m.json"), "utf8"));
const [W, S, E, N] = [-34, 24, 50, 74];

const round = (c) => (typeof c[0] === "number" ? [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100] : c.map(round));
const inBox = (c) => (typeof c[0] === "number" ? c[0] >= W && c[0] <= E && c[1] >= S && c[1] <= N : c.some(inBox));

const all = feature(topo, topo.objects.countries).features;
const features = all
  .filter((f) => f.geometry && inBox(f.geometry.coordinates))
  .map((f) => {
    // keep only the polygons of a country that reach the box (France without Guiana, Norway with Svalbard)
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    const kept = polys.filter((p) => inBox(p));
    return {
      type: "Feature",
      id: f.id,
      properties: { name: f.properties.name },
      geometry: { type: "MultiPolygon", coordinates: round(kept) },
    };
  });
writeFileSync(join(web, "public/geo/europe-50m.json"), JSON.stringify({ type: "FeatureCollection", features }));
console.log(`${features.length} countries`);
