# Kings Barbershop

Static 4-page site for Kings Barbershop (Johannesburg), with its own booking system: clients book open times online, the front desk runs every booking from `/admin`, and a Supabase database (free) keeps it all. No build step. Vercel serves the files as they are.

To switch the booking system on, follow **SETUP-BOOKINGS.md**. Until then the site books through WhatsApp.

## Pages

| File | Live address | What's on it |
|---|---|---|
| index.html | / | Loading screen (his lion), hero with a looping video behind it, what Kings means, 4 featured services, before/after (sample), reviews, booking |
| services.html | /services | Barber filter, services grid, full price list + calculator, Pay per visit / Standing Chair |
| barbers.html | /barbers | Team cards, shop gallery, what to expect, booking |
| visit.html | /visit | Booking: services, barber, open times, details, confirmation. Then address + hours, FAQ |
| booking.html | /booking?t=... | The client's own booking: view it, add it to their calendar, cancel it (not indexed by Google) |
| admin/ | /admin | The front desk admin: Day grid, Reminders, Clients, Settings (not indexed by Google) |

`vercel.json` gives the pages clean addresses (`/services` instead of `/services.html`).

## Shared files

| File | What it does |
|---|---|
| styles.css | All the styling, used by every page |
| site.js | All the behaviour (online booking, booking links, menu, calculator, loading screen), used by every page |
| admin/admin.js, admin/admin.css | The admin's behaviour and layout (it also uses styles.css and site.js) |
| img/ | The photos and the hero video (see Photos and video below) |
| email-logo.png | His logo at the top of booking emails |
| og-image.jpg | The picture WhatsApp, Facebook and Instagram show when someone shares a link: his lion, the slogan and the name |
| lion-96.webp, lion-480.webp, lion-900.webp | Jermaine's lion in three sizes. The small one is the nav/footer logo, the bigger two are for the loading screen (the browser picks the size that fits the screen) |
| logo.png | His full logo on black, for Google (named in the JSON-LD block in index.html) |
| favicon.svg, favicon.ico, apple-touch-icon.png | Browser tab and phone home-screen icons: his crowned K mark |
| robots.txt, sitemap.xml | Tell Google which pages to index (and to skip /admin and /booking) |
| supabase/schema.sql, supabase/seed.sql | The database: tables, the no-double-booking rule, the booking functions and the security rules; then the starter services, barbers and hours |
| supabase/functions/send-emails/, supabase/cron.sql | Automatic confirmation and reminder emails (switched on later, see SETUP-BOOKINGS.md part 5) |
| .vercelignore | Keeps the supabase folder and the guides off the live site |

## Settings: one place

Open `site.js`. The SETTINGS block at the top controls every page:

- `WA_NUMBER`: Jermaine's WhatsApp Business number, digits only, starting 27
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`: connect online booking (SETUP-BOOKINGS.md part 3). Leave empty and the site books through WhatsApp only.
- `GA_ID`: the Google Analytics measurement ID. Analytics stays off until this is a real ID.
- `HOURS`: opening hours used for the "Next opening" text while online booking is off (once it's on, "Next opening" shows the real next free time)
- `PRELOADER_MS`: how long the lion shows on the home page (3000 = 3 seconds)
- `SAMPLE_PHOTOS`: `true` shows a small "Sample photo" tag on the stock photos. Set it to `false` once every stock photo has been swapped for a real Kings one.

## Colours and lettering

Everything follows Jermaine's logo.

- **Gold** lives at the top of `styles.css`, taken from the lettering in his logo: `--gold` for accents, `--gold-2` for small text, `--metal` for the shiny gradient on buttons, prices and the name, and `--on-gold` for text sitting on gold.
- **Lettering**: his logo is set in Cinzel, so the site uses Cinzel for the name in the nav, labels above headings, the nav links and the phone menu. All of that sits in one block at the bottom of `styles.css`. Headlines stay Cormorant italic and body text stays Archivo.
- **The name** is written `KingS` in the HTML. Cinzel shows lowercase letters as small capitals, so it comes out exactly like his logo: big K, small ING, big S.
- **The loading screen shine** is CSS (`#preloader .lion::after`). `site.js` adds the `shine` class once the lion has faded in.
- **The full logo pack** (vector files, one-colour versions, social sizes) is separate from the site, in Kings-Logo-Pack-Gold.

## Photos and video

The photos in `img/` are free stock photos from Pexels (free for commercial use, no credit needed). They're placeholders until Jermaine sends real ones, and each one carries a small "Sample photo" tag so nobody takes them for Kings' own work. The barber cards stay empty on purpose: those have to be real Kings barbers. The before/after slider has a sample for now: one photo, with the Before side toned dull and grey by the page (`.ba .before>img` in styles.css), and the text above it says it's a sample.

