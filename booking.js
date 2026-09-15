/* ==========================================================================
   DilaWEB – Időpontfoglalás: KÖZÖS foglalási varázsló

   Ez az egyetlen fájl adja a wizardot a tervező élő előnézetében ÉS a
   leszállított ügyféloldalon. Nincs benne se Firebase, se demó adat: minden
   adat az adapteren jön be (opts.taken / opts.submit / opts.auth), így a
   kettő között CSAK az adatforrás cserélődik, a felület azonos.

   Klasszikus script (nem modul), mert a tervező kódja titkosított csomagból
   `<script>` textContentként fut – ott nincs import. A globális `Booking`
   objektum a tervezőnek, a leszállított oldal ESM moduljának és a
   node-os tesztnek (test-booking.mjs) egyaránt jó.

   Időzóna: minden falióra-idő Europe/Budapest. A slotok azonosítója helyi
   falióra-sztring ("2026-08-03T10:00") – ez időzóna- és nyári időszámítás-
   független azonosság; a tárolt timestamp UTC (lásd zonedToUTC).
   ========================================================================== */
(() => {
  "use strict";

  const TZ = "Europe/Budapest";
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  /* Az ár szabad szöveg, a pénznem viszont választható – a jelölés itt egy
     helyen van, hogy a tervező, a wizard és a kész oldal ugyanazt írja ki. */
  const CURRENCY = { HUF: "Ft", EUR: "€", USD: "$" };

  /* A felhasználó szövege sablonliterálba kerül – szövegként és idézőjeles
     attribútumban is biztonságos (ugyanaz a szabály, mint a tervezőben). */
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  /* ------------------------------------------------------------------------
     Dátum- és időszámítás. Naptárkönyvtár helyett: a napokat DÁTUM-SZTRINGgel
     tartjuk nyilván, a Date-et csak UTC délben léptetjük – így se a böngésző
     zónája, se a nyári időszámítás nem tud elcsúsztatni egy napot.
     ------------------------------------------------------------------------ */
  const pad = (n) => String(n).padStart(2, "0");
  const cursor = (ymd) => new Date(ymd + "T12:00:00Z");
  const asYmd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

  const shiftDay = (ymd, n) => {
    const d = cursor(ymd);
    d.setUTCDate(d.getUTCDate() + n);
    return asYmd(d);
  };
  /* 0 = hétfő (magyar hetesorrend) */
  const dowMon0 = (ymd) => (cursor(ymd).getUTCDay() + 6) % 7;
  const weekStart = (ymd) => shiftDay(ymd, -dowMon0(ymd));

  const toMin = (hhmm) => {
    const [h, m] = String(hhmm).split(":");
    return Number(h) * 60 + Number(m || 0);
  };
  const toHhmm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

  /* Mennyit mutat a zóna egy adott UTC pillanatban (ms) */
  function tzOffset(utcMs) {
    const p = {};
    for (const part of new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(utcMs)) p[part.type] = part.value;
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - utcMs;
  }

  /* Falióra-idő (Europe/Budapest) -> UTC pillanat. A második kör a nyári
     időszámítás váltásának óráján javítja az első becslés egyórás hibáját. */
  function zonedToUTC(slotKey) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(slotKey);
    if (!m) return null;
    const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return new Date(naive - tzOffset(naive - tzOffset(naive)));
  }

  /* "most" a zóna faliórája szerint, slot-kulcs formában – így a múltbeli
     slot egyszerű sztring-összehasonlítás, nincs benne zónakonverzió. */
  function nowKey(at = Date.now()) {
    const off = tzOffset(at);
    return new Date(at + off).toISOString().slice(0, 16);
  }
  const todayLocal = (at = Date.now()) => nowKey(at).slice(0, 10);

  /* Egy nap szabad/foglalt/múltbeli slotjai. A szolgáltatás TELJES hosszának
     szabadnak kell lennie, nem csak a kezdő slotnak – különben egy 60 perces
     kezelés után a 30 perccel későbbi slot még foglalhatónak látszana. */
  function slotsForDay({ dayKey, date, hours, slotMin, durationMin, taken, now }) {
    const h = hours?.[dayKey];
    if (!h || h.closed || !h.open || !h.close) return [];
    const open = toMin(h.open), close = toMin(h.close);
    if (!(close > open)) return [];

    const step = slotMin > 0 ? slotMin : 30;
    const need = Math.max(step, Math.ceil((durationMin || step) / step) * step);
    const out = [];
    for (let m = open; m + need <= close; m += step) {
      const key = `${date}T${toHhmm(m)}`;
      let blocked = false;
      for (let k = m; k < m + need && !blocked; k += step) blocked = taken.has(`${date}T${toHhmm(k)}`);
      out.push({ time: toHhmm(m), key, state: key < now ? "past" : blocked ? "taken" : "free" });
    }
    return out;
  }

  /* Munkatárs arcképe. A forrás IDEGEN adat (backend-válasz vagy betöltött
     terv), ezért csak valódi képhivatkozás mehet a src-be – a `javascript:` és a
     `data:text/html` így nem tud bejutni. Kép nélkül a névkezdőbetűk állnak ott,
     hogy a kártya ne legyen üres kör. */
  const photoOk = (s) => /^(https?:\/\/|\/(?!\/)|data:image\/)/i.test(String(s || ""));
  const initials = (n) => String(n || "").trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0] || "").join("").toUpperCase();

  /* A foglalás dokumentum-azonosítója SZÁNDÉKOSAN determinisztikus: ugyanarra a
     slotra a második egyidejű `create` nem létező dokumentumot már nem talál,
     ezért a rules elbukik – dupla foglalás nem jön létre tranzakció nélkül. */
  const bookingId = (staffId, slotKey) => `${staffId}_${slotKey}`;
  const weekDocId = (staffId, mondayYmd) => `${staffId}_${mondayYmd}`;

  /* Egy foglalás által lefedett ÖSSZES slot-kulcs (a foglaltság-tükörhöz) */
  function coveredSlots(slotKey, durationMin, slotMin) {
    const step = slotMin > 0 ? slotMin : 30;
    /* felső határ: a kezelés hossza legfeljebb 480 perc (szerkesztő + rules) –
       egy elrontott adattól ne pörögjön el a ciklus */
    const need = Math.min(Math.max(step, Math.ceil((durationMin || step) / step) * step), 480);
    const date = slotKey.slice(0, 10), from = toMin(slotKey.slice(11));
    const out = [];
    for (let m = from; m < from + need; m += step) out.push(`${date}T${toHhmm(m)}`);
    return out;
  }

  /* ------------------------------------------------------------------------
     Nyelvi szótár – a wizard SAJÁT szövegei. Közös a tervezővel és a
     leszállított oldallal, ezért nem a tervező I18N táblájában van.
     ------------------------------------------------------------------------ */
  const I18N = {
    hu: {
      "bk.step1": "Szolgáltatás",
      "bk.step2": "Munkatárs",
      "bk.step3": "Időpont",
      "bk.step4": "Összegzés",
      "bk.stepsLabel": "Foglalási lépések",
      "bk.stepGo": "Vissza a(z) {n}. lépésre",
      "bk.back": "Vissza",
      "bk.min": "perc",
      "bk.noServices": "Még nincs beállítva szolgáltatás.",
      "bk.noStaff": "Ehhez a szolgáltatáshoz nincs beállítva munkatárs.",
      "bk.pickService": "Melyik szolgáltatást kéri?",
      "bk.pickStaff": "Kihez szeretne jönni?",
      "bk.pickSlot": "Válasszon időpontot",
      "bk.prevWeek": "Előző hét",
      "bk.nextWeek": "Következő hét",
      "bk.loading": "Betöltés…",
      "bk.closed": "Zárva",
      "bk.noSlots": "Ezen a napon nincs szabad időpont.",
      "bk.noSlotsWeek": "Ezen a héten nincs szabad időpont – lapozzon a következőre.",
      "bk.freeAria": "{time} – szabad",
      "bk.takenAria": "{time} – foglalt",
      "bk.pastAria": "{time} – elmúlt",
      "bk.summary": "Foglalás összegzése",
      "bk.lblService": "Szolgáltatás",
      "bk.lblStaff": "Munkatárs",
      "bk.lblWhen": "Időpont",
      "bk.lblDuration": "Időtartam",
      "bk.lblPrice": "Ár",
      "bk.yourData": "Az Ön adatai",
      "bk.name": "Név",
      "bk.email": "E-mail cím",
      "bk.phone": "Telefonszám",
      "bk.loginTitle": "Foglalás fiókkal vagy vendégként",
      "bk.loginLead": "Fiókkal később megnézheti és lemondhatja a foglalását. Vendégként is lefoglalhatja, ilyenkor az e-mail címét és telefonszámát kérjük.",
      "bk.login": "Bejelentkezés / regisztráció",
      "bk.guest": "Folytatás vendégként",
      "bk.guestOn": "Vendégként foglal",
      "bk.signedInAs": "Bejelentkezve:",
      "bk.confirm": "Foglalás megerősítése",
      "bk.sending": "Foglalás mentése…",
      "bk.okTitle": "Sikeres foglalás",
      "bk.okMail": "Elmentettük, és e-mailt is küldtünk a(z) {email} címre.",
      "bk.okProfile": "Foglalásaim",
      "bk.newBooking": "Új foglalás",
      "bk.errTitle": "A foglalás nem sikerült",
      "bk.errTaken": "Ezt az időpontot időközben lefoglalták – kérjük, válasszon másikat.",
      "bk.errOffline": "Nincs internetkapcsolat. Ellenőrizze a hálózatot, és próbálja újra.",
      "bk.errAuth": "Ehhez be kell jelentkeznie.",
      "bk.errUnknown": "Váratlan hiba történt. Kérjük, próbálja újra.",
      "bk.errName": "Kérjük, adja meg a nevét.",
      "bk.errEmail": "Kérjük, adjon meg egy érvényes e-mail címet.",
      "bk.errPhone": "Kérjük, adja meg a telefonszámát.",
      "bk.backToCal": "Vissza a naptárhoz",
      "bk.retry": "Újra",
      "bk.demo": "Ez itt előnézet: a szabad időpontok példaadatok, és valódi foglalás nem jön létre.",
      "bk.demoLogin": "Előnézetben nincs bejelentkezés – a kész oldalon itt nyílik a belépés.",
      "bk.demoOk": "A kész oldalon itt jön létre a foglalás, és megy ki az e-mail.",
    },
    en: {
      "bk.step1": "Service",
      "bk.step2": "Staff",
      "bk.step3": "Time",
      "bk.step4": "Summary",
      "bk.stepsLabel": "Booking steps",
      "bk.stepGo": "Back to step {n}",
      "bk.back": "Back",
      "bk.min": "min",
      "bk.noServices": "No services have been set up yet.",
      "bk.noStaff": "No staff member is set up for this service.",
      "bk.pickService": "Which service do you need?",
      "bk.pickStaff": "Who would you like to see?",
      "bk.pickSlot": "Pick a time",
      "bk.prevWeek": "Previous week",
      "bk.nextWeek": "Next week",
      "bk.loading": "Loading…",
      "bk.closed": "Closed",
      "bk.noSlots": "No free times on this day.",
      "bk.noSlotsWeek": "No free times this week – try the next one.",
      "bk.freeAria": "{time} – available",
      "bk.takenAria": "{time} – booked",
      "bk.pastAria": "{time} – past",
      "bk.summary": "Booking summary",
      "bk.lblService": "Service",
      "bk.lblStaff": "Staff",
      "bk.lblWhen": "Time",
      "bk.lblDuration": "Duration",
      "bk.lblPrice": "Price",
      "bk.yourData": "Your details",
      "bk.name": "Name",
      "bk.email": "Email address",
      "bk.phone": "Phone number",
      "bk.loginTitle": "Book with an account or as a guest",
      "bk.loginLead": "With an account you can review and cancel your booking later. You can also book as a guest – then we need your email address and phone number.",
      "bk.login": "Sign in / register",
      "bk.guest": "Continue as guest",
      "bk.guestOn": "Booking as a guest",
      "bk.signedInAs": "Signed in as:",
      "bk.confirm": "Confirm booking",
      "bk.sending": "Saving your booking…",
      "bk.okTitle": "Booking confirmed",
      "bk.okMail": "We saved it and sent an email to {email}.",
      "bk.okProfile": "My bookings",
      "bk.newBooking": "New booking",
      "bk.errTitle": "The booking failed",
      "bk.errTaken": "Someone just took this time – please pick another one.",
      "bk.errOffline": "No internet connection. Check your network and try again.",
      "bk.errAuth": "You need to sign in for this.",
      "bk.errUnknown": "Something went wrong. Please try again.",
      "bk.errName": "Please enter your name.",
      "bk.errEmail": "Please enter a valid email address.",
      "bk.errPhone": "Please enter your phone number.",
      "bk.backToCal": "Back to the calendar",
      "bk.retry": "Try again",
      "bk.demo": "This is a preview: available times are sample data and no real booking is created.",
      "bk.demoLogin": "There is no sign-in in the preview – on the finished site this opens the login.",
      "bk.demoOk": "On the finished site the booking is created here and the email goes out.",
    },
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const ICON_CHECK =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5.5 5.5L20 7"></path></svg>`;
  const ICON_WARN =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5"></path><path d="M12 16.5v.5"></path><circle cx="12" cy="12" r="9"></circle></svg>`;

  /* ------------------------------------------------------------------------
     A varázsló

     mount(root, {
       data:   { services:[{id,name,durationMin,price}], staff:[{id,name,serviceIds}],
                 hours:{mon:{open,close,closed},…}, slot:30 },
       lang:   "hu" | "en",
       taken:  (staffId, mondayYmd) => Promise<Set<slotKey>>,
       submit: (payload) => Promise<void>          // hibánál Error + .code
       auth:   { user:{uid,name,email,phone}|null, requestLogin() } | null,
       demo:   true → nincs valódi mentés, csak bemutató
       history:false → ne írjon a böngésző előzményébe (tervezőben ez zavaró)
       onProfile: () => void   // ha van, a sikerpanelen megjelenik a gomb
     })
     ------------------------------------------------------------------------ */
  function mount(root, opts = {}) {
    const lang = I18N[opts.lang] ? opts.lang : "hu";
    const dict = I18N[lang];
    const t = (key, vars) => {
      let s = dict[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
      return s;
    };
    const data = {
      services: Array.isArray(opts.data?.services) ? opts.data.services : [],
      staff: Array.isArray(opts.data?.staff) ? opts.data.staff : [],
      hours: opts.data?.hours || {},
      slot: Number(opts.data?.slot) || 30,
      currency: CURRENCY[opts.data?.currency] ? opts.data.currency : "HUF",
    };
    const money = (price) => (price ? `${price} ${CURRENCY[data.currency]}` : "");
    const useHistory = opts.history !== false && typeof history !== "undefined";
    const token = "bk" + Math.random().toString(36).slice(2, 8);

    const fmtDay = new Intl.DateTimeFormat(lang, { timeZone: TZ, weekday: "short", day: "numeric" });
    const fmtRange = new Intl.DateTimeFormat(lang, { timeZone: TZ, month: "short", day: "numeric" });
    const fmtWhen = new Intl.DateTimeFormat(lang, {
      timeZone: TZ, weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const st = {
      step: 1,
      serviceId: null,
      staffId: null,
      week: weekStart(todayLocal()),
      day: null,                     /* mobilon a kiválasztott nap (YYYY-MM-DD) */
      slot: null,
      guest: false,
      form: { name: "", email: "", phone: "", fax: "" },   /* fax = robotfogó, lásd `honeypot` */
      taken: null,                   /* Set | null (= még töltjük) */
      takenFor: "",
      busy: false,
      done: null,                    /* siker: a mentett foglalás */
      error: null,                   /* { code, msg } */
    };

    const service = () => data.services.find((s) => s.id === st.serviceId) || null;
    const staffFor = (serviceId) =>
      data.staff.filter((w) => !serviceId || (w.serviceIds || []).includes(serviceId));
    const staffMember = () => data.staff.find((w) => w.id === st.staffId) || null;
    const user = () => opts.auth?.user || null;

    /* Egy munkatárs esetén a 2. lépés kimarad – visszafelé is */
    const skipStaff = () => staffFor(st.serviceId).length <= 1;
    const visibleSteps = () => (skipStaff() ? [1, 3, 4] : [1, 2, 3, 4]);

    function goto(step, fromPop = false) {
      const steps = visibleSteps();
      st.step = steps.includes(step) ? step : steps.find((s) => s >= step) || steps[steps.length - 1];
      st.error = null;
      if (useHistory && !fromPop) history.pushState({ [token]: st.step }, "");
      draw(true);
    }

    if (useHistory) {
      /* A mostani előzmény-bejegyzést megjelöljük 1. lépésként (replaceState, tehát
         nem keletkezik új bejegyzés). E nélkül a 2. lépésről a böngésző vissza
         gombja már kifelé vinne – mobilon ott veszik el a félbehagyott foglalás. */
      history.replaceState({ ...history.state, [token]: 1 }, "");
      addEventListener("popstate", (e) => {
        const step = e.state?.[token];
        if (step && root.isConnected) goto(step, true);
      });
    }

    /* --- Foglaltság betöltése (adapter) ---------------------------------- */
    async function loadTaken() {
      const key = `${st.staffId}|${st.week}`;
      if (st.takenFor === key) return;
      st.takenFor = key;
      st.taken = null;
      draw();
      try {
        st.taken = (await opts.taken?.(st.staffId, st.week)) || new Set();
      } catch {
        st.taken = new Set();                 /* olvasási hibától ne álljon meg a naptár */
      }
      if (st.takenFor === key) draw();
    }

    /* --- Kirajzolás ------------------------------------------------------ */
    function stepsBar() {
      const steps = visibleSteps();
      const at = steps.indexOf(st.step);
      return `<ol class="bk-steps" aria-label="${esc(t("bk.stepsLabel"))}">` + steps.map((s, i) => {
        const done = i < at, now = i === at;
        const label = `${i + 1}. ${t("bk.step" + s)}`;
        return `<li class="bk-steps__item${now ? " is-now" : ""}${done ? " is-done" : ""}">` +
          (done
            ? `<button type="button" class="bk-steps__btn" data-goto="${s}" aria-label="${esc(t("bk.stepGo", { n: i + 1 }))}">${esc(label)}</button>`
            : `<span class="bk-steps__btn"${now ? ' aria-current="step"' : ""}>${esc(label)}</span>`) +
          `</li>`;
      }).join("") + `</ol>`;
    }

    const backBtn = () =>
      st.step === 1 ? "" :
        `<button type="button" class="bk-btn bk-btn--ghost" data-back="1">← ${esc(t("bk.back"))}</button>`;

    const priceLine = (s) => (s.price ? `<span class="bk-card__price">${esc(money(s.price))}</span>` : "");

    function viewServices() {
      if (!data.services.length) return `<p class="bk-empty">${esc(t("bk.noServices"))}</p>`;
      return `<ul class="bk-cards">` + data.services.map((s) => `
        <li><button type="button" class="bk-card${s.id === st.serviceId ? " is-on" : ""}" data-service="${esc(s.id)}">
          <span class="bk-card__name">${esc(s.name)}</span>
          <span class="bk-card__meta">${Number(s.durationMin) || data.slot} ${esc(t("bk.min"))}</span>
          ${priceLine(s)}
        </button></li>`).join("") + `</ul>`;
    }

    const avatar = (w) => (photoOk(w.photo)
      ? `<img class="bk-avatar" src="${esc(w.photo)}" alt="" width="112" height="112" loading="lazy">`
      : `<span class="bk-avatar bk-avatar--txt" aria-hidden="true">${esc(initials(w.name))}</span>`);

    function viewStaff() {
      const list = staffFor(st.serviceId);
      if (!list.length) return `<p class="bk-empty">${esc(t("bk.noStaff"))}</p>`;
      return `<ul class="bk-cards">` + list.map((w) => `
        <li><button type="button" class="bk-card bk-card--person${w.id === st.staffId ? " is-on" : ""}" data-staff="${esc(w.id)}">
          ${avatar(w)}
          <span class="bk-card__name">${esc(w.name)}</span>
        </button></li>`).join("") + `</ul>`;
    }

    function viewCalendar() {
      const days = Array.from({ length: 7 }, (_, i) => shiftDay(st.week, i));
      const today = todayLocal();
      const now = nowKey();
      const svc = service();
      const sel = st.day && days.includes(st.day) ? st.day : days.find((d) => d >= today) || days[0];
      st.day = sel;

      const head = `
        <div class="bk-cal__bar">
          <button type="button" class="bk-nav" data-week="-1" ${st.week <= weekStart(today) ? "disabled" : ""}
                  aria-label="${esc(t("bk.prevWeek"))}">◀</button>
          <b>${esc(fmtRange.format(cursor(days[0])))} – ${esc(fmtRange.format(cursor(days[6])))}</b>
          <button type="button" class="bk-nav" data-week="1" aria-label="${esc(t("bk.nextWeek"))}">▶</button>
        </div>`;

      if (st.taken === null) return head + `<p class="bk-empty">${esc(t("bk.loading"))}</p>`;

      /* Mobil napválasztó csík – szélesebb helyen a CSS elrejti */
      const chips = `<div class="bk-chips" role="group" aria-label="${esc(t("bk.step3"))}">` +
        days.map((d) => `<button type="button" class="bk-chip${d === sel ? " is-on" : ""}" data-day="${d}"
          ${d < today ? "disabled" : ""}>${esc(fmtDay.format(cursor(d)))}</button>`).join("") + `</div>`;

      let free = 0;
      const cols = days.map((d) => {
        const list = slotsForDay({
          dayKey: DAYS[dowMon0(d)], date: d, hours: data.hours, slotMin: data.slot,
          durationMin: Number(svc?.durationMin) || data.slot, taken: st.taken, now,
        });
        free += list.filter((s) => s.state === "free").length;
        const body = !list.length
          ? `<p class="bk-day__none">${esc(t(data.hours?.[DAYS[dowMon0(d)]]?.closed ? "bk.closed" : "bk.noSlots"))}</p>`
          : list.map((s) => `<button type="button" class="bk-slot is-${s.state}${s.key === st.slot ? " is-on" : ""}"
              data-slot="${s.key}" ${s.state === "free" ? "" : "disabled"}
              aria-label="${esc(t("bk." + s.state + "Aria", { time: s.time }))}">${s.time}</button>`).join("");
        return `<div class="bk-day"${d === sel ? " data-sel=\"1\"" : ""}>
            <h4 class="bk-day__head">${esc(fmtDay.format(cursor(d)))}</h4>
            <div class="bk-day__slots">${body}</div>
          </div>`;
      }).join("");

      return head + chips + `<div class="bk-cal">${cols}</div>` +
        (free ? "" : `<p class="bk-empty">${esc(t("bk.noSlotsWeek"))}</p>`);
    }

    function row(label, value) {
      return `<div class="bk-row"><span class="bk-muted">${esc(label)}</span><strong>${esc(value)}</strong></div>`;
    }

    function viewSummary() {
      const svc = service(), who = staffMember(), u = user();
      const when = st.slot ? fmtWhen.format(zonedToUTC(st.slot)) : "—";
      const facts = `<div class="bk-facts">
          ${row(t("bk.lblService"), svc?.name || "—")}
          ${who ? row(t("bk.lblStaff"), who.name) : ""}
          ${row(t("bk.lblWhen"), when)}
          ${row(t("bk.lblDuration"), `${Number(svc?.durationMin) || data.slot} ${t("bk.min")}`)}
          ${svc?.price ? row(t("bk.lblPrice"), money(svc.price)) : ""}
        </div>`;

      /* Bejelentkezve: az adatok készen vannak. Vendégként: e-mail + telefon kell. */
      let ident;
      if (u) {
        ident = `<div class="bk-ident">
            <p class="bk-ident__who">${esc(t("bk.signedInAs"))} <strong>${esc(u.email || u.name || "")}</strong></p>
            ${field("name", u.name, true)}${field("phone", u.phone, true)}
          </div>`;
      } else if (st.guest) {
        ident = `<div class="bk-ident">
            <p class="bk-ident__who">${esc(t("bk.guestOn"))}</p>
            ${field("name")}${field("email")}${field("phone")}${honeypot}
          </div>`;
      } else {
        ident = `<div class="bk-ident">
            <h4>${esc(t("bk.loginTitle"))}</h4>
            <p class="bk-muted">${esc(t("bk.loginLead"))}</p>
            <div class="bk-ident__actions">
              <button type="button" class="bk-btn bk-btn--primary" data-login="1">${esc(t("bk.login"))}</button>
              <button type="button" class="bk-btn bk-btn--ghost" data-guest="1">${esc(t("bk.guest"))}</button>
            </div>
          </div>`;
      }

      const ready = !!(u || st.guest);
      const confirm = ready ? `
        <button type="button" class="bk-btn bk-btn--primary bk-confirm" data-confirm="1" ${st.busy ? "disabled aria-busy=\"true\"" : ""}>
          ${st.busy ? `<span class="bk-spin" aria-hidden="true"></span>${esc(t("bk.sending"))}` : esc(t("bk.confirm"))}
        </button>` : "";

      return `<h3 class="bk-h">${esc(t("bk.summary"))}</h3>${facts}
        <h4 class="bk-h4">${esc(t("bk.yourData"))}</h4>${ident}${confirm}`;
    }

    /* A begépelt érték mindig erősebb a profilból hozottnál – különben egy
       újrarajzolás (pl. mezőhiba) visszaírná a régit a felhasználó szeme előtt.
       A maxlength ugyanaz, amit a backend is megkövetel (StoreBookingRequest)
       – így nem a mentésnél derül ki a túl hosszú érték. */
    const FIELD_MAX = { name: 119, email: 160, phone: 39 };
    function field(key, value = "", locked = false) {
      const type = key === "email" ? "email" : key === "phone" ? "tel" : "text";
      const auto = key === "phone" ? "tel" : key;
      return `<label class="bk-field">
          <span>${esc(t("bk." + key))}</span>
          <input type="${type}" data-form="${key}" value="${esc(st.form[key] || value || "")}"
                 maxlength="${FIELD_MAX[key]}" autocomplete="${auto}" ${locked && key === "email" ? "readonly" : ""}>
        </label>`;
    }

    /* Robotfogó: űrlapkitöltő botok minden mezőt kitöltenek, ez viszont a
       képernyőn kívül van és aria-hidden – ember soha nem ír bele. Ha mégis
       kitöltve érkezik, a foglalás nem megy el.
       ponytail: a látszó űrlapot kerülő, közvetlenül az API-nak küldő robot
       ellen nem véd – arra a backend féke való (throttle:bookings). */
    const honeypot = `<div class="bk-hp" aria-hidden="true">
        <label>Fax<input type="text" data-form="fax" tabindex="-1" autocomplete="off"></label>
      </div>`;

    function viewDone() {
      const b = st.done;
      const profile = opts.onProfile && b.uid
        ? `<button type="button" class="bk-btn bk-btn--ghost" data-profile="1">${esc(t("bk.okProfile"))}</button>` : "";
      return `<div class="bk-panel bk-panel--ok" role="status" aria-live="polite">
          <span class="bk-panel__icon">${ICON_CHECK}</span>
          <h3>${esc(t("bk.okTitle"))}</h3>
          <div class="bk-facts">
            ${row(t("bk.lblService"), b.serviceName)}
            ${b.staffName ? row(t("bk.lblStaff"), b.staffName) : ""}
            ${row(t("bk.lblWhen"), fmtWhen.format(zonedToUTC(b.slot)))}
            ${row(t("bk.name"), b.name)}
            ${row(t("bk.phone"), b.phone)}
          </div>
          <p>${esc(opts.demo ? t("bk.demoOk") : t("bk.okMail", { email: b.email }))}</p>
          <div class="bk-panel__actions">
            ${profile}
            <button type="button" class="bk-btn bk-btn--primary" data-restart="1">${esc(t("bk.newBooking"))}</button>
          </div>
        </div>`;
    }

    function viewError() {
      const { code, msg } = st.error;
      const again = code === "taken"
        ? `<button type="button" class="bk-btn bk-btn--primary" data-cal="1">${esc(t("bk.backToCal"))}</button>`
        : `<button type="button" class="bk-btn bk-btn--primary" data-dismiss="1">${esc(t("bk.retry"))}</button>`;
      return `<div class="bk-panel bk-panel--err" role="alert" aria-live="assertive">
          <span class="bk-panel__icon">${ICON_WARN}</span>
          <h3>${esc(t("bk.errTitle"))}</h3>
          <p>${esc(msg)}</p>
          <div class="bk-panel__actions">${again}</div>
        </div>`;
    }

    function draw(focusStep = false) {
      if (st.done) {
        root.innerHTML = viewDone();
      } else if (st.error && st.error.blocking) {
        root.innerHTML = viewError();
      } else {
        const body = st.step === 1 ? viewServices()
          : st.step === 2 ? viewStaff()
          : st.step === 3 ? viewCalendar()
          : viewSummary();
        const lead = st.step === 4 ? "" :
          `<h3 class="bk-h" tabindex="-1" id="${token}-h">${esc(t(st.step === 1 ? "bk.pickService" : st.step === 2 ? "bk.pickStaff" : "bk.pickSlot"))}</h3>`;
        root.innerHTML = stepsBar() +
          (opts.demo ? `<p class="bk-demo">${esc(t("bk.demo"))}</p>` : "") +
          `<div class="bk-body">${lead}${body}</div>` +
          (st.error ? `<p class="bk-inline" role="alert">${esc(st.error.msg)}</p>` : "") +
          `<div class="bk-foot">${backBtn()}</div>`;
        if (focusStep) root.querySelector(`#${token}-h`)?.focus();
      }
      root.dataset.step = st.done ? "ok" : st.step;
    }

    /* --- Beküldés -------------------------------------------------------- */
    function collect() {
      const u = user();
      const f = st.form;
      /* A hossz a security rules korlátja (name/serviceName < 120, phone < 40) –
         a vágás után a mentés biztosan átmegy, nem a szerveren bukik el. */
      const cut = (s, n) => String(s || "").trim().slice(0, n);
      const name = cut(f.name || u?.name, 119);
      const email = cut(u?.email || f.email, 160);
      const phone = cut(f.phone || u?.phone, 39);
      /* Robotfogó: csak gép tölti ki. Nem mondjuk meg neki, mi bukott el. */
      if (String(f.fax || "").trim()) return { err: "errUnknown" };
      /* legalább 2 karakter: a security rules is ezt kéri, így nem a mentésnél
         derül ki, hogy a beírt egy betű nem elég */
      if (name.length < 2) return { err: "errName" };
      if (!EMAIL_RE.test(email)) return { err: "errEmail" };
      if (phone.replace(/\D/g, "").length < 6) return { err: "errPhone" };

      const svc = service(), who = staffMember();
      const start = zonedToUTC(st.slot);
      const dur = Number(svc?.durationMin) || data.slot;
      return {
        payload: {
          id: bookingId(st.staffId, st.slot),
          staffId: st.staffId, staffName: cut(who?.name, 119),
          /* pénznemmel együtt mentjük: az adminnak és a levélben így önmagában érthető */
          serviceId: st.serviceId, serviceName: cut(svc?.name, 119), price: cut(money(svc?.price), 119),
          slot: st.slot, week: st.week, durationMin: dur,
          start, end: new Date(start.getTime() + dur * 60000),
          uid: u?.uid || null, name, email, phone, lang,
        },
      };
    }

    async function submit() {
      const { err, payload } = collect();
      if (err) { st.error = { code: err, msg: t("bk." + err) }; return draw(); }

      st.busy = true; st.error = null; draw();
      try {
        if (!opts.demo) await opts.submit(payload);
        st.done = payload;
        /* Cél-esemény: eddig a látogatószám volt az egyetlen szám az ügyfélnek –
           ez az, ami tényleg számít. A mérés hiánya sose bukjon a foglalásra. */
        window.pvGoal?.("booking-done");
      } catch (e) {
        const code = e?.code === "taken" || e?.code === "offline" || e?.code === "auth" ? e.code : "unknown";
        st.error = { code, msg: t("bk.err" + code[0].toUpperCase() + code.slice(1)), blocking: true };
      } finally {
        st.busy = false;
        draw();
      }
    }

    /* --- Eseménykezelés (egy figyelő az egész varázslóra) ---------------- */
    root.addEventListener("click", (e) => {
      const hit = (attr) => e.target.closest(`[data-${attr}]`);
      let el;

      if ((el = hit("service"))) {
        st.serviceId = el.dataset.service;
        if (!staffFor(st.serviceId).some((w) => w.id === st.staffId)) st.staffId = null;
        if (skipStaff()) st.staffId = staffFor(st.serviceId)[0]?.id || null;
        st.slot = null; st.takenFor = "";
        goto(skipStaff() ? 3 : 2);
        if (st.step === 3) loadTaken();
        return;
      }
      if ((el = hit("staff"))) {
        st.staffId = el.dataset.staff;
        st.slot = null; st.takenFor = "";
        goto(3);
        loadTaken();
        return;
      }
      if ((el = hit("slot"))) { st.slot = el.dataset.slot; goto(4); return; }
      if ((el = hit("day"))) { st.day = el.dataset.day; draw(); return; }
      if ((el = hit("week"))) {
        st.week = shiftDay(st.week, Number(el.dataset.week) * 7);
        st.day = null;
        /* a fejléc dátumtartománya azonnal váltson – a loadTaken egy már
           betöltött hétre nem rajzol újra (gyorsítótár) */
        draw();
        loadTaken();
        return;
      }
      if ((el = hit("goto"))) {
        goto(Number(el.dataset.goto));
        if (st.step === 3) loadTaken();
        return;
      }
      if (hit("back")) {
        const steps = visibleSteps();
        goto(steps[Math.max(0, steps.indexOf(st.step) - 1)]);
        if (st.step === 3) loadTaken();
        return;
      }
      if (hit("guest")) { st.guest = true; return draw(); }
      if (hit("login")) {
        if (opts.demo) { st.error = { code: "demo", msg: t("bk.demoLogin") }; return draw(); }
        opts.auth?.requestLogin?.();
        return;
      }
      if (hit("confirm")) return submit();
      if (hit("dismiss")) { st.error = null; return draw(); }
      if (hit("cal")) { st.error = null; st.takenFor = ""; goto(3); return loadTaken(); }
      if (hit("profile")) return opts.onProfile?.();
      if (hit("restart")) {
        Object.assign(st, { step: 1, serviceId: null, staffId: null, slot: null, done: null, error: null, guest: false, takenFor: "" });
        return goto(1);
      }
    });

    /* A név/e-mail/telefon mezőket nem rajzoljuk újra gépelés közben – csak
       az állapotba írjuk, különben elveszne a fókusz (mint a tervezőben). */
    root.addEventListener("input", (e) => {
      const key = e.target.dataset?.form;
      if (key) st.form[key] = e.target.value;
    });

    /* Bejelentkezés után a 4. lépés adatai frissülnek */
    root.refresh = () => { if (!st.done) draw(); };

    draw();
    return root;
  }

  globalThis.Booking = {
    TZ, DAYS, CURRENCY, I18N, mount, esc,
    /* tiszta, tesztelhető magok – a leszállított oldal és a Cloud Function is ezeket használja */
    weekStart, shiftDay, dowMon0, todayLocal, nowKey, zonedToUTC, tzOffset,
    slotsForDay, coveredSlots, bookingId, weekDocId, toMin, toHhmm, photoOk, initials,
  };
})();
