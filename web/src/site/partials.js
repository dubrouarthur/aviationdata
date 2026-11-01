// Build-time partials: the pieces every page of the magazine shares (masthead menu, footer, byline,
// "read also", the home page's lists), written into the HTML from issues.js so that they exist without
// JavaScript and stay identical everywhere. Also writes the Atom feed, the sitemap and robots.txt.
// Node only: imported by vite.config.js, never by the browser.
import { dirname, relative, sep } from "node:path";
import { CORRECTIONS, CORRECTIONS_SINCE, ISSUES, PAGES, SITE, TOOLS, frDate, issueByKey } from "./issues.js";
import {
  dataFacts,
  dataFiles,
  dataFilter,
  dataProducers,
  dataRefs,
  dataSets,
  dataStats,
} from "./data-page.js";

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const ICON_MENU =
  '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_CLOSE =
  '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

/** Where a page sits: its path back to the site root ("./" or "../") and the investigation it is, if any. */
export function pageInfo(file, webRoot) {
  const dir = relative(webRoot, dirname(file)).split(sep).filter(Boolean);
  const root = dir.length ? "../".repeat(dir.length) : "./";
  const slug = dir.join("/");
  return { root, slug, issue: ISSUES.find((i) => i.slug === slug), page: PAGES.find((p) => p.slug === slug) };
}

// "courant-jet" from the home page, "../courant-jet" from a story
const href = (root, slug, hash = "") => `${root === "./" ? "" : root}${slug}${hash ? `#${hash}` : ""}`;

function menuButton() {
  return `<button class="menu-open" type="button" data-menu-open aria-haspopup="dialog" aria-controls="site-menu">${ICON_MENU}<span>Sommaire</span></button>`;
}

function menu({ root, issue, page }) {
  const issues = ISSUES.map(
    (
      i,
    ) => `<li><a href="${href(root, i.slug)}"${i === issue ? ' aria-current="page"' : ""} style="--c: ${i.accent}">
        <span class="mi-no">N° ${i.no}</span>
        <span class="mi-title">${esc(i.title)}</span>
        <span class="mi-dek">${esc(i.dek)}</span>
      </a></li>`,
  ).join("");
  const tools = TOOLS.map((t) => {
    const i = issueByKey(t.issue);
    return `<li><a href="${href(root, i.slug, t.hash)}">${esc(t.title)}<small>${esc(i.title)}</small></a></li>`;
  }).join("");
  const here = issue
    ? `<section class="menu-here" aria-labelledby="menu-h-here">
        <h3 id="menu-h-here">Dans cette enquête</h3>
        <ol class="menu-chapters" id="menu-chapters"></ol>
      </section>`
    : "";
  return `<dialog class="site-menu" id="site-menu" aria-labelledby="menu-title">
  <div class="menu-inner wrap">
    <div class="menu-top">
      <a class="wordmark" href="${root}">aviation<b>data</b></a>
      <h2 class="visually-hidden" id="menu-title">Sommaire</h2>
      <button class="menu-close" type="button" data-menu-close>${ICON_CLOSE}<span>Fermer</span></button>
    </div>
    <div class="menu-grid${issue ? " has-here" : ""}">
      ${here}
      <section class="menu-issues-box" aria-labelledby="menu-h-issues">
        <h3 id="menu-h-issues">Les enquêtes</h3>
        <ol class="menu-issues">${issues}</ol>
      </section>
      <section class="menu-side" aria-labelledby="menu-h-tools">
        <h3 id="menu-h-tools">Les outils</h3>
        <ul class="menu-tools">${tools}</ul>
        <h3>Le magazine</h3>
        <ul class="menu-links">
          <li><a href="${root}"${!issue && !page ? ' aria-current="page"' : ""}>Accueil</a></li>
          <li><a href="${href(root, "enquetes")}"${page?.key === "archive" ? ' aria-current="page"' : ""}>Toutes les enquêtes</a></li>
          <li><a href="${href(root, "donnees")}"${page?.key === "data" ? ' aria-current="page"' : ""}>Les données</a></li>
          <li><a href="${href(root, "a-propos")}"${page?.key === "about" ? ' aria-current="page"' : ""}>À propos et charte</a></li>
          <li><a href="${href(root, "a-propos")}#corrections">Corrections</a></li>
          <li><a href="${href(root, "feed.xml")}">Flux RSS</a></li>
        </ul>
      </section>
    </div>
  </div>
</dialog>`;
}