| Where | Files | Shows |
|---|---|---|
| Home: what Kings means | img/story-consult-480.webp, img/story-consult-800.webp | A consultation, which is what the copy next to it talks about |
| Home and Services: service cards | img/svc-signature-cut-480.webp, img/svc-skin-fade-480.webp, img/svc-cut-beard-480.webp, img/svc-hot-towel-480.webp (each also in a 960 size) | The cut, the fade, the beard and the hot towel |
| Barbers: gallery | img/gal-chair-540.webp (big tile), img/gal-tools-420.webp, img/gal-razor-420.webp, img/gal-fade-420.webp, img/gal-pole-420.webp (each also in a bigger size) | The shop, the tools, the craft |
| Home: before and after | img/ba-fade-800.webp, img/ba-fade-1400.webp | A finished fade. The same photo fills both sides |
| Home: hero | img/hero-720.mp4, img/hero-480.mp4, img/hero-720.webm, img/hero-480.webm, img/hero-poster.webp | A straight razor, looping behind the headline |

Every photo was cropped to its slot and toned to the same warm black-and-gold look, then saved as WebP in two sizes. The browser picks the size that fits the screen.

**The hero video** is 7 seconds, silent and loops without a jump. Phones get the smaller file, computers the bigger one. It only starts once the page has loaded, so it never slows the first screen. People who have "reduce motion" or data saver switched on on their phone just see the still picture (`img/hero-poster.webp`). The WebM files are only for the few browsers that can't play MP4. A dark fade sits over the video (`.hero::after` in styles.css) so the headline and text stay easy to read.

**Swapping in real photos:** crop the real photo to roughly the same shape, save it under the same file name (both sizes), and push. Nothing else needs to change. Then update the `alt` text in the HTML to describe the new photo, and once no stock photos are left, set `SAMPLE_PHOTOS` to `false` in site.js. For the before/after, use two photos of the same client from the same angle: add the before photo as a new file, point the Before side's `<img>` at it, delete the `.ba .before>img` filter line in styles.css, and change the text above the slider. For the video, replace all five hero files, or delete the `<video>` line in index.html to go back to the plain dark hero.

## How booking works

Every "Book" button leads to the booking builder on Visit & Book. Service cards and the Services price list send people there with their services already ticked (for example `visit?s=skin-fade#builder`).

**Online (once Supabase is connected):** the client ticks services, picks a barber (or any barber), taps a day and an open time, adds their name, WhatsApp number and, if they like, an email, and presses **Confirm booking**. They're booked straight away and get a manage link to view or cancel (online cancelling closes 4 hours before). "Any barber" goes to the free barber with the fewest bookings that day.

**WhatsApp:** **Send on WhatsApp** opens WhatsApp with everything already written, including the time they picked. The front desk adds it in the admin (**New booking**), which then offers a ready-made WhatsApp confirmation with the client's manage link.

**Walk-ins:** the front desk taps **Walk-in** in the admin. It picks the first free barber and the current time.

**Why double bookings can't happen:** the rule lives in the database (`no_double_booking` in schema.sql). Postgres refuses any booking or blocked time that overlaps another one for the same barber, whoever tries it and however fast.

**Reminders:** clients who gave an email get automatic emails once they're switched on. Everyone else is on the admin's **Reminders** tab with a one-tap WhatsApp reminder.

**Prices:** the database is the source of truth. When online booking is on, the website replaces the prices written in the pages with the ones from the admin's Settings, and every booking stores the price it was made at.

The other WhatsApp buttons ("Questions? WhatsApp us", footer, menu) open a plain "I have a question" message.

## Things that appear on more than one page

- **Nav, phone menu and footer** are the same block on all 4 pages, including the logo (`lion-96.webp` + `KingS`). Change one, change all four.
- **Prices**: change them in the admin (Settings). Also update the fallback prices written in services.html, visit.html and index.html (shown when online booking is off, and read by Google), and `priceRange` in the JSON-LD block at the top of index.html.
- **Opening hours**: visit.html (Find us), `HOURS` in site.js, and `openingHoursSpecification` in the JSON-LD block in index.html.
- **Street address**: visit.html, plus `streetAddress` in the JSON-LD block in index.html.
- **Social links**: the footer `href="#"` links on all 4 pages.

## Placeholders to swap before launch

- The settings in site.js (above)
- Street address, Google Maps link and social links
- Prices, Standing Chair price (R650) and terms
- Barber two and barber three names and bios
- Photos (every grey block with a label)

## If the site gets its own domain

Find and replace `kings-barbershop-six.vercel.app` with the new domain in all 4 pages, booking.html, robots.txt and sitemap.xml, and update Site URL in the email function's secrets.
