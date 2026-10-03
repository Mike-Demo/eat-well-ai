/* Eat Well web demo: faithful port of the Tufty 2350 badge app.
 * Same screens, layout, timing, and controls as eat_well/__init__.py.
 */
(function () {
  "use strict";

  var W = 320, H = 240, HEADER_H = 30, FOOTER_H = 24, LIST_Y = 38;
  var ROWS = 5, ROW_H = 36, CITY_ROWS = 6, CITY_ROW_H = 28;
  var SPLASH_MS = 2600, SPLASH_FRAME_MS = 450;

  var BG = "#10161a", PANEL = "#1e262d", SELECT = "#26343c",
      ACCENT = "#3ecf8e", WHITE = "#ffffff", DIM = "#96a0aa",
      GOLD = "#be963c", GREEN = "#3ecf8e";

  var DIETS = [
    { key: "all", label: "All diets" },
    { key: "vegan", label: "Vegan" },
    { key: "vegetarian", label: "Vegetarian" },
    { key: "gluten-free", label: "Gluten-free" },
    { key: "kosher", label: "Kosher" },
    { key: "halal", label: "Halal" }
  ];

  var CREDITS_LINES = [
    "[EAT WELL]", "MIT License (c) 2026", "Mike Demopoulos",
    "[Made with]", "Pixel art: Adobe Firefly", "Map links: MapQuest",
    "QR codes: Segno", "Location: ipwho.is", "Badge: Tufty 2350 / Badgeware",
    "[Find me]", "github.com/Mike-Demo", "x.com/Mike_Demo",
    "instagram.com/mdemop", "threads.com/@mdemop", "mikedemo.bsky.social",
    "facebook.com/mikedemo42", "mike-demo.tumblr.com",
    "linkedin.com/in/mikedemopoulos", "mikedemo.com"
  ];
  var CREDITS_ROWS = 12;

  var DATA = window.EAT_WELL_DATA || { cities: [] };
  var ART = window.EAT_WELL_ART || {};
  var CITIES = DATA.cities;

  // --- admin ---
  // Demo-grade gate: change this password. It ships in the JS, so it keeps
  // honest visitors out of the admin panel but is not real security.
  var ADMIN_PASSWORD = "eatwell-admin";
  var CUSTOM_KEY = "eatwell_custom_v1";
  var adminOverlay = document.getElementById("adminOverlay");

  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function loadCustom() {
    try {
      var raw = localStorage.getItem(CUSTOM_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveCustom(arr) {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function findCityRef(name) {
    var n = String(name).toLowerCase().trim();
    for (var i = 0; i < CITIES.length; i++) {
      if (CITIES[i].id.toLowerCase() === n || CITIES[i].name.toLowerCase() === n) return CITIES[i];
      var al = CITIES[i].aliases || [];
      for (var j = 0; j < al.length; j++) {
        if (String(al[j]).toLowerCase() === n) return CITIES[i];
      }
    }
    return null;
  }
  function toRestaurant(o) {
    var diets = [];
    String(o.diets || "").split(/[;,]/).forEach(function (d) {
      d = d.trim().toLowerCase();
      if (["vegan", "vegetarian", "gluten-free", "kosher", "halal"].indexOf(d) !== -1 && diets.indexOf(d) === -1) diets.push(d);
    });
    if (!diets.length) diets = ["vegan"];
    var rating = parseFloat(o.rating);
    var nm = String(o.name || "").trim(), ct = String(o.city || "").trim();
    return {
      name: nm, cuisine: String(o.cuisine || "").trim() || "Restaurant",
      price: String(o.price || "").trim() || "$$", diets: diets,
      area: String(o.area || "").trim(), note: String(o.note || "").trim(),
      rating: isNaN(rating) ? null : rating, qr: null, qr_modules: 0,
      url: String(o.map_url || "").trim() ||
        "https://www.mapquest.com/search/result?query=" + encodeURIComponent(nm + " " + ct),
      happycow: "https://www.happycow.net/searchmap?query=" + encodeURIComponent(nm + " " + ct),
      _custom: true, _city: ct
    };
  }
  function addCustomToData(o, persist) {
    var r = toRestaurant(o);
    if (!r.name || !r._city) return null;
    var city = findCityRef(r._city);
    if (!city) {
      city = { id: slugify(r._city) || "custom", name: r._city, aliases: [], restaurants: [], _customCity: true };
      CITIES.push(city);
    }
    city.restaurants.push(r);
    if (persist) { var arr = loadCustom(); arr.push(o); saveCustom(arr); }
    return r;
  }
  function deleteCustom(idx) {
    var arr = loadCustom();
    var removed = arr.splice(idx, 1)[0];
    saveCustom(arr);
    if (removed) {
      var r = toRestaurant(removed), city = findCityRef(r._city);
      if (city) {
        for (var i = city.restaurants.length - 1; i >= 0; i--) {
          if (city.restaurants[i]._custom && city.restaurants[i].name === r.name) city.restaurants.splice(i, 1);
        }
        if (city._customCity && !city.restaurants.length) {
          var ci = CITIES.indexOf(city);
          if (ci !== -1) CITIES.splice(ci, 1);
        }
      }
    }
    renderCustomList();
  }
  // Merge this browser's custom listings at load.
  loadCustom().forEach(function (o) { addCustomToData(o, false); });

  function isAdminOpen() { return adminOverlay && !adminOverlay.hidden; }
  function openAdmin() {
    if (!adminOverlay) return;
    adminOverlay.hidden = false;
    var authed = false;
    try { authed = sessionStorage.getItem("ew_admin") === "1"; } catch (e) {}
    if (authed) {
      document.getElementById("adminLogin").hidden = true;
      document.getElementById("adminMain").hidden = false;
      renderCustomList(); fillCityDatalist();
      return;
    }
    document.getElementById("adminLogin").hidden = false;
    document.getElementById("adminMain").hidden = true;
    document.getElementById("adminPass").value = "";
    document.getElementById("adminErr").hidden = true;
    setTimeout(function () { document.getElementById("adminPass").focus(); }, 60);
  }
  function closeAdmin() { if (adminOverlay) adminOverlay.hidden = true; }
  function fillCityDatalist() {
    var dl = document.getElementById("cityList");
    if (!dl) return;
    dl.innerHTML = "";
    CITIES.forEach(function (c) {
      var op = document.createElement("option"); op.value = c.name; dl.appendChild(op);
    });
  }
  function renderCustomList() {
    var arr = loadCustom();
    var count = document.getElementById("adminCount");
    if (count) count.textContent = arr.length ? "(" + arr.length + ")" : "";
    var box = document.getElementById("customList");
    if (!box) return;
    box.innerHTML = "";
    if (!arr.length) { box.innerHTML = '<p class="admin-p">No custom listings yet.</p>'; return; }
    arr.forEach(function (o, i) {
      var r = toRestaurant(o);
      var div = document.createElement("div"); div.className = "clist-item";
      var info = document.createElement("div");
      var nm = document.createElement("div"); nm.className = "clist-name"; nm.textContent = r.name;
      var mt = document.createElement("div"); mt.className = "clist-meta";
      mt.textContent = r._city + " · " + r.diets.join(", ");
      info.appendChild(nm); info.appendChild(mt);
      var del = document.createElement("button"); del.className = "clist-del"; del.textContent = "Delete";
      del.addEventListener("click", function () { deleteCustom(i); });
      div.appendChild(info); div.appendChild(del);
      box.appendChild(div);
    });
  }
  function parseCSV(text) {
    var rows = [], row = [], field = "", inQ = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
        } else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function wireAdmin() {
    if (!adminOverlay) return;
    var go = document.getElementById("adminGo");
    function tryLogin() {
      var ok = val("adminPass") === ADMIN_PASSWORD;
      document.getElementById("adminErr").hidden = ok;
      if (!ok) return;
      document.getElementById("adminLogin").hidden = true;
      document.getElementById("adminMain").hidden = false;
      renderCustomList(); fillCityDatalist();
    }
    go.addEventListener("click", tryLogin);
    document.getElementById("adminPass").addEventListener("keydown", function (e) {
      if (e.key === "Enter") tryLogin();
      e.stopPropagation();
    });
    document.getElementById("adminClose").addEventListener("click", closeAdmin);
    adminOverlay.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAdmin();
      e.stopPropagation();
    });
    document.querySelectorAll(".admin-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".admin-tab").forEach(function (t) { t.classList.remove("on"); });
        tab.classList.add("on");
        ["manual", "csv", "list"].forEach(function (n) {
          document.getElementById("tab-" + n).hidden = (n !== tab.dataset.tab);
        });
      });
    });
    document.getElementById("manualForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var diets = [];
      document.querySelectorAll('#manualForm input[name="diet"]:checked').forEach(function (el) { diets.push(el.value); });
      var o = {
        name: val("mName"), city: val("mCity"), cuisine: val("mCuisine"), price: val("mPrice"),
        diets: diets.join(";"), area: val("mArea"), note: val("mNote"),
        rating: val("mRating"), map_url: val("mUrl")
      };
      var msg = document.getElementById("manualMsg");
      if (!o.name || !o.city) { msg.textContent = "Name and city are required."; msg.hidden = false; return; }
      addCustomToData(o, true);
      msg.textContent = "Added \u201C" + o.name + "\u201D \u2014 it is live in the app now.";
      msg.hidden = false;
      this.reset();
      renderCustomList(); fillCityDatalist();
    });
    document.getElementById("csvImport").addEventListener("click", function () {
      var file = document.getElementById("csvFile").files[0];
      var msg = document.getElementById("csvMsg");
      msg.hidden = true;
      if (!file) { msg.textContent = "Choose a CSV file first."; msg.hidden = false; return; }
      var reader = new FileReader();
      reader.onload = function () {
        var rows = parseCSV(String(reader.result || ""));
        if (!rows.length) { msg.textContent = "That file looks empty."; msg.hidden = false; return; }
        var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
        var missing = ["name", "city"].filter(function (n) { return header.indexOf(n) === -1; });
        if (missing.length) { msg.textContent = "Missing column(s): " + missing.join(", ") + "."; msg.hidden = false; return; }
        var added = 0, skipped = 0, i, j;
        for (i = 1; i < rows.length; i++) {
          var o = {};
          for (j = 0; j < header.length; j++) o[header[j]] = (rows[i][j] || "").trim();
          if (!o.name || !o.city) { skipped++; continue; }
          addCustomToData(o, true); added++;
        }
        msg.textContent = "Imported " + added + " listing" + (added === 1 ? "" : "s") +
          (skipped ? " (" + skipped + " skipped, missing name/city)." : ". They are live in the app now.");
        msg.hidden = false;
        document.getElementById("csvFile").value = "";
        renderCustomList(); fillCityDatalist();
      };
      reader.readAsText(file);
    });
    document.getElementById("exportJson").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(loadCustom(), null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "eat-well-custom-listings.json";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    });
  }
  wireAdmin();

  // --- state ---
  var screenId = "splash";
  var splashStart = performance.now();
  var cityIdx = 0, cityRow = 0, cityTop = 0;
  var dietIdx = 0, listIdx = 0, listTop = 0;
  var results = [], noticeLines = [], creditsTop = 0;
  var locating = false;

  // --- canvas ---
  var canvas = document.getElementById("screen");
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  var FONT = '8px "Press Start 2P", monospace';

  // HappyCow badge click handler
  canvas.addEventListener("click", function (e) {
    if (window._hcRegion && screenId === "detail") {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      var x = (e.clientX - rect.left) * scaleX;
      var y = (e.clientY - rect.top) * scaleY;
      var r = window._hcRegion;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        window.open(r.url, "_blank");
      }
    }
  });
  // Clear HappyCow region when leaving detail screen
  var _origScreenId = null;

  var images = {};
  function loadImage(src) {
    if (images[src]) return images[src];
    var img = new Image();
    img.src = src;
    images[src] = img;
    return img;
  }
  Object.keys(ART).forEach(function (k) { loadImage(ART[k]); });

  function drawIcon(key, x, y, size) {
    var img = images[ART[key]];
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x, y, size, size);
  }

  function text(s, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }

  function wrap(str, width) {
    var words = str.split(" "), lines = [], line = "";
    words.forEach(function (word) {
      while (word.length > width) {  // hard-break words longer than the width
        if (line) { lines.push(line); line = ""; }
        lines.push(word.slice(0, width));
        word = word.slice(width);
      }
      var piece = line ? line + " " + word : word;
      if (piece.length <= width) { line = piece; }
      else { if (line) lines.push(line); line = word; }
    });
    if (line) lines.push(line);
    return lines;
  }

  function header(title) {
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, W, HEADER_H);
    text("EAT WELL", 10, 9, ACCENT);
    text(title, 112, 9, DIM);
  }

  function footer(hint) {
    ctx.fillStyle = PANEL; ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
    text(hint, 10, H - FOOTER_H + 8, DIM);
  }

  function currentDiet() { return DIETS[dietIdx]; }

  function applyFilter() {
    var key = currentDiet().key;
    var spots = CITIES[cityIdx].restaurants;
    results = key === "all" ? spots.slice() : spots.filter(function (r) {
      return r.diets.indexOf(key) !== -1;
    });
    listIdx = 0; listTop = 0;
  }

  function showNotice(message) {
    noticeLines = wrap(message, 37);
    screenId = "notice";
  }

  function locateCity() {
    // Same as the badge: IP geolocation via ipwho.is, matched to the guide.
    showNotice("Detecting location...");
    locating = true;
    fetch("https://ipwho.is/")
      .then(function (resp) { return resp.json(); })
      .then(function (data) {
        locating = false;
        if (!data.success) { showNotice("Location lookup failed."); return; }
        var detected = (data.city || "").trim().toLowerCase();
        for (var i = 0; i < CITIES.length; i++) {
          var names = [CITIES[i].name.toLowerCase()];
          (CITIES[i].aliases || []).forEach(function (a) { names.push(a.toLowerCase()); });
          for (var j = 0; j < names.length; j++) {
            if (detected && (detected.indexOf(names[j]) !== -1 || names[j].indexOf(detected) !== -1)) {
              cityIdx = i; dietIdx = 0; screenId = "diet"; return;
            }
          }
        }
        showNotice("Near: " + (data.city || "Unknown") + ". Not in the guide yet.");
      })
      .catch(function () { locating = false; showNotice("Location unavailable. Check connection."); });
  }

  // --- screens ---
  function drawSplash(now) {
    var frame = Math.floor((now - splashStart) / SPLASH_FRAME_MS) % 4;
    var img = images[ART["splash-" + (frame + 1)]];
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, W, H);
  }

  function drawCity() {
    header("Choose a city");
    var y = LIST_Y, i, row, city;
    if (cityTop === 0) {
      if (cityRow === 0) {
        ctx.fillStyle = SELECT; ctx.fillRect(6, y - 4, W - 12, 24);
        text(">", 12, y, ACCENT);
      }
      ctx.fillStyle = GREEN;
      ctx.beginPath(); ctx.arc(24, y + 4, 6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(24, y + 4, 2, 0, 7); ctx.fill();
      text("Near me", 40, y, cityRow === 0 ? WHITE : DIM);
      text("detect my city", 210, y, DIM);
      y += CITY_ROW_H;
    }
    for (i = Math.max(0, cityTop - 1); i < Math.min(CITIES.length, cityTop + CITY_ROWS - 1); i++) {
      row = i + 1;
      if (row === cityRow) {
        ctx.fillStyle = SELECT; ctx.fillRect(6, y - 4, W - 12, 24);
        text(">", 12, y, ACCENT);
      }
      city = CITIES[i];
      drawIcon("city-" + city.id, 26, y - 4, 24);
      text(city.name, 56, y, row === cityRow ? WHITE : DIM);
      text(city.restaurants.length + " spots", 218, y, DIM);
      y += CITY_ROW_H;
    }
    var creditsRow = CITIES.length + 1;
    if (cityTop <= creditsRow && creditsRow < cityTop + CITY_ROWS) {
      if (creditsRow === cityRow) {
        ctx.fillStyle = SELECT; ctx.fillRect(6, y - 4, W - 12, 24);
        text(">", 12, y, ACCENT);
      }
      text("Credits", 56, y, creditsRow === cityRow ? WHITE : DIM);
      text("license & sources", 200, y, DIM);
      y += CITY_ROW_H;
    }
    var rows = CITIES.length + 2;
    if (rows > CITY_ROWS) {
      text((cityTop + 1) + "-" + Math.min(cityTop + CITY_ROWS, rows) + " of " + rows,
           12, H - FOOTER_H - 14, DIM);
    }
    footer("UP/DN move   A select");
  }

  function drawNotice() {
    header("Near me");
    var y = 90;
    noticeLines.forEach(function (line) { text(line, 20, y, DIM); y += 15; });
    footer("B back");
  }

  function drawDiet() {
    header("Filter by diet");
    var y = LIST_Y;
    DIETS.forEach(function (diet, i) {
      if (i === dietIdx) { ctx.fillStyle = SELECT; ctx.fillRect(6, y - 6, W - 12, 26); }
      drawIcon("diet-" + diet.key, 16, y - 4, 24);
      text(diet.label, 48, y, i === dietIdx ? WHITE : DIM);
      y += 30;
    });
    footer("UP/DN move   A select   B back");
  }

  function drawList() {
    header(CITIES[cityIdx].name + " / " + currentDiet().label);
    if (!results.length) {
      text("No matches for this filter.", 20, 90, DIM);
      text("Press B and try another diet.", 20, 106, DIM);
    } else {
      var y = LIST_Y, i, spot, name, ix, k;
      for (i = listTop; i < Math.min(listTop + ROWS, results.length); i++) {
        spot = results[i];
        if (i === listIdx) { ctx.fillStyle = SELECT; ctx.fillRect(6, y - 4, W - 12, ROW_H); }
        name = spot.name.length > 28 ? spot.name.slice(0, 27) + "..." : spot.name;
        text(name, 12, y, i === listIdx ? WHITE : DIM);
        text(spot.cuisine + "  " + spot.price, 12, y + 14, DIM);
        text("RT " + (spot.rating != null ? spot.rating : "-"), 200, y + 14, DIM);
        ix = 308;
        for (k = 0; k < spot.diets.length; k++) {
          drawIcon("diet-" + spot.diets[k], ix - 12, y + 6, 12);
          ix -= 16;
        }
        y += ROW_H;
      }
      if (results.length > ROWS) {
        text((listTop + 1) + "-" + Math.min(listTop + ROWS, results.length) +
             " of " + results.length, 12, H - FOOTER_H - 14, DIM);
      }
    }
    footer("UP/DN scroll   A details   B back");
  }

  var qrImg = null, qrSrc = null;
  var DISCLAIMER_Y = H - FOOTER_H - 14;
  function drawDetail() {
    var spot = results[listIdx];
    // QR geometry first, so text can keep clear of it (mirrors the badge).
    var modules = spot.qr_modules || 25;
    var total = (modules + 4) * 2;
    var qrX = spot.qr ? W - total - 8 : W;
    var qrY0 = H - FOOTER_H - total - 6;
    header("Details");
    var y = LIST_Y;
    wrap(spot.name, 36).forEach(function (line) { text(line, 12, y, WHITE); y += 14; });
    text(spot.cuisine + "  " + spot.price + "  RT " + (spot.rating != null ? spot.rating : "-"), 12, y, DIM);
    y += 16;
    text(spot.area, 12, y, DIM);
    y += 20;
    text("Good for:", 12, y, ACCENT);
    y += 16;
    spot.diets.forEach(function (key) {
      var diet = DIETS.filter(function (d) { return d.key === key; })[0] || DIETS[0];
      drawIcon("diet-" + key, 14, y - 1, 12);
      text(diet.label, 34, y, WHITE);
      y += 20;
    });
    y += 4;
    // Note: wrap narrow enough to clear the QR, stop above the disclaimer.
    var noteWidth = spot.qr ? Math.floor((qrX - 12 - 8) / 8) : 34;
    var maxLines = Math.max(0, Math.floor((DISCLAIMER_Y - 6 - y) / 13));
    var noteLines = wrap(spot.note, noteWidth);
    var shown = noteLines.slice(0, maxLines);
    if (noteLines.length > maxLines && shown.length) {
      shown[shown.length - 1] = shown[shown.length - 1].slice(0, Math.max(0, noteWidth - 3)) + "...";
    }
    shown.forEach(function (line) { text(line, 12, y, DIM); y += 13; });

    if (spot.qr) {
      if (qrSrc !== spot.qr) { qrSrc = spot.qr; qrImg = loadImage(spot.qr); }
      var img = qrImg;
      if (img.complete && img.naturalWidth) {
        ctx.fillStyle = WHITE; ctx.fillRect(qrX, qrY0, total, total);
        ctx.drawImage(img, qrX + 4, qrY0 + 4, modules * 2, modules * 2);
      }
    }
    text("Menus change, verify directly", 12, DISCLAIMER_Y, GOLD);
    // HappyCow badge - only for verified /reviews/ listings, not search URLs
    if (spot.happycow && spot.happycow.indexOf("/reviews/") !== -1) {
      var hcSize = 24;
      var hcX = 12, hcY = DISCLAIMER_Y - hcSize - 2;
      var hcImg = loadImage("assets/art/happycow.png");
      if (hcImg.complete && hcImg.naturalWidth) {
        ctx.drawImage(hcImg, hcX, hcY, hcSize, hcSize);
      } else {
        // Fallback text badge while image loads
        ctx.fillStyle = "#6B4C9A";
        ctx.fillRect(hcX, hcY, 110, 16);
        ctx.fillStyle = WHITE;
        ctx.font = "8px monospace";
        ctx.fillText("HappyCow listing >", hcX + 6, hcY + 4);
        ctx.font = FONT;
      }
      // Store clickable region
      window._hcRegion = {x: hcX, y: hcY, w: hcSize, h: hcSize, url: spot.happycow};
    }
    footer("B back   Scan QR for map");
  }

  function drawCredits() {
    header("Credits");
    var y = LIST_Y, shown = 0, style = DIM;
    for (var n = creditsTop; n < CREDITS_LINES.length && shown < CREDITS_ROWS; n++) {
      var line = CREDITS_LINES[n];
      if (line.charAt(0) === "[") {
        text(line.slice(1, -1), 12, y, ACCENT);
        style = line.indexOf("Find me") !== -1 ? WHITE : DIM;
      } else {
        text(line, 12, y, style);
      }
      y += 14; shown++;
    }
    if (CREDITS_LINES.length > CREDITS_ROWS) {
      text((creditsTop + 1) + "-" + Math.min(creditsTop + CREDITS_ROWS, CREDITS_LINES.length) +
           " of " + CREDITS_LINES.length, 12, H - FOOTER_H - 14, DIM);
    }
    footer("UP/DN scroll   A admin   B back");
  }

  // --- input ---
  var pressedSet = {};
  function press(btn) { pressedSet[btn] = true; }
  function pressed(btn) {
    if (btn === undefined) {
      for (var k in pressedSet) if (pressedSet[k]) return true;
      return false;
    }
    return !!pressedSet[btn];
  }

  document.querySelectorAll(".btn").forEach(function (el) {
    el.addEventListener("pointerdown", function (e) { e.preventDefault(); press(el.dataset.btn); });
  });
  var keyMap = {
    ArrowUp: "up", ArrowDown: "down",
    z: "a", Z: "a", Enter: "a",
    x: "b", X: "b", Escape: "b",
    c: "c", C: "c"
  };
  document.addEventListener("keydown", function (e) {
    if (isAdminOpen()) return; // typing in the admin panel
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    var btn = keyMap[e.key];
    if (btn) { e.preventDefault(); press(btn); }
  });

  // --- main loop (mirrors badge run(update)) ---
  function update(now) {
    if (screenId === "splash") {
      if (pressed() || now - splashStart > SPLASH_MS) screenId = "city";
    } else if (screenId === "city") {
      var rows = CITIES.length + 2;
      if (pressed("up")) cityRow = (cityRow - 1 + rows) % rows;
      else if (pressed("down")) cityRow = (cityRow + 1) % rows;
      if (cityRow < cityTop) cityTop = cityRow;
      else if (cityRow >= cityTop + CITY_ROWS) cityTop = cityRow - CITY_ROWS + 1;
      if (pressed("a")) {
        if (cityRow === 0) locateCity();
        else if (cityRow === CITIES.length + 1) { creditsTop = 0; screenId = "credits"; }
        else { cityIdx = cityRow - 1; dietIdx = 0; screenId = "diet"; }
      }
    } else if (screenId === "diet") {
      if (pressed("up")) dietIdx = (dietIdx - 1 + DIETS.length) % DIETS.length;
      else if (pressed("down")) dietIdx = (dietIdx + 1) % DIETS.length;
      else if (pressed("a")) { applyFilter(); screenId = "list"; }
      else if (pressed("b") || pressed("c")) screenId = "city";
    } else if (screenId === "list") {
      if (results.length) {
        if (pressed("up")) {
          listIdx = (listIdx - 1 + results.length) % results.length;
          if (listIdx < listTop) listTop = listIdx;
        } else if (pressed("down")) {
          listIdx = (listIdx + 1) % results.length;
          if (listIdx >= listTop + ROWS) listTop = listIdx - ROWS + 1;
        } else if (pressed("a")) screenId = "detail";
      }
      if (pressed("b") || pressed("c")) screenId = "diet";
    } else if (screenId === "detail") {
      if (pressed("a") || pressed("b") || pressed("c")) { screenId = "list"; window._hcRegion = null; }
    } else if (screenId === "notice") {
      if (!locating && (pressed("a") || pressed("b") || pressed("c"))) screenId = "city";
    } else if (screenId === "credits") {
      var maxTop = Math.max(0, CREDITS_LINES.length - CREDITS_ROWS);
      if (pressed("up")) creditsTop = Math.max(0, creditsTop - 1);
      else if (pressed("down")) creditsTop = Math.min(maxTop, creditsTop + 1);
      if (pressed("a")) openAdmin();
      else if (pressed("b") || pressed("c")) screenId = "city";
    }

    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    ctx.font = FONT; ctx.textBaseline = "top";
    if (screenId === "splash") drawSplash(now);
    else if (screenId === "city") drawCity();
    else if (screenId === "diet") drawDiet();
    else if (screenId === "list") drawList();
    else if (screenId === "detail") drawDetail();
    else if (screenId === "notice") drawNotice();
    else if (screenId === "credits") drawCredits();

    pressedSet = {};
    requestAnimationFrame(update);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { requestAnimationFrame(update); });
  } else {
    requestAnimationFrame(update);
  }
})();
