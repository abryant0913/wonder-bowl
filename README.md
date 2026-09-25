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
├── backend/        # Google Apps Script sink that records form submissions
└── assets/         # Brand assets (high-res originals) + web/ (optimized copies)
```

### Where submissions go

The sign-up form collects a **name, email and physical address**. Those are POSTed
to a Google Apps Script web app that appends one row per submission to an orders
Sheet. Source and deploy instructions: [`backend/apps-script-form-sink.gs`](./backend/apps-script-form-sink.gs).

Set `FORM_ENDPOINT` in `script.js` to the deployed `/exec` URL.
**While `FORM_ENDPOINT` is empty, submissions are not recorded anywhere** — the
visitor still sees the success screen and still reaches Stripe, so the gap is
invisible from the outside. The console logs a loud error in that state.

Submissions are queued in `localStorage` and retried on the next page load if the
POST fails, and each carries a unique `wb_id` that the Apps Script uses to ignore
duplicates.

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
| Taste Test (`#taste-test`) | yellow | 3-Day set: 1 glass bowl (half-full) + 5 eco-paper refills (6 meals) |
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

## Large & recurring orders

Below the yellow Taste Test sits a purple band ("Go bigger, or go weekly") opening a
**two-step modal**:

1. **Rhythm** — one-time or weekly. This step exists because a Stripe Payment Link's
   billing interval is baked into its prices: there is no way to offer a choice of
   frequency *inside* one link, so picking a rhythm IS picking which link to open.
   It is also the only frequency signal that survives an abandoned form, so it is
   tracked on selection.
2. **Details** — dog's name and age, **portion size**, guardian name, email,
   **phone**, SF address and the T&C tick. POSTed to the same Apps Script sink as the
   sample form (same stash-then-send retry rule, so a slow sink never gates
   checkout), then handed to the matching Payment Link.

### Six links, not two

`LARGE_ORDER_LINKS` is a 2 × 3 map: **rhythm × portion size**, one Payment Link each.
That is not redundancy — a Payment Link puts *every* one of its line items in the
cart at quantity 1, and `adjustable_quantity.minimum: 0` only lets a customer
*remove* an item, never makes one start absent. A single link carrying all three
sizes therefore opens at "one of each" — **$180 one-time, $336 weekly** — and a
one-dog household has to delete two items before paying. One size per link means the
checkout page shows a single line item at the right size, and the only thing left to
choose is how many packs.

The trade is that a single checkout can't mix sizes. The sample flow can't either
(it asks for one portion size), so the two flows stay consistent.

Because the size is known at submit, `checkout_redirect` carries the exact pack price
rather than a "from" figure, and `client_reference_id` becomes
`<design>_lg_<freq>_<size>_<ad>`.

### Why the form, and not just Stripe

A Payment Link prefills **only** `prefilled_email` — `name`, `phone` and `address`
have no URL parameter. So this form is the fulfilment record and the Stripe links
should have address and phone collection turned **off**; otherwise the buyer types
everything twice. Identical to how the sample flow already works.

### Pricing — one pack per delivery

A dog eats **two bowls a day**, so pack size is the delivery period: 14 bowls is
exactly a week, 28 exactly a fortnight. One pack = one delivery's worth of food,
which means a subscriber cannot pick a quantity that runs out mid-cycle.

This is also what enforces the 6-bowl minimum. `adjustable_quantity.minimum` is
*per line item*, so a minimum of 6 across three sizes would force 6 of **each**
(18 bowls), not 6 in total — Stripe has no cart-level minimum. Making the pack the
sellable unit means the smallest possible order is one pack, while mixed sizes
still work.

| Rhythm | Pack | 1-Cup | 2-Cup | 3-Cup |
|---|---|---|---|---|
| One-time | 6 bowls (3 days) | $37.50 | $60.00 | $82.50 |
| Weekly — save 20% | 14 bowls (7 days) | $70.00 | $112.00 | $154.00 |

Per-bowl pricing stays flat across pack sizes ($6.25 and $5.00 for the 1-Cup): the
discount comes from the rhythm, not from bulk. In margin terms, one-time is 250%
of at-cost and weekly 200%.

**A bi-weekly rhythm was designed and then cut.** It priced well (30% off, half the
delivery trips) but a 28-bowl pack is up to 14 days of food in someone's kitchen,
which has to be frozen — and the FAQ sells explicitly against *"commercial brands
that freeze meals for months in distant warehouses."* The cheapest option should not
be the one that contradicts the core claim. Weekly's 14 bowls is 7 days, which the
existing storage guidance already covers.

Paste the six links into `LARGE_ORDER_LINKS` in `script.js`. Keep `LARGE_ORDER_PRICE`
in sync with them — it is both the analytics value and the figure the form shows live
once a size is picked, so nobody meets a price for the first time on Stripe.

### Consent is collected twice, on purpose

The modal's checkbox records consent **with the lead** in the Sheet, so an abandoned
checkout still has one. Stripe's `consent_collection[terms_of_service]` records it
**against the charge**, which is the stronger evidence in a dispute. Requires a
Terms of Service URL in Stripe → Settings → Public details; `/#legal` works, since
`openTermsIfHashed()` expands the footer's legal block on that hash.

### Events

Share `https://wonder-bowl.com/#order` to open the order modal directly (it scrolls to
the band's button first); those opens carry `source: "link"`.

`large_order_open` → `large_order_select` (carries `frequency`) → `large_order_submit`
→ `checkout_redirect` (both carry the exact pack price, since the size is known by
then). On return, `thank-you.html` reads `?order=large&freq=…&tier=…` and fires
`purchase` **without a value** — the QUANTITY is chosen inside Stripe and the redirect
carries no amount, so a fabricated number would corrupt the revenue the sample tiers
report honestly. Large-order revenue comes from the Stripe dashboard, keyed by
`client_reference_id` (`<design>_lg_<freq>_<size>_<ad>`).

Each link's redirect must therefore carry its own `freq` AND `tier`:

```
https://wonder-bowl.com/thank-you.html?order=large&freq=once&tier=2cup&session_id={CHECKOUT_SESSION_ID}
```

`{CHECKOUT_SESSION_ID}` stays literal — Stripe substitutes it, and GA4 needs it as
`transaction_id` or every buyer of a rhythm collapses into one purchase.

---

## Before launch

- [ ] Paste the 3 **Stripe Payment Links** into `STRIPE_LINKS` (`script.js`).
- [x] Paste the 6 **large-order Payment Links** into `LARGE_ORDER_LINKS` (`script.js`).
- [ ] Set the **Terms of Service URL** in Stripe → Settings → Public details, then
      enable *Require customers to accept terms* on all 3 large-order links.
- [ ] Turn **off** address + phone collection on the large-order links (the modal
      already captured them — leaving them on makes the buyer type everything twice).
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
