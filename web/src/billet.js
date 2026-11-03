import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./site/story.css";
import "./court.css";
import "./site/atlas.css";
import "./site/carte.css";
import { $ } from "./lib/ui.js";
import { fmtNum, fmtPct } from "./lib/format.js";
import { courtPage, safely } from "./court/page.js";
import { lineChart, monthBars, hbars } from "./court/charts.js";
import { billetFacts } from "./billet/facts.js";
import { BSOURCES } from "./billet/sources.js";
import * as T from "./billet/text.js";

courtPage({
  files: ["data/prix.json", "data/billet/hicp.json"],
  sources: BSOURCES,
  run(prix, hicp) {
    const F = billetFacts(prix, hicp);
    safely("text", () => {
      T.writeAnswer(F);
      T.writeSteps(F);
      T.writeReponse(F);
      T.writeSources(F, hicp);
    });
    safely("prix", () =>
      lineChart($("#chart-prix"), {
        x: F.years,
        series: [
          { key: "fare", label: "Billets d'avion", color: "magenta", values: F.fare },
          { key: "cpi", label: "Ensemble des prix", color: "ink", values: F.cpi },
        ],
        base: 100,
        fmt: (v) => fmtNum(v, 0),
        label: `Prix des billets d'avion et ensemble des prix, base 100 en ${F.first}, de ${F.first} à ${F.last}.`,
      }),
    );
    safely("saison", () =>
      monthBars($("#chart-saison"), {
        rows: F.season,
        label: `Écart du prix des billets de chaque mois de ${F.last} à la moyenne de l'année.`,
      }),
    );
    safely("vols", () =>
      hbars($("#chart-vols"), {
        rows: F.segments.map((s, i) => ({ ...s, color: i === 0 ? "magenta" : "blue" })),
        label: `Évolution du prix des billets de ${F.ref} à ${F.last} par type de vol.`,
        fmt: (v) => fmtPct(v, 0),
        head: `Évolution ${F.ref}-${F.last}`,
      }),
    );
    safely("train", () =>
      hbars($("#chart-train"), {
        rows: F.modes,
        label: `Évolution des prix à la consommation en France de ${F.ref} à ${F.last}.`,
        fmt: (v) => fmtPct(v, 0),
        head: `Évolution ${F.ref}-${F.last}`,
      }),
    );
  },
});
