Ide kerülnek az ügyfél képei, a `site.json`-ban megadott fájlnévvel.

- a `content.images[].src` és a `content.references[].image` fájljai
- az elemlistás szekciók (galéria, csapat, vélemények, partnerlogók) képei
- a logó, ha a `content.logo` fájlnevet ad meg

A **`favicon.svg` generált fájl**: a `tools/plan-to-site.mjs` írja a cégnév
monogramjából és a fő színből, tehát ikont nem kell kérni az ügyféltől. Saját
ikonhoz másold ide a fájlt, és írd át a `<link rel="icon">` sorát az öt
HTML-ben (`index`, `foglalas`, `impresszum`, `adatkezeles`, `404`).

Hiányzó képnél az oldal generált színátmenetes helykitöltőt mutat, tehát az
elrendezés nem esik szét – de ügyfél elé így nem megy ki. Az OG-kép (a
megosztott link előnézete) a `content.images[0]`: ha az hiányzik, a linkből
kimarad a kép.
