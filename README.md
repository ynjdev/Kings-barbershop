# Kings Barbershop

Static 5-page site for Kings Barbershop (Johannesburg), with its own booking system: clients book open times online, the front desk runs every booking from `/admin`, and a Supabase database (free) keeps it all. No build step. Vercel serves the files as they are.

To switch the booking system on, follow **SETUP-BOOKINGS.md**. Until then the site books through WhatsApp.

## Pages

| File | Live address | What's on it |
|---|---|---|
| index.html | / | Loading screen (his lion), hero with a looping razor video behind it (stock, tagged Sample), what Kings means, 4 featured services, before/after (a real Kings client), reviews, booking |
| services.html | /services | Barber filter, services grid, full price list + calculator, Pay per visit / Standing Chair |
| barbers.html | /barbers | Team cards, shop gallery, what to expect, booking |
| products.html | /products | The STMNT products Kings uses and sells: styling, beard and shave, wash. No prices, bought in store, with an "Ask if it's in stock" WhatsApp link on each |
| visit.html | /visit | Booking: services, barber, open times, details, confirmation. Then the shopfront photo, address + hours, FAQ |
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
- **The logo in the nav, phone menu and footer** follows the sign in the shop: his lion, then KINGS, then BARBERSHOP between two thin gold lines. The lines are drawn by CSS (`.brand-sub::before` and `::after` at the bottom of `styles.css`), so there's no extra image to load.
- **The loading screen shine** is CSS (`#preloader .lion::after`). `site.js` adds the `shine` class once the lion has faded in.
- **The full logo pack** (vector files, one-colour versions, social sizes) is separate from the site, in Kings-Logo-Pack-Gold.

## Photos and video

Most of the photos are Kings' own, shot in the shop. A few spots still use free stock from Pexels (free for commercial use, no credit needed) until the right real shots exist: the **hero video** and the **Cut & Beard** and **Hot Towel Shave** cards. Each of those carries a small "Sample" tag so nobody takes them for Kings' own work. On the Barbers page, Jermaine and Barber two have their own portrait and action shot. Barber three has his portrait; his card has no action shot yet, so it simply stays on the portrait.

| Where | Files | Shows |
|---|---|---|
| Home: hero (video) | img/hero-720.mp4, img/hero-720.webm (computers), img/hero-480.mp4, img/hero-480.webm (phones), img/hero-poster.webp | Stock, tagged Sample video. A straight razor, looping behind the headline |
| Home: what Kings means | img/story-kings-480.webp, img/story-kings-800.webp | Barber two cutting in front of the gold lion wall |
| Home and Services: Signature Cut card | img/svc-signature-cut-480.webp (+ 960) | Jermaine styling a client by the front window, the Land Rover outside with its number plate blurred |
| Home and Services: Skin Fade card | img/svc-skin-fade-480.webp (+ 960) | A trimmer lining up a skin fade behind the ear |
| Home and Services: Cut & Beard, Hot Towel Shave cards | img/svc-cut-beard-480.webp, img/svc-hot-towel-480.webp (+ 960) | Stock, tagged Sample |
| Barbers: gallery | img/gal-team-540.webp (big tile), img/gal-reception-420.webp, img/gal-wash-420.webp, img/gal-coffee-420.webp, img/gal-window-420.webp (each also in a bigger size) | Three barbers at work, the lion logo at reception, Jermaine washing a client's hair at the basin, the coffee bar, a cut by the front window |
| Barbers: barber cards | img/barber-jermaine-420.webp + img/barber-jermaine-action-420.webp, img/barber-two-420.webp + img/barber-two-action-420.webp, img/barber-three-420.webp (each also in a 720 size) | A portrait on the slat wall that shows first, and an action shot that fades in on hover or tap (Barber three: portrait only for now) |
| Home: before and after | img/ba-before-800.webp, img/ba-after-800.webp (each also in a 1200 size) | A real cut at Kings, shot from behind: the hair grown out over his star tattoo, then the finished fade. The before photo is turned and shifted so his ear, a mole and the star tattoo sit in the same place in both, so the slider's line sweeps across one head. Both are 3:2 |
| Visit: Find us | img/visit-front-640.webp, img/visit-front-1100.webp | The shopfront from the car park: the gable with the lion sign and the wall sign, so people recognise the building. The neighbouring shop is cropped out and the number plate blurred |

Every photo was cropped to its spot, given a light warm tone so it sits well on the black site, and saved as WebP in two sizes. The browser picks the size that fits the screen. On phones the sign and the last gallery photo run full width so the whole KINGS name shows.

**The hero video** is the stock straight-razor clip: 7 seconds, silent, loops without a jump, mirrored so the razor sits in the empty right side. Computers get the 720 version, phones the 480. It only loads once the page has, so it never slows the first screen, and people with "reduce motion" or data saver on just see the still picture. The WebM files are only for the few browsers that can't play MP4. A dark fade over it (`.hero::after` in styles.css) keeps the headline readable.

A walk-through of the real shop is also cut and ready (wide and tall versions), held back for now. Luminar Media has it and can swap it in when Jermaine wants.

**Products page:** the sixteen product photos (two sizes each, for example img/prod-fiber-pomade-280.webp and img/prod-fiber-pomade-520.webp) are Kings' own: every product shot on its own against the lit slat wall in the shop. The header behind the title is the pomade shelf on computers (img/prod-head-900.webp, img/prod-head-1440.webp) and the whole shelf wall on phones (img/prod-head-tall-600.webp, img/prod-head-tall-800.webp). To add or drop a product, copy or delete one `<div class="prod">` block in products.html. Descriptions are in plain words, from what STMNT says each product does.

**Still to shoot** (then they replace the stock):
- A beard being shaped with clippers or a razor, for Cut & Beard
- A hot towel on a client, for Hot Towel Shave
- Barber three cutting someone's hair, for the action side of his card. Save it in both sizes, named like the other barbers' action shots, and add an action layer after his portrait the way the other two cards have one
- Later: Barber two's and Barber three's real names and what they're known for. The placeholder names also sit in photo descriptions (`alt`) and the booking pages, so search the site for "Barber two" and "Barber three"

**Swapping in a photo:** crop it to roughly the same shape, save it under the same file name (both sizes), update its `alt` text in the HTML, and delete the `<span class="sample">Sample photo</span>` next to it. Once no stock is left, `SAMPLE_PHOTOS` in site.js can go to `false`. For a new before/after, take both photos from the same spot and height, with the head turned the same way, then save them as `ba-before` and `ba-after` in both sizes (800 and 1200 wide, 3:2). Blur any number plates in shop photos before they go on the site. 

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

- **Nav, phone menu and footer** are the same block on all 5 pages (and the booking page), including the logo (`lion-96.webp` + KINGS / BARBERSHOP). Change one, change them all.
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
