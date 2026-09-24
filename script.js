/* ============================================================================
   Wonder Bowl — MVP landing page behaviour
   - Silent ad tracking (UTM capture -> hidden form fields)
   - Dynamic hero swap based on the ad variant clicked
   - Email/sign-up modal (opens on CTA + once, timed, on first visit)
   - Frictionless capture form -> placeholder POST endpoint
   ============================================================================ */

(function () {
  "use strict";

  // Fan one analytics event out to GA4 / Clarity / Meta Pixel (see analytics.js).
  // No-op until the visitor grants consent.
  function track(name, params) {
    if (window.wbTrack) { try { window.wbTrack(name, params || {}); } catch (e) {} }
  }
  // 3-day sample-set totals per portion tier (checkout / purchase value).
  var SET_VALUE = { "1cup": 15, "2cup": 24, "3cup": 33 };

  /* ---------------------------------------------------------------------------
     0. CONFIG — swap these when wiring up the real backend / campaign
  --------------------------------------------------------------------------- */

  // Google Apps Script web-app URL that appends each submission to the orders
  // Sheet. Source + deploy steps: backend/apps-script-form-sink.gs
  // Paste the /exec URL here. While it is empty NOTHING IS RECORDED — every
  // submission is dropped after the success screen shows.
  var FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbxpH-4TzN1CLIOmrOBDW6wW_b7roLFIAu771j7x9yys_EnzNe5akd6cyDbV_FUQPgdS/exec";

  // Submissions that failed to send are held here and retried on the next page
  // load, so a network blip or a closed laptop can't silently lose an order.
  var PENDING_KEY = "wb_pending_submissions";
  var PENDING_MAX = 25;

  // How long (ms) before the modal auto-opens on first visit.
  var TIMED_OPEN_MS = 15000;

  // sessionStorage key so the timed pop-up only fires once per session.
  var TIMED_SHOWN_KEY = "wb_modal_autoshown";

  // ---------------------------------------------------------------------------
  // STRIPE PAYMENT LINKS — one hosted checkout per portion tier.
  // Paste the 3 Payment Link URLs from your Stripe dashboard here. Until they're
  // filled in, submitting just shows the confirmation view (no redirect).
  // The submitter's email is prefilled and the ad variant is passed through as
  // client_reference_id so each Stripe payment maps back to its winning ad.
  // ---------------------------------------------------------------------------
  var STRIPE_LINKS = {
    "1cup": "https://buy.stripe.com/cNi4gyh0w70h89D3We4Ni00", // Small Pup (0–40 lbs) — 1-Cup · 3-day set $15
    "2cup": "https://buy.stripe.com/cNi6oGh0w2K1blP8cu4Ni01", // Medium Dog (41–70 lbs) — 2-Cup · 3-day set $24
    "3cup": "https://buy.stripe.com/aFa6oG6lS70hey13We4Ni02"  // Large Woofer (71+ lbs) — 3-Cup · 3-day set $33
  };

  function stripeUrlFor(payload) {
    var base = STRIPE_LINKS[payload.dog_size];
    if (!base) return "";
    try {
      var url = new URL(base);
      if (payload.email) url.searchParams.set("prefilled_email", payload.email);
      // Stripe allows [A-Za-z0-9_-] up to 200 chars in client_reference_id.
      // The design leads so a payment is attributable to an arm even when the
      // narrative tag is missing.
      var ref = payload.ad_variant || payload.utm_content || payload.utm_campaign || "";
      var cref = (design + (ref ? "_" + ref : "")).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 200);
      if (cref) url.searchParams.set("client_reference_id", cref);
      return url.toString();
    } catch (e) {
      return base; // fall back to the raw link if URL parsing isn't available
    }
  }

  // ---------------------------------------------------------------------------
  // LARGE / RECURRING ORDERS — one Stripe Payment Link per delivery rhythm.
  //
  // A Payment Link's billing interval is baked into its prices, so there is no
  // way to offer a choice of frequency inside a single link: picking a rhythm IS
  // picking which link to open.
  //
  // There is a SECOND link axis for the same reason in reverse. A Payment Link puts
  // every one of its line items in the cart at quantity 1 — adjustable_quantity
  // .minimum of 0 lets a customer remove an item, but nothing can make one start
  // absent. A single link carrying all three sizes therefore opens at "one of each"
  // ($180 one-time, $336 weekly), and a one-dog household — nearly all of them —
  // has to delete two items before paying. So each link sells ONE size, and the
  // size is chosen in our own form where it costs nothing.
  //
  // Bowls sell in PACKS, which is also what enforces the 6-bowl minimum: Stripe has
  // no cart-level minimum (adjustable_quantity.minimum is per line item), but one
  // pack is the smallest thing anyone can buy. Pack size is the delivery period,
  // because a dog eats TWO bowls a day — 14 bowls is exactly one week. Six is the
  // sample set's own unit ("6 portions across 3 days").
  //
  // A bi-weekly rhythm was designed and then cut: a 28-bowl pack is up to 14 days
  // of food in someone's kitchen, which would have to be frozen — and the FAQ sells
  // explicitly against "commercial brands that freeze meals for months". The
  // cheapest option should not be the one that contradicts the core claim.
  //
  // Six links: 2 rhythms x 3 sizes. While one is empty its card explains itself
  // instead of dead-ending, and the lead is still captured first either way.
  // ---------------------------------------------------------------------------
  var LARGE_ORDER_LINKS = {
    once: {                 // 6-bowl packs, one-time
      "1cup": "https://buy.stripe.com/aFafZg6lS5Wd2PjcsK4Ni05",   // $37.50
      "2cup": "https://buy.stripe.com/7sY4gydOk0BT2Pj0K24Ni04",   // $60.00
      "3cup": "https://buy.stripe.com/5kQ00i5hOckB61v3We4Ni03"    // $82.50
    },
    weekly: {               // 14-bowl packs, every week (save 20%)
      "1cup": "https://buy.stripe.com/9B65kC8u084lahLdwO4Ni08",   // $70.00 / wk
      "2cup": "https://buy.stripe.com/8x23cueSo4S90HbgJ04Ni07",   // $112.00 / wk
      "3cup": "https://buy.stripe.com/14A6oG5hOactfC58cu4Ni06"    // $154.00 / wk
    }
  };

  // What one pack costs. Keep in sync with the Stripe prices above — this is the
  // analytics value for the hand-off, and the figure the form shows live once a
  // size is picked, so nobody meets a number for the first time on Stripe.
  var LARGE_ORDER_PRICE = {
    once:   { "1cup": 37.50, "2cup": 60.00,  "3cup": 82.50 },
    weekly: { "1cup": 70.00, "2cup": 112.00, "3cup": 154.00 }
  };

  var LARGE_ORDER_BOWLS = { once: 6, weekly: 14 };

  function largeOrderUrlFor(freq, size, email) {
    var byFreq = LARGE_ORDER_LINKS[freq] || {};
    var base = byFreq[size];
    if (!base) return "";
    try {
      var url = new URL(base);
      // prefilled_email is the ONLY customer field a Payment Link accepts — name,
      // phone and address have no URL parameter. That is why the form below is
      // the system of record for fulfilment, exactly as the sample flow already
      // works: Stripe is asked for bowls and a card, nothing it would duplicate.
      if (email) url.searchParams.set("prefilled_email", email);
      // Mirrors stripeUrlFor(): the design arm leads so a payment is still
      // attributable when the narrative tag is missing. "lg" marks it a large
      // order and the rhythm rides along, so Stripe payments map back to the
      // exact card that was clicked.
      var ref = variantKey || param("ad") || param("utm_content") || param("utm_campaign") || "";
      var cref = (design + "_lg_" + freq + "_" + size + (ref ? "_" + ref : "")).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 200);
      url.searchParams.set("client_reference_id", cref);
      return url.toString();
    } catch (e) {
      return base;
    }
  }

  /* ---------------------------------------------------------------------------
     1. AD VARIANT MAP — the four Meta ad narratives.
        The hero headline + subcopy + eyebrow swap to match the ad a visitor
        clicked, so any of the four entry points feels like a continuation.
        Match on ?ad=<key>  OR  utm_content=<key>  OR  utm_campaign=<key>.
  --------------------------------------------------------------------------- */
  var VARIANTS = {
    ingredient: {
      eyebrow: "Whole plants · Nothing hidden",
      headline: "Everything dogs need.<br>Nothing they don't.",
      sub: "Six whole-food ingredients, human-grade and vet-reviewed. No fillers, no mystery meat meal. Just a vibrant bowl dogs are built to thrive on."
    },
    ethical: {
      eyebrow: "Ethical nutrition · Vegetarian",
      headline: "Unlike wolves, dogs evolved to <em>thrive</em> on plants.",
      sub: "A kinder, more sustainable bowl backed by science. Vegetarian nutrition that's gentle on your dog and the planet."
    },
    local: {
      eyebrow: "Fresh · San Francisco",
      headline: "Simmered in San Francisco this week.",
      sub: "Small-batch fresh, delivered across the city days after it's made. This isn't shelf-stable. It's food you'd recognize in your own kitchen."
    },
    leo: {
      eyebrow: "Leo's story",
      headline: "Three years post cancer-scare,<br>still begging for seconds.",
      sub: "Wonder Bowl started with one dog and one scare. Today Leo's bowl is the best part of his day, and we'd love it to be yours too."
    }
  };
  // Handy aliases so campaign naming can be loose.
  var ALIASES = {
    ingredients: "ingredient", ingredient_focus: "ingredient", nothing: "ingredient",
    ethics: "ethical", ethical_nutrition: "ethical", plants: "ethical", wolves: "ethical",
    freshness: "local", local_freshness: "local", sf: "local", fresh: "local",
    founder: "leo", story: "leo", leos_story: "leo"
  };

  /* ---------------------------------------------------------------------------
     2. UTM / AD-SOURCE CAPTURE
  --------------------------------------------------------------------------- */
  var params = new URLSearchParams(window.location.search);

  function param(name) { return (params.get(name) || "").trim(); }

  function lookupVariant(key) {
    if (VARIANTS[key]) return key;
    if (ALIASES[key]) return ALIASES[key];
    return null;
  }

  function resolveVariantKey() {
    var raw = (param("ad") || param("utm_content") || param("utm_campaign") || "").toLowerCase();
    if (!raw) return null;

    // Exact match first — ?ad=leo, utm_content=ethical_nutrition, etc.
    var exact = lookupVariant(raw);
    if (exact) return exact;

    // Otherwise match on word parts, so real campaign names carry a prefix
    // without silently falling back to the default hero. Splitting on
    // non-alphanumerics (rather than substring matching) keeps short aliases
    // like "sf" from matching by accident inside an unrelated word.
    //   test1_ingredients -> ["test1","ingredients"] -> ingredient
    //   test4_leo         -> ["test4","leo"]         -> leo
    var parts = raw.split(/[^a-z0-9]+/);
    for (var i = 0; i < parts.length; i++) {
      var hit = parts[i] && lookupVariant(parts[i]);
      if (hit) return hit;
    }
    return null;
  }

  var variantKey = resolveVariantKey();

  /* ---------------------------------------------------------------------------
     2b. DESIGN ARM — which look the visitor landed on.
     Derived from the page rather than a URL parameter so it cannot be lost,
     mistyped or stripped by a redirect. This is the only thing that separates
     the two arms of a design test: ad_variant carries the ad NARRATIVE
     (ingredient/ethical/local/leo), which is deliberately identical across
     both looks, so it cannot answer "which design won".
     Persisted because checkout leaves the site: Stripe sends the buyer back to
     thank-you.html, which has no way to know where they started otherwise.
  --------------------------------------------------------------------------- */
  var DESIGN_KEY = "wb_design";
  var design = /lux/i.test(window.location.pathname) ? "lux" : "classic";
  try { localStorage.setItem(DESIGN_KEY, design); } catch (e) {}

  // Populate hidden form fields with the raw ad-source data.
  function populateHiddenFields() {
    var map = {
      utm_source: param("utm_source"),
      utm_medium: param("utm_medium"),
      utm_campaign: param("utm_campaign"),
      utm_content: param("utm_content"),
      utm_term: param("utm_term"),
      ad_variant: variantKey || param("ad") || "",
      design: design,
      landing_url: window.location.href
    };
    // querySelectorAll, not querySelector: there are two forms on the page now
    // (sample and large order) and each carries its own hidden copy of these.
    Object.keys(map).forEach(function (key) {
      document.querySelectorAll('input[name="' + key + '"]').forEach(function (input) {
        input.value = map[key];
      });
    });
  }

  /* ---------------------------------------------------------------------------
     3. DYNAMIC HERO SWAP
  --------------------------------------------------------------------------- */
  function applyVariant() {
    if (!variantKey) return; // keep the default (ingredient-style) hero
    var v = VARIANTS[variantKey];
    var eyebrow = document.querySelector("[data-eyebrow]");
    var headline = document.querySelector("[data-hero-headline]");
    var sub = document.querySelector("[data-hero-sub]");
    if (eyebrow) eyebrow.textContent = v.eyebrow;
    if (headline) headline.innerHTML = v.headline;
    if (sub) sub.innerHTML = v.sub;
  }

  /* ---------------------------------------------------------------------------
     4. MODAL
  --------------------------------------------------------------------------- */
  var modal = document.getElementById("signup-modal");
  var formView = modal.querySelector("[data-modal-form-view]");
  var successView = modal.querySelector("[data-modal-success-view]");
  var lastFocused = null;

  function openModal(preselectSize) {
    // Pricing cards can preselect a portion tier even if the modal is already open.
    if (preselectSize) {
      var sizeSel = document.getElementById("f-size");
      if (sizeSel) sizeSel.value = preselectSize;
    }
    if (!modal.hidden) return;
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    // Focus the first field for accessibility.
    var firstInput = modal.querySelector("input, select, button");
    if (firstInput) firstInput.focus();
    track("modal_open", { source: preselectSize ? "pricing_card" : "cta", tier: preselectSize || "" });
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  // Open triggers (pricing cards may carry a data-preselect portion tier)
  document.querySelectorAll("[data-open-modal]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      track("cta_click", {
        label: (btn.textContent || "").trim().slice(0, 60),
        tier: btn.getAttribute("data-preselect") || ""
      });
      openModal(btn.getAttribute("data-preselect"));
    });
  });
  // Close triggers
  modal.querySelectorAll("[data-close-modal]").forEach(function (btn) {
    btn.addEventListener("click", closeModal);
  });
  // Escape to close
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  // Timed auto-open, once per session, on first entry.
  function scheduleTimedOpen() {
    try {
      if (sessionStorage.getItem(TIMED_SHOWN_KEY)) return;
    } catch (e) { /* storage blocked — still show once this page load */ }
    window.setTimeout(function () {
      // Never stack on top of the large-order modal — the visitor is mid-decision
      // there, and two dialogs at once would trap focus in the wrong one.
      if (orderModalOpen()) return;
      try { sessionStorage.setItem(TIMED_SHOWN_KEY, "1"); } catch (e) {}
      openModal();
    }, TIMED_OPEN_MS);
  }

  /* ---------------------------------------------------------------------------
     4b. LARGE / RECURRING ORDER MODAL
     A rhythm picker, not a form. The visitor chooses one-time or weekly
     here — the one decision a Payment Link cannot hold — and Stripe
     collects sizes, quantities, name, email, phone, address and consent.
     Selecting a card is therefore the only frequency signal we ever get, so it
     is tracked before the hand-off.
  --------------------------------------------------------------------------- */
  var orderModal = document.getElementById("order-modal");
  var orderLastFocused = null;

  function orderModalOpen() {
    return !!orderModal && !orderModal.hidden;
  }

  function openOrderModal(source) {
    if (!orderModal || !orderModal.hidden) return;
    orderLastFocused = document.activeElement;
    orderModal.hidden = false;
    document.body.style.overflow = "hidden";
    showOrderStep(1);
    track("large_order_open", { source: source || "cta", design: design });
  }

  function closeOrderModal() {
    if (!orderModal) return;
    orderModal.hidden = true;
    document.body.style.overflow = "";
    var note = orderModal.querySelector("[data-order-note]");
    if (note) note.hidden = true;
    // Back to the rhythm picker, so reopening never resumes a half-filled form
    // against a rhythm the visitor can no longer see.
    showOrderStep(1);
    if (orderLastFocused && orderLastFocused.focus) orderLastFocused.focus();
  }

  var ORDER_LABELS = { once: "Just this once", weekly: "Every week" };
  var orderFreq = "";   // the rhythm chosen in step 1

  function showOrderStep(n) {
    if (!orderModal) return;
    orderModal.querySelectorAll("[data-order-step]").forEach(function (step) {
      step.hidden = step.getAttribute("data-order-step") !== String(n);
    });
    var focusTarget = n === 1
      ? orderModal.querySelector("[data-order-freq]")
      : orderModal.querySelector("#o-dog");
    if (focusTarget) focusTarget.focus();
  }

  function initLargeOrder() {
    if (!orderModal) return;
    var orderForm = document.getElementById("order-form");
    var orderError = orderModal.querySelector("[data-order-error]");

    document.querySelectorAll("[data-open-order]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openOrderModal(btn.getAttribute("data-order-source") || "cta");
      });
    });

    orderModal.querySelectorAll("[data-close-order]").forEach(function (btn) {
      btn.addEventListener("click", closeOrderModal);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && orderModalOpen()) closeOrderModal();
    });

    // --- Step 1: the rhythm ---------------------------------------------------
    orderModal.querySelectorAll("[data-order-freq]").forEach(function (card) {
      card.addEventListener("click", function () {
        orderFreq = card.getAttribute("data-order-freq");

        // Fired here, not at submit: this is the only frequency signal that
        // survives an abandoned form, and the rhythm is what the band is testing.
        track("large_order_select", {
          frequency: orderFreq,
          recurring: orderFreq !== "once",
          value: (LARGE_ORDER_PRICE[orderFreq] || {})["1cup"] || 0,
          currency: "USD",
          ad_variant: variantKey || "",
          design: design
        });

        var freqField = orderModal.querySelector("[data-order-freq-field]");
        if (freqField) freqField.value = orderFreq;
        var chosen = orderModal.querySelector("[data-order-chosen-label]");
        if (chosen) chosen.textContent = ORDER_LABELS[orderFreq] || orderFreq;

        if (orderModal.__wbUpdatePackPrice) orderModal.__wbUpdatePackPrice();
        showOrderStep(2);
      });
    });

    orderModal.querySelectorAll("[data-order-back]").forEach(function (btn) {
      btn.addEventListener("click", function () { showOrderStep(1); });
    });

    // Show what one pack costs the moment a size is picked. Without this the
    // first number a visitor sees for their own dog is on Stripe's page, which
    // is the worst possible place to be surprised by a price.
    var sizeSelect = document.getElementById("o-size");
    var priceOut = orderModal.querySelector("[data-order-price]");
    function updatePackPrice() {
      if (!priceOut) return;
      var size = sizeSelect ? sizeSelect.value : "";
      var price = (LARGE_ORDER_PRICE[orderFreq] || {})[size];
      if (!size || price === undefined) {
        priceOut.hidden = true;
        return;
      }
      priceOut.hidden = false;
      priceOut.innerHTML =
        "One " + LARGE_ORDER_BOWLS[orderFreq] + "-bowl pack: <strong>$" + price.toFixed(2) + "</strong>" +
        (orderFreq === "weekly" ? " a week" : "") +
        ". You'll choose how many at checkout.";
    }
    if (sizeSelect) sizeSelect.addEventListener("change", updatePackPrice);
    orderModal.__wbUpdatePackPrice = updatePackPrice;

    // --- Step 2: who and where ------------------------------------------------
    if (!orderForm) return;
    orderForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (orderError) orderError.hidden = true;

      if (!orderForm.checkValidity()) {
        orderForm.reportValidity();
        return;
      }

      var payload = {};
      new FormData(orderForm).forEach(function (v, k) { payload[k] = v; });
      payload.submitted_at = new Date().toISOString();
      payload.wb_id = newSubmissionId();
      payload.order_type = "large";
      payload.frequency = orderFreq;

      var submitBtn = orderForm.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Taking you to checkout…"; }

      console.log("[Wonder Bowl] Large-order payload:", payload);

      // Recording must never gate the hand-off — same rule as the sample form.
      // Stashed first so the payload is durable even if anything below throws;
      // postSubmission() clears it on a confirmed 2xx, and flushPending()
      // retries on the next visit otherwise.
      stashPending(payload);
      if (FORM_ENDPOINT) {
        postSubmission(payload).then(function () {
          dropPending(payload.wb_id);
        }).catch(function (err) {
          console.error("[Wonder Bowl] Large-order submission failed, queued for retry:", err);
        });
      } else {
        console.error(
          "[Wonder Bowl] FORM_ENDPOINT is empty — this large order was NOT recorded " +
          "server-side. Set FORM_ENDPOINT in script.js."
        );
      }

      var size = payload.dog_size || "";
      var packValue = (LARGE_ORDER_PRICE[orderFreq] || {})[size] || 0;

      track("large_order_submit", {
        frequency: orderFreq,
        recurring: orderFreq !== "once",
        tier: size,
        value: packValue,
        currency: "USD",
        design: design
      });

      var url = largeOrderUrlFor(orderFreq, size, payload.email);
      if (!url) {
        // The lead is already captured and queued, so say so plainly rather than
        // implying the order failed.
        var note = orderModal.querySelector("[data-order-note]");
        if (note) note.hidden = false;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Choose bowls & pay →"; }
        console.error(
          "[Wonder Bowl] LARGE_ORDER_LINKS." + orderFreq + "." + size + " is empty — " +
          "lead captured, but there is no Stripe Payment Link to send this visitor to."
        );
        return;
      }

      // Exact, not a "from" figure: the size is known by now, so this is the real
      // value of one pack. Quantity still is not — that is chosen on Stripe.
      track("checkout_redirect", {
        tier: "large_" + orderFreq + "_" + size,
        order_type: "large",
        value: packValue,
        currency: "USD",
        ad_variant: variantKey || "",
        design: design
      });
      window.setTimeout(function () { window.location.href = url; }, 900);
    });
  }

  /* ---------------------------------------------------------------------------
     5. FORM SUBMISSION
  --------------------------------------------------------------------------- */
  // --- submission transport ------------------------------------------------
  // POSTs as text/plain on purpose. application/json is not a CORS-"simple"
  // content type, so it triggers a preflight OPTIONS request — and Apps Script
  // web apps do not answer OPTIONS, which kills the POST before it is sent.
  // The body is still JSON; the Apps Script parses it with JSON.parse.
  //
  // keepalive lets the request outlive the page: showSuccess() navigates to
  // Stripe ~1.3s later, and a normal fetch would be cancelled mid-flight —
  // losing exactly the submissions that convert.
  function postSubmission(payload) {
    if (!FORM_ENDPOINT) return Promise.reject(new Error("FORM_ENDPOINT is empty"));
    return fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      keepalive: true
    }).then(function (res) {
      if (!res.ok) throw new Error("Request failed: " + res.status);
      return res;
    });
  }

  function newSubmissionId() {
    return "wb_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  function readPending() {
    try {
      var raw = localStorage.getItem(PENDING_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(list) === "[object Array]" ? list : [];
    } catch (e) { return []; }
  }

  function writePending(list) {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-PENDING_MAX))); } catch (e) {}
  }

  function stashPending(payload) {
    var list = readPending();
    list.push(payload);
    writePending(list);
  }

  function dropPending(id) {
    writePending(readPending().filter(function (p) { return p && p.wb_id !== id; }));
  }

  // Retry anything left over from a previous visit. Each payload carries a
  // stable wb_id and the Apps Script ignores ids it has already written, so a
  // request that succeeded but whose response was lost to the Stripe redirect
  // cannot produce a duplicate row.
  function flushPending() {
    if (!FORM_ENDPOINT) return;
    readPending().forEach(function (payload) {
      if (!payload || !payload.wb_id) return;
      postSubmission(payload).then(function () {
        dropPending(payload.wb_id);
        console.log("[Wonder Bowl] Recovered queued submission:", payload.wb_id);
      }).catch(function () { /* leave queued for next time */ });
    });
  }

  var form = document.getElementById("signup-form");
  var errorEl = form.querySelector("[data-form-error]");

  // Retained for validation/edge cases. The submit path deliberately no longer
  // surfaces transport errors to the visitor: a failed POST is queued and
  // retried silently rather than blocking their checkout.
  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function collectPayload() {
    var data = {};
    new FormData(form).forEach(function (value, key) { data[key] = value; });
    data.submitted_at = new Date().toISOString();
    return data;
  }

  function showSuccess(payload) {
    formView.hidden = true;
    successView.hidden = false;
    var nameEl = modal.querySelector("[data-success-name]");
    var emailEl = modal.querySelector("[data-success-email]");
    var dogEl = modal.querySelector("[data-success-dog]");
    if (nameEl) nameEl.textContent = (payload.name || "friend").split(" ")[0];
    if (emailEl) emailEl.textContent = payload.email || "you";
    if (dogEl) dogEl.textContent = payload.dog_name || "your pup";
    track("form_submit", { dog_size: payload.dog_size || "", ad_variant: payload.ad_variant || "", design: design });

    // Hand off to Stripe hosted checkout for the selected portion tier.
    var checkoutUrl = stripeUrlFor(payload);
    var note = modal.querySelector("[data-redirect-note]");
    if (checkoutUrl) {
      if (note) note.hidden = false;
      track("checkout_redirect", {
        tier: payload.dog_size || "",
        value: SET_VALUE[payload.dog_size] || 0,
        currency: "USD",
        ad_variant: payload.ad_variant || "",
        design: design
      });
      window.setTimeout(function () { window.location.href = checkoutUrl; }, 1300);
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errorEl.hidden = true;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var payload = collectPayload();
    payload.wb_id = newSubmissionId();
    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    // Always log so the ad-source capture can be verified during MVP testing.
    console.log("[Wonder Bowl] Sign-up payload:", payload);

    if (!FORM_ENDPOINT) {
      // Nothing is wired up to receive this. Keep a local copy rather than
      // dropping it outright, and make the gap loud in the console instead of
      // showing the visitor a success screen over a black hole.
      stashPending(payload);
      console.error(
        "[Wonder Bowl] FORM_ENDPOINT is empty — this submission was NOT recorded " +
        "anywhere server-side. Set FORM_ENDPOINT in script.js."
      );
      showSuccess(payload);
      return;
    }

    // Record and hand off to checkout in parallel. Recording must never gate the
    // Stripe redirect: a slow or failing sink would otherwise cost a sale, which
    // is strictly worse than a lead we can still retry.
    //
    // Stashed BEFORE the request so that if anything below throws, the payload
    // is already durable. postSubmission() clears it on a confirmed 2xx.
    stashPending(payload);
    postSubmission(payload).then(function () {
      dropPending(payload.wb_id);
    }).catch(function (err) {
      // Stays queued; retried on the visitor's next page load.
      console.error("[Wonder Bowl] Submission failed, queued for retry:", err);
    });

    showSuccess(payload);
  });

  /* ---------------------------------------------------------------------------
     6. HERO PARALLAX — flying ingredients lift out of the bowl on scroll
  --------------------------------------------------------------------------- */
  function initParallax() {
    var fig = document.querySelector("[data-parallax]");
    if (!fig) return;
    var ing = fig.querySelector(".parallax__ing");
    if (!ing) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // The artwork is taller than its figure and deliberately overhangs the top
    // (ingredients flying out of the bowl). On the two-column desktop hero that
    // overhang sits in empty space; once the layout stacks, the hero copy is
    // directly above it, so the rise has to be capped or it climbs into the
    // text. Paired with the top margin .hero__media gets at the same breakpoint.
    var stacked = window.matchMedia && window.matchMedia("(max-width: 60rem)").matches;
    var MAX_RISE = stacked ? 40 : 165;

    var ticking = false;
    function update() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var p = Math.min(Math.max(y / 620, 0), 1);        // eased over the first ~620px
      var ty = -(p * MAX_RISE);
      ing.style.transform = "translateX(-50%) translateY(" + ty + "px) scale(" + (1 + p * 0.06) + ")";
      ticking = false;
    }
    function onScroll() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
  }

  /* ---------------------------------------------------------------------------
     7. TERMS — expand the footer legal block when linked with #legal
        (the terms checkbox link opens this page at #legal in a new tab)
  --------------------------------------------------------------------------- */
  function openTermsIfHashed() {
    if (window.location.hash === "#legal") {
      var legal = document.getElementById("legal");
      if (legal) { legal.open = true; try { legal.scrollIntoView(); } catch (e) {} }
    }
  }
  window.addEventListener("hashchange", openTermsIfHashed);

  /* ---------------------------------------------------------------------------
     8. FUNNEL INSTRUMENTATION — scroll depth, section views, form start
        Every event flows through track() -> GA4 / Clarity / Meta Pixel.
  --------------------------------------------------------------------------- */
  // Scroll depth: fire once each at 25 / 50 / 75 / 90 %.
  function initScrollDepth() {
    var marks = [25, 50, 75, 90], fired = {}, ticking = false;
    function check() {
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - window.innerHeight;
      var pct = scrollable > 0 ? (window.pageYOffset / scrollable) * 100 : 100;
      marks.forEach(function (m) {
        if (!fired[m] && pct >= m) { fired[m] = true; track("scroll_depth", { percent: m }); }
      });
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(check); }
    }, { passive: true });
    check();
  }

  // Section views: fire once when each major section first enters the viewport.
  function initSectionViews() {
    if (!("IntersectionObserver" in window)) return;
    var sections = document.querySelectorAll("section[id], .hero, .final-cta");
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var id = el.id || (el.className.indexOf("hero") > -1 ? "hero" :
                 el.className.indexOf("final-cta") > -1 ? "final-cta" : "section");
        if (seen[id]) return;
        seen[id] = true;
        track("section_view", { section: id });
      });
    }, { threshold: 0.4 });
    sections.forEach(function (s) { io.observe(s); });
  }

  // Form start: fire once when the visitor first focuses a field in the modal.
  function initFormStart() {
    var form = document.getElementById("signup-form");
    if (!form) return;
    var started = false;
    form.addEventListener("focusin", function () {
      if (started) return;
      started = true;
      track("form_start", {});
    });
  }

  // Outbound links that leave the funnel — the social profile and the mailto
  // contacts. Tracked so we can tell whether they cost conversions, and which
  // address people actually reach for, rather than guessing.
  function initOutboundLinks() {
    var social = document.querySelectorAll("[data-social]");
    Array.prototype.forEach.call(social, function (a) {
      a.addEventListener("click", function () {
        track("social_click", {
          network: a.getAttribute("data-social") || "",
          placement: a.getAttribute("data-social-placement") || ""
        });
      });
    });

    var contacts = document.querySelectorAll("[data-contact]");
    Array.prototype.forEach.call(contacts, function (a) {
      a.addEventListener("click", function () {
        track("contact_click", { address: a.getAttribute("data-contact") || "" });
      });
    });
  }

  /* ---------------------------------------------------------------------------
     9. MISC
  --------------------------------------------------------------------------- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------------------------------------------------------------------
     INIT
  --------------------------------------------------------------------------- */
  populateHiddenFields();
  applyVariant();
  scheduleTimedOpen();
  initParallax();
  openTermsIfHashed();
  initScrollDepth();
  initSectionViews();
  initFormStart();
  initLargeOrder();
  initOutboundLinks();
  flushPending();   // resend anything a previous visit failed to record
})();
