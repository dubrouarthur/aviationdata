// Pages live at different depths (/, /le-ciel-a-deux-vitesses/, /courant-jet/): each page states where the
// site root is, relative to itself, in <meta name="site-root">, and every data file is fetched from there.
export const ROOT = document.querySelector('meta[name="site-root"]')?.getAttribute("content") ?? "./";
export const asset = (path) => `${ROOT}${path}`;
