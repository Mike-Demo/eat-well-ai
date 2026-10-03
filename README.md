# Eat Well AI

Natural-language restaurant search for people with dietary needs, powered by **Qwen3 running entirely in the browser**.

Built for the [Hacktoberfest DEV Weekend Challenge](https://dev.to) (October 2026).

## The story

Eat Well started with a real problem: Demo's friend **Miriam** keeps kosher and has trouble finding places to eat. Demo is vegan, and they eat out together often. The original [Eat Well](https://github.com/Mike-Demo/eat-well) is a dietary restaurant finder for the Pimoroni Tufty 2350 badge — 557 curated vegan, vegetarian, gluten-free, kosher, and halal restaurants across 14 US cities.

But the badge can't run AI. So this companion asks: *what if you could just describe what you want?*

> "vegan pizza in Chicago"
> "kosher in Miami"
> "gluten free tacos"

Type it in plain English. **Qwen3-0.6B** — the open-source model from Alibaba's Qwen team — parses your query into structured filters right on your device, and the app searches the full restaurant database instantly.

## Open-source AI at its core

- **Qwen3** (Apache 2.0) runs via [WebLLM](https://github.com/mlc-ai/web-llm) using WebGPU. No server, no API key, no data leaves your browser.
- The model downloads once (~400MB) and then works offline.
- Query parsing is the AI's job: diets, city, and cuisine keywords are extracted from natural language, then applied to the local dataset.
- Everything else — the 1017-restaurant database, the MapQuest links, the UI — is MIT licensed in this repo.

## The dataset

1017 restaurants across 37 cities (14 US + 5 Canadian + 5 UK + 13 additional US), each tagged for vegan, vegetarian, gluten-free, kosher, and halal options. 543 have specific MapQuest listing URLs; 460 use MapQuest search links.

Menus change. Verify dietary needs directly with the restaurant.

## Run it

This is a static site. Serve it locally:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000 in Chrome or Edge (WebGPU required for Qwen3).

## How it works

1. `ai-search.js` loads Qwen3-0.6B via WebLLM on page load.
2. Your query goes to Qwen with a system prompt that constrains output to a JSON filter object: `{diets, city, keywords}`.
3. The filters are applied to `data.js` (the full restaurant database) with plain JavaScript.
4. Results render as cards with MapQuest links.

The badge demo below the search box is the original Tufty 2350 app running in a canvas — same code, same pixel art.

## Credits

- Qwen3 by Alibaba Cloud (Apache 2.0)
- WebLLM by MLC AI
- MapQuest for listing data
- Segno for QR codes
- Pixel art made with Adobe Firefly

MIT License — see LICENSE.md.
