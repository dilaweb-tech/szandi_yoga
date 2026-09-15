/* ==========================================================================
   Időpontfoglalás – a LESZÁLLÍTOTT oldal modulja (DilaWEB backend)

   Ez a fájl adja a REST-hátteret a közös varázslóhoz (booking.js): valódi
   foglalás, vendégfiók, profil. A wizard FELÜLETE nem itt van – az a
   booking.js-ben, a tervező előnézetével közösen. Itt csak az adapter
   cserélődik: demó adatok helyett a saját backend.

   A varázsló felülete és szövegei a tervezőével közösek (booking.js); ez a
   fájl csak az adatforrást cseréli demóról a saját backendre.

   Nincs bundler, nincs npm, nincs CDN: minden az ügyfél saját domainjéről
   jön. A backend AZONOS ORIGINEN fut (/api/*), ezért CORS sincs.

   Ügyfélenkénti beállítás NINCS ebben a fájlban: a nevet, a szolgáltatásokat,
   a munkatársakat és a nyitvatartást a /api/booking/config adja. Ha a backend
   máshol van, a lap `window.DILAWEB_API`-ban felülírhatja.
   ========================================================================== */
const API = (typeof window !== "undefined" && window.DILAWEB_API) || "";
const TOKEN_KEY = "dw:token";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
/* A főoldalon a varázsló be van ágyazva, de a fiók-fejléc (profil, nyelvváltó)
   csak a foglalas.html-en van meg – ezért minden fejléc-elemre csak akkor
   írunk, ha tényleg ott van. */
const on = (sel, fn) => { const el = $(sel); if (el) fn(el); };
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

/* --------------------------------------------------------------------------
   Nyelvi szótár – az oldal saját felületei (a varázsló szövegei a közös
   booking.js-ben vannak, azokat a Booking.I18N adja).
   -------------------------------------------------------------------------- */
const LV = {
  hu: {
    "lv.book": "Foglalás",
    "lv.profile": "Profilom",
    "lv.bookTitle": "Foglaljon időpontot",
    "lv.login": "Belépés",
    "lv.logout": "Kilépés",
    "lv.lang": "Nyelv váltása",
    "lv.loading": "Betöltés…",
    "lv.signInTitle": "Belépés",
    "lv.signUpTitle": "Regisztráció",
    "lv.email": "E-mail cím",
    "lv.pass": "Jelszó",
    "lv.name": "Név",
    "lv.phone": "Telefonszám",
    "lv.signIn": "Belépés",
    "lv.signUp": "Fiók létrehozása",
    "lv.toSignUp": "Még nincs fiókom",
    "lv.toSignIn": "Van már fiókom",
    "lv.forgot": "Elfelejtett jelszó",
    "lv.resetSent": "Elküldtük a jelszó-visszaállító levelet.",
    "lv.close": "Bezárás",
    "lv.errAuth": "Hibás e-mail cím vagy jelszó.",
    "lv.errUsed": "Ezzel az e-mail címmel már van fiók.",
    "lv.errWeak": "A jelszó legalább 6 karakter legyen.",
    "lv.errFields": "Kérjük, töltse ki az összes mezőt.",
    "lv.errNet": "Nincs internetkapcsolat. Próbálja újra.",
    "lv.myData": "Adataim",
    "lv.save": "Mentés",
    "lv.saved": "Az adatait elmentettük.",
    "lv.myBookings": "Foglalásaim",
    "lv.upcoming": "Közelgő időpontok",
    "lv.past": "Korábbi időpontok",
    "lv.noneUp": "Nincs közelgő időpontja.",
    "lv.nonePast": "Nincs korábbi időpontja.",
    "lv.needLogin": "Ehhez a nézethez be kell jelentkeznie.",
    "lv.cancel": "Lemondás",
    "lv.cancelAsk": "Biztosan lemondja ezt az időpontot? A lemondás nem vonható vissza.",
    "lv.cancelled": "Az időpontot lemondtuk, és e-mailben is jeleztük.",
    "lv.cancelErr": "A lemondás nem sikerült. Próbálja újra.",
  },
  en: {
    "lv.book": "Booking",
    "lv.profile": "My profile",
    "lv.bookTitle": "Book an appointment",
    "lv.login": "Sign in",
    "lv.logout": "Sign out",
    "lv.lang": "Switch language",
    "lv.loading": "Loading…",
    "lv.signInTitle": "Sign in",
    "lv.signUpTitle": "Register",
    "lv.email": "Email address",
    "lv.pass": "Password",
    "lv.name": "Name",
    "lv.phone": "Phone number",
    "lv.signIn": "Sign in",
    "lv.signUp": "Create account",
    "lv.toSignUp": "I don't have an account",
    "lv.toSignIn": "I already have an account",
    "lv.forgot": "Forgot password",
    "lv.resetSent": "We sent you a password reset email.",
    "lv.close": "Close",
    "lv.errAuth": "Wrong email address or password.",
    "lv.errUsed": "An account with this email already exists.",
    "lv.errWeak": "The password must be at least 6 characters.",
    "lv.errFields": "Please fill in every field.",
    "lv.errNet": "No internet connection. Please try again.",
    "lv.myData": "My details",
    "lv.save": "Save",
    "lv.saved": "Your details have been saved.",
    "lv.myBookings": "My bookings",
    "lv.upcoming": "Upcoming appointments",
    "lv.past": "Past appointments",
    "lv.noneUp": "You have no upcoming appointments.",
    "lv.nonePast": "You have no past appointments.",
    "lv.needLogin": "You need to sign in for this view.",
    "lv.cancel": "Cancel",
    "lv.cancelAsk": "Cancel this appointment? This cannot be undone.",
    "lv.cancelled": "The appointment was cancelled and we sent an email about it.",
    "lv.cancelErr": "The cancellation failed. Please try again.",
  },
};

