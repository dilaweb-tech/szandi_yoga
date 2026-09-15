/* ==========================================================================
   A tervezőből letöltött terv betöltése az oldalra

     node tools/plan-to-site.mjs <letoltott-terv.json>

   A tervező mentése (`dilaweb-<cegnev>.json`) formátumra AZONOS a site.json-nal,
   ezért a betöltés maga másolás. Ez a script azt teszi hozzá, ami nélkül az
   oldal némán hiányos maradna: felsorolja, mit kell még kézzel kitölteni, és
   megmondja, melyik kép hiányzik az images/ mappából.

   A meglévő site.json előbb site.json.bak néven félremegy.
   ========================================================================== */
import { readFileSync, writeFileSync, copyFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { block, metaTags, noscriptBlock, ogImageOf } from "./meta.mjs";

const src = process.argv[2];
if (!src) {
  console.error("Használat: node tools/plan-to-site.mjs <letoltott-terv.json>");
  process.exit(1);
}

const root = new URL("../", import.meta.url);
const out = new URL("site.json", root);
const plan = JSON.parse(readFileSync(src, "utf8"));

/* Aloldalak: amit a tervezőben aloldalnak jelöltek (`sections[].page`), ahhoz
   itt készül egy váz a `pages[]`-be. A szekciólistát mi töltjük fel – a tervező
   egy lapot szerkeszt –, de a slug, a cím és a menülink már a helyén van. */
const marked = (plan.sections || []).filter((s) => s.page && s.href);
if (marked.length) {
  plan.pages ||= [];
  for (const s of marked) {
    const slug = String(s.href).replace(/\.html$/, "");
    if (plan.pages.some((p) => p.slug === slug)) continue;
    plan.pages.push({
      slug,
      title: s.label || slug,
      description: "",
      /* alap: fejrész + kapcsolat – ezt írd át az aloldal tényleges tartalmára */
      sections: [{ id: "hero", on: true, sub: [] }, { id: "contact", on: true, sub: [] }],
    });
  }
}

if (existsSync(out)) copyFileSync(out, new URL("site.json.bak", root));

/* Az impresszum és az adatkezelési tájékoztató adatait (`legal`) meg a domaint
   (`meta.url`) a tervező nem kérdezi meg – kézzel írjuk be. Új terv betöltésekor
   ezért a korábbi site.json-ból hozzuk tovább őket, különben minden mentés után
   újra be kellene gépelni, és a jogi oldalak üresen maradnának. */
if (existsSync(out)) {
  const prev = JSON.parse(readFileSync(out, "utf8"));
  const norm = (v) => String(v || "").trim().toLowerCase();
  /* MÁS cég terve? Akkor a jogi adat nem öröklődhet: az előző ügyfél
     impresszumával menne ki az oldal. A miénk (tárhely, megőrzési idő) marad,
     az ügyfélé kiürül – a hiánylista alább úgyis felsorolja, mit kell pótolni. */
  const sameClient = norm(prev.content?.company) === norm(plan.content?.company);
  if (!plan.legal && prev.legal) {
    plan.legal = prev.legal;
    if (!sameClient) for (const k of ["name", "seat", "regNumber", "taxNumber", "representative", "email", "phone", "supervisor"]) {
      if (k in plan.legal) plan.legal[k] = "";
    }
  }
  if (sameClient && !plan.meta?.url && prev.meta?.url) (plan.meta ||= {}).url = prev.meta.url;

  /* Ugyanaz az ügyfél: a tervező által NEM kérdezett, kézzel írt mezők is
     maradjanak meg – enélkül minden újratöltés után újra kellene gépelni a
     SEO-címet, a leírást, a felülírt feliratokat és a képleírásokat. */
  if (sameClient) {
    const pc = prev.content || {}, nc = (plan.content ||= {});
    for (const k of ["seoTitle", "seoDescription", "texts"]) if (!nc[k] && pc[k]) nc[k] = pc[k];
    /* alt: képenként, fájlnév alapján – a tervező átrendezheti a sorrendet */
    const alts = new Map((pc.images || []).filter((im) => im?.alt).map((im) => [im.src, im.alt]));
    for (const im of nc.images || []) if (!im.alt && alts.has(im.src)) im.alt = alts.get(im.src);
  }
}

writeFileSync(out, JSON.stringify(plan, null, 2) + "\n");

/* --- mit kell még kézzel megcsinálni ------------------------------------- */
const c = plan.content || {};
/* Az éles cím: a canonical, az OG-kép és a sitemap is ebből dolgozik. */
const base = String(plan.meta?.url || "").trim().replace(/\/+$/, "");
const todo = [];

for (const key of ["company", "tagline", "about", "address", "phone"]) {
  if (!String(c[key] || "").trim()) todo.push(`content.${key} üres – kötelező mező.`);
}
/* A kártyákat már a tervező is kérdezi, de a minta-szöveget ott is ott lehet
   hagyni – az nem mehet ki élesbe, ezért itt szólunk érte. */
if (!c.services?.length) {
  todo.push("content.services[] hiányzik – a szolgáltatás-kártyákon alapszöveg marad.");
} else {
  const sample = c.services.filter((sv) => /^(Lorem ipsum|Dolor sit amet|Consectetur|Adipiscing elit)$/.test(sv.name || "")
    || /^(Vestibulum|Maecenas|Cras justo|Donec ullamcorper)/.test(sv.text || ""));
  if (sample.length) {
    todo.push(`${sample.length} szolgáltatás-kártyán minta-szöveg maradt (content.services[]) – az ügyfél nem írta át.`);
  }
}
if (!c.seoTitle) todo.push("content.seoTitle nincs – a böngészőcím a cégnévből és a bevezetőből épül.");
if (!c.seoDescription) todo.push("content.seoDescription nincs – a keresőleírás a bevezető lesz.");

/* Kép csak akkor jó, ha tényleg ott van az images/ mappában */
const local = (v) => v && !/^(https?:|data:|\/)/.test(v);
const refd = [...new Set([
  ...(local(c.logo) ? [c.logo] : []),
  ...(c.images || []).map((im) => im.src).filter(local),
  ...(c.references || []).map((r) => r.image).filter(local),
  /* elemlistás szekciók (galéria, csapat, vélemények, partnerlogók…) képei */
  ...Object.values(c.lists || {}).flat().map((it) => it.image).filter(local),
  /* az ártáblát és a kártyákat a site.js szintén paintImg-gel festi */
  ...(c.pricing?.items || []).map((p) => p.image).filter(local),
  ...(c.services || []).map((s) => s.image).filter(local),
])];
const imagesDir = new URL("images/", root);
const have = new Map((existsSync(imagesDir) ? readdirSync(imagesDir) : []).map((f) => [f.toLowerCase(), f]));

const missing = refd.filter((f) => !have.has(f.toLowerCase()));
if (missing.length) todo.push(`Hiányzó kép az images/ mappából: ${missing.join(", ")}`);

/* A Windows fájlrendszere nem érzékeny a kis/nagybetűre, a Linux tárhelyé igen:
   ami itt megjelenik, az élesben néma 404 lenne. */
const caseOff = refd.filter((f) => have.has(f.toLowerCase()) && have.get(f.toLowerCase()) !== f)
  .map((f) => `${f} → ${have.get(f.toLowerCase())}`);
if (caseOff.length) todo.push(`Kis/nagybetű-eltérés a képnévben (itt működik, Linux tárhelyen 404): ${caseOff.join(", ")}`);

if ((c.images || []).some((im) => !im.alt)) {
  todo.push("Van kép alt szöveg nélkül (content.images[].alt) – akadálymentesség és SEO.");
}
if (plan.pages?.length) {
  todo.push(`${plan.pages.length} aloldal van a pages[] tömbben (${plan.pages.map((p) => p.slug).join(", ")}): ` +
    "töltsd fel a sections[] listájukat, majd `node tools/build-pages.mjs`.");
}
if (c.booking?.enabled) {
  todo.push("Be van kapcsolva a foglalás: a szolgáltatásokat, munkatársakat és a nyitvatartást a backend adja (dilaweb_backend, scripts/new-site.sh telepítés után az admin felületen).");
}

/* --- jogi adatok: enélkül nem mehet élesbe -------------------------------- */
const L = plan.legal || {};
if (!plan.legal) {
  todo.push("HIÁNYZIK a `legal` blokk – enélkül az impresszum és az adatkezelési tájékoztató üres. Kötelező: Ekertv. 4. § és GDPR.");
} else {
  const legalFields = {
    name: "a szolgáltató hivatalos neve",
    seat: "székhely",
    regNumber: "nyilvántartási vagy cégjegyzékszám",
    taxNumber: "adószám",
    representative: "képviselő neve",
  };
  for (const [key, label] of Object.entries(legalFields)) {
    if (!String(L[key] || "").trim()) todo.push(`legal.${key} üres – ${label} (impresszum, kötelező adat).`);
  }
  if (!String(L.hosting?.name || "").trim()) todo.push("legal.hosting.name üres – a tárhelyszolgáltató megnevezése kötelező az impresszumban.");
  if (!L.retentionMonths) todo.push("legal.retentionMonths nincs megadva – az adatkezelési tájékoztatóban meg kell mondani, meddig őrizzük a foglalási adatokat.");
  if (!String(L.updated || "").trim()) todo.push("legal.updated üres – a tájékoztató hatálybalépésének dátuma hiányzik.");
}

/* --- besütött fejadatok, JS nélküli tartalék, fül-ikon -------------------
   A közösségi crawler (Facebook, Messenger, LinkedIn) nem futtat JavaScriptet:
   megosztáskor csak az látszik, ami az index.html-ben ÁLL. A site.js ugyanezt
   beállítja a böngészőnek, de a crawlerhez az sosem ér el. */
const title = c.seoTitle
  || [c.company, String(c.tagline || "").split(/[.!?]/)[0].trim()].filter(Boolean).join(" – ");
const desc = c.seoDescription || c.tagline || "";
const ogImage = ogImageOf(c, base);

const indexUrl = new URL("index.html", root);
writeFileSync(indexUrl, block(
  block(readFileSync(indexUrl, "utf8"), "META", metaTags({
    title, desc, url: base ? base + "/" : "", image: ogImage, company: c.company, lang: plan.meta?.lang,
  })),
  "NOSCRIPT", noscriptBlock(c)));
if (!ogImage) todo.push("Nincs OG-kép: a megosztott link kép nélkül jelenik meg (content.images[0] és meta.url kell hozzá).");

/* Fül-ikon: a cégnév monogramja a lap fő színével – ugyanaz a rajz, mint a
   site.js monogram()-ja. Így az ikon akkor is megvan, ha az ügyfél nem küld
   képet; enélkül minden oldalletöltés egy 404-gyel indulna. */
const lum = (hex) => [1, 3, 5]
  .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  .reduce((a, v, i) => a + [0.2126, 0.7152, 0.0722][i] * v, 0);
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const inkOn = (hex) => (ratio(hex, "#10141A") >= ratio(hex, "#FFFFFF") ? "#10141A" : "#FFFFFF");

const primary = plan.design?.colors?.light?.primary || plan.design?.colors?.dark?.primary || "#B4650F";
const initials = String(c.company || "").trim().split(/\s+/).slice(0, 2)
  .map((w) => w[0]).join("").replace(/[^\p{L}\p{N}]/gu, "").toUpperCase() || "DW";
const rx = Math.min(32, Math.max(0, Number(plan.design?.radius ?? 16)));
writeFileSync(new URL("images/favicon.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${initials}">
  <rect width="64" height="64" rx="${rx}" fill="${primary}"/>
  <text x="32" y="33" fill="${inkOn(primary)}" font-family="Segoe UI, Helvetica, Arial, sans-serif"
        font-size="30" font-weight="700" text-anchor="middle" dominant-baseline="central">${initials}</text>
</svg>
`);

/* --- sitemap.xml és robots.txt ------------------------------------------
   A domain ügyfelenként más, ezért a sitemap nem lehet kézzel írt fájl: a
   meta.url-ből generáljuk, hogy ne maradjon benne más ügyfél címe. */
if (base) {
  const today = new Date().toISOString().slice(0, 10);
  const pages = ["", "impresszum.html", "adatkezeles.html"];
  if (c.booking?.enabled) pages.push("foglalas.html");
  /* a tools/build-pages.mjs által generált aloldalak – külön URL, külön <title> */
  for (const p of plan.pages || []) if (p?.slug) pages.push(`${p.slug}.html`);

  const urls = pages
    .map((p) => `  <url>\n    <loc>${base}/${p}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join("\n");
  writeFileSync(
    new URL("sitemap.xml", root),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );

  /* A keresők a robots.txt-ből találják meg a sitemapet */
  const robotsUrl = new URL("robots.txt", root);
  const robots = existsSync(robotsUrl) ? readFileSync(robotsUrl, "utf8") : "User-agent: *\nAllow: /\n";
  const line = `Sitemap: ${base}/sitemap.xml`;
  if (!robots.includes(line)) {
    writeFileSync(robotsUrl, robots.replace(/\n*Sitemap:.*$/m, "").trimEnd() + `\n\n${line}\n`);
  }
} else {
  /* Nincs domain: a bent maradt sitemap.xml az ELŐZŐ ügyfél címét hirdetné a
     keresőknek. Inkább ne legyen, mint hogy idegen domainre mutasson. */
  const sitemapUrl = new URL("sitemap.xml", root);
  if (existsSync(sitemapUrl)) { rmSync(sitemapUrl); todo.push("A régi sitemap.xml törölve – más ügyfél domainje volt benne."); }
  const robotsUrl = new URL("robots.txt", root);
  if (existsSync(robotsUrl)) {
    const robots = readFileSync(robotsUrl, "utf8");
    if (/^Sitemap:/m.test(robots)) writeFileSync(robotsUrl, robots.replace(/\n*^Sitemap:.*$/m, "").trimEnd() + "\n");
  }
  todo.push('meta.url hiányzik – enélkül nincs sitemap.xml (pl. "https://ugyfel.hu").');
}

console.log(`site.json frissítve innen: ${src}`);
console.log("index.html: megosztás-adatok besütve, images/favicon.svg generálva.");
if (base) console.log("sitemap.xml és robots.txt frissítve.");
console.log(todo.length ? `\nMég hátra van (${todo.length}):` : "\nNincs hiányzó adat.");
todo.forEach((line, i) => console.log(`  ${i + 1}. ${line}`));
console.log("\nEllenőrzés: node test-site.mjs");
