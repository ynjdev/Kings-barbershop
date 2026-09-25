# Kings Barbershop

Static 4-page site for Kings Barbershop (Johannesburg). No build step. Vercel serves the files as they are.

## Pages

| File | Live address | What's on it |
|---|---|---|
| index.html | / | Loading screen, hero, story, 4 featured services, before/after, reviews, booking |
| services.html | /services | Barber filter, services grid, full price list + calculator, Pay per visit / Standing Chair |
| barbers.html | /barbers | Team cards, shop gallery, what to expect, booking |
| visit.html | /visit | Booking builder, address + hours, FAQ |

`vercel.json` gives the pages clean addresses (`/services` instead of `/services.html`).

## Shared files

| File | What it does |
|---|---|
| styles.css | All the styling, used by every page |
| site.js | All the behaviour (booking links, menu, calculator, loading screen), used by every page |
| og-image.jpg | The picture WhatsApp, Facebook and Instagram show when someone shares a link |
| favicon.svg, favicon.ico, apple-touch-icon.png | Browser tab and phone home-screen icons |
| robots.txt, sitemap.xml | Tell Google the pages exist and can be indexed |

## Settings: one place

Open `site.js`. The SETTINGS block at the top controls every page:

- `WA_NUMBER`: Jermaine's WhatsApp Business number, digits only, starting 27
- `FRESHA_URL`: Kings' Fresha booking page link
- `FRESHA_SERVICE_URLS`: optional links from Fresha's link generator, one per service. When a client ticks exactly one service, "Choose a date and time" opens Fresha with that service already picked.
- `GA_ID`: the Google Analytics measurement ID. Analytics stays off until this is a real ID.
- `HOURS`: opening hours used for the "Next opening" text
- `PRELOADER_MS`: how long the crest shows on the home page (3000 = 3 seconds)

## How booking works

Every "Book" button leads to the booking builder on Visit & Book. Service cards and the Services price list send people there with their services already ticked (for example `visit?s=skin-fade#builder`).

In the builder the client ticks services, picks a barber and, for WhatsApp, a preferred day and morning or afternoon. Then they finish one of two ways:
- **Choose a date and time** opens Fresha. They pick an open slot and the booking is final. Nobody has to do anything.
- **Send on WhatsApp** opens WhatsApp with the request already written. The front desk checks Fresha for a free slot, adds the booking there, and replies with the time.

Barbers only look at their Fresha app, cut, take payment, and tap walk-ins into Fresha.

The other WhatsApp buttons ("Questions? WhatsApp us", footer, menu) open a plain "I have a question" message.

## Things that appear on more than one page

- **Nav, phone menu and footer** are the same block on all 4 pages. Change one, change all four.
- **Prices**: services.html (services grid and price list), visit.html (booking builder), and index.html (the 4 featured cards). Also `priceRange` in the JSON-LD block at the top of index.html, and in Fresha itself.
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

Find and replace `kings-barbershop-six.vercel.app` with the new domain in all 4 pages, robots.txt and sitemap.xml.
