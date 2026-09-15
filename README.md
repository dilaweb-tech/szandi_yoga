# DilaWEB – kész ügyféloldal

Ez a **termék**: az az oldal, amit átadunk. Ugyanaz a markup és ugyanaz a CSS,
mint a tervező ([dilaweb_sablon](../dilaweb_sablon)) élő előnézetében – csak az
adat nem a szerkesztőből jön, hanem a `site.json`-ból.

**Új ügyfél = új `site.json` + képek. Kódot nem írunk.**

## Mentett stílus betöltése

A tervezőből letöltött `dilaweb-<cegnev>.json` **formátuma azonos a
`site.json`-nal**, tehát a betöltés maga másolás. Csináld ezzel, mert közben
megmondja, mi hiányzik még:

```bash
node tools/plan-to-site.mjs ~/Downloads/dilaweb-aurora-hajszalon.json
```

A parancs a régi `site.json`-t `site.json.bak` néven félreteszi, beírja az újat,
majd felsorolja a hiányzó képeket és a kitöltetlen mezőket.

**Kipróbálás fájlcsere nélkül:** tedd a JSON-t a gyökérbe, és nyisd meg így:
`index.html?config=ugyved.json`. Csak sima fájlnevet fogad el, idegen címről nem
tölt be semmit. Két kész példa a `peldak/` mappában van (`fodrasz.json`,
`ugyved.json`) – ugyanaz a kód, két teljesen más oldal.

## Átadás hat lépésben

1. **Repo másolása** az ügyfél nevére (`dilaweb-<ugyfel>`).
2. **`site.json` betöltése** a fenti paranccsal. Amit a tervező nem kérdez meg és
   nekünk kell hozzáírni: `content.texts{}`, `seoTitle`, `seoDescription`,
   `images[].alt`. A szolgáltatás-kártyákat (`content.services[]`) már az ügyfél
   tölti ki a tervezőben – ha ott minta-szöveg maradt, a betöltés szól érte.
3. **Jogi adatok** a `site.json` `legal` blokkjába és a domain a `meta.url`-be.
   Ez **nem opcionális**: enélkül az impresszum és az adatkezelési tájékoztató
   üresen marad, az oldal pedig így nem mehet élesbe (Ekertv. 4. §, GDPR).
   A `plan-to-site.mjs` tételesen felsorolja, mi hiányzik, és új terv
   betöltésekor megőrzi a már kitöltött blokkot – de **csak ha ugyanaz a cég**.
   Más cégnév esetén az ügyfél-adatok (név, székhely, cégjegyzék- és adószám,
   képviselő, elérhetőség) és a `meta.url` kiürülnek, hogy ne az előző ügyfél
   impresszumával menjen ki az oldal; a tárhely és a megőrzési idő marad.

   **Ha a `legal.retentionMonths` értékét megváltoztatod**, állítsd át a backend
   `.env`-jében a `DILAWEB_BOOKING_RETENTION` sort is ugyanarra. A tájékoztató
   ezt az időt ígéri a látogatónak, a napi ütemezés pedig ezt hajtja végre
   (`Booking::purgeOld()`) – ha a kettő eltér, az oldal valótlant állít.
4. **Képek** az `images/` mappába, a `site.json`-ban szereplő fájlnévvel.
   A fül-ikont nem kell kérni: a betöltés generál egy `images/favicon.svg`-t a
   cégnév monogramjából és a fő színből. Saját ikont ide másolj, és írd át a
   `<link rel="icon">` sorát az öt HTML-ben.
5. **Ellenőrzés:** `node test-site.mjs`, majd egy statikus szerverrel átnézés
   **360 px szélességen** – az a mérce, nem az 1440.
6. **Kiadás:** a `dilaweb_backend/scripts/new-site.sh` telepíti a tárhelyre a
   statikus oldalt és a Laravel backendet együtt. A dokumentumgyökér
   `.htaccess`-e (`scripts/docroot/htaccess.tpl`) hozza a biztonsági
   fejléceket, a 404-átirányítást és a `/api/` útvonalat – enélkül ne menjen ki
   semmi élesbe.

## Fájlok

