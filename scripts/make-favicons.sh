#!/usr/bin/env bash
#
# Regenerate the favicon set in public/ from the brand wordmark.
#
#   ./scripts/make-favicons.sh
#
# Source of truth is design/brand/mdmc-favicon.jpg — the supplied artwork:
# the MDMC wordmark sitting near the BOTTOM of a white square. Everything
# below is derived from it, so re-running this after the brand changes is the
# whole update procedure. Nothing here touches the network.
#
# Requires: ImageMagick 7 (`magick`), python3 with opencv (`cv2`) + numpy.
#
# TWO DESIGN DECISIONS ARE THE USER'S, AND NEITHER IS A BUG
# ---------------------------------------------------------
# 1. THE SQUARE IS USED AS COMPOSED. The wordmark's low placement is
#    deliberate, so the artwork is never trimmed to its ink or re-centred —
#    every asset keeps the source's own margins and its bottom alignment.
#    An earlier revision trimmed and vertically centred it; that was wrong.
# 2. ALWAYS A WHITE SQUARE WITH BLACK TEXT, in light AND dark mode. So the
#    SVG paints an explicit white background rather than being transparent,
#    and carries no prefers-color-scheme rule. Every raster is flattened onto
#    white to match. One identity in every context.
#
# The full wordmark is also used at EVERY size rather than an M monogram for
# the small ones. At 16px it does not read as letterforms — a known and
# accepted trade-off for carrying one consistent mark everywhere.
#
# WHY THE SMALL RASTERS ARE NOT A PLAIN DOWNSCALE
# -----------------------------------------------
# The wordmark is ~4.23:1 and occupies only the lower fifth of the square, so
# at 16px it lands about 3px tall. A naive resize gives every one of those
# pixels partial ink coverage and antialiases the lot to a uniform grey
# smudge. So each raster size gets its strokes thickened BEFORE the downscale
# — in negated space, where ink is white, because dilating the black-on-white
# original would eat the strokes instead of growing them — and its midtones
# pushed back toward black afterwards. Radii were tuned by rendering
# candidates at true size and comparing them.

set -euo pipefail

cd "$(dirname "$0")/.."

SRC="design/brand/mdmc-favicon.jpg"
OUT="public"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

[ -f "$SRC" ] || { echo "missing source: $SRC" >&2; exit 1; }

# --- 1. Normalise the source ------------------------------------------------
# Hard black/white split, canvas left exactly as supplied. The source is a
# JPEG, so glyph edges carry compression noise; thresholding to binary
# discards it rather than letting it propagate into every asset. Ink lands on
# pure #000 and paper on pure #fff, matching the site's --ink / --paper.
magick "$SRC" -colorspace gray -threshold 50% "$WORK/sq.png"

# -format emits no trailing newline, which would make `read` return non-zero
# and trip `set -e` — so the newline is part of the format string.
read -r SW SH < <(magick identify -format '%w %h\n' "$WORK/sq.png")
read -r IW IH IX IY < <(
  magick "$WORK/sq.png" -fuzz 5% -format '%@\n' info: |
    sed -E 's/[x+]/ /g'
)
echo "square: ${SW}x${SH}; ink ${IW}x${IH} at +${IX}+${IY}"
echo "  ink sits $(( SH - IY - IH ))px off the bottom, $(( IY * 100 / SH ))% down the square"

if [ "$SW" != "$SH" ]; then
  echo "WARNING: source is not square (${SW}x${SH}); icons will be letterboxed" >&2
fi

# Negated copy: ink is white here, which is the space the dilations run in.
magick "$WORK/sq.png" -negate "$WORK/sqi.png"

# --- 2. Vector favicon.svg --------------------------------------------------
# Traced to real paths so the scalable icon stays crisp at any size. 5 contours
# (M, D + its counter, M, C); 0.8px tolerance on a ~1600px-wide source is a
# 0.26px deviation at 512px, i.e. invisible, for ~300 points total.
# fill-rule=evenodd renders the D's counter as a hole without needing to
# reason about contour winding. Coordinates are the source's own, so the
# wordmark keeps its position in the square.
python3 - "$WORK/sq.png" "$OUT/favicon.svg" << 'PY'
import sys
import cv2

src, dest = sys.argv[1], sys.argv[2]
img = cv2.imread(src, cv2.IMREAD_GRAYSCALE)
h, w = img.shape
_, bw = cv2.threshold(img, 128, 255, cv2.THRESH_BINARY_INV)
contours, _ = cv2.findContours(bw, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)

subpaths = []
for contour in contours:
    pts = cv2.approxPolyDP(contour, 0.8, True).reshape(-1, 2)
    if len(pts) < 3:
        continue
    d = f"M{pts[0][0]:g} {pts[0][1]:g}"
    d += "".join(f"L{x:g} {y:g}" for x, y in pts[1:])
    subpaths.append(d + "Z")

# The white rect is deliberate, not a default: this icon is a white square
# with black text in BOTH colour schemes, so there is no transparency to let
# dark browser chrome through and no prefers-color-scheme rule.
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">
<title>MDMC</title>
<rect width="{w}" height="{h}" fill="#fff"/>
<path fill-rule="evenodd" fill="#000" d="{''.join(subpaths)}"/>
</svg>
'''
with open(dest, "w") as f:
    f.write(svg)
print(f"favicon.svg: {len(contours)} contours, {len(svg)} bytes")
PY

# --- 3. favicon.ico (16 / 32 / 48) ------------------------------------------
# Dilation radius falls as the target grows: 16px needs heavy compensation,
# 48px almost none. -level pushes the surviving midtones back toward ink
# (applied in negated space, hence the bright end moving, not the dark).
# No -extent: the source is already square, so the aspect is preserved and
# the wordmark stays where it was composed.
ico_size() { # $1 = px, $2 = dilate radius, $3 = level ceiling
  magick "$WORK/sqi.png" \
    -morphology Dilate "Disk:$2" \
    -filter Catrom -resize "${1}x${1}!" \
    -level "0%,$3%" \
    -negate \
    -background white -alpha remove -alpha off \
    "$WORK/ico-$1.png"
}
# 16px is deliberately NOT the densest option available. Heavier dilation
# (Disk:11, Disk:14) renders darker but merges the four letters into a single
# bar; Disk:8 keeps visible gaps between them, and that letter rhythm is the
# only legibility cue left at this size. Compared at true size before picking.
ico_size 16 8  60
ico_size 32 6  75
ico_size 48 3  85
magick "$WORK/ico-16.png" "$WORK/ico-32.png" "$WORK/ico-48.png" "$OUT/favicon.ico"

# --- 4. apple-touch-icon.png (180) ------------------------------------------
# iOS ignores alpha and composites it onto black, so this is flattened onto
# white explicitly. The artwork carries its own margins, so it is scaled whole
# rather than inset — see the note in the header about keeping the composition.
magick "$WORK/sq.png" \
  -filter Catrom -resize 180x180! \
  -background white -alpha remove -alpha off \
  "$OUT/apple-touch-icon.png"

# --- 5. PWA icons (192 / 512) -----------------------------------------------
# Declared purpose "any" in the manifest, so they are never mask-cropped.
for px in 192 512; do
  magick "$WORK/sq.png" \
    -filter Catrom -resize "${px}x${px}!" \
    -background white -alpha remove -alpha off \
    "$OUT/icon-${px}.png"
done

echo
echo "written:"
for f in favicon.svg favicon.ico apple-touch-icon.png icon-192.png icon-512.png; do
  printf '  %-24s %s\n' "$f" "$(du -h "$OUT/$f" | cut -f1)"
done
