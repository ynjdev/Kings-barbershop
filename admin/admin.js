/* Kings Admin: the front desk's view of every booking.
   Uses the settings and helpers in /site.js (KINGS, api helpers, date helpers) and the Supabase client.
   Everything it can see or change is decided by the database rules in supabase/schema.sql. */
(function(){
  var sb, data = { barbers: [], services: [], hours: [], settings: {} };
  var view = { day: ymd(new Date()), remind: addDays(ymd(new Date()), 1), appts: [] };
  var ROW = 22;                         // pixels per 15 minutes on the day grid
  var SEL = "id,kind,barber_id,starts_at,ends_at,status,source,total_cents,paid,paid_method,note,token,reminded_at,reminder_email_at,created_at," +
            "client:clients(id,name,phone,email),services:appointment_services(position,service_id,name,price_cents,minutes)";

  /* ---------- small helpers ---------- */
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function isoAt(day, hhmm){ return new Date(day + "T" + hhmm + ":00+02:00").toISOString(); }   // Johannesburg is UTC+2 all year
  function minsOf(iso){ var p = parts(new Date(iso)); return (+p.hour) * 60 + (+p.minute); }
  function clock(m){ return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
  function toMins(t){ var x = String(t).split(":"); return (+x[0]) * 60 + (+x[1]); }
  function normPhone(v){ var d = String(v || "").replace(/\D/g, ""); if (/^0\d{9}$/.test(d)) d = "27" + d.slice(1); return /^27\d{9}$/.test(d) ? d : null; }
  function fmtPhone(p){ return p && p.length === 11 ? "0" + p.slice(2, 4) + " " + p.slice(4, 7) + " " + p.slice(7) : (p || ""); }
  function waTo(phone, text){ return "https://wa.me/" + phone + "?text=" + encodeURIComponent(text); }
  function first(name){ return String(name || "").trim().split(/\s+/)[0]; }
  function svcNames(a){ return (a.services || []).slice().sort(function(x, y){ return x.position - y.position; }).map(function(s){ return s.name; }).join(", "); }
  function barberName(id){ var b = data.barbers.find(function(x){ return x.id === id; }); return b ? b.name : "?"; }
  function siteUrl(){ return (data.settings.site_url || location.origin).replace(/\/$/, ""); }
  function relDay(day){ var t = ymd(new Date()); return day === t ? "today" : day === addDays(t, 1) ? "tomorrow, " + dayShort(day) : "on " + dayShort(day); }
  var SOURCES = { online: "Booked online", whatsapp: "Booked on WhatsApp", walk_in: "Walk-in", phone: "Booked by phone", front_desk: "Booked in person" };
  var STATUS = { booked: "Booked", done: "Done", no_show: "No-show", cancelled: "Cancelled" };
  function friendly(e){
    var m = (e && (e.message || e.code)) || "";
    if (/slot_taken|no_double_booking|23P01/.test(m + (e && e.code))) return "That barber is busy then. Pick another time or barber.";
    if (/bad_phone|clients_phone_check/.test(m)) return "Check the number: a South African number like 082 123 4567.";
    if (/bad_name/.test(m)) return "Add the client's name.";
    if (/clients_email_check|bad_email/.test(m)) return "That email doesn't look right.";
    if (/clients_phone_key|duplicate key/.test(m)) return "Another client already has that number.";
    if (/no_services/.test(m)) return "Tick at least one service.";
    if (/not_staff|permission|JWT/.test(m)) return "Your sign-in has expired. Sign in again.";
    return "Something went wrong: " + m;
  }
  function toast(html, ms){
    var t = $("#toast"); t.innerHTML = html; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function(){ t.hidden = true; }, ms || 5000);
  }
  function err(el, e){ el.textContent = e ? (typeof e === "string" ? e : friendly(e)) : ""; el.hidden = !e; }
  function q(p){ return p.then(function(r){ if (r.error) throw r.error; return r.data; }); }
  function timeOptions(sel, fromM, toM, step, selected, label){
    sel.innerHTML = "";
    for (var m = fromM; m <= toM; m += step) {
      var o = document.createElement("option"); o.value = clock(m); o.textContent = clock(m) + (label ? label(m) : "");
      if (clock(m) === selected) o.selected = true;
      sel.appendChild(o);
    }
  }
  function closeOnButtons(root){ $all("[data-close]", root).forEach(function(b){ b.addEventListener("click", function(){ b.closest("dialog").close(); }); }); }

  /* ---------- start ---------- */
  document.addEventListener("DOMContentLoaded", function(){
    if (!ONLINE || !window.supabase) { $("#setup").hidden = false; return; }
    sb = supabase.createClient(KINGS.SUPABASE_URL, KINGS.SUPABASE_ANON_KEY);
    sb.auth.getSession().then(function(r){ if (r.data.session) start(); else showLogin(); });
    $("#login-form").addEventListener("submit", function(ev){
      ev.preventDefault(); err($("#l-err"));
      var btn = $("#l-go"); btn.disabled = true; btn.textContent = "Signing in…";
      sb.auth.signInWithPassword({ email: $("#l-email").value.trim(), password: $("#l-pass").value }).then(function(r){
        btn.disabled = false; btn.textContent = "Sign in";
        if (r.error) return err($("#l-err"), "Wrong email or password.");
        start();
      });
    });
    $("#signout").addEventListener("click", function(){ sb.auth.signOut().then(function(){ location.reload(); }); });
    $all("dialog").forEach(closeOnButtons);
  });
  function showLogin(){ $("#login").hidden = false; $("#app").hidden = true; $("#l-email").focus(); }

  function start(){
    q(sb.rpc("is_staff")).then(function(ok){
      if (!ok) { sb.auth.signOut(); showLogin(); return err($("#l-err"), "This login isn't set up as front desk yet. See SETUP-BOOKINGS.md, part 4."); }
      return loadRef().then(function(){
        $("#login").hidden = true; $("#app").hidden = false;
        wire(); tab((location.hash || "#day").slice(1));
      });
    }).catch(function(e){ showLogin(); err($("#l-err"), e); });
  }
  function loadRef(){
    return Promise.all([
      q(sb.from("barbers").select("*").order("sort").order("name")),
      q(sb.from("services").select("*").order("sort").order("name")),
      q(sb.from("working_hours").select("*")),
      q(sb.from("settings").select("*").limit(1))
    ]).then(function(r){ data.barbers = r[0]; data.services = r[1]; data.hours = r[2]; data.settings = r[3][0] || {}; });
  }
  function activeBarbers(){ return data.barbers.filter(function(b){ return b.active; }); }
  function hoursFor(barberId, day){
    var wd = new Date(day + "T12:00:00Z").getUTCDay();
    var h = data.hours.find(function(x){ return x.barber_id === barberId && x.weekday === wd; });
    return h ? { from: toMins(h.starts), to: toMins(h.ends) } : null;
  }

  /* ---------- tabs ---------- */
  var wired = false;
  function wire(){
    if (wired) return; wired = true;
    $all(".a-tabs button").forEach(function(b){ b.addEventListener("click", function(){ tab(b.dataset.tab); }); });
    $("#d-date").addEventListener("change", function(){ if (this.value) { view.day = this.value; loadDay(); } });
    $("#d-prev").addEventListener("click", function(){ view.day = addDays(view.day, -1); loadDay(); });
    $("#d-next").addEventListener("click", function(){ view.day = addDays(view.day, 1); loadDay(); });
    $("#d-today").addEventListener("click", function(){ view.day = ymd(new Date()); loadDay(); });
    $("#d-new").addEventListener("click", function(){ openBook({ day: view.day }); });
    $("#d-walkin").addEventListener("click", walkIn);
    $("#d-block").addEventListener("click", function(){ openBlock({ day: view.day }); });
    $("#r-date").addEventListener("change", function(){ if (this.value) { view.remind = this.value; loadRemind(); } });
    $("#r-prev").addEventListener("click", function(){ view.remind = addDays(view.remind, -1); loadRemind(); });
    $("#r-next").addEventListener("click", function(){ view.remind = addDays(view.remind, 1); loadRemind(); });
    var t; $("#c-q").addEventListener("input", function(){ clearTimeout(t); t = setTimeout(loadClients, 250); });
    wireBook(); wireBlock(); wireSettings();
    setInterval(function(){ if (!$("#t-day").hidden && !document.querySelector("dialog[open]")) loadDay(true); }, 60000);   // stay current
  }
  function tab(name){
    if (!{ day: 1, remind: 1, clients: 1, settings: 1 }[name]) name = "day";
    $all(".a-tabs button").forEach(function(b){ if (b.dataset.tab === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    $all(".a-sec").forEach(function(s){ s.hidden = s.id !== "t-" + name; });
    history.replaceState(null, "", "#" + name);
    if (name === "day") loadDay();
    if (name === "remind") loadRemind();
    if (name === "clients") loadClients();
    if (name === "settings") renderSettings();
  }

  /* ================= DAY ================= */
  function fetchDay(day, barberId){
    var r = sb.from("appointments").select(SEL).gte("starts_at", isoAt(day, "00:00")).lt("starts_at", isoAt(addDays(day, 1), "00:00")).neq("status", "cancelled").order("starts_at");
    if (barberId) r = r.eq("barber_id", barberId);
    return q(r);
  }
  function loadDay(quiet){
    $("#d-date").value = view.day;
    return fetchDay(view.day).then(function(rows){ view.appts = rows; renderDay(); })
      .catch(function(e){ if (!quiet) toast(esc(friendly(e))); });
  }
  function renderDay(){
    var day = view.day, today = ymd(new Date()), barbers = activeBarbers();
    $("#d-title").innerHTML = esc(dayName(day) + " " + dayShort(day).slice(4)) + (day === today ? ' <span class="pill">Today</span>' : "");
    var bookings = view.appts.filter(function(a){ return a.kind === "booking"; });
    var expected = bookings.filter(function(a){ return a.status !== "no_show"; }).reduce(function(s, a){ return s + a.total_cents; }, 0);
    var paid = bookings.filter(function(a){ return a.paid; }).reduce(function(s, a){ return s + a.total_cents; }, 0);
    var noshow = bookings.filter(function(a){ return a.status === "no_show"; }).length;
    $("#d-sum").innerHTML = "<span><b>" + bookings.length + "</b> booking" + (bookings.length === 1 ? "" : "s") + "</span><span><b>" + rands(expected) + "</b> expected</span><span><b>" + rands(paid) + "</b> paid</span>" + (noshow ? "<span><b>" + noshow + "</b> no-show</span>" : "");

    // grid covers every barber's hours, plus anything booked outside them
    var from = 24 * 60, to = 0;
    barbers.forEach(function(b){ var h = hoursFor(b.id, day); if (h) { from = Math.min(from, h.from); to = Math.max(to, h.to); } });
    view.appts.forEach(function(a){ from = Math.min(from, minsOf(a.starts_at)); to = Math.max(to, minsOf(a.ends_at)); });
    if (from >= to) { from = 8 * 60; to = 18 * 60; }
    from = Math.floor(from / 60) * 60; to = Math.ceil(to / 60) * 60;
    var H = (to - from) / 15 * ROW, grid = $("#grid");
    grid.style.setProperty("--cols", barbers.length);
    var html = '<div class="g-head"><div></div>' + barbers.map(function(b){ return "<div>" + esc(b.name) + "</div>"; }).join("") + "</div>";
    html += '<div class="g-body" style="height:' + H + 'px"><div class="g-rail">';
    for (var m = from; m < to; m += 60) html += '<span style="top:' + ((m - from) / 15 * ROW) + 'px">' + clock(m) + "</span>";
    html += "</div>";
    barbers.forEach(function(b){
      var h = hoursFor(b.id, day);
      html += '<div class="g-col" data-barber="' + b.id + '">';
      if (!h) html += '<div class="g-off" style="top:0;height:' + H + 'px"><span>Day off</span></div>';
      else {
        if (h.from > from) html += '<div class="g-off" style="top:0;height:' + ((h.from - from) / 15 * ROW) + 'px"></div>';
        if (h.to < to) html += '<div class="g-off" style="top:' + ((h.to - from) / 15 * ROW) + "px;height:" + ((to - h.to) / 15 * ROW) + 'px"></div>';
      }
      view.appts.filter(function(a){ return a.barber_id === b.id; }).forEach(function(a){
        var top = (minsOf(a.starts_at) - from) / 15 * ROW, ht = Math.max(ROW, (minsOf(a.ends_at) - minsOf(a.starts_at)) / 15 * ROW - 2);
        if (a.kind === "block") html += '<button type="button" class="g-appt block" data-id="' + a.id + '" style="top:' + top + "px;height:" + ht + 'px"><b>' + hm(a.starts_at) + "</b> " + esc(a.note || "Blocked") + "</button>";
        else html += '<button type="button" class="g-appt ' + a.status + (a.paid ? " paid" : "") + '" data-id="' + a.id + '" style="top:' + top + "px;height:" + ht + 'px"><b>' + hm(a.starts_at) + "</b> " + esc(a.client ? a.client.name : "") +
                     (a.paid ? ' <i aria-label="paid">✓</i>' : "") + '<span class="g-svc">' + esc(svcNames(a)) + "</span></button>";
      });
      html += "</div>";
    });
    if (day === today) { var now = minsOf(new Date().toISOString()); if (now > from && now < to) html += '<div class="g-now" style="top:' + ((now - from) / 15 * ROW) + 'px"></div>'; }
    html += "</div>";
    grid.innerHTML = html;
    $all(".g-appt", grid).forEach(function(el){ el.addEventListener("click", function(ev){ ev.stopPropagation(); openAppt(view.appts.find(function(a){ return a.id === el.dataset.id; })); }); });
    $all(".g-col", grid).forEach(function(col){
      col.addEventListener("click", function(ev){
        var m = from + Math.floor((ev.clientY - col.getBoundingClientRect().top) / ROW) * 15;
        openBook({ day: day, barber: col.dataset.barber, time: clock(m) });
      });
    });
  }

  /* ---------- one appointment ---------- */
  function confirmText(a, token){
    return "Hi " + first(a.client.name) + ", you're booked at Kings: " + svcNames(a) + " with " + barberName(a.barber_id) + ", " + whenText(a.starts_at) +
           ". Total " + rands(a.total_cents) + ", pay in the shop (cash, card or SnapScan). To cancel, use this link up to " +
           Math.round((data.settings.cancel_cutoff_minutes || 240) / 60) + " hours before: " + siteUrl() + "/booking?t=" + (token || a.token);
  }
  function openAppt(a){
    if (!a) return;
    var d = $("#dlg-appt"), body = $("#ap-body");
    if (a.kind === "block") {
      body.innerHTML = "<h2>Blocked time</h2><p>" + esc(barberName(a.barber_id)) + ", " + esc(whenText(a.starts_at)) + " to " + hm(a.ends_at) + "</p><p class=\"muted\">" + esc(a.note || "") + "</p>" +
        '<div class="dlg-btns"><button type="button" class="btn ghost" data-close>Close</button><button type="button" class="btn" id="ap-unblock">Remove block</button></div>';
      closeOnButtons(body);
      $("#ap-unblock").addEventListener("click", function(){ act(q(sb.from("appointments").delete().eq("id", a.id)), "Block removed."); });
      return d.showModal();
    }
    var c = a.client || {};
    var rows = (a.services || []).slice().sort(function(x, y){ return x.position - y.position; }).map(function(s){ return "<div><span>" + esc(s.name) + "</span><b>" + rands(s.price_cents) + "</b></div>"; }).join("");
    body.innerHTML =
      '<div class="ap-head"><h2>' + esc(c.name) + '</h2><span class="status-tag ' + a.status + '">' + STATUS[a.status] + (a.paid ? ", paid" + (a.paid_method ? " by " + ({ snapscan: "SnapScan", card: "card", cash: "cash" }[a.paid_method]) : "") : "") + "</span></div>" +
      '<p class="ap-when">' + esc(whenText(a.starts_at)) + " to " + hm(a.ends_at) + " with " + esc(barberName(a.barber_id)) + "</p>" +
      '<div class="done-card">' + rows + '<div><span>Total</span><b>' + rands(a.total_cents) + "</b></div></div>" +
      '<p class="muted small">' + esc(fmtPhone(c.phone)) + (c.email ? " · " + esc(c.email) : "") + " · " + esc(SOURCES[a.source] || "") + (a.note ? "<br>Note: " + esc(a.note) : "") + "</p>" +
      '<div class="ap-actions" id="ap-actions"></div>' +
      '<div class="ap-move" id="ap-move" hidden><div class="row3"><label class="field"><span>Barber</span><select id="mv-barber"></select></label><label class="field"><span>Date</span><input type="date" id="mv-date"></label><label class="field"><span>Time</span><select id="mv-time"></select></label></div><p class="a-err" id="mv-err" hidden></p><button type="button" class="btn sm" id="mv-save">Move booking</button></div>' +
      '<div class="dlg-btns"><a class="btn wa sm" target="_blank" rel="noopener" id="ap-wa">Message on WhatsApp</a><button type="button" class="btn ghost sm" data-close>Close</button></div>';
    closeOnButtons(body);
    $("#ap-wa").href = waTo(c.phone, "Hi " + first(c.name) + ", ");
    var acts = $("#ap-actions");
    if (a.status === "booked") {
      acts.innerHTML = '<p class="lbl">Done and paid by</p><div class="ap-pay"><button type="button" class="btn sm" data-pay="cash">Cash</button><button type="button" class="btn sm" data-pay="card">Card</button><button type="button" class="btn sm" data-pay="snapscan">SnapScan</button></div>' +
        '<div class="ap-more"><button type="button" class="btn ghost sm" id="ap-move-btn">Move</button><button type="button" class="btn ghost sm" id="ap-noshow">No-show</button><button type="button" class="btn ghost sm danger" id="ap-cancel">Cancel booking</button>' +
        '<a class="btn ghost sm" target="_blank" rel="noopener" id="ap-confirm">Send confirmation</a></div>';
      $all("[data-pay]", acts).forEach(function(b){ b.addEventListener("click", function(){ act(q(sb.from("appointments").update({ status: "done", paid: true, paid_method: b.dataset.pay }).eq("id", a.id)), esc(first(c.name)) + " marked done and paid."); }); });
      $("#ap-noshow").addEventListener("click", function(){ act(q(sb.from("appointments").update({ status: "no_show" }).eq("id", a.id)), esc(first(c.name)) + " marked as a no-show."); });
      $("#ap-cancel").addEventListener("click", function(){
        if (!confirm("Cancel " + c.name + "'s booking on " + whenText(a.starts_at) + "?")) return;
        act(q(sb.from("appointments").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", a.id)),
            "Booking cancelled. <a target=\"_blank\" rel=\"noopener\" href=\"" + esc(waTo(c.phone, "Hi " + first(c.name) + ", your Kings booking on " + whenText(a.starts_at) + " has been cancelled. Reply here any time to book a new time.")) + "\">Tell " + esc(first(c.name)) + " on WhatsApp</a>", 12000);
      });
      $("#ap-confirm").href = waTo(c.phone, confirmText(a));
      $("#ap-move-btn").addEventListener("click", function(){
        var box = $("#ap-move"); box.hidden = false;
        var bs = $("#mv-barber"); bs.innerHTML = activeBarbers().map(function(b){ return '<option value="' + b.id + '"' + (b.id === a.barber_id ? " selected" : "") + ">" + esc(b.name) + "</option>"; }).join("");
        $("#mv-date").value = ymd(new Date(a.starts_at));
        var len = minsOf(a.ends_at) - minsOf(a.starts_at);
        var fill = function(){ busyTimes($("#mv-time"), bs.value, $("#mv-date").value, len, hm(a.starts_at), a.id); };
        bs.onchange = fill; $("#mv-date").onchange = fill; fill();
        $("#mv-save").onclick = function(){
          act(q(sb.rpc("staff_move", { p_id: a.id, p_barber: bs.value, p_start: isoAt($("#mv-date").value, $("#mv-time").value) })),
              "Moved. <a target=\"_blank\" rel=\"noopener\" href=\"" + esc(waTo(c.phone, "Hi " + first(c.name) + ", your Kings booking has moved to " + whenText(isoAt($("#mv-date").value, $("#mv-time").value)) + " with " + barberName(bs.value) + ". Manage it here: " + siteUrl() + "/booking?t=" + a.token)) + "\">Tell " + esc(first(c.name)) + " on WhatsApp</a>", 12000, $("#mv-err"));
        };
      });
    } else {
      acts.innerHTML = '<button type="button" class="btn ghost sm" id="ap-undo">Undo: back to booked</button>';
      $("#ap-undo").addEventListener("click", function(){ act(q(sb.from("appointments").update({ status: "booked", paid: false, paid_method: null }).eq("id", a.id)), "Back to booked."); });
    }
    d.showModal();
  }
  function act(promise, msg, ms, errEl){
    return promise.then(function(){ $all("dialog[open]").forEach(function(x){ x.close(); }); toast(msg, ms); return reloadCurrent(); })
      .catch(function(e){ if (errEl) err(errEl, e); else toast(esc(friendly(e))); });
  }
  function reloadCurrent(){
    if (!$("#t-remind").hidden) return loadRemind();
    if (!$("#t-clients").hidden) return loadClients();
    return loadDay();
  }

  // time dropdown in 5-minute steps, marking times this barber is busy or closed
  function busyTimes(sel, barberId, day, len, selected, ignoreId, autoPick){
    var h = hoursFor(barberId, day);
    var paint = function(appts){
      timeOptions(sel, 6 * 60, 21 * 60, 5, selected, function(m){
        var busy = appts.some(function(a){ return a.id !== ignoreId && a.barber_id === barberId && minsOf(a.starts_at) < m + len && minsOf(a.ends_at) > m; });
        var closed = !h || m < h.from || m + len > h.to;
        return busy ? "  · busy" : closed ? "  · outside hours" : "";
      });
      var cur = $all("option", sel).find(function(o){ return o.value === sel.value; });
      if (!selected || (autoPick && cur && /·/.test(cur.textContent))) {
        var from = selected ? toMins(selected) : 0;
        var free = $all("option", sel).find(function(o){ return toMins(o.value) >= from && !/·/.test(o.textContent) && toMins(o.value) % 15 === 0; })
                || $all("option", sel).find(function(o){ return !/·/.test(o.textContent) && toMins(o.value) % 15 === 0; });
        if (free) sel.value = free.value;
      }
    };
    if (day === view.day) paint(view.appts); else fetchDay(day, barberId).then(paint).catch(function(){ paint([]); });
  }

  /* ---------- new booking ---------- */
  var chosen = null;     // an existing client picked from the suggestions
  var timeTouched = false; // the desk picked the time (or tapped it on the grid): don't move it for them
  function wireBook(){
    var t;
    ["#fb-phone", "#fb-name"].forEach(function(s){
      $(s).addEventListener("input", function(){ chosen = null; $("#fb-phone").classList.remove("known"); clearTimeout(t); t = setTimeout(suggest, 250); });
    });
    $("#fb-barber").addEventListener("change", refreshTimes);
    $("#fb-date").addEventListener("change", refreshTimes);
    $("#fb-save").addEventListener("click", saveBook);
    $("#fb-time").addEventListener("change", function(){ timeTouched = true; });
  }
  function suggest(){
    var box = $("#fb-suggest"), digits = $("#fb-phone").value.replace(/\D/g, ""), name = $("#fb-name").value.trim();
    var term = digits.length >= 3 ? digits.replace(/^0/, "") : name.length >= 2 ? name : "";
    if (!term) { box.hidden = true; return; }
    var qy = sb.from("clients").select("id,name,phone,email").limit(5);
    qy = digits.length >= 3 ? qy.ilike("phone", "%" + term + "%") : qy.ilike("name", "%" + term.replace(/[%_,()]/g, "") + "%");
    q(qy).then(function(rows){
      if (!rows.length) { box.hidden = true; return; }
      box.innerHTML = rows.map(function(c, i){ return '<button type="button" data-i="' + i + '"><b>' + esc(c.name) + "</b> " + esc(fmtPhone(c.phone)) + "</button>"; }).join("");
      box.hidden = false;
      $all("button", box).forEach(function(b){ b.addEventListener("click", function(){
        chosen = rows[+b.dataset.i];
        $("#fb-name").value = chosen.name; $("#fb-phone").value = fmtPhone(chosen.phone); $("#fb-email").value = chosen.email || "";
        $("#fb-phone").classList.add("known"); box.hidden = true;
      }); });
    }).catch(function(){ box.hidden = true; });
  }
  function bookTotals(){
    var ids = $all("#fb-svcs input:checked").map(function(x){ return x.value; });
    var s = data.services.filter(function(x){ return ids.indexOf(x.id) >= 0; });
    return { ids: ids, cents: s.reduce(function(a, x){ return a + x.price_cents; }, 0), mins: s.reduce(function(a, x){ return a + x.minutes; }, 0) };
  }
  function refreshTimes(){
    var t = bookTotals(), keep = $("#fb-time").value;
    busyTimes($("#fb-time"), $("#fb-barber").value, $("#fb-date").value, t.mins || 15, keep || refreshTimes.pre, null, !timeTouched);
    refreshTimes.pre = null;
    $("#fb-total").textContent = t.ids.length ? rands(t.cents) + " · " + t.mins + " min" : "";
  }
  function openBook(pre){
    pre = pre || {}; chosen = pre.client || null;
    var d = $("#dlg-book"); err($("#fb-err"));
    $("#fb-title").textContent = pre.source === "walk_in" ? "Walk-in" : "New booking";
    $("#fb-name").value = chosen ? chosen.name : ""; $("#fb-phone").value = chosen ? fmtPhone(chosen.phone) : ""; $("#fb-email").value = chosen ? (chosen.email || "") : "";
    $("#fb-phone").classList.toggle("known", !!chosen); $("#fb-suggest").hidden = true; $("#fb-note").value = "";
    $("#fb-svcs").innerHTML = data.services.filter(function(s){ return s.active; }).map(function(s){
      return '<label class="check"><input type="checkbox" value="' + esc(s.id) + '"><span>' + esc(s.name) + ' <small>' + rands(s.price_cents) + " · " + s.minutes + " min</small></span></label>"; }).join("");
    $all("#fb-svcs input").forEach(function(x){ x.addEventListener("change", refreshTimes); });
    $("#fb-barber").innerHTML = activeBarbers().map(function(b){ return '<option value="' + b.id + '">' + esc(b.name) + "</option>"; }).join("");
    if (pre.barber) $("#fb-barber").value = pre.barber;
    $("#fb-date").value = pre.day || view.day;
    $("#fb-source").value = pre.source || "whatsapp";
    $("#fb-time").innerHTML = ""; timeTouched = !!pre.time; refreshTimes.pre = pre.time || null; refreshTimes();
    d.showModal();
    (chosen ? $("#fb-svcs input") : $("#fb-phone")).focus();
  }
  function saveBook(){
    var t = bookTotals(), e = $("#fb-err"), phone = normPhone($("#fb-phone").value), name = $("#fb-name").value.trim();
    if (!chosen && !phone) return err(e, "Check the number: a South African number like 082 123 4567.");
    if (!chosen && !name) return err(e, "Add the client's name.");
    if (!t.ids.length) return err(e, "Tick at least one service.");
    var start = isoAt($("#fb-date").value, $("#fb-time").value), btn = $("#fb-save");
    btn.disabled = true;
    q(sb.rpc("staff_book", { p_services: t.ids, p_barber: $("#fb-barber").value, p_start: start, p_client: chosen ? chosen.id : null,
                             p_name: chosen ? null : name, p_phone: chosen ? null : phone, p_email: chosen ? null : ($("#fb-email").value.trim() || null),
                             p_source: $("#fb-source").value, p_note: $("#fb-note").value.trim() || null }))
      .then(function(id){ return q(sb.from("appointments").select(SEL).eq("id", id).single()); })
      .then(function(a){
        $("#dlg-book").close();
        view.day = ymd(new Date(a.starts_at));
        toast("Booked: " + esc(a.client.name) + ", " + esc(whenText(a.starts_at)) + " with " + esc(barberName(a.barber_id)) + '. <a target="_blank" rel="noopener" id="t-confirm" href="' + esc(waTo(a.client.phone, confirmText(a))) + '">Send confirmation on WhatsApp</a>', 15000);
        return $("#t-day").hidden ? reloadCurrent() : loadDay();
      })
      .catch(function(x){ err(e, x); })
      .then(function(){ btn.disabled = false; });
  }
  function walkIn(){
    var now = new Date(), m = minsOf(now.toISOString()); m = m - (m % 5);
    var day = ymd(now);
    // first barber free right now for a 30-minute cut
    var free = activeBarbers().find(function(b){
      return !view.appts.some(function(a){ return view.day === day && a.barber_id === b.id && minsOf(a.starts_at) < m + 30 && minsOf(a.ends_at) > m; });
    });
    openBook({ day: day, time: clock(m), source: "walk_in", barber: free ? free.id : null });
  }

  /* ---------- block time ---------- */
  function wireBlock(){
    $("#fk-save").addEventListener("click", function(){
      var day = $("#fk-date").value, a = $("#fk-from").value, b = $("#fk-to").value;
      if (toMins(b) <= toMins(a)) return err($("#fk-err"), "The end time must be after the start time.");
      act(q(sb.rpc("staff_block", { p_barber: $("#fk-barber").value, p_start: isoAt(day, a), p_end: isoAt(day, b), p_note: $("#fk-note").value.trim() || null })),
          "Time blocked.", 4000, $("#fk-err"));
    });
  }
  function openBlock(pre){
    err($("#fk-err"));
    $("#fk-barber").innerHTML = activeBarbers().map(function(b){ return '<option value="' + b.id + '">' + esc(b.name) + "</option>"; }).join("");
    $("#fk-date").value = pre.day; $("#fk-note").value = "";
    timeOptions($("#fk-from"), 6 * 60, 21 * 60, 15, "12:00"); timeOptions($("#fk-to"), 6 * 60 + 15, 22 * 60, 15, "13:00");
    $("#dlg-block").showModal();
  }

  /* ================= REMINDERS ================= */
  function reminderText(a){
    return "Hi " + first(a.client.name) + ", a reminder of your booking at Kings " + relDay(ymd(new Date(a.starts_at))) + " at " + hm(a.starts_at) +
           " with " + barberName(a.barber_id) + " (" + svcNames(a) + "). Reply 1 to confirm, or 2 if you need to move it. See you then!";
  }
  function loadRemind(){
    var day = view.remind; $("#r-date").value = day;
    var tmrw = addDays(ymd(new Date()), 1);
    $("#r-title").innerHTML = esc((day === tmrw ? "Tomorrow, " : "") + dayName(day) + " " + dayShort(day).slice(4));
    return fetchDay(day).then(function(rows){
      var list = rows.filter(function(a){ return a.kind === "booking" && a.status === "booked"; });
      var byEmail = function(a){ return data.settings.emails_on && a.client.email; };
      var toDo = list.filter(function(a){ return !byEmail(a) && !a.reminded_at; }).length;
      $("#r-sum").innerHTML = list.length ? "<b>" + toDo + "</b> to remind on WhatsApp · " + list.filter(function(a){ return a.reminded_at; }).length + " reminded · " + list.filter(byEmail).length + " by email"
                                          : "No bookings on this day.";
      var box = $("#r-list"); box.innerHTML = "";
      list.forEach(function(a){
        var row = document.createElement("div"); row.className = "r-row";
        var right;
        if (byEmail(a)) right = '<span class="muted small">' + (a.reminder_email_at ? "Email reminder sent" : "Email reminder goes automatically") + "</span>";
        else if (a.reminded_at) right = '<span class="ok">Reminded ' + hm(a.reminded_at) + '</span> <a class="a-link small" target="_blank" rel="noopener" data-remind>Send again</a>';
        else right = '<a class="btn wa sm" target="_blank" rel="noopener" data-remind>Remind on WhatsApp</a>';
        row.innerHTML = '<div class="r-time">' + hm(a.starts_at) + '</div><div class="r-who"><b>' + esc(a.client.name) + "</b><span>" + esc(barberName(a.barber_id)) + " · " + esc(svcNames(a)) + '</span></div><div class="r-act">' + right + "</div>";
        var link = $("[data-remind]", row);
        if (link) {
          link.href = waTo(a.client.phone, reminderText(a));
          link.addEventListener("click", function(){
            q(sb.from("appointments").update({ reminded_at: new Date().toISOString() }).eq("id", a.id)).then(function(){ setTimeout(loadRemind, 400); }).catch(function(e){ toast(esc(friendly(e))); });
          });
        }
        box.appendChild(row);
      });
    }).catch(function(e){ toast(esc(friendly(e))); });
  }

  /* ================= CLIENTS ================= */
  function loadClients(){
    var term = $("#c-q").value.trim(), digits = term.replace(/\D/g, "");
    var qy = sb.from("clients").select("id,name,phone,email,notes,created_at,appointments(starts_at,status,kind)").limit(40);
    if (digits.length >= 3) qy = qy.ilike("phone", "%" + digits.replace(/^0/, "") + "%");
    else if (term.length >= 2) qy = qy.ilike("name", "%" + term.replace(/[%_,()]/g, "") + "%");
    else qy = qy.order("created_at", { ascending: false });
    return q(qy).then(function(rows){
      var box = $("#c-list"), now = new Date().toISOString();
      if (!rows.length) { box.innerHTML = '<p class="muted">' + (term ? "No clients match that." : "No clients yet. They appear here after their first booking.") + "</p>"; return; }
      box.innerHTML = "";
      rows.forEach(function(c){
        var ap = (c.appointments || []).filter(function(a){ return a.kind === "booking"; });
        var visits = ap.filter(function(a){ return a.status === "done"; }).length, ns = ap.filter(function(a){ return a.status === "no_show"; }).length;
        var next = ap.filter(function(a){ return a.status === "booked" && a.starts_at > now; }).sort(function(x, y){ return x.starts_at < y.starts_at ? -1 : 1; })[0];
        var row = document.createElement("button"); row.type = "button"; row.className = "c-row";
        row.innerHTML = "<b>" + esc(c.name) + "</b><span>" + esc(fmtPhone(c.phone)) + "</span><span>" + visits + " visit" + (visits === 1 ? "" : "s") + (ns ? ", " + ns + " no-show" : "") + "</span><span>" + (next ? "Next: " + esc(whenText(next.starts_at)) : "") + "</span>";
        row.addEventListener("click", function(){ openClient(c.id); });
        box.appendChild(row);
      });
    }).catch(function(e){ toast(esc(friendly(e))); });
  }
  function openClient(id){
    q(sb.from("clients").select("id,name,phone,email,notes,appointments(id,starts_at,status,total_cents,barber_id,kind,services:appointment_services(name,position))").eq("id", id).single()).then(function(c){
      var hist = (c.appointments || []).filter(function(a){ return a.kind === "booking"; }).sort(function(x, y){ return x.starts_at < y.starts_at ? 1 : -1; });
      $("#cl-body").innerHTML = "<h2>" + esc(c.name) + '</h2><div class="row2"><label class="field"><span>Name</span><input id="cl-name"></label><label class="field"><span>Number</span><input id="cl-phone" type="tel"></label></div>' +
        '<label class="field"><span>Email</span><input id="cl-email" type="email"></label><label class="field"><span>Notes <small>only staff see these</small></span><input id="cl-notes" maxlength="300" placeholder="Clipper 2 on the sides, likes a hard part"></label>' +
        '<p class="a-err" id="cl-err" hidden></p><div class="dlg-btns"><a class="btn wa sm" target="_blank" rel="noopener" href="' + esc(waTo(c.phone, "Hi " + first(c.name) + ", ")) + '">WhatsApp</a><button type="button" class="btn ghost sm" id="cl-book">New booking</button><button type="button" class="btn sm" id="cl-save">Save</button></div>' +
        '<h3 class="a-h">History</h3><div class="hist">' + (hist.length ? hist.map(function(a){
          return "<div><span>" + esc(whenText(a.starts_at)) + "</span><span>" + esc(svcNames(a)) + " · " + esc(barberName(a.barber_id)) + '</span><span class="status-tag ' + a.status + '">' + STATUS[a.status] + "</span></div>"; }).join("") : '<p class="muted small">No bookings yet.</p>') +
        '</div><div class="dlg-btns"><button type="button" class="btn ghost sm" data-close>Close</button></div>';
      $("#cl-name").value = c.name; $("#cl-phone").value = fmtPhone(c.phone); $("#cl-email").value = c.email || ""; $("#cl-notes").value = c.notes || "";
      closeOnButtons($("#cl-body"));
      $("#cl-book").addEventListener("click", function(){ $("#dlg-client").close(); openBook({ client: c, day: view.day }); });
      $("#cl-save").addEventListener("click", function(){
        var p = normPhone($("#cl-phone").value);
        if (!p) return err($("#cl-err"), "Check the number: a South African number like 082 123 4567.");
        act(q(sb.from("clients").update({ name: $("#cl-name").value.trim(), phone: p, email: $("#cl-email").value.trim().toLowerCase() || null, notes: $("#cl-notes").value.trim() || null }).eq("id", c.id)),
            "Client saved.", 4000, $("#cl-err"));
      });
      $("#dlg-client").showModal();
    }).catch(function(e){ toast(esc(friendly(e))); });
  }

  /* ================= SETTINGS ================= */
  function wireSettings(){
    $("#s-add-service").addEventListener("click", function(){
      var name = prompt("Name of the new service (for example: Beard dye)");
      if (!name) return;
      var id = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "service";
      saveRef(q(sb.from("services").insert({ id: id, name: name.trim(), price_cents: 10000, minutes: 30, sort: data.services.length + 1 })), "Service added. Set its price and time, then Save.");
    });
    $("#s-add-barber").addEventListener("click", function(){
      var name = prompt("New barber's name");
      if (!name) return;
      q(sb.from("barbers").insert({ name: name.trim(), role: "Barber", sort: data.barbers.length + 1 }).select().single()).then(function(b){
        var src = data.barbers[0], rows = data.hours.filter(function(h){ return src && h.barber_id === src.id; }).map(function(h){ return { barber_id: b.id, weekday: h.weekday, starts: h.starts, ends: h.ends }; });
        return rows.length ? q(sb.from("working_hours").insert(rows)) : null;
      }).then(function(){ return saveRef(Promise.resolve(), "Barber added with the shop's hours. Adjust below."); }).catch(function(e){ toast(esc(friendly(e))); });
    });
    $("#s-rules").addEventListener("submit", function(ev){
      ev.preventDefault();
      var f = this, wa = f.shop_whatsapp.value.trim() ? normPhone(f.shop_whatsapp.value) : null;
      if (f.shop_whatsapp.value.trim() && !wa) return toast("Check the shop WhatsApp number.");
      saveRef(q(sb.from("settings").update({ lead_minutes: +f.lead_minutes.value, window_days: +f.window_days.value, cancel_cutoff_minutes: Math.round(+f.cancel_hours.value * 60),
        max_upcoming_per_phone: +f.max_upcoming_per_phone.value, shop_whatsapp: wa, emails_on: f.emails_on.checked }).eq("id", true)), "Booking rules saved.");
    });
  }
  function saveRef(p, msg){ return p.then(loadRef).then(function(){ renderSettings(); toast(msg); }).catch(function(e){ toast(esc(friendly(e))); }); }
  function renderSettings(){
    var sv = $("#s-services");
    sv.innerHTML = '<div class="t-row t-head"><span>Service</span><span>Price (R)</span><span>Minutes</span><span>Online</span><span>On menu</span><span></span></div>';
    data.services.forEach(function(s){
      var r = document.createElement("div"); r.className = "t-row" + (s.active ? "" : " off");
      r.innerHTML = '<label><span class="sr">Name</span><input data-k="name"></label><label><span class="sr">Price</span><input data-k="price" type="number" min="0" step="5"></label><label><span class="sr">Minutes</span><input data-k="minutes" type="number" min="5" step="5"></label>' +
                    '<label class="tog"><input type="checkbox" data-k="online"><span class="sr">Bookable online</span></label><label class="tog"><input type="checkbox" data-k="active"><span class="sr">On the menu</span></label><button type="button" class="btn sm ghost">Save</button>';
      $('[data-k="name"]', r).value = s.name; $('[data-k="price"]', r).value = s.price_cents / 100; $('[data-k="minutes"]', r).value = s.minutes;
      $('[data-k="online"]', r).checked = s.online; $('[data-k="active"]', r).checked = s.active;
      $("button", r).addEventListener("click", function(){
        var mins = +$('[data-k="minutes"]', r).value;
        if (!mins || mins % 5) return toast("Minutes must be a multiple of 5.");
        saveRef(q(sb.from("services").update({ name: $('[data-k="name"]', r).value.trim(), price_cents: Math.round(+$('[data-k="price"]', r).value * 100), minutes: mins,
          online: $('[data-k="online"]', r).checked, active: $('[data-k="active"]', r).checked }).eq("id", s.id)), esc(s.name) + " saved.");
      });
      sv.appendChild(r);
    });
    var bx = $("#s-barbers"); bx.innerHTML = "";
    data.barbers.forEach(function(b){
      var card = document.createElement("div"); card.className = "b-card" + (b.active ? "" : " off");
      var days = [1, 2, 3, 4, 5, 6, 0].map(function(wd){
        var h = data.hours.find(function(x){ return x.barber_id === b.id && x.weekday === wd; });
        return '<div class="h-row"><label class="check"><input type="checkbox" data-wd="' + wd + '"' + (h ? " checked" : "") + "><span>" + WEEK[wd] + '</span></label><input type="time" step="900" data-from="' + wd + '" value="' + (h ? h.starts.slice(0, 5) : "08:00") + '"><input type="time" step="900" data-to="' + wd + '" value="' + (h ? h.ends.slice(0, 5) : "18:00") + '"></div>';
      }).join("");
      card.innerHTML = '<div class="row3"><label class="field"><span>Name</span><input data-k="name"></label><label class="field"><span>Role</span><input data-k="role"></label><div class="b-flags"><label class="check"><input type="checkbox" data-k="active"><span>Working here</span></label><label class="check"><input type="checkbox" data-k="online"><span>Bookable online</span></label></div></div>' +
                       '<div class="hours-grid">' + days + '</div><button type="button" class="btn sm ghost">Save ' + esc(b.name) + "</button>";
      $('[data-k="name"]', card).value = b.name; $('[data-k="role"]', card).value = b.role || "";
      $('[data-k="active"]', card).checked = b.active; $('[data-k="online"]', card).checked = b.online;
      $("button", card).addEventListener("click", function(){
        var keep = [], drop = [];
        for (var wd = 0; wd < 7; wd++) {
          var on = $('[data-wd="' + wd + '"]', card).checked, f = $('[data-from="' + wd + '"]', card).value, t = $('[data-to="' + wd + '"]', card).value;
          if (on && toMins(t) <= toMins(f)) return toast(WEEK[wd] + ": closing time must be after opening time.");
          if (on) keep.push({ barber_id: b.id, weekday: wd, starts: f, ends: t }); else drop.push(wd);
        }
        saveRef(q(sb.from("barbers").update({ name: $('[data-k="name"]', card).value.trim(), role: $('[data-k="role"]', card).value.trim() || null, active: $('[data-k="active"]', card).checked, online: $('[data-k="online"]', card).checked }).eq("id", b.id))
          .then(function(){ return keep.length ? q(sb.from("working_hours").upsert(keep)) : null; })
          .then(function(){ return drop.length ? q(sb.from("working_hours").delete().eq("barber_id", b.id).in("weekday", drop)) : null; }), esc($('[data-k="name"]', card).value) + " saved.");
      });
      bx.appendChild(card);
    });
    var f = $("#s-rules"), s = data.settings;
    f.lead_minutes.value = s.lead_minutes; f.window_days.value = s.window_days; f.cancel_hours.value = (s.cancel_cutoff_minutes || 0) / 60;
    f.max_upcoming_per_phone.value = s.max_upcoming_per_phone; f.shop_whatsapp.value = s.shop_whatsapp || ""; f.emails_on.checked = !!s.emails_on;
  }
})();
