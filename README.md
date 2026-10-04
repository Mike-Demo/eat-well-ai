# Eat Well AI

Natural-language restaurant search for people with dietary needs. Qwen3 runs everything in your browser.

Built for the [Hacktoberfest DEV Weekend Challenge](https://dev.to) (October 2026).

## The story

Demo's friend Miriam keeps kosher and struggles to find places to eat. Demo is vegan, and they eat out together often. The original [Eat Well](https://github.com/Mike-Demo/eat-well) is a dietary restaurant finder for the Pimoroni Tufty 2350 badge: 557 curated vegan, vegetarian, gluten-free, kosher, and halal restaurants across 14 US cities.

The badge can't run AI. This companion lets you describe what you want instead of tapping through filters:

> "vegan pizza in Chicago"
> "kosher in Miami"
> "gluten-free tacos"

Type that in plain English. Qwen3-0.6B, Alibaba's open-source model, turns your words into structured filters on your device, and the app searches the full restaurant database instantly.

## Open-source AI at its core

- Qwen3 (Apache 2.0) runs via [WebLLM](https://github.com/mlc-ai/web-llm) using WebGPU. No server, no API key, nothing leaves your browser.
- The model downloads once (~400MB), then works offline.
- Qwen pulls diets, city, and cuisine keywords out of your sentence, and the app applies them to the local dataset.
- The 1017-restaurant database, the MapQuest links, and the UI are MIT licensed in this repo.

## The dataset

1017 restaurants across 37 cities (14 US + 5 Canadian + 5 UK + 13 additional US), each tagged for vegan, vegetarian, gluten-free, kosher, and halal options. 543 link to specific MapQuest listings; 460 use MapQuest search links.

Menus change. Verify dietary needs directly with the restaurant.

## Run it

Static site. Serve it locally:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000 in Chrome or Edge (WebGPU required for Qwen3).

## How it works

1. `ai-search.js` loads Qwen3-0.6B via WebLLM on page load.
2. Your query goes to Qwen with a system prompt that shapes its answer into a JSON filter object: `{diets, city, keywords}`.
3. Plain JavaScript applies the filters to `data.js`, the full restaurant database.
4. Results render as cards with MapQuest links.

Below the search box, the original Tufty 2350 app runs in a canvas. Same code, same pixel art.

## Credits

- Qwen3 by Alibaba Cloud (Apache 2.0)
- WebLLM by MLC AI
- MapQuest for listing data
- Segno for QR codes
- Pixel art made with Adobe Firefly

MIT License. See LICENSE.md.
