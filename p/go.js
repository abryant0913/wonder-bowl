/* ============================================================================
   Wonder Bowl — QR poster redirects
   Every printed QR code points at a short, permanent URL (/p/01/ … /p/10/).
   This file turns that code into a tagged landing URL, so the scan is
   attributed in GA4, in the Submissions sheet and on the Stripe payment.

   Edit CODES below to rename a park or put a spare code into service. The
   printed posters never change: only this table does. GitHub Pages caches for
   up to 10 minutes, so an edit takes that long to reach scanners.

   What each scan lands with:
     ad=qr01            -> hero keeps its default copy (poster IDs match no ad
                           narrative), ad_variant column in the sheet, and the
                           Stripe client_reference_id ("classic_qr01")
     utm_source=qr
     utm_medium=poster
     utm_campaign=<park> -> GA4 Traffic acquisition: "Session manual campaign"
     utm_content=qr01    -> GA4: "Session manual ad content"
     utm_term=<spot>     -> optional note on where the poster hangs
   ============================================================================ */
(function () {
  "use strict";

  // Park slugs: lowercase words joined by hyphens. Spares stay "unassigned"
  // until they go up; their scans still land and are counted under that name.
  var CODES = {
    "01": { park: "duboce-park", spot: "" },
    "02": { park: "duboce-park", spot: "" },
    "03": { park: "corona-heights", spot: "" },
    "04": { park: "corona-heights", spot: "" },
    "05": { park: "unassigned", spot: "" },
    "06": { park: "unassigned", spot: "" },
    "07": { park: "unassigned", spot: "" },
    "08": { park: "unassigned", spot: "" },
    "09": { park: "unassigned", spot: "" },
    "10": { park: "unassigned", spot: "" }
  };

  var match = window.location.pathname.match(/\/p\/([0-9a-z-]+)\/?(?:index\.html)?$/i);
  var code = match ? match[1].toLowerCase() : "";
  var entry = CODES[code] || { park: "unknown", spot: "" };
  var id = "qr" + code;

  var params = new URLSearchParams();
  params.set("ad", id);
  params.set("utm_source", "qr");
  params.set("utm_medium", "poster");
  params.set("utm_campaign", entry.park);
  params.set("utm_content", id);
  if (entry.spot) params.set("utm_term", entry.spot);

  // replace() keeps the redirect page out of history, so Back doesn't bounce
  // the visitor straight into the site again.
  window.location.replace("/?" + params.toString());
})();
