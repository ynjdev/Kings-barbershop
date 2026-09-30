# Switching on Kings' own booking system

Everything here is free. It takes about 30 minutes, once. Until it's done, the site keeps working: clients book through WhatsApp.

What you end up with:

- **On the website:** clients pick services, a barber and an open time, and they're booked. They get a link to view or cancel.
- **At /admin:** the front desk sees every chair, adds WhatsApp and walk-in bookings, marks cuts done and paid, blocks time and sends reminders.
- **In the database:** Postgres itself refuses two overlapping bookings for the same barber, so double bookings can't happen, even if two people tap the same time at once.

---

## Part 1. Create the Supabase project (5 min)

1. Go to **supabase.com** and sign up. "Continue with GitHub" is quickest.
2. Click **New project**.
   - Organization: your own is fine (you can transfer it to Jermaine later).
   - Name: `kings-barbershop`
   - Database password: press **Generate** and save it in your password manager. You won't need it day to day.
   - Region: Supabase has no South African region. Pick **West EU (Ireland)**, **West EU (London)** or **Central EU (Frankfurt)**. These are usually the fastest from Johannesburg.
   - Plan: **Free**.
3. Wait about 2 minutes while it sets up.

## Part 2. Build the database (3 min)

1. In the left menu open **SQL Editor**, then **New query**.
2. Open `supabase/schema.sql` from the site folder, copy everything, paste it in, and press **Run**. You should see "Success. No rows returned".
3. New query again. Paste all of `supabase/seed.sql` and press **Run**. This loads the 7 services, prices, 3 barbers and opening hours from the website. You can change all of them later in the admin.

Running `supabase/schema.sql` again later (for example after an update from Luminar) is safe. It doesn't delete bookings.

## Part 3. Connect the website (5 min)

1. In Supabase open **Project Settings**, then **API Keys**.
2. Copy the **Project URL** (it looks like `https://abcdxyz.supabase.co`).
3. Copy the **publishable** key (starts with `sb_publishable_`). If you only see a legacy "anon public" key (starts with `eyJ`), that works too.
4. Open `site.js` and fill in the two settings at the top:
   ```
   SUPABASE_URL: "https://abcdxyz.supabase.co",
   SUPABASE_ANON_KEY: "sb_publishable_xxxxxxxx",
   ```
   Never paste the **secret** or **service_role** key into the site. Those keys can do anything.
5. Push it (see HOW-TO-UPDATE.md). The Visit & Book page now shows real open times.

## Part 4. Give the front desk a login (5 min)

1. In Supabase open **Authentication**, then **Users**, then **Add user**, then **Create new user**.
   - Email: the front desk's email. Password: a strong one. Tick **Auto Confirm User**.
2. Click the new user and copy its **UID** (a long code like `8f1c…`).
3. Open **SQL Editor** and run this. Swap `PASTE-THE-UID-HERE` for the UID and keep the quotes around it:
   ```sql
   insert into staff (user_id, name, role) values ('PASTE-THE-UID-HERE', 'Front desk', 'front_desk');
   ```
   Filled in, it looks like `values ('8f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f', 'Front desk', 'front_desk')`.
   Do the same for Jermaine and yourself if you want logins, using `'admin'` as the role.
4. Stop strangers from creating accounts: **Authentication**, then **Sign In / Providers**, then turn off **Allow new users to sign up**. Only people you add can log in, and only people in the `staff` table see any data.
5. Open `https://kings-barbershop-six.vercel.app/admin` and sign in.

## Part 5. Automatic emails (later, once Kings has its own email domain)

Until then, the admin's **Reminders** tab lists everyone for a one-tap WhatsApp reminder. Nothing is lost.

When Kings has a domain (for example `kingsbarbershop.co.za`):

1. Sign up at **resend.com** (free plan). Add the domain and add the DNS records it shows you where the domain is managed. Wait for "Verified".
2. In Resend, create an **API key** and copy it.
3. In Supabase open **Edge Functions**, then **Deploy a new function**, then **Via Editor**. Name it `send-emails`.
   - Paste `supabase/functions/send-emails/index.ts` into `index.ts`.
   - Add a file called `templates.js` and paste `supabase/functions/send-emails/templates.js` into it.
   - Deploy. Then open the function's settings and turn **off** "Verify JWT" (the function checks its own secret instead).
4. In **Edge Functions**, then **Secrets**, add:
   - `RESEND_API_KEY`: the key from step 2
   - `EMAIL_FROM`: e.g. `Kings Barbershop <bookings@kingsbarbershop.co.za>`
   - `SITE_URL`: `https://kings-barbershop-six.vercel.app` (or the new domain)
   - `CRON_SECRET`: any long random text (mash the keyboard, 30+ characters)
5. Open `supabase/cron.sql`. Replace `CHANGE-ME-project-ref` (from your Project URL) and `CHANGE-ME-cron-secret` (same text as step 4), then run it in the SQL Editor.
6. In the admin, go to **Settings**, tick **Automatic emails are switched on**, and save.

From then on, clients who give an email get a confirmation straight away and a reminder the day before. The Reminders tab only lists clients without email.

## Part 6. Test it (5 min)

1. Book yourself on the Visit & Book page with your own number.
2. Open the admin: the booking is on the Day grid. Tap it, then tap **Send confirmation** to see the WhatsApp message.
3. Open the manage link from the confirmation and cancel. The time is free again on the website.
4. Try booking the same time twice from two phones. The second one gets "that time was just taken".

## Good to know

- **Prices, services, barbers, hours:** change them in the admin under **Settings**. The website shows the new prices straight away. Existing bookings keep the price they were booked at.
- **Online booking rules** (how far ahead, how late clients can cancel, and so on) are also in **Settings**.
- **Barbers don't need logins.** The front desk runs the day. Barbers can glance at the Day grid on the shop tablet if you want.
- **Free plan pauses:** Supabase may pause free projects that nobody uses for about a week. Once bookings come in daily this won't happen. If it does, open the project in Supabase and press **Restore**.
- **Standing Chair** membership comes after launch. The database is ready for it.
