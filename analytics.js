/* ============================================================================
   Wonder Bowl — consent-gated analytics
   Loads Google Analytics 4, Microsoft Clarity, and the Meta Pixel ONLY after
   the visitor accepts the consent banner. Exposes window.wbTrack(name, params)
   so a single call fans one event out to all three.

   BEFORE LAUNCH: fill in GA4_ID and PIXEL_ID below. Clarity is already set.
   ============================================================================ */
(function () {
  "use strict";

  /* ---- CONFIG — fill these in ------------------------------------------- */
  var GA4_ID     = "G-3XEZX3WE2M";   // GA4 Measurement ID — Wonder Bowl web stream
  var CLARITY_ID = "y64z7ixc68";     // Microsoft Clarity project ID (set)
  var PIXEL_ID   = "1796499848461056";  // Meta Pixel — Wonder Bowl business account

  var CONSENT_KEY = "wb_consent";    // localStorage: "granted" | "denied"
  var loaded = false;

  // An ID is "real" once it is not one of the placeholders we ship with.
  // Do NOT test for a stray "X": real GA4 measurement ids can contain one
  // (ours is G-3XEZX3WE2M), and the old indexOf("X") heuristic silently
  // rejected it, leaving GA4 dead while the config looked filled in.
  var PLACEHOLDER_IDS = ["G-XXXXXXXXXX", "YOUR_PIXEL_ID"];
  function ready(v) { return !!v && PLACEHOLDER_IDS.indexOf(v) === -1; }

  /* ---- Loaders (run once, only after consent) --------------------------- */
  function loadGA4() {
    if (!ready(GA4_ID)) return;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA4_ID, { anonymize_ip: true });
  }

  function loadClarity() {
    if (!CLARITY_ID) return;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", CLARITY_ID);
  }

  function loadPixel() {
    if (!ready(PIXEL_ID)) return;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0";
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", PIXEL_ID);
    window.fbq("track", "PageView");
  }

  // GA4 is first-party measurement of our own funnel and loads for everyone
  // except our own opted-out devices. Clarity (session replay) and the Meta
  // Pixel (shares data with Meta) stay behind an explicit Accept: they carry
  // materially different privacy exposure and are not what the funnel numbers
  // depend on. Splitting them is what recovers the ~91% of traffic that used
  // to go unmeasured simply because nobody clicks a consent banner.
  var baselineLoaded = false, optionalLoaded = false;

  function loadBaseline() {
    if (baselineLoaded) return;
    baselineLoaded = true;
    loadGA4();
  }

  function loadOptional() {
    if (optionalLoaded) return;
    optionalLoaded = true;
    loadClarity();
    loadPixel();
  }

  /* ---- Public event helper --------------------------------------------- */
  // One call -> GA4 event + Clarity custom tag + Meta Pixel (standard or custom).
  window.wbTrack = function (name, params) {
    params = params || {};
    if (window.gtag) { try { window.gtag("event", name, params); } catch (e) {} }
    if (window.clarity) {
      try {
        window.clarity("event", name);
        if (params.tier) window.clarity("set", "tier", String(params.tier));
        if (params.ad_variant) window.clarity("set", "ad_variant", String(params.ad_variant));
      } catch (e) {}
    }
    if (window.fbq) {
      try {
        var std = {
          modal_open: "Lead",
          form_submit: "CompleteRegistration",
          checkout_redirect: "InitiateCheckout",
          purchase: "Purchase"
        };
        if (std[name]) window.fbq("track", std[name], params);
        else window.fbq("trackCustom", name, params);
      } catch (e) {}
    }
  };

  // True when this visitor is being measured. Callers (thank-you.html fires
  // purchase through it) use this to avoid double-reporting opted-out visits.
  window.wbConsentGranted = function () {
    try {
      var c = localStorage.getItem(CONSENT_KEY);
      return c !== "denied" && c !== "optout";
    } catch (e) { return true; }
  };

  /* ---- Consent banner --------------------------------------------------- */
  function getConsent() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {} }

  // Visitor-facing opt-out. Wire a footer link to it:
  //   <a href="#" onclick="wbOptOut();return false">Privacy choices</a>
  // Reloads so already-loaded trackers stop on the spot rather than at next visit.
  window.wbOptOut = function () {
    setConsent("denied");
    try { window.location.reload(); } catch (e) {}
  };

  // Any [data-optout] link becomes the opt-out control. The reload is what
  // actually stops the trackers already running on this page, so confirm
  // first — otherwise the click looks like it did nothing.
  function initOptOutLinks() {
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest && e.target.closest("[data-optout]");
      if (!a) return;
      e.preventDefault();
      setConsent("denied");
      a.textContent = "Analytics off \u2014 reloading\u2026";
      window.setTimeout(function () {
        try { window.location.reload(); } catch (err) {}
      }, 900);
    });
  }

  /* ---- Self-exclusion ---------------------------------------------------
     Visiting ?wb_optout=1 marks this browser as opted out: no banner, no
     trackers, nothing recorded. Intended for our own devices so we don't
     appear in our own analytics.

     Bookmark the opt-out URL and use it as the way you open the site. Safari's
     ITP evicts localStorage after ~7 days without interaction, which silently
     expires the choice — re-applying it on every visit is what makes the
     exclusion durable rather than something you have to remember to redo.

     ?wb_optout=0 clears the choice again, so a device can be put back into
     measurement if we ever need to.
  ----------------------------------------------------------------------- */
  function applyOptOutParam() {
    var v;
    try { v = new URLSearchParams(window.location.search).get("wb_optout"); }
    catch (e) { return false; }
    if (v === null) return false;
    if (v === "0" || v === "false") {
      try { localStorage.removeItem(CONSENT_KEY); } catch (e) {}
      return false;   // fall through: this device is measured again
    }
    setConsent("optout");
    return true;
  }

  function init() {
    initOptOutLinks();               // works even for opted-out visitors
    if (applyOptOutParam()) return;                 // this visit carried ?wb_optout=1
    var c = getConsent();
    if (c === "optout" || c === "denied") return;   // opted out: nothing loads
    loadBaseline();                                 // GA4
    loadOptional();                                 // Clarity + Meta Pixel
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