function foot({ root }) {
  // the five latest, then the archive
  const issues = ISSUES.slice(0, 5)
    .map((i) => `<li><a href="${href(root, i.slug)}"><span>N° ${i.no}</span> ${esc(i.title)}</a></li>`)
    .join("");
  const year = new Date().getFullYear();
  return `<footer class="site-foot" id="colophon">
  <div class="wrap">
    <div class="foot-top">
      <a class="wordmark foot-mark" href="${root}" aria-label="aviationdata, accueil">aviation<b>data</b></a>
      <p class="foot-tag">${esc(SITE.tagline)}. Un site indépendant, sans publicité ni traceur, dont chaque chiffre est recalculé depuis sa source.</p>
    </div>
    <div class="foot-cols">
      <nav aria-labelledby="foot-h-issues">
        <h2 id="foot-h-issues">Les enquêtes</h2>
        <ul>${issues}<li><a href="${href(root, "enquetes")}">Toutes les enquêtes</a></li></ul>
      </nav>
      <nav aria-labelledby="foot-h-mag">
        <h2 id="foot-h-mag">Le magazine</h2>
        <ul>
          <li><a href="${href(root, "donnees")}">Les données</a></li>
          <li><a href="${href(root, "a-propos")}">À propos</a></li>
          <li><a href="${href(root, "a-propos")}#charte">La charte</a></li>
          <li><a href="${href(root, "a-propos")}#corrections">Corrections</a></li>
          <li><a href="${SITE.report}" target="_blank" rel="noopener">Signaler une erreur</a></li>
        </ul>
      </nav>
      <nav aria-labelledby="foot-h-follow">
        <h2 id="foot-h-follow">Suivre</h2>
        <ul>
          <li><a href="${SITE.author.url}" target="_blank" rel="noopener">LinkedIn</a></li>
          <li><a href="${href(root, "feed.xml")}">Flux RSS</a></li>
          <li><a href="${SITE.repo}" target="_blank" rel="noopener">Code et traitements</a></li>
        </ul>
      </nav>
      <div class="author-card">
        <img src="${root === "./" ? "" : root}auteur.jpg" alt="" width="64" height="64" loading="lazy" />
        <p><span class="ac-by">Enquêtes conçues et réalisées par</span>
        <a class="ac-name" href="${href(root, "a-propos")}#auteur">${esc(SITE.author.name)}</a></p>
      </div>
    </div>
    <p class="foot-legal">© ${SITE.since === year ? year : `${SITE.since}-${year}`} ${esc(SITE.author.name)}. Les données appartiennent à leurs producteurs, cités sous chaque graphique.</p>
  </div>
</footer>`;
}

function byline({ issue }) {
  if (!issue) throw new Error("site:byline outside an investigation");
  const pub = `<time datetime="${issue.published}">${frDate(issue.published)}</time>`;
  const upd =
    issue.updated !== issue.published
      ? `, mise à jour le <time datetime="${issue.updated}">${frDate(issue.updated)}</time>`
      : "";
  return `<p class="article-meta">Par <a href="${SITE.author.url}" target="_blank" rel="noopener">${esc(SITE.author.name)}</a>. Publiée le ${pub}${upd}. Environ ${issue.minutes} minutes de lecture, plus les outils.</p>`;
}

/** An issue as a card: image, number and date, title, dek. */
function card(root, i, kicker = `Enquête n° ${i.no}, ${frDate(i.published)}`) {
  return `<a class="also" href="${href(root, i.slug)}">
        <img src="${root === "./" ? "" : root}${i.image}" alt="" width="1200" height="630" loading="lazy" />
        <span><small>${esc(kicker)}</small><b>${esc(i.title)}</b>${esc(i.dek)}</span>
      </a>`;
}

