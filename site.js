/* ==========================================================================
   DilaWEB – kész ügyféloldal
   Ugyanaz a markup és ugyanaz a CSS, mint a tervező előnézetében; az adat
   viszont fájlból jön (site.json), nem a szerkesztő állapotából. Az oldal
   szerkesztése = a JSON szerkesztése, kódot hozzányúlni nem kell.

   A foglalási aloldal (foglalas.html) is ezt tölti be: ott csak a design
   (tokenek, betűk, fejléc, lábléc) fut le, a szekciók nem.
   ========================================================================== */
(() => {
"use strict";

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
/* A *csillagok* közötti szó kiemelés-jelölő (sig="emph"). Ahol a kiemelés nem
   értelmes – menü, lábléc, oldalcím, JSON-LD –, ott csak a csillag tűnik el. */
const plain = (s) => String(s ?? "").replace(/\*([^*\n]+)\*/g, "$1");
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/* Betűtípusok: a `s` a CSS stack, a `g` a Google Fonts kérés-szegmense. Csak a
   ténylegesen használt két családot töltjük le – mobilon ez másodperceket ér. */
const FONTS = {
  inter:       { s: '"Inter", system-ui, sans-serif',              g: "Inter:wght@400;500;600;700" },
  sora:        { s: '"Sora", system-ui, sans-serif',               g: "Sora:wght@400;600;700" },
  poppins:     { s: '"Poppins", system-ui, sans-serif',            g: "Poppins:wght@400;500;600;700" },
  montserrat:  { s: '"Montserrat", system-ui, sans-serif',         g: "Montserrat:wght@400;600;700" },
  nunito:      { s: '"Nunito", system-ui, sans-serif',             g: "Nunito:wght@400;600;700" },
  quicksand:   { s: '"Quicksand", system-ui, sans-serif',          g: "Quicksand:wght@500;700" },
  manrope:     { s: '"Manrope", system-ui, sans-serif',            g: "Manrope:wght@400;600;700" },
  dmsans:      { s: '"DM Sans", system-ui, sans-serif',            g: "DM+Sans:wght@400;500;700" },
  rubik:       { s: '"Rubik", system-ui, sans-serif',              g: "Rubik:wght@400;500;700" },
  figtree:     { s: '"Figtree", system-ui, sans-serif',            g: "Figtree:wght@400;600;700" },
  /* A tervező újabb, karakteresebb váltótársai – enélkül a mentés némán a
     BASE betűjére esne vissza. */
  outfit:      { s: '"Outfit", system-ui, sans-serif',              g: "Outfit:wght@400;500;600;700" },
  archivo:     { s: '"Archivo", system-ui, sans-serif',             g: "Archivo:wght@400;500;600;700" },
  playfair:    { s: '"Playfair Display", Georgia, serif',          g: "Playfair+Display:wght@500;700" },
  fraunces:    { s: '"Fraunces", Georgia, serif',                   g: "Fraunces:wght@400;600;700" },
  instrument:  { s: '"Instrument Serif", Georgia, serif',           g: "Instrument+Serif" },
  lora:        { s: '"Lora", Georgia, serif',                      g: "Lora:wght@400;600;700" },
  cormorant:   { s: '"Cormorant Garamond", Georgia, serif',        g: "Cormorant+Garamond:wght@500;700" },
  merriweather:{ s: '"Merriweather", Georgia, serif',              g: "Merriweather:wght@400;700" },
  garamond:    { s: '"EB Garamond", Georgia, serif',               g: "EB+Garamond:wght@400;600;700" },
  baskerville: { s: '"Libre Baskerville", Georgia, serif',         g: "Libre+Baskerville:wght@400;700" },
  oswald:      { s: '"Oswald", Impact, sans-serif',                g: "Oswald:wght@400;600" },
  bebas:       { s: '"Bebas Neue", Impact, sans-serif',            g: "Bebas+Neue" },
  anton:       { s: '"Anton", Impact, sans-serif',                 g: "Anton" },
  abril:       { s: '"Abril Fatface", Georgia, serif',             g: "Abril+Fatface" },
  spacegrotesk:{ s: '"Space Grotesk", system-ui, sans-serif',      g: "Space+Grotesk:wght@400;600;700" },
  syne:        { s: '"Syne", system-ui, sans-serif',                g: "Syne:wght@400;600;700" },
  bricolage:   { s: '"Bricolage Grotesque", system-ui, sans-serif',g: "Bricolage+Grotesque:wght@400;600;700" },
  dancing:     { s: '"Dancing Script", cursive',                   g: "Dancing+Script:wght@600;700" },
  caveat:      { s: '"Caveat", cursive',                           g: "Caveat:wght@500;700" },
  /* Emberi kéz – a tervező kézzel készült stílusaihoz */
  kalam:       { s: '"Kalam", cursive',                            g: "Kalam:wght@400;700" },
  shantell:    { s: '"Shantell Sans", system-ui, sans-serif',      g: "Shantell+Sans:wght@400;600;700" },
  youngserif:  { s: '"Young Serif", Georgia, serif',               g: "Young+Serif" },
  courier:     { s: '"Courier Prime", ui-monospace, monospace',    g: "Courier+Prime:wght@400;700" },
  /* Stílusirányzat-betűk a tervezőből (cyberpunk, graffiti, pixel art,
     viktoriánus): enélkül a mentés némán a BASE betűjére esne vissza. */
  orbitron:    { s: '"Orbitron", system-ui, sans-serif',           g: "Orbitron:wght@400;600;800" },
  bungee:      { s: '"Bungee", Impact, sans-serif',                g: "Bungee" },
  pixelify:    { s: '"Pixelify Sans", ui-monospace, monospace',    g: "Pixelify+Sans:wght@400;600;700" },
  cinzel:      { s: '"Cinzel", Georgia, serif',                    g: "Cinzel:wght@400;600;700" },
  jetbrains:   { s: '"JetBrains Mono", ui-monospace, monospace',   g: "JetBrains+Mono:wght@400;500;700" },
  plexmono:    { s: '"IBM Plex Mono", ui-monospace, monospace',    g: "IBM+Plex+Mono:wght@400;600" },
};

/* A tervező alapértékei: hiányos JSON-nal is működő oldal jön ki */
const BASE = {
  mode: "dark",
  colors: {
    dark:  { primary: "#DE8524", secondary: "#F0B166", bg: "#070B11", text: "#E8EDF5" },
    light: { primary: "#B4650F", secondary: "#DE8524", bg: "#F5F7FA", text: "#0F1720" },
  },
  font: "inter", fontHead: "sora", radius: 16, align: "left",
  layout: "grid", hero: "right", cols: 3, width: 68, spacing: 100, imgRatio: 133,
  /* karakter-tengelyek: a sávozás (band) az erősség, a szekcióhatár (divider) az él */
  typeset: "classic", surface: "soft", texture: "none", reveal: "fade", band: "soft", divider: "none",
  /* lapszerkezet: hol áll a szekciócím, és mi keretezi a lapot */
  secHead: "stack", edge: "none",
  /* lapritmus (pv.css 8.12/c): a szekciók EGYMÁSHOZ való viszonya – ez adja a
     görgetés-élményt, nem a festés. A tervezőben ez az egyik legerősebb tengely. */
  flow: "stack",
  /* háttérminta, mozgása, helye és MÉLYSÉGE – a szakmához tartozik, nem a
     színvilághoz */
  bgArt: "none", bgMotion: "still", bgSpot: "spread", bgDepth: "scroll",
  accent: "none", media: "plain", btn: "solid",
  /* a KÉZJEGY (pv.css 8.12/d): az egyetlen nagy gesztus, amiről a lap
     megjegyezhető – egy lapra egy */
  sig: "none",
  navBg: "blur", navShape: "bar", navAlign: "end", navLink: "plain", navPos: "sticky",
  /* görgetés közbeni fejléc-elemek és kártya-reakció – alapból nincsenek */
  navProgress: "none", navCall: "none", navTop: "none", hover: "none",
  /* betűméret: egy csomag az egész oldalra, mellette blokkonkénti kivételek */
  fontScale: "md", fontScaleBy: {},
  seed: 1,
};

/* Ezek a kulcsok data-* attribútumként kerülnek a gyökérre, a stílusukat a
   pv.css `[data-…="…"]` szabályai adják – ugyanaz a lista, mint a tervezőben.
   A többszavas kulcsokból a dataset kebab-case attribútumot csinál: data-nav-bg… */
const PV_FLAGS = ["mode", "layout", "hero", "secHead", "edge", "flow", "typeset", "surface", "texture",
  "bgDepth", "bgArt", "bgMotion", "bgSpot", "reveal", "band", "divider", "accent", "sig", "media", "btn",
  "hover", "navBg", "navShape", "navAlign", "navLink", "navPos", "navProgress", "navCall", "navTop"];

/* Üres kivétel = nincs attribútum, tehát a globális betűméret öröklődik */
const setFs = (el, v) => { if (el) { if (v) el.dataset.fs = v; else delete el.dataset.fs; } };

const JUST = { left: "flex-start", center: "center", right: "flex-end" };
const SECTION_IDS = ["hero", "rating", "services", "stats", "references", "reviews", "process",
  "about", "gallery", "videos", "team", "logos", "faq", "map", "contact"];
/* A nyitvatartás napjai – ugyanaz a sorrend, mint a foglalásban (hétfővel kezd) */
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/* Elemlistás szekciók – ugyanaz a tábla, mint a tervezőben. Az adat mindegyikben
   név + szöveg + kép (`content.lists.<id>`), csak a megjelenítés más, ezért a
   szekció markupja NINCS az index.html-ben: a renderLists() építi meg. Új típus
   = egy sor ide (mindkét oldalon) + secname/pv.<id>Eyebrow/pv.<id>Title kulcs. */
const LIST_SECS = {
  /* `tags`: kategória-szűrő a lista fölé, `cap`: a név feliratként a képre */
  gallery: { media: true,  body: false, tags: true, cap: true },
  /* Videógaléria: ugyanaz az adatalak, mint a galériáé – a renderer az
     `image` mező kiterjesztéséből dönti el, <img> vagy <video> kell. A
     tervezőben nincs feltöltés, ezért amíg az ügyfél az adminban fel nem tölt
     egy sajátot, `image` üres marad – az `anim` ilyenkor a paintImg()
     tartalékát a videoPlaceholder() 5 hurok-animációjára cseréli a sima
     színfolt helyett (ugyanaz az 5 animáció, mint a tervező előnézetében). */
  videos:  { media: true,  body: false, tags: true, cap: true, anim: true },
  team:    { media: true,  body: true  },
  faq:     { media: false, body: true, open: true },
  /* Értékelés-sáv: a hero utáni első bizalmi jel. A név a pontszám (4,9), a
     szöveg a forrás – a csillagokat a CSS rajzolja (`stars`). */
  rating:  { media: false, body: true, stars: true },
  /* Bizalmi blokkok (pv.css 8.13): ugyanaz a három mező, más megjelenítés.
     `marquee`: a lista kétszer megy ki, az ismétlés adja a varrat nélküli kört. */
  stats:   { media: false, body: true  },
  reviews: { media: true,  body: true, avatar: true },
  process: { media: false, body: true  },
  logos:   { media: true,  body: false, marquee: true },
};
const LIST_IDS = Object.keys(LIST_SECS);

/* Kapcsolós modulok. NEM a szekciólistából jönnek: saját kapcsolójuk van a
   JSON-ban, és egy beépített szekció MÖGÉ fűződnek (`after`). Új modul
   (galéria, blog, webshop) = egy sor ide + <section data-sec="…"> az
   index.html-ben + a saját címkulcsa. Ugyanez a lista van a tervezőben.
   `nav`: a menüpont szótárkulcsa – null, ha külön gomb visz rá (a foglalásra a
   fejléc kiemelt gombja mutat, sima menüpontként kétszer állna ugyanaz a link). */
const EXTRAS = [
  { id: "pricing", after: "services", nav: "pv.pricingTitle",
    on: (c) => !!c.pricing?.enabled && !!c.pricing.items?.length },
  { id: "booking", after: "services", nav: null,
    on: (c) => !!c.booking?.enabled },
];
/* Az `after` csak ALAPÉRTELMEZÉS: a modul helyét a terv felülírhatja
   (`moduleAfter`), mert a konverziós sorrend szakmánként más – a pékségnél az
   árjegyzék a fotófal mögé kerül, a szerviznél a szolgáltatások mögé. */
const modAfter = (x) => {
  const v = CFG?.moduleAfter?.[x.id];
  return SECTION_IDS.includes(v) ? v : x.after;
};
/* A sorrend lépcsője: egy listaelem + a mögé fűzhető összes modul. A CSS `order`
   egész, ezért kell a lépcső – új modultól magától nő, nincs beégetett szám. */
const SEC_STEP = EXTRAS.length + 1;

/* Mikor értelmetlen egy szekció tartalom nélkül: bekapcsolva sem jelenik meg.
   Új feltételes szekció = egy sor, nem újabb ág az applyContent()-ben. */
const SEC_EMPTY = {
  map: (c) => !String(c.address || "").trim(),
  references: (c) => !c.references?.length,
  /* az elemlistás szekciók üresen sem címet, sem kártyát nem adnának */
  ...Object.fromEntries(LIST_IDS.map((id) => [id, (c) => !c.lists?.[id]?.length])),
};

/* Az oldal állandó feliratai. Bármelyik felülírható a JSON-ban
   (content.texts), így az ügyfél saját szövegei nem igényelnek kódírást. */
const I18N = {
  hu: {
    "pv.cta": "Ajánlatot kérek",
    "pv.ctaBook": "Időpontot foglalok",
    "pv.ctaRoute": "Útvonaltervezés",
    "pv.menu": "Menü",
    "pv.filterAll": "Mind",
    "a11y.filter": "Szűrés kategóriára",
    "pv.hoursTitle": "Nyitvatartás",
    "pv.openNow": "Most nyitva",
    "pv.closedNow": "Most zárva",
    "pv.until": "eddig:",
    "pv.today": "ma",
    "pv.tomorrow": "holnap",
    "pv.closedDay": "Zárva",
    "pv.servicesEyebrow": "Amit kínálunk",
    "pv.servicesTitle": "Szolgáltatásaink",
    "pv.servicesLead": "Rövid blokkok arról, amiben a legjobbak vagyunk.",
    "pv.item1": "Első szolgáltatás",
    "pv.item1text": "Néhány mondat arról, mit kap az ügyfél, és miért éri meg.",
    "pv.item2": "Második szolgáltatás",
    "pv.item2text": "Néhány mondat arról, mit kap az ügyfél, és miért éri meg.",
    "pv.item3": "Harmadik szolgáltatás",
    "pv.item3text": "Néhány mondat arról, mit kap az ügyfél, és miért éri meg.",
    "pv.item4": "Negyedik szolgáltatás",
    "pv.item4text": "Néhány mondat arról, mit kap az ügyfél, és miért éri meg.",
    "pv.pricingEyebrow": "Áraink",
    "pv.pricingTitle": "Árjegyzék",
    "pv.bookingEyebrow": "Időpontfoglalás",
    "pv.bookingTitle": "Foglaljon időpontot",
    "pv.refEyebrow": "Munkáink",
    "pv.refTitle": "Referenciák",
    "pv.aboutEyebrow": "Rólunk",
    "pv.aboutTitle": "Néhány szó rólunk",
    "pv.mapEyebrow": "Hol találsz minket",
    "pv.mapTitle": "Itt vagyunk",
    "pv.mapLink": "Megnyitás a Google Térképen",
    "pv.contactEyebrow": "Kapcsolat",
    "pv.contactTitle": "Keress minket bizalommal",
    "pv.lblAddress": "Elhelyezkedés",
    "pv.lblPhone": "Telefon",
    "pv.lblEmail": "E-mail",
    "pv.rights": "Minden jog fenntartva.",
    "pv.privacy": "Adatkezelési tájékoztató",
    "pv.imprint": "Impresszum",
    "sec.services": "Szolgáltatások",
    "sec.references": "Referenciák",
    "sec.about": "Rólunk",
    "sec.gallery": "Galéria",
    "sec.videos": "Videók",
    "sec.team": "Csapat",
    "sec.faq": "Gyakori kérdések",
    "sec.stats": "Számokban",
    "sec.reviews": "Vélemények",
    "sec.process": "Így dolgozunk",
    "sec.logos": "Partnerek",
    "sec.rating": "Értékelés",
    "pv.ratingEyebrow": "Amit a vendégek mondanak",
    "pv.ratingTitle": "Értékelésünk",
    "pv.galleryEyebrow": "Képek",
    "pv.galleryTitle": "Galéria",
    "pv.videosEyebrow": "Mozgóképen",
    "pv.videosTitle": "Videók",
    "pv.teamEyebrow": "Akik dolgoznak rajta",
    "pv.teamTitle": "A csapat",
    "pv.faqEyebrow": "Kérdezted",
    "pv.faqTitle": "Gyakori kérdések",
    "pv.statsEyebrow": "Számokban",
    "pv.statsTitle": "Amit eddig letettünk az asztalra",
    "pv.reviewsEyebrow": "Ügyfeleink mondták",
    "pv.reviewsTitle": "Vélemények",
    "pv.processEyebrow": "Lépésről lépésre",
    "pv.processTitle": "Így dolgozunk együtt",
    "pv.logosEyebrow": "Akikkel dolgoztunk",
    "pv.logosTitle": "Partnereink",
    "sec.map": "Térkép",
    "sec.contact": "Kapcsolat",
    "a11y.pvTop": "Vissza az oldal tetejére",
    "a11y.pvCall": "Hívás",
  },
  en: {
    "pv.cta": "Get a quote",
    "pv.ctaBook": "Book an appointment",
    "pv.ctaRoute": "Get directions",
    "pv.menu": "Menu",
    "pv.filterAll": "All",
    "a11y.filter": "Filter by category",
    "pv.hoursTitle": "Opening hours",
    "pv.openNow": "Open now",
    "pv.closedNow": "Closed now",
    "pv.until": "until",
    "pv.today": "today",
    "pv.tomorrow": "tomorrow",
    "pv.closedDay": "Closed",
    "pv.servicesEyebrow": "What we offer",
    "pv.servicesTitle": "Our services",
    "pv.servicesLead": "Short blocks about what we do best.",
    "pv.item1": "First service",
    "pv.item1text": "A few sentences about what the client gets and why it is worth it.",
    "pv.item2": "Second service",
    "pv.item2text": "A few sentences about what the client gets and why it is worth it.",
    "pv.item3": "Third service",
    "pv.item3text": "A few sentences about what the client gets and why it is worth it.",
    "pv.item4": "Fourth service",
    "pv.item4text": "A few sentences about what the client gets and why it is worth it.",
    "pv.pricingEyebrow": "Our prices",
    "pv.pricingTitle": "Price list",
    "pv.bookingEyebrow": "Online booking",
    "pv.bookingTitle": "Book an appointment",
    "pv.refEyebrow": "Our work",
    "pv.refTitle": "References",
    "pv.aboutEyebrow": "About us",
    "pv.aboutTitle": "A few words about us",
    "pv.mapEyebrow": "Where to find us",
    "pv.mapTitle": "Here we are",
    "pv.mapLink": "Open in Google Maps",
    "pv.contactEyebrow": "Contact",
    "pv.contactTitle": "Get in touch with us",
    "pv.lblAddress": "Location",
    "pv.lblPhone": "Phone",
    "pv.lblEmail": "Email",
    "pv.rights": "All rights reserved.",
    "pv.privacy": "Privacy notice",
    "pv.imprint": "Legal notice",
    "sec.services": "Services",
    "sec.references": "References",
    "sec.about": "About",
    "sec.gallery": "Gallery",
    "sec.videos": "Videos",
    "sec.team": "Team",
    "sec.faq": "FAQ",
    "sec.stats": "In numbers",
    "sec.reviews": "Reviews",
    "sec.process": "How we work",
    "sec.logos": "Partners",
    "sec.rating": "Rating",
    "pv.ratingEyebrow": "What guests say",
    "pv.ratingTitle": "Our rating",
    "pv.galleryEyebrow": "Pictures",
    "pv.galleryTitle": "Gallery",
    "pv.videosEyebrow": "On video",
    "pv.videosTitle": "Videos",
    "pv.teamEyebrow": "The people behind it",
    "pv.teamTitle": "Our team",
    "pv.faqEyebrow": "You asked",
    "pv.faqTitle": "Frequently asked questions",
    "pv.statsEyebrow": "In numbers",
    "pv.statsTitle": "What we have delivered so far",
    "pv.reviewsEyebrow": "Our clients said",
    "pv.reviewsTitle": "Reviews",
    "pv.processEyebrow": "Step by step",
    "pv.processTitle": "How we work together",
    "pv.logosEyebrow": "Who we worked with",
    "pv.logosTitle": "Our partners",
    "sec.map": "Map",
    "sec.contact": "Contact",
    "a11y.pvTop": "Back to top",
    "a11y.pvCall": "Call",
  },
};

/* PAGE: melyik ALOLDALT nézzük. A generált aloldal HTML-jén ott a
   `<html data-page="blog">` jelölés (tools/build-pages.mjs írja bele), és a
   site.json `pages[]` tömbjéből ez a bejegyzés adja a szekciólistát és a
   böngészőcímet. A főoldalon PAGE = null: minden marad a régiben. */
let LANG = "hu", TEXTS = {}, CFG = null, DESIGN = BASE, MODE = BASE.mode, PAGE = null;
const t = (key) => TEXTS[key] ?? I18N[LANG][key] ?? I18N.hu[key] ?? key;

/* --------------------------------------------------------------------------
   Színek és képek
   -------------------------------------------------------------------------- */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/* A gombfelirat színe: a jobban olvasható jelölt nyer (nem küszöb, hanem verseny) */
const inkOn = (hex) => (contrast(hex, "#10141A") >= contrast(hex, "#FFFFFF") ? "#10141A" : "#FFFFFF");

/* A JSON-ban a feltöltött kép csak FÁJLNÉV – az az images/ mappában van.
   URL, adat-URI és útvonal viszont marad, ahogy le lett írva. */
const imgSrc = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return /^(https?:|data:|\/|\.)/.test(s) ? s : "images/" + s;
};

/* Videó vagy kép? A KITERJESZTÉS dönt: az elem ugyanabba az `image` mezőbe
   kapja a fájlnevet, akármelyikről van szó. */
const isVideo = (v) => /\.(mp4|webm)(\?|#|$)/i.test(String(v ?? ""));

/* Generált helykitöltő: hiányzó képnél sem esik szét az elrendezés */
function placeholder(i) {
  const h1 = (DESIGN.seed * 47 + i * 63) % 360;
  const h2 = (h1 + 35 + (DESIGN.seed % 60)) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="hsl(${h1} 58% 64%)"/>` +
        `<stop offset="1" stop-color="hsl(${h2} 62% 34%)"/></linearGradient>` +
        `<radialGradient id="r"><stop offset="0" stop-color="#fff" stop-opacity=".5"/>` +
        `<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="800" height="600" fill="url(#g)"/>` +
      `<circle cx="580" cy="170" r="250" fill="url(#r)"/>` +
      `<circle cx="150" cy="480" r="180" fill="url(#r)" opacity=".55"/>` +
    `</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/* Videó-helykitöltők: 5 kész, hurokban futó, vonalas animáció – UGYANAZ az 5
   jelenet, amit a tervező előnézete is használ (dilaweb_sablon/src/app.js,
   VIDEO_SCENES), hogy a jóváhagyott terv és az élő oldal ne térjen el. Amíg az
   ügyfél nem tölt fel saját videót az adminban, ezek egyike pörög a helyén –
   sorszám szerint körbeforgatva. Mindegyik SAJÁT helyben hurkol (nincs
   kilépő/belépő mozgás), hogy 0% és 100% között ne legyen ugrás. */
const VIDEO_SCENES = [
  /* Méhecske: zárt ellipszispályán repked, a szárnya külön, gyorsan verdes. */
  () => ({
    style: `
      .va-fly{animation:va-beefly 3.6s linear infinite}
      @keyframes va-beefly{
        0%{transform:translate(90px,-10px) rotate(0deg)}
        16.6%{transform:translate(45px,11.65px) rotate(10deg)}
        33.3%{transform:translate(-45px,11.65px) rotate(10deg)}
        50%{transform:translate(-90px,-10px) rotate(0deg)}
        66.6%{transform:translate(-45px,-31.65px) rotate(-10deg)}
        83.3%{transform:translate(45px,-31.65px) rotate(-10deg)}
        100%{transform:translate(90px,-10px) rotate(0deg)}
      }
      .va-wing{animation:va-flap .14s ease-in-out infinite}
      @keyframes va-flap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.25)}}`,
    art: `<g class="va-fly">
        <ellipse cx="0" cy="0" rx="34" ry="22"/>
        <path d="M-14 -14 L-14 14 M0 -18 L0 18 M14 -14 L14 14" stroke-width="6"/>
        <circle cx="-32" cy="-2" r="11"/>
        <path d="M-40 -10 Q-48 -24 -42 -30 M-32 -12 Q-36 -26 -28 -30"/>
        <g transform="translate(-8,-26)"><g class="va-wing"><ellipse cx="0" cy="0" rx="18" ry="9"/></g></g>
        <g transform="translate(8,-26)"><g class="va-wing"><ellipse cx="0" cy="0" rx="18" ry="9"/></g></g>
      </g>`,
  }),
  /* Sétáló ember: helyben lép, a lábak/karok ellenfázisban lendülnek, a törzs
     minden lépésnél kicsit bekoccan. */
  () => ({
    style: `
      .va-legR,.va-armL{animation:va-swingA 1s ease-in-out infinite}
      .va-legL,.va-armR{animation:va-swingB 1s ease-in-out infinite}
      @keyframes va-swingA{0%,100%{transform:rotate(-26deg)}50%{transform:rotate(26deg)}}
      @keyframes va-swingB{0%,100%{transform:rotate(26deg)}50%{transform:rotate(-26deg)}}
      .va-bob{animation:va-bob .5s ease-in-out infinite}
      @keyframes va-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}`,
    art: `<g class="va-bob">
        <circle cx="0" cy="-86" r="16"/>
        <path d="M0 -70 L0 -18" stroke-width="7"/>
        <g transform="translate(0,-64)"><g class="va-armR"><path d="M0 0 L0 34"/></g></g>
        <g transform="translate(0,-64)"><g class="va-armL"><path d="M0 0 L0 34"/></g></g>
        <g transform="translate(0,-18)"><g class="va-legR"><path d="M0 0 L0 42" stroke-width="7"/></g></g>
        <g transform="translate(0,-18)"><g class="va-legL"><path d="M0 0 L0 42" stroke-width="7"/></g></g>
      </g>`,
  }),
  /* Kerékpáros: mindkét kerék és a pedál/hajtókar körbeforog, a testtartás
     enyhén biccen a tekeréssel. */
  () => ({
    style: `
      .va-spin{animation:va-spin 1s linear infinite}
      .va-crank{animation:va-spin .9s linear infinite}
      @keyframes va-spin{to{transform:rotate(360deg)}}
      .va-rbob{animation:va-rbob .45s ease-in-out infinite alternate}
      @keyframes va-rbob{from{transform:translateY(0)}to{transform:translateY(-4px)}}`,
    art: `
      <g transform="translate(-90,60)"><circle r="46"/><g class="va-spin"><path d="M-46 0 L46 0 M0 -46 L0 46 M-32 -32 L32 32 M-32 32 L32 -32"/></g></g>
      <g transform="translate(90,60)"><circle r="46"/><g class="va-spin"><path d="M-46 0 L46 0 M0 -46 L0 46 M-32 -32 L32 32 M-32 32 L32 -32"/></g></g>
      <path d="M-90 60 L-10 -10 L40 60 M-10 -10 L20 -60 M-10 -10 L-40 -50 M40 60 L90 60 M20 -60 L60 -60 M-40 -55 L-55 -55 M60 -60 L75 -70"/>
      <g transform="translate(-10,60)"><g class="va-crank"><circle r="6"/><path d="M0 0 L26 0"/><circle cx="26" cy="0" r="6"/></g></g>
      <g class="va-rbob"><circle cx="30" cy="-95" r="14"/><path d="M20 -60 L30 -82 L60 -60" stroke-width="7"/></g>`,
  }),
  /* Szaladó kutya: átlós ügetés (átellenes lábpár együtt lép), a farka
     csóvál, a törzse minden lépésnél biccen. */
  () => ({
    style: `
      .va-dogA{animation:va-dogA .55s ease-in-out infinite}
      .va-dogB{animation:va-dogB .55s ease-in-out infinite}
      @keyframes va-dogA{0%,100%{transform:rotate(-30deg)}50%{transform:rotate(30deg)}}
      @keyframes va-dogB{0%,100%{transform:rotate(30deg)}50%{transform:rotate(-30deg)}}
      .va-tail{animation:va-tail .3s ease-in-out infinite alternate}
      @keyframes va-tail{from{transform:rotate(-10deg)}to{transform:rotate(14deg)}}
      .va-dbob{animation:va-dbob .275s ease-in-out infinite}
      @keyframes va-dbob{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}`,
    art: `<g class="va-dbob">
        <ellipse cx="0" cy="0" rx="70" ry="26"/>
        <circle cx="82" cy="-14" r="20"/>
        <path d="M76 -30 L64 -46 M92 -30 L98 -44"/>
        <g transform="translate(96,-10)"><g class="va-tail"><path d="M0 0 Q26 -18 40 -4"/></g></g>
        <g transform="translate(48,20)"><g class="va-dogA"><path d="M0 0 L0 34"/></g></g>
        <g transform="translate(-48,20)"><g class="va-dogB"><path d="M0 0 L0 34"/></g></g>
        <g transform="translate(48,20)"><g class="va-dogB"><path d="M0 0 L0 34"/></g></g>
        <g transform="translate(-48,20)"><g class="va-dogA"><path d="M0 0 L0 34"/></g></g>
      </g>`,
  }),
  /* Repülő madár: lapos ellipszispályán siklik, a két szárnya együtt verdes. */
  () => ({
    style: `
      .va-bfly{animation:va-bfly 4.4s linear infinite}
      @keyframes va-bfly{
        0%{transform:translate(110px,-6px) rotate(0deg)}
        16.6%{transform:translate(55px,9.6px) rotate(7deg)}
        33.3%{transform:translate(-55px,9.6px) rotate(7deg)}
        50%{transform:translate(-110px,-6px) rotate(0deg)}
        66.6%{transform:translate(-55px,-21.6px) rotate(-7deg)}
        83.3%{transform:translate(55px,-21.6px) rotate(-7deg)}
        100%{transform:translate(110px,-6px) rotate(0deg)}
      }
      .va-wingb{animation:va-wingb .5s ease-in-out infinite}
      @keyframes va-wingb{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-40deg)}}`,
    art: `<g class="va-bfly">
        <ellipse cx="0" cy="0" rx="26" ry="14"/>
        <circle cx="26" cy="-6" r="9"/>
        <path d="M33 -10 L44 -8"/>
        <path d="M-30 6 Q-40 14 -46 10"/>
        <g transform="translate(-4,-4)"><g class="va-wingb"><path d="M0 0 Q-30 -34 -54 -20"/></g></g>
        <g transform="translate(-4,4)"><g class="va-wingb"><path d="M0 0 Q-30 34 -54 20"/></g></g>
      </g>`,
  }),
];

/* A háttér ugyanaz a színátmenet, mint a sima helykitöltőnél (placeholder) –
   csak a tetejére kerül a mozgó vonalrajz, fehérrel, hogy a tetszőleges
   árnyalatú alapon is olvasható maradjon. */
function videoPlaceholder(i) {
  const h1 = (DESIGN.seed * 47 + i * 63) % 360;
  const h2 = (h1 + 35 + (DESIGN.seed % 60)) % 360;
  const scene = VIDEO_SCENES[i % VIDEO_SCENES.length]();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="hsl(${h1} 58% 64%)"/>` +
        `<stop offset="1" stop-color="hsl(${h2} 62% 34%)"/></linearGradient></defs>` +
      `<rect width="800" height="600" fill="url(#g)"/>` +
      /* prefers-reduced-motion: a mozgás kikapcsolása kötelező, nem ízlés kérdése */
      `<style>@media (prefers-reduced-motion: reduce){*{animation:none!important}}${scene.style}</style>` +
      `<g transform="translate(400 300)" fill="none" stroke="#fff" stroke-width="9"` +
      ` stroke-linecap="round" stroke-linejoin="round" opacity=".92">${scene.art}</g>` +
    `</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/* Monogram: logó helyett, amíg nincs feltöltött logó – és arckép helyett a
   véleményeknél. A `name` a kiírandó név (üresen a cégnév), az `i` a paletta
   három színe közül választ, hogy három vélemény ne ugyanazt az avatart kapja. */
function monogram(name, i = 0) {
  const c = DESIGN.colors[MODE];
  const bg = [c.primary, c.secondary, c.text][i % 3];
  const initials = (name || CFG?.content?.company || "AB").trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase() || "AB";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" rx="${clamp(DESIGN.radius, 0, 32)}" fill="${bg}"/>` +
      `<text x="32" y="32" fill="${inkOn(bg)}" font-family="Sora, Segoe UI, sans-serif"` +
      ` font-size="26" font-weight="700" text-anchor="middle" dominant-baseline="central">${esc(initials)}</text>` +
    `</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/* Képfókusz: melyik része maradjon a képnek, ha a keret levágja (a rácsban és a
   heróban a kép mindig vágódik). Az üres érték a CSS alapértelmezése. */
const FOCUS = {
  center: "",
  top:    "50% 12%",
  bottom: "50% 88%",
  left:   "18% 50%",
  right:  "82% 50%",
};

function paintImg(img, src, i, alt = "", fb) {
  const fallback = fb || placeholder(i);
  img.onerror = () => { if (img.src !== fallback) img.src = fallback; };
  img.src = imgSrc(src) || fallback;
  img.alt = alt;
}

/* --------------------------------------------------------------------------
   Design: tokenek, kapcsolók, betűk, mód
   -------------------------------------------------------------------------- */
function applyDesign() {
  const pv = document.body;
  const c = DESIGN.colors[MODE] || BASE.colors[MODE];
  const tokens = {
    "--pv-primary": c.primary,
    "--pv-secondary": c.secondary,
    "--pv-bg": c.bg,
    "--pv-text": c.text,
    "--pv-on-primary": inkOn(c.primary),
    /* fordított sáv (pv.css 8.10): a lap tintája lesz a háttér, rá a hozzá
       illő olvasható szín – a kontrasztot nem a szemre bízzuk */
    "--pv-inv-bg": c.text,
    "--pv-inv-text": inkOn(c.text),
    "--pv-radius": DESIGN.radius + "px",
    "--pv-align": DESIGN.align,
    "--pv-just": JUST[DESIGN.align],
    "--pv-items": JUST[DESIGN.align],
    "--pv-font": (FONTS[DESIGN.font] || FONTS[BASE.font]).s,
    "--pv-font-head": (FONTS[DESIGN.fontHead] || FONTS[BASE.fontHead]).s,
    /* a mozaikhoz legalább 2 oszlop kell, különben a kiemelt elem kilóg */
    "--pv-cols": DESIGN.layout === "mosaic" ? Math.max(2, DESIGN.cols) : DESIGN.cols,
    "--pv-max": DESIGN.width >= 100 ? "none" : DESIGN.width + "rem",
    "--pv-space": DESIGN.spacing / 100,
    "--pv-ratio": DESIGN.imgRatio / 100,
  };
  for (const [k, v] of Object.entries(tokens)) pv.style.setProperty(k, v);
  PV_FLAGS.forEach((k) => (pv.dataset[k] = k === "mode" ? MODE : DESIGN[k]));

  /* Betűméret: a csomag a lap gyökerére, a kivételek a saját blokkjukra. A
     --pv-fs onnan öröklődik lefelé, ezért egyetlen attribútum elég. A
     szekciónkénti kivételeket az applyContent teszi ki – ott van meg minden
     szekció (a generált listásak is). */
  setFs(pv, DESIGN.fontScale);
  setFs($(".pv-header"), DESIGN.fontScaleBy?.nav);
  setFs($(".pv-footer"), DESIGN.fontScaleBy?.footer);

  /* a böngésző saját felületei (görgetősáv, űrlapmezők) is kövessék a módot */
  document.documentElement.style.colorScheme = MODE;
  $('meta[name="theme-color"]')?.setAttribute("content", c.bg);
}

/* Csak a használt családok – egy kérés, nem huszonöt. A kézírás-betű
   (pv.css --pv-font-hand) csak akkor jön, ha a széljegyzet vagy az aláírás kéri. */
function loadFonts() {
  const hand = DESIGN.accent === "note" || DESIGN.sig === "signature";
  const fams = [...new Set([DESIGN.fontHead, DESIGN.font, hand && "caveat"])]
    .map((k) => FONTS[k]?.g).filter(Boolean);
  if (!fams.length) return;
  document.head.append(Object.assign(document.createElement("link"), {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?" + fams.map((f) => "family=" + f).join("&") + "&display=swap",
  }));
}

const MODE_KEY = "dilaweb:mode";
/* „4,9" → „98.0%": a csillagsor kitöltése (pv.css 8.13). Az ügyfél szabad
   szöveget ír a mezőbe, ezért a szemét és az ötnél nagyobb szám is értelmes
   végeredményt ad – öt csillagnál több nincs. */
const starPct = (v) =>
  (Math.max(0, Math.min(5, parseFloat(String(v).replace(",", ".")) || 0)) * 20).toFixed(1) + "%";

/* Kategória-szűrő csipeszek. Ugyanaz a gépezet a galérián és az árjegyzéken: a
   csipeszek a tételek `tag` mezőiből épülnek, kettőnél kevesebb kategóriánál
   nincs mit szűrni. A szűrést a kattintás intézi (a nem illő elem `hidden`
   lesz), nem CSS – így nem kell szabály minden kategórianévhez. */
function chipRow(items) {
  const tags = [...new Set((items || []).map((it) => String(it.tag || "").trim()).filter(Boolean))];
  if (tags.length < 2) return "";
  const chip = (val, label, on) =>
    `<button type="button" class="pv-chip${on ? " is-on" : ""}" data-tag="${esc(val)}" aria-pressed="${on}">${esc(label)}</button>`;
  return `<div class="pv-chips" role="group" aria-label="${esc(t("a11y.filter"))}">`
    + chip("", t("pv.filterAll"), true) + tags.map((tg) => chip(tg, tg, false)).join("") + `</div>`;
}

/* Nyitva-e MOST. A látogató órája dönt, és ez VALÓS állapot – ezért kaphat
   pöttyöt a hero fölött. Zárva a következő nyitást mondjuk meg: a látogató
   kérdése nem az, hogy zárva van-e, hanem hogy mikor mehet.
     { open, at: "18:00" | null, in: hány nap múlva, key: a nap kulcsa } */
function openState(hours, now = new Date()) {
  const today = (now.getDay() + 6) % 7;        /* hétfő = 0, mint a DAYS-ben */
  const hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  const dayAt = (n) => hours?.[DAYS[(today + n) % 7]] || { closed: true };
  const h = dayAt(0);
  if (!h.closed && hhmm >= h.open && hhmm < h.close) return { open: true, at: h.close, in: 0, key: DAYS[today] };
  if (!h.closed && hhmm < h.open) return { open: false, at: h.open, in: 0, key: DAYS[today] };
  for (let n = 1; n <= 7; n++) {
    if (!dayAt(n).closed) return { open: false, at: dayAt(n).open, in: n, key: DAYS[(today + n) % 7] };
  }
  return { open: false, at: null, in: 0, key: DAYS[today] };   /* minden nap zárva */
}
const dayName = (key) => new Intl.DateTimeFormat(LANG, { weekday: "long", timeZone: "UTC" })
  .format(Date.UTC(2024, 0, 1 + DAYS.indexOf(key), 12));

function setMode(next) {
  MODE = next;
  try { localStorage.setItem(MODE_KEY, next); } catch {}
  applyDesign();
  const logo = $("#pv-logo");
  if (logo && !CFG.content.logo) logo.src = monogram();
  /* A monogram-avatarok is a mód palettájából készülnek: a logóval egy körben
     újra kell festeni őket, különben a váltás után a régi módé marad rajtuk. */
  for (const [id, cfg] of Object.entries(LIST_SECS)) {
    if (!cfg.avatar) continue;
    const items = CFG.content?.lists?.[id] || [];
    $$(`[data-sec="${id}"] .pv-item__media img`).forEach((img, i) => {
      const it = items[i % items.length];
      if (it && !it.image) img.src = monogram(it.name, i % items.length);
    });
  }
}

/* --------------------------------------------------------------------------
   Tartalom
   -------------------------------------------------------------------------- */
const secName = (sec) =>
  (sec.custom ? sec.label : t("sec." + sec.id)) || "";

function buildNav(sections, c) {
  const nav = [];
  /* Aloldalon a szekció-horgonyok a főoldalra mutatnak – ott vannak a szekciók */
  const home = PAGE ? "index.html" : "";
  sections.forEach((sec) => {
    const el = $(`[data-sec="${sec.id}"]`);
    const shown = el ? !el.hidden : sec.on && !!secName(sec).trim();
    /* a menü-kapcsoló külön áll a szekció kapcsolójától: a blokk maradhat a
       lapon úgy is, hogy a menüből kikerül (`nav: false`) */
    if (shown && sec.id !== "hero" && sec.nav !== false) {
      nav.push({ href: sec.href || (el ? home + "#sec-" + sec.id : ""), label: secName(sec), sub: sec.sub || [] });
    }
    /* a modul menüpontja a horgony-szekciója mögé kerül */
    EXTRAS.forEach((x) => {
      if (x.after === sec.id && x.nav && x.on(c)) nav.push({ href: home + "#sec-" + x.id, label: t(x.nav), sub: [] });
    });
  });

  $("#pv-nav").innerHTML = nav.map((n) => {
    /* Almenü: sztring = csak felirat, {label, href} = link egy aloldalra */
    const sub = (n.sub || []).map((x) => (typeof x === "string" ? { label: x } : x))
      .filter((x) => String(x.label || "").trim());
    const chev = sub.length ? `<span class="pv-nav__chev" aria-hidden="true">▾</span>` : "";
    const top = n.href
      ? `<a class="pv-nav__top" href="${esc(n.href)}">${esc(n.label)}${chev}</a>`
      : `<span class="pv-nav__top">${esc(n.label)}${chev}</span>`;
    return `<div class="pv-nav__item">${top}` +
      (sub.length ? `<ul class="pv-nav__sub">${sub.map((x) => `<li>` +
        (x.href ? `<a href="${esc(x.href)}">${esc(x.label)}</a>` : esc(x.label)) + `</li>`).join("")}</ul>` : "") +
      `</div>`;
  }).join("");
  /* üres menühöz nem kell nyitógomb */
  const burger = $("#pv-burger");
  if (burger) burger.hidden = !nav.length;
  /* az újraírt menüben is látsszon, hol jár a látogató (a figyelő az initEvents-ben) */
  dispatchEvent(new Event("scroll"));
}

/* Elemlistás szekciók markupja. Az index.html-ben NINCSENEK benne – itt épülnek
   meg a LIST_SECS táblából, ugyanazzal a burokkal, mint a többi szekció, hogy a
   sorrendezés, a menü és a sávozás közös kódúton menjen. */
function renderLists(c) {
  for (const id of LIST_IDS) {
    const cfg = LIST_SECS[id], items = c.lists?.[id] || [];
    let el = $(`[data-sec="${id}"]`);
    if (!el) {
      el = document.createElement("section");
      el.id = "sec-" + id;
      el.className = "pv-section pv-list pv-list--" + id;
      el.dataset.sec = id;
      /* alapból rejtve: a szekciólista kapcsolja be – ami nincs benne, ne
         jelenjen meg üres fejléccel */
      el.hidden = true;
      $("#pv-main").append(el);
    }
    /* Csillagsor a névből: „4,9" → 98% kitöltés. A pontszám és a forrás
       szövegként is ott van alatta, ezért a sáv maga aria-hidden. */
    const stars = (it) => cfg.stars
      ? `<span class="pv-stars" style="--v:${starPct(it.name)}" aria-hidden="true"></span>` : "";
    const body = (it) => cfg.body
      ? `<div class="pv-item__body">${stars(it)}<h3>${esc(it.name)}</h3>${it.text ? `<p>${esc(it.text)}</p>` : ""}</div>` : "";
    /* Galéria: a név felirat is, nem csak alt – a képre írva mondja el, mi
       látszik rajta. Ahol felirat van, ott az alt üres: ne hangozzon el kétszer. */
    const cap = (it) => (cfg.cap && String(it.name || "").trim()
      ? `<figcaption class="pv-item__cap">${esc(it.name)}</figcaption>` : "");
    /* Videónál a forrás rögtön a markupba megy – nincs helykitöltő tartalék,
       ott a fekete keret az elfogadható üres állapot. `muted` + `playsinline`
       nélkül iOS-en el sem indul; `autoplay` SZÁNDÉKOSAN nincs: harminc videó
       egyszerre megenné a látogató adatforgalmát és az akkumulátorát. */
    const media = (it) => (isVideo(it.image)
      ? `<video src="${esc(imgSrc(it.image))}" controls muted loop playsinline preload="metadata"
          width="800" height="600"></video>`
      : `<img alt="" width="800" height="600" loading="lazy">`);
    /* Szalagnál (partnerlogók) a lista kétszer megy ki: az ismétlés adja a
       varrat nélküli kört. A másolat `aria-hidden`, hogy a felolvasó ne mondja
       el minden partnert kétszer. */
    const cards = (html) => cfg.marquee
      ? html + html.replaceAll(`<li class="pv-item"`, `<li class="pv-item" aria-hidden="true"`) : html;
    el.innerHTML = `
      <div class="pv-wrap">
        <header class="pv-head">
          <p class="pv-eyebrow"><span class="pv-dot" aria-hidden="true"></span><span>${esc(t("pv." + id + "Eyebrow"))}</span></p>
          <h2>${esc(t("pv." + id + "Title"))}</h2>
        </header>
        ${cfg.tags ? chipRow(items) : ""}
        ${cfg.open
          /* nyíló kérdés-válasz: natív <details>, nincs mögötte JavaScript */
          ? `<div class="pv-faqs">` + items.map((it) => `
              <details class="pv-faq"><summary>${esc(it.name)}</summary><p>${esc(it.text)}</p></details>`).join("") + `</div>`
          : `<ul class="pv-items">` + cards(items.map((it) => `
              <li class="pv-item"${cfg.tags && it.tag ? ` data-cat="${esc(it.tag)}"` : ""}>
                ${cfg.media ? `<figure class="pv-item__media">${media(it)}${cap(it)}</figure>` : ""}
                ${body(it)}
              </li>`).join("")) + `</ul>`}
      </div>`;
    /* Az ELEMRE iterálunk, nem a képekre: videós elemnél nincs <img>, tehát a
       képek sorszáma elcsúszna az elemekétől. A szalagnál a lista kétszer
       szerepel, ezért fut körbe az index. */
    $$(".pv-item", el).forEach((li, i) => {
      const img = $("img", li);
      if (!img) return;                          /* videónál a src a markupban van */
      const j = i % items.length;
      /* ahol felirat kerül a képre (galéria), ott üres az alt – a felolvasó
         különben kétszer mondaná el ugyanazt */
      paintImg(img, items[j].image, j, cfg.cap ? "" : items[j].alt || items[j].name || "",
        /* arcképes listánál a név monogramja, videónál a hurok-animáció a
           tartalék – egyik sem az absztrakt színfolt */
        cfg.avatar ? monogram(items[j].name, j) : cfg.anim ? videoPlaceholder(j) : undefined);
    });
  }
}

function applyContent() {
  const c = CFG.content;
  /* Aloldalon a saját szekciólistája dönt, a főoldalon a site.json sections-e */
  const sections = PAGE?.sections?.length ? PAGE.sections
    : CFG.sections?.length ? CFG.sections
    : SECTION_IDS.map((id) => ({ id, on: true, sub: [] }));
  const bookingOn = !!c.booking?.enabled;
  renderLists(c);                              /* előbb legyen meg a szekció, aztán rendezzük */
  /* betűméret-kivételek szekciónként – a generált listásakra is */
  $$("[data-sec]").forEach((el) => setFs(el, DESIGN.fontScaleBy?.[el.dataset.sec]));

  /* Szekciók sorrendje és láthatósága. A lépcső (SEC_STEP) hagy helyet a
     szekció mögé fűződő moduloknak (ugyanaz, mint a tervező előnézetében). */
  sections.forEach((sec, i) => {
    const el = $(`[data-sec="${sec.id}"]`);
    if (!el) return;
    el.style.order = i * SEC_STEP;
    el.hidden = !sec.on || SEC_EMPTY[sec.id]?.(c) === true;
    /* Sötét kiemelés: a lap EGYETLEN hangsúlyos táblája (pv.css 8.10/b).
       Nem a sávozás dolga – az váltakozik, ez kijelöl. */
    if (sec.plate) el.dataset.plate = "1"; else delete el.dataset.plate;
  });

  /* A modulok a horgony-szekciójuk MÖGÉ fűződnek, a saját kapcsolójuk szerint.
     Ismeretlen horgonynál a lap elejére – hiányos szekciólista se tüntesse el
     a foglalást. */
  EXTRAS.forEach((x, n) => {
    const el = $(`[data-sec="${x.id}"]`);
    if (!el) return;
    el.hidden = !x.on(c);
    el.style.order = Math.max(0, sections.findIndex((y) => y.id === modAfter(x))) * SEC_STEP + n + 1;
  });

  /* Árjegyzék. A kategóriákból szűrő lesz, a megjegyzés (időtartam, kiszerelés)
     a név alá kerül. Kártyás módban (`pricing.cards`) a listából termékrács
     lesz: boltnál és pékségnél a KÉP adja el a sort. */
  const prices = c.pricing?.items || [];
  const priceCards = c.pricing?.cards === true;
  const chips = $("#pv-price-chips");
  if (chips) chips.innerHTML = chipRow(prices);
  const priceList = $("#pv-prices");
  priceList.className = priceCards ? "pv-items pv-prices--cards" : "pv-prices";
  priceList.innerHTML = prices.map((it) => priceCards ? `
    <li class="pv-item"${it.tag ? ` data-cat="${esc(it.tag)}"` : ""}>
      <figure class="pv-item__media"><img alt="" width="800" height="600" loading="lazy"></figure>
      <div class="pv-item__body">
        <h3>${esc(it.name)}</h3>
        <p class="pv-price__tag"><b>${esc(it.price)}</b>${it.time ? `<small>${esc(it.time)}</small>` : ""}</p>
      </div>
    </li>` : `
    <li${it.tag ? ` data-cat="${esc(it.tag)}"` : ""}>
      <span class="pv-price__name">${esc(it.name)}${it.time ? `<small>${esc(it.time)}</small>` : ""}</span>
      <b>${esc(it.price)}</b>
    </li>`).join("");
  if (priceCards) $$("#pv-prices img").forEach((img, i) => paintImg(img, prices[i].image, i, ""));

  buildNav(sections, c);

  /* A fő gomb oda visz, ahol a konverzió történik: ha van időpontfoglalás, a
     foglaláshoz, egyébként a kapcsolathoz. */
  $$("[data-cta-main]").forEach((a) => {
    a.dataset.ctaSec = bookingOn ? "booking" : "contact";
    a.href = "#sec-" + a.dataset.ctaSec;
    a.textContent = t(bookingOn ? "pv.ctaBook" : "pv.cta");
    /* Cél-esemény csak akkor, ha a gomb tényleg a foglaláshoz visz. */
    if (bookingOn) a.dataset.goal = "booking-start"; else delete a.dataset.goal;
  });
  /* A hero MÁSODIK gombja: vagy egy szekcióra visz, vagy útvonaltervezésre a
     címre. A felirat mindkét esetben a célból jön – nincs külön szövegmező. */
  const cta2 = $("#pv-cta2");
  if (cta2) {
    const target = c.cta2 === "route" || SECTION_IDS.includes(c.cta2) ? c.cta2 : "services";
    if (target === "route") {
      delete cta2.dataset.ctaSec;              /* nem szekcióra mutat */
      cta2.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(String(c.address || "").trim())}`;
      cta2.target = "_blank";
      cta2.rel = "noopener noreferrer";
      cta2.textContent = t("pv.ctaRoute");
      cta2.hidden = !String(c.address || "").trim();
      cta2.dataset.goal = "route";
    } else {
      delete cta2.dataset.goal;              /* szekcióra mutat, nem cél */
      cta2.dataset.ctaSec = target;
      cta2.href = "#sec-" + target;
      cta2.removeAttribute("target");
      cta2.removeAttribute("rel");
      cta2.textContent = t("sec." + target);
    }
  }

  /* Kikapcsolt szekcióhoz ne vezessen gomb */
  $$("[data-cta-sec]").forEach((a) => (a.hidden = !!$(`[data-sec="${a.dataset.ctaSec}"]`)?.hidden));

  /* Élő nyitva/zárva a hero fölött + a hét a kapcsolat blokkban. A napok a
     foglalás adatai (`booking.hours`), de a kapcsoló külön áll: bolt van
     foglalás nélkül is. */
  const hoursOn = c.hoursShow === true && !!c.booking?.hours;
  const badge = $("#pv-status");
  if (badge) {
    badge.hidden = !hoursOn;
    if (hoursOn) {
      const st = openState(c.booking.hours);
      badge.dataset.open = st.open ? "1" : "0";
      const when = st.in === 0 ? t("pv.today") : st.in === 1 ? t("pv.tomorrow") : dayName(st.key);
      badge.textContent = !st.at ? t("pv.closedNow")
        : st.open ? `${t("pv.openNow")} · ${t("pv.until")} ${st.at}`
        : `${t("pv.closedNow")} · ${when} ${st.at}`;
    }
  }
  const hoursBox = $("#pv-hours");
  if (hoursBox) {
    hoursBox.hidden = !hoursOn;
    if (hoursOn) {
      const todayKey = DAYS[(new Date().getDay() + 6) % 7];
      $("#pv-hours-list").innerHTML = DAYS.map((d) => {
        const h = c.booking.hours[d] || { closed: true };
        return `<li${d === todayKey ? ` class="is-today"` : ""}>
          <span>${esc(dayName(d))}</span>
          <b>${h.closed ? esc(t("pv.closedDay")) : `${esc(h.open)}–${esc(h.close)}`}</b>
        </li>`;
      }).join("");
    }
  }

  /* Sávozás: a `order` miatt a DOM sorrendje nem a látható sorrend, a
     váltakozás viszont csak a LÁTHATÓ sorrendben értelmes. A sáv erejét a lap
     `data-band`-je mondja meg, ez a jelölő csak azt, MELYIK szekció esik sávba. */
  $$("[data-sec]").filter((el) => !el.hidden)
    .sort((a, b) => Number(a.style.order) - Number(b.style.order))
    .forEach((el, i) => {
      el.dataset.stripe = i % 2;
      /* A LÁTHATÓ sorszám (01, 02 …). A lapritmus ebből dolgozik: a fejezet ezt
         írja ki óriásként, a sín ebből lesz tartalomjegyzék (pv.css 8.12/c).
         Ugyanaz az ok, mint a sávozásnál: a `order` miatt a CSS-számláló a DOM
         sorrendjét látná, nem azt, amit a látogató. Idézőjelesen, mert a CSS
         `content:` sztringet vár – és így öröklődik a belső ál-elemekig. */
      el.style.setProperty("--pv-idx", `"${String(i + 1).padStart(2, "0")}"`);
      el.classList.toggle("is-first", i === 0);
    });

  /* Szolgáltatás-kártyák: a JSON-ból, vagy négy kitöltendő alapkártya */
  const items = c.services?.length ? c.services
    : [1, 2, 3, 4].map((n) => ({ name: t("pv.item" + n), text: t("pv.item" + n + "text") }));
  $("#pv-items").innerHTML = items.map((it, i) => `
    <li class="pv-item">
      <figure class="pv-item__media"><img data-img-slot="${i}" alt="" width="800" height="600" loading="lazy"></figure>
      <div class="pv-item__body">
        <h3>${esc(it.name)}</h3>
        ${it.text ? `<p>${esc(it.text)}</p>` : ""}
      </div>
    </li>`).join("");
  /* A bemutatkozás képhelye a kártyák UTÁN következik – a kártyák száma a
     JSON-ból jön, ezért a sorszámot itt írjuk rá, nem a markupban rögzítjük. */
  const aboutImg = $("#pv-about-img");
  if (aboutImg) aboutImg.dataset.imgSlot = items.length;

  /* Kézjegy-szalag (sig="marquee"): ugyanazok a nevek futnak a hero alatt.
     KÉTSZER, mert a fél szalagnyi eltolásnál a két készlet fedésbe kerül –
     varrat nélkül ismétlődik. A második készlet csak a varrat miatt kell:
     csökkentett mozgásnál, ahol a szalag megáll és tördelt sorrá válik, azt a
     CSS elrejti, hogy ne látszódjon kétszer ugyanaz. */
  const ribbon = $("#pv-ribbon");
  if (ribbon) {
    const names = items.map((it) => String(it.name || "").trim()).filter(Boolean);
    const span = (n, cls) => `<span class="${cls}">${esc(n)}</span>`;
    ribbon.innerHTML = names.map((n) => span(n, "")).join("")
      + names.map((n) => span(n, "is-copy")).join("");
  }

  /* Referenciák. A `--shot` a végiggördülő képernyőképet kapcsolja rá (pv.css 8.3/c). */
  const refs = c.references || [];
  $("#pv-refs").innerHTML = refs.map((r) => `
    <li class="pv-item pv-item--shot">
      <figure class="pv-item__media"><img alt="" width="800" height="600" loading="lazy"></figure>
      <div class="pv-item__body"><h3>${esc(r.caption)}</h3></div>
    </li>`).join("");

  /* Szövegek. A *csillagok* közötti szó KIEMELÉS-jelölő (sig="emph", pv.css
     8.12/d): ahol a kiemelés értelmes (főcím, mottó, bemutatkozás), ott dőlt
     lesz belőle, mindenhol máshol (menü, lábléc) csak a csillag tűnik el.
     A sorrend fontos: előbb escape, utána a jelölő – az ügyfél szövege így nem
     tud markupot behozni. Ugyanaz a kód, mint a tervező előnézetében. */
  const setText = (id, val) => { const el = $("#" + id); if (el) el.textContent = plain(val); };
  const setRich = (id, val) => {
    const el = $("#" + id);
    if (el) el.innerHTML = esc(val ?? "").replace(/\*([^*\n]+)\*/g, '<em class="pv-emph">$1</em>');
  };
  setRich("pv-company", c.company);
  /* A visszhang (sig="echo") a főcím szellemképe – a CSS az attribútumból szedi
     ki a szöveget, ezért a jelölő nélküli változat kell ide. */
  const company = $("#pv-company");
  if (company) company.dataset.echo = plain(c.company);
  /* az aláírás (sig="signature") ugyanígy attribútumból veszi a nevet */
  const aboutCopy = $(".pv-about__copy");
  if (aboutCopy) aboutCopy.dataset.sign = plain(c.company);
  setText("pv-company-sm", c.company);
  setText("pv-company-ft", c.company);
  setRich("pv-tagline", c.tagline);
  setRich("pv-about", c.about);
  setText("pv-address", c.address);
  setText("pv-address-top", c.address);
  setText("pv-map-address", c.address);
  setText("pv-year", new Date().getFullYear());

  const phone = $("#pv-phone"), mail = $("#pv-email");
  phone.textContent = c.phone || "";
  phone.href = "tel:" + String(c.phone || "").replace(/[^+\d]/g, "");
  /* a fejléc hívás-gombja ugyanarra a számra – szám nélkül nincs mit hívni */
  const call = $("#pv-call");
  if (call) { call.href = phone.href; call.hidden = !String(c.phone || "").trim(); }
  mail.textContent = c.email || "";
  mail.href = "mailto:" + (c.email || "");
  /* Felső infósáv (navTop, pv.css 8.2/d): a hero jelvénye, a cím és az
     elérhetőség – ugyanazok az adatok, külön mező nélkül. */
  const topSt = $("#pv-topbar-status"), badgeEl = $("#pv-status");
  if (topSt && badgeEl) {
    topSt.hidden = badgeEl.hidden;
    topSt.textContent = badgeEl.textContent;
    topSt.dataset.open = badgeEl.dataset.open || "0";
  }
  const topAddr = $("#pv-topbar-addr");
  if (topAddr) {
    topAddr.textContent = c.address || "";
    topAddr.hidden = !String(c.address || "").trim();
  }
  for (const [a, src, val] of [[$("#pv-topbar-phone"), phone, c.phone], [$("#pv-topbar-mail"), mail, c.email]]) {
    if (!a) continue;
    a.href = src.href;
    $("span", a).textContent = val || "";
    a.hidden = !String(val || "").trim();
  }
  mail.closest("li").hidden = !String(c.email || "").trim();

  /* Képek. A hero minden képet slide-ként mutat, a fix képhelyeken pedig
     körbeforognak: a j. hely a (j % darabszám). képet kapja. */
  const imgs = c.images?.length ? c.images : [{ src: "" }];
  /* A `focus` mondja meg, melyik része maradjon a képnek, ha a keret levágja –
     a `data-img-idx` pedig a kerethez köti a képet (képkezelés, lásd lentebb). */
  const paintSlot = (el, i, src, alt) => {
    el.dataset.imgIdx = i;
    el.style.objectPosition = src ? "" : FOCUS[imgs[i].focus] || "";
    paintImg(el, src || imgs[i].src, i, alt ?? imgs[i].alt ?? "");
  };
  const track = $("#pv-hero-slides");
  track.innerHTML = imgs.map(() => `<img alt="" width="800" height="600">`).join("");
  [...track.children].forEach((el, i) => paintSlot(el, i, "", imgs[i].alt || c.company || ""));
  $$("[data-img-slot]").forEach((el) => {
    const n = Number(el.dataset.imgSlot);
    paintSlot(el, n % imgs.length, c.services?.[n]?.image || "");
  });
  $$("#pv-refs img").forEach((img, i) =>
    paintImg(img, refs[i].image, i + imgs.length, refs[i].caption || ""));

  /* Képkezelés keretenként (pv.css 8.12/kép). A stílus a keretre kerül, nem a
     lapra: ahol egy keretben EGY kép van, ott a kép saját beállítása győz – így
     a rosszul álló fotó külön kezelhető. A hero, a referenciák és a listás
     szekciók a lap globálisát öröklik. */
  $$(".pv-item__media, .pv-about__media").forEach((fig) => {
    const idx = $("img", fig)?.dataset.imgIdx;
    fig.dataset.media = imgs[idx]?.media || DESIGN.media;
  });
  $(".pv-hero__media").dataset.media = DESIGN.media;

  /* Térkép */
  const q = String(c.address || "").trim();
  if (q) {
    $("#pv-map").src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=15&hl=${LANG}&output=embed`;
    $("#pv-map-link").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  syncSliders();
  if (bookingOn) mountBooking();
}

/* A foglalási varázsló ugyanaz a kód, mint a tervező előnézetében – csak az
   adatforrás más (ott demó, itt Firestore). Fájlonként ~60 kB, ezért csak
   akkor töltjük be, ha az ügyfélnél tényleg van foglalás. */
let bookingLoaded = false;
function mountBooking() {
  if (bookingLoaded) return;
  bookingLoaded = true;
  document.head.append(Object.assign(document.createElement("link"),
    { rel: "stylesheet", href: "booking.css" }));
  const s = Object.assign(document.createElement("script"), { src: "booking.js" });
  s.onload = () => import("./booking-api.js").catch((err) =>
    console.error("A foglalási modul nem indult el (fut a backend a /api/ alatt?):", err));
  document.head.append(s);
}

/* A logó és a felirat a foglalási oldalon is kell, nem csak a főoldalon */
function applyChrome() {
  const c = CFG.content;
  const logo = $("#pv-logo");
  if (logo) {
    const fallback = monogram();
    logo.onerror = () => { if (logo.src !== fallback) logo.src = fallback; };
    logo.src = imgSrc(c.logo) || fallback;
    logo.alt = c.company || "";
  }
  $$("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  /* Feliratok, amik nem szövegek, hanem gomb- és vezérlő-nevek: aria-label */
  $$("[data-i18n-label]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nLabel)));
  $$("#pv-company-sm, #pv-company-ft").forEach((el) => (el.textContent = plain(c.company)));
  const year = $("#pv-year");
  if (year) year.textContent = new Date().getFullYear();
}

/* Kereshetőség: a cím, a leírás és a cégadatok a JSON-ból. A JSON-LD-t a
   Google a helyi találatokhoz (nyitvatartás, telefon, térkép) használja. */
function applySeo() {
  const c = CFG.content;
  document.documentElement.lang = LANG;

  /* Saját böngészőcíme van a hibaoldalnak és a jogi oldalaknak (ott a lap
     címe marad, a cégnév csak mögé kerül), meg az aloldalaknak (azt a
     `pages[]` adja). A főoldalon a cégnév és a keresőleírás a lényeg. */
  const ownTitle = $("#pv-error") || $("[data-legal]");
  const own = PAGE?.title || (ownTitle ? document.title : "");
  if (own) document.title = `${own}${c.company ? " – " + c.company : ""}`;
  else if (c.company) document.title = c.seoTitle || `${c.company}${c.tagline ? " – " + String(c.tagline).split(/[.!?]/)[0] : ""}`;

  /* A jogi oldalak és a 404 saját leírást hoznak a HTML-ben – azt nem írjuk át. */
  const desc = PAGE?.description || c.seoDescription || c.tagline || "";
  if (desc && !ownTitle) $('meta[name="description"]')?.setAttribute("content", String(desc).slice(0, 300));

  const ld = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: c.company,
    description: desc || undefined,
    address: c.address || undefined,
    telephone: c.phone || undefined,
    email: c.email || undefined,
    url: location.origin + location.pathname.replace(/index\.html$/, ""),
  };
  document.head.append(Object.assign(document.createElement("script"), {
    type: "application/ld+json",
    textContent: JSON.stringify(ld),
  }));
}

/* --------------------------------------------------------------------------
   Jogi oldalak (impresszum.html, adatkezeles.html)

   A szöveg minden ügyfélnél ugyanaz, csak az adat más – ezért a HTML-ben csak
   helyek vannak (`data-legal`), az értéket a site.json `legal` blokkja adja.
   Új ügyfélnél így nem kell HTML-t szerkeszteni, csak a JSON-t kitölteni.
   -------------------------------------------------------------------------- */
function applyLegal() {
  const c = CFG.content;
  const L = CFG.legal || {};
  /* Amit a legal blokk nem ad meg, az a cég alapadataiból jön – két helyen ne
     kelljen ugyanazt karbantartani. */
  const val = {
    company:        c.company,
    name:           L.name || c.company,
    seat:           L.seat || c.address,
    regNumber:      L.regNumber,
    taxNumber:      L.taxNumber,
    representative: L.representative,
    email:          L.email || c.email,
    phone:          L.phone || c.phone,
    supervisor:     L.supervisor,
    hostName:       L.hosting?.name,
    hostSeat:       L.hosting?.seat,
    hostMail:       L.hosting?.email,
    retention:      L.retentionMonths,
    updated:        L.updated,
  };

  $$("[data-legal]").forEach((el) => {
    const key = el.dataset.legal;
    const v = val[key];
    /* A gondolatjel szándékos: egy kitöltetlen jogi mező tűnjön fel, ne
       tűnjön el némán. A plan-to-site.mjs is felsorolja, mi hiányzik. */
    el.textContent = v == null || v === "" ? "—" : String(v);
    if (el.tagName === "A" && v) {
      el.href = (/mail/i.test(key) ? "mailto:" : "tel:") + String(v).replace(/\s+/g, "");
    }
  });

  /* Üres adat ne maradjon ott árva címszóként; a foglalásra vonatkozó
     szakaszok pedig csak akkor kellenek, ha a modul be van kapcsolva. */
  $$("[data-legal-if]").forEach((el) => {
    const key = el.dataset.legalIf;
    el.hidden = key === "booking" ? !c.booking?.enabled : !val[key];
  });
}

/* --------------------------------------------------------------------------
   Interakciók (ugyanazok, mint az előnézetben)
   -------------------------------------------------------------------------- */
/* A slide-nyilak csak akkor kellenek, ha tényleg van hova görgetni */
function syncSliders() {
  $$(".pv-slider").forEach((sl) => {
    const track = $(".pv-slides", sl);
    if (track) sl.classList.toggle("is-static", track.scrollWidth <= track.clientWidth + 1);
  });
}

/* --------------------------------------------------------------------------
   Mérés – POST /api/collect (backend README). Sütimentes: a látogató
   azonosítóját a szerver számolja napi sóval, a lap csak a puszta eseményt
   küldi. Három szabály, ami nem alkuképes: `sendBeacon` (a lap bezárása se
   veszítse el), minden hiba elnyelve (a mérés soha ne rontsa el az oldalt),
   és „Do Not Track" mellett egyetlen kérés sem indul.
   -------------------------------------------------------------------------- */
function initStats() {
  if (navigator.doNotTrack === "1") return;

  const send = (body) => {
    try {
      navigator.sendBeacon("/api/collect",
        new Blob([JSON.stringify(body)], { type: "application/json" }));
    } catch { /* a mérés sosem szólhat bele a lapba */ }
  };

  /* A hivatkozóból CSAK a domain megy el, teljes URL sosem. A saját aloldalunk
     nem forrás – különben minden belső link „hivatkozóként" ülne a listában. */
  let ref = "";
  try { ref = new URL(document.referrer).hostname; } catch { /* nincs vagy rossz */ }
  if (ref === location.hostname) ref = "";

  /* Az eszközt a szerver a `w`-ből dönti el (mobil / tablet / asztali). */
  send({ kind: "view", path: location.pathname, ref, w: innerWidth });

  /* Cél-esemény: nem a látogatót méri, hanem hogy hozott-e ügyfelet. Ez az
     egyetlen szám, ami az ügyfélnek tényleg mond valamit. */
  const goal = (name) => send({ kind: "goal", path: location.pathname, label: name, w: innerWidth });
  /* A foglalás ELKÜLDÉSE nem kattintás – a varázsló innen jelzi (booking.js). */
  window.pvGoal = goal;

  /* Egyetlen delegált figyelő, capture fázisban: a stopPropagation-t hívó
     saját kezelőink se némítsák el. Csak fogantyúra kattintás számít – a
     szerver felirat szerint csoportosít, felirat nélküli sor oda se kerül. */
  document.addEventListener("click", (e) => {
    /* A cél vagy az elemre van írva (data-goal), vagy a link CÉLJÁBÓL derül ki:
       az árlistára mutató BÁRMELYIK hivatkozás „árlista megnyitása". */
    const g = e.target.closest("[data-goal], a[href$='#sec-prices']");
    if (g) goal(g.dataset.goal || "prices");

    const el = e.target.closest("a, button, [role='button']");
    if (!el) return;
    const doc = document.documentElement;
    send({
      kind: "click",
      path: location.pathname,
      label: (el.dataset.stat || el.getAttribute("aria-label") ||
        el.textContent.trim() || el.tagName).slice(0, 120),
      /* a LAPHOZ mért százalék, nem a képernyőhöz: így a hőtérkép telefonon és
         monitoron ugyanazt a pontot jelenti (a szerver 0–100-at vár) */
      x: clamp(Math.round(e.pageX / (doc.scrollWidth || 1) * 100), 0, 100),
      y: clamp(Math.round(e.pageY / (doc.scrollHeight || 1) * 100), 0, 100),
      w: innerWidth,
    });
  }, { capture: true });
}

function initEvents() {
  /* Slide-lapozás: natív görgetés egy nézetnyivel, a végén körbefordul */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-slide]");
    if (!btn) return;
    const track = $(".pv-slides", btn.closest(".pv-slider"));
    const max = track.scrollWidth - track.clientWidth;
    const at = track.scrollLeft;
    const left = Number(btn.dataset.slide) > 0
      ? (at >= max - 1 ? 0 : Math.min(at + track.clientWidth, max))
      : (at <= 1 ? max : Math.max(at - track.clientWidth, 0));
    track.scrollTo({ left, behavior: "smooth" });
  });

  /* ~1,1 mp-es görgetés: gyors indulás, lassuló érkezés (easeOutCubic). A natív
     smooth-nak nincs idő- és görbe-kapcsolója, ezért megy kézzel. Két helyről
     hívjuk – menülink és a „vissza a tetejére" gomb –, ezért egy függvény.
     Ugyanaz a mozgás, mint a tervező előnézetében; ott a doboz görög, itt a lap. */
  const glide = (to) => {
    const from = scrollY;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return scrollTo(0, to);
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / 1100, 1);
      scrollTo(0, from + (to - from) * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* Kategória-szűrő (galéria, árjegyzék). Nézetbeállítás, nem adat: sehol nem
     tároljuk, a lap újratöltése „Mind"-del indul. */
  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".pv-chip");
    if (!chip) return;
    const box = chip.closest("[data-sec]");
    $$(".pv-chip", box).forEach((c) => {
      const on = c === chip;
      c.classList.toggle("is-on", on);
      c.setAttribute("aria-pressed", String(on));
    });
    $$("[data-cat]", box).forEach((el) =>
      (el.hidden = !!chip.dataset.tag && el.dataset.cat !== chip.dataset.tag));
  });

  /* Menülink: nem ugrás, hanem görgetés a szekcióig. */
  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#sec-"]');
    if (!link) return;
    const target = $(link.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    glide(Math.max(0, Math.min(scrollY + target.getBoundingClientRect().top,
      document.documentElement.scrollHeight - innerHeight)));
  });

  /* Vissza a lap tetejére (pv.css 8.14). A gomb csak akkor bukkan elő, ha a
     látogató legalább egy képernyőnyit görgetett – rövid lapon fel sem tűnik.
     A figyelő PASSZÍV: a görgetést semmiképp nem késleltetheti. */
  /* Ugyanaz a küszöb viszi a ragadós CTA-sávot (pv.css 8.14/b): mindkettő akkor
     kell, amikor a hero – és benne a fő gomb – már elgörgött. */
  /* Ugyanez a figyelő viszi a fejléc görgetés-jeleit (pv.css 8.2/c) és az
     aktuális menüpontot – ugyanaz a logika, mint a tervező előnézetében. Előbb
     minden OLVASÁS, utána az írás: egy görgetés, egy elrendezés-számolás. */
  const topBtn = $("#pv-top"), ctaBar = $("#pv-cta-bar"), header = $(".pv-header");
  let lastY = 0;
  const syncTop = () => {
    const y = scrollY, h = innerHeight, max = document.documentElement.scrollHeight - h;
    const past = y > h * 0.6, headH = header?.offsetHeight || 0;
    /* a legalsó szekció, amelyiknek a teteje már a nézet felső harmadában van –
       a lap alján az utolsó, mert az sosem ér fel odáig */
    let cur = null, best = -Infinity;
    for (const a of $$('#pv-nav a[href^="#sec-"]')) {
      const el = $(a.getAttribute("href"));
      if (!el || el.hidden) continue;
      const at = el.getBoundingClientRect().top;
      if ((at <= h * 0.35 || y >= max - 2) && at > best) { best = at; cur = a; }
    }
    $$("#pv-nav [aria-current]").forEach((a) => a !== cur && a.removeAttribute("aria-current"));
    cur?.setAttribute("aria-current", "location");
    topBtn?.classList.toggle("is-on", past);
    ctaBar?.classList.toggle("is-on", past);
    if (header) {
      header.classList.toggle("is-scrolled", y > 8);
      /* az apró oda-vissza rezgést (érintőpad, rugalmas görgetés) a 6px szűri */
      if (Math.abs(y - lastY) > 6) {
        header.classList.toggle("is-away", y > lastY && y > headH * 2);
        lastY = y;
      }
      header.style.setProperty("--pv-read", max > 0 ? (y / max).toFixed(4) : 0);
    }
  };
  addEventListener("scroll", syncTop, { passive: true });
  topBtn?.addEventListener("click", () => glide(0));
  syncTop();

  $("#pv-mode-toggle")?.addEventListener("click", () => setMode(MODE === "dark" ? "light" : "dark"));

  /* Mobil menü: a fejléc kapcsolója. Menüpontra kattintva magától bezárul. */
  const burger = $("#pv-burger");
  const closeMenu = () => {
    $("#pv-nav")?.classList.remove("is-open");
    burger?.setAttribute("aria-expanded", "false");
  };
  burger?.addEventListener("click", () => {
    const open = $("#pv-nav").classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });
  /* menüpontra vagy nézetváltóra kattintva a panel becsukódik */
  $("#pv-nav")?.addEventListener("click", (e) => { if (e.target.closest("a, [data-view]")) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  new ResizeObserver(syncSliders).observe(document.body);
}

/* --------------------------------------------------------------------------
   Indulás
   -------------------------------------------------------------------------- */
/* Alapból a site.json fut. Kipróbáláshoz a `?config=ugyved.json` másik helyi
   fájlt tölt be – csak sima fájlnevet fogadunk el, hogy idegen címről ne
   lehessen tartalmat csempészni az oldalra. */
const configFile = () => {
  const q = new URLSearchParams(location.search).get("config");
  return /^[\w-]+\.json$/.test(q || "") ? q : "site.json";
};

/* Az admin felületen szerkesztett elemlisták: a backend `content` táblájának
   `lists` kulcsa. A galéria képeit és videóit az ügyfél OTT tölti fel, nem ebbe
   a fájlba – a lapnak tehát onnan is olvasnia kell, különben a feltöltés sosem
   jelenne meg.

   Hibánál, időtúllépésnél és backend nélküli másolatnál (peldak/) is null: a lap
   ilyenkor a site.json-ból dolgozik, és sosem áll meg a backend miatt. */
async function liveLists() {
  try {
    const res = await fetch("/api/content", { signal: AbortSignal.timeout(2500) });
    return res.ok ? (await res.json())?.lists ?? null : null;
  } catch {
    return null;
  }
}

async function init() {
  const file = configFile();
  let live = null;
  try {
    /* A kettő EGYSZERRE indul. Sorban kérve a lap a backend válaszára várna;
       utólag kérve kétszer rajzolódna újra a fél oldal. A foglalási aloldalon
       nincsenek listás szekciók, ott nem is kérjük el. */
    const [res, lists] = await Promise.all([
      fetch(file, { cache: "no-cache" }),
      $("#pv-hero-slides") ? liveLists() : null,
    ]);
    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    CFG = await res.json();
    live = lists;
  } catch (err) {
    console.error(`Nem sikerült betölteni: ${file}`, err);
    return;
  }
  CFG.content ||= {};
  /* Csak azt a listát írjuk felül, amit a backend TÉNYLEG küldött: egy üres
     vagy hiányos válasz ne tüntesse el a fájlban megírt csapatot vagy GYIK-et. */
  if (live) {
    for (const id of LIST_IDS) {
      if (Array.isArray(live[id])) (CFG.content.lists ||= {})[id] = live[id];
    }
  }
  /* Melyik aloldalon vagyunk? A generált HTML jelöli meg magát. */
  const slug = document.documentElement.dataset.page;
  PAGE = slug ? (CFG.pages || []).find((p) => p.slug === slug) || null : null;
  LANG = I18N[CFG.meta?.lang] ? CFG.meta.lang : "hu";
  TEXTS = CFG.content.texts || {};
  DESIGN = { ...BASE, ...CFG.design, colors: { ...BASE.colors, ...CFG.design?.colors } };

  let saved = null;
  try { saved = localStorage.getItem(MODE_KEY); } catch {}
  MODE = saved === "light" || saved === "dark" ? saved : (DESIGN.mode || BASE.mode);

  loadFonts();
  applyDesign();
  applyChrome();
  applySeo();
  if ($("#pv-hero-slides")) applyContent();     /* a foglalási oldalon nincs mit */
  if ($("[data-legal]")) applyLegal();          /* impresszum és adatkezelés */
  initEvents();
}

init();
initStats();
})();
