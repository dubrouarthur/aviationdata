import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./style.css";
import "./site/story.css";
import "./court.css";
import "./site/atlas.css";
import "./site/carte.css";
import { $ } from "./lib/ui.js";
import { fmtNum } from "./lib/format.js";
import { courtPage, safely } from "./court/page.js";
import { lineChart, hbars } from "./court/charts.js";
import { carboneFacts, SEGMENTS } from "./carbone/facts.js";
import { CSOURCES } from "./carbone/sources.js";
import * as T from "./carbone/text.js";

const segLabel = (key) => SEGMENTS.find((s) => s.key === key)?.label ?? key;
const signedMt = (v) => `${v > 0 ? "+" : "−"}${fmtNum(Math.abs(v), 1)} Mt`;

courtPage({
  files: ["data/co2.json", "data/co2/trajets.json"],
  sources: CSOURCES,
  run(co2, trajets) {
    const F = carboneFacts(co2, trajets);
    safely("text", () => {
      T.writeAnswer(F);
      T.writeSteps(F);
      T.writeReponse(F);
      T.writeSources(F);
    });
    safely("km", () =>
      hbars($("#chart-km"), {
        rows: F.segments.map((s, i) => ({ ...s, color: i === 0 ? "magenta" : "blue" })),
        label: `CO2 par passager et par kilomètre selon le type de vol, ${F.last}.`,
        fmt: (v) => `${fmtNum(v, 0)} g`,
        head: `Grammes par passager-kilomètre, ${F.last}`,
      }),
    );
    safely("trajet", () =>
      hbars($("#chart-trajet"), {
        rows: F.trips.map((t) => ({
          label: `${t.fromName} – ${t.toName}`,
          note: `${segLabel(t.segment)}, ${fmtNum(t.km, 0)} km`,
          value: t.ret,
          color: t === F.ny ? "magenta" : "blue",
        })),
        label: `CO2 par passager pour un aller-retour depuis Paris, ${F.last}.`,
        fmt: T.kg,
        head: "CO2 par passager, aller-retour",
      }),
    );
    safely("efficacite", () =>
      lineChart($("#chart-efficacite"), {
        x: F.years,
        series: [{ key: "g", label: "par passager-km", color: "magenta", values: F.intensity }],
        fmt: (v) => fmtNum(v, 0),
        unit: " g",
        label: `CO2 par passager et par kilomètre, tous les vols de France, de ${F.first} à ${F.last}.`,
      }),
    );
    safely("total", () =>
      hbars($("#chart-total"), {
        rows: [
          { label: "Plus de passagers et de kilomètres", note: `trafic ${F.trafficPct > 0 ? "+" : ""}${fmtNum(F.trafficPct, 0)} %`, value: F.traffic, color: "magenta" },
          { label: "Moins de CO2 par passager-kilomètre", note: `${fmtNum(F.efficiencyPct, 0)} %`, value: F.efficiency, color: "blue" },
          { label: `Au total, de ${F.first} à ${F.last}`, value: F.totalLast - F.totalFirst, color: "ink", strong: true },
        ],
        label: `Variation du CO2 des vols de France de ${F.first} à ${F.last} et ses deux causes, en millions de tonnes.`,
        fmt: signedMt,
        head: "Millions de tonnes de CO2",
      }),
    );
  },
});
