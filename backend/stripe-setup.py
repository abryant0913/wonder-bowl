#!/usr/bin/env python3
"""
Create the Wonder Bowl large-order catalogue in Stripe: 6 products, 6 prices and
6 Payment Links (one per rhythm x size). Prints the six link URLs at the end — those go into
LARGE_ORDER_LINKS in script.js.

Your secret key is read from the environment and is never written to a file, a
log, or this script. Run it like this so the key does not land in shell history
either (note the leading space):

     export STRIPE_SECRET_KEY='sk_live_...'
    python3 backend/stripe-setup.py --dry-run     # see exactly what it will create
    python3 backend/stripe-setup.py               # actually create it
    unset STRIPE_SECRET_KEY

PREREQUISITE — set your Terms of Service URL first, at
https://dashboard.stripe.com/settings/public . Stripe refuses the consent
checkbox without it, and the script will stop and tell you so.

Stdlib only. No pip install, no dependencies.
"""

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.stripe.com/v1"
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stripe-setup-output.json")

SITE = "https://wonder-bowl.com/thank-you.html"

# A dog eats two bowls a day, so pack size IS the delivery period: 14 bowls is a
# week. Amounts are in cents, because Stripe takes integer minor units — money
# as a float is a rounding bug waiting to happen.
SIZES = ["1-Cup", "2-Cup", "3-Cup"]

PACKS = [
    {
        "key": "once",
        "bowls": 6,
        "label": "(Pack of 6)",
        "blurb": "Three days of meals. One-off, no schedule.",
        "interval": None,                      # one-time
        "amounts": {"1-Cup": 3750, "2-Cup": 6000, "3-Cup": 8250},
    },
    {
        "key": "weekly",
        "bowls": 14,
        "label": "(14-Bowl Weekly Pack)",
        "blurb": "A full week of meals, delivered every week.",
        "interval": ("week", 1),
        "amounts": {"1-Cup": 7000, "2-Cup": 11200, "3-Cup": 15400},
    },
]

# A 28-bowl bi-weekly pack was designed and then cut: two weeks of fresh food has
# to be frozen, and the FAQ sells against exactly that.


def money(cents):
    return "${:,.2f}".format(cents / 100.0)


def request(path, params):
    """POST form-encoded params to Stripe. Raises SystemExit with Stripe's own
    error message, which is almost always more useful than a traceback."""
    key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    body = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(API + path, data=body, method="POST")
    token = base64.b64encode((key + ":").encode("utf-8")).decode("ascii")
    req.add_header("Authorization", "Basic " + token)
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read().decode("utf-8")).get("error", {})
            msg = err.get("message", str(e))
            param = err.get("param")
        except Exception:
            msg, param = str(e), None
        print("\n  Stripe rejected the request (HTTP %s):" % e.code, file=sys.stderr)
        print("    %s" % msg, file=sys.stderr)
        if param:
            print("    parameter: %s" % param, file=sys.stderr)
        if "terms of service" in msg.lower() or param == "consent_collection":
            print(
                "\n  Fix: set your Terms of Service URL at\n"
                "  https://dashboard.stripe.com/settings/public\n"
                "  then re-run. Nothing created so far is harmed — but see\n"
                "  the note about re-running in the script header.",
                file=sys.stderr,
            )
        raise SystemExit(1)
    except urllib.error.URLError as e:
        raise SystemExit("\n  Could not reach Stripe: %s" % e.reason)


def preflight(args):
    key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    if not key:
        raise SystemExit(
            "STRIPE_SECRET_KEY is not set.\n"
            "  Run:  export STRIPE_SECRET_KEY='sk_live_...'   (leading space keeps it out of history)"
        )
    if not key.startswith("sk_"):
        raise SystemExit(
            "That does not look like a secret key (expected it to start with 'sk_').\n"
            "  A publishable key (pk_...) cannot create products."
        )
    live = key.startswith("sk_live_")
    mode = "LIVE" if live else "TEST"
    print("Stripe mode: %s" % mode)
    if not live:
        print(
            "  Note: test-mode products and links do NOT carry over to live mode,\n"
            "  and their URLs only accept test cards. Fine for a rehearsal —\n"
            "  you will need to re-run with the live key for the real links."
        )
    if os.path.exists(OUTPUT) and not args.dry_run and not args.force:
        raise SystemExit(
            "\n%s already exists, so this script has run before.\n"
            "  Re-running creates a SECOND full set of products and links — Stripe\n"
            "  has no notion of 'already created this'. If that is what you want,\n"
            "  pass --force. Otherwise open that file for the links you already have."
            % OUTPUT
        )
    return live


