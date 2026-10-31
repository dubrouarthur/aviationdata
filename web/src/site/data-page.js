// The data page (/donnees), written at build time from data-registry.js: every dataset with its
// producer, its terms, the investigations and figures that use it, the files the magazine publishes from it
// and the code that reads it; the reference values; the models and dated facts; the list of our files.
// Node only (partials.js): it reads the stories' HTML to count their figures and stats the published files.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ISSUES, SITE, issueByKey } from "./issues.js";
import { DATASETS, FACTS, MODELS, REFERENCES, TABLES, alsoOf, sourceOf } from "./data-registry.js";

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const out = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
const href = (root, path) => `${root === "./" ? "" : root}${path}`;

/** The attribute each story names its figures' sources with. */
const ATTR = { eu: "data-esource", jet: "data-jsource", hf: "data-hsource", ciel: "data-source" };

/** Files the build leaves to describe itself, not data. */
export const META_FILES = ["data/meta.json", "data/jet/meta.json", "data/hf/meta.json"];

const kb = (n) =>
  n >= 1e6
    ? `${(n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`
    : `${Math.max(1, Math.round(n / 1e3)).toLocaleString("fr-FR")} Ko`;

/** "data/jet/winds-*.bin" or "data/jet/sim/" -> the files it names, under web/public/. */
function expand(webRoot, pattern) {
  const pub = join(webRoot, "public");
  if (pattern.endsWith("/"))
    return readdirSync(join(pub, pattern))
      .sort()
      .map((f) => `${pattern}${f}`);
  if (!pattern.includes("*")) return [pattern];
  const [dir, glob] = [
    pattern.slice(0, pattern.lastIndexOf("/") + 1),
    pattern.slice(pattern.lastIndexOf("/") + 1),
  ];
  const re = new RegExp(`^${glob.replace(/[.]/g, "\\.").replace("*", ".*")}$`);
  return readdirSync(join(pub, dir))
    .filter((f) => re.test(f))
    .sort()
    .map((f) => `${dir}${f}`);
}

/** Every file under public/data and public/geo, and the size of each. */
export function publishedFiles(webRoot) {
  const pub = join(webRoot, "public");
  const walk = (dir) =>
    readdirSync(join(pub, dir)).flatMap((f) => {
      const p = `${dir}/${f}`;
      return statSync(join(pub, p)).isDirectory() ? walk(p) : [p];
    });
  return ["data", "geo"].flatMap(walk).map((p) => ({ path: p, size: statSync(join(pub, p)).size }));
}

/** How many figures of each story name each source, read from the stories' own HTML. */
function figureCounts(webRoot) {
  const counts = new Map();
  for (const i of ISSUES) {
    const file = join(webRoot, i.slug, "index.html");
    if (!existsSync(file) || !ATTR[i.key]) continue;
    const html = readFileSync(file, "utf8");
    for (const m of html.matchAll(new RegExp(`${ATTR[i.key]}="([^"]+)"`, "g")))
      for (const k of m[1].split(/\s+/)) counts.set(`${i.key}:${k}`, (counts.get(`${i.key}:${k}`) ?? 0) + 1);
  }
  return counts;
}

/** The investigations an entry serves, with the number of figures that cite it in each. */
function uses(entry, counts) {
  const by = new Map();
  for (const [issue, key] of entry.refs)
    by.set(issue, (by.get(issue) ?? 0) + (counts.get(`${issue}:${key}`) ?? 0));
  for (const issue of entry.alsoIn ?? []) if (!by.has(issue)) by.set(issue, 0);
  return [...by].map(([key, n]) => ({ issue: issueByKey(key), n }));
}

const issueLink = (root, i, n) =>
  `<a href="${href(root, i.slug)}">n° ${i.no}, ${esc(i.title)}</a>${n ? ` (${n} figure${n > 1 ? "s" : ""})` : ""}`;

const code = (path) => `${SITE.repo}/blob/main/${path}`;
/** Terms of use: a link when they have their own page, the producer's page when they are its own. */
const terms = (t, s) =>
  t.url ? out(t.url, t.text) : t.producer ? `${esc(t.text)} (${out(s.url, "voir sa page")})` : esc(t.text);

function checkPaths(webRoot, entry) {
  const repo = join(webRoot, "..");
  for (const p of [...entry.etl, ...entry.checks])
    if (!existsSync(join(repo, p)))
      throw new Error(`data page: ${entry.id} names ${p}, which does not exist`);
}

/** The datasets, one article each. */
export function dataSets({ root, webRoot }) {
  const counts = figureCounts(webRoot);
  const sizes = new Map(publishedFiles(webRoot).map((f) => [f.path, f.size]));
  return DATASETS.map((d) => {
    checkPaths(webRoot, d);
    const s = sourceOf(d);
    const used = uses(d, counts);
    const files = d.files.flatMap((p) => expand(webRoot, p));
    for (const f of files)
      if (!sizes.has(f) && !existsSync(join(webRoot, "public", f)))
        throw new Error(`data page: no file ${f}`);
    const fileList = files
      .slice(0, 8)
      .map(
        (f) =>
          `<a href="${href(root, f)}" download>${esc(f.split("/").at(-1))}</a> <small>${kb(statSync(join(webRoot, "public", f)).size)}</small>`,
      )
      .join(", ");
    const more = files.length > 8 ? ` et ${files.length - 8} autres` : "";
    const extra = alsoOf(d).map((e) => out(e.url, e.label));
    const row = (dt, dd) => (dd ? `<div><dt>${dt}</dt><dd>${dd}</dd></div>` : "");
    return `<article class="ds" id="ds-${d.id}" data-issues="${used.map((u) => u.issue.key).join(" ")}">
  <div class="ds-id">
  <p class="ds-producer">${esc(d.producer)}</p>
  <h3 class="ds-title">${out(s.url, d.title)}</h3>
  <p class="ds-what">${esc(d.what)}</p>
  <p class="ds-label">Intitulé : ${esc(s.label)}${extra.length ? ` ; ${extra.join(" ; ")}` : ""}.</p>
  </div>
  <dl class="ds-meta">
    ${row("Période", esc(d.period))}
    ${row("Conditions", terms(d.terms, s))}
    ${row("Enquêtes", used.map((u) => issueLink(root, u.issue, u.n)).join(" ; "))}
    ${row("Nos fichiers", fileList + more)}
    ${row("Code", d.etl.map((p) => out(code(p), p.split("/").at(-1))).join(", "))}
    ${row("Vérification", d.checks.map((p) => out(code(p), p.split("/").at(-1))).join(", "))}
  </dl>
</article>`;
  }).join("\n");
}

