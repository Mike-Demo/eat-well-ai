#!/usr/bin/env python3
"""Find real HappyCow listing URLs for vegan/vegetarian restaurants using Firecrawl.

For each vegan/vegetarian restaurant in data.js, searches HappyCow via
Firecrawl and extracts the best matching /reviews/ URL. Updates data.js
with the real URL, or keeps the search URL if no match found.

Usage: python3 find_happycow_listings.py
"""

import json
import re
import subprocess
import sys
import time
import urllib.parse

HERE = "/home/hatch/workspace/eat-well-ai"
DATA_JS = f"{HERE}/data.js"
FIRECRAWL_BIN = "/home/hatch/workspace/skills/firecrawl/bin/firecrawl"
PROGRESS_FILE = f"{HERE}/happycow_progress.json"


def firecrawl_search(query, limit=3):
    """Run firecrawl search and return results."""
    try:
        result = subprocess.run(
            [FIRECRAWL_BIN, "search", query, "--limit", str(limit)],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            print(f"  Firecrawl error: {result.stderr[:200]}")
            return []
        
        # Parse output - look for JSON objects with url fields
        output = result.stdout
        urls = []
        # Find all happycow.net/reviews/ URLs
        for match in re.finditer(r'https://www\.happycow\.net/reviews/[a-z0-9\-]+', output):
            url = match.group(0)
            # Skip pagination URLs
            if '?' not in url and url not in urls:
                urls.append(url)
        return urls
    except subprocess.TimeoutExpired:
        print("  Timeout")
        return []
    except Exception as e:
        print(f"  Error: {e}")
        return []


def normalize_name(name):
    """Normalize for comparison."""
    name = name.lower()
    name = re.sub(r"[^a-z0-9]", "", name)
    return name


def is_match(restaurant_name, url, title=""):
    """Check if URL likely matches the restaurant."""
    # Extract slug from URL: /reviews/{slug}-{id}
    match = re.search(r'/reviews/([a-z0-9\-]+)-\d+$', url)
    if not match:
        return False
    
    slug = match.group(1)
    norm_name = normalize_name(restaurant_name)
    norm_slug = normalize_name(slug)
    
    # Check if restaurant name words appear in slug
    name_words = re.findall(r'[a-z0-9]+', restaurant_name.lower())
    # At least the first significant word should match
    for word in name_words:
        if len(word) > 3 and word in norm_slug:
            return True
    
    return False


def main():
    with open(DATA_JS) as f:
        content = f.read()
    
    parts = content.split('window.EAT_WELL_ART')
    json_str = parts[0].replace('window.EAT_WELL_DATA = ', '').rstrip().rstrip(';')
    data = json.loads(json_str)
    
    # Load progress
    progress = {}
    try:
        with open(PROGRESS_FILE) as f:
            progress = json.load(f)
        print(f"Resuming from {len(progress)} completed")
    except FileNotFoundError:
        pass
    
    total = 0
    updated = 0
    skipped = 0
    
    for city in data['cities']:
        city_name = city['name'].split(',')[0]
        city_id = city['id']
        
        for r in city['restaurants']:
            diets = r.get('diets', [])
            if 'vegan' not in diets and 'vegetarian' not in diets:
                continue
            
            total += 1
            key = f"{city_id}--{r['name']}"
            
            if key in progress:
                # Already processed - apply saved URL
                if progress[key]:
                    r['happycow'] = progress[key]
                    updated += 1
                else:
                    skipped += 1
                continue
            
            name = r['name']
            print(f"[{total}] Searching: {name} ({city_name})...")
            
            query = f"site:happycow.net {name} {city_name}"
            urls = firecrawl_search(query)
            
            found = None
            for url in urls:
                if is_match(name, url):
                    found = url
                    break
            
            if found:
                print(f"  Found: {found}")
                r['happycow'] = found
                progress[key] = found
                updated += 1
            else:
                print(f"  No match, keeping search URL")
                progress[key] = None
                skipped += 1
            
            # Save progress periodically
            if total % 10 == 0:
                with open(PROGRESS_FILE, 'w') as f:
                    json.dump(progress, f)
                # Also save data.js
                new_json = json.dumps(data, separators=(',', ':'))
                new_content = f"window.EAT_WELL_DATA = {new_json};\nwindow.EAT_WELL_ART{parts[1]}"
                with open(DATA_JS, 'w') as f:
                    f.write(new_content)
                print(f"  Progress saved ({total} processed)")
            
            time.sleep(1)  # Rate limiting
    
    # Final save
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f)
    
    new_json = json.dumps(data, separators=(',', ':'))
    new_content = f"window.EAT_WELL_DATA = {new_json};\nwindow.EAT_WELL_ART{parts[1]}"
    with open(DATA_JS, 'w') as f:
        f.write(new_content)
    
    print(f"\nDone!")
    print(f"Total vegan/vegetarian: {total}")
    print(f"Updated with real URLs: {updated}")
    print(f"Kept search URLs: {skipped}")


if __name__ == "__main__":
    main()
