/* ==========================================================================
   A KÉSZ OLDAL STÍLUSA A TERVEZŐBŐL
   A tervező `src/site.css`-e az EGYETLEN forrás (ez a style.css kivágott 08.
   fejezete – titkosítva utazik az app.enc-ben). Ha ott változik a kinézet, itt
   egy futtatás és a termék is követi:

     node tools/sync-css.mjs [út/a/site.css-hez]

   A pv.css-ben csak a két marker közti rész cserélődik – a fölötte lévő reset
   és az alatta lévő termék-felülírások kézi kód, azokhoz nem nyúl.
   ========================================================================== */
import { readFile, writeFile } from "node:fs/promises";

const PLAN = new URL("../../dilaweb_sablon/", import.meta.url);
const SRC = process.argv[2] || new URL("src/site.css", PLAN);
const OUT = new URL("../pv.css", import.meta.url);
const START = "/* >>> SYNC:PV – generált, ne írd át kézzel <<< */";
const END = "/* <<< SYNC:PV <<< */";

/* A teljes fájl a forrás; az --ease token viszont a szerkesztő style.css-ében
   lakik (a site.css csak használja), ezért azt onnan olvassuk ki. */
const body = await readFile(SRC, "utf8");
const ease = (await readFile(new URL("style.css", PLAN), "utf8")).match(/--ease:\s*([^;]+);/)?.[1];
if (!body.trim() || !ease) throw new Error("Üres site.css, vagy nincs --ease token a style.css-ben.");

const out = await readFile(OUT, "utf8");
const [head, rest] = out.split(START);
const tail = rest?.split(END)[1];
if (tail === undefined) throw new Error("Hiányzik a SYNC:PV marker a pv.css-ből.");

await writeFile(OUT,
  `${head}${START}\n:root { --ease: ${ease}; }\n${body.trimEnd()}\n${END}${tail}`);

console.log(`pv.css frissítve (${body.split("\n").length} sor a tervezőből).`);