/** The end of a story: the previous and the next investigation by number, then the archive. */
function next({ root, issue }) {
  const prev = ISSUES.find((i) => i.no === issue.no - 1);
  const nxt = ISSUES.find((i) => i.no === issue.no + 1);
  const cards = [
    prev && card(root, prev, `Enquête précédente, n° ${prev.no}`),
    nxt && card(root, nxt, `Enquête suivante, n° ${nxt.no}`),
  ].filter(Boolean);
  return `<section class="chapter wrap read-next" id="lire-aussi" aria-labelledby="h-aussi">
  <h2 class="sub-title" id="h-aussi">Continuer la lecture</h2>
  <div class="next-grid">${cards.join("")}</div>
  <p class="all-stories"><a href="${href(root, "enquetes")}">Toutes les enquêtes d'aviationdata</a></p>
</section>`;
}

/** The story's kicker: its number, linked to the archive, and its topic. */
function kicker({ root, issue }) {
  if (!issue) throw new Error("site:kicker outside an investigation");
  return `<p class="kicker issue-kicker"><a href="${href(root, "enquetes")}">Enquête n° ${issue.no}</a><span>${esc(issue.topic)}</span></p>`;
}

/** The archive: every investigation, newest first, with its topic for the filter. */
function archive({ root }) {
  return ISSUES.map(
    (i) => `<li class="arc-item" data-topic="${esc(i.topic)}" style="--c: ${i.accent}">
  <a class="arc-link" href="${href(root, i.slug)}">
    <img src="${root === "./" ? "" : root}${i.image}" alt="" width="1200" height="630" loading="lazy" />
    <span class="arc-text">
      <span class="arc-kicker">Enquête n° ${i.no}<span>${esc(i.topic)}</span></span>
      <span class="arc-title">${esc(i.title)}</span>
      <span class="arc-dek">${esc(i.dek)}</span>
      <span class="arc-meta">Publiée le ${frDate(i.published)}${i.updated !== i.published ? `, mise à jour le ${frDate(i.updated)}` : ""}. ${i.chapters} chapitres, environ ${i.minutes} minutes de lecture. Données : ${esc(i.sources)}.</span>
    </span>
  </a>
</li>`,
  ).join("\n");
}

/** Topic filter buttons for the archive. */
function topics() {
  const all = [...new Set(ISSUES.map((i) => i.topic))];
  return [`<button type="button" data-topic="" aria-pressed="true">Toutes</button>`]
    .concat(
      all.map((t) => `<button type="button" data-topic="${esc(t)}" aria-pressed="false">${esc(t)}</button>`),
    )
    .join("");
}

function issuesList({ root }) {
  // the six latest on the home page, each with its cover; the archive holds them all
  return ISSUES.slice(0, 6)
    .map(
      // a cover, as on a magazine rack: the investigation's own figure, its number and its title
      (i) => `<li class="shelf-item" style="--c: ${i.accent}; --pos: ${i.cover ?? "center"}">
  <a class="shelf-link" href="${href(root, i.slug)}">
    <span class="shelf-cover">
      <img class="shelf-img" src="${root === "./" ? "" : root}${i.image}" alt="" width="1200" height="630" loading="lazy" />
      <span class="shelf-no">N° ${i.no}</span>
      <span class="shelf-head">
        <span class="shelf-topic">${esc(i.topic)}</span>
        <span class="shelf-title">${esc(i.title)}</span>
      </span>
    </span>
    <span class="shelf-dek">${esc(i.hook ?? i.dek)}</span>
    <span class="shelf-meta">${i.minutes} minutes de lecture. Données : ${esc(i.sources)}.</span>
  </a>
</li>`,
    )
    .join("\n");
}

// a small drawing of each tool's own figure, in the colour of its investigation (currentColor) on grey
const cells = (rows, cols, size, gap, fill) =>
  Array.from({ length: rows * cols }, (_, k) => {
    const r = Math.floor(k / cols);
    const c = k % cols;
    return `<rect x="${c * (size + gap)}" y="${r * (size + gap)}" width="${size}" height="${size}" ${fill(r, c)}/>`;
  }).join("");
