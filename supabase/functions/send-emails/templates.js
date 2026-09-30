// Kings Barbershop booking emails. Plain functions so they can be tested outside Supabase.
// Each returns { subject, html, text }. `b` is the booking as returned by booking_json() in schema.sql.

const TZ = "Africa/Johannesburg";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const rand = (cents) => "R" + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));

export function when(iso) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(d).replace(/,/g, "");
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { day, time, full: `${day} at ${time}` };
}

export function calendarLink(b, site) {
  const f = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const what = (b.services || []).map((s) => s.name).join(", ");
  const q = new URLSearchParams({
    action: "TEMPLATE", text: `Kings Barbershop: ${what}`, dates: `${f(b.starts_at)}/${f(b.ends_at)}`,
    details: `With ${b.barber}. Manage your booking: ${site}/booking?t=${b.token}`, location: "Kings Barbershop, Johannesburg",
  });
  return "https://calendar.google.com/calendar/render?" + q.toString();
}

function layout(title, intro, b, site, note) {
  const w = when(b.starts_at);
  const manage = `${site}/booking?t=${b.token}`;
  const hours = Math.round((b.cancel_cutoff_minutes ?? 240) / 60);
  const wa = b.shop_whatsapp ? `https://wa.me/${b.shop_whatsapp}` : null;
  const rows = (b.services || []).map((s) =>
    `<tr><td style="padding:6px 0;color:#F5F1E8">${esc(s.name)}</td><td style="padding:6px 0;color:#F5F1E8;text-align:right">${rand(s.price_cents)}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#0D0D0D;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#161514;border:1px solid #2A2622">
<tr><td style="padding:26px 28px 8px"><img src="${esc(site)}/email-logo.png" width="120" height="126" alt="KINGS BARBERSHOP" style="display:block;border:0;font-family:Georgia,serif;font-size:22px;font-weight:bold;letter-spacing:2px;color:#E0B252"></td></tr>
<tr><td style="padding:6px 28px 0;font-family:Georgia,serif;font-style:italic;font-size:26px;color:#F5F1E8">${esc(title)}</td></tr>
<tr><td style="padding:12px 28px 4px;font-size:15px;line-height:1.6;color:#A9A197">${intro}</td></tr>
<tr><td style="padding:14px 28px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;border-top:1px solid #2A2622;border-bottom:1px solid #2A2622">
    <tr><td style="padding:10px 0 4px;color:#A9A197">When</td><td style="padding:10px 0 4px;text-align:right;color:#F5F1E8;font-weight:bold">${esc(w.full)}</td></tr>
    <tr><td style="padding:4px 0 10px;color:#A9A197">Barber</td><td style="padding:4px 0 10px;text-align:right;color:#F5F1E8">${esc(b.barber)}</td></tr>
    ${rows}
    <tr><td style="padding:10px 0;color:#E0B252;font-weight:bold;border-top:1px solid #2A2622">Total</td><td style="padding:10px 0;text-align:right;color:#E0B252;font-weight:bold;border-top:1px solid #2A2622">${rand(b.total_cents)}</td></tr>
  </table>
  <p style="margin:10px 0 0;font-size:13px;color:#A9A197">Pay in the shop: cash, card or SnapScan.</p>
</td></tr>
<tr><td style="padding:8px 28px 4px">
  <a href="${esc(manage)}" style="display:inline-block;background:#E0B252;color:#140E05;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 20px">Manage booking</a>
  &nbsp; <a href="${esc(calendarLink(b, site))}" style="color:#EBCB7E;font-size:14px">Add to calendar</a>
</td></tr>
<tr><td style="padding:14px 28px 26px;font-size:13px;line-height:1.6;color:#A9A197">${note} You can cancel online up to ${hours} hours before${wa ? `, or <a href="${esc(wa)}" style="color:#EBCB7E">WhatsApp us</a>` : ""}.</td></tr>
</table>
<p style="font-size:12px;color:#6F685F;margin:16px 0 0">Walk in a subject. Walk out a king.</p>
</td></tr></table></body></html>`;
  const text = [
    `KINGS BARBERSHOP`, ``, title, ``,
    `When: ${w.full}`, `Barber: ${b.barber}`,
    ...(b.services || []).map((s) => `${s.name}: ${rand(s.price_cents)}`),
    `Total: ${rand(b.total_cents)} (pay in the shop: cash, card or SnapScan)`, ``,
    `Manage booking: ${manage}`, `Add to calendar: ${calendarLink(b, site)}`, ``,
    `You can cancel online up to ${hours} hours before${wa ? `, or WhatsApp us: ${wa}` : ""}.`,
  ].join("\n");
  return { html, text };
}

export function confirmEmail(b, site) {
  const w = when(b.starts_at);
  const { html, text } = layout(`You're booked, ${b.name}`, `Here are your booking details. See you ${esc(w.day)}.`, b, site, "Plans changed?");
  return { subject: `You're booked: ${w.full} with ${b.barber}`, html, text: `Hi ${b.name}, you're booked.\n\n` + text };
}

export function reminderEmail(b, site) {
  const w = when(b.starts_at);
  const first = (b.services || [])[0]?.name || "cut";
  const { html, text } = layout(`See you soon, ${b.name}`, `A quick reminder of your booking at Kings.`, b, site, "Can't make it? Please let us know so someone else can have the chair.");
  return { subject: `Reminder: ${first} on ${w.full} with ${b.barber}`, html, text: `Hi ${b.name}, a quick reminder of your booking.\n\n` + text };
}
