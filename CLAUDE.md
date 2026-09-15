# Munkamódszer ebben a projektben

> Ez az "alkotmány". Minden feladatnál érvényes, felülír minden alapértelmezést.

## Alapelvek
- **Cél:** precíz, igényes, látványos eredmény – minimális tokenből.
- Kód > beszéd. A chatben csak a lényeg, pár szavas mondatok.
- Minőség nem alkuképes, szószám igen.

## Válaszok – kemény limit
**A chat-válasz tokenje elvesztegetett token.** A munka a kódban van, nem a szövegben. Ez nem stílus-kérés, hanem költség-korlát.

- **Max 3 sor.** Kódolás után: mit csináltál (1 sor) + ha kell, mit hagytál ki (1 sor). Ennyi.
- Ha egy mondattal is elmondható, egy mondat legyen. Ha egy szóval: egy szó ("Kész.").
- Felsorolás > bekezdés. Ha a magyarázat hosszabb, mint a kód, töröld a magyarázatot.
- **Tilos**: feature-túra, terv-ismertetés, "most azt fogom csinálni…", saját munka összefoglalása, önértékelés, dicsérés, a kód újramesélése szövegben, már megbeszéltek ismétlése, kódrészlet bemásolása a chatbe (a fájlban van).
- Ne kérdezz vissza, ha a józan ész eldönti. Válassz, csináld meg, egy sorban jelezd.
- Kivétel: ha kifejezetten leírást, riportot, magyarázatot vagy tervet kérek – azt add meg teljesen, terjedelmi korlát nélkül.

## Munka
- **A fő munka a programozás**, nem a válaszadás. Kódolj, ne prezentálj.
- Használd a feladathoz **releváns skilleket és pluginokat** – ha van hozzá skill, azt hívd, ne improvizálj. A teljes lista a **Skillek és pluginok** szekcióban.
- Előbb olvasd végig, amit módosítasz, utána a legrövidebb működő megoldás.
- A meglévő kód stílusát kövesd: magyar kommentek, ugyanaz a sűrűség és névadás.

## Skillek és pluginok – automatikusan
**Bármelyik skillt/plugint hívd kérés nélkül, ha úgy ítéled, hogy kell.** Nincs engedélykérés, nincs rákérdezés – te döntesz. Én is kérhetem dedikáltan; olyankor azt használd.

| Feladat | Skill / plugin |
|---|---|
| Bármi kódolás | `ponytail` (mindig aktív, legrövidebb működő megoldás) |
| Bármi vizuális | lásd **Design** szekció |
| Ismerős feladat, "ezt már megoldottuk" | `claude-mem:mem-search` – lásd **Memória** szekció |
| Kód felderítése, hol van X | `claude-mem:smart-explore` Grep/Glob/Read helyett |
| Word / Excel / PDF / PPT | `docx` / `xlsx` / `pdf` / `pptx` |
| Claude API, modellnevek, árak | `claude-api` – soha ne fejből |
| SQL, adatelemzés | `data:*` skillek |
| Kód átnézés – **hibára** | `code-review` |
| Kód átnézés – **bloatra** | `simplify`, `ponytail-review` |
| Auth, belépőkód, ügyfél-adat változott | `security-review` – élesítés előtt kötelező |
| Architektúra-audit, duplikált rendszerek | `claude-mem:pathfinder` |
| Egész repo bloat-vadászat | `ponytail-audit`; a lerakott `ponytail:` adósság: `ponytail-debt` |
| Új skill / plugin / hook | `plugin-dev:*`, `skill-creator` |
| Hook, permission, `settings.json` | `update-config` |
| Sok engedélykérés zavar | `fewer-permission-prompts` |
| Ismétlődő / ütemezett futtatás | `loop`, `schedule` |
| Automatizálás-ötletek a repóra | `claude-code-setup:claude-automation-recommender` |
| Memória-fájlok rendrakása | `consolidate-memory` |