const S = {
  lang: "hu",
  user: null,                 /* { id, name, email, phone } */
  cfg: { slot: 30, hours: {}, currency: "HUF" },
  services: [],
  staff: [],
  view: "book",
  authMode: "in",
};

const lv = (key, vars) => {
  let s = LV[S.lang][key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
};

const fmtWhen = () => new Intl.DateTimeFormat(S.lang, {
  timeZone: Booking.TZ, weekday: "short", month: "short", day: "numeric",
  hour: "2-digit", minute: "2-digit",
});

/* --------------------------------------------------------------------------
   REST réteg – EZ a különbség a tervező demójához képest

   A token a localStorage-ban él: a fiók kényelem, nem kapu. Mérési adatot
   viszont semmi nem tárol a kliensen (lásd stat.js).
   -------------------------------------------------------------------------- */
const token = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* privát mód */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* privát mód */ } },
};

/* Egyetlen helyen a hívás: fejlécek, hibakód-fordítás, JSON. A dobott Error
   `code` mezője az, amit a varázsló és az űrlapok néznek. */
async function api(path, opts = {}) {
  const t = token.get();
  let res;
  try {
    res = await fetch(API + path, {
      ...opts,
      headers: {
        Accept: "application/json",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(t ? { Authorization: "Bearer " + t } : {}),
        ...opts.headers,
      },
    });
  } catch {
    /* hálózati hiba – a lap ne omoljon össze tőle */
    throw Object.assign(new Error("offline"), { code: "offline" });
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return body;

  /* 401 a tokennel: elavult vagy visszavont – kezdjük tisztán */
  if (res.status === 401 && t) { token.clear(); S.user = null; }

  const code = res.status === 409 ? "taken"
    : res.status === 401 ? "auth"
    : res.status === 422 ? "invalid"
    : "unknown";
  throw Object.assign(new Error(code), { code, status: res.status, body });
}

/* --------------------------------------------------------------------------
   A varázsló adaptere: taken / submit / auth
   -------------------------------------------------------------------------- */
/* A naptár a személytelen foglaltság-tükröt kapja: csak slot-kulcsok jönnek,
   más ember neve / e-mailje / telefonja soha nem kerül ki a kliensre. */
async function taken(staffId, monday) {
  const data = await api(`/api/booking/taken?staff=${encodeURIComponent(staffId)}&week=${encodeURIComponent(monday)}`);
  return new Set(data?.taken || []);
}

/* A payload alakja a booking.js collect() függvényéből jön; a szerver csak
   ezt a hét mezőt fogadja el, az árat és a hosszt az adatbázisból veszi. */
async function submit(p) {
  await api("/api/bookings", {
    method: "POST",
    body: JSON.stringify({
      service_id: p.serviceId,
      staff_id: p.staffId,
      slot: p.slot,
      name: p.name,
      email: p.email,
      phone: p.phone,
      lang: p.lang,
    }),
  });
  /* Bejelentkezett foglalónál a profil is megkapja a friss elérhetőséget */
  if (S.user) await saveUser({ name: p.name, phone: p.phone }).catch(() => {});
}

const authState = { user: null, requestLogin: () => openAuth("in") };

function mountWizard() {
  Booking.mount($("#bk-root"), {
    data: {
      services: S.services, staff: S.staff,
      hours: S.cfg.hours, slot: S.cfg.slot, currency: S.cfg.currency,
    },
    lang: S.lang,
    taken, submit,
    auth: authState,
    /* A főoldalon a varázsló be van ágyazva, de profil-nézet nincs – ott a
       fiókoldalra visz. A fiókoldalon marad a helyben váltás. */
    onProfile: () => ($("#view-profile") ? show("profile") : (location.href = "foglalas.html")),
  });
}

/* --------------------------------------------------------------------------
   Felhasználó
   -------------------------------------------------------------------------- */
async function saveUser(patch) {
  if (!S.user) return;
  const me = await api("/api/me", {
    method: "PUT",
    body: JSON.stringify({ name: patch.name ?? S.user.name, phone: patch.phone ?? S.user.phone }),
  });
  setUser(me);
}

function setUser(me) {
  S.user = me ? { id: me.id, name: me.name || "", email: me.email, phone: me.phone || "" } : null;
  authState.user = S.user;
  syncChrome();
  $("#bk-root").refresh?.();
  if (S.view !== "book") show(S.view);
}

/* Indulásnál: van-e még érvényes token. Lejárt tokennél az api() takarít. */
async function loadUser() {
  if (!token.get()) return setUser(null);
  try { setUser(await api("/api/me")); } catch { setUser(null); }
}

async function doLogout() {
  try { await api("/api/logout", { method: "POST" }); } catch { /* a token akkor is menjen */ }
  token.clear();
  setUser(null);
}

/* --------------------------------------------------------------------------
   Belépés / regisztráció
   -------------------------------------------------------------------------- */
function openAuth(mode) {
  S.authMode = mode;
  $("#auth-title").textContent = lv(mode === "in" ? "lv.signInTitle" : "lv.signUpTitle");
  $("#auth-submit").textContent = lv(mode === "in" ? "lv.signIn" : "lv.signUp");
  $("#auth-toggle").textContent = lv(mode === "in" ? "lv.toSignUp" : "lv.toSignIn");
  $("#auth-extra").hidden = mode === "in";
  $("#auth-msg").textContent = "";
  $("#auth-dlg").showModal();
  $("#auth-email").focus();
}

/* A szerver mezőnkénti hibát ad (422); ebből választjuk ki, mit írunk ki.
   A belépés SZÁNDÉKOSAN egyetlen üzenetet ad: ne lehessen fiókot felderíteni. */
function authMessage(err) {
  if (err?.code === "offline") return lv("lv.errNet");
  if (err?.code === "auth") return lv("lv.errAuth");
  const fields = err?.body?.errors || {};
  if (fields.email?.some?.((m) => /taken|foglalt|már/i.test(m))) return lv("lv.errUsed");
  if (fields.password) return lv("lv.errWeak");
  if (Object.keys(fields).length) return lv("lv.errFields");
  return lv("lv.errAuth");
}

async function doAuth(e) {
  e.preventDefault();
  const email = $("#auth-email").value.trim();
  const pass = $("#auth-pass").value;
  const name = $("#auth-name").value.trim();
  const phone = $("#auth-phone").value.trim();
  const msg = $("#auth-msg");

  if (!email || !pass || (S.authMode === "up" && (!name || !phone))) {
    msg.textContent = lv("lv.errFields");
    return;
  }
  $("#auth-submit").disabled = true;
  try {
    const path = S.authMode === "in" ? "/api/login" : "/api/register";
    const body = S.authMode === "in"
      ? { email, password: pass }
      : { name, email, phone, password: pass, password_confirmation: pass };

    const res = await api(path, { method: "POST", body: JSON.stringify(body) });
    token.set(res.token);
    setUser(res);
    $("#auth-dlg").close();
    $("#auth-form").reset();
  } catch (err) {
    msg.textContent = authMessage(err);
  } finally {
    $("#auth-submit").disabled = false;
  }
}

async function doReset() {
  const email = $("#auth-email").value.trim();
  if (!email) return ($("#auth-msg").textContent = lv("lv.errFields"));
  try {
    /* A szerver mindig ugyanazt válaszolja – a visszajelzés sem árulja el,
       van-e ilyen fiók. A levelet a Fortify küldi. */
    await api("/api/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    $("#auth-msg").textContent = lv("lv.resetSent");
  } catch (err) {
    $("#auth-msg").textContent = authMessage(err);
  }
}

/* --------------------------------------------------------------------------
   Nézetek

   ponytail: admin (heti) nézet ITT NINCS. A tulajdonos eszköze a közös admin
   felület (dilaweb_admin) – két admin felületet nem üzemeltetünk ugyanarra.
   -------------------------------------------------------------------------- */
function show(view) {
  S.view = view;
  $$("[id^='view-']").forEach((el) => (el.hidden = el.id !== "view-" + view));
  $$("[data-view]").forEach((b) => b.setAttribute("aria-current", b.dataset.view === view ? "page" : "false"));
  if (view === "profile") renderProfile();
}

function bookingRow(b, cancellable) {
  const when = fmtWhen().format(new Date(b.startsAt));
  return `<li class="lv-row">
      <div>
        <strong>${esc(when)}</strong>
        <span class="lv-row__meta">${esc(b.service || "")}${b.staff ? " · " + esc(b.staff) : ""}</span>
      </div>
      ${cancellable ? `<button type="button" class="bk-btn bk-btn--ghost" data-cancel="${esc(b.id)}">${esc(lv("lv.cancel"))}</button>` : ""}
    </li>`;
}

async function renderProfile() {
  const box = $("#profile-body");
  if (!S.user) return (box.innerHTML = `<p class="bk-muted">${esc(lv("lv.needLogin"))}</p>`);
  box.innerHTML = `<p class="bk-muted">${esc(lv("lv.loading"))}</p>`;

  /* Csak a SAJÁT foglalásai – a végpont ugyanezt kényszeríti ki, tehát más
     kéréssel sem lehet másét látni. */
  let rows = [];
  try { rows = await api("/api/bookings/mine"); } catch { /* üres lista marad */ }
  rows = (rows || []).filter((b) => b.status !== "cancelled" && b.status !== "rejected");

  const now = Date.now();
  const up = rows.filter((r) => new Date(r.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const past = rows.filter((r) => new Date(r.startsAt).getTime() < now)
    .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));

  box.innerHTML = `
    <h3 class="lv-h">${esc(lv("lv.myData"))}</h3>
    <form class="lv-form" id="profile-form">
      <label class="bk-field"><span>${esc(lv("lv.name"))}</span>
        <input type="text" id="pf-name" value="${esc(S.user.name)}" autocomplete="name"></label>
      <label class="bk-field"><span>${esc(lv("lv.email"))}</span>
        <input type="email" value="${esc(S.user.email)}" readonly></label>
      <label class="bk-field"><span>${esc(lv("lv.phone"))}</span>
        <input type="tel" id="pf-phone" value="${esc(S.user.phone)}" autocomplete="tel"></label>
      <button type="submit" class="bk-btn bk-btn--primary">${esc(lv("lv.save"))}</button>
      <p class="lv-msg" id="pf-msg" role="status" aria-live="polite"></p>
    </form>

    <h3 class="lv-h">${esc(lv("lv.upcoming"))}</h3>
    <ul class="lv-list">${up.length ? up.map((b) => bookingRow(b, true)).join("")
      : `<li class="bk-muted">${esc(lv("lv.noneUp"))}</li>`}</ul>

    <h3 class="lv-h lv-h--past">${esc(lv("lv.past"))}</h3>
    <ul class="lv-list lv-list--past">${past.length ? past.map((b) => bookingRow(b, false)).join("")
      : `<li class="bk-muted">${esc(lv("lv.nonePast"))}</li>`}</ul>`;

  $("#profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await saveUser({ name: $("#pf-name").value.trim(), phone: $("#pf-phone").value.trim() });
      $("#pf-msg").textContent = lv("lv.saved");
    } catch (err) {
      $("#pf-msg").textContent = authMessage(err);
    }
  });
}