/** Reference values and the models of risk, as lists. */
export function dataRefs({ root, webRoot }) {
  const counts = figureCounts(webRoot);
  const item = (e) => {
    const s = sourceOf(e);
    const used = uses(e, counts);
    return `<li data-issues="${used.map((u) => u.issue.key).join(" ")}">${out(s.url, s.label)}${e.use ? `. ${esc(e.use)}` : "."} <span class="ref-in">${used.map((u) => issueLink(root, u.issue, u.n)).join(" ; ")}</span></li>`;
  };
  return `<h3>Valeurs et textes de référence</h3>
<ul class="ref-list">${REFERENCES.map(item).join("")}</ul>
<h3>Modèles du risque</h3>
<ul class="ref-list">${MODELS.map(item).join("")}</ul>`;
}

/** The dated facts from outside the data, by investigation. */
export function dataFacts({ root }) {
  return FACTS.map(({ issue, facts }) => {
    const i = issueByKey(issue);
    return `<section class="facts-group" data-issues="${issue}" aria-labelledby="facts-${issue}">
  <h3 id="facts-${issue}"><a href="${href(root, i.slug)}">n° ${i.no}, ${esc(i.title)}</a></h3>
  <ul class="ref-list">${facts.map((f) => `<li>${esc(f.text)} <span class="ref-src">${out(f.url, f.source)}</span></li>`).join("")}</ul>
</section>`;
  }).join("\n");
}

/** Every published file, its size and the data it comes from. */
export function dataFiles({ root, webRoot }) {
  const from = new Map();
  for (const d of DATASETS)
    for (const f of d.files.flatMap((p) => expand(webRoot, p))) from.set(f, [...(from.get(f) ?? []), d]);
  const rows = publishedFiles(webRoot).map((f) => {
    const ds = from.get(f.path) ?? [];
    if (!ds.length && !META_FILES.includes(f.path))
      throw new Error(`data page: ${f.path} comes from no dataset of data-registry.js`);
    const what = ds.length
      ? ds.map((d) => `<a href="#ds-${d.id}">${esc(d.producer.split(",")[0])}</a>`).join(", ")
      : "métadonnées de construction";
    return `<tr><th scope="row"><a href="${href(root, f.path)}" download>${esc(f.path)}</a></th><td>${kb(f.size)}</td><td>${what}</td></tr>`;
  });
  return `<div class="table-scroll"><table class="files-table">
  <thead><tr><th scope="col">Fichier</th><th scope="col">Taille</th><th scope="col">Données d'origine</th></tr></thead>
  <tbody>${rows.join("")}</tbody>
</table></div>`;
}

/** One line of counts under the title. */
export function dataStats({ webRoot }) {
  const producers = new Set(DATASETS.map((d) => d.producer.split(",")[0].split(" (")[0]));
  const files = publishedFiles(webRoot).filter((f) => !META_FILES.includes(f.path));
  const facts = FACTS.reduce((s, g) => s + g.facts.length, 0);
  return `<p class="data-stats"><b>${DATASETS.length}</b> jeux de données de <b>${producers.size}</b> producteurs, <b>${REFERENCES.length + MODELS.length}</b> références, <b>${facts}</b> repères datés et <b>${files.length}</b> fichiers publiés, pour <b>${ISSUES.length}</b> enquêtes.</p>`;
}

/** The filter: one button per investigation (the page script makes them work). */
export function dataFilter() {
  const b = (key, label, on = false) =>
    `<button type="button" data-issue="${key}" aria-pressed="${on}">${esc(label)}</button>`;
  return `<div class="data-filter seg" role="group" aria-label="Montrer les données d'une enquête">${b("all", "Toutes les enquêtes", true)}${ISSUES.map((i) => b(i.key, `n° ${i.no}, ${i.title}`)).join("")}</div>`;
}

/** The about page's short table: producer, data, investigations. */
export function dataProducers({ root, webRoot }) {
  const counts = figureCounts(webRoot);
  const rows = DATASETS.map((d) => {
    const s = sourceOf(d);
    const used = uses(d, counts);
    return `<tr><td>${out(s.url, d.producer)}</td><td><a href="${href(root, "donnees")}#ds-${d.id}">${esc(d.title)}</a></td><td>${used.map((u) => `n° ${u.issue.no}`).join(", ")}</td></tr>`;
  });
  return `<div class="table-scroll"><table class="about-sources">
  <thead><tr><th scope="col">Producteur</th><th scope="col">Données</th><th scope="col">Enquêtes</th></tr></thead>
  <tbody>${rows.join("")}</tbody>
</table></div>`;
}

export { TABLES };