| fájl | mire jó |
|---|---|
| `index.html` | az oldal váza – szöveg nincs benne, csak a helyek |
| `site.json` | **az ügyfél adata**: szöveg, szín, elrendezés, árak, szekciósorrend |
| `site.js` | a JSON-t az oldalra írja (tokenek, menü, képek, SEO) |
| `pv.css` | a kinézet – a középső blokk a tervezőből másolat, lásd lentebb |
| `foglalas.html` | fiókoldal: a vendég saját foglalásai (admin nézet NINCS, az a `dilaweb_admin`) |
| `impresszum.html` | **kötelező** – a szolgáltató adatai, a `legal` blokkból |
| `adatkezeles.html` | **kötelező** – adatkezelési tájékoztató, a `legal` blokkból |
| `404.html` | hibaoldal; a `.htaccess` `ErrorDocument` sora irányít ide |
| `sitemap.xml` | a `plan-to-site.mjs` generálja a `meta.url`-ből, nem kézi fájl |
| `peldak/` | két kész `site.json` kipróbálásra, nem megy ki élesbe |
| `tools/plan-to-site.mjs` | tervező-mentés betöltése + hiánylista + sitemap + megosztás-adatok |
| `tools/meta.mjs` | a besütött `<title>`, leírás és OG-mezők (a két generátor közös része) |
| `tools/build-pages.mjs` | aloldalak generálása a `pages[]`-ből |
| `booking.js`, `booking.css` | a foglalási varázsló – közös a tervező előnézetével |
| `booking-api.js` | a foglalás adaptere: a saját backend `/api/*` végpontjai |
| `test-site.mjs` | ellenőrzés: hiányzó id, ismeretlen felirat, rossz design-érték |
| `tools/sync-css.mjs` | a kinézet frissítése a tervezőből |
| `tools/sync-shared.mjs` | a közös fájlok (foglalás, backend) egyeztetése a tervezővel |

## A `site.json`

A tervező mentése (`buildData`) egy az egyben beilleszthető. Amit **mi teszünk
hozzá** az átadás előtt:

- `content.texts{}` – bármelyik állandó felirat felülírása (a kulcsok a `site.js`
  `I18N` táblájában vannak)
- `content.seoTitle`, `content.seoDescription` – böngészőcím és keresőleírás
- `content.images[].alt` – képleírás (akadálymentesség + SEO)
- `pages[].sections` – ha van aloldal: mi kerüljön rá (a tervező egy lapot
  szerkeszt, a vázat a betöltés készíti el)
- `content.services[i].image` – csak ha egy kártya SAJÁT képet kap; e nélkül a
  képlistából forog rá egy (a kártyák szövegét a tervező hozza)
- `sections[].href`, `sections[].sub[].href` – ha egy menüpont aloldalra visz

A feltöltött képek a JSON-ban csak **fájlnévként** szerepelnek; a `site.js` az
`images/` mappából veszi őket. Teljes URL és `/`-rel kezdődő útvonal marad úgy,
ahogy le van írva.

## Ha a tervezőben változik a kinézet

```bash
node tools/sync-css.mjs
```

Ez a tervező `src/site.css`-ét másolja a `pv.css` két `SYNC:PV` markere közé (ott
él a teljes arculat-rendszer; a `style.css`-ből ki van vágva, mert titkosítva
utazik). A markereken kívüli rész (reset, nap/hold ikon, görgetés, a fejléc
mobilon is látszó CTA gombja) kézi kód, ahhoz nem nyúl.

**A markupot nem szinkronizálja.** Ha a tervezőben új szekció vagy új `data-*`
kapcsoló kerül az előnézetbe, azt kézzel kell átvezetni az `index.html`-be és a
`site.js`-be. A `test-site.mjs` jelzi, ha egy `site.json`-érték olyan
CSS-szabályt kér, ami nincs meg.

### Mit igényel egy-egy tengely a markupból

A `site.js` `PV_FLAGS` listája teszi ki a `data-*` kapcsolókat a lap gyökerére –
ennek **egyeznie kell** a tervezőbeli listával, különben a tengely némán
kimarad, és az ügyfél mást kap, mint amit az előnézetben látott. Néhány
tengelynek markup is kell:

