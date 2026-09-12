"""Pull the iOS home-screen icon out of the favicon.

    python3 scripts/extract_touch_icon.py            # write it
    python3 scripts/extract_touch_icon.py --check    # verify, write nothing

## Why this exists rather than a rasteriser

`apple-touch-icon.png` has to be a PNG. iOS will not take the SVG every other
surface here uses, and it composites whatever it gets onto black, so the file
also has to be opaque. Producing one from utils/images/logo.svg would mean a
rasteriser, and this repo has no image dependency at all -- adding one to make
a single 25KB file is a poor trade.

It does not need one. frontend/public/favicon.ico is already the same mark
rasterised at six sizes, and an .ico is a container: each entry here is a
whole PNG file, stored verbatim. The largest is 256x256 and fully opaque, so
the icon iOS wants is bytes that already exist in the repo -- this copies them
out rather than drawing them again.

That is also why it is a script and not a one-off: the .png is a build product
of the .ico, and when the mark changes the .ico is what gets redrawn. Running
this again is how the home-screen icon follows it.

## Why 256 rather than 180

180 is the size Apple documents, and it is a floor rather than a requirement:
iOS downscales a larger square itself, and does it well. Downscaling here would
mean resampling, which means the dependency this file exists to avoid.
"""
import argparse
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ICO = ROOT / 'frontend' / 'public' / 'favicon.ico'
OUT = ROOT / 'frontend' / 'public' / 'apple-touch-icon.png'

PNG_MAGIC = b'\x89PNG\r\n\x1a\n'


def entries(blob):
    """Every image in an .ico, as (width, height, bytes)."""
    reserved, kind, count = struct.unpack('<HHH', blob[:6])
    if reserved or kind != 1:
        raise SystemExit('{} is not an .ico file.'.format(ICO))
    for i in range(count):
        head = blob[6 + i * 16:6 + i * 16 + 16]
        width, height, _c, _r, _p, _bpp, size, offset = struct.unpack(
            '<BBBBHHII', head)
        # 0 means 256 in the directory: the field is one byte.
        yield width or 256, height or 256, blob[offset:offset + size]


def largest_png(blob):
    found = [(w, h, data) for w, h, data in entries(blob)
             if data[:8] == PNG_MAGIC]
    if not found:
        raise SystemExit(
            'No PNG entries in {} -- it holds raw DIBs, which this script '
            'cannot turn into a .png on its own.'.format(ICO))
    return max(found, key=lambda item: item[0] * item[1])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true',
                        help='verify the icon is current; write nothing')
    args = parser.parse_args()

    width, height, data = largest_png(ICO.read_bytes())

    if args.check:
        current = OUT.read_bytes() if OUT.exists() else None
        if current == data:
            print('apple-touch-icon.png is current ({}x{}).'.format(width, height))
            return 0
        print('apple-touch-icon.png is missing or stale -- run this without '
              '--check.', file=sys.stderr)
        return 1

    OUT.write_bytes(data)
    print('Wrote {} ({}x{}, {} bytes) from {}.'.format(
        OUT.relative_to(ROOT), width, height, len(data), ICO.name))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
