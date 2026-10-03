/* Eat Well AI: natural-language restaurant search powered by Qwen.
 *
 * Qwen3-0.6B runs entirely in the browser via WebLLM (WebGPU) — no server,
 * no API key, no data leaves the device. It parses a plain-English query
 * into structured filters, which are applied to the local 557-restaurant
 * dataset.
 *
 * Example: "vegan pizza in Chicago" -> {diets:["vegan"], city:"chicago", keywords:"pizza"}
 */
(function () {
  "use strict";

  var MODEL_ID = "Qwen3-0.6B-q4f16_1-MLC";
  var engine = null;
  var engineLoading = null;

  var DIET_KEYS = ["vegan", "vegetarian", "gluten-free", "kosher", "halal"];
  var CITY_IDS = (window.EAT_WELL_DATA || { cities: [] }).cities.map(function (c) { return c.id; });
  var CITY_NAMES = (window.EAT_WELL_DATA || { cities: [] }).cities.map(function (c) { return c.name; });

  var SYSTEM_PROMPT = [
    "You parse restaurant search queries into JSON. Reply with ONLY a JSON object, no other text.",
    "Schema: {\"diets\": [...], \"city\": \"...\"|null, \"keywords\": \"...\"}",
    "- diets: subset of [\"vegan\", \"vegetarian\", \"gluten-free\", \"kosher\", \"halal\"].",
    "  Map: plant-based/veggie->vegetarian, strictly vegan/no animal products->vegan,",
    "  celiac/no gluten->gluten-free, jewish dietary law->kosher, muslim dietary law->halal.",
    "- city: one of [" + CITY_IDS.join(", ") + "], or null if none mentioned.",
    "  Map common names: SF->san-francisco, NYC/New York City->new-york, LA->los-angeles,",
    "  Twin Cities/Minneapolis/St Paul->twin-cities, DC/Washington->washington-dc,",
    "  Vegas->las-vegas.",
    "- keywords: food/cuisine words from the query (e.g. \"pizza\", \"tacos\", \"sushi\", \"ramen\"),",
    "  or empty string. Lowercase, space-separated.",
    "Examples:",
    "  \"vegan pizza in Chicago\" -> {\"diets\":[\"vegan\"],\"city\":\"chicago\",\"keywords\":\"pizza\"}",
    "  \"kosher\" -> {\"diets\":[\"kosher\"],\"city\":null,\"keywords\":\"\"}",
    "  \"gluten free tacos\" -> {\"diets\":[\"gluten-free\"],\"city\":null,\"keywords\":\"tacos\"}",
    "  \"halal food near me in Houston\" -> {\"diets\":[\"halal\"],\"city\":\"houston\",\"keywords\":\"\"}"
  ].join("\n");

  function log(msg) {
    var el = document.getElementById("ai-status");
    if (el) el.textContent = msg;
  }

  function loadEngine() {
    if (engine) return Promise.resolve(engine);
    if (engineLoading) return engineLoading;
    log("Loading Qwen3 (first run downloads ~400MB)...");
    engineLoading = window.webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: function (p) { log("Loading Qwen3: " + p.text); }
    }).then(function (e) {
      engine = e;
      log("Qwen3 ready. Ask me anything.");
      return e;
    }).catch(function (err) {
      log("Could not load Qwen3: " + (err && err.message ? err.message : err));
      engineLoading = null;
      throw err;
    });
    return engineLoading;
  }

  function parseQuery(query) {
    return loadEngine().then(function (e) {
      log("Qwen3 is thinking...");
      return e.chat.completions.create({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query }
        ],
        temperature: 0.1,
        max_tokens: 128
      });
    }).then(function (resp) {
      var text = resp.choices[0].message.content.trim();
      // Extract the first {...} block in case of stray text
      var m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("no JSON in model reply");
      var parsed = JSON.parse(m[0]);
      return {
        diets: (parsed.diets || []).filter(function (d) { return DIET_KEYS.indexOf(d) >= 0; }),
        city: CITY_IDS.indexOf(parsed.city) >= 0 ? parsed.city : null,
        keywords: String(parsed.keywords || "").toLowerCase().trim()
      };
    });
  }

  function searchRestaurants(filters) {
    var data = window.EAT_WELL_DATA || { cities: [] };
    var kw = filters.keywords.split(/\s+/).filter(Boolean);
    var out = [];
    data.cities.forEach(function (city) {
      if (filters.city && city.id !== filters.city) return;
      city.restaurants.forEach(function (r) {
        for (var i = 0; i < filters.diets.length; i++) {
          if (!r.diets || r.diets.indexOf(filters.diets[i]) < 0) return;
        }
        if (kw.length) {
          var hay = (r.name + " " + (r.cuisine || "") + " " + (r.tags || []).join(" ")).toLowerCase();
          var hit = kw.some(function (k) { return hay.indexOf(k) >= 0; });
          if (!hit) return;
        }
        out.push({ city: city, r: r });
      });
    });
    return out;
  }

  function renderResults(filters, results) {
    var box = document.getElementById("ai-results");
    if (!box) return;
    var bits = [];
    if (filters.diets.length) bits.push("diets: " + filters.diets.join(", "));
    if (filters.city) {
      var cn = CITY_NAMES[CITY_IDS.indexOf(filters.city)] || filters.city;
      bits.push("city: " + cn);
    }
    if (filters.keywords) bits.push("keywords: \"" + filters.keywords + "\"");
    var html = "<div class=\"ai-parsed\">Qwen3 parsed: " +
      (bits.length ? bits.join(" · ") : "no filters") +
      " — " + results.length + " match" + (results.length === 1 ? "" : "es") + "</div>";
    if (!results.length) {
      html += "<div class=\"ai-empty\">No matches. Try fewer filters or a different city.</div>";
    } else {
      html += "<div class=\"ai-list\">";
      results.slice(0, 24).forEach(function (hit) {
        var r = hit.r;
        var diets = (r.diets || []).join(", ");
        html += "<div class=\"ai-card\">" +
          "<div class=\"ai-name\">" + escapeHtml(r.name) + "</div>" +
          "<div class=\"ai-meta\">" + escapeHtml(hit.city.name) + " · " + escapeHtml(diets) + "</div>" +
          (r.url ? "<div class=\"ai-link\"><a href=\"" + escapeHtml(r.url) + "\" target=\"_blank\" rel=\"noopener\">MapQuest listing</a></div>" : "") +
          "</div>";
      });
      if (results.length > 24) {
        html += "<div class=\"ai-more\">+" + (results.length - 24) + " more — refine your query</div>";
      }
      html += "</div>";
    }
    box.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function onAsk() {
    var input = document.getElementById("ai-input");
    var q = (input.value || "").trim();
    if (!q) { log("Type a query first, e.g. \"vegan pizza in Chicago\"."); return; }
    log("Parsing with Qwen3...");
    parseQuery(q).then(function (filters) {
      var results = searchRestaurants(filters);
      renderResults(filters, results);
      log("Qwen3 ready. Ask me anything.");
    }).catch(function (err) {
      log("Sorry, that didn't parse. Try again. (" + (err && err.message ? err.message : err) + ")");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("ai-ask");
    var input = document.getElementById("ai-input");
    if (!btn || !input) return;
    btn.addEventListener("click", onAsk);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") onAsk();
    });
    // Warm up the model in the background so the first query is fast
    if (window.webllm && navigator.gpu) {
      loadEngine().catch(function () { /* status line already updated */ });
    } else if (!navigator.gpu) {
      log("WebGPU is not available in this browser, so Qwen3 can't run here. Try Chrome or Edge on desktop.");
    }
  });
})();
