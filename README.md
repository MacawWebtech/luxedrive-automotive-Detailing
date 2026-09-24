# LuxeDrive Auto Studio — Premium Car Detailing Template

## Installation
Open `index.html` directly in a browser, or serve the folder with any static
server (e.g. `npx serve .`) for local development. No build step required.

## Structure
```
index.html          Cinematic homepage
home-2.html          Alternate immersive campaign homepage
about.html            Story, timeline, team, certifications
services.html         Full service directory (exterior / interior / protection)
service-details.html  Ceramic Coating detail page (template for other services)
pricing.html           Essential / Signature / Ultimate packages
gallery.html            Filterable work gallery + lightbox-ready grid
booking.html             Appointment form with live summary
blog.html                 Article journal with search + category filter
blog-details.html          Full article template
contact.html                Enquiry form + studio info
faq.html                     Categorized accordion FAQ
404.html                      Error page
coming-soon.html               Countdown + newsletter landing page
assets/css/style.css            Design system (variables, components, base light palette)
assets/css/dark-mode.css        Dark theme overrides (brand default)
assets/css/rtl.css              Right-to-left overrides
assets/css/preloader.css        Preloader styles
assets/js/preloader.js          Preloader progress + hand-off to motion.js
assets/js/main.js                Theme, nav, reveal, counters, slider, filters, validation
```

## Customization
- **Brand & colors**: edit CSS variables at the top of `assets/css/style.css` (`:root` block).
- **Fonts**: Rajdhani (display) + Inter (body), loaded via Google Fonts `<link>` in each page `<head>`.
- **Images**: all imagery currently uses `picsum.photos` placeholders with descriptive alt
  text and `TODO` comments — replace `src` attributes with your licensed automotive photography.
- **Content**: copy, pricing and service details are placeholder text matching the brief;
  update directly in each HTML file.

## Theme (dark / light)
Toggled via the header icon button, stored in `localStorage` under `luxedrive-theme`,
default is dark. `style.css` holds the base (light) palette; every dark-only rule lives in
`assets/css/dark-mode.css`, scoped to `html[data-theme="dark"]`. The saved theme is restored
by an inline script in `<head>`, so there is no flash of the wrong theme on load.

## RTL
Toggled via the header icon button, stored in `localStorage` under `luxedrive-dir`.
Sets `dir="rtl"` on `<html>`. All RTL rules live in `assets/css/rtl.css` (icons, off-canvas,
offsets, borders, motion sweeps, preloader). Pages with `lang="ar"`, `fa` or `ur` also get
tracking/uppercase disabled and an Arabic font stack — add the font's Google Fonts link.

## CSS load order
`style.css` → `motion.css` → `preloader.css` → `dark-mode.css` → `rtl.css`.
Keep the two override files last.

## Preloader
Markup sits right after `<body>` on every page; styles in `preloader.css`, logic in
`preloader.js`. It tracks fonts and eager images, stays at least 0.9s and at most 4s, then
lifts away while the hero intro plays. Edit `MIN_TIME`, `MAX_TIME` and `ONCE_PER_SESSION`
at the top of `preloader.js`. It only appears when JavaScript runs, respects
`prefers-reduced-motion` (simple fade), and clears itself after 6s if the script fails.
To remove it: delete the markup, the `preloader.css` link and the `preloader.js` script.

## Forms
`contact.html` and `booking.html` are prepared for **Formspree** — replace the
`action="https://formspree.io/f/TODO"` with your form endpoint, or swap for
**Netlify Forms** by adding `data-netlify="true"` to the `<form>` tag.

## Booking integrations
`booking.html` includes a `TODO` comment marking where to wire in Calendly,
Google Calendar, or a custom booking API in place of the current client-side
summary logic.

## Maps
`contact.html` includes a placeholder `.map-placeholder` block — replace with
a Google Maps embed using your API key.

## Not yet included
The optional admin dashboard (`dashboard/*.html`) described in the original
brief is not part of this build — ask and it can be added as a follow-up.

## Credits
- Bootstrap Icons (bootstrap-icons@1.11.3, via jsDelivr)
- Google Fonts: Rajdhani, Inter
- Placeholder imagery: picsum.photos (replace before production use)

## Changelog
- v1.0 — Initial 14-page public site + shared design system
- v1.2 — Images resized (max 2000px, team portraits 1400px) and recompressed: ~86 MB → ~9 MB; `automotive exterior detail.png` is now `.jpg`
- v1.1 — Preloader; dark mode and RTL split into `dark-mode.css` and `rtl.css`; no-flash theme restore; theme icon now matches the saved theme on load

## Motion layer

Scroll animation lives in two files, so the base site stays untouched:

- `assets/css/motion.css` — start states, header transition, progress bar, back-to-top, cursor, button polish.
- `assets/js/motion.js` — GSAP + ScrollTrigger (scroll-linked animation) and Lenis (smooth wheel scrolling), loaded from CDN with `defer`.

Behaviour by device:

- **Desktop (901px+):** full experience, including parallax, the pinned ceramic section on Home (1025px+), the Home 2 image story, card tilt, magnetic buttons and the cursor ring.
- **Phones and tablets:** reveals and staggers only. Scroll stays native, with no parallax or pinning.
- **Low-power devices** (Save-Data, 2 or fewer CPU cores, 2 GB RAM or less): treated like mobile.
- **`prefers-reduced-motion`:** all motion is off. Only the progress bar and back-to-top remain.

If the CDN scripts fail to load, the site falls back to its original behaviour. A small inline script in each page's `<head>` briefly hides animated elements to prevent a flash before motion.js runs, and it always clears itself after 2.5s.

To remove the layer entirely, delete the `motion.css` link, the inline guard script and the four deferred `<script>` tags from each page.
