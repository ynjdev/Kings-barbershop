/* Kings Barbershop: shared script for every page */

/* ===== SETTINGS: change these, every page updates ===== */
var KINGS = {
  WA_NUMBER: "27000000000",   // Jermaine's WhatsApp Business number, digits only, starting 27
  // Online booking. Both values come from Supabase > Project Settings > API Keys (see SETUP-BOOKINGS.md).
  // The publishable (or legacy "anon") key is meant to sit in a website: the database rules decide what it can do.
  // Never put the secret or service_role key here.
  // While these are empty, the site books through WhatsApp only.
  SUPABASE_URL: "",           // e.g. "https://abcdxyz.supabase.co"
  SUPABASE_ANON_KEY: "",
  GA_ID: "G-XXXXXXXXXX",      // Google Analytics measurement ID (analytics stays off until this is real)
  // Opening hours for the "Next opening" text when online booking is off: day: [opens, closes], 0 = Sunday.
  // Keep in step with the hours on the Visit & Book page.
  HOURS: {0:[9,14], 1:[8,18], 2:[8,18], 3:[8,18], 4:[8,18], 5:[8,18], 6:[8,17]},
  PRELOADER_MS: 3000          // how long the lion shows on the home page
};
/* ======================================================= */

var TZ = "Africa/Johannesburg";
var ONLINE = !!(KINGS.SUPABASE_URL && KINGS.SUPABASE_ANON_KEY);

function waLink(text){ return "https://wa.me/" + KINGS.WA_NUMBER + "?text=" + encodeURIComponent(text); }
function $(sel, root){ return (root || document).querySelector(sel); }
function $all(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function store(key, val){ try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || "null"); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; } }

// newer Supabase "publishable" keys (sb_publishable_...) go only in the apikey header; older "anon" keys also go in Authorization
function apiHeaders(){
  var h = { apikey: KINGS.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
  if (KINGS.SUPABASE_ANON_KEY.indexOf("sb_") !== 0) h.Authorization = "Bearer " + KINGS.SUPABASE_ANON_KEY;
  return h;
}
/* Talk to the booking database. `body` given = call a function (POST), otherwise read a table (GET). */
function api(path, body){
  return fetch(KINGS.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + path, {
    method: body ? "POST" : "GET",
    headers: apiHeaders(),
    body: body ? JSON.stringify(body) : undefined
  }).then(function(r){
    return r.json().catch(function(){ return null; }).then(function(j){
      if (!r.ok) { var e = new Error((j && j.message) || ("HTTP " + r.status)); e.code = j && j.message; throw e; }
      return j;
    });
  });
}
var ERRORS = {
  slot_taken: "Sorry, that time was just taken. Pick another time below.",
  bad_phone: "Please check your WhatsApp number, for example 082 123 4567.",
  bad_name: "Please add your name.",
  bad_email: "That email doesn't look right. Leave it empty if you don't want emails.",
  too_many_upcoming: "You already have 3 upcoming bookings. WhatsApp us if you need another.",
  unknown_service: "One of those services isn't available online right now. Please refresh the page.",
  no_services: "Tick at least one service first.",
  too_late: "It's less than 4 hours to your booking, so it can't be cancelled online. Please WhatsApp us.",
  not_active: "This booking has already been cancelled or completed."
};
function errText(e){ return ERRORS[e && e.code] || "Something went wrong. Please try again, or send it on WhatsApp."; }

/* ---- dates and times, always in shop time (Johannesburg) ---- */
function parts(d){
  var o = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false })
    .formatToParts(d).forEach(function(p){ o[p.type] = p.value; });
  return o;
}
function ymd(d){ var p = parts(d); return p.year + "-" + p.month + "-" + p.day; }
function addDays(day, n){ var d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var WEEK = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function dayName(day){ return WEEK[new Date(day + "T12:00:00Z").getUTCDay()]; }
function dayShort(day){ var d = new Date(day + "T12:00:00Z"); return WEEK[d.getUTCDay()].slice(0, 3) + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()]; }
function hm(iso){ var p = parts(new Date(iso)); return p.hour + ":" + p.minute; }
function whenText(iso){ return dayShort(ymd(new Date(iso))) + ", " + hm(iso); }
function rands(cents){ return "R" + (cents % 100 ? (cents / 100).toFixed(2) : cents / 100); }

