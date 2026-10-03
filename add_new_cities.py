#!/usr/bin/env python3
"""Add 23 new cities (460 restaurants) to the Eat Well AI site.

Reads research JSON files, generates MapQuest search URLs and QR codes,
then appends city entries to data.js.

Usage: python3 add_new_cities.py
"""

import json
import os
import re
import urllib.parse

import segno

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_JS = os.path.join(HERE, "data.js")
QR_DIR = os.path.join(HERE, "assets", "qr")

# city_id -> (display name, aliases)
CITY_META = {
    # Canada
    "toronto": ("Toronto, ON", ["toronto"]),
    "vancouver": ("Vancouver, BC", ["vancouver"]),
    "montreal": ("Montreal, QC", ["montreal"]),
    "calgary": ("Calgary, AB", ["calgary"]),
    "ottawa": ("Ottawa, ON", ["ottawa"]),
    # UK
    "london": ("London, UK", ["london"]),
    "manchester": ("Manchester, UK", ["manchester"]),
    "birmingham": ("Birmingham, UK", ["birmingham"]),
    "edinburgh": ("Edinburgh, UK", ["edinburgh"]),
    "glasgow": ("Glasgow, UK", ["glasgow"]),
    # US Midwest
    "madison": ("Madison, WI", ["madison", "uw", "university of wisconsin", "state street"]),
    "milwaukee": ("Milwaukee, WI", ["milwaukee", "mke", "bay view", "brady street"]),
    "rochester": ("Rochester, MN", ["rochester", "mayo clinic", "mayo"]),
    # US round 2
    "seattle": ("Seattle, WA", ["seattle"]),
    "portland": ("Portland, OR", ["portland"]),
    "denver": ("Denver, CO", ["denver"]),
    "boston": ("Boston, MA", ["boston"]),
    "atlanta": ("Atlanta, GA", ["atlanta"]),
    "charlotte": ("Charlotte, NC", ["charlotte"]),
    "austin": ("Austin, TX", ["austin"]),
    "las-vegas": ("Las Vegas, NV", ["las vegas", "vegas"]),
    "nashville": ("Nashville, TN", ["nashville"]),
    "orlando": ("Orlando, FL", ["orlando"]),
}

RESEARCH_FILES = [
    os.path.expanduser("~/workspace/eat-well-ai-data/canadian-cities.json"),
    os.path.expanduser("~/workspace/eat-well-ai/uk-restaurants.json"),
    os.path.expanduser("~/workspace/eat-well-us-midwest.json"),
    os.path.expanduser("~/workspace/eat-well-ai-data/us-cities-2.json"),
]


def slugify(text):
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def mapquest_url(name, address):
    query = f"{name}, {address}"
    encoded = urllib.parse.quote(query)
    return f"https://www.mapquest.com/search/result?query={encoded}"


def main():
    # Load all research data
    all_cities = {}
    for path in RESEARCH_FILES:
        with open(path) as f:
            data = json.load(f)
        for city_id, restaurants in data.items():
            if city_id in all_cities:
                print(f"WARNING: duplicate city {city_id}, skipping")
                continue
            all_cities[city_id] = restaurants

    print(f"Loaded {len(all_cities)} cities")

    # Verify all cities have metadata
    for city_id in all_cities:
        if city_id not in CITY_META:
            print(f"ERROR: no metadata for {city_id}")
            return 1

    os.makedirs(QR_DIR, exist_ok=True)

    # Build city entries
    city_entries = []
    qr_count = 0
    for city_id, restaurants in all_cities.items():
        display_name, aliases = CITY_META[city_id]
        rest_entries = []
        for r in restaurants:
            name = r["name"]
            slug = slugify(name)
            qr_filename = f"{city_id}--{slug}.png"
            qr_path = f"assets/qr/{qr_filename}"
            qr_full = os.path.join(QR_DIR, qr_filename)

            url = mapquest_url(name, r.get("address", ""))

            # Generate QR code if not exists
            if not os.path.exists(qr_full):
                qr = segno.make(url, micro=False)
                # Match existing style: white on black? Check existing
                # Existing QRs are standard black-on-white
                qr.save(qr_full, scale=4, border=2)
                qr_count += 1

            # Get QR modules (approximate from segno version)
            qr_test = segno.make(url, micro=False)
            modules = qr_test.version * 4 + 17  # version to modules

            entry = {
                "name": name,
                "cuisine": r.get("cuisine", ""),
                "price": r.get("price", "$$"),
                "diets": r.get("diets", []),
                "area": r.get("area", ""),
                "note": r.get("note", ""),
                "rating": r.get("rating"),
                "qr": qr_path,
                "qr_modules": modules,
                "url": url,
            }
            rest_entries.append(entry)

        city_entry = {
            "id": city_id,
            "name": display_name,
            "aliases": aliases,
            "restaurants": rest_entries,
        }
        city_entries.append(city_entry)
        print(f"  {city_id}: {len(rest_entries)} restaurants")

    print(f"Generated {qr_count} new QR codes")

    # Read existing data.js and append cities
    with open(DATA_JS) as f:
        content = f.read()

    # Find the cities array closing and insert before it
    # The format is: window.EAT_WELL_DATA = {"cities": [...]};
    # We need to append to the cities array

    # Find the last city's closing and the array closing
    # Simpler: replace ']}]};' pattern at the end of cities array
    # Actually the structure is {"cities": [{...}, {...}]}

    # Find where the cities array ends - look for the pattern before window.EAT_WELL_ART
    art_marker = "window.EAT_WELL_ART"
    art_pos = content.find(art_marker)
    if art_pos == -1:
        print("ERROR: could not find EAT_WELL_ART marker")
        return 1

    # The cities array ends with ]} right before ;
    # Find the last ]} before the art marker
    before_art = content[:art_pos].rstrip()
    # Should end with "]};"
    assert before_art.endswith("]};"), f"Unexpected ending: {before_art[-20:]}"

    # Remove the trailing "]};" and add our cities
    base = before_art[:-3]  # remove "]};"

    new_cities_json = json.dumps(city_entries, separators=(",", ":"))
    # Remove the outer [ and ] to get just the objects
    new_cities_inner = new_cities_json[1:-1]

    updated = base + "," + new_cities_inner + "]};" + content[art_pos:]

    with open(DATA_JS, "w") as f:
        f.write(updated)

    print(f"\nDone! Added {len(city_entries)} cities to data.js")
    total_restaurants = sum(len(c["restaurants"]) for c in city_entries)
    print(f"Total new restaurants: {total_restaurants}")
    return 0


if __name__ == "__main__":
    exit(main())
