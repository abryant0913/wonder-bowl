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

  // TODO: replace with your real endpoint (Formspree, Google Sheet webhook,
  // Zapier catch-hook, custom API, etc.). Until then the payload is logged to
  // the console so you can verify UTM capture end-to-end.
  var FORM_ENDPOINT = ""; // e.g. "https://formspree.io/f/xxxxxxx"

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
      var ref = payload.ad_variant || payload.utm_content || payload.utm_campaign || "";
      if (ref) url.searchParams.set("client_reference_id", ref);
      return url.toString();
    } catch (e) {
      return base; // fall back to the raw link if URL parsing isn't available
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

  function resolveVariantKey() {
    var raw = (param("ad") || param("utm_content") || param("utm_campaign") || "").toLowerCase();
    if (!raw) return null;
    if (VARIANTS[raw]) return raw;
    if (ALIASES[raw]) return ALIASES[raw];
    return null;
  }

  var variantKey = resolveVariantKey();

  // Populate hidden form fields with the raw ad-source data.
  function populateHiddenFields() {
    var map = {
      utm_source: param("utm_source"),
      utm_medium: param("utm_medium"),
      utm_campaign: param("utm_campaign"),
      utm_content: param("utm_content"),
      utm_term: param("utm_term"),
      ad_variant: variantKey || param("ad") || "",
      landing_url: window.location.href
    };
    Object.keys(map).forEach(function (key) {
      var input = document.querySelector('input[name="' + key + '"]');
      if (input) input.value = map[key];
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
      try { sessionStorage.setItem(TIMED_SHOWN_KEY, "1"); } catch (e) {}
      openModal();
    }, TIMED_OPEN_MS);
  }

  /* ---------------------------------------------------------------------------
     5. FORM SUBMISSION
  --------------------------------------------------------------------------- */
  var form = document.getElementById("signup-form");
  var errorEl = form.querySelector("[data-form-error]");

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
    track("form_submit", { dog_size: payload.dog_size || "", ad_variant: payload.ad_variant || "" });

    // Hand off to Stripe hosted checkout for the selected portion tier.
    var checkoutUrl = stripeUrlFor(payload);
    var note = modal.querySelector("[data-redirect-note]");
    if (checkoutUrl) {
      if (note) note.hidden = false;
      track("checkout_redirect", {
        tier: payload.dog_size || "",
        value: SET_VALUE[payload.dog_size] || 0,
        currency: "USD",
        ad_variant: payload.ad_variant || ""
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
    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    // Always log so the ad-source capture can be verified during MVP testing.
    console.log("[Wonder Bowl] Sign-up payload:", payload);

    if (!FORM_ENDPOINT) {
      // No backend wired yet — treat as success for the painted-door test.
      showSuccess(payload);
      return;
    }

    fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Request failed: " + res.status);
        showSuccess(payload);
      })
      .catch(function (err) {
        console.error("[Wonder Bowl] Submission error:", err);
        submitBtn.disabled = false;
        submitBtn.textContent = "Send me the Taste Test";
        showError("Something went wrong sending that. Please try again in a moment.");
      });
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

    var ticking = false;
    function update() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var p = Math.min(Math.max(y / 620, 0), 1);        // eased over the first ~620px
      var ty = -(p * 165);                               // rise up to 165px
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
})();
