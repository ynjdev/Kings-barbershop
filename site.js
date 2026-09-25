/* Kings Barbershop: shared script for every page */

/* ===== SETTINGS: change these, every page updates ===== */
var KINGS = {
  WA_NUMBER: "27000000000",   // Jermaine's WhatsApp Business number, digits only, starting 27
  FRESHA_URL: "#",            // Kings' Fresha booking page link
  GA_ID: "G-XXXXXXXXXX",      // Google Analytics measurement ID (analytics stays off until this is real)
  // Opening hours for the "Next opening" text: day: [opens, closes], 0 = Sunday.
  // Keep in step with the hours on the Visit & Book page.
  HOURS: {0:[9,14], 1:[8,18], 2:[8,18], 3:[8,18], 4:[8,18], 5:[8,18], 6:[8,17]},
  PRELOADER_MS: 3000          // how long the crest shows on the home page
};
/* ======================================================= */

function waLink(text){ return "https://wa.me/" + KINGS.WA_NUMBER + "?text=" + encodeURIComponent(text); }
function $(sel, root){ return (root || document).querySelector(sel); }
function $all(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

/* Google Analytics: only loads once a real ID is set */
if (KINGS.GA_ID.indexOf("XXXX") === -1) {
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
    p.classList.add("go"); // play the crest animation now, not in the background
    // two animation frames = the browser has really painted (frames don't run while hidden)
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ setTimeout(hide, KINGS.PRELOADER_MS); }); });
  }
  window.addEventListener("load", function(){ ready = true; start(); });
  setTimeout(function(){ ready = true; start(); }, 5000); // don't wait forever on a slow file
  document.addEventListener("visibilitychange", start);
})();

/* "Next opening" text */
function hhmm(mins){ return String(Math.floor(mins/60)).padStart(2,"0") + ":" + String(mins%60).padStart(2,"0"); }
function nextSlot(){
  var now = new Date(), day = now.getDay(), mins = now.getHours()*60 + now.getMinutes();
  var open = KINGS.HOURS[day][0]*60, lastStart = KINGS.HOURS[day][1]*60 - 45; // last booking 45 min before close
  if (mins < open) return "Today, " + hhmm(open);
  var next = Math.ceil((mins + 1)/30)*30; // next half hour from now
  if (next <= lastStart) return "Today, " + hhmm(next);
  return "Tomorrow, " + hhmm(KINGS.HOURS[(day + 1) % 7][0]*60);
}
var slot = nextSlot();
var mainMsg = "Hi Kings, I'd like to book a chair. Next opening: " + slot + ".";

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
  $all("[data-fresha]").forEach(function(a){ a.href = KINGS.FRESHA_URL; });
  $all("[data-wa-service]").forEach(function(a){
    a.href = waLink("Hi Kings, I'd like to book: " + a.dataset.waService + " (" + a.dataset.waPrice + "). Next opening: " + slot + ".");
  });

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

  /* price calculator (Services page) */
  var list = $("#price-list");
  if (list) {
    var recalc = function(){
      var sum = 0, items = [];
      $all("input[type=checkbox]:checked", list).forEach(function(cb){ sum += parseInt(cb.dataset.price, 10); items.push(cb.dataset.name); });
      $("#calc-total").textContent = "R" + sum;
      $("#calc-book").href = waLink(items.length
        ? "Hi Kings, I'd like to book: " + items.join(", ") + ". Total: R" + sum + ". Next opening: " + slot + "."
        : mainMsg);
    };
    $all("input[type=checkbox]", list).forEach(function(cb){ cb.addEventListener("change", recalc); });
    recalc();
  }

  /* before/after slider (Home page) */
  var ba = $("#ba-range");
  if (ba) {
    ba.addEventListener("input", function(){
      $(".ba .after").style.clipPath = "inset(0 0 0 " + ba.value + "%)";
      $("#ba-handle").style.left = ba.value + "%";
    });
  }
});
