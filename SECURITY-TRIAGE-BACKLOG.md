# Security audit remediation backlog (2026-10-21)

This is the prioritized, issue-ready backlog for [parent issue #1](https://github.com/Mike-Demo/eat-well-ai/issues/1). No findings are fixed in this triage task. The confirmed findings have separate root causes and are not grouped.

## Priority

1. **Medium — custom-listing map URL scheme.** A listing imported through the CSV flow can persist an attacker-supplied URL in the importing browser; AI search later renders it as a clickable link. Exploitation requires access to the import flow and a user clicking the link, but the stored `javascript:` URL can execute in the site origin. This is the highest-severity confirmed finding.
2. **Low — model-returned keywords in HTML.** A keyword value returned by the on-device model can be interpreted as markup when the parsed-filter echo is rendered. This is lower severity and depends on model output during a search. The fix is small and uses the existing HTML-escaping helper.

## Issue 1

**Title:** `[security][medium] Validate custom listing map_url schemes`

**Body:**

**Audit fingerprint:** `custom-listing-map-url-scheme-not-validated-stored-javascript-href`

### Evidence

`app.js` `toRestaurant()` copies `String(o.map_url || "").trim()` into the listing's `url` without validating its scheme (`app.js:71-89`). The CSV import flow parses file rows, passes each listing to `addCustomToData(o, true)`, and persists the raw object in local storage under `eatwell_custom_v1` (`app.js:238-263`; `app.js:91-100`). AI search renders that stored URL as an anchor `href` after HTML escaping (`ai-search.js:126-133`); HTML escaping does not block a `javascript:` URL. The value therefore persists in the importing browser and can execute if a user clicks the rendered link.

### Root cause

`toRestaurant()` accepts arbitrary `map_url` schemes, and the renderer treats the value as a navigable link. The CSV flow allows the value to persist across sessions in the importing browser.

### Smallest fix

In `toRestaurant()`, parse `map_url` with `new URL()` and accept it only when its protocol is `http:` or `https:`. For an invalid URL, disallowed scheme, or parse failure, use the existing generated HTTPS MapQuest search URL. Optionally validate the scheme again where `ai-search.js` renders the link as defense in depth.

**Parent issue:** [#1 — Security audit 2026-10-21](https://github.com/Mike-Demo/eat-well-ai/issues/1)

## Issue 2

**Title:** `[security][low] Escape model-returned keywords in AI search output`

**Body:**

**Audit fingerprint:** `llm-keywords-unescaped-innerhtml-ai-search`

### Evidence

`parseQuery()` allowlists diets and city but returns `keywords` as a lowercased, trimmed free-form model string (`ai-search.js:63-85`). `renderResults()` concatenates that value into the parsed-filter echo, adds the string to HTML, and assigns the result to `box.innerHTML` (`ai-search.js:109-140`). Consequently, markup in model-returned keywords is parsed as live HTML in the site origin. Sibling values in the results HTML use the existing `escapeHtml()` helper (`ai-search.js:126-132`, `143-147`).

### Root cause

The parsed-filter echo inserts untrusted model-returned keywords into an HTML string without escaping them.

### Smallest fix

Escape the parsed-filter echo before including it in the HTML assigned to `innerHTML`—at minimum escape `filters.keywords`, preferably the joined echo—or render that echo using `textContent`.

**Parent issue:** [#1 — Security audit 2026-10-21](https://github.com/Mike-Demo/eat-well-ai/issues/1)

## Issue 3

**Title:** `[security][needs-validation] Audit leads to validate`

**Body:**

Checklist of the audit lead requiring validation. No severity is assigned because the missing deployment fact determines whether this is a finding.

- [ ] **External executable scripts load in the site origin without SRI — WebLLM from jsDelivr and a mutable unpinned analytics tracker.** Audit fingerprint: `external-scripts-no-integrity-webllm-umami`. Claimed root cause: External scripts execute in the site origin without integrity binding: the WebLLM script is version-pinned but has no integrity hash, and the Umami tracker URL is unpinned and mutable with no integrity hash, while no CSP in source restricts `script-src`. **Exact missing fact to establish:** The deployed HTTP response headers for the eat-well-ai SpaceFast site are not in the repository—specifically whether any Content-Security-Policy with a restrictive `script-src` is served. `sf.jsonc` contains only access public and the space name, `index.html` has no CSP meta tag, and no `_headers` or `_redirects` file exists in the repo.

**Parent issue:** [#1 — Security audit 2026-10-21](https://github.com/Mike-Demo/eat-well-ai/issues/1)

The rejected candidate `happycow-window-open-noopener-detail` is intentionally not included for remediation because the parent issue says not to re-raise it without new evidence.
