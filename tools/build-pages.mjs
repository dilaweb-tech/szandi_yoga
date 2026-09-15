/* ==========================================================================
   ALOLDALAK GENERÁLÁSA

     node tools/build-pages.mjs

   A `site.json` `pages[]` tömbjéből minden bejegyzéshez készít egy
   `<slug>.html`-t: az `index.html` másolata, `<html data-page="<slug>">`
   jelöléssel. A `site.js` ebből tudja, melyik szekciólistát és melyik
   böngészőcímet kell használnia.

   Miért külön fájl és nem útvonal-kezelés: a keresőnek külön URL és külön
   <title> kell. Statikus tárhelyen ez a legolcsóbb megoldás – nincs szerver,
   nincs építőlánc, a fájl önmagában megnyitható.

   A meglévő aloldal-fájlt felülírja, a listából kikerült aloldalt NEM törli –
   azt kézzel kell, hogy egy elgépelt slug ne tüntessen el egy élő oldalt.
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { block, metaTags, ogImageOf } from "./meta.mjs";

const root = new URL("../", import.meta.url);
const cfg = JSON.parse(readFileSync(new URL("site.json", root), "utf8"));
const pages = Array.isArray(cfg.pages) ? cfg.pages : [];

if (!pages.length) {
  console.log("A site.json-ban nincs `pages[]` – nincs mit generálni.");
  console.log('Aloldal felvétele: { "slug": "blog", "title": "Blog", "sections": [ … ] }');
  process.exit(0);
}

const index = readFileSync(new URL("index.html", root), "utf8");
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const base = String(cfg.meta?.url || "").trim().replace(/\/+$/, "");
const ogImage = ogImageOf(cfg.content, base);
let written = 0;

for (const p of pages) {
  const slug = String(p?.slug || "");
  if (!SLUG.test(slug) || slug === "index") {
    console.error(`  KIHAGYVA  "${slug}" – a slug csak kisbetű, szám és kötőjel lehet (és nem "index").`);
    continue;
  }
  if (!p.sections?.length) {
    console.error(`  KIHAGYVA  "${slug}" – nincs megadva sections[], üres oldal lenne.`);
    continue;
  }

  /* Csak a gyökér-elem jelölése változik: a lap többi része szó szerint
     ugyanaz, így egy index.html-javítás minden aloldalra átjön újragenerálással. */
  const html = index.replace(/<html\b([^>]*)>/, (m, attrs) =>
    `<html${attrs.replace(/\s+data-page="[^"]*"/, "")} data-page="${slug}">`);
  if (html === index) throw new Error("Nem találom a <html> elemet az index.html-ben.");

  /* Saját cím, leírás és canonical: enélkül minden generált aloldal a főoldal
     megosztás-adatait vinné magával, és a kereső duplikátumnak látná. */
  const page = block(html, "META", metaTags({
    title: [p.title || slug, cfg.content?.company].filter(Boolean).join(" – "),
    desc: p.description || cfg.content?.seoDescription || cfg.content?.tagline || "",
    url: base ? `${base}/${slug}.html` : "",
    image: ogImage, company: cfg.content?.company, lang: cfg.meta?.lang,
  }));

  const out = new URL(`${slug}.html`, root);
  const fresh = !existsSync(out);
  writeFileSync(out, page);
  written++;
  console.log(`  ${fresh ? "ÚJ    " : "FRISS "}   ${slug}.html  –  ${p.title || slug}`);
}

console.log(`\n${written} aloldal kész. A menüpont a site.json sections[].href mezőjéből mutat rájuk.`);
console.log("Ellenőrzés: node test-site.mjs");
