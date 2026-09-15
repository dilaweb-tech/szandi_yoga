/* ==========================================================================
   A TERVEZŐVEL KÖZÖS FÁJLOK ÖSSZEHASONLÍTÁSA ÉS ÁTMÁSOLÁSA

     node tools/sync-shared.mjs                → csak jelent (eltérésnél 1-es kilépés)
     node tools/sync-shared.mjs --pull [minta] → tervező → termék
     node tools/sync-shared.mjs --push [minta] → termék → tervező

   A `minta` egy fájlnév-részlet: csak az arra illeszkedő párokat mozgatja.

   Miért kell: a foglalási varázsló és a backend ugyanaz a kód a tervező
   előnézetében és a kész oldalon – ha elcsúsznak, az ügyfél mást kap, mint amit
   a tervezőben látott. A sorvégek (CRLF/LF) nem számítanak eltérésnek, csak a
   tartalom. A `pv.css` NINCS a listán: annak saját, blokkos szinkronja van
   (tools/sync-css.mjs), mert ott csak a markerek közti rész közös.
   Ami az OFF listán van, azt SEM másoljuk: ott a két oldal külön ágon fejlődik,
   és a másolás nem szinkron lenne, hanem az egyik ág törlése.
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";

const HERE = new URL("../", import.meta.url);
const PLAN = new URL("../../dilaweb_sablon/", import.meta.url);

/* [tervezőbeli út, termékbeli út]. MA ÜRES: a foglalási modul mindkét fájlja
   külön ágon fejlődik – lásd OFF. Ha egyesítettük, ide kerülnek vissza. */
const PAIRS = [];

/* KIVÉVE a listából: itt a két oldal már NEM ugyanannak a fájlnak két másolata,
   hanem két külön fejlődési ág. A másolás bármelyik irányban törölne. */
const OFF = {
  "booking.js":
    "a tervező 2026-08-24 óta a fiókpanelt is ebben viszi (mountAccount, +450 sor), " +
    "a termék viszont saját fiók-felületet használ a booking-api.js-ben. Amíg a kettő " +
    "nincs egyesítve, a másolás az egyik oldal fiókkezelését törölné. " +
    "Az átvétel iránya: dilaweb_sablon/site/README.md",
  "booking.css":
    "a fiókpanel stílusai (.bk-acc__*, .bk-tab, .bk-check, .bk-or) csak a tervezőben " +
    "vannak – 112 eltérő sor. A booking.js-szel EGYÜTT mozog: külön másolva vagy a " +
    "stílus veszne el, vagy stílus nélküli fiókpanel maradna.",
};

const dir = process.argv.includes("--pull") ? "pull"
  : process.argv.includes("--push") ? "push" : "check";
const filter = process.argv.slice(2).find((a) => !a.startsWith("--"));

/* Csak a tartalom számít: a két repóban más a sorvég-beállítás */
const norm = (s) => s.replace(/\r\n/g, "\n");
/* Hány sor nem talál párt a másik oldalon. Sorrend-független, mert egyetlen
   beszúrt sor különben az egész fájlt eltértnek mutatná. */
const lines = (a, b) => {
  const bag = new Map();
  for (const l of norm(a).split("\n")) bag.set(l, (bag.get(l) || 0) + 1);
  let n = 0;
  for (const l of norm(b).split("\n")) {
    const c = bag.get(l) || 0;
    if (c) bag.set(l, c - 1); else n++;
  }
  for (const c of bag.values()) n += c;
  return n;
};

/* A kihagyott fájlokról szólni kell: a néma "0 fájl átmásolva" azt sugallná,
   hogy nincs eltérés – pedig épp az van, csak nem gépiesen oldható fel. */
for (const [name, why] of Object.entries(OFF)) {
  if (!filter || name.includes(filter)) console.log(`  KIHAGYVA  ${name} – ${why}`);
}

let drift = 0, moved = 0;
for (const [from, to] of PAIRS) {
  if (filter && !from.includes(filter) && !to.includes(filter)) continue;
  const src = new URL(from, PLAN), dst = new URL(to, HERE);
  if (!existsSync(src) || !existsSync(dst)) {
    console.log(`  HIÁNYZIK  ${from} ↔ ${to}`);
    drift++;
    continue;
  }
  const a = readFileSync(src, "utf8"), b = readFileSync(dst, "utf8");
  if (norm(a) === norm(b)) continue;

  drift++;
  const newer = statSync(src).mtimeMs > statSync(dst).mtimeMs ? "tervező" : "termék";
  /* A fájldátum félrevezet (egy checkout is frissíti), ezért a sorszám is
     kimegy: a bővebb oldal rendszerint az, amelyik előrébb tart. Az irányt
     ettől függetlenül te döntöd el – a script nem másol magától. */
  console.log(`  ELTÉR     ${from} ↔ ${to}  (${lines(a, b)} eltérő sor; ` +
    `tervező: ${norm(a).split("\n").length}, termék: ${norm(b).split("\n").length} sor; ` +
    `dátum szerint frissebb: ${newer})`);

  if (dir === "pull") { writeFileSync(dst, a); moved++; }
  if (dir === "push") { writeFileSync(src, b); moved++; }
}

if (dir === "check") {
  console.log(drift ? `\n${drift} eltérő fájl. Irány megadásával másolható: --pull vagy --push.`
    /* Üres párlista mellett a "szinkronban vannak" hazugság lenne: nem szinkron,
       hanem nincs is mit összehasonlítani. */
    : PAIRS.length ? "A közös fájlok szinkronban vannak."
    : "Nincs gépiesen szinkronizálható fájl – lásd a fenti kihagyásokat.");
  process.exit(drift ? 1 : 0);
}
console.log(`\n${moved} fájl átmásolva (${dir === "pull" ? "tervező → termék" : "termék → tervező"}).`);
console.log("Ellenőrzés: node test-site.mjs — a tervezőben: node test-booking.mjs");