/* Google Analytics: only loads once a real ID is set */
if (KINGS.GA_ID.indexOf("XXXX") === -1 && !/^\/admin/.test(location.pathname)) {   // never on the admin
  var ga = document.createElement("script");
  ga.async = true;
  ga.src = "https://www.googletagmanager.com/gtag/js?id=" + KINGS.GA_ID;
  document.head.appendChild(ga);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", KINGS.GA_ID);
}

/* Preloader (home page only): shows for PRELOADER_MS once the page is actually on screen */
(function(){
  var p = $("#preloader");
  if (!p) return;
  var ready = false, started = false;
  function hide(){
    if (p.dataset.hidden) return;
    p.dataset.hidden = "1";
    p.classList.add("hide");
    setTimeout(function(){ p.style.display = "none"; }, 600);
  }
  function start(){
    // wait until the page has loaded AND is the visible tab/app
    if (started || !ready || document.visibilityState !== "visible") return;
    started = true;
    p.classList.add("go"); // play the lion animation now, not in the background
    // one shine sweeps across the lion once it has faded in (the sweep itself is CSS: #preloader.shine)
    var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!still) setTimeout(function(){ p.classList.add("shine"); }, 1100);
    // two animation frames = the browser has really painted (frames don't run while hidden)
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ setTimeout(hide, KINGS.PRELOADER_MS); }); });
  }
  window.addEventListener("load", function(){ ready = true; start(); });
  setTimeout(function(){ ready = true; start(); }, 5000); // don't wait forever on a slow file
  document.addEventListener("visibilitychange", start);
})();

/* "Next opening" text: from opening hours now, replaced by the real next free time when online booking is on */
function hhmm(mins){ return String(Math.floor(mins/60)).padStart(2,"0") + ":" + String(mins%60).padStart(2,"0"); }
function nextSlot(){
  var p = parts(new Date()), day = new Date(ymd(new Date()) + "T12:00:00Z").getUTCDay(), mins = (+p.hour) * 60 + (+p.minute);
  var open = KINGS.HOURS[day][0]*60, lastStart = KINGS.HOURS[day][1]*60 - 45; // last booking 45 min before close
  if (mins < open) return "Today, " + hhmm(open);
  var next = Math.ceil((mins + 1)/30)*30; // next half hour from now
  if (next <= lastStart) return "Today, " + hhmm(next);
  return "Tomorrow, " + hhmm(KINGS.HOURS[(day + 1) % 7][0]*60);
}
var slot = nextSlot();
var mainMsg = "Hi Kings, I have a question.";

function realNextOpening(){
  var today = ymd(new Date()), tries = [0, 1, 2, 3];
  (function next(i){
    if (i >= tries.length) return;
    var day = addDays(today, tries[i]);
    api("rpc/available_slots", { p_day: day, p_services: ["signature-cut"], p_barber: null }).then(function(rows){
      if (!rows || !rows.length) return next(i + 1);
      var label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayName(day);
      $all("[data-slot]").forEach(function(el){ el.textContent = label + ", " + hm(rows[0].starts_at); });
    }).catch(function(){});
  })(0);
}

/* Prices and durations come from the booking database when it's connected, so the site never shows an old price */
function hydratePrices(){
  return api("services?select=id,name,price_cents,minutes,active,online&order=sort").then(function(rows){
    var by = {};
    rows.forEach(function(s){ by[s.id] = s; });
    $all("input[data-id]").forEach(function(cb){
      var s = by[cb.dataset.id], row = cb.closest(".price");
      if (!s || !s.online) { if (row) row.hidden = true; cb.checked = false; return; }
      cb.dataset.price = s.price_cents / 100; cb.dataset.mins = s.minutes; cb.dataset.name = s.name;
      var amt = row && $(".amt", row);
      if (amt) amt.innerHTML = rands(s.price_cents) + "<small>" + s.minutes + " min</small>";
    });
    $all("[data-svc]").forEach(function(el){ var s = by[el.dataset.svc]; if (s) el.textContent = rands(s.price_cents); });
    return by;
  });
}