- A tábla nem teljes lista, csak a gyakoriak. Ami a listádon van és passzol, azt is hívd.
- Nem tudod, van-e skill? Nézd a listát, ne improvizálj.
- Kis, egyértelmű feladatnál ne hívj skillt – az is token. Ez az egyetlen fék: arány, nem engedély.
- **Kivétel – subagent**: `Agent` tool és a subagentet indító skillek (`do`, workflow-k) csak kifejezett kérésre. Hidegen indul, drága.
- **Tiltva – `run`**: ez a skill elindítaná az appot. Ebben a projektben nincs előnézet (lásd **Ellenőrzés**), az eredmény szövegben megy.

### A projekt saját eszközei
| Mikor | Mi | Hol |
|---|---|---|
| Új szakma felvétele a sablonba | `new-trade` skill | `.claude/skills/new-trade/` |
| Ügyfél-ajánlat, díjajánlat | `ajanlat-generator` skill | `.claude/skills/ajanlat-generator/` |
| Marketing-videó, ügyfél-demó | `hyperframes:*` | telepítve, kérésre |

- A hook-scriptek (`.claude/hooks/`) **be vannak kötve**: `pack-app-guard.ps1` (a `src/` bármelyik forrása után `pack-app.js --push`) és `protect-generated.ps1` (generált/titkos fájl kézi szerkesztésének tiltása).
- Két `settings.json` köti be őket: `dilaweb_sablon/.claude/` (ha innen indul a session) és `C:\DilaWEB\.claude/` (ha a szülőmappából). Utóbbi azért kell, mert a session gyökerén kívüli `.claude/` nem töltődik be. Ha a hook nem fut, a session gyökere a hibás – vagy indíts újat, vagy futtasd kézzel a `--push`-t.

## Memória (claude-mem)
Hookokból magától fut: minden Read/Edit/Bash megfigyeléssé tömörül, session végén összegződik, a következő sessionbe visszainjektálódik. Adat: `~/.claude-mem` (SQLite, gépen marad).

- **Ne dolgozz ellene**: ha a session eleji kontextus már megválaszol valamit, ne olvasd újra a fájlt.
- **A memória nem forrás**: ami régi megfigyelésből jön, azt kódban ellenőrizd, mielőtt ráépítesz.
- Ez a plugin **minden tool-hívás után** összegez → a sok apró, felesleges tool-hívás itt dupla költség. Kevesebb, célzottabb hívás.

| Mikor | Skill | Megjegyzés |
|---|---|---|
| Feladat előtt, ha ismerősen hangzik | `mem-search` | egy hívás, mielőtt bármit olvasnál |
| "Hol van X?", struktúra-keresés | `smart-explore` | AST-alapú, tört annyi token, mint a Read |
| Nagyobb, több fázisú feature | `make-plan` | tervezhetsz magadtól; a `do` végrehajtás subagentes → kérésre |
| Ügyfél elé menő UI kritikája | `design-is` | Rams-audit, a **Design** szekció után |
| Új nagy modul, teljes repo betanítás | `learn-codebase` | egyszer, indokolt esetben – teljes repót olvas |
| Fogalom / rendszer elmagyarázása | `what-the` | ha magyarázatot kértem |
| Duplikált rendszerek, refaktor előtti térkép | `pathfinder` | feature-csoportos flowchart + egyesítési javaslat |

- `timeline-report`, `weekly-digests`, `wowerpoint`, `knowledge-agent`, `standup`, `babysit`, `oh-my-issues`: riport-jellegűek, akkor hívd, ha tényleg az kell.
- Megfigyelések magyarul: `mode-creator` → `code--hu` mód. Egyszeri beállítás.

## Design – ez a projekt lelke
Vizuális output **soha ne fejből** készüljön. Kódolás **előtt** töltsd be a skillt.

### Mobile-first – ez az elsődleges szabály
**Minden felület mobilra készül először**: a tervező weboldal (admin, szerkesztő, saját site) és a legenerált ügyfél-oldalak is. Kivétel nincs.

