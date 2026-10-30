import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./home.css";
import "./site/atlas.css";
import { initSiteMenu } from "./site/menu.js";
import { watchFrenchSpacing } from "./lib/ui.js";
import { asset } from "./lib/site.js";
import { mosaic } from "./hf/mosaic.js";

watchFrenchSpacing(document.body);
initSiteMenu();

/** The lead story's opening figure: every accident of sixteen years, those citing a person in orange. */
async function leadMosaic() {
  const canvas = document.getElementById("lead-mosaic");
  if (!canvas) return;
  const acc = await fetch(asset("data/hf/accidents.json")).then((r) => r.json());
  mosaic(canvas, acc);
}

leadMosaic().catch((err) => console.error("lead mosaic:", err));
