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
  var GA4_ID     = "G-XXXXXXXXXX";   // TODO: your GA4 Measurement ID
  var CLARITY_ID = "y64z7ixc68";     // Microsoft Clarity project ID (set)
  var PIXEL_ID   = "YOUR_PIXEL_ID";  // TODO: your Meta Pixel ID

  var CONSENT_KEY = "wb_consent";    // localStorage: "granted" | "denied"
  var loaded = false;

  // An ID is "real" once the placeholder Xs / default text are gone.
  function ready(v) { return !!v && v.indexOf("X") === -1 && v !== "YOUR_PIXEL_ID"; }

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

  function loadAll() {
    if (loaded) return;
    loaded = true;
    loadGA4();
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

  // Has the visitor granted consent? (used by pages that fire purchase, etc.)
  window.wbConsentGranted = function () {
    try { return localStorage.getItem(CONSENT_KEY) === "granted"; } catch (e) { return false; }
  };

  /* ---- Consent banner --------------------------------------------------- */
  function getConsent() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {} }

  var bannerEl = null;
  function hideBanner() { if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl); bannerEl = null; }

  function grant() { setConsent("granted"); loadAll(); hideBanner(); }
  function deny()  { setConsent("denied"); hideBanner(); }

  function showBanner() {
    var b = document.createElement("div");
    b.className = "consent";
    b.setAttribute("role", "dialog");
    b.setAttribute("aria-label", "Cookie and analytics consent");
    b.innerHTML =
      '<p class="consent__text">We use cookies and privacy-friendly analytics ' +
      '(Google Analytics, Microsoft Clarity, Meta Pixel) to see how the site is used ' +
      'and make it better. Okay with you?</p>' +
      '<div class="consent__actions">' +
        '<button class="btn consent__btn consent__no" type="button">Decline</button>' +
        '<button class="btn consent__btn consent__yes" type="button">Accept</button>' +
      '</div>';
    document.body.appendChild(b);
    bannerEl = b;
    b.querySelector(".consent__yes").addEventListener("click", grant);
    b.querySelector(".consent__no").addEventListener("click", deny);
  }

  function init() {
    var c = getConsent();
    if (c === "granted") loadAll();
    else if (c !== "denied") showBanner();
    // "denied" -> load nothing, show nothing
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
