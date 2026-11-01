import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./home.css";
import "./site/atlas.css";
import { initSiteMenu } from "./site/menu.js";
import { watchFrenchSpacing } from "./lib/ui.js";

watchFrenchSpacing(document.body);
initSiteMenu();
