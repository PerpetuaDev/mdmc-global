#!/usr/bin/env bash
#
# Regenerate the favicon set in public/ from the brand wordmark.
#
#   ./scripts/make-favicons.sh
#
# Source of truth is design/brand/mdmc-favicon.jpg — the supplied artwork,
# which is the MDMC wordmark sitting in the lower-left of a white square.
# Everything below is derived from it, so re-running this after the brand
# changes is the whole update procedure. Nothing here touches the network.
#
# Requires: ImageMagick 7 (`magick`), python3 with opencv (`cv2`) + numpy.
#
# WHY THE SMALL RASTERS ARE NOT A PLAIN DOWNSCALE
# -----------------------------------------------
# The wordmark is ~4.23:1. Letterboxed into a square icon the glyphs are only
# 16/4.23 = 3.8px tall at 16px, and a naive resize renders that as a uniform
# grey smear: every pixel gets partial ink coverage and antialiases to ~50%.
# So each raster size gets its strokes thickened BEFORE the downscale (in
# negated space, where ink is white — dilating the black-on-white original
# would eat the strokes instead of growing them) and its midtones pushed back
# toward black afterwards. Radii were tuned by rendering candidates at true
# size and comparing them; see the header comment on each size below.
#
# Design decision (2026-09-09): the full wordmark is used at EVERY size,
# rather than an M monogram for the small ones. At 16px it is not legible as
# letterforms — that is a known and accepted trade-off for carrying one
# consistent mark everywhere.

set -euo pipefail

cd "$(dirname "$0")/.."

SRC="design/brand/mdmc-favicon.jpg"
OUT="public"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

[ -f "$SRC" ] || { echo "missing source: $SRC" >&2; exit 1; }

# --- 1. Normalise the source ------------------------------------------------
# Trim the white surround to the ink, then force a hard black/white split.
# The source is a JPEG, so glyph edges carry compression noise; thresholding
# to binary discards it rather than letting it propagate into every asset.
# Ink lands on pure #000 to match the site's --ink token.
magick "$SRC" -colorspace gray -fuzz 5% -trim +repage \
  -threshold 50% "$WORK/wm.png"

# -format emits no trailing newline, which would make `read` return non-zero
# and trip `set -e` — so the newline is part of the format string.
read -r W H < <(magick identify -format '%w %h\n' "$WORK/wm.png")
echo "wordmark ink: ${W}x${H} ($(python3 -c "print(f'{$W/$H:.2f}')"):1)"

# Negated copy: ink is white here, which is the space the dilations run in.
magick "$WORK/wm.png" -negate "$WORK/wmi.png"

# --- 2. Vector favicon.svg --------------------------------------------------
# Traced to real paths so the scalable icon stays crisp at any size. 5 contours
# (M, D + its counter, M, C); 0.8px tolerance on a ~1500px-wide source is a
# 0.27px deviation at 512px, i.e. invisible, for ~300 points total.
# fill-rule=evenodd renders the D's counter as a hole without needing to
# reason about contour winding.
python3 - "$WORK/wm.png" "$OUT/favicon.svg" << 'PY'
import sys
import cv2

src, dest = sys.argv[1], sys.argv[2]
img = cv2.imread(src, cv2.IMREAD_GRAYSCALE)
h, w = img.shape
_, bw = cv2.threshold(img, 128, 255, cv2.THRESH_BINARY_INV)
contours, _ = cv2.findContours(bw, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)

# Square viewBox, wordmark full-bleed across the width and centred vertically:
# the icon box is tiny, so every pixel of width is legibility that side padding
# would throw away.
side = w
dy = (side - h) / 2

subpaths = []
for contour in contours:
    pts = cv2.approxPolyDP(contour, 0.8, True).reshape(-1, 2)
    if len(pts) < 3:
        continue
    d = f"M{pts[0][0]:g} {pts[0][1] + dy:g}"
    d += "".join(f"L{x:g} {y + dy:g}" for x, y in pts[1:])
    subpaths.append(d + "Z")

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side} {side}">
<title>MDMC</title>
<style>
path {{ fill: #000 }}
@media (prefers-color-scheme: dark) {{ path {{ fill: #fff }} }}
</style>
<path fill-rule="evenodd" d="{''.join(subpaths)}"/>
</svg>
'''
with open(dest, "w") as f:
    f.write(svg)
print(f"favicon.svg: {len(contours)} contours, {len(svg)} bytes")
PY

# --- 3. favicon.ico (16 / 32 / 48) ------------------------------------------
# Black on opaque white. An .ico cannot carry a prefers-color-scheme rule the
# way the SVG can, and a transparent black wordmark would disappear into a
# dark bookmarks bar — so these keep their paper.
#
# Dilation radius falls as the target grows: 16px needs heavy compensation,
# 48px almost none. -level pushes the surviving midtones back toward ink
# (applied in negated space, hence the bright end moving, not the dark).
ico_size() { # $1 = px, $2 = dilate radius, $3 = level ceiling
  magick "$WORK/wmi.png" \
    -morphology Dilate "Disk:$2" \
    -filter Catrom -resize "${1}x" \
    -level "0%,$3%" \
    -negate \
    -background white -alpha remove -alpha off \
    -gravity center -extent "${1}x${1}" \
    "$WORK/ico-$1.png"
}
ico_size 16 10 70
ico_size 32 4  80
ico_size 48 2  90
magick "$WORK/ico-16.png" "$WORK/ico-32.png" "$WORK/ico-48.png" "$OUT/favicon.ico"

# --- 4. apple-touch-icon.png (180) ------------------------------------------
# iOS ignores alpha and composites it onto black, so this is flattened onto
# white explicitly. Inset to ~82% of the width, which is roughly the breathing
# room Apple's own icons carry once the OS rounds the corners.
magick "$WORK/wm.png" \
  -resize "$((180 * 82 / 100))x" \
  -background white -alpha remove -alpha off \
  -gravity center -extent 180x180 \
  "$OUT/apple-touch-icon.png"

# --- 5. PWA icons (192 / 512) -----------------------------------------------
# Declared purpose "any" in the manifest, so they are never mask-cropped;
# the 78% inset still keeps the wordmark clear of a circular crop if some
# launcher decides to apply one anyway.
for px in 192 512; do
  magick "$WORK/wm.png" \
    -resize "$((px * 78 / 100))x" \
    -background white -alpha remove -alpha off \
    -gravity center -extent "${px}x${px}" \
    "$OUT/icon-${px}.png"
done

echo
echo "written:"
for f in favicon.svg favicon.ico apple-touch-icon.png icon-192.png icon-512.png; do
  printf '  %-24s %s\n' "$f" "$(du -h "$OUT/$f" | cut -f1)"
done
