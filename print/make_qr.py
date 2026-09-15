"""Generate the dog-park poster QR codes.

Each code encodes a short permanent URL (https://www.wonder-bowl.com/p/NN/);
which park it belongs to is set in p/go.js, so reassigning a code never needs a
reprint. Filenames carry the assignment at print time only, as a sorting aid.

Usage:  pip install segno  &&  python3 print/make_qr.py
"""
import pathlib
import segno

OUT = pathlib.Path(__file__).parent / "qr"
PURPLE = "#4a0374"  # --purple-deep: darkest brand purple, keeps strong scan contrast on white
CODES = {
    "01": "duboce-park", "02": "duboce-park",
    "03": "corona-heights", "04": "corona-heights",
    "05": "spare", "06": "spare", "07": "spare", "08": "spare", "09": "spare", "10": "spare",
}

OUT.mkdir(exist_ok=True)
for code, label in CODES.items():
    url = f"https://www.wonder-bowl.com/p/{code}/"
    # Level Q survives ~25% damage: scuffs, glare and rain on an outdoor poster.
    qr = segno.make(url, error="q", boost_error=False)
    stem = OUT / f"qr{code}-{label}"
    qr.save(f"{stem}.svg", scale=10, border=4, dark=PURPLE, light="#ffffff")
    qr.save(f"{stem}.png", scale=40, border=4, dark=PURPLE, light="#ffffff")
    print(f"qr{code}  {label:15}  v{qr.version}  {url}")
