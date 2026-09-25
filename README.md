# Kings Barbershop

Static one-page site for Kings Barbershop (Johannesburg). No build step. Vercel serves the files as they are.

## Files

| File | What it does |
|---|---|
| index.html | The whole site |
| og-image.jpg | The picture WhatsApp, Facebook and Instagram show when someone shares the link |
| favicon.svg, favicon.ico | Browser tab icon |
| apple-touch-icon.png | Icon when someone saves the site to their phone's home screen |
| robots.txt, sitemap.xml | Tell Google the site exists and can be indexed |

## Placeholders to swap before launch

All in index.html unless noted.

- `WA_NUMBER` (script near the bottom): Jermaine's WhatsApp Business number, digits only, starting 27
- `FRESHA_URL` (script near the bottom): Kings' Fresha booking page link
- `G-XXXXXXXXXX` (two places in the head): the Google Analytics measurement ID
- Footer social links (`href="#"`): Instagram, TikTok, Facebook
- Street address in the Find us section, plus `streetAddress` and `telephone` in the JSON-LD block in the head
- Prices in the services grid, the price list and `priceRange` in the JSON-LD block
- Standing Chair price (R650) and terms

## If the site gets its own domain

Find and replace `kings-barbershop-six.vercel.app` with the new domain in index.html, robots.txt and sitemap.xml.

## Opening hours

Hours live in two places: the Find us section and the `HOURS` line in the script (it drives the "Next opening" text). Change both together, and the `openingHoursSpecification` in the JSON-LD block.