def plan():
    print("\nWill create 6 products, 6 prices and 6 Payment Links:\n")
    for pack in PACKS:
        if pack["interval"]:
            unit, count = pack["interval"]
            billing = "every %s %ss" % (count, unit) if count > 1 else "every %s" % unit
        else:
            billing = "one-time"
        print("  %s bowls, %s:" % (pack["bowls"], billing))
        for size in SIZES:
            print("      Wonder Bowl %s %-22s %s" % (size, pack["label"], money(pack["amounts"][size])))
    print("\n  One link per product (6 total): a single line item, quantity 1–10,")
    print("  terms-of-service consent required, address and phone collection OFF")
    print("  (the site's own form already captured those), redirect to thank-you.html.\n")


def create(live):
    created = {"products": [], "prices": [], "links": {}}

    for pack in PACKS:
        price_ids = []
        for size in SIZES:
            name = "Wonder Bowl %s %s" % (size, pack["label"])
            product = request("/products", {
                "name": name,
                "description": "%s %s bowls. %s" % (pack["bowls"], size, pack["blurb"]),
                "metadata[wb_size]": size,
                "metadata[wb_bowls]": str(pack["bowls"]),
                "metadata[wb_rhythm]": pack["key"],
            })
            created["products"].append({"id": product["id"], "name": name})
            print("  product  %-46s %s" % (name, product["id"]))

            price_params = {
                "product": product["id"],
                "currency": "usd",
                "unit_amount": str(pack["amounts"][size]),
            }
            if pack["interval"]:
                unit, count = pack["interval"]
                price_params["recurring[interval]"] = unit
                price_params["recurring[interval_count]"] = str(count)
            price = request("/prices", price_params)
            price_ids.append(price["id"])
            created["prices"].append({"id": price["id"], "product": name,
                                      "amount": pack["amounts"][size]})
            print("  price    %-46s %s" % (money(pack["amounts"][size]), price["id"]))

            # ONE SIZE PER LINK. A Payment Link puts every line item in the cart at
            # quantity 1 and adjustable_quantity.minimum only permits removal — it
            # cannot make an item start absent. A link carrying all three sizes
            # therefore opens at "one of each" ($180 one-time, $336 weekly) and a
            # one-dog household must delete two items before paying. The PACK is
            # what enforces the 6-bowl floor; Stripe has no cart-level minimum.
            link_params = {
                "line_items[0][price]": price["id"],
                "line_items[0][quantity]": "1",
                "line_items[0][adjustable_quantity][enabled]": "true",
                "line_items[0][adjustable_quantity][minimum]": "1",
                "line_items[0][adjustable_quantity][maximum]": "10",
                "consent_collection[terms_of_service]": "required",
                "after_completion[type]": "redirect",
                "after_completion[redirect][url]":
                    "%s?order=large&freq=%s&session_id={CHECKOUT_SESSION_ID}" % (SITE, pack["key"]),
                "metadata[wb_rhythm]": pack["key"],
                "metadata[wb_size]": size,
            }
            # phone_number_collection and shipping_address_collection are left unset:
            # both default to off, and the modal already collected them.
            link = request("/payment_links", link_params)
            key = "%s.%s" % (pack["key"], size.lower().replace("-", "").replace("cup", "cup"))
            created["links"][key] = link["url"]
            print("  LINK     %-46s %s\n" % (key, link["url"]))

    created["mode"] = "live" if live else "test"
    with open(OUTPUT, "w") as f:
        json.dump(created, f, indent=2)
    return created


def main():
    ap = argparse.ArgumentParser(description="Create the Wonder Bowl large-order catalogue in Stripe.")
    ap.add_argument("--dry-run", action="store_true", help="print the plan and exit, creating nothing")
    ap.add_argument("--force", action="store_true", help="run again even though output file exists")
    args = ap.parse_args()

    live = preflight(args)
    plan()

    if args.dry_run:
        print("Dry run — nothing was created.")
        return

    answer = input("Create all of this in %s mode? [y/N] " % ("LIVE" if live else "TEST")).strip().lower()
    if answer != "y":
        print("Aborted. Nothing created.")
        return

    print()
    created = create(live)

    print("=" * 72)
    print("Paste these into LARGE_ORDER_LINKS in script.js:\n")
    for key in sorted(created["links"]):
        print('    %-16s "%s",' % (key, created["links"][key]))
    print("\nFull record saved to %s" % OUTPUT)
    print("(That file holds product/price/link IDs only — no keys.)")
    print("=" * 72)


if __name__ == "__main__":
    main()
