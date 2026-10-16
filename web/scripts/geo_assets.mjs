// Precompute light geographic assets for the page (run once; outputs are committed):
// - public/geo/land-dots.json : [lon, lat] points on land on a ~1.6° grid (dot-matrix globe)
// - public/geo/world-110m.json: country outlines (TopoJSON, Natural Earth via world-atlas, ISC)
//   cd web && node scripts/geo_assets.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";

const here = new URL("..", import.meta.url).pathname;
const landTopo = JSON.parse(readFileSync(`${here}node_modules/world-atlas/land-110m.json`, "utf8"));
const land = feature(landTopo, landTopo.objects.land);

const dots = [];
const step = 1.6;
for (let lat = -58; lat <= 82; lat += step) {
  // keep dots evenly spaced on the sphere: fewer longitudes near the poles
  const lonStep = step / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  for (let lon = -180; lon < 180; lon += lonStep) {
    if (geoContains(land, [lon, lat])) dots.push([+lon.toFixed(2), +lat.toFixed(2)]);
  }
}
mkdirSync(`${here}public/geo`, { recursive: true });
writeFileSync(`${here}public/geo/land-dots.json`, JSON.stringify(dots));
writeFileSync(
  `${here}public/geo/world-110m.json`,
  readFileSync(`${here}node_modules/world-atlas/countries-110m.json`, "utf8"),
);
console.log(`${dots.length} land dots`);