document.addEventListener("DOMContentLoaded", function(){

  /* scroll reveal */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, {threshold: .12});
    $all(".reveal").forEach(function(el){ io.observe(el); });
  } else {
    $all(".reveal").forEach(function(el){ el.classList.add("in"); });
  }

  /* booking links */
  $all("[data-slot]").forEach(function(el){ el.textContent = slot; });
  $all("[data-wa]").forEach(function(a){ a.href = waLink(a.dataset.wa || mainMsg); });
  if (ONLINE && $("[data-slot]")) realNextOpening();
  if (ONLINE && ($("[data-svc]") || $("#price-list")) && !$("#b-services")) hydratePrices().catch(function(){});

  /* phone menu */
  var menu = $("#menu"), menuBtn = $(".menu-btn");
  if (menu && menuBtn) {
    var setMenu = function(open){
      menu.hidden = !open;
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("menu-open", open);
      if (open) { $(".menu-close", menu).focus(); } else { menuBtn.focus(); }
    };
    menuBtn.addEventListener("click", function(){ setMenu(true); });
    $(".menu-close", menu).addEventListener("click", function(){ setMenu(false); });
    $all("a", menu).forEach(function(a){ a.addEventListener("click", function(){ setMenu(false); }); });
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && !menu.hidden) setMenu(false); });
  }

  /* barber filter (Services page) */
  $all("#barber-filter .chip").forEach(function(chip){
    chip.addEventListener("click", function(){
      $all("#barber-filter .chip").forEach(function(c){ c.classList.remove("active"); c.setAttribute("aria-pressed","false"); });
      chip.classList.add("active"); chip.setAttribute("aria-pressed","true");
      var b = chip.dataset.b;
      $all("#svc-grid .svc").forEach(function(card){ card.classList.toggle("dim", b !== "all" && card.dataset.b !== b); });
    });
  });

  /* price calculator (Services page): "Continue to booking" carries the ticked services to the builder */
  var list = $("#price-list");
  if (list) {
    var recalc = function(){
      var sum = 0, ids = [];
      $all("input[type=checkbox]:checked", list).forEach(function(cb){ sum += parseFloat(cb.dataset.price); ids.push(cb.dataset.id); });
      $("#calc-total").textContent = "R" + sum;
      $("#calc-book").href = "visit" + (ids.length ? "?s=" + ids.join(",") : "") + "#builder";
    };
    $all("input[type=checkbox]", list).forEach(function(cb){ cb.addEventListener("change", recalc); });
    recalc();
  }

  if ($("#b-services")) bookingBuilder();
  if ($("#manage")) managePage();

  /* before/after slider (Home page) */
  var ba = $("#ba-range");
  if (ba) {
    ba.addEventListener("input", function(){
      $(".ba .after").style.clipPath = "inset(0 0 0 " + ba.value + "%)";
      $("#ba-handle").style.left = ba.value + "%";
    });
  }
});