| tengely | mi kell hozzá | hol |
|---|---|---|
| `texture`, `bgDepth` | `<div class="pv-fx"><i></i><i></i></div>` | `index.html`, a `.pv-main` elején |
| `bgArt`, `bgMotion`, `bgSpot` | `<div class="pv-bg"><i></i><i></i><i></i></div>` | ugyanott, a `pv-fx` után |
| `flow` (fejezet, sín, indexlista) | `--pv-idx` a látható szekciókra | `site.js`, a sávozással egy körben |
| `sig: marquee` | `<div class="pv-ribbon">` + `#pv-ribbon` | `index.html`, a hero végén |
| `sig: echo`, `sig: glitch` | `data-echo` a `#pv-company`-n | `site.js` |
| `sig: emph` | `*csillagok*` → `<em class="pv-emph">` | `site.js` (`setRich`) |
| `sig: scribble`, `accent: ornament`, `texture: damask` | semmi – maszkos SVG a CSS-ben | `pv.css` (szinkronból) |
| „vissza a tetejére" gomb | `<button class="pv-top" id="pv-top">` | `index.html` és `foglalas.html`, a lábléc után |

### Elemlistás szekciók: galéria, csapat, GYIK + a négy bizalmi blokk

Ez a hét szekció **nincs benne az `index.html`-ben**: a `site.js` építi meg a
`LIST_SECS` táblából, a tartalmuk a `content.lists.<id>` tömbökben van
(`{ name, text, image }`). Üres listával nem jelennek meg, a sorrendjük a
`sections[]`-ből jön, mint minden más szekcióé.

| id | mit mutat | `name` | `text` | `image` |
|---|---|---|---|---|
| `gallery` | képrács | alt szöveg | – | ✓ |
| `team` | kártyák fotóval | név | szerep | ✓ |
| `faq` | nyíló kérdés-válasz | kérdés | válasz | – |
| `stats` | nagy számok | szám (pl. „12 év”) | mihez tartozik | – |
| `reviews` | vélemény-idézetek | aki mondta | az idézet | ✓ (avatar) |
| `process` | sorszámozott lépések | lépés címe | leírás | – |
| `logos` | vonuló partner-szalag | partner neve (alt) | – | ✓ |

**Új ilyen szekció** (blog-lista, tanúsítványok, csomagajánlatok): egy sor a
`LIST_SECS` táblába **mindkét oldalon** (tervező és termék), plusz három felirat
(`sec.<id>`, `pv.<id>Eyebrow`, `pv.<id>Title`) mindkét nyelven. HTML-t nem kell
írni hozzá; a `test-site.mjs` szól, ha egy felirat lemaradt.

### Aloldalak

A `site.json` `pages[]` tömbje írja le őket:

```json
"pages": [
  { "slug": "blog", "title": "Blog", "description": "…",
    "sections": [ { "id": "hero", "on": true }, { "id": "contact", "on": true } ] }
]
```

```bash
node tools/build-pages.mjs
```

Ez minden bejegyzéshez `<slug>.html`-t ír: az `index.html` másolatát
`<html data-page="<slug>">` jelöléssel. A `site.js` ebből tudja, hogy az adott
oldalon a `pages[]` szekciólistája és címe érvényes, és hogy a menü
szekció-linkjeit `index.html#sec-…` alakban kell kiírnia.

A menüpont a `sections[].href`-ből mutat az aloldalra. Ha a tervezőben valaki
aloldalnak jelölt egy menüpontot, a betöltés (`plan-to-site.mjs`) elkészíti a
`pages[]` vázát – **a szekciólistáját nekünk kell feltölteni**, mert a tervező
egyetlen lapot szerkeszt. A kikerült aloldal fájlját a generátor szándékosan nem
törli: azt kézzel kell, hogy egy elgépelt slug ne tüntessen el egy élő oldalt.

### A közös kód: `tools/sync-shared.mjs`

A foglalási varázsló és a backend **ugyanaz a kód** itt és a tervezőben. Ha
elcsúsznak, az ügyfél mást kap, mint amit a tervezőben látott – ez a script
mutatja meg és mozgatja:

```bash
node tools/sync-shared.mjs
```

Csak jelent, eltérésnél 1-es kilépéssel (így beköthető commit előtti
ellenőrzésbe). Másoláshoz kell az irány, opcionálisan egy fájlnév-részlettel:

```bash
node tools/sync-shared.mjs --pull booking.css
```

`--pull` = tervező → termék, `--push` = termék → tervező. A sorvégek (CRLF/LF)
nem számítanak eltérésnek. **Az irányt te döntöd el** – a script szándékosan nem
találgat, csak kiírja, melyik oldal a frissebb. A `pv.css` nincs a listán, annak
a blokkos `sync-css.mjs` a szinkronja.