const GLYPHS = {
  // monthly passengers since 2004: the seasons, the hole of 2020, the record
  tableau: `<path class="g-mute" d="M2 40H62" /><path class="g-line" d="M2 30l4-4 4 3 4-5 4 3 4-6 4 3 4-5 4 3 4-6 3 22 3-14 4-2 4-6 4 2 4-9 4 3" />`,
  // twelve months for three countries, from cool to warm
  calendrier:
    cells(4, 12, 4.4, 0.8, (r, c) => {
      const heat = [
        [0, 0, 1, 2, 3, 4, 5, 5, 3, 2, 1, 0],
        [1, 1, 2, 2, 3, 4, 5, 5, 4, 2, 1, 1],
        [1, 1, 2, 2, 3, 3, 4, 4, 3, 2, 2, 1],
        [2, 2, 2, 3, 3, 3, 3, 4, 3, 3, 2, 2],
      ][r][c];
      return heat >= 3
        ? `class="g-on" opacity="${(0.35 + (heat - 3) * 0.3).toFixed(2)}"`
        : `class="g-cool" opacity="${(1 - heat * 0.3).toFixed(2)}"`;
    }).replace(/^/, '<g transform="translate(0.6 10)">') + "</g>",
  // one square per accident, coloured when a person is cited
  explorer:
    cells(5, 11, 4, 1.6, (r, c) => ((r * 11 + c) % 9 < 7 ? 'class="g-on"' : 'class="g-mute-fill"')).replace(
      /^/,
      '<g transform="translate(2 8)">',
    ) + "</g>",
  // a route drawn over the ocean, one waypoint moved
  placer: `<path class="g-mute" stroke-dasharray="2 3" d="M6 34Q32 24 58 34" /><path class="g-line" d="M6 34Q22 6 38 14T58 34" /><circle class="g-on" cx="6" cy="34" r="3" /><circle class="g-on" cx="58" cy="34" r="3" /><circle class="g-knob" cx="30" cy="12" r="4.5" />`,
  // an airport and its destinations
  aeroport: `<g class="g-spokes"><path d="M30 26L6 10M30 26L14 40M30 26L50 6M30 26L60 22M30 26L52 40M30 26L36 4M30 26L4 28" /></g><g class="g-on"><circle cx="6" cy="10" r="2" /><circle cx="14" cy="40" r="2" /><circle cx="50" cy="6" r="2.5" /><circle cx="60" cy="22" r="2" /><circle cx="52" cy="40" r="2" /><circle cx="36" cy="4" r="2" /><circle cx="4" cy="28" r="2.5" /></g><circle class="g-hub" cx="30" cy="26" r="4" />`,
  // streamlines of the jet, the fastest route bending with them
  route: `<path class="g-mute" d="M2 14c10-6 20 6 30 0s20-6 30 0M2 24c10-6 20 6 30 0s20-6 30 0M2 34c10-6 20 6 30 0s20-6 30 0" /><path class="g-line" d="M4 40C18 40 24 18 60 12" /><circle class="g-on" cx="4" cy="40" r="2.6" /><circle class="g-on" cx="60" cy="12" r="2.6" />`,
  // the westbound flight longer than the eastbound one
  "votre-vol": `<rect class="g-on" x="2" y="12" width="58" height="8" rx="1" /><rect class="g-cool-fill" x="2" y="26" width="40" height="8" rx="1" /><path class="g-mute" d="M42 24v12" />`,
};

function toolsList({ root }) {
  return TOOLS.map((t) => {
    const i = issueByKey(t.issue);
    const glyph = GLYPHS[t.hash]
      ? `<svg class="tool-glyph" viewBox="0 0 64 44" width="64" height="44" aria-hidden="true">${GLYPHS[t.hash]}</svg>`
      : "";
    return `<li class="tool" style="--c: ${i.accent}">
  <a href="${href(root, i.slug, t.hash)}">
    ${glyph}
    <span class="tool-title">${esc(t.title)}</span>
    <span class="tool-dek">${esc(t.dek)}</span>
    <span class="tool-from">Dans « ${esc(i.title)} »</span>
  </a>
</li>`;
  }).join("\n");
}