- Alap CSS = mobil layout. Desktop csak `min-width` media query-ben, felfelé bővítve. `max-width` breakpoint tilos.
- Ha nem fér el mobilon, akkor a terv rossz – ne desktopra tervezz és zsugorítsd.
- Érintésre méretezz: min. 44px tap target, hüvelykujjal elérhető fő akciók, hover-függő funkció nincs.
- Egy oszlop az alap, több oszlop csak felfelé. Táblázat mobilon kártya vagy saját `overflow-x:auto` doboz.
- Teljesítmény is mobile-first: kép `srcset`/lazy, kevés font-fájl, ne blokkoljon script a rendereléssel.
- Kész az a UI, ami 360px szélességen működik – ott nézd át, ne 1440-en.

| Mit csinálsz | Skill / tool | Mikor |
|---|---|---|
| Új UI, arculat, landing, ügyfél elé menő felület | `frontend-design` | **legelső lépés**, minden más design-skill előtt – ez adja az irányt |
| Bármilyen chart, graf, KPI-csempe, dashboard | `dataviz` | **az első sor chart-kód előtt**, minden médiumban (SVG, HTML, Recharts, matplotlib, d3) |
| Megosztható HTML oldal (Artifact) | `artifact-design` | kötelező, mielőtt az `Artifact` toolt hívod |
| Élő adat / megosztott state / önfrissítő oldal | `artifact-capabilities` | `capabilities` vagy `window.claude.*` előtt |
| Gyors inline vizuál a chatben | `mcp__visualize__show_widget` | előtte egyszer `read_me` a kellő modullal (`diagram`, `mockup`, `interactive`, `data_viz`, `chart`, `art`) |
| Folyamatábra, architektúra | mermaid (```mermaid fence) vagy `show_widget` diagram-modul | ne rajzolj kézzel SVG-t, ha mermaid megoldja |
| Diagram **Artifactba** | `artifact-diagramming` | inline SVG mechanika, light+dark – `artifact-design` helyett/mellett |
| Slide / prezentáció | `pptx` | .pptx bármilyen érintése |

### Sorrend – irány, aztán kivitelezés
`frontend-design` (mit akarunk) → `dataviz` / `artifact-design` (hogyan rajzoljuk) → kód → `design-is` (Rams-audit, ha ügyfél elé megy).

- **`frontend-design`**: paletta 4–6 nevesített hex, 2+ betűtípus-szerep, layout-koncepció, **egy** signature elem. Előbb a terv, csak utána CSS.
- Kerüld az AI-alapértelmezéseket: krém háttér + serif + terrakotta; fekete + neonzöld; hajszálvonalas újság-layout. Ha nem a brief kéri, ne ezek legyenek.
- A merészséget **egy** helyre tedd, körülötte csend. Egy dísz mindig kerüljön le a végén.
- **Sablon-kikötés**: az arculat CSS-változó, ne beégetett érték. Új ügyfél = tokencsere, ne újratervezés. A signature elem is konfigurálható legyen.
- Szöveg is design: aktív ige, gombfelirat = ami történik ("Mentés", nem "Küldés"), üres állapot cselekvésre hív, hibaüzenet megoldást mond.
- Kis, meglévő rendszerbe illő módosítás (egy gomb, egy térköz) → nem kell `frontend-design`.

### Animált elemek – források
Mozgás és háttér **ne fejből** készüljön; ezekből induljunk ki:

| Forrás | Mire jó | Hogyan használd |
|---|---|---|
| https://motion-primitives.com/ | Kész motion-minták: reveal, stagger, hover, morph, szöveg-animációk | React/Framer Motion a forrás – itt **az effekt logikáját** vedd át vanilla CSS/JS-be, a függőséget ne |
| https://haikei.app/ | Generált SVG háttérelemek: blob, hullám, mesh-gradient, grain, low-poly | Exportált SVG **inline**, a szín `currentColor` vagy CSS-változó legyen – így megy a paletta-váltás |

- A sablon-tervező háttereihez a haikei a default forrás: egy SVG, változó-vezérelt szín, szakma-preset szerint cserélhető.
- Egy oldalon **egy** hangsúlyos animáció. A többi csendben marad.
- `prefers-reduced-motion: reduce` esetén kapcsold ki – ez nem opció.
- Mobilon a mozgás olcsó legyen: `transform`/`opacity`, ne layout-ot mozgass.

### Design-minőség küszöb
- **Egy rendszer legyen**, ne halom komponens: közös paletta, tipográfia, térköz-skála.
- **Light + dark** mindkettő működjön (`prefers-color-scheme` + `[data-theme]` override).
- **Reszponzív, mobile-first**: relatív egységek, grid/flex, `min-width` breakpointok; széles tartalom saját `overflow-x:auto` dobozban – a body sose görgessen vízszintesen.
- **Akadálymentesség**: kontraszt, fókusz-állapot, `alt`, billentyűzet – ezt sose egyszerűsítsd el.
- **Önhordó**: Artifactban minden CSS/JS inline, kép `data:` URI. Külső CDN tilos (CSP blokkol).
- Szín ne csak szín legyen: sorrend, forma, felirat is hordozza az információt.

### Design-arány
- Kis vizuál (egy ikon, egy badge) → skill nélkül, kézzel.
- Bármi, ami több elemből álló rendszer vagy megosztásra megy → skill, kivétel nincs.

## Token-takarékosság
- Csak azt olvasd, ami kell: `Grep`/`Glob` célzottan, ne teljes fájlt találomra.
- Struktúra-felderítéshez `smart-explore` (`smart_search` → `smart_outline` → `smart_unfold`) a Glob→Grep→Read kör helyett; teljes fájlt csak akkor, ha módosítod.
- Mielőtt felderítesz: `mem-search` – hátha korábbi sessionben már megvan.
- `node_modules` soha.
- Ne olvasd vissza, amit épp írtál – ha az Edit lefutott, kész van.
- Független tool-hívások egy blokkban, párhuzamosan.
- Ne ismételd a már megbeszélteket, ne foglald össze a saját munkádat.
- Skill hívása olcsó, a rossz megoldás drága – kétség esetén hívd a skillt.
- Agent/subagent viszont csak kifejezett kérésre – hidegen indul, drága.

## Ellenőrzés
- Változtatás után futtasd az érintett teszteket (`node test-*.mjs`).
- `src/app.html` vagy `src/app.js` módosítása után: **`node admin/pack-app.js --push`** – kérdés nélkül. A `--push` nélküli csomagolás nem jut el a belépőkódhoz.
- **Ne szerkeszd kézzel**: `app.enc` (generált), `admin/service-account.json`, `admin/app-key.txt` (titkos kulcsok).
- Auth / belépőkód / ügyfél-adat érintve → `security-review` élesítés előtt.
- Ne indíts szervert, böngésző-panelt, ne csinálj screenshotot – az eredmény szövegben megy. A `run` skill ezért tiltott.

## Végcél
**Eladható, profitábilis üzleti modell** a projekten keresztül. Nem hobbi, nem demó – termék.

- **Ketten visszük**: te (fejlesztés + döntés) és én (kivitelezés). Nincs csapat, nincs kézi üzemeltetés.
- Minden döntésnél a kérdés: *ez elad, tart vagy pénzbe kerül?*
- **Ügyfél előtt**: ami a vevő szeme elé kerül, az legyen kész és igényes – ott nincs "majd később".
- **Alacsony üzemeltetés**: ami két embert éjjel felébreszt, azt ne építsük meg. Automatizálás > manuális folyamat.
- **Sokszorosítható**: sablon, nem egyedi fejlesztés. Új ügyfél = konfiguráció, ne kódolás.
- **Költség számít**: futtatási, API- és tárolási költség legyen ismert és skálázható – ez a haszonkulcs.
- Az egyszerűség itt üzleti érdek: kevesebb kód = kevesebb hiba = kevesebb support = több profit.
