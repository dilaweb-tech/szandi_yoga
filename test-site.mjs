/* ==========================================================================
   Ellenőrzés – `node test-site.mjs`
   Nem böngészőt szimulál, hanem azt a három hibát fogja meg, ami egy kész
   oldalon némán romlik el: hiányzó DOM-azonosító, ismeretlen felirat-kulcs és
   olyan design-érték a site.json-ban, amihez nincs CSS-szabály.
   ========================================================================== */
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const read = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
const index = read("index.html");
const foglalas = read("foglalas.html");
const impresszum = read("impresszum.html");
const adatkezeles = read("adatkezeles.html");
const hiba = read("404.html");
const js = read("site.js");
const css = read("pv.css");
const cfg = JSON.parse(read("site.json"));
/* A ténylegesen betöltött foglalás-adapter (a régi Firebase-es booking-live.js
   már nincs a repóban – a lenti ellenőrzés őrzi, hogy vissza se kerüljön). */
const adapter = read("booking-api.js");

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

/* --- 1. Minden hivatkozott azonosító létezik valamelyik oldalon ----------- */
const pages = index + foglalas + impresszum + adatkezeles + hiba;
const ids = [...js.matchAll(/\$\$?\("#([\w-]+)/g)].map((m) => m[1]);
for (const id of new Set(ids)) {
  ok(pages.includes(`id="${id}"`), `A site.js a #${id} elemet keresi, de egyik oldalon sincs ilyen id.`);
}

/* Amit a főoldalnak mindenképp tartalmaznia kell (ezekre nincs ?. a kódban) */
for (const id of ["pv-nav", "pv-items", "pv-prices", "pv-refs", "pv-hero-slides",
                  "pv-company", "pv-tagline", "pv-about", "pv-address", "pv-phone",
                  "pv-email", "pv-map", "pv-map-link", "pv-logo"]) {
  ok(index.includes(`id="${id}"`), `Hiányzik az index.html-ből: #${id}`);
}

/* --- 2. Felirat-kulcsok: ami a HTML-ben áll, legyen a szótárban ----------- */
const dict = (lang) => {
  const block = js.split(`  ${lang}: {`)[1].split("\n  },")[0];
  return new Set([...block.matchAll(/"([\w.]+)":/g)].map((m) => m[1]));
};
const HU = dict("hu"), EN = dict("en");
ok(HU.size > 20 && HU.size === EN.size, "A magyar és az angol szótár kulcsai nincsenek szinkronban.");
for (const k of HU) ok(EN.has(k), `Hiányzó angol felirat: ${k}`);

for (const m of pages.matchAll(/data-i18n="([\w.]+)"/g)) {
  ok(HU.has(m[1]), `Az oldal a(z) "${m[1]}" feliratra hivatkozik, de nincs a site.js szótárában.`);
}
/* A foglalási felület feliratai a varázsló saját szótárából jönnek */
for (const m of pages.matchAll(/data-lv(?:-label)?="([\w.]+)"/g)) {
  ok(adapter.includes(`"${m[1]}"`), `Az oldal a(z) "${m[1]}" feliratot kéri, de a booking-api.js nem ismeri.`);
}

/* Az adapter be van kötve MINDKÉT belépési ponton – ha az egyik lemarad, a
   foglalás némán nem indul el azon az oldalon. */
ok(foglalas.includes('src="booking-api.js"'),
  "A foglalas.html nem a booking-api.js adaptert tölti be.");
ok(js.includes('import("./booking-api.js")'),
  "A site.js (főoldalba ágyazott varázsló) nem a booking-api.js adaptert tölti be.");
ok(!/src="booking-live\.js"|import\("\.\/booking-live\.js"\)/.test(pages + js),
  "Valahol még a régi Firebase-adapter (booking-live.js) töltődik be.");

/* A foglalási varázsló konténere és a belépés-ablak a főoldalon is kell */
for (const id of ["bk-root", "auth-dlg", "auth-form", "auth-email", "auth-pass", "auth-submit"]) {
  ok(index.includes(`id="${id}"`), `A beágyazott foglaláshoz hiányzik az index.html-ből: #${id}`);
}

/* --- 2b. Jogi oldalak: kötelező tartalom és élő adatkötés -----------------
   Az impresszum és az adatkezelési tájékoztató nem opció (Ekertv. 4. §, GDPR),
   és némán romlik el: ha egy `data-legal` kulcsot elgépelünk, a mező csak egy
   gondolatjelet mutat – a hiba az ügyfél oldalán derülne ki. */
const legalPages = { "impresszum.html": impresszum, "adatkezeles.html": adatkezeles };

/* A site.js applyLegal() `val` objektuma adja a felhasználható kulcsokat */
const legalBlock = js.split("const val = {")[1].split("\n  };")[0];
const LEGAL_KEYS = new Set([...legalBlock.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]));
ok(LEGAL_KEYS.size > 5, "Nem sikerült kiolvasni az applyLegal() mezőit a site.js-ből.");

for (const [name, html] of Object.entries(legalPages)) {
  for (const m of html.matchAll(/data-legal="(\w+)"/g)) {
    ok(LEGAL_KEYS.has(m[1]), `A ${name} a "${m[1]}" jogi mezőt kéri, de az applyLegal() nem ismeri.`);
  }
  for (const m of html.matchAll(/data-legal-if="(\w+)"/g)) {
    ok(LEGAL_KEYS.has(m[1]) || m[1] === "booking",
      `A ${name} a "${m[1]}" feltételre hivatkozik, de az applyLegal() nem ismeri.`);
  }
  ok(html.includes('src="site.js"'), `A ${name} nem tölti be a site.js-t – a cégadatok üresen maradnának.`);
}

/* A jogi linkek minden látogatható oldal láblécében ott vannak */
for (const [name, html] of Object.entries({
  "index.html": index, "foglalas.html": foglalas, "404.html": hiba, ...legalPages,
})) {
  ok(html.includes('href="impresszum.html"') && html.includes('href="adatkezeles.html"'),
    `A ${name} láblécéből hiányzik az impresszum vagy az adatkezelési tájékoztató linkje.`);
}

/* A site.json jogi blokkja. A repó EGYSZERRE sablon és leszállított oldal,
   ezért az ÜGYFÉL adatainál két állapot érvényes, a harmadik nem:
     – mind üres: még nem töltöttük ki, ez a sablon állapota,
     – mind kitöltött: ez megy az ügyfélhez.
   A FÉLIG kitöltött a veszélyes: az impresszum gondolatjelekkel jelenne meg az
   ügyfél oldalán, és senkinek nem tűnne fel.
   Ami viszont a MIÉNK (hatálybalépés, tárhelyszolgáltató, megőrzési idő), az
   minden példányon ugyanaz – az mindig kötelező. */
const LEGAL_CLIENT = ["name", "seat", "regNumber", "taxNumber", "representative"];
ok(cfg.legal, "A site.json-ból hiányzik a `legal` blokk – az impresszum üres lenne.");
const legalFilled = LEGAL_CLIENT.filter((k) => String(cfg.legal?.[k] || "").trim());

if (legalFilled.length === 0) {
  console.warn("  (a jogi blokk ügyfél-adatai üresek – sablon-állapot; átadás ELŐTT ki kell tölteni)");
} else {
  for (const key of LEGAL_CLIENT) {
    ok(String(cfg.legal?.[key] || "").trim(),
      `A site.json legal.${key} mezője üres, pedig a blokk többi része ki van töltve (kötelező adat).`);
  }
}
ok(String(cfg.legal?.updated || "").trim(), "A site.json legal.updated (hatálybalépés) üres.");
ok(String(cfg.legal?.hosting?.name || "").trim(), "A site.json legal.hosting.name üres – a tárhelyszolgáltató kötelező adat.");
ok(Number(cfg.legal?.retentionMonths) > 0, "A site.json legal.retentionMonths hiányzik – a megőrzési időt meg kell adni.");


/* --- 2c. Megosztás és fül-ikon -------------------------------------------
   A közösségi crawler nem futtat JS-t: amit a site.js ír a fejlécbe, azt nem
   látja. A megosztás-adatokat ezért a tools/plan-to-site.mjs süti a markerek
   közé – ha a marker eltűnik egy markup-átírásnál, a besütés NÉMÁN elmarad. */
for (const name of ["META", "NOSCRIPT"]) {
  ok(index.includes(`<!-- >>> ${name} -->`) && index.includes(`<!-- <<< ${name} -->`),
    `Hiányzik a ${name} marker-pár az index.html-ből – a tools/plan-to-site.mjs nem tudná kitölteni.`);
}
ok(index.includes('property="og:title"') && index.includes('property="og:description"'),
  "Nincs besütve az og:title/og:description az index.html-be – a megosztott link üresen jelenne meg. Futtasd: node tools/plan-to-site.mjs site.json");
ok(!/favicon\.png/.test(pages), "Valamelyik oldal a favicon.png-re hivatkozik; a generált ikon az images/favicon.svg.");
/* --- 3. A site.json design-értékeihez van CSS-szabály ---------------------
   Az alapértékekhez szándékosan nincs külön szabály (a CSS csak az eltéréseket
   írja le), ezért a site.js BASE-e is elfogadott érték. */
const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
const baseBlock = js.split("const BASE = {")[1].split("\n};")[0];
const BASE_VALS = Object.fromEntries(
  [...baseBlock.matchAll(/(\w+):\s*"([\w-]+)"/g)].map((m) => [m[1], m[2]]));

const checkDesign = (design, where) => {
  for (const [key, val] of Object.entries(design || {})) {
    if (typeof val !== "string" || ["font", "fontHead", "align", "mode"].includes(key)) continue;
    const attr = `data-${kebab(key)}`;
    if (!css.includes(`[${attr}=`)) continue;        /* ehhez a tengelyhez nincs CSS – nem ellenőrizhető */
    ok(css.includes(`[${attr}="${val}"]`) || BASE_VALS[key] === val,
      `A ${where} ${key}: "${val}" értékéhez nincs szabály a pv.css-ben (elgépelés?).`);
  }
};
checkDesign(cfg.design, "site.json");

/* Minden kapcsolóhoz, amit a site.js kitesz, legyen szabály a CSS-ben. Ez fogja
   meg, ha a tervezőben átneveznek egy tengelyt, és a szinkron után a termék még
   a régi néven írja ki (a sávozás pl. `band` a lapon, `stripe` a szekción). */
const PV_FLAGS = [...js.match(/const PV_FLAGS = \[([\s\S]*?)\];/)[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
for (const key of PV_FLAGS) {
  ok(css.includes(`[data-${kebab(key)}=`),
    `A site.js data-${kebab(key)} kapcsolót tesz ki, de nincs rá szabály a pv.css-ben.`);
}
ok(css.includes("[data-stripe="), "A sávozás jelölőjéhez (data-stripe) nincs szabály a pv.css-ben.");

/* A választott betűtípusok léteznek */
for (const key of [cfg.design?.font, cfg.design?.fontHead]) {
  ok(new RegExp(`^\\s*${key}\\s*:\\s*\\{`, "m").test(js), `Ismeretlen betűtípus a site.json-ban: ${key}`);
}

/* --- 3b. Nap/hold ikonváltó – a tervező 02. szekciójából, a sync nem hozza -- */
ok(css.includes('.icon--moon { display: none; }'),
  "Hiányzik a nap/hold ikonváltó alapszabálya (a tervező style.css 02. szekciójából) – mindkét ikon egymáson látszana.");
ok(css.includes('.pv[data-mode="light"] .pv-mode .icon--moon { display: block; }'),
  "Hiányzik a világos módban a hold-ikon megjelenítése.");

/* --- 3c. A hero fátyla nem foghatja el a lapozót -------------------------
   A teljes szélességű heróknál (banner, színpad) a ::after fátyol a DOM-ban a
   kép UTÁN jön, tehát a nyilak FÖLÖTT festődik. Ha visszakerül rá a kattintás,
   a karusszel némán halott: sem nyíllal, sem ujjal nem lehet lapozni. */
for (const hero of ["banner", "stage"]) {
  const veil = css.match(new RegExp('\\.pv\\[data-hero="' + hero + '"\\] \\.pv-hero::after \\{[^}]*\\}'))?.[0];
  ok(veil && /pointer-events: none/.test(veil),
    `A ${hero} hero fátyla elfogja a lapozó kattintását és az ujjas görgetést.`);
}
ok(/z-index: 2/.test(css.match(/^\.pv-slider__nav \{[^}]*\}/m)[0]),
  "A lapozó nyilak a hero fátyla ALÁ kerülnek – ott halványak és nem kattinthatók.");

/* --- 4. A stílus-szinkron sértetlen -------------------------------------- */
ok(css.includes("/* >>> SYNC:PV") && css.includes("/* <<< SYNC:PV"),
  "A pv.css SYNC markerei hiányoznak – a tools/sync-css.mjs nem tudná frissíteni.");
ok(css.split("/* <<< SYNC:PV")[1].includes(".pv-nav__cta"),
  "A termék-felülírások a szinkronblokk ELŐTT állnak – a generált szabályok felülírnák őket.");

/* --- 5. A kliens-kód értelmezhető, és a JSON csak létező feliratot ír felül --
   A böngésző a szintaktikai hibát némán nyeli: a modul be sem indul, az oldal
   viszont betöltődik. Egy `el?.x = y` sor így vitte magával az egész foglalást.
   A modul-fejlécet le kell vágni, mert a `new Function` nem ismeri az importot. */
const parses = (src) => new Function(src.replace(/^\s*(?:import|export)\b[\s\S]*?;\s*$/gm, ""));
for (const f of ["site.js", "booking-api.js", "booking.js"]) {
  assert.doesNotThrow(() => parses(read(f)), `Szintaktikai hiba: ${f}`);
  checks++;
}
for (const key of Object.keys(cfg.content?.texts || {})) {
  ok(HU.has(key), `A site.json content.texts "${key}" kulcsa nincs a szótárban – hatástalan marad.`);
}

/* --- 6. site.json: a kötelező tartalom megvan ----------------------------- */
for (const key of ["company", "tagline", "about", "address", "phone"]) {
  ok(String(cfg.content?.[key] || "").trim(), `Kitöltetlen kötelező mező a site.json-ban: content.${key}`);
}
ok(Array.isArray(cfg.sections) && cfg.sections.some((s) => s.id === "contact"),
  "A sections listából hiányzik a kapcsolat szekció.");

/* --- 7. Kapcsolós modulok (EXTRAS): horgony, szekció és felirat megvan ----
   Ez az ellenőrzés fogja meg a hiányos új modult: felvették az EXTRAS-ba, de
   nincs hozzá <section>, vagy nem létező szekció mögé fűznék. */
const SECTION_IDS = [...js.match(/const SECTION_IDS = \[([\s\S]*?)\];/)[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
const EXTRAS = [...js.match(/const EXTRAS = \[([\s\S]*?)\n\];/)[1]
  .matchAll(/id: "(\w+)", after: "(\w+)"/g)].map((m) => ({ id: m[1], after: m[2] }));
ok(EXTRAS.length, "Az EXTRAS lista nem olvasható ki a site.js-ből.");
/* Elemlistás szekciók: markupjuk nincs, de a három feliratuk kell mindkét
   nyelven – e nélkül a generált szekció fejléce a nyers kulcsot mutatná. */
const LIST_IDS = [...js.match(/const LIST_SECS = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
ok(LIST_IDS.length, "A LIST_SECS tábla nem olvasható ki a site.js-ből.");
for (const id of LIST_IDS) {
  ok(SECTION_IDS.includes(id), `A(z) "${id}" lista-szekció nincs a SECTION_IDS listában.`);
  for (const key of [`sec.${id}`, `pv.${id}Eyebrow`, `pv.${id}Title`]) {
    ok(HU.has(key) && EN.has(key), `Hiányzó felirat a(z) "${id}" lista-szekcióhoz: ${key}`);
  }
}
ok(index.includes('id="pv-main"'), "A generált szekcióknak kell egy #pv-main konténer.");

/* Élő tartalom: a galériát az ügyfél az ADMIN felületen tölti fel, és az a
   backend `content` táblájába megy, nem a site.json-ba. A lapnak ezért mindkét
   forrásból olvasnia kell – három módon lehet elrontani, mind a három néma:
   nincs időkorlát (a néma backend megállítja a lapot), sorban kérjük (a lap a
   backendre vár), vagy vakon átvesszük a választ (üres válasz kitörli a
   site.json-ban megírt csapatot és GYIK-et). */
ok(/fetch\("\/api\/content"/.test(js), "a lap nem olvassa az admin felületen szerkesztett listákat");
ok(/AbortSignal\.timeout\(/.test(js), "az élő tartalom lekérése időkorlát nélkül megállítaná a lapot");
ok(/Promise\.all\(\[\r?\n\s*fetch\(file/.test(js), "a site.json és az élő tartalom nem egyszerre indul");
ok(/Array\.isArray\(live\[id\]\)/.test(js), "üres backend-válasz eltüntetné a site.json listáit");

/* Arcképes lista (vélemények): fotó nélkül a NÉV monogramja a tartalék, nem az
   absztrakt folt. Ha bármelyik fele kiesik, néma placeholder-arcok jönnek. */
ok(/reviews:\s*\{[^}]*avatar: true/.test(js), "A reviews listáról lemaradt az `avatar: true` – fotó nélkül absztrakt folt lenne az arckép helyén.");
ok(/cfg\.avatar \? monogram\(/.test(js), "A renderLists nem ad monogram-tartalékot az arcképes listának.");
ok(/function monogram\(name, i = 0\)/.test(js), "A monogram() nem vesz át nevet – minden avatar a cégnév monogramja lenne.");

for (const x of EXTRAS) {
  ok(index.includes(`data-sec="${x.id}"`), `A(z) "${x.id}" modulhoz nincs szekció az index.html-ben.`);
  ok(index.includes(`id="sec-${x.id}"`), `A(z) "${x.id}" modulhoz nincs horgony: #sec-${x.id}`);
  ok(SECTION_IDS.includes(x.after), `A(z) "${x.id}" modul ismeretlen szekció mögé kerülne: ${x.after}`);
}

/* --- 8. Aloldalak --------------------------------------------------------
   Az aloldal a `pages[]`-ből él: a generált HTML `data-page` jelölése választja
   ki. Rossz slug vagy üres szekciólista néma üres oldalt adna. */
ok(/PAGE = slug \? \(CFG\.pages \|\| \[\]\)\.find/.test(js),
  "A site.js nem a data-page jelölésből választja ki az aloldalt.");
const slugs = new Set();
for (const p of cfg.pages || []) {
  ok(/^[a-z0-9][a-z0-9-]*$/.test(p.slug || "") && p.slug !== "index",
    `Rossz aloldal-slug: "${p.slug}" (csak kisbetű, szám, kötőjel; "index" nem lehet).`);
  ok(p.sections?.length, `A(z) "${p.slug}" aloldalnak nincs sections listája – üres oldal lenne.`);
  slugs.add(p.slug);
}
/* menüpont, ami aloldalra visz: legyen mögötte tényleg aloldal */
for (const s of cfg.sections || []) {
  if (!/\.html$/.test(s.href || "")) continue;
  ok(slugs.has(s.href.replace(/\.html$/, "")),
    `A(z) "${s.label || s.id}" menüpont a ${s.href}-re visz, de nincs hozzá bejegyzés a pages[]-ben.`);
}


/* --- 9. A foglalás szótára is kétnyelvű ----------------------------------
   Hiányzó kulcsnál a másik nyelven a NYERS kulcs jelenne meg a gombon. */
const lvDict = (lang) => new Set([...adapter.split(`  ${lang}: {`)[1].split("\n  },")[0]
  .matchAll(/"([\w.]+)":/g)].map((m) => m[1]));
const LV_HU = lvDict("hu"), LV_EN = lvDict("en");
ok(LV_HU.size > 20 && LV_HU.size === LV_EN.size, "A booking-api.js magyar és angol szótára nincs szinkronban.");
for (const k of LV_HU) ok(LV_EN.has(k), `Hiányzó angol foglalás-felirat: ${k}`);

/* --- 10. Példa-konfigurációk ---------------------------------------------
   A peldak/*.json ugyanazzal a kóddal fut, mint az éles site.json, csak ezek
   mennek ügyfél elé demóra – ott egy elgépelt design-érték a legdrágább. */
for (const file of readdirSync(new URL("peldak/", import.meta.url)).filter((f) => f.endsWith(".json"))) {
  let demo = null;
  assert.doesNotThrow(() => (demo = JSON.parse(read("peldak/" + file))), `Hibás JSON: peldak/${file}`);
  checks++;
  checkDesign(demo?.design, `peldak/${file}`);
  for (const key of Object.keys(demo?.content?.texts || {})) {
    ok(HU.has(key), `A peldak/${file} content.texts "${key}" kulcsa nincs a szótárban – hatástalan marad.`);
  }
}

/* --- 11. A tervezőből átvett új gépezetek --------------------------------
   Értékelés-sáv, kategória-szűrő, termékkártyás árjegyzék, nyitvatartás + élő
   jelzés, útvonal-gomb, sötét kiemelés. Mindegyik HÁROM helyen él: site.js
   (logika), index.html (markup) és pv.css (stílus, szinkronból). Ha az egyik
   kimarad, a lap némán szegényebb lesz – ezért itt mind a három megvan nézve. */
const HAS = {
  "pv-stars":    { js: "starPct", html: null, css: ".pv-stars" },
  "pv-chip":     { js: "chipRow", html: "pv-price-chips", css: ".pv-chip" },
  "pv-status":   { js: "openState", html: "pv-status", css: ".pv-status" },
  "pv-hours":    { js: "pv-hours-list", html: "pv-hours", css: ".pv-hours" },
  "pv-cta-bar":  { js: "pv-cta-bar", html: "pv-cta-bar", css: ".pv-cta-bar" },
  "pv-cta2":     { js: "pv.ctaRoute", html: "pv-cta2", css: null },
  "plate":       { js: "dataset.plate", html: null, css: `[data-plate="1"]` },
  "price-cards": { js: "pv-prices--cards", html: null, css: ".pv-prices--cards" },
};
for (const [name, need] of Object.entries(HAS)) {
  ok(js.includes(need.js), `${name}: hiányzik a site.js-ből (${need.js})`);
  if (need.html) ok(index.includes(`id="${need.html}"`), `${name}: hiányzik az index.html-ből (#${need.html})`);
  /* a CSS a tervezőből jön (tools/sync-css.mjs) – ez a sor a régi szinkront fogja meg */
  if (need.css) ok(css.includes(need.css), `${name}: nincs hozzá szabály a pv.css-ben – futtasd a sync-css.mjs-t`);
}
ok(js.includes(`rating:  { media: false, body: true, stars: true }`),
  "az értékelés-szekció kikerült a LIST_SECS-ből");

/* A logika ugyanaz, mint a tervezőben – itt a SZEMÉT bemenet a lényeg, mert az
   ügyfél szabad szöveget ír a mezőkbe. */
const starPct = new Function(js.match(/const starPct = [\s\S]*?;\r?\n/)[0] + "return starPct;")();
ok(starPct("4,9") === "98.0%" && starPct("4.9") === "98.0%", "csillagsor: vesszős és pontos tizedes");
ok(starPct("kiváló") === "0.0%" && starPct("") === "0.0%", "csillagsor: szövegből nem lesz NaN");
ok(starPct("100%") === "100.0%" && starPct("-2") === "0.0%", "csillagsor: öt fölött és nulla alatt is értelmes");

const openState = new Function("DAYS",
  js.match(/function openState\([\s\S]*?\n\}/)[0] + "\nreturn openState;")(
  ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const week = (over = {}) => Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
  .map((d) => [d, { open: "09:00", close: "17:00", closed: d === "sat" || d === "sun", ...over[d] }]));
const mon = (h, m = 0) => new Date(2026, 0, 5, h, m);        /* 2026-01-05 hétfő */
ok(openState(week(), mon(10)).open === true, "nyitvatartás: munkaidőben nyitva");
ok(openState(week(), mon(8, 59)).at === "09:00", "nyitvatartás: nyitás előtt a mai nyitást mondjuk");
ok(openState(week(), mon(17)).open === false, "nyitvatartás: záráskor már zárva");
ok(openState(week(), mon(18)).in === 1, "nyitvatartás: zárás után a holnapi nyitás jön");
ok(openState(week(), new Date(2026, 0, 10, 10)).key === "mon", "nyitvatartás: hétvégén a hétfő a válasz");
ok(openState({}, mon(10)).at === null, "nyitvatartás: adat nélkül nincs mit ígérni");

/* A terv adata és a markup egy irányba mutasson: bekapcsolt nyitvatartáshoz
   kellenek a napok, kártyás árjegyzékhez pedig kép-mezős tételek. */
if (cfg.content?.hoursShow) {
  ok(cfg.content.booking?.hours, "hoursShow be van kapcsolva, de nincs nyitvatartás a site.json-ban");
}
if (cfg.content?.cta2 === "route") {
  ok(String(cfg.content.address || "").trim(), "az útvonal-gombhoz cím kell a site.json-ban");
}
for (const it of cfg.content?.pricing?.items || []) {
  ok(typeof it.name === "string" && typeof it.price === "string", "árjegyzék-tétel név vagy ár nélkül");
}
/* Sötét kiemelés: a lap EGY hangsúlyos táblát bír el – kettő már nem hangsúly. */
ok((cfg.sections || []).filter((s) => s.plate).length <= 1,
  "egynél több szekció van sötét kiemelésre jelölve");

/* --- 12. A TERVEZŐ TELJES KÍNÁLATA lefut-e ezen az oldalon? --------------
   A fenti 3. pont csak azt méri, amit a MOSTANI site.json és a demók
   használnak. Az ügyfél viszont bármelyik stílust és bármelyik tengelyértéket
   választhatja a tervezőben – ha egy értékhez itt nincs szabály vagy betű, a
   kész oldal NÉMÁN másképp néz ki, mint az előnézet, amit az ügyfél jóváhagyott.
   Ez a legdrágább hibafajta a termékben, ezért méri ezt egy külön pont.

   A tervező repója a szomszéd könyvtárban él (ugyanaz a feltevés, mint a
   tools/sync-css.mjs-ben). Ha nincs ott, az ellenőrzés kimarad – a termék
   önmagában is tesztelhető marad. */
const PLAN_SRC = new URL("../dilaweb_sablon/src/", import.meta.url);
let planJs = null, planHtml = null;
try {
  planJs = readFileSync(new URL("app.js", PLAN_SRC), "utf8");
  planHtml = readFileSync(new URL("app.html", PLAN_SRC), "utf8");
} catch { /* a tervező nincs a gépen – lásd a fenti megjegyzést */ }

if (planJs && planHtml) {
  /* a) minden betű, amit egy stílus vagy szakma-sablon hoz magával */
  const planFonts = new Set([...planJs.matchAll(/font(?:Head)?: "(\w+)"/g)].map((m) => m[1]));
  for (const key of planFonts) {
    ok(new RegExp(`^\\s*${key}\\s*:\\s*\\{`, "m").test(js),
      `A tervező a(z) "${key}" betűt kínálja, de a site.js FONTS táblájában nincs – a kész oldal a BASE betűjére esne vissza.`);
  }

  /* b) minden tengelyérték, amit a tervező FELKÍNÁL (nem csak amit a
     stílusok használnak): a szerkesztő kézzel is átállítható */
  for (const key of PV_FLAGS) {
    const sel = planHtml.match(new RegExp(`<select id="${key}">[\\s\\S]*?</select>`))?.[0];
    if (!sel) continue;                     /* nem legördülő tengely (pl. mode) */
    const attr = `data-${kebab(key)}`;
    for (const [, val] of sel.matchAll(/value="([\w-]+)"/g)) {
      ok(css.includes(`[${attr}="${val}"]`) || BASE_VALS[key] === val,
        `A tervező ${key} = "${val}" értéket kínál, de nincs rá szabály a pv.css-ben – futtasd: node tools/sync-css.mjs`);
    }
  }
}
/* --- 13. Mérés: elindul-e, és tiszteli-e a DNT-t? ------------------------
   A backend /api/collect végpontja és az admin Statisztika füle kész, de üres
   marad, ha a lapról nem indul el a beacon. Ezt a hibát semmi más nem fogja
   meg: minden zöld, csak épp nincs adat. */
ok(/^initStats\(\);$/m.test(js), "Az initStats() nincs meghívva – a mérés el se indul.");
const stats = js.slice(js.indexOf("function initStats"));
ok(stats.indexOf("doNotTrack") > -1 && stats.indexOf("doNotTrack") < stats.indexOf("sendBeacon"),
  "A DNT-vizsgálat nem a beacon ELŐTT áll – DNT mellett is mérnénk.");
ok(/kind: "view"/.test(stats) && /kind: "click"/.test(stats),
  "Hiányzik a betöltés- vagy a kattintás-esemény.");
/* A szerver csak ezt a három fajtát fogadja el (StatController: in:view,click,goal) */
for (const [, kind] of stats.matchAll(/kind: "(\w+)"/g)) {
  ok(["view", "click", "goal"].includes(kind), `A szerver nem ismeri ezt az eseményfajtát: ${kind}`);
}

/* --- 14. Cél-események: hozott-e ügyfelet a lap? -------------------------
   A látogatószám az ügyfelet nem érdekli, a megkeresés igen. Ez az egyetlen
   szám, amivel a havidíj megvédhető – ha egy cél kiesik a markupból, a
   konverzió némán nullára esik, és a lap „hatástalannak" látszik. */
const GOALS = ["call", "mail", "route", "prices", "booking-start", "booking-done"];
const wizard = read("booking.js");

for (const g of ["call", "mail", "route"]) {
  ok(index.includes(`data-goal="${g}"`), `Nincs "${g}" cél az index.html-ben.`);
}
ok(/dataset\.goal = "booking-start"/.test(js),
  "A fő gomb nem jelzi a foglalás elindítását – a konverziós tölcsér teteje hiányozna.");
ok(/window\.pvGoal\?\.\("booking-done"\)/.test(wizard),
  "Az elküldött foglalás nem számít célnak – enélkül nincs mit konvertálni.");
ok(/a\[href\$='#sec-prices'\]/.test(js),
  "Az árlistára mutató hivatkozás nem számít célnak.");

/* Minden használt cél-név ismert legyen: elgépelt névhez az admin nem tud
   feliratot, és a sor „booking-dne" néven ülne a riportban. */
const used = new Set([
  ...[...index.matchAll(/data-goal="([\w-]+)"/g)].map((m) => m[1]),
  ...[...js.matchAll(/dataset\.goal = "([\w-]+)"/g)].map((m) => m[1]),
  ...[...wizard.matchAll(/pvGoal\?\.\("([\w-]+)"\)/g)].map((m) => m[1]),
]);
for (const g of used) ok(GOALS.includes(g), `Ismeretlen cél-név: ${g}`);
ok(used.size >= 5, "Kevesebb cél van bekötve, mint amit az admin kirajzol.");

/* A tervező előnézete UGYANEZT a markupot adja – különben az ügyfél mást kap,
   mint amit jóváhagyott, és a mérés az átadás után csendben eltűnik. */
if (planJs && planHtml) {
  for (const g of ["call", "mail", "route"]) {
    ok(planHtml.includes(`data-goal="${g}"`), `A tervező előnézetéből hiányzik a "${g}" cél.`);
  }
  ok(/dataset\.goal = "booking-start"/.test(planJs),
    "A tervező fő gombja nem jelzi a foglalás elindítását.");
}

console.log(`OK – ${checks} ellenőrzés lefutott.`);
