#!/usr/bin/env python3
"""Build the Eat Well web demo assets.

Reads the badge app's restaurants.json plus the collected MapQuest share
links, then writes:
  - assets/art/*.png   : downscaled pixel art (icons, splash frames)
  - assets/qr/*.png    : precomputed QR codes (segno), one per linked restaurant
  - data.js            : window.EAT_WELL_DATA with cities, restaurants, art paths

Re-run after the MapQuest link collection finishes to refresh QR codes.
"""
import glob
import json
import os
import re
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.expanduser("~/workspace/badge-restaurant-finder")
PIXEL = os.path.join(APP, "assets_pixel")
DATA_JSON = os.path.join(APP, "eat_well", "data", "restaurants.json")
MQ_DIR = "/tmp/ewdata2/mq"
OUT_ART = os.path.join(HERE, "assets", "art")
OUT_QR = os.path.join(HERE, "assets", "qr")


def read_png(path):
    """Minimal PNG reader -> (w, h, rows of RGBA bytes). Handles 8-bit RGB/RGBA."""
    with open(path, "rb") as f:
        data = f.read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos, w, h, bitd, ctype = 8, 0, 0, 0, 0
    idat = b""
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctype_b = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if ctype_b == b"IHDR":
            w, h, bitd, ctype, _, _, _ = struct.unpack(">IIBBBBB", chunk)
        elif ctype_b == b"IDAT":
            idat += chunk
        pos += 12 + length
    assert bitd == 8 and ctype in (2, 6), f"unsupported PNG {path}"
    raw = zlib.decompress(idat)
    ch = 3 if ctype == 2 else 4
    stride = w * ch
    rows, prev, p = [], bytearray(stride), 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        if f == 1:
            for i in range(ch, stride): line[i] = (line[i] + line[i - ch]) & 255
        elif f == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                b = prev[i]
                c = prev[i - ch] if i >= ch else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        elif f != 0:
            raise ValueError(f"bad filter {f}")
        if ch == 3:
            out = bytearray()
            for i in range(0, stride, 3):
                out += line[i:i + 3] + b"\xff"
            rows.append(bytes(out))
        else:
            rows.append(bytes(line))
        prev = line
    return w, h, rows


def write_png(path, w, h, rows):
    """Write 8-bit RGBA rows."""
    def chunk(ctype, payload):
        c = ctype + payload
        return struct.pack(">I", len(payload)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    raw = b"".join(b"\x00" + r for r in rows)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def downscale_nearest(src, tw, th):
    w, h, rows = read_png(src)
    out = []
    for y in range(th):
        sy = min(h - 1, int(y * h / th))
        srow = rows[sy]
        orow = bytearray()
        for x in range(tw):
            sx = min(w - 1, int(x * w / tw))
            orow += srow[sx * 4:sx * 4 + 4]
        out.append(bytes(orow))
    return tw, th, out


def slug(name):
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "spot"


def load_links():
    """Return {(city_id, name_lower): url} from batch files and run outputs."""
    links = {}
    for f in glob.glob(os.path.join(MQ_DIR, "batch*.txt")):
        for line in open(f):
            parts = line.strip().split("|")
            if len(parts) == 3 and parts[2].startswith("http"):
                links[(parts[0], parts[1].lower())] = parts[2]
    try:
        runs = json.load(open(os.path.join(MQ_DIR, "runs.json")))
    except OSError:
        runs = {}
    for cid, r in runs.items():
        rid = r.get("run_id")
        out = os.path.join(MQ_DIR, f"run_{cid}.json")
        if not rid or not os.path.exists(out):
            continue
        try:
            d = json.load(open(out))
            for entry in d.get("output", {}).get("links", []):
                name, _, url = entry.partition("|")
                if url.startswith("http"):
                    links[(cid, name.strip().lower())] = url.strip()
        except (OSError, ValueError):
            continue
    return links


def main():
    os.makedirs(OUT_ART, exist_ok=True)
    os.makedirs(OUT_QR, exist_ok=True)

    # --- pixel art ---
    art = {}
    for kind, tw, th in (("diet", 48, 48), ("city", 48, 48)):
        for src in glob.glob(os.path.join(PIXEL, f"{kind}-*.png")):
            key = os.path.basename(src)[:-4]
            w, h, rows = downscale_nearest(src, tw, th)
            dst = os.path.join(OUT_ART, key + ".png")
            write_png(dst, w, h, rows)
            art[key] = "assets/art/" + key + ".png"
    for i in range(1, 5):
        src = os.path.join(PIXEL, f"splash-{i}.png")
        w, h, rows = downscale_nearest(src, 320, 240)
        dst = os.path.join(OUT_ART, f"splash-{i}.png")
        write_png(dst, w, h, rows)
        art[f"splash-{i}"] = f"assets/art/splash-{i}.png"
    print(f"art: {len(art)} files")

    # --- data + QR ---
    import segno
    links = load_links()
    print(f"mapquest links: {len(links)}")
    data = json.load(open(DATA_JSON))
    qr_count, missing = 0, 0
    for city in data["cities"]:
        for r in city["restaurants"]:
            url = links.get((city["id"], r["name"].lower()))
            if not url:
                missing += 1
                continue
            fn = f"{city['id']}--{slug(r['name'])}.png"
            dst = os.path.join(OUT_QR, fn)
            qr = segno.make(url, error="m")
            if not os.path.exists(dst):
                # border=0: we draw the quiet zone ourselves like the badge
                qr.save(dst, scale=4, border=0, kind="png")
            r["qr"] = "assets/qr/" + fn
            r["qr_modules"] = 21 + (qr.version - 1) * 4
            r["url"] = url
            qr_count += 1
    print(f"qr: {qr_count} linked, {missing} without link yet")

    js = "window.EAT_WELL_DATA = " + json.dumps(data, ensure_ascii=False) + ";\n"
    js += "window.EAT_WELL_ART = " + json.dumps(art) + ";\n"
    with open(os.path.join(HERE, "data.js"), "w") as f:
        f.write(js)
    print("wrote data.js")


if __name__ == "__main__":
    main()