/* ===================== booking builder (Visit & Book) ===================== */
function bookingBuilder(){
  var builder = $("#b-services"), daySel = $("#b-day"), msg = $("#b-msg");
  var state = { day: null, slot: null, windowDays: 30, seq: 0 };

  // arriving from a Book button: tick the services named in ?s=
  var pre = new URLSearchParams(location.search).get("s");
  if (pre) pre.split(",").forEach(function(id){ var cb = $('input[data-id="' + id + '"]', builder); if (cb) cb.checked = true; });

  function ticked(){ return $all("input[type=checkbox]:checked", builder); }
  function barber(){ var r = $('input[name="barber"]:checked'); return { id: r ? r.value : "", name: r ? (r.dataset.name || r.value || "Any barber") : "Any barber" }; }
  function showMsg(text){ msg.textContent = text || ""; msg.hidden = !text; }

  // WhatsApp-only mode: preferred day list (today if there's still time, plus the next 7 days)
  var now = new Date(), nowP = parts(now), nowMins = (+nowP.hour) * 60 + (+nowP.minute), today = ymd(now);
  for (var i = 0; i < 8; i++) {
    var dd = addDays(today, i), wd = new Date(dd + "T12:00:00Z").getUTCDay();
    if (i === 0 && nowMins > KINGS.HOURS[wd][1]*60 - 45) continue;
    var label = (i === 0 ? "Today " : i === 1 ? "Tomorrow " : dayName(dd) + " ") + dayShort(dd).slice(4);
    var opt = document.createElement("option"); opt.value = opt.textContent = label; daySel.appendChild(opt);
  }

  function update(){
    var sum = 0, mins = 0, lines = [];
    ticked().forEach(function(cb){
      sum += parseFloat(cb.dataset.price); mins += parseInt(cb.dataset.mins, 10);
      lines.push("- " + cb.dataset.name + " (R" + cb.dataset.price + ")");
    });
    $("#b-total").textContent = "R" + sum;
    $("#b-dur").textContent = mins ? "about " + mins + " min" : "";
    var when;
    if (ONLINE) when = state.slot ? whenText(state.slot.start) : (state.day ? dayShort(state.day) + ", any time" : "As soon as possible");
    else { var part = $('input[name="part"]:checked').value; when = (daySel.value || "As soon as possible") + (part ? ", " + part : ""); }
    $("#b-pick").textContent = ONLINE && state.slot ? whenText(state.slot.start) : "";
    var text = (lines.length ? "Hi Kings, I'd like to book:\n" + lines.join("\n") + "\nTotal: R" + sum + " (about " + mins + " min)"
                             : "Hi Kings, I'd like to book a cut.")
             + "\nBarber: " + barber().name + "\nWhen: " + when + "\n\nPlease confirm " + (ONLINE && state.slot ? "this time." : "a time.");
    $("#b-wa").href = waLink(text);
  }
  $all("#b-services input, #b-barbers input, input[name=part], #b-day").forEach(function(el){ el.addEventListener("change", update); });
  update();
  if (!ONLINE) return;

  /* ---------- online mode ---------- */
  $all(".b-online").forEach(function(el){ el.hidden = false; });
  $all(".b-offline").forEach(function(el){ el.hidden = true; });
  var saved = store("kings-details");
  if (saved) { $("#b-name").value = saved.name || ""; $("#b-phone").value = saved.phone || ""; $("#b-email").value = saved.email || ""; }

  function renderDays(){
    var box = $("#b-days"); box.innerHTML = "";
    for (var i = 0; i <= state.windowDays; i++) {
      var day = addDays(today, i), d = new Date(day + "T12:00:00Z");
      var b = document.createElement("button");
      b.type = "button"; b.className = "day"; b.dataset.day = day;
      b.setAttribute("aria-pressed", day === state.day ? "true" : "false");
      b.innerHTML = "<b>" + (i === 0 ? "Today" : i === 1 ? "Tmrw" : WEEK[d.getUTCDay()].slice(0, 3)) + "</b><span>" + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + "</span>";
      b.setAttribute("aria-label", (i === 0 ? "Today, " : i === 1 ? "Tomorrow, " : "") + dayName(day) + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()]);
      b.addEventListener("click", function(){ pickDay(this.dataset.day); });
      box.appendChild(b);
    }
  }
  function pickDay(day){
    state.day = day; state.slot = null;
    $all("#b-days .day").forEach(function(b){ b.setAttribute("aria-pressed", b.dataset.day === day ? "true" : "false"); });
    var cur = $('#b-days .day[data-day="' + day + '"]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest", inline: "nearest" });
    loadSlots(); update();
  }
  function loadSlots(){
    var box = $("#b-slots"), ids = ticked().map(function(cb){ return cb.dataset.id; }), seq = ++state.seq;
    if (!ids.length) { box.innerHTML = '<p class="empty">Tick a service to see open times.</p>'; return; }
    box.innerHTML = '<p class="empty">Checking open times…</p>';
    var who = barber();
    api("rpc/available_slots", { p_day: state.day, p_services: ids, p_barber: who.id || null }).then(function(rows){
      if (seq !== state.seq) return;          // a newer request is on its way
      var seen = {}, groups = { Morning: [], Afternoon: [], Evening: [] };
      rows.forEach(function(r){
        if (seen[r.starts_at]) return; seen[r.starts_at] = 1;
        var h = +hm(r.starts_at).slice(0, 2);
        groups[h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening"].push(r);
      });
      if (!rows.length) {
        box.innerHTML = '<p class="empty">No open times ' + (state.day === today ? "left today" : "on " + dayName(state.day)) + (who.id ? " with " + who.name : "") + '.</p><button type="button" class="btn ghost sm" id="b-next">Find the next open time</button>';
        $("#b-next").addEventListener("click", findNext);
        return;
      }
      box.innerHTML = "";
      Object.keys(groups).forEach(function(g){
        if (!groups[g].length) return;
        var wrap = document.createElement("div"); wrap.className = "slot-group";
        wrap.innerHTML = "<h3>" + g + '</h3><div class="slot-grid"></div>';
        groups[g].forEach(function(r){
          var b = document.createElement("button");
          b.type = "button"; b.className = "slot"; b.textContent = hm(r.starts_at); b.dataset.start = r.starts_at;
          b.setAttribute("aria-pressed", state.slot && state.slot.start === r.starts_at ? "true" : "false");
          b.addEventListener("click", function(){
            state.slot = { start: r.starts_at, barberName: who.id ? who.name : "" };
            $all("#b-slots .slot").forEach(function(x){ x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
            showMsg(""); update();
            var name = $("#b-name"); if (!name.value) setTimeout(function(){ $("#b-details").scrollIntoView({ behavior: "smooth", block: "center" }); }, 150);
          });
          $(".slot-grid", wrap).appendChild(b);
        });
        box.appendChild(wrap);
      });
      if (state.slot && !seen[state.slot.start]) { state.slot = null; update(); }
    }).catch(function(e){ if (seq === state.seq) box.innerHTML = '<p class="empty">' + errText(e) + "</p>"; });
  }
  function findNext(){
    var ids = ticked().map(function(cb){ return cb.dataset.id; }), who = barber(), start = state.day;
    var box = $("#b-slots"); box.innerHTML = '<p class="empty">Looking for the next open time…</p>';
    (function look(n){
      if (n > state.windowDays) { box.innerHTML = '<p class="empty">No open times in the next ' + state.windowDays + ' days. Send it on WhatsApp and we\'ll fit you in.</p>'; return; }
      var day = addDays(start, n);
      if (day > addDays(today, state.windowDays)) return look(state.windowDays + 1);
      api("rpc/available_slots", { p_day: day, p_services: ids, p_barber: who.id || null }).then(function(rows){
        if (rows.length) pickDay(day); else look(n + 1);
      }).catch(function(e){ box.innerHTML = '<p class="empty">' + errText(e) + "</p>"; });
    })(1);
  }

  function confirm(){
    var ids = ticked().map(function(cb){ return cb.dataset.id; });
    var name = $("#b-name"), phone = $("#b-phone"), email = $("#b-email");
    [name, phone, email].forEach(function(x){ x.removeAttribute("aria-invalid"); });
    if (!ids.length) { showMsg(ERRORS.no_services); builder.scrollIntoView({ behavior: "smooth" }); return; }
    if (!state.slot) { showMsg("Pick a time first."); $("#b-when").scrollIntoView({ behavior: "smooth" }); return; }
    if (!name.value.trim()) { name.setAttribute("aria-invalid", "true"); showMsg(ERRORS.bad_name); name.focus(); return; }
    var digits = phone.value.replace(/\D/g, "");
    if (!/^(0\d{9}|27\d{9})$/.test(digits)) { phone.setAttribute("aria-invalid", "true"); showMsg(ERRORS.bad_phone); phone.focus(); return; }
    if (email.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { email.setAttribute("aria-invalid", "true"); showMsg(ERRORS.bad_email); email.focus(); return; }
    var btn = $("#b-confirm"); btn.disabled = true; btn.textContent = "Booking…"; showMsg("");
    api("rpc/book_online", { p_services: ids, p_barber: barber().id || null, p_start: state.slot.start,
                             p_name: name.value.trim(), p_phone: phone.value, p_email: email.value.trim() || null })
      .then(function(b){
        store("kings-details", { name: name.value.trim(), phone: phone.value, email: email.value.trim() });
        showDone(b);
      })
      .catch(function(e){
        showMsg(errText(e));
        if (e.code === "slot_taken") { state.slot = null; loadSlots(); update(); }
        if (e.code === "bad_phone") phone.setAttribute("aria-invalid", "true");
        if (e.code === "bad_email") email.setAttribute("aria-invalid", "true");
      })
      .then(function(){ btn.disabled = false; btn.textContent = "Confirm booking"; });
  }
  $("#b-confirm").addEventListener("click", confirm);

  function showDone(b){
    ["#b-form", "#b-bar", ".bar-note.b-online"].forEach(function(s){ $(s).hidden = true; });
    var done = $("#b-done"); done.hidden = false;
    $("#d-title").textContent = "See you " + dayName(ymd(new Date(b.starts_at))) + ", " + b.name.split(" ")[0];
    $("#d-when").textContent = whenText(b.starts_at);
    $("#d-barber").textContent = b.barber;
    $("#d-services").textContent = (b.services || []).map(function(s){ return s.name; }).join(", ");
    $("#d-total").textContent = rands(b.total_cents);
    $("#d-hint").textContent = "Pay in the shop: cash, card or SnapScan." + (b.has_email ? " A confirmation is on its way to your email." : "");
    var manage = "booking?t=" + b.token;
    $("#d-manage").href = manage;
    $("#d-google").href = googleCal(b, location.origin + "/" + manage);
    $("#d-ics").href = "data:text/calendar;charset=utf-8," + encodeURIComponent(ics(b, location.origin + "/" + manage));
    done.scrollIntoView({ behavior: "smooth", block: "start" }); done.focus({ preventScroll: true });
  }

  // settings, services (prices) and barbers from the database, then today's open times
  api("settings?select=window_days").then(function(r){ if (r && r[0]) state.windowDays = r[0].window_days; }).catch(function(){})
    .then(function(){ return Promise.all([hydratePrices().catch(function(){}), api("barbers?select=id,name,online&active=eq.true&order=sort").catch(function(){ return null; })]); })
    .then(function(res){
      var barbers = res[1];
      if (barbers) {
        var box = $("#b-barbers");
        box.innerHTML = '<label class="opt"><input type="radio" name="barber" value="" data-name="Any barber" checked><span>Any barber</span></label>';
        barbers.filter(function(b){ return b.online; }).forEach(function(b){
          var l = document.createElement("label"); l.className = "opt";
          l.innerHTML = '<input type="radio" name="barber"><span></span>';
          $("input", l).value = b.id; $("input", l).dataset.name = b.name; $("span", l).textContent = b.name;
          box.appendChild(l);
        });
      }
      $all("#b-barbers input").forEach(function(el){ el.addEventListener("change", function(){ state.slot = null; loadSlots(); update(); }); });
      $all("#b-services input").forEach(function(el){ el.addEventListener("change", function(){ loadSlots(); update(); }); });
      state.day = today; renderDays(); loadSlots(); update();
    });
}

/* calendar helpers for the confirmation */
function calStamp(iso){ return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
function googleCal(b, manageUrl){
  var what = (b.services || []).map(function(s){ return s.name; }).join(", ");
  return "https://calendar.google.com/calendar/render?" + new URLSearchParams({
    action: "TEMPLATE", text: "Kings Barbershop: " + what, dates: calStamp(b.starts_at) + "/" + calStamp(b.ends_at),
    details: "With " + b.barber + ". Manage your booking: " + manageUrl, location: "Kings Barbershop, Johannesburg" }).toString();
}
function ics(b, manageUrl){
  var what = (b.services || []).map(function(s){ return s.name; }).join(", ");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kings Barbershop//Booking//EN", "BEGIN:VEVENT",
    "UID:" + b.token + "@kings-barbershop", "DTSTAMP:" + calStamp(new Date().toISOString()),
    "DTSTART:" + calStamp(b.starts_at), "DTEND:" + calStamp(b.ends_at),
    "SUMMARY:Kings Barbershop: " + what, "DESCRIPTION:With " + b.barber + ". Manage your booking: " + manageUrl,
    "LOCATION:Kings Barbershop\\, Johannesburg",
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Kings Barbershop in 2 hours", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}

/* ===================== manage page (booking?t=...) ===================== */
function managePage(){
  var box = $("#manage"), token = new URLSearchParams(location.search).get("t");
  function state(text){ box.innerHTML = '<p class="state"></p>'; $(".state", box).textContent = text; }
  if (!ONLINE) return state("Online booking isn't switched on yet. Please WhatsApp us about your booking.");
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return state("This link is missing its booking code. Please use the link from your booking, or WhatsApp us.");
  function render(b){
    if (!b) return state("We couldn't find that booking. Please check the link, or WhatsApp us.");
    var labels = { booked: "Booked", cancelled: "Cancelled", done: "Completed", no_show: "Missed" };
    var tpl = $("#manage-tpl").content.cloneNode(true);
    box.innerHTML = ""; box.appendChild(tpl);
    var tag = $(".status-tag", box); tag.textContent = labels[b.status] || b.status; tag.className = "status-tag " + b.status;
    $("#m-title").textContent = b.status === "cancelled" ? "Booking cancelled" : "Your booking, " + b.name.split(" ")[0];
    $("#m-when").textContent = whenText(b.starts_at);
    $("#m-barber").textContent = b.barber;
    $("#m-services").textContent = (b.services || []).map(function(s){ return s.name; }).join(", ");
    $("#m-total").textContent = rands(b.total_cents);
    var hours = Math.round((b.cancel_cutoff_minutes || 240) / 60);
    var cancel = $("#m-cancel"), note = $("#m-note"), wa = $("#m-wa");
    wa.href = waLink("Hi Kings, it's about my booking on " + whenText(b.starts_at) + " with " + b.barber + ".");
    if (b.status === "booked" && b.can_cancel) {
      note.textContent = "Can't make it? Cancel here up to " + hours + " hours before, then book a new time.";
      cancel.hidden = false;
      $("#m-cal").href = googleCal(b, location.href);
    } else if (b.status === "booked") {
      note.textContent = "It's less than " + hours + " hours to your booking, so changes go through WhatsApp.";
      $("#m-cal").href = googleCal(b, location.href);
    } else {
      note.textContent = b.status === "cancelled" ? "This time is free for someone else now. Book a new time whenever you're ready." : "";
      $("#m-cal").hidden = true;
      $("#m-new").hidden = false;
    }
    cancel.addEventListener("click", function(){
      if (!window.confirm("Cancel your booking on " + whenText(b.starts_at) + "?")) return;
      cancel.disabled = true; cancel.textContent = "Cancelling…";
      api("rpc/cancel_by_token", { p_token: token }).then(render).catch(function(e){
        note.textContent = errText(e); cancel.disabled = false; cancel.textContent = "Cancel booking";
      });
    });
  }
  api("rpc/booking_by_token", { p_token: token }).then(render).catch(function(e){ state(errText(e)); });
}
