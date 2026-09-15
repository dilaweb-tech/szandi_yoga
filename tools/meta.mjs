/* ==========================================================================
   BESÜTÖTT FEJ-ADATOK ÉS JS NÉLKÜLI TARTALÉK

   A közösségi crawler (Facebook, Messenger, LinkedIn, WhatsApp) NEM futtat
   JavaScriptet: amit a site.js ír a fejlécbe, azt nem látja. Megosztáskor
   ezért a HTML-ben ÁLLÓ cím, leírás és OG-kép látszik – ezt süti be a
   tools/plan-to-site.mjs (főoldal) és a tools/build-pages.mjs (aloldalak).

   A csere marker-párok között történik, ugyanaz a minta, mint a pv.css
   SYNC:PV blokkjánál: a markereken kívüli markuphoz semmi nem nyúl.
   ========================================================================== */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

/* A *csillagok* a lapon kiemelés-jelölők (sig="emph") – a fejlécben és a JS
   nélküli tartalékban csak a csillag tűnik el. */
const plain = (s) => String(s ?? "").replace(/\*([^*\n]+)\*/g, "$1");

/* A két marker közti rész cseréje. Hiányzó marker HIBA, nem néma kihagyás:
   különben egy jövőbeli markup-átírás után a besütés csendben elmaradna. */
export function block(html, name, body) {
  const a = `<!-- >>> ${name} -->`, b = `<!-- <<< ${name} -->`;
  const i = html.indexOf(a);
  if (i < 0 || !html.includes(b)) throw new Error(`Hiányzik a(z) ${name} marker a HTML-ből.`);
  const nl = html.includes("\r\n") ? "\r\n" : "\n";
  /* a záró marker a nyitó alá igazodik, a beírt sorvég a fájléhoz */
  const pad = html.slice(html.lastIndexOf("\n", i) + 1, i);
  const [head, rest] = html.split(a);
  return `${head}${a}${nl}${body.replace(/\r?\n/g, nl)}${nl}${pad}${b}${rest.split(b)[1]}`;
}

/* Az `url` és az `image` TELJES cím legyen: relatív OG-képet egyik közösségi
   oldal sem tölt be. Ami hiányzik, az a sorával együtt kimarad. */
export const metaTags = ({ title, desc, url, image, company, lang = "hu" }) => [
  `<title>${esc(plain(title))}</title>`,
  `<meta name="description" content="${esc(plain(desc))}">`,
  url && `<link rel="canonical" href="${esc(url)}">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:title" content="${esc(plain(title))}">`,
  `<meta property="og:description" content="${esc(plain(desc))}">`,
  url && `<meta property="og:url" content="${esc(url)}">`,
  image && `<meta property="og:image" content="${esc(image)}">`,
  company && `<meta property="og:site_name" content="${esc(plain(company))}">`,
  `<meta property="og:locale" content="${lang === "en" ? "en_US" : "hu_HU"}">`,
  `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
].filter(Boolean).map((line) => "  " + line).join("\n");

/* JS nélkül ma a helykitöltő szöveg állna a lapon („Cégnév", „Rövid leírás").
   Ez a blokk legalább azt megadja, amiért a látogató jött: kik vagyunk és hol
   érnek el minket. Az oldal saját osztályait használja, nincs külön stílus. */
export const noscriptBlock = (c = {}) => {
  const row = (label, value, href) => value
    ? `            <li><span class="pv-muted">${esc(label)}</span>` +
      (href ? `<a href="${esc(href)}">${esc(value)}</a>` : `<strong>${esc(value)}</strong>`) + `</li>`
    : "";
  const rows = [
    row("Elhelyezkedés", c.address),
    row("Telefon", c.phone, "tel:" + String(c.phone || "").replace(/[^+\d]/g, "")),
    row("E-mail", c.email, "mailto:" + (c.email || "")),
  ].filter(Boolean).join("\n");
  return `    <noscript>
      <section class="pv-section is-first">
        <div class="pv-wrap">
          <h1>${esc(plain(c.company) || "Cégnév")}</h1>
          <p class="pv-lead">${esc(plain(c.tagline))}</p>
          <ul class="pv-contact__list">
${rows}
          </ul>
          <p class="pv-muted">Az oldal teljes tartalmához engedélyezd a JavaScriptet a böngésződben.</p>
        </div>
      </section>
    </noscript>`;
};

/* OG-kép: TELJES cím kell hozzá, relatívat egyik közösségi oldal sem tölt be.
   A megosztott aloldal is a cég első képét viszi – az mutatja meg, kik vagyunk. */
export const ogImageOf = (c = {}, base = "") => {
  const src = String((c.images || [])[0]?.src || "").trim();
  return /^https?:/.test(src) ? src
    : base && src && !/^data:/.test(src) ? `${base}/images/${src}` : "";
};