function corrections({ root }) {
  if (!CORRECTIONS.length)
    return `<p class="corr-empty">Le journal des corrections est ouvert depuis le ${frDate(CORRECTIONS_SINCE)}. Aucune correction n'y figure encore.</p>`;
  const rows = CORRECTIONS.map((c) => {
    const i = issueByKey(c.issue);
    return `<li><time datetime="${c.date}">${frDate(c.date)}</time> <a href="${href(root, i.slug)}">${esc(i.title)}</a> : ${esc(c.text)}</li>`;
  }).join("");
  return `<ol class="corr-list">${rows}</ol>`;
}

function cite({ base }) {
  return ISSUES.map(
    (i) =>
      `<li>${esc(SITE.author.name)}, « ${esc(i.title)} », <i>aviationdata</i>, enquête n° ${i.no}, ${frDate(i.published)}, ${base}${i.slug}</li>`,
  ).join("");
}

const PARTIALS = {
  "menu-button": menuButton,
  menu,
  foot,
  byline,
  next,
  issues: issuesList,
  tools: toolsList,
  corrections,
  cite,
  kicker,
  archive,
  topics,
  "data-sets": dataSets,
  "data-refs": dataRefs,
  "data-facts": dataFacts,
  "data-files": dataFiles,
  "data-stats": dataStats,
  "data-filter": dataFilter,
  "data-producers": dataProducers,
};

/** Replace every <!--site:name--> in a page; an unknown name fails the build. */
export function renderPartials(html, info) {
  return html.replace(/<!--\s*site:([\w-]+)\s*-->/g, (_, name) => {
    const f = PARTIALS[name];
    if (!f) throw new Error(`unknown partial site:${name}`);
    return f(info);
  });
}

const xml = esc;

/** The Atom feed: one entry per investigation. */
export function feed(base) {
  const updated = ISSUES.map((i) => i.updated)
    .sort()
    .at(-1);
  const entries = ISSUES.map(
    (i) => `  <entry>
    <title>${xml(i.title)}</title>
    <link href="${base}${i.slug}"/>
    <id>${base}${i.slug}</id>
    <published>${i.published}T08:00:00Z</published>
    <updated>${i.updated}T08:00:00Z</updated>
    <summary>${xml(i.dek)}</summary>
    <category term="${xml(i.topic)}"/>
  </entry>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="fr">
  <title>${xml(SITE.name)}</title>
  <subtitle>${xml(SITE.tagline)}</subtitle>
  <link href="${base}"/>
  <link rel="self" href="${base}feed.xml"/>
  <id>${base}</id>
  <updated>${updated}T08:00:00Z</updated>
  <author><name>${xml(SITE.author.name)}</name><uri>${SITE.author.url}</uri></author>
${entries}
</feed>
`;
}

export function sitemap(base) {
  const last = ISSUES.map((i) => i.updated)
    .sort()
    .at(-1);
  const urls = [
    [base, last],
    ...ISSUES.map((i) => [`${base}${i.slug}`, i.updated]),
    ...PAGES.map((p) => [`${base}${p.slug}`, last]),
  ];
  return `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `  <url><loc>${u}</loc><lastmod>${d}</lastmod></url>`).join("\n")}
</urlset>
`;
}

/** Vite plugin: partials in every page, an Atom link in every head, feed/sitemap/robots in the build. */
export function sitePartials(webRoot, base) {
  const abs = base || SITE.url;
  return {
    name: "site-partials",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const info = { ...pageInfo(ctx.filename, webRoot), base: abs, webRoot };
        return {
          html: renderPartials(html, info),
          tags: [
            {
              tag: "link",
              attrs: {
                rel: "alternate",
                type: "application/atom+xml",
                title: SITE.name,
                href: `${info.root}feed.xml`,
              },
              injectTo: "head",
            },
          ],
        };
      },
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "feed.xml", source: feed(abs) });
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap(abs) });
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n\nSitemap: ${abs}sitemap.xml\n`,
      });
    },
  };
}
