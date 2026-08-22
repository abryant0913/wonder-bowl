# WonderBowl — MVP "Painted Door" Landing Page

A single-page landing site for **wonder-bowl.com** that converts traffic from four
distinct Meta ad tests into at-cost **3-Day Taste Test** orders. It captures
fulfillment data, silently tracks which ad drove each conversion, dynamically
reshapes its hero to match the narrative a visitor clicked, and hands off to
**Stripe hosted checkout** for the chosen portion tier.

> Product spec: **[PRD.md](./PRD.md)**. Copy & content matrix: the shared
> **WonderBowl MVP Website Copydec** (Google Doc).

---

## What's in here

```
wonder-bowl/
├── index.html      # The whole landing page + order-capture modal
├── styles.css      # Vibrant color-field design system (Blazeface + Agrandir)
├── script.js       # UTM capture, dynamic hero, parallax, modal, Stripe redirect
├── PRD.md          # The Product Requirements Document
├── README.md       # This file
└── assets/         # Brand assets (high-res originals) + web/ (optimized copies)
```

No build step, no framework, no dependencies — plain HTML/CSS/JS. Open it in a
browser or drop it on any static host (Netlify, Vercel, GitHub Pages, S3, a
website builder's custom-HTML block, etc.).

## Quick start

```bash
cd wonder-bowl
python3 -m http.server 8000      # then visit http://localhost:8000
```

Try the dynamic hero by appending an ad variant, e.g.
`http://localhost:8000/?ad=leo` or `?ad=ethical`.

---

## Design system

Rebuilt to match the 4 test-story ad MVPs (`assets/WonderBowl_MVP_v05.pdf`).

- **Color fields.** Every section is a full-bleed brand color, pulled from
  `assets/WonderBowl_MVP_v05_Colors.svg`:
  purple `#6a05a5` (primary), blue `#75cfff`, yellow `#ffcd50`, pink `#ff77e1`,
  green `#00d6a7`. Contrast rule: **white type on purple/pink, purple type on the
  lighter blue/yellow/green fields.**
- **Type.** Display = **Ohno Blazeface** via Adobe Fonts (Typekit kit `nnr5kpw`,
  linked in `<head>`). Body = **Agrandir**, self-hosted from `assets/fonts/*.otf`
  via `@font-face` in `styles.css` (Regular / TextBold / GrandHeavy).
- **Logo & icon.** The white `wonder-bowl_logo.svg` sits on color fields (header);
  a purple variant (`assets/web/logo-purple.svg`) is used on the yellow footer.
  The small `wonder-bowl_icon.svg` is the favicon, the modal success mark, and the
  footer mark.
- **Dog illustrations.** The line-art dogs are recolored per field so their white
  fills match the background and only the purple linework reads
  (`assets/web/dog-*-{blue,green,pink}.svg`).
- **Photography.** Transparent-background PNGs on the color fields — hero bowl +
  flying ingredients (parallax), Leo, the 2-set bowl. Originals live in `assets/`;
  web-optimized copies in `assets/web/`.

### Hero parallax

The hero bowl is layered: `bowl-straight.png` (base) + `flying-ingredients.png`
(overlay behind the bowl). On scroll the ingredients **lift out of the bowl**
(`initParallax()` in `script.js`, rAF-throttled). Disabled under
`prefers-reduced-motion`.

---

## Page structure

Color-field order, top to bottom:

| Section | Field | Content |
|---|---|---|
| Hero | purple | Universal SF headline, badges, bowl parallax, `data-*` slots for the variant swap |
| Marquee | yellow | Scrolling 16-super-plant ticker |
| Story (`#story`) | blue | Leo's story + line-art dog |
| Recipe (`#recipe`) | green | Classic Wonderbowl 16-super-plant breakdown, trust badges, fun callouts |
| Taste Test (`#taste-test`) | yellow | 3-Day set: 1 glass bowl (half-full) + 5 eco-paper refills (6 meals) + 50/50 method |
| Pricing (`#pricing`) | purple | 3 at-cost/retail portion tiers ("Most popular" = 2-Cup) |
| FAQ (`#faq`) | blue | 7-question accordion |
| Final CTA | pink | "Get your sample set" + bowl visual |
| Footer | yellow | Tagline, copyright, collapsible legal/disclaimers |

---

## The 4 ad narratives → dynamic hero

The default hero is a universal SF headline. When a visitor arrives from an ad,
the hero rewrites itself to continue that ad. Match on `?ad=<key>`,
`utm_content=<key>`, or `utm_campaign=<key>` (`VARIANTS` / `ALIASES` in `script.js`):

| Key | Narrative |
|---|---|
| `ingredient` | Ingredient focus — everything dogs need, nothing they don't |
| `ethical` | Ethical nutrition — dogs evolved to thrive on plants |
| `local` | Local freshness — simmered in SF this week |
| `leo` | Leo's story — post cancer-scare, still begging for seconds |

**Recommended full ad URL:**
```
https://wonder-bowl.com/?utm_source=meta&utm_medium=paid&utm_campaign=mvp_test&utm_content=leo&ad=leo
```
Every param is captured and submitted with the order, so each sign-up maps to its
winning variant.

---

## Order capture form

The modal ("Tailored freshness for your woofer") collects: dog's name, dog's age,
**portion tier** (`dog_size` = `1cup` / `2cup` / `3cup`, by weight range), human
guardian name, email, SF address, plus the hidden `utm_*` / `ad_variant` /
`landing_url` fields. Opens on any CTA, on pricing-card buttons (which preselect
the tier via `data-preselect`), and once ~15s into the first session visit. Closes
on ✕, overlay, or `Esc`.

### Stripe checkout — **paste your 3 Payment Links**

On submit, after capturing the lead, the form redirects to the Stripe Payment Link
for the selected portion tier. Add your links at the top of `script.js`:

```js
var STRIPE_LINKS = {
  "1cup": "",  // Small Pup (0–40 lbs) — 1-Cup · 3-day set $15
  "2cup": "",  // Medium Dog (41–70 lbs) — 2-Cup · 3-day set $24
  "3cup": ""   // Large Woofer (71+ lbs) — 3-Cup · 3-day set $33
};
```
The submitter's email is prefilled (`prefilled_email`) and the ad variant is passed
as `client_reference_id`, so each Stripe payment maps back to its ad. Until the
links are filled in, submitting just shows the confirmation view (no redirect).

### Optional lead backend

Set `FORM_ENDPOINT` in `script.js` to also POST the JSON lead to Formspree / a
Google Sheet webhook / Zapier / your API before the Stripe redirect. Payload:
`dog_name`, `dog_age`, `dog_size`, `name`, `email`, `address`, all `utm_*`,
`ad_variant`, `landing_url`, `submitted_at`.

### Meta Pixel

Base code is stubbed in `<head>`. Before launch: replace `YOUR_PIXEL_ID`, uncomment
`fbq('init', …)` + `fbq('track', 'PageView')` (and the `<noscript>`). `script.js`
also fires `Lead` (modal open), `CompleteRegistration` (submit), and
`InitiateCheckout` (Stripe handoff).

---

## Before launch

- [ ] Paste the 3 **Stripe Payment Links** into `STRIPE_LINKS` (`script.js`).
- [ ] **Authorize the domain on the Adobe Fonts (Typekit) kit** — add
  `wonder-bowl.com` + staging host, or Blazeface falls back to serif.
- [ ] Set the **Meta Pixel ID** and QA with the Pixel Helper.
- [ ] (Optional) Set `FORM_ENDPOINT` to persist leads.
- [ ] Swap the placeholder Leo/bowl imagery if you have final art; re-run the
  `sips` optimization into `assets/web/`.
- [ ] Point wonder-bowl.com at the host.

---

*Bowls of bow-wow-nty — made with love in SF.*
# wonder-bowl