## Időpontfoglalás

A varázsló **a főoldalba van ágyazva**, pontosan úgy, ahogy a tervező
előnézetében: a foglalás szekció maga a wizard, a fejléc gombja odagörget. A
`booking.js` és a `booking.css` csak akkor töltődik le, ha a `site.json`-ban
`booking.enabled` igaz.

A `foglalas.html` a **fiókoldal**: itt látja a bejelentkezett vendég a
saját foglalásait – a wizard „Foglalásaim" gombja visz ide. **Admin nézet itt
nincs**: a foglalásokat a tulajdonos a közös `dilaweb_admin` felületen kezeli,
két admin felületet nem üzemeltetünk ugyanarra.

**A háttere a saját backendünk** ([dilaweb_backend](../dilaweb_backend)), nem
Firebase: a `booking-api.js` a `/api/*` végpontokat hívja, azonos originről,
ezért CORS sincs. Ügyfelenkénti beállítás nincs ebben a repóban – a
szolgáltatásokat, a munkatársakat és a nyitvatartást a backend adja a
`/api/booking/config` válaszában.

Beüzemelés:

1. `dilaweb_backend/scripts/new-site.sh <domain> <tag> <tulaj-email>` – ez hozza
   létre a könyvtárat, az adatbázist, a `.env`-et, futtatja a migrációt és a
   seedet, és kiírja a tulajdonos belépési adatait.
2. A kiírt jelszót jelszókezelőn add át, majd töröld a `DILAWEB_OWNER_PASSWORD`
   sort a `.env`-ből.
3. Szolgáltatások, munkatársak, nyitvatartás: a `dilaweb_admin` felületen, a
   tulajdonos belépésével.
4. A modulkapcsolók (`DILAWEB_MOD_*`) a `.env`-ben dőlnek el – kikapcsolt modul
   nem csak rejtett fül, hanem lezárt végpont is.

Nincs foglalás az ügyfélnél? Elég a `site.json`-ban `booking.enabled: false` – a
modul akkor le sem töltődik.

## Eltérés a tervező előnézetétől

A cél, hogy a kész oldal **azonos legyen** az előnézettel. Ami szándékosan más:

| eltérés | miért |
|---|---|
| a lapot a böngésző görgeti, nem egy doboz | az előnézet keretben él, a kész oldal nem |
| a fejléc CTA gombja mobilon is látszik | az oldal egyetlen konverziós pontja (a tervezőben 44rem alatt elbújik) |
| a szolgáltatás-kártyák alapszövege magyar, nem Lorem ipsum | ügyfél elé kimenő oldalon a lorem veszélyesebb; `content.services[]` úgyis felülírja |
| `skip-link` a lap tetején | billentyűzetes navigáció, csak fókusznál látszik |

A mobil menü (hamburger + lenyíló panel) **már nem eltérés**: a tervező is ezt
használja, a szinkron hozza magával.

Minden más – tokenek, `data-*` kapcsolók, betűméret, térköz, animációk,
görgetés-érzet (1,1 mp easeOutCubic) – **egy az egyben a tervezőé**. Ha a
kinézeten változtatni kell, azt a tervezőben tedd, és futtasd a
`tools/sync-css.mjs`-t.

## Amit tudni érdemes

- **Mobil először.** A szekciók `cqi`-alapúak, a töréspontok `@container
  (min-width: …)`.
- **Sötét és világos** mód is él: a `site.json` mindkét palettát hozza, a fejléc
  gombja vált, a választás `localStorage`-ba kerül.
- **Fontok:** csak a ténylegesen használt két család töltődik le, a `site.js`
  rakja be a linket – ezért nincs 25 fontos `<link>` a `<head>`-ben.
- **JS nélkül és crawlernek** a `<title>`, a leírás és az OG-mezők a HTML-ben
  ÁLLNAK (a `plan-to-site.mjs` süti be őket a `META` markerek közé), a lap
  tetején pedig egy `<noscript>` blokk hozza a cégnevet és az elérhetőséget.
  Ez azért kell, mert a Facebook/Messenger crawlere nem futtat JavaScriptet –
  enélkül a megosztott link üresen jelenne meg. A szekciók tartalmát viszont
  továbbra is a `site.js` írja: teljes prerender nincs, két emberre és ennyi
  oldalra nem éri meg.