/* Lemondás: a szerver a sávot is felszabadítja, és levelet küld.
   Visszavonhatatlan, ezért natív megerősítő kérdés áll előtte. */
async function cancelBooking(id, msgEl) {
  if (!confirm(lv("lv.cancelAsk"))) return;
  try {
    await api(`/api/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (msgEl) msgEl.textContent = lv("lv.cancelled");
    renderProfile();
  } catch {
    if (msgEl) msgEl.textContent = lv("lv.cancelErr");
  }
}

/* --------------------------------------------------------------------------
   Fejléc és nyelv
   -------------------------------------------------------------------------- */
function syncChrome() {
  on("#nav-profile", (el) => (el.hidden = !S.user));
  on("#auth-btn", (el) => (el.textContent = lv(S.user ? "lv.logout" : "lv.login")));
  if (!S.user && S.view === "profile") show("book");
}

function applyLang(next) {
  S.lang = LV[next] ? next : "hu";
  document.documentElement.lang = S.lang;
  $$("[data-lv]").forEach((el) => (el.textContent = lv(el.dataset.lv)));
  $$("[data-lv-label]").forEach((el) => el.setAttribute("aria-label", lv(el.dataset.lvLabel)));
  on("#lang-btn", (el) => (el.textContent = S.lang === "hu" ? "EN" : "HU"));
  try { localStorage.setItem("bk:lang", S.lang); } catch { /* privát mód */ }
  syncChrome();
  mountWizard();                       /* a varázsló szövegei is váltanak */
  if (S.view !== "book") show(S.view);
}

/* --------------------------------------------------------------------------
   Indulás
   -------------------------------------------------------------------------- */
async function init() {
  let savedLang;
  try { savedLang = localStorage.getItem("bk:lang"); } catch { /* privát mód */ }

  /* Egyetlen kérés adja az egész indulóadatot – ügyfélenkénti JS-fájl nincs. */
  const cfg = await api("/api/booking/config").catch(() => null);
  if (cfg) {
    S.cfg = { slot: Number(cfg.slot) || 30, hours: cfg.hours || {}, currency: cfg.currency || "HUF" };
    S.services = cfg.services || [];
    S.staff = cfg.staff || [];
  }

  applyLang(savedLang === "en" ? "en" : savedLang === "hu" ? "hu" : (navigator.language || "hu").startsWith("hu") ? "hu" : "en");
  await loadUser();

  /* Egy figyelő az egész oldalra – ugyanaz a minta, mint a tervezőben */
  document.addEventListener("click", (e) => {
    const view = e.target.closest("[data-view]");
    if (view) return show(view.dataset.view);

    const cancel = e.target.closest("[data-cancel]");
    if (cancel) return cancelBooking(cancel.dataset.cancel, $("#pf-msg"));
  });

  $("#auth-btn")?.addEventListener("click", () => (S.user ? doLogout() : openAuth("in")));
  $("#lang-btn")?.addEventListener("click", () => applyLang(S.lang === "hu" ? "en" : "hu"));

  $("#auth-form").addEventListener("submit", doAuth);
  $("#auth-toggle").addEventListener("click", () => openAuth(S.authMode === "in" ? "up" : "in"));
  $("#auth-forgot").addEventListener("click", doReset);
  $("#auth-close").addEventListener("click", () => $("#auth-dlg").close());
}

init();
