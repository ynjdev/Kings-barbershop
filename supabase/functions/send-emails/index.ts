// Supabase Edge Function: sends booking confirmations and day-before reminders.
// Runs every 10 minutes (see ../../cron.sql). Only emails clients who gave an email address;
// the admin's Tomorrow list shows everyone else for a WhatsApp reminder.
//
// Secrets to set in Supabase > Edge Functions > Secrets:
//   RESEND_API_KEY  from resend.com (free plan)
//   EMAIL_FROM      e.g. "Kings Barbershop <bookings@yourdomain.co.za>" (domain verified in Resend)
//   SITE_URL        e.g. https://kings-barbershop-six.vercel.app
//   CRON_SECRET     any long random text; the same text goes in cron.sql
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// Deploy with JWT verification OFF: this function checks CRON_SECRET itself.
import { createClient } from "npm:@supabase/supabase-js@2";
import { confirmEmail, reminderEmail } from "./templates.js";

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("Unauthorized", { status: 401 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const site = (Deno.env.get("SITE_URL") || "").replace(/\/$/, "");
  const from = Deno.env.get("EMAIL_FROM")!;
  const key = Deno.env.get("RESEND_API_KEY")!;

  const { data: due, error } = await db.rpc("emails_due");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const result = { sent: 0, failed: 0 };
  for (const row of (due || []).slice(0, 50)) {
    const msg = row.kind === "confirm" ? confirmEmail(row.booking, site) : reminderEmail(row.booking, site);
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [row.email], subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (r.ok) {
      await db.rpc("mark_email_sent", { p_id: row.appointment_id, p_kind: row.kind });
      result.sent++;
    } else {
      result.failed++;   // left unmarked, so the next run tries again
      console.error("email failed", row.kind, row.appointment_id, r.status, await r.text());
    }
  }
  return Response.json(result);
});
