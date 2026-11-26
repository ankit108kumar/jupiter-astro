/* =========================================================
   JUPITER ASTRO — TRANSIT TIMELINE FLOATING WINDOW
   Shortcut: Ctrl + Shift + X (Cmd + Option + T on Mac)
   Step 1: Library-style window shell and appearance modes.
   Step 2: Login-gated date/time controls tied to the active
           Research Kundali evaluation timestamp.
   ========================================================= */
(function () {
  "use strict";

  if (window.__JA_TRANSIT_TIMELINE_LOADED) return;
  window.__JA_TRANSIT_TIMELINE_LOADED = true;

  function ensureInfoToastService() {
    if (window.JAInfoToast && typeof window.JAInfoToast.show === "function") return window.JAInfoToast;
    var node = null, timer = null;
    function hide() {
      if (timer) window.clearTimeout(timer);
      timer = null;
      if (!node) return;
      node.classList.remove("is-visible");
      if (typeof node.hidePopover === "function") {
        try { if (node.matches(":popover-open")) node.hidePopover(); } catch (error) {}
      }
    }
    function promote() {
      if (!node || !node.classList.contains("is-visible") || typeof node.showPopover !== "function") return;
      try { if (node.matches(":popover-open")) node.hidePopover(); node.showPopover(); } catch (error) {}
    }
    function show(message, options) {
      options = options || {};
      if (!node || !node.isConnected) {
        node = document.createElement("div");
        node.className = "ja-info-toast";
        node.setAttribute("popover", "manual");
        node.setAttribute("role", "status");
        node.setAttribute("aria-live", "polite");
        document.body.appendChild(node);
      }
      node.textContent = String(message || "");
      node.classList.toggle("is-warning", options.variant === "warning");
      node.classList.remove("is-visible");
      if (typeof node.showPopover === "function") {
        try { if (node.matches(":popover-open")) node.hidePopover(); node.showPopover(); } catch (error) {}
      }
      void node.offsetWidth;
      node.classList.add("is-visible");
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(hide, Math.max(500, Number(options.duration) || 2000));
    }
    document.addEventListener("fullscreenchange", function () {
      if (node && node.classList.contains("is-visible")) window.requestAnimationFrame(promote);
    });
    window.addEventListener("pagehide", hide);
    window.JAInfoToast = { show: show, hide: hide };
    return window.JAInfoToast;
  }

  var WINDOW_ID = "ja-transit-timeline-window";
  var LAUNCHER_ID = "ja-transit-timeline-launcher";
  var THEME_KEY = "ja-transit-timeline-theme-mode";
  var windowEl = null;
  var launcher = null;
  var maximized = false;
  var previousBounds = null;
  var dragState = null;
  var themeMode = "website";
  var authPrompt = null;
  var moonTransitMatrix = null;
  var moonTransitMatrixPromise = null;
  var moonTransitMatrixLoadFailed = false;

  try {
    themeMode = localStorage.getItem(THEME_KEY) === "apple" ? "apple" : "website";
  } catch (error) {}

  function loadMoonTransitMatrix() {
    if (moonTransitMatrix) return Promise.resolve(moonTransitMatrix);
    if (moonTransitMatrixPromise) return moonTransitMatrixPromise;
    if (moonTransitMatrixLoadFailed) return Promise.resolve(null);
    moonTransitMatrixPromise = fetch("/data/moon_nakshatra_transit_matrix.json", {
      credentials: "same-origin",
      cache: "force-cache"
    }).then(function (response) {
      if (!response.ok) throw new Error("Moon transit matrix HTTP " + response.status);
      return response.json();
    }).then(function (matrix) {
      if (!matrix || !Array.isArray(matrix.nakshatras) || !matrix.results) {
        throw new Error("Moon transit matrix has an invalid structure.");
      }
      moonTransitMatrix = matrix;
      return matrix;
    }).catch(function (error) {
      moonTransitMatrixLoadFailed = true;
      console.warn("Moon transit result matrix could not be loaded.", error);
      return null;
    });
    return moonTransitMatrixPromise;
  }

  function moonTransitMatrixResult(data) {
    if (!moonTransitMatrix || !data) return "";
    var count = Number(data.moonTransitCount);
    var referenceNakshatra = String(data.referenceMoonNakshatra || "");
    if (!Number.isInteger(count) || count < 1 || count > 27 || !referenceNakshatra) return "";
    var row = moonTransitMatrix.results[String(count)];
    return row && typeof row[referenceNakshatra] === "string" ? row[referenceNakshatra] : "";
  }

  function isSameMinute(firstMs, secondMs) {
    var first = Number(firstMs), second = Number(secondMs);
    return Number.isFinite(first) && Number.isFinite(second) &&
      Math.floor(first / 60000) === Math.floor(second / 60000);
  }

  function isApplePlatform() {
    var platform = "";
    if (navigator.userAgentData && navigator.userAgentData.platform) {
      platform = navigator.userAgentData.platform;
    } else {
      platform = navigator.platform || "";
    }
    return /mac|iphone|ipad|ipod/i.test(platform);
  }

  function currentUser() {
    return window.jaAuthUser ||
      (window.firebaseAuth && window.firebaseAuth.currentUser) ||
      null;
  }

  function waitForAuthReady() {
    if (currentUser()) return Promise.resolve(currentUser());
    if (window.jaAuthStateReady === true) return Promise.resolve(null);

    if (window.jaAuthReady && typeof window.jaAuthReady.then === "function") {
      return window.jaAuthReady.then(function (user) {
        return currentUser() || user || null;
      }, function () {
        return currentUser();
      });
    }

    return new Promise(function (resolve) {
      var finished = false;
      var timeout = window.setTimeout(function () {
        finish(currentUser());
      }, 10000);

      function finish(user) {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        window.removeEventListener("ja-auth-state-changed", onAuthState);
        resolve(currentUser() || user || null);
      }

      function onAuthState(event) {
        finish(event && event.detail ? event.detail.user : currentUser());
      }

      window.addEventListener("ja-auth-state-changed", onAuthState, { once: true });
      if (window.jaAuthReady && typeof window.jaAuthReady.then === "function") {
        window.jaAuthReady.then(function (user) {
          finish(currentUser() || user);
        }, function () {
          finish(currentUser());
        });
      }
    });
  }

  function dismissAuthPrompt() {
    if (authPrompt && authPrompt.parentNode) {
      authPrompt.parentNode.removeChild(authPrompt);
    }
    authPrompt = null;
  }

  function showAuthPrompt() {
    if (authPrompt) return;

    authPrompt = document.createElement("div");
    authPrompt.id = "ja-transit-timeline-auth-prompt";
    authPrompt.setAttribute("role", "status");
    authPrompt.setAttribute("aria-live", "polite");

    var message = document.createElement("span");
    message.textContent = "Please sign in to open Transit Timeline.";

    var action = document.createElement("button");
    action.type = "button";
    action.textContent = "Log in";
    action.addEventListener("click", function () {
      dismissAuthPrompt();
      var accountButton = document.getElementById("accountOpenBtn");
      if (accountButton) {
        accountButton.click();
      } else {
        window.location.assign("/8a9K79m85R0t2B7x6C7p48n8V16d0J85.html#account");
      }
    });

    authPrompt.appendChild(message);
    authPrompt.appendChild(action);
    document.body.appendChild(authPrompt);
  }

  function themeIconMarkup(mode) {
    if (mode === "apple") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.6"></circle><path d="M12 2v2.1M12 19.9V22M4.93 4.93l1.48 1.48m11.18 11.18 1.48 1.48M2 12h2.1m15.8 0H22M4.93 19.07l1.48-1.48M17.59 6.41l1.48-1.48"></path></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"></rect><path d="M3 8h18M7 6h.01M10 6h.01M7 12h10M7 15.5h7"></path></svg>';
  }

  function updateThemeButton() {
    if (!windowEl) return;
    var button = windowEl.querySelector('[data-jtt-action="theme"]');
    if (!button) return;

    var appleActive = themeMode === "apple";
    button.innerHTML = themeIconMarkup(themeMode);
    button.title = appleActive
      ? "Apple Light is active · Switch to website theme"
      : "Following website theme · Switch to Apple Light";
    button.setAttribute("aria-label", appleActive
      ? "Switch to website theme"
      : "Switch to Apple Light mode");
    button.setAttribute("aria-pressed", appleActive ? "true" : "false");
  }

  function applyTheme(mode, persist) {
    themeMode = mode === "apple" ? "apple" : "website";
    if (windowEl) windowEl.setAttribute("data-jtt-theme", themeMode);
    updateThemeButton();
    if (persist !== false) {
      try { localStorage.setItem(THEME_KEY, themeMode); } catch (error) {}
    }
  }

  function toggleTheme() {
    applyTheme(themeMode === "website" ? "apple" : "website", true);
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  // The visible date field uses Indian-style DD/MM/YYYY formatting.
  function dateInputValue(date) {
    return pad(date.getDate()) + "/" +
      pad(date.getMonth() + 1) + "/" + date.getFullYear();
  }

  function timeInputValue(date) {
    return pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function displayDateTime(ms) {
    var date = new Date(ms);
    if (!Number.isFinite(date.getTime())) return "—";
    return pad(date.getDate()) + "/" + pad(date.getMonth() + 1) + "/" +
      date.getFullYear() + " " + timeInputValue(date);
  }

  function readContextSnapshot() {
    var context = window.JupiterTransitTimelineContext;
    if (!context || typeof context.getSnapshot !== "function") return null;
    try {
      return context.getSnapshot() || null;
    } catch (error) {
      console.warn("Transit Timeline could not read the active chart context.", error);
      return null;
    }
  }

  function setNotice(message, isError) {
    if (!windowEl) return;
    var notice = windowEl.querySelector(".jtt-notice");
    if (!notice) return;
    notice.textContent = message || "";
    notice.hidden = !message;
    notice.classList.toggle("is-error", !!isError);
  }

  function syncChartSelector(snapshot) {
    if (!windowEl) return;
    var chartTitle = windowEl.querySelector("[data-jtt-chart-title]");
    var chartSelect = windowEl.querySelector("[data-jtt-chart-select]");
    var registry = window.JupiterTransitTimelineCharts;
    var charts = registry && typeof registry.getCharts === "function"
      ? registry.getCharts()
      : [];
    var activeId = registry && typeof registry.getActiveId === "function"
      ? registry.getActiveId()
      : "";

    if (!chartSelect || !chartTitle) return;

    if (charts.length > 1) {
      chartTitle.hidden = true;
      chartSelect.hidden = false;
      while (chartSelect.firstChild) chartSelect.removeChild(chartSelect.firstChild);

      charts.forEach(function (chart) {
        var option = document.createElement("option");
        option.value = chart.id;
        option.textContent = chart.title;
        chartSelect.appendChild(option);
      });

      chartSelect.value = activeId || (snapshot && snapshot.chartId) || charts[0].id;
    } else {
      chartSelect.hidden = true;
      chartTitle.hidden = false;
      if (charts.length === 1) {
        chartTitle.textContent = charts[0].title;
      } else if (!snapshot) {
        chartTitle.textContent = "No active Research Kundali";
      }
    }
  }

  function escapeTableText(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ordinalHouse(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return "—";
    var suffix = number % 10 === 1 && number !== 11 ? "st"
      : number % 10 === 2 && number !== 12 ? "nd"
      : number % 10 === 3 && number !== 13 ? "rd" : "th";
    return number + suffix + " House";
  }

  function renderDurationCell(interval, displayHtml, label, nakshatraStoryName) {
    var display = displayHtml || '<span class="jtt-cell-muted">—</span>';
    var isNakshatraStory = !!nakshatraStoryName;
    if (!interval || !interval.startText || !interval.endText) {
      return isNakshatraStory
        ? '<span class="jtt-nakshatra-story-trigger" data-jtt-nakshatra-story="' +
          escapeTableText(nakshatraStoryName) + '" tabindex="0" role="button" aria-label="Click to read the deity story of ' +
          escapeTableText(nakshatraStoryName) + '">' + display + '</span>'
        : '<span class="jtt-duration-value">' + display + '</span>';
    }
    var fullDuration = interval.startText + ' to ' + interval.endText;
    return '<span class="jtt-duration-wrap' + (isNakshatraStory ? ' jtt-nakshatra-story-trigger' : '') +
      '" tabindex="0" role="button"' +
      (isNakshatraStory ? ' data-jtt-nakshatra-story="' + escapeTableText(nakshatraStoryName) + '"' : '') +
      ' data-jtt-duration="' + escapeTableText(fullDuration) + '"' +
      ' data-jtt-duration-label="' + escapeTableText(label || 'Transit duration') + '"' +
      ' aria-label="' + escapeTableText((label || 'Transit duration') + (isNakshatraStory ? '. Click to read Nakshatra deity story' : '. Hover or focus to view duration')) + '">' +
      '<span class="jtt-duration-value">' + display + '</span>' +
    '</span>';
  }

  function renderNatalPlanetMatches(items, sourceKey) {
    if (!Array.isArray(items) || !items.length) {
      return '<span class="jtt-cell-muted">—</span>';
    }
    var abbreviations = {
      Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me',
      Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke'
    };
    return '<div class="jtt-natal-matches">' + items.map(function (item) {
      var markers = Array.isArray(item.markers) && item.markers.length
        ? '<sup class="jtt-planet-markers">[' + item.markers.map(escapeTableText).join("][") + ']</sup>'
        : '';
      var planet = String(item.name || "").trim();
      return '<span class="jtt-natal-match jtt-transit-natal-trigger" tabindex="0" role="button" data-natal-source="' +
        escapeTableText(sourceKey || "") + '" data-natal-planet="' + escapeTableText(planet) +
        '" aria-label="View transit result over natal ' + escapeTableText(planet) +
        '" style="color:' + escapeTableText(item.color || "var(--jtt-ink)") + '" title="' +
        escapeTableText(item.name) + '">' +
        escapeTableText(abbreviations[item.name] || item.name.slice(0, 2)) + markers + '</span>';
    }).join('<span class="jtt-match-separator">, </span>') + '</div>';
  }

  // Latta (planetary kick) rules transcribed from the supplied source.
  // The occupied nakshatra is counted as number 1. Forward = increasing
  // nakshatra order; backward = decreasing order, both cyclic over 27.
  var LATTA_NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira",
    "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha",
    "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra",
    "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula",
    "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha",
    "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
  ];

  // count is inclusive: e.g. 12th from Mrigashira = Vishakha.
  var LATTA_RULES = {
    Sun:     { count: 12, direction: "forward", type: "Purolatta" },
    Mars:    { count: 3,  direction: "forward", type: "Purolatta" },
    Jupiter: { count: 6,  direction: "forward", type: "Purolatta" },
    Saturn:  { count: 8,  direction: "forward", type: "Purolatta" },
    Moon:    { count: 22, direction: "backward", type: "Prishtha latta" },
    Mercury: { count: 7,  direction: "backward", type: "Prishtha latta" },
    Venus:   { count: 5,  direction: "backward", type: "Prishtha latta" },
    Rahu:    { count: 9,  direction: "backward", type: "Prishtha latta" }
  };

  var LATTA_NAKSHATRA_ALIASES = {
    "mrig": "Mrigashira",
    "mrigasira": "Mrigashira",
    "mrigashirsha": "Mrigashira",
    "mrigashira": "Mrigashira",
    "dhanishta": "Dhanishtha",
    "poorva phalguni": "Purva Phalguni",
    "pubba": "Purva Phalguni",
    "uttara phalguni": "Uttara Phalguni",
    "uthraphalguni": "Uttara Phalguni",
    "poorva ashadha": "Purva Ashadha",
    "uttara ashadha": "Uttara Ashadha",
    "shravana": "Shravana",
    "sravana": "Shravana",
    "shatabhisha": "Shatabhisha",
    "shatabhishak": "Shatabhisha",
    "poorva bhadrapada": "Purva Bhadrapada",
    "uttara bhadrapada": "Uttara Bhadrapada"
  };

  function normalizeLattaNakshatra(value) {
    var name = String(value == null ? "" : value).trim()
      .replace(/\\s*\\([^)]*\\)\\s*$/, "")
      .replace(/\\s+/g, " ");
    if (!name) return null;
    var key = name.toLowerCase();
    var alias = LATTA_NAKSHATRA_ALIASES[key];
    if (alias) return alias;
    return LATTA_NAKSHATRAS.find(function (item) {
      return item.toLowerCase() === key;
    }) || null;
  }

  function calculateLattaTarget(planet, sourceNakshatra) {
    var rule = LATTA_RULES[String(planet || "").trim()];
    var source = normalizeLattaNakshatra(sourceNakshatra);
    if (!rule || !source) return null;

    var sourceIndex = LATTA_NAKSHATRAS.indexOf(source);
    var directionStep = rule.direction === "forward" ? 1 : -1;
    var targetIndex = (sourceIndex + directionStep * (rule.count - 1) + 27) % 27;
    return {
      planet: String(planet),
      type: rule.type,
      direction: rule.direction,
      count: rule.count,
      sourceNakshatra: source,
      targetNakshatra: LATTA_NAKSHATRAS[targetIndex]
    };
  }

  // Accepts the existing Transit Timeline row array ({ planet, nakshatra }).
  // This is calculation-only: it does not add a column or alter the UI yet.
  function calculateLatta(rows) {
    var results = {};
    if (!Array.isArray(rows)) return results;
    rows.forEach(function (row) {
      if (!row || !row.planet) return;
      var result = calculateLattaTarget(row.planet, row.nakshatra);
      if (result) results[result.planet] = result;
    });
    return results;
  }

  // Index existing Latta calculations by the Nakshatra being hit.
  // This deliberately reuses calculateLatta(); it does not recalculate planetary offsets.
  function getLattaSourcesByTargetNakshatra(rows) {
    var hits = {};
    var sourceResults = calculateLatta(rows);
    Object.keys(sourceResults).forEach(function (sourcePlanet) {
      var item = sourceResults[sourcePlanet];
      var target = normalizeLattaNakshatra(item.targetNakshatra);
      if (!target) return;
      (hits[target] || (hits[target] = [])).push(sourcePlanet);
    });
    Object.keys(hits).forEach(function (nakshatra) {
      hits[nakshatra] = Array.from(new Set(hits[nakshatra]));
    });
    return hits;
  }

  // Transit-from-Janma-Rasi reference tables (Tables 53–59, supplied book pages 315–318).
  // House numbers are counted from Janma Rasi. Snapshot and typical-result wording
  // are transcribed from the supplied source; this is reference data only for now.
  var JANMA_RASI_TRANSIT_RULES = {
    Sun: {
      1: { snapshot: "Bad", result: "Financial loss, many travels, discomfort" },
      2: { snapshot: "Bad", result: "Unhappiness, eye troubles, fear" },
      3: { snapshot: "Good", result: "Wealth, good health, victory" },
      4: { snapshot: "Bad", result: "Marital disharmony, loss of name" },
      5: { snapshot: "Bad", result: "Bad health, fear from enemies" },
      6: { snapshot: "Good", result: "Success over enemies, good health" },
      7: { snapshot: "Bad", result: "Travels, physical pain" },
      8: { snapshot: "Bad", result: "Disease, setbacks in marriage" },
      9: { snapshot: "Bad", result: "Mental worries, obstacles" },
      10: { snapshot: "Good", result: "Success, honors, gains" },
      11: { snapshot: "Good", result: "Good health, prosperity, honors" },
      12: { snapshot: "Bad", result: "Expenditure, losses" }
    },
    Moon: {
      1: { snapshot: "Good", result: "Comfort, good spirits" },
      2: { snapshot: "Bad", result: "Obstacles, losses" },
      3: { snapshot: "Good", result: "Gains, happiness" },
      4: { snapshot: "Bad", result: "Lack of peace of mind, distrust" },
      5: { snapshot: "Bad", result: "Failures, disappointments, sadness" },
      6: { snapshot: "Good", result: "Happiness, health, wealth" },
      7: { snapshot: "Good", result: "Respect, gains" },
      8: { snapshot: "Bad", result: "Losses, tension, worries" },
      9: { snapshot: "Bad", result: "Mental uneasiness" },
      10: { snapshot: "Good", result: "Success, gains, authority" },
      11: { snapshot: "Good", result: "Prosperity, comforts, gains" },
      12: { snapshot: "Bad", result: "Injuries, expenditure, sadness" }
    },
    Mars: {
      1: { snapshot: "Bad", result: "Troubles, bodily afflictions" },
      2: { snapshot: "Bad", result: "Accidents, losses, thefts, quarrels" },
      3: { snapshot: "Good", result: "Gains, power, wealth" },
      4: { snapshot: "Bad", result: "Stomach problems, fevers, bad health" },
      5: { snapshot: "Bad", result: "Troubles from enemies, trouble with children" },
      6: { snapshot: "Good", result: "Success over enemies, wealth, success, well-being" },
      7: { snapshot: "Bad", result: "Quarrels, marital troubles, eye problems" },
      8: { snapshot: "Bad", result: "Worries, accidents, bad name, losses" },
      9: { snapshot: "Bad", result: "Losses, insults, illness" },
      10: { snapshot: "Bad", result: "Change of place, unexpected wealth" },
      11: { snapshot: "Good", result: "Authority, gains, good name" },
      12: { snapshot: "Bad", result: "Expenses, quarrels with wife, diseases" }
    },
    Mercury: {
      1: { snapshot: "Bad", result: "Quarrels, imprisonment, losses, poor advice" },
      2: { snapshot: "Good", result: "Success, wealth, gains" },
      3: { snapshot: "Bad", result: "Wandering, losses, trouble from authorities" },
      4: { snapshot: "Good", result: "Prosperity in family, gains" },
      5: { snapshot: "Bad", result: "Quarrels with wife and children, suffering" },
      6: { snapshot: "Good", result: "Renown, success, ornaments" },
      7: { snapshot: "Bad", result: "Quarrels, mental discomfort, addictions" },
      8: { snapshot: "Good", result: "Childbirth, happiness, gains, success" },
      9: { snapshot: "Bad", result: "Mental worries, obstacles" },
      10: { snapshot: "Good", result: "Money, happiness, domestic harmony, success" },
      11: { snapshot: "Good", result: "Childbirth, happiness, wealth" },
      12: { snapshot: "Bad", result: "Disease, domestic disharmony, disease, losses" }
    },
    Jupiter: {
      1: { snapshot: "Bad", result: "Loss of money and intelligence, wandering" },
      2: { snapshot: "Good", result: "Happiness, domestic harmony, success" },
      3: { snapshot: "Bad", result: "Obstacles, loss of position, travels" },
      4: { snapshot: "Bad", result: "Troubles, defeat, losses" },
      5: { snapshot: "Good", result: "Childbirth, intelligence, prosperity, wealth" },
      6: { snapshot: "Bad", result: "Mental uneasiness, enemies, worries" },
      7: { snapshot: "Good", result: "Health, happiness, erotic pleasures, sense of well-being" },
      8: { snapshot: "Bad", result: "Disease, imprisonment, illness, grief" },
      9: { snapshot: "Good", result: "Success, wealth, childbirth, religiousness" },
      10: { snapshot: "Bad", result: "Loss of position and money, ill-health, wandering" },
      11: { snapshot: "Good", result: "Recovery of health and position, happiness" },
      12: { snapshot: "Bad", result: "Fall from grace, misconduct, grief" }
    },
    Venus: {
      1: { snapshot: "Good", result: "Comforts, pleasures, happiness, good spirits" },
      2: { snapshot: "Good", result: "Money, fortune, erotic pleasures, childbirth" },
      3: { snapshot: "Good", result: "Respect, wealth, good spirits" },
      4: { snapshot: "Good", result: "Prosperity, success of enemies, comforts" },
      5: { snapshot: "Good", result: "Fame, power, good name" },
      6: { snapshot: "Bad", result: "Loss of fame, bad name, quarrels" },
      7: { snapshot: "Bad", result: "Humiliation, disease, troubles" },
      8: { snapshot: "Bad", result: "Fears, mental worries, injuries, troubles from women" },
      9: { snapshot: "Good", result: "Fortune, luxuries, marital happiness" },
      10: { snapshot: "Bad", result: "Virtuous acts, unpleasant events, disgrace" },
      11: { snapshot: "Good", result: "Gains, happiness, prosperity, comforts" },
      12: { snapshot: "Bad", result: "New friends, money, pleasures, gains" }
    },
    Saturn: {
      1: { snapshot: "Bad", result: "Fear of incarceration, worries, foreign trips" },
      2: { snapshot: "Bad", result: "Physical weakness, discomfort, wealth, unhappiness" },
      3: { snapshot: "Good", result: "Wealth, health, happiness, all-round success" },
      4: { snapshot: "Bad", result: "Stomach problems, wickedness, separation from family" },
      5: { snapshot: "Bad", result: "Separation from children, uneasiness, quarrels" },
      6: { snapshot: "Good", result: "Freedom from disease and enemies, success" },
      7: { snapshot: "Bad", result: "Wandering, quarrels with spouse, trouble from authorities" },
      8: { snapshot: "Bad", result: "Suffering, loss of status and balance, imprisonment" },
      9: { snapshot: "Bad", result: "Diseases, suffering, loss of status" },
      10: { snapshot: "Bad", result: "Loss of money, bad name, changes in career, laziness" },
      11: { snapshot: "Good", result: "Wealth, success, gains" },
      12: { snapshot: "Bad", result: "Grief, misery, losses, ill-health, frustration" }
    }
  };

  // Lookup a planet's source-defined transit snapshot from Janma Rasi.
  function getJanmaRasiTransitResult(planet, house) {
    var planetRules = JANMA_RASI_TRANSIT_RULES[String(planet || "").trim()];
    var houseNumber = Number(house);
    if (!planetRules || !Number.isInteger(houseNumber) ||
        houseNumber < 1 || houseNumber > 12 || !planetRules[houseNumber]) return null;
    return Object.assign({ planet: String(planet), house: houseNumber }, planetRules[houseNumber]);
  }

  // Calculate source-defined snapshots for existing Transit Timeline rows.
  // Rows are expected to expose { planet, fromMoon }.
  function calculateJanmaRasiTransit(rows) {
    var results = {};
    if (!Array.isArray(rows)) return results;
    rows.forEach(function (row) {
      if (!row || !row.planet) return;
      var house = getHouseFromJanmaRashi(row);
      var result = getJanmaRasiTransitResult(row.planet, house);
      if (result) results[result.planet] = result;
    });
    return results;
  }

  // Rasi Gochara Vedha: auspicious transit house -> corresponding Vedha house.
  // Houses are counted from Janma Rashi (natal Moon). The source table supplies
  // rules for the seven classical planets only; Rahu/Ketu are not inferred.
  var VEDHA_RULES = {
    Sun:     { 3: 9, 6: 12, 10: 4, 11: 5 },
    Moon:    { 1: 5, 3: 9, 6: 12, 7: 2, 10: 4, 11: 8 },
    Mars:    { 3: 12, 6: 9, 11: 5 },
    Mercury: { 2: 5, 4: 3, 6: 9, 8: 1, 10: 8, 11: 12 },
    Jupiter: { 2: 12, 5: 4, 7: 3, 9: 10, 11: 8 },
    Venus:   { 1: 8, 2: 7, 3: 1, 4: 10, 5: 9, 8: 5, 9: 11, 11: 6, 12: 3 },
    Saturn:  { 3: 12, 6: 9, 11: 5 }
  };

  // Father-son exceptions: Sun/Saturn and Moon/Mercury do not cause
  // Vedha on each other, in either direction.
  var VEDHA_EXEMPT_PAIRS = [
    ["Sun", "Saturn"],
    ["Moon", "Mercury"]
  ];

  function isVedhaExemptPair(planetA, planetB) {
    return VEDHA_EXEMPT_PAIRS.some(function (pair) {
      return (pair[0] === planetA && pair[1] === planetB) ||
        (pair[0] === planetB && pair[1] === planetA);
    });
  }

  function getHouseFromJanmaRashi(row) {
    var value = row && row.fromMoon;
    if (typeof value === "number" && Number.isInteger(value)) {
      return value >= 1 && value <= 12 ? value : null;
    }
    var match = String(value == null ? "" : value).match(/^\s*(1[0-2]|[1-9])\s*H?(?:\s|$)/i);
    return match ? Number(match[1]) : null;
  }

  function computeVedha(rows) {
    var result = {};
    if (!Array.isArray(rows)) return result;

    var positions = rows.map(function (row) {
      return {
        planet: String(row && row.planet || ""),
        house: getHouseFromJanmaRashi(row)
      };
    });

    positions.forEach(function (target) {
      var rules = VEDHA_RULES[target.planet];
      var favourableHouse = target.house;
      if (!rules || !Object.prototype.hasOwnProperty.call(rules, favourableHouse)) return;

      var vedhaHouse = rules[favourableHouse];
      positions.forEach(function (obstructor) {
        if (!obstructor.planet || obstructor.planet === target.planet ||
            obstructor.house !== vedhaHouse ||
            isVedhaExemptPair(target.planet, obstructor.planet)) return;

        (result[target.planet] || (result[target.planet] = [])).push(obstructor.planet);
      });
    });

    Object.keys(result).forEach(function (planet) {
      result[planet] = Array.from(new Set(result[planet]));
    });
    return result;
  }

  // Reverse Vedha rules transcribed from the supplied reference images.
  // A listed source-house occupied by the named causing planet maps to the
  // corresponding Reverse Vedha house. Other planets in that destination
  // house receive the Reverse Vedha indicator in their own row.
  var REVERSE_VEDHA_RULES = {
    Sun: {
      4: 3, 5: 6, 9: 10, 12: 11
    },
    Mars: {
      5: 3, 9: 6, 12: 11
    },
    Saturn: {
      5: 3, 9: 6, 12: 11
    },
    Rahu: {
      5: 3, 9: 6, 12: 11
    },
    Ketu: {
      5: 3, 9: 6, 12: 11
    },
    Mercury: {
      3: 2, 6: 5, 7: 8, 9: 10, 12: 11
    },
    Jupiter: {
      3: 2, 4: 5, 10: 9, 11: 11
    },
    Venus: {
      6: 2, 7: 5, 10: 9
    }
  };

  function computeReverseVedha(rows) {
    var result = {};
    if (!Array.isArray(rows)) return result;

    var positions = rows.map(function (row) {
      return {
        planet: String(row && row.planet || ""),
        house: getHouseFromJanmaRashi(row)
      };
    });

    // The planet in the listed (adverse) house is the recipient of Reverse
    // Vedha. Any other planet in its paired Reverse Vedha house relieves it.
    positions.forEach(function (recipient) {
      var rules = REVERSE_VEDHA_RULES[recipient.planet];
      if (!rules || !Object.prototype.hasOwnProperty.call(rules, recipient.house)) return;

      var reverseVedhaHouse = rules[recipient.house];
      positions.forEach(function (relievingPlanet) {
        if (!relievingPlanet.planet || relievingPlanet.planet === recipient.planet ||
            relievingPlanet.house !== reverseVedhaHouse) return;

        (result[recipient.planet] || (result[recipient.planet] = [])).push(relievingPlanet.planet);
      });
    });

    Object.keys(result).forEach(function (planet) {
      result[planet] = Array.from(new Set(result[planet]));
    });
    return result;
  }

  function renderVedhaCell(planets, titlePrefix, markClass) {
    if (!Array.isArray(planets) || !planets.length) return '<td class="jtt-vedha-cell"></td>';
    var abbreviations = {
      Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me",
      Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke"
    };
    var fullNames = planets.map(function (planet) {
      return String(planet == null ? "" : planet);
    });
    var names = fullNames.map(escapeTableText).join(", ");
    var shortNames = fullNames.map(function (planet) {
      return escapeTableText(abbreviations[planet] || planet.slice(0, 2));
    }).join(", ");
    return '<td class="jtt-vedha-cell" title="' + escapeTableText(titlePrefix.replace(/\s*caused by\s*/i, "") + ": " + names) + '">' +
      '<span class="jtt-vedha-mark' + (markClass ? ' ' + markClass : '') + '">X</span> ' +
      '<span class="jtt-vedha-planets">(' + shortNames + ')</span></td>';
  }

  function renderTransitTable(data) {
    if (!data || !Array.isArray(data.rows) || !data.rows.length) {
      return '<div class="jtt-table-empty">No planetary transit data is available for the selected Kundali.</div>';
    }

    function houseScore(house, score, scoreType, planet, source) {
      var hasScore = score !== null && score !== undefined && score !== "" &&
        Number.isFinite(Number(score));
      var numericScore = hasScore ? Number(score) : null;
      var scoreClass = '';
      if (hasScore && scoreType === "sav") {
        scoreClass = numericScore > 29 ? ' jtt-score-good' : numericScore < 25 ? ' jtt-score-bad' : '';
      } else if (hasScore && scoreType === "bav") {
        scoreClass = numericScore >= 6 ? ' jtt-score-good' : numericScore <= 3 ? ' jtt-score-bad' : '';
      }
      var houseNumber = Number(house);
      var houseMarkup = Number.isInteger(houseNumber) && houseNumber >= 1 && houseNumber <= 12
        ? '<span class="jtt-house-result-trigger" data-result-planet="' + escapeTableText(planet) +
          '" data-result-source="' + escapeTableText(source) + '" data-result-house="' + houseNumber + '" data-result-bav-score="' +
          (scoreType === "bav" && hasScore ? escapeTableText(score) : '') +
          '" tabindex="0" role="button" aria-label="' +
          escapeTableText(planet + ' transit result, ' + houseNumber + 'th house') + '">' +
          houseNumber + 'H</span>'
        : escapeTableText(house) + 'H';
      var value = hasScore
        ? (scoreType === "bav"
          ? '<button type="button" class="jtt-house-score-detail jtt-bav-result-trigger' + scoreClass +
            '" data-bav-result-planet="' + escapeTableText(planet) + '" data-bav-result-score="' + escapeTableText(score) +
            '" data-bav-result-house="' + (Number.isInteger(houseNumber) ? houseNumber : '') +
            '" data-bav-result-source="moon" aria-label="Show ' + escapeTableText(planet) + ' BAV ' + escapeTableText(score) + ' transit result">[' +
            escapeTableText(score) + ']</button>'
          : '<span class="jtt-house-score-detail' + scoreClass + '"> [' + escapeTableText(score) + ']</span>')
        : '';
      return '<span class="jtt-house-score">' + houseMarkup + value + '</span>';
    }

    var abbreviations = {
      Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me',
      Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke'
    };

    var vedhaResults = computeVedha(data.rows);
    var reverseVedhaResults = computeReverseVedha(data.rows);
    var lattaHits = getLattaSourcesByTargetNakshatra(data.rows.map(function (row) {
      return { planet: row.planet, nakshatra: row.nakshatra };
    }));
    window.__JA_TRANSIT_TIMELINE_CURRENT_ROWS = data.rows;
    var rowsHtml = data.rows.map(function (row) {
      var markers = Array.isArray(row.markers) && row.markers.length
        ? '<sup class="jtt-planet-markers">[' + row.markers.map(escapeTableText).join("][") + ']</sup>'
        : '';
      var nakshatraLord = abbreviations[row.nakshatraLord] || '';
      var nakshatraName = normalizeLattaNakshatra(row.nakshatra);
      var lattaSources = nakshatraName ? (lattaHits[nakshatraName] || []) : [];
      var lattaMarker = lattaSources.length
        ? ' <sup class="jtt-latta-marker" title="Latta: ' + escapeTableText(lattaSources.join(", ")) + '">{L}</sup>'
        : '';
      var nakshatraHtml = escapeTableText(row.nakshatra) + lattaMarker +
        (nakshatraLord ? ' <span class="jtt-nak-lord">(' + nakshatraLord + ')</span>' : '');
      var murti = escapeTableText(row.murti || "");
      var murtiTone = row.murti === "Excellent" ? " jtt-murti-excellent" :
        row.murti === "Satisfactory" ? " jtt-murti-satisfactory" :
        row.murti === "Bad" ? " jtt-murti-bad" :
        row.murti === "Very Bad" ? " jtt-murti-very-bad" :
        row.murti === "Gold" ? " jtt-murti-gold" :
        row.murti === "Silver" ? " jtt-murti-silver" :
        row.murti === "Copper" ? " jtt-murti-copper" :
        row.murti === "Iron" ? " jtt-murti-iron" : "";
      var navamsaNumber = Number.isFinite(Number(row.navamsaIndex)) ? Number(row.navamsaIndex) : '';

      return '<tr>' +
        '<td class="jtt-planet-cell"><strong class="jtt-planet-signification-trigger" tabindex="0" role="button" aria-label="View ' + escapeTableText(row.planet) + ' signification">' + escapeTableText(row.planet) + '</strong>' + markers + '</td>' +
        '<td class="jtt-sign-cell">' + renderDurationCell(row.signDuration, escapeTableText(row.sign), 'Sign duration') + '</td>' +
        '<td class="jtt-house-cell">' + houseScore(row.fromLagna, row.sav, 'sav', row.planet, 'lagna') + '</td>' +
        '<td class="jtt-house-cell">' + houseScore(row.fromMoon, row.bav, 'bav', row.planet, 'moon') + '</td>' +
        '<td class="jtt-match-cell">' + renderNatalPlanetMatches(row.natalPlanetsInSign, 'sign') + '</td>' +
        '<td class="jtt-nakshatra-cell">' + renderDurationCell(row.nakshatraDuration, nakshatraHtml, 'Nakshatra duration', row.nakshatra) + '</td>' +
        '<td class="jtt-count-cell">' + escapeTableText(row.countFromJanmaNakshatra) + '</td>' +
        '<td class="jtt-match-cell">' + renderNatalPlanetMatches(row.natalPlanetsInNakshatra, 'nakshatra') + '</td>' +
        '<td class="jtt-navamsa-cell">' + renderDurationCell(row.navamsaDuration, escapeTableText(row.navamsa || navamsaNumber), 'Navamsa duration') + '</td>' +
        '<td class="jtt-match-cell">' + renderNatalPlanetMatches(row.natalPlanetsInNavamsa, 'navamsa') + '</td>' +
        renderVedhaCell(vedhaResults[row.planet], "Vedha") +
        renderVedhaCell(reverseVedhaResults[row.planet], "Reverse Vedha", "jtt-reverse-vedha-mark") +
        '<td class="jtt-murti-cell' + murtiTone + '">' + murti + '</td>' +
      '</tr>';
    }).join("");

    return '<table class="jtt-planetary-table">' +
      '<thead>' +
        '<tr>' +
          '<th class="jtt-sticky-planet">Planet</th>' +
          '<th>Tr Sign</th>' +
          '<th>From Lagna</th>' +
          '<th>From Moon</th>' +
          '<th title="Natal Planet (Sign)">Natal (Sign)</th>' +
          '<th>Tr Nakshatra</th>' +
          '<th>Nk. Count</th>' +
          '<th title="Natal Planet (Nakshatra)">Natal (Nak.)</th>' +
          '<th>Tr Navamsa</th>' +
          '<th title="Natal Planet (Navamsa)">Natal (D9)</th>' +
          '<th>Vedha (from)</th>' +
          '<th title="Reverse Vedha (from)">Rev. Vedha</th>' +
          '<th title="Murti Nirnay">Murti</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' + rowsHtml + '</tbody>' +
    '</table>';
  }

  var activeDurationTooltip = null;
  var activeDurationWrapper = null;
  var durationHideTimer = null;
  var durationRemoveTimer = null;

  function clearDurationHideTimer() {
    if (durationHideTimer) { clearTimeout(durationHideTimer); durationHideTimer = null; }
    if (durationRemoveTimer) { clearTimeout(durationRemoveTimer); durationRemoveTimer = null; }
  }
  function removeDurationTooltip() {
    clearDurationHideTimer();
    if (window.JAHoverManager) window.JAHoverManager.untrack("transit-duration");
    if (activeDurationTooltip && activeDurationTooltip.parentNode) activeDurationTooltip.remove();
    activeDurationTooltip = null;
    activeDurationWrapper = null;
  }
  function scheduleDurationTooltipHide() {
    clearDurationHideTimer();
    if (!activeDurationTooltip) return;
    durationHideTimer = setTimeout(function () {
      if (!activeDurationTooltip) return;
      activeDurationTooltip.classList.remove("is-open");
      durationRemoveTimer = setTimeout(removeDurationTooltip, 220);
    }, 1000);
  }
  function copyPlainText(value) {
    function fallbackCopy() {
      return new Promise(function (resolve, reject) {
        var field = document.createElement("textarea");
        field.value = value;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        var copied = false;
        try { copied = document.execCommand("copy"); } catch (error) {}
        field.remove();
        copied ? resolve() : reject(new Error("Clipboard access is unavailable."));
      });
    }
    return navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(value).catch(fallbackCopy)
      : fallbackCopy();
  }
  function positionDurationTooltip(wrapper, tooltip) {
    var rect = wrapper.getBoundingClientRect();
    var windowRect = windowEl.getBoundingClientRect();
    var computed = getComputedStyle(windowEl);

    [
      "--jtt-bg", "--jtt-panel", "--jtt-panel-alt", "--jtt-ink",
      "--jtt-muted", "--jtt-line", "--jtt-line-strong", "--jtt-accent",
      "--jtt-accent-soft"
    ].forEach(function (property) {
      tooltip.style.setProperty(property, computed.getPropertyValue(property).trim());
    });

    tooltip.style.visibility = "hidden";
    tooltip.style.left = "8px";
    tooltip.style.top = "8px";

    // Keep the portal inside the floating window. Native fullscreen renders
    // only descendants of its top-layer element; a body-level tooltip vanishes.
    if (tooltip.parentNode !== windowEl) windowEl.appendChild(tooltip);

    var tipRect = tooltip.getBoundingClientRect();
    var availableWidth = Math.max(0, windowEl.clientWidth - 16);
    var left = rect.left - windowRect.left;
    left = Math.max(8, Math.min(left, availableWidth - tipRect.width + 8));

    var top = rect.bottom - windowRect.top + 8;
    if (top + tipRect.height > windowEl.clientHeight - 8) {
      top = rect.top - windowRect.top - tipRect.height - 8;
    }
    top = Math.max(8, Math.min(top, windowEl.clientHeight - tipRect.height - 8));

    tooltip.style.left = Math.round(left) + "px";
    tooltip.style.top = Math.round(top) + "px";
    tooltip.style.visibility = "visible";
  }
  function formatDurationTooltipHtml(value) {
    var parts = String(value || "").split(/\s+to\s+/i);
    if (parts.length !== 2) return escapeTableText(value);

    function parseEndpoint(part) {
      var match = part.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2}))?$/);
      return match ? { day: match[1].padStart(2, "0"), month: match[2].padStart(2, "0"), year: match[3], time: match[4] || "" } : null;
    }

    var start = parseEndpoint(parts[0]);
    var end = parseEndpoint(parts[1]);
    if (!start || !end) return escapeTableText(value);

    var showYear = start.year !== end.year;
    var sameDate = start.day === end.day && start.month === end.month && start.year === end.year;
    var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function renderEndpoint(date) {
      var monthName = monthNames[Number(date.month) - 1];
      if (!monthName) return escapeTableText(date.day + "/" + date.month + "/" + date.year);
      var dateText = date.day + "-" + monthName + (showYear ? "-" + date.year : "");
      var result = sameDate
        ? '<span class="jtt-duration-tooltip-date-muted">' + dateText + '</span>'
        : dateText;
      if (date.time) {
        result += ' <span class="jtt-duration-tooltip-time' + (sameDate ? ' jtt-duration-tooltip-time-primary' : '') + '">' + escapeTableText(date.time) + '</span>';
      }
      return result;
    }
    return renderEndpoint(start) + ' <span class="jtt-duration-tooltip-separator">to</span> ' + renderEndpoint(end);
  }

  function showDurationTooltip(wrapper) {
    if (!wrapper) return;
    clearDurationHideTimer();
    var duration = wrapper.getAttribute("data-jtt-duration") || "";
    var label = wrapper.getAttribute("data-jtt-duration-label") || "Duration";
    if (!duration) return;

    if (activeDurationWrapper === wrapper && activeDurationTooltip) {
      positionDurationTooltip(wrapper, activeDurationTooltip);
      activeDurationTooltip.classList.add("is-open");
      return;
    }
    removeDurationTooltip();
    activeDurationWrapper = wrapper;

    var tooltip = document.createElement("div");
    tooltip.className = "jtt-duration-tooltip";
    tooltip.setAttribute("role", "tooltip");
    var text = document.createElement("span");
    text.className = "jtt-duration-tooltip-text";
    text.innerHTML = formatDurationTooltipHtml(duration);
    text.tabIndex = 0;
    var copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "jtt-duration-tooltip-copy";
    copyButton.setAttribute("aria-label", "Copy complete duration");
    copyButton.title = "Copy duration";
    copyButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path></svg>';
    tooltip.appendChild(text);
    tooltip.appendChild(copyButton);

    tooltip.addEventListener("pointerenter", clearDurationHideTimer);
    tooltip.addEventListener("pointerleave", function (event) {
      if (activeDurationWrapper && activeDurationWrapper.contains(event.relatedTarget)) return;
      scheduleDurationTooltipHide();
    });
    tooltip.addEventListener("focusin", clearDurationHideTimer);
    tooltip.addEventListener("focusout", function (event) {
      if (tooltip.contains(event.relatedTarget) ||
          (activeDurationWrapper && activeDurationWrapper.contains(event.relatedTarget))) return;
      scheduleDurationTooltipHide();
    });
    tooltip.addEventListener("click", function (event) {
      var button = event.target.closest(".jtt-duration-tooltip-copy");
      if (!button) return;
      copyPlainText(duration).then(function () {
        button.classList.add("is-copied");
        button.title = "Copied";
        button.setAttribute("aria-label", "Duration copied");
        setTimeout(function () {
          if (!button.isConnected) return;
          button.classList.remove("is-copied");
          button.title = "Copy duration";
          button.setAttribute("aria-label", "Copy complete duration");
        }, 1200);
      }).catch(function (error) {
        console.error("Could not copy transit duration.", error);
        button.title = "Copy failed";
      });
    });
    tooltip.addEventListener("dblclick", function (event) {
      if (!event.target.closest(".jtt-duration-tooltip-text")) return;
      var selection = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(text);
      selection.removeAllRanges();
      selection.addRange(range);
    });

    activeDurationTooltip = tooltip;
    if (window.JAHoverManager) window.JAHoverManager.track("transit-duration", removeDurationTooltip);
    positionDurationTooltip(wrapper, tooltip);
    setTimeout(function () {
      if (activeDurationTooltip === tooltip) tooltip.classList.add("is-open");
    }, 10);
  }
  function bindDurationTooltips(host) {
    host.querySelectorAll(".jtt-duration-wrap[data-jtt-duration]").forEach(function (wrapper) {
      var durationOpenTimer = null;
      wrapper.addEventListener("pointerenter", function () { clearTimeout(durationOpenTimer); durationOpenTimer = setTimeout(function(){ showDurationTooltip(wrapper); }, 300); });
      wrapper.addEventListener("pointerleave", function (event) {
        clearTimeout(durationOpenTimer);
        if (activeDurationTooltip && activeDurationTooltip.contains(event.relatedTarget)) return;
        scheduleDurationTooltipHide();
      });
      wrapper.addEventListener("focusin", function () { showDurationTooltip(wrapper); });
      wrapper.addEventListener("focusout", function (event) {
        if (wrapper.contains(event.relatedTarget) ||
            (activeDurationTooltip && activeDurationTooltip.contains(event.relatedTarget))) return;
        scheduleDurationTooltipHide();
      });
    });
  }

  var transitExportHeaders = [
    "Planet", "Sign / Duration", "From Lagna / SAV", "From Moon / BAV (Planet)",
    "Natal Planet (Sign)", "Nakshatra / Duration", "Nk. Count",
    "Natal Planet (Nakshatra)", "Navamsa / Duration", "Natal Planet (Navamsa)",
    "Vedha (from)", "Reverse Vedha (from)", "Murti Nirnay"
  ];
  function getTransitExportMatrix() {
    var table = windowEl && windowEl.querySelector("[data-jtt-table-scroll] table");
    if (!table) throw new Error("The planetary table is not available.");
    var rows = [transitExportHeaders];
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      rows.push(Array.from(tr.querySelectorAll("td")).map(function (cell) {
        var durationWrap = cell.querySelector(".jtt-duration-wrap");
        if (durationWrap) {
          var value = durationWrap.querySelector(".jtt-duration-value");
          var duration = durationWrap.getAttribute("data-jtt-duration") || "";
          return [value ? value.textContent.trim() : "", duration].filter(Boolean).join(" | ");
        }
        return cell.textContent.replace(/\s+/g, " ").trim();
      }));
    });
    return rows;
  }
  function delimitedText(matrix, delimiter) {
    return matrix.map(function (row) {
      return row.map(function (value) {
        var text = String(value == null ? "" : value);
        return delimiter === "\t"
          ? text.replace(/\t/g, " ").replace(/\r?\n/g, " ")
          : '"' + text.replace(/"/g, '""') + '"';
      }).join(delimiter);
    }).join("\r\n");
  }
  function downloadTransitTableFile(content, mime, extension) {
    var blob = new Blob(["\uFEFF", content], { type: mime + ";charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "planetary-transit-table." + extension;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function closeGlobalExportMenu() {
    if (!windowEl) return;
    var menu = windowEl.querySelector("[data-jtt-global-export-menu]");
    var button = windowEl.querySelector('[data-jtt-action="export-toggle"]');
    if (menu) menu.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
  }
  async function runTransitTableExport(format) {
    try {
      var matrix = getTransitExportMatrix();
      if (format === "copy") {
        await copyPlainText(delimitedText(matrix, "\t"));
        setNotice("Planetary table copied.", false);
      } else if (format === "csv") {
        downloadTransitTableFile(delimitedText(matrix, ","), "text/csv", "csv");
        setNotice("CSV export prepared.", false);
      } else if (format === "tsv") {
        downloadTransitTableFile(delimitedText(matrix, "\t"), "text/tab-separated-values", "tsv");
        setNotice("TSV export prepared.", false);
      } else if (format === "pdf") {
        if (typeof window.downloadPlanetaryTablePDF !== "function") {
          throw new Error("The shared PDF exporter is unavailable.");
        }
        var temp = document.createElement("div");
        temp.style.position = "fixed";
        temp.style.left = "-10000px";
        var pdfTable = document.createElement("table");
        var thead = document.createElement("thead");
        var headerRow = document.createElement("tr");
        matrix[0].forEach(function (heading) {
          var th = document.createElement("th");
          th.textContent = heading;
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        pdfTable.appendChild(thead);
        var tbody = document.createElement("tbody");
        matrix.slice(1).forEach(function (row) {
          var tr = document.createElement("tr");
          row.forEach(function (value) {
            var td = document.createElement("td");
            td.textContent = value;
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        pdfTable.appendChild(tbody);
        temp.appendChild(pdfTable);
        document.body.appendChild(temp);
        try { await window.downloadPlanetaryTablePDF(temp); }
        finally { temp.remove(); }
        setNotice("PDF export prepared.", false);
      }
    } catch (error) {
      console.error("Transit table export failed.", error);
      setNotice(error && error.message ? error.message : "Unable to export the planetary table.", true);
    }
    closeGlobalExportMenu();
  }

  // Nakshatra deity stories: click a Nakshatra in the transit table to open
  // the shared signification panel. The panel remains for 20 seconds, unless
  // the pointer is over it; outside clicks dismiss it immediately.
  var nakshatraStoriesPromise = null;
  var activeNakshatraStory = null;
  var nakshatraStoryTimer = null;
  var nakshatraStoryDeadline = 0;
  var nakshatraStoryRemaining = 10000;
  var nakshatraStoryPaused = false;

  function loadNakshatraStories() {
    if (!nakshatraStoriesPromise) {
      nakshatraStoriesPromise = fetch("/data/nakshatra-deity-stories.json", {
        credentials: "same-origin",
        cache: "force-cache"
      }).then(function (response) {
        if (!response.ok) throw new Error("Nakshatra deity stories returned HTTP " + response.status);
        return response.json();
      }).then(function (database) {
        if (!database || !Array.isArray(database.nakshatras) || database.nakshatras.length !== 27) {
          throw new Error("Nakshatra deity story database must contain all 27 Nakshatras.");
        }
        return database.nakshatras;
      }).catch(function (error) {
        nakshatraStoriesPromise = null;
        throw error;
      });
    }
    return nakshatraStoriesPromise;
  }

  function clearNakshatraStoryTimer() {
    if (nakshatraStoryTimer) {
      clearTimeout(nakshatraStoryTimer);
      nakshatraStoryTimer = null;
    }
  }

  function hideNakshatraStory(immediate) {
    clearNakshatraStoryTimer();
    if (window.JAHoverManager) window.JAHoverManager.untrack("nakshatra-story");
    nakshatraStoryDeadline = 0;
    nakshatraStoryRemaining = 10000;
    nakshatraStoryPaused = false;
    activeNakshatraStory = null;
    var panel = ensurePlanetSignificationPanel();
    if (!panel) return;
    var meta = panel.querySelector(".jtt-nakshatra-story-meta");
    if (meta) meta.hidden = true;
    panel.classList.remove("is-nakshatra-story");
    if (immediate) {
      panel.classList.remove("is-visible");
      panel.hidden = true;
    } else {
      panel.classList.remove("is-visible");
      setTimeout(function () {
        if (!activeNakshatraStory && !panel.classList.contains("is-visible")) panel.hidden = true;
      }, 260);
    }
  }

  function scheduleNakshatraStoryExpiry() {
    clearNakshatraStoryTimer();
    if (!activeNakshatraStory || nakshatraStoryPaused) return;
    nakshatraStoryDeadline = Date.now() + nakshatraStoryRemaining;
    nakshatraStoryTimer = setTimeout(function () {
      hideNakshatraStory(false);
    }, Math.max(0, nakshatraStoryRemaining));
  }

  function pauseNakshatraStoryExpiry() {
    if (!activeNakshatraStory || nakshatraStoryPaused) return;
    if (nakshatraStoryTimer) {
      nakshatraStoryRemaining = Math.max(0, nakshatraStoryDeadline - Date.now());
      clearNakshatraStoryTimer();
    }
    nakshatraStoryPaused = true;
  }

  function resumeNakshatraStoryExpiry() {
    if (!activeNakshatraStory || !nakshatraStoryPaused) return;
    nakshatraStoryPaused = false;
    if (nakshatraStoryRemaining <= 0) {
      hideNakshatraStory(false);
      return;
    }
    scheduleNakshatraStoryExpiry();
  }

  function showNakshatraStory(name) {
    var requestedName = String(name || "").trim();
    if (!requestedName) return;
    clearPlanetSignificationTimers();
    clearNakshatraStoryTimer();
    activePlanetSignification = "nakshatra:" + requestedName;
    activeNakshatraStory = requestedName;
    nakshatraStoryRemaining = 10000;
    nakshatraStoryPaused = false;

    var panel = ensurePlanetSignificationPanel();
    if (!panel) return;
    // Nakshatra stories must not retain House / Planet-in-House / BAV sections.
    hideHouseBasedSectionsForNatalResult(panel);
    var title = panel.querySelector(".jtt-planet-signification-title");
    var body = panel.querySelector(".jtt-planet-signification-body");
    var meta = panel.querySelector(".jtt-nakshatra-story-meta");
    if (!meta) {
      meta = document.createElement("div");
      meta.className = "jtt-nakshatra-story-meta";
      title.insertAdjacentElement("afterend", meta);
    }

    title.textContent = requestedName;
    meta.hidden = false;
    meta.textContent = "Loading deity details…";
    body.textContent = "Loading Nakshatra deity story…";
    panel.hidden = false;
    panel.classList.add("is-nakshatra-story");
    panel.classList.remove("is-visible");
    void panel.offsetWidth;
    panel.classList.add("is-visible");

    loadNakshatraStories().then(function (entries) {
      if (activeNakshatraStory !== requestedName || !panel.isConnected) return;
      var canonicalName = normalizeLattaNakshatra(requestedName) || requestedName;
      var entry = entries.find(function (item) {
        var storedName = normalizeLattaNakshatra(item.name) || item.name;
        return String(storedName || "").toLowerCase() === canonicalName.toLowerCase();
      });
      if (!entry) {
        meta.textContent = "Deity information unavailable";
        body.textContent = "No story is available for this Nakshatra.";
        return;
      }
      title.textContent = entry.name;
      meta.textContent = "Lord: " + (entry.lord || "—") + "   ·   Deity: " + (entry.deity || "—");
      body.textContent = entry.story || "No story is available for this Nakshatra.";
      if (entry.textualBackground || entry.sourceNotes) {
        var source = document.createElement("div");
        source.className = "jtt-nakshatra-story-source";
        if (entry.textualBackground) {
          var background = document.createElement("div");
          background.textContent = "Textual background: " + entry.textualBackground;
          source.appendChild(background);
        }
        if (entry.sourceNotes) {
          var note = document.createElement("div");
          note.textContent = entry.sourceNotes;
          source.appendChild(note);
        }
        body.appendChild(source);
      }
    }).catch(function (error) {
      if (activeNakshatraStory !== requestedName || !panel.isConnected) return;
      meta.textContent = "Story unavailable";
      body.textContent = "Nakshatra deity story could not be loaded. Please try again.";
      console.error("Jupiter Astro: Unable to load Nakshatra deity stories.", error);
    });

    // The shared hover manager starts the 10-second closing delay only after
    // the pointer/focus leaves both the trigger and the story panel.
  }

  function bindNakshatraStoryPanel(panel) {
    if (!panel || panel.dataset.nakshatraStoryEvents === "true") return;
    panel.dataset.nakshatraStoryEvents = "true";
    panel.addEventListener("pointerenter", function () {
      if (window.JAHoverManager) window.JAHoverManager.keepOpen("nakshatra-story");
    });
    panel.addEventListener("pointerleave", function () {
      if (window.JAHoverManager) window.JAHoverManager.leave("nakshatra-story", 10000);
    });
    panel.addEventListener("focusin", function () {
      if (window.JAHoverManager) window.JAHoverManager.keepOpen("nakshatra-story");
    });
    panel.addEventListener("focusout", function (event) {
      if (!panel.contains(event.relatedTarget) && window.JAHoverManager) {
        window.JAHoverManager.leave("nakshatra-story", 10000);
      }
    });
  }

  var nakStoryOpenTimer = null;
  function bindNakshatraStoryHover(host) {
    if (!host || host.dataset.nakshatraStoryHover === "true") return;
    host.dataset.nakshatraStoryHover = "true";

    // Hovering any Nakshatra value opens its story. Delegation keeps this
    // working when the transit table is rebuilt from Google Sheet data.
    host.addEventListener("pointerover", function (event) {
      var trigger = event.target && event.target.closest
        ? event.target.closest(".jtt-nakshatra-story-trigger") : null;
      if (!trigger || !host.contains(trigger)) return;
      if (event.relatedTarget && trigger.contains(event.relatedTarget)) return;
      if (window.JAHoverManager) {
        window.JAHoverManager.activate("nakshatra-story", function () {
          if (trigger.isConnected) showNakshatraStory(trigger.getAttribute("data-jtt-nakshatra-story"));
        }, function () { hideNakshatraStory(true); }, 300);
      } else {
        clearTimeout(nakStoryOpenTimer);
        nakStoryOpenTimer = setTimeout(function () { if (trigger.isConnected) showNakshatraStory(trigger.getAttribute("data-jtt-nakshatra-story")); }, 300);
      }
    });
    host.addEventListener("pointerout", function (event) {
      var trigger = event.target && event.target.closest
        ? event.target.closest(".jtt-nakshatra-story-trigger") : null;
      if (!trigger || !host.contains(trigger) || event.relatedTarget && (trigger.contains(event.relatedTarget) || event.relatedTarget.closest && event.relatedTarget.closest(".jtt-planet-signification-panel"))) return;
      clearTimeout(nakStoryOpenTimer);
      if (window.JAHoverManager) window.JAHoverManager.leave("nakshatra-story", 10000);
    });
    host.addEventListener("focusin", function (event) {
      var trigger = event.target && event.target.closest
        ? event.target.closest(".jtt-nakshatra-story-trigger") : null;
      if (!trigger || !host.contains(trigger)) return;
      if (window.JAHoverManager) window.JAHoverManager.activate("nakshatra-story", function () {
        showNakshatraStory(trigger.getAttribute("data-jtt-nakshatra-story"));
      }, function () { hideNakshatraStory(true); }, 0);
      else showNakshatraStory(trigger.getAttribute("data-jtt-nakshatra-story"));
    });
    host.addEventListener("focusout", function (event) {
      if (event.target.closest && event.target.closest(".jtt-nakshatra-story-trigger") &&
          !(event.relatedTarget && event.relatedTarget.closest && event.relatedTarget.closest(".jtt-planet-signification-panel")) &&
          window.JAHoverManager) window.JAHoverManager.leave("nakshatra-story", 10000);
    });
    host.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      var trigger = event.target && event.target.closest
        ? event.target.closest(".jtt-nakshatra-story-trigger") : null;
      if (!trigger || !host.contains(trigger)) return;
      event.preventDefault();
      if (window.JAHoverManager) window.JAHoverManager.activate("nakshatra-story", function () {
        showNakshatraStory(trigger.getAttribute("data-jtt-nakshatra-story"));
      }, function () { hideNakshatraStory(true); }, 0);
      else showNakshatraStory(trigger.getAttribute("data-jtt-nakshatra-story"));
    });
  }

  document.addEventListener("click", function (event) {
    if (!activeNakshatraStory || !windowEl || !openState()) return;
    var target = event.target;
    if (target && target.closest && (
      target.closest(".jtt-nakshatra-story-trigger") ||
      target.closest(".jtt-planet-signification-panel")
    )) return;
    hideNakshatraStory(false);
  }, true);

  var houseSignificationsPromise = null;
  var houseSignificationBoundHosts = new WeakSet();

  function loadHouseSignifications() {
    if (!houseSignificationsPromise) {
      houseSignificationsPromise = fetch("/data/house-significations.json", {
        credentials: "same-origin",
        cache: "force-cache"
      }).then(function (response) {
        if (!response.ok) throw new Error("House signification database returned HTTP " + response.status);
        return response.json();
      }).then(function (database) {
        if (!database || !Array.isArray(database.houses)) {
          throw new Error("House signification database has an invalid structure.");
        }
        return database.houses;
      }).catch(function (error) {
        houseSignificationsPromise = null;
        throw error;
      });
    }
    return houseSignificationsPromise;
  }

  function clearNakshatraStoryForOtherSignification() {
    clearNakshatraStoryTimer();
    activeNakshatraStory = null;
    if (activePlanetSignification && String(activePlanetSignification).indexOf("nakshatra:") === 0) {
      activePlanetSignification = null;
    }
    nakshatraStoryDeadline = 0;
    nakshatraStoryRemaining = 10000;
    nakshatraStoryPaused = false;
    var panel = windowEl && windowEl.querySelector(".jtt-planet-signification-panel");
    if (!panel) return;
    var meta = panel.querySelector(".jtt-nakshatra-story-meta");
    if (meta) meta.hidden = true;
    panel.classList.remove("is-nakshatra-story");
  }

  var transitPlanetHouseResultsPromise = null;
  function loadTransitPlanetHouseResults() {
    if (!transitPlanetHouseResultsPromise) {
      transitPlanetHouseResultsPromise = fetch("/data/transit-planet-house-results.json", {
        credentials: "same-origin", cache: "force-cache"
      }).then(function (response) {
        if (!response.ok) throw new Error("Planet-in-house transit database returned HTTP " + response.status);
        return response.json();
      }).then(function (data) {
        if (!data || !data.planets) throw new Error("Planet-in-house transit database has an invalid structure.");
        return data.planets;
      }).catch(function (error) {
        transitPlanetHouseResultsPromise = null;
        throw error;
      });
    }
    return transitPlanetHouseResultsPromise;
  }

  function ensureTransitPlanetHouseSection(panel) {
    if (!panel) return null;
    var section = panel.querySelector(".jtt-transit-planet-house-section");
    if (section) return section;
    var divider = document.createElement("div");
    divider.className = "jtt-transit-planet-house-divider";
    divider.setAttribute("role", "separator");
    var section = document.createElement("section");
    section.className = "jtt-transit-planet-house-section";
    section.hidden = true;
    section.setAttribute("aria-live", "polite");
    section.innerHTML = '<div class="jtt-transit-planet-house-heading"></div><div class="jtt-transit-planet-house-content"></div>';
    var bavSection = ensureBavTransitResultSection(panel);
    if (bavSection && bavSection.parentNode === panel) {
      bavSection.insertAdjacentElement("afterend", divider);
    } else {
      var body = panel.querySelector(".jtt-planet-signification-body");
      if (!body) return null;
      body.insertAdjacentElement("afterend", divider);
    }
    divider.insertAdjacentElement("afterend", section);
    return section;
  }

  function showTransitPlanetHouseResult(panel, planet, houseNumber) {
    if (!panel || !planet || !Number.isInteger(houseNumber) || houseNumber < 1 || houseNumber > 12) return;
    var section = ensureTransitPlanetHouseSection(panel);
    if (!section) return;
    var heading = section.querySelector(".jtt-transit-planet-house-heading");
    var content = section.querySelector(".jtt-transit-planet-house-content");
    var divider = panel.querySelector(".jtt-transit-planet-house-divider");
    var requestKey = planet + ":" + houseNumber;
    section.setAttribute("data-transit-planet-house-request", requestKey);
    heading.textContent = "Tr " + planet + " " + houseNumber + "H";
    content.textContent = "Loading transit interpretation…";
    divider.hidden = false;
    section.hidden = false;
    loadTransitPlanetHouseResults().then(function (results) {
      if (!section.isConnected || section.hidden ||
          section.getAttribute("data-transit-planet-house-request") !== requestKey) return;
      var result = results[planet] && results[planet][String(houseNumber)];
      content.textContent = result || "No planet-in-house transit interpretation is available.";
    }).catch(function (error) {
      if (!section.isConnected || section.getAttribute("data-transit-planet-house-request") !== requestKey) return;
      content.textContent = "Planet-in-house transit interpretation could not be loaded.";
      console.error("Jupiter Astro: Unable to load planet-in-house transit interpretations.", error);
    });
  }

  function showHouseSignification(houseNumber, planet, source, bavScore) {
    clearNakshatraStoryForOtherSignification();
    var houseKey = "house:" + source + ":" + houseNumber + ":" + (planet || "");
    clearPlanetSignificationTimers();
    activePlanetSignification = houseKey;

    var panel = ensurePlanetSignificationPanel();
    if (!panel) return;

    var title = panel.querySelector(".jtt-planet-signification-title");
    var body = panel.querySelector(".jtt-planet-signification-body");
    var storyMeta = panel.querySelector(".jtt-nakshatra-story-meta");
    if (storyMeta) storyMeta.hidden = true;
    panel.classList.remove("is-nakshatra-story");
    title.textContent = "House " + houseNumber;
    body.textContent = "Loading house signification…";
    panel.hidden = false;
    panel.classList.remove("is-visible");
    void panel.offsetWidth;
    panel.classList.add("is-visible");
    showTransitPlanetHouseResult(panel, planet, houseNumber);
    var bavSection = ensureBavTransitResultSection(panel);
    var bavDivider = panel.querySelector(".jtt-bav-result-divider");
    if (source === "moon" && bavScore !== null && bavScore !== undefined && bavScore !== "") {
      showBavTransitResult({
        getAttribute: function (name) {
          if (name === "data-bav-result-planet") return planet;
          if (name === "data-bav-result-score") return String(bavScore);
          if (name === "data-bav-result-house") return String(houseNumber);
          return null;
        }
      }, true);
    } else if (bavSection) {
      bavSection.hidden = true;
      if (bavDivider) bavDivider.hidden = true;
      panel.classList.remove("has-bav-result");
    }
    if (bavSection) {
      var planetHouseSection = ensureTransitPlanetHouseSection(panel);
      var planetHouseDivider = panel.querySelector(".jtt-transit-planet-house-divider");
      if (planetHouseDivider && planetHouseSection) {
        bavDivider = panel.querySelector(".jtt-bav-result-divider");
        if (bavDivider) planetHouseSection.insertAdjacentElement("afterend", bavDivider);
        if (bavDivider) bavDivider.insertAdjacentElement("afterend", bavSection);
      }
    }

    loadHouseSignifications().then(function (houses) {
      if (activePlanetSignification !== houseKey || !panel.isConnected) return;
      var entry = houses.find(function (item) {
        return Number(item.house) === houseNumber;
      });
      title.textContent = entry
        ? entry.name + " House · " + houseNumber + "H"
        : "House " + houseNumber;
      body.textContent = entry && entry.description
        ? entry.description
        : "No house signification is available.";
    }).catch(function (error) {
      if (activePlanetSignification !== houseKey || !panel.isConnected) return;
      body.textContent = "House signification could not be loaded.";
      console.error("Jupiter Astro: Unable to load house significations.", error);
    });
  }

  var activeTransitBasicTooltip = null;
  var transitBasicTooltipHideTimer = null;

  function removeTransitBasicTooltip() {
    if (window.JAHoverManager) window.JAHoverManager.untrack("transit-basic");
    if (transitBasicTooltipHideTimer) {
      clearTimeout(transitBasicTooltipHideTimer);
      transitBasicTooltipHideTimer = null;
    }
    if (activeTransitBasicTooltip) activeTransitBasicTooltip.remove();
    activeTransitBasicTooltip = null;
  }

  function scheduleTransitBasicTooltipHide() {
    if (transitBasicTooltipHideTimer) clearTimeout(transitBasicTooltipHideTimer);
    transitBasicTooltipHideTimer = setTimeout(removeTransitBasicTooltip, 1000);
  }

  function showTransitBasicTooltip(trigger) {
    var houseNumber = Number(trigger.getAttribute("data-result-house"));
    var planet = trigger.getAttribute("data-result-planet");
    if (!Number.isInteger(houseNumber) || houseNumber < 1 || houseNumber > 12) return;

    var api = window.JupiterTransitTimeline &&
      window.JupiterTransitTimeline.transitResultBasic;
    var result = api && typeof api.getResult === "function"
      ? api.getResult(planet, houseNumber) : null;

    removeTransitBasicTooltip();
    if (!result || !result.result) return;

    var tooltip = document.createElement("div");
    tooltip.className = "jtt-transit-result-tooltip";
    tooltip.setAttribute("role", "tooltip");

    var heading = document.createElement("div");
    heading.className = "jtt-transit-result-heading";
    heading.textContent = "Basic · " + (result.planet || planet) +
      " · " + (result.house || houseNumber) + "H";

    var description = document.createElement("div");
    description.className = "jtt-transit-result-description";
    description.textContent = result.result;
    tooltip.appendChild(heading);
    tooltip.appendChild(description);

    var computed = getComputedStyle(windowEl);
    [
      "--jtt-bg", "--jtt-panel", "--jtt-panel-alt", "--jtt-ink",
      "--jtt-muted", "--jtt-line", "--jtt-line-strong", "--jtt-accent",
      "--jtt-accent-soft"
    ].forEach(function (property) {
      tooltip.style.setProperty(property, computed.getPropertyValue(property).trim());
    });

    tooltip.style.visibility = "hidden";
    tooltip.style.left = "8px";
    tooltip.style.top = "8px";
    windowEl.appendChild(tooltip);
    activeTransitBasicTooltip = tooltip;

    var windowRect = windowEl.getBoundingClientRect();
    var triggerRect = trigger.getBoundingClientRect();
    var tipRect = tooltip.getBoundingClientRect();
    var maxLeft = Math.max(8, windowEl.clientWidth - tipRect.width - 8);
    var left = Math.max(8, Math.min(triggerRect.left - windowRect.left, maxLeft));
    var maxTop = Math.max(8, windowEl.clientHeight - tipRect.height - 8);
    var top = triggerRect.bottom - windowRect.top + 8;
    if (top > maxTop) top = triggerRect.top - windowRect.top - tipRect.height - 8;
    top = Math.max(8, Math.min(top, maxTop));
    tooltip.style.left = Math.round(left) + "px";
    tooltip.style.top = Math.round(top) + "px";
    tooltip.style.visibility = "visible";
    tooltip.addEventListener("pointerenter", function () {
      if (window.JAHoverManager) window.JAHoverManager.keepOpen("transit-signification");
      if (transitBasicTooltipHideTimer) clearTimeout(transitBasicTooltipHideTimer);
    });
    tooltip.addEventListener("pointerleave", function () {
      if (window.JAHoverManager) window.JAHoverManager.leave("transit-signification", 5000);
      scheduleTransitBasicTooltipHide();
    });
    if (window.JAHoverManager) window.JAHoverManager.track("transit-basic", removeTransitBasicTooltip);
  }

  var houseResultOpenTimer = null;
  function showTransitHouseDetails(target, houseNumber) {
    var planet = target.getAttribute("data-result-planet");
    var source = target.getAttribute("data-result-source") || "lagna";
    var bavScore = target.getAttribute("data-result-bav-score");
    showHouseSignification(houseNumber, planet, source, bavScore);
  }

  function bindHouseResultTooltips(host) {
    if (!host || houseSignificationBoundHosts.has(host)) return;
    houseSignificationBoundHosts.add(host);

    host.addEventListener("pointerover", function (event) {
      var target = event.target && event.target.closest
        ? event.target.closest(".jtt-house-result-trigger") : null;
      if (!target || !host.contains(target)) return;
      if (event.relatedTarget && target.contains(event.relatedTarget)) return;
      var houseNumber = Number(target.getAttribute("data-result-house"));
      if (!Number.isInteger(houseNumber) || houseNumber < 1 || houseNumber > 12) return;
      if (window.JAHoverManager) window.JAHoverManager.activate("transit-signification", function () {
        if (target.isConnected) { showTransitHouseDetails(target, houseNumber); showTransitBasicTooltip(target); }
      }, hidePlanetSignificationNow, 300);
      else {
        clearTimeout(houseResultOpenTimer);
        houseResultOpenTimer = setTimeout(function () { if (target.isConnected) { showTransitHouseDetails(target, houseNumber); showTransitBasicTooltip(target); } }, 300);
      }
    });
    host.addEventListener("pointerout", function (event) {
      var target = event.target && event.target.closest
        ? event.target.closest(".jtt-house-result-trigger") : null;
      if (!target || !host.contains(target)) return;
      if (event.relatedTarget && (target.contains(event.relatedTarget) ||
          event.relatedTarget.closest && event.relatedTarget.closest(".jtt-planet-signification-panel"))) return;
      clearTimeout(houseResultOpenTimer);
      if (window.JAHoverManager) window.JAHoverManager.leave("transit-signification", 5000);
      else { hidePlanetSignification(); scheduleTransitBasicTooltipHide(); }
    });

    host.addEventListener("focusin", function (event) {
      var target = event.target && event.target.closest
        ? event.target.closest(".jtt-house-result-trigger") : null;
      if (!target || !host.contains(target)) return;
      var houseNumber = Number(target.getAttribute("data-result-house"));
      if (!Number.isInteger(houseNumber) || houseNumber < 1 || houseNumber > 12) return;
      if (window.JAHoverManager) window.JAHoverManager.activate("transit-signification", function () {
        showTransitHouseDetails(target, houseNumber); showTransitBasicTooltip(target);
      }, hidePlanetSignificationNow, 0);
      else { showTransitHouseDetails(target, houseNumber); showTransitBasicTooltip(target); }
    });

    host.addEventListener("focusout", function (event) {
      var target = event.target && event.target.closest
        ? event.target.closest(".jtt-house-result-trigger") : null;
      if (!target || !host.contains(target)) return;
      if (event.relatedTarget && event.relatedTarget.closest &&
          event.relatedTarget.closest(".jtt-planet-signification-panel")) return;
      if (window.JAHoverManager) window.JAHoverManager.leave("transit-signification", 5000);
      else { hidePlanetSignification(); scheduleTransitBasicTooltipHide(); }
    });
  }

  // Planet significations are loaded only for the first-column hover feature.
  var planetSignificationsPromise = null;
  var activePlanetSignification = null;
  var planetSignificationHideTimer = null;
  var planetSignificationRemoveTimer = null;
  var planetSignificationBoundHosts = new WeakSet();
  var planetSignificationHoverTimer = null;

  function loadPlanetSignifications() {
    if (!planetSignificationsPromise) {
      planetSignificationsPromise = fetch("/data/planet-signification-reference.json", {
        credentials: "same-origin",
        cache: "force-cache"
      }).then(function (response) {
        if (!response.ok) throw new Error("Planet signification database returned HTTP " + response.status);
        return response.json();
      }).then(function (database) {
        if (!database || !database.planets || typeof database.planets !== "object") {
          throw new Error("Planet signification database has an invalid structure.");
        }
        return database.planets;
      }).catch(function (error) {
        planetSignificationsPromise = null;
        throw error;
      });
    }
    return planetSignificationsPromise;
  }

  function ensurePlanetSignificationPanel() {
    if (!windowEl) return null;
    var existing = windowEl.querySelector(".jtt-planet-signification-panel");
    if (existing) {
      bindNakshatraStoryPanel(existing);
      return existing;
    }

    var tablePanel = windowEl.querySelector("[data-jtt-transit-table]");
    if (!tablePanel || !tablePanel.parentNode) return null;

    var panel = document.createElement("section");
    panel.className = "jtt-planet-signification-panel";
    panel.setAttribute("aria-live", "polite");
    panel.setAttribute("aria-atomic", "true");
    panel.hidden = true;

    var title = document.createElement("div");
    title.className = "jtt-planet-signification-title";
    var body = document.createElement("div");
    body.className = "jtt-planet-signification-body";
    panel.appendChild(title);
    panel.appendChild(body);
    tablePanel.insertAdjacentElement("afterend", panel);
    panel.addEventListener("pointerenter", function () {
      if (window.JAHoverManager) window.JAHoverManager.keepOpen(panel.classList.contains("is-nakshatra-story") ? "nakshatra-story" : "transit-signification");
    });
    panel.addEventListener("pointerleave", function () {
      if (!window.JAHoverManager) return;
      if (panel.classList.contains("is-nakshatra-story")) window.JAHoverManager.leave("nakshatra-story", 10000);
      else window.JAHoverManager.leave("transit-signification", 5000);
    });
    panel.addEventListener("focusin", function () {
      if (window.JAHoverManager) window.JAHoverManager.keepOpen(panel.classList.contains("is-nakshatra-story") ? "nakshatra-story" : "transit-signification");
    });
    panel.addEventListener("focusout", function (event) {
      if (panel.contains(event.relatedTarget) || !window.JAHoverManager) return;
      if (panel.classList.contains("is-nakshatra-story")) window.JAHoverManager.leave("nakshatra-story", 10000);
      else window.JAHoverManager.leave("transit-signification", 5000);
    });
    bindNakshatraStoryPanel(panel);
    return panel;
  }

  function appendFormattedSignification(container, entry) {
    var text = String(entry.signification || "");
    var emphasis = Array.isArray(entry.emphasizedTerms) ? entry.emphasizedTerms : [];
    var italics = Array.isArray(entry.italicTerms) ? entry.italicTerms : [];
    var highlights = Array.isArray(entry.highlightedTerms) ? entry.highlightedTerms : [];
    var terms = Array.from(new Set(emphasis.concat(italics, highlights).filter(Boolean)))
      .sort(function (a, b) { return b.length - a.length; });

    if (!terms.length) {
      container.textContent = text;
      return;
    }

    var expression = new RegExp("(" + terms.map(function (term) {
      return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("|") + ")", "gi");
    var cursor = 0;
    var match;
    while ((match = expression.exec(text)) !== null) {
      if (match.index > cursor) {
        container.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      }
      var token = match[0];
      var node = document.createElement("span");
      var isEmphasized = emphasis.some(function (term) { return term.toLowerCase() === token.toLowerCase(); });
      var isItalic = italics.some(function (term) { return term.toLowerCase() === token.toLowerCase(); });
      var isHighlighted = highlights.some(function (term) { return term.toLowerCase() === token.toLowerCase(); });
      if (isEmphasized && isItalic) {
        var strongItalic = document.createElement("strong");
        var italic = document.createElement("em");
        italic.textContent = token;
        strongItalic.appendChild(italic);
        node.appendChild(strongItalic);
      } else if (isEmphasized) {
        var strong = document.createElement("strong");
        strong.textContent = token;
        node.appendChild(strong);
      } else if (isItalic) {
        var em = document.createElement("em");
        em.textContent = token;
        node.appendChild(em);
      } else {
        node.textContent = token;
      }
      if (isHighlighted) node.className = "jtt-signification-highlight";
      container.appendChild(node);
      cursor = match.index + token.length;
    }
    if (cursor < text.length) container.appendChild(document.createTextNode(text.slice(cursor)));
  }

  function clearPlanetSignificationTimers() {
    if (planetSignificationHideTimer) {
      clearTimeout(planetSignificationHideTimer);
      planetSignificationHideTimer = null;
    }
    if (planetSignificationRemoveTimer) {
      clearTimeout(planetSignificationRemoveTimer);
      planetSignificationRemoveTimer = null;
    }
  }

  function showPlanetSignification(planet) {
    clearNakshatraStoryForOtherSignification();
    clearPlanetSignificationTimers();
    activePlanetSignification = planet;
    var panel = ensurePlanetSignificationPanel();
    if (!panel) return;

    // Planetary signification must not retain House / Planet-in-House / BAV sections.
    hideHouseBasedSectionsForNatalResult(panel);
    var title = panel.querySelector(".jtt-planet-signification-title");
    var body = panel.querySelector(".jtt-planet-signification-body");
    var storyMeta = panel.querySelector(".jtt-nakshatra-story-meta");
    if (storyMeta) storyMeta.hidden = true;
    panel.classList.remove("is-nakshatra-story");
    title.textContent = planet;
    body.textContent = "Loading planetary signification…";
    panel.hidden = false;
    panel.classList.remove("is-visible");
    // Reflow makes repeated hover on the same panel restart the fade-in reliably.
    void panel.offsetWidth;
    panel.classList.add("is-visible");

    loadPlanetSignifications().then(function (planets) {
      if (activePlanetSignification !== planet || !panel.isConnected) return;
      var entry = planets[planet];
      if (!entry || !entry.signification) {
        body.textContent = "No signification is available for this planet.";
        return;
      }
      body.replaceChildren();
      if (entry.deity) {
        var deity = document.createElement("div");
        deity.className = "jtt-planet-signification-deity";
        deity.textContent = "Deity: " + entry.deity;
        body.appendChild(deity);
      }
      var sections = [
        { label: "Signification", value: entry.signification },
        { label: "Good Result", value: entry.goodResult },
        { label: "Bad Result", value: entry.badResult }
      ];
      sections.forEach(function (item) {
        if (!item.value) return;
        var section = document.createElement("section");
        section.className = "jtt-planet-signification-detail";
        var heading = document.createElement("strong");
        heading.textContent = item.label;
        var content = document.createElement("div");
        content.textContent = item.value;
        section.appendChild(heading);
        section.appendChild(content);
        body.appendChild(section);
      });
    }).catch(function (error) {
      if (activePlanetSignification !== planet || !panel.isConnected) return;
      body.textContent = "Planetary signification could not be loaded.";
      console.error("Jupiter Astro: Unable to load planetary significations.", error);
    });
  }

  function hidePlanetSignificationNow() {
    if (activePlanetSignification && activePlanetSignification.indexOf("bav:") === 0) {
      return;
    }
    clearPlanetSignificationTimers();
    activePlanetSignification = null;
    if (window.JAHoverManager) window.JAHoverManager.untrack("transit-signification");
    var panel = windowEl && windowEl.querySelector(".jtt-planet-signification-panel");
    if (panel) { panel.classList.remove("is-visible"); panel.hidden = true; }
    removeTransitBasicTooltip();
  }

  function hidePlanetSignification() {
    clearPlanetSignificationTimers();
    if (!activePlanetSignification) return;
    planetSignificationHideTimer = setTimeout(function () {
      var panel = ensurePlanetSignificationPanel();
      if (!panel) {
        activePlanetSignification = null;
        return;
      }
      panel.classList.remove("is-visible");
      activePlanetSignification = null;
      planetSignificationRemoveTimer = setTimeout(function () {
        if (!activePlanetSignification) panel.hidden = true;
      }, 260);
    }, 5000);
  }

  var transitOverNatalPlanetResultsPromise = null;

  function loadTransitOverNatalPlanetResults() {
    if (!transitOverNatalPlanetResultsPromise) {
      transitOverNatalPlanetResultsPromise = fetch("/data/transit-over-natal-planet-results.json", {
        credentials: "same-origin",
        cache: "force-cache"
      }).then(function (response) {
        if (!response.ok) throw new Error("Transit-over-natal-planet database returned HTTP " + response.status);
        return response.json();
      }).then(function (database) {
        if (!database || !database.results || typeof database.results !== "object") {
          throw new Error("Transit-over-natal-planet database has an invalid structure.");
        }
        return database.results;
      }).catch(function (error) {
        transitOverNatalPlanetResultsPromise = null;
        throw error;
      });
    }
    return transitOverNatalPlanetResultsPromise;
  }

  function getNatalPlanetMatch(row, sourceKey, natalPlanet) {
    var columns = {
      sign: { key: "natalPlanetsInSign", label: "Natal (Sign)" },
      nakshatra: { key: "natalPlanetsInNakshatra", label: "Natal (Nak.)" },
      navamsa: { key: "natalPlanetsInNavamsa", label: "Natal (D9)" }
    };
    var column = columns[sourceKey];
    if (!row || !column) return null;
    var items = Array.isArray(row[column.key]) ? row[column.key] : [];
    var match = items.find(function (item) {
      return String(item && item.name || "").trim() === natalPlanet;
    });
    return match ? { planet: natalPlanet, source: column.label } : null;
  }

  function hideHouseBasedSectionsForNatalResult(panel) {
    if (!panel) return;
    [
      ".jtt-transit-planet-house-divider",
      ".jtt-transit-planet-house-section",
      ".jtt-bav-result-divider",
      ".jtt-bav-result-section"
    ].forEach(function (selector) {
      panel.querySelectorAll(selector).forEach(function (element) { element.hidden = true; });
    });
    panel.classList.remove("has-bav-result");
  }

  function showTransitOverNatalPlanetResult(transitPlanet, row, sourceKey, natalPlanet) {
    if (!transitPlanet || !natalPlanet) return;
    var match = getNatalPlanetMatch(row, sourceKey, natalPlanet);
    if (!match) return;
    clearNakshatraStoryForOtherSignification();
    clearPlanetSignificationTimers();
    var requestKey = "transit-natal:" + transitPlanet + ":" + match.source + ":" + match.planet;
    activePlanetSignification = requestKey;

    var panel = ensurePlanetSignificationPanel();
    if (!panel) return;
    var title = panel.querySelector(".jtt-planet-signification-title");
    var body = panel.querySelector(".jtt-planet-signification-body");
    var storyMeta = panel.querySelector(".jtt-nakshatra-story-meta");
    if (storyMeta) storyMeta.hidden = true;
    panel.classList.remove("is-nakshatra-story");
    hideHouseBasedSectionsForNatalResult(panel);
    body.replaceChildren();
    title.textContent = "Transit of " + transitPlanet + " over Natal " + match.planet;
    panel.hidden = false;
    panel.classList.remove("is-visible");
    void panel.offsetWidth;
    panel.classList.add("is-visible");

    var source = document.createElement("div");
    source.className = "jtt-transit-natal-result-source";
    source.textContent = match.source;
    body.appendChild(source);

    var description = document.createElement("div");
    description.className = "jtt-transit-natal-result-description";
    description.textContent = "Loading transit-over-natal interpretation…";
    body.appendChild(description);

    loadTransitOverNatalPlanetResults().then(function (results) {
      if (activePlanetSignification !== requestKey || !panel.isConnected) return;
      var key = transitPlanet + match.planet;
      description.textContent = typeof results[key] === "string" && results[key]
        ? results[key]
        : "No interpretation is available for this planet pair.";
    }).catch(function (error) {
      if (activePlanetSignification !== requestKey || !panel.isConnected) return;
      description.textContent = "Transit-over-natal interpretation could not be loaded.";
      console.error("Jupiter Astro: Unable to load transit-over-natal-planet interpretations.", error);
    });
  }

  function bindPlanetSignificationHover(host) {
    if (!host || planetSignificationBoundHosts.has(host)) return;
    planetSignificationBoundHosts.add(host);

    function resolveTransitRow(trigger) {
      var rowElement = trigger.closest("tr");
      if (!rowElement) return null;
      var rowIndex = Array.prototype.indexOf.call(rowElement.parentNode.children, rowElement);
      var rows = window.__JA_TRANSIT_TIMELINE_CURRENT_ROWS;
      return Array.isArray(rows) ? rows[rowIndex] || null : null;
    }

    function activatePlanetReference(trigger, delay) {
      var planet = String(trigger.textContent || "").trim();
      if (!planet) return;
      var open = function () {
        showPlanetSignification(planet);
      };
      if (window.JAHoverManager) {
        window.JAHoverManager.activate("transit-signification", open, hidePlanetSignificationNow, delay);
      } else {
        clearTimeout(planetSignificationHoverTimer);
        planetSignificationHoverTimer = setTimeout(open, delay);
      }
    }

    function activateNatalMatch(trigger, delay) {
      var row = resolveTransitRow(trigger);
      var transitPlanet = row && String(row.planet || "").trim();
      var natalPlanet = trigger.getAttribute("data-natal-planet");
      var sourceKey = trigger.getAttribute("data-natal-source");
      if (!transitPlanet || !natalPlanet || !sourceKey) return;
      var open = function () {
        showTransitOverNatalPlanetResult(transitPlanet, row, sourceKey, natalPlanet);
      };
      if (window.JAHoverManager) {
        window.JAHoverManager.activate("transit-signification", open, hidePlanetSignificationNow, delay);
      } else {
        clearTimeout(planetSignificationHoverTimer);
        planetSignificationHoverTimer = setTimeout(open, delay);
      }
    }

    host.addEventListener("pointerover", function (event) {
      var planetTrigger = event.target && event.target.closest
        ? event.target.closest(".jtt-planet-signification-trigger") : null;
      if (planetTrigger && host.contains(planetTrigger)) {
        if (!event.relatedTarget || !planetTrigger.contains(event.relatedTarget)) activatePlanetReference(planetTrigger, 300);
        return;
      }
      var trigger = event.target && event.target.closest
        ? event.target.closest(".jtt-transit-natal-trigger") : null;
      if (!trigger || !host.contains(trigger)) return;
      if (event.relatedTarget && trigger.contains(event.relatedTarget)) return;
      activateNatalMatch(trigger, 300);
    });
    host.addEventListener("pointerout", function (event) {
      var planetTrigger = event.target && event.target.closest
        ? event.target.closest(".jtt-planet-signification-trigger") : null;
      if (planetTrigger && host.contains(planetTrigger)) {
        if (event.relatedTarget && (planetTrigger.contains(event.relatedTarget) ||
            event.relatedTarget.closest && event.relatedTarget.closest(".jtt-planet-signification-panel"))) return;
        clearTimeout(planetSignificationHoverTimer);
        if (window.JAHoverManager) window.JAHoverManager.leave("transit-signification", 5000);
        else hidePlanetSignification();
        return;
      }
      var trigger = event.target && event.target.closest
        ? event.target.closest(".jtt-transit-natal-trigger") : null;
      if (!trigger || !host.contains(trigger)) return;
      if (event.relatedTarget && (trigger.contains(event.relatedTarget) ||
          event.relatedTarget.closest && event.relatedTarget.closest(".jtt-planet-signification-panel"))) return;
      clearTimeout(planetSignificationHoverTimer);
      if (window.JAHoverManager) window.JAHoverManager.leave("transit-signification", 5000);
      else hidePlanetSignification();
    });
    host.addEventListener("focusin", function (event) {
      var planetTrigger = event.target && event.target.closest
        ? event.target.closest(".jtt-planet-signification-trigger") : null;
      if (planetTrigger && host.contains(planetTrigger)) {
        activatePlanetReference(planetTrigger, 0);
        return;
      }
      var trigger = event.target && event.target.closest
        ? event.target.closest(".jtt-transit-natal-trigger") : null;
      if (!trigger || !host.contains(trigger)) return;
      activateNatalMatch(trigger, 0);
    });
    host.addEventListener("focusout", function (event) {
      if (event.target.closest && event.target.closest(".jtt-planet-signification-trigger") &&
          !(event.relatedTarget && event.relatedTarget.closest && event.relatedTarget.closest(".jtt-planet-signification-panel")) &&
          window.JAHoverManager) window.JAHoverManager.leave("transit-signification", 5000);
      if (event.target.closest && event.target.closest(".jtt-transit-natal-trigger") &&
          !(event.relatedTarget && event.relatedTarget.closest && event.relatedTarget.closest(".jtt-planet-signification-panel")) &&
          window.JAHoverManager) window.JAHoverManager.leave("transit-signification", 5000);
    });
  }
  var bavTransitResultsPromise = null;
  function loadBavTransitResults() {
    if (!bavTransitResultsPromise) {
      bavTransitResultsPromise = fetch("/data/bav-transit-results.json", {
        credentials: "same-origin", cache: "force-cache"
      }).then(function (response) {
        if (!response.ok) throw new Error("BAV transit result database returned HTTP " + response.status);
        return response.json();
      }).then(function (data) {
        if (!data || !data.planets) throw new Error("BAV transit result database has an invalid structure.");
        return data.planets;
      }).catch(function (error) {
        bavTransitResultsPromise = null;
        throw error;
      });
    }
    return bavTransitResultsPromise;
  }

  function ensureBavTransitResultSection(panel) {
    if (!panel) return null;
    var section = panel.querySelector(".jtt-bav-result-section");
    if (section) return section;
    var divider = document.createElement("div");
    divider.className = "jtt-bav-result-divider";
    divider.setAttribute("role", "separator");
    var section = document.createElement("section");
    section.className = "jtt-bav-result-section";
    section.hidden = true;
    section.setAttribute("aria-live", "polite");
    section.innerHTML = '<div class="jtt-bav-result-heading"><strong></strong><button type="button" class="jtt-bav-result-close" aria-label="Hide BAV interpretation">×</button></div><div class="jtt-bav-result-content"></div>';
    section.querySelector(".jtt-bav-result-close").addEventListener("click", function () {
      section.hidden = true;
      divider.hidden = true;
      panel.classList.remove("has-bav-result");
      if (activePlanetSignification && activePlanetSignification.indexOf("bav:") === 0) {
        activePlanetSignification = null;
      }
    });
    var body = panel.querySelector(".jtt-planet-signification-body");
    if (!body) return null;
    body.insertAdjacentElement("afterend", divider);
    divider.insertAdjacentElement("afterend", section);
    return section;
  }

  function showBavTransitResult(trigger, preserveHouseSelection) {
    var planet = trigger.getAttribute("data-bav-result-planet");
    var score = Number(trigger.getAttribute("data-bav-result-score"));
    var house = trigger.getAttribute("data-bav-result-house");
    if (!planet || !Number.isInteger(score) || score < 0 || score > 8) return;
    var panel = ensurePlanetSignificationPanel();
    if (!panel) return;
    var section = ensureBavTransitResultSection(panel);
    if (!section) return;
    var divider = panel.querySelector(".jtt-bav-result-divider");
    var title = section.querySelector(".jtt-bav-result-heading strong");
    var content = section.querySelector(".jtt-bav-result-content");
    var requestKey = planet + ":" + score + ":" + house;
    if (!preserveHouseSelection) {
      clearPlanetSignificationTimers();
      activePlanetSignification = "bav:" + requestKey;
      removeTransitBasicTooltip();
    }
    section.setAttribute("data-bav-request", requestKey);
    title.textContent = planet + " — BAV " + score + (house ? " · " + house + "H" : "");
    content.textContent = "Loading transit interpretation…";
    divider.hidden = false;
    section.hidden = false;
    panel.classList.add("has-bav-result");
    panel.hidden = false;
    panel.classList.remove("is-visible");
    void panel.offsetWidth;
    panel.classList.add("is-visible");
    loadBavTransitResults().then(function (results) {
      if (!section.isConnected || section.hidden || section.getAttribute("data-bav-request") !== requestKey) return;
      var interpretation = results[planet] && results[planet][String(score)];
      content.replaceChildren();
      if (!interpretation) {
        content.textContent = "No interpretation is available for this planet and BAV score.";
        return;
      }
      String(interpretation).split(/\n+/).filter(Boolean).forEach(function (paragraph) {
        var p = document.createElement("p");
        p.textContent = paragraph;
        content.appendChild(p);
      });
    }).catch(function (error) {
      if (!section.isConnected || section.getAttribute("data-bav-request") !== requestKey) return;
      content.textContent = "BAV transit interpretation could not be loaded.";
      console.error("Jupiter Astro: Unable to load BAV transit interpretations.", error);
    });
  }

  function bindBavTransitResultTriggers(host) {
    if (!host || host.__jttBavResultBound) return;
    host.__jttBavResultBound = true;
    function activateBavColumnResult(trigger) {
      var source = trigger.getAttribute("data-bav-result-source") || "moon";
      var planet = trigger.getAttribute("data-bav-result-planet");
      var score = trigger.getAttribute("data-bav-result-score");
      var house = Number(trigger.getAttribute("data-bav-result-house"));
      if (source !== "moon" || !planet || !Number.isInteger(house) || house < 1 || house > 12) return;
      showHouseSignification(house, planet, source, score);
    }
    host.addEventListener("click", function (event) {
      var trigger = event.target && event.target.closest ? event.target.closest(".jtt-bav-result-trigger") : null;
      if (!trigger || !host.contains(trigger)) return;
      activateBavColumnResult(trigger);
    });
    host.addEventListener("keydown", function (event) {
      var trigger = event.target && event.target.closest ? event.target.closest(".jtt-bav-result-trigger") : null;
      if (!trigger || !host.contains(trigger) || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      activateBavColumnResult(trigger);
    });
  }

  var durationStatusText = "Duration updated for all planets";
  var durationStatusSignature = null;

  function showDurationStatusToast() {
    ensureInfoToastService().show(durationStatusText, {
      variant: durationStatusText.indexOf("Duration incomplete") === 0 ? "warning" : "success",
      duration: 2000
    });
  }

  function renderTransitTableFromContext() {
    if (!windowEl) return;
    var host = windowEl.querySelector("[data-jtt-table-scroll]");
    if (!host) return;

    var context = window.JupiterTransitTimelineContext;
    if (!context || typeof context.getTransitTableData !== "function") {
      host.innerHTML = '<div class="jtt-table-empty">Open or select a Research Kundali to populate the planetary transit table.</div>';
      return;
    }

    try {
      removeDurationTooltip();
      var transitData = context.getTransitTableData();
      var durationInfo = windowEl.querySelector("[data-jtt-duration-update-info]");
      var expectedPlanets = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
      var durationRows = transitData && Array.isArray(transitData.rows) ? transitData.rows : [];
      var missingDurationItems = [];
      expectedPlanets.forEach(function (planet) {
        var row = durationRows.find(function (item) { return item && item.planet === planet; });
        ["Sign", "Nakshatra", "Navamsa"].forEach(function (division) {
          var field = division.toLowerCase() + "Duration";
          if (!row || !row[field] || !row[field].startText || !row[field].endText) {
            missingDurationItems.push(planet + " (" + division + ")");
          }
        });
      });
      durationStatusText = missingDurationItems.length
        ? "Duration incomplete — missing: " + missingDurationItems.join(", ")
        : "Duration updated for all planets";
      if (durationInfo) {
        durationInfo.hidden = true;
        durationInfo.textContent = durationStatusText;
        durationInfo.classList.toggle("is-incomplete", missingDurationItems.length > 0);
      }
      var statusSignature = JSON.stringify({
        evalMs: transitData && transitData.evalMs,
        rows: expectedPlanets.map(function (planet) {
          var row = durationRows.find(function (item) { return item && item.planet === planet; });
          return [planet, row && row.signDuration, row && row.nakshatraDuration, row && row.navamsaDuration];
        })
      });
      if (statusSignature !== durationStatusSignature) {
        durationStatusSignature = statusSignature;
        showDurationStatusToast();
      }
      var moonRow = transitData && Array.isArray(transitData.rows)
        ? transitData.rows.find(function (row) { return row && row.planet === "Moon"; })
        : null;
      if (moonRow) {
        var suppressPrashnaResult = transitData.isPrashnaChart === true &&
          isSameMinute(transitData.birthMs, transitData.evalMs);
        moonRow.murti = suppressPrashnaResult ? "" : moonTransitMatrixResult(transitData);
      }
      host.innerHTML = renderTransitTable(transitData);
      if (!moonTransitMatrix && !moonTransitMatrixLoadFailed) {
        loadMoonTransitMatrix().then(function (matrix) {
          if (matrix && windowEl && windowEl.classList.contains("jtt-open")) renderTransitTableFromContext();
        });
      }
      bindDurationTooltips(host);
      bindHouseResultTooltips(host);
      bindBavTransitResultTriggers(host);
      bindPlanetSignificationHover(host);
      bindNakshatraStoryHover(host);
      ensurePlanetSignificationPanel();
    } catch (error) {
      console.error("Transit Timeline could not render the planetary table.", error);
      host.innerHTML = '<div class="jtt-table-empty is-error">Unable to load planetary transit data. Check the active Research Kundali.</div>';
    }
  }

  function syncFromContext() {
    if (!windowEl) return;
    var snapshot = readContextSnapshot();
    syncChartSelector(snapshot);
    var dateInput = windowEl.querySelector('[data-jtt-field="date"]');
    var timeInput = windowEl.querySelector('[data-jtt-field="time"]');
    var dasha = windowEl.querySelector("[data-jtt-dasha]");
    var chartTitle = windowEl.querySelector("[data-jtt-chart-title]");
    var janma = windowEl.querySelector("[data-jtt-janma]");
    var selected = windowEl.querySelector("[data-jtt-selected]");

    if (!snapshot || !Number.isFinite(Number(snapshot.evalMs))) {
      if (dasha) dasha.textContent = "—";
      if (chartTitle) chartTitle.textContent = "No active Research Kundali";
      if (janma) janma.textContent = "—";
      if (selected) selected.textContent = "Waiting for a connected Kundali";
      setNotice("", false);
      renderTransitTableFromContext();
      if (dateInput && !dateInput.value) dateInput.value = dateInputValue(new Date());
      if (timeInput && !timeInput.value) timeInput.value = timeInputValue(new Date());
      return;
    }

    var date = new Date(Number(snapshot.evalMs));
    if (!Number.isFinite(date.getTime())) return;

    if (dateInput) dateInput.value = dateInputValue(date);
    if (timeInput) timeInput.value = timeInputValue(date);
    if (dasha) {
      if (Array.isArray(snapshot.dashaSequence) && snapshot.dashaSequence.length) {
        dasha.replaceChildren();
        snapshot.dashaSequence.forEach(function (item, index) {
          if (index) dasha.appendChild(document.createTextNode(" - "));
          dasha.appendChild(document.createTextNode(item.lord || ""));
          if (Number.isInteger(Number(item.tara)) && Number(item.tara) >= 1 && Number(item.tara) <= 9) {
            var tara = document.createElement("span");
            tara.className = "jtt-dasha-tara";
            tara.textContent = " (" + item.tara + ")";
            dasha.appendChild(tara);
          }
        });
      } else {
        dasha.textContent = snapshot.dasha || "—";
      }
    }
    if (chartTitle) chartTitle.textContent = snapshot.chartTitle || "Active Research Kundali";
    if (janma) janma.textContent = snapshot.janmaRashi || "—";
    if (selected) selected.textContent = "Evaluation: " + displayDateTime(Number(snapshot.evalMs));
    setNotice("", false);
    renderTransitTableFromContext();
  }

  function readControlsTimestamp() {
    if (!windowEl) return null;
    var dateInput = windowEl.querySelector('[data-jtt-field="date"]');
    var timeInput = windowEl.querySelector('[data-jtt-field="time"]');
    if (!dateInput || !timeInput || !dateInput.value || !timeInput.value) return null;

    var dateMatch = dateInput.value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    var timeParts = timeInput.value.split(":").map(Number);
    if (!dateMatch || timeParts.length < 2) return null;

    var day = Number(dateMatch[1]);
    var month = Number(dateMatch[2]);
    var year = Number(dateMatch[3]);
    if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return null;

    var date = new Date(
      year, month - 1, day,
      timeParts[0] || 0, timeParts[1] || 0, 0, 0
    );
    // Reject impossible dates instead of allowing JavaScript to roll them over.
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 ||
        date.getDate() !== day) return null;
    return Number.isFinite(date.getTime()) ? date.getTime() : null;
  }

  function applyEvaluationTime(ms) {
    var timestamp = Number(ms);
    if (!Number.isFinite(timestamp) || !Number.isFinite(new Date(timestamp).getTime())) {
      setNotice("Enter a valid date and time.", true);
      return false;
    }

    var context = window.JupiterTransitTimelineContext;
    if (!context || typeof context.setEvaluationTime !== "function" ||
        !readContextSnapshot()) {
      setNotice("Open a Research Kundali first to connect the timeline controls.", true);
      return false;
    }

    try {
      context.setEvaluationTime(timestamp);
      syncFromContext();
      return true;
    } catch (error) {
      // The shared timestamp is assigned before the Research Kundali refreshes
      // its Planetary Transits tab. A rendering error after that assignment
      // must not be reported as a failed time update or break Timeline sync.
      try {
        var latestSnapshot = context.getSnapshot();
        if (latestSnapshot && Number(latestSnapshot.evalMs) === timestamp) {
          console.warn(
            "Evaluation time was updated; a Planetary Transits refresh raised an error.",
            error
          );
          syncFromContext();
          return true;
        }
      } catch (syncError) {
        console.warn("Transit Timeline could not refresh after the time update.", syncError);
      }

      console.error("Transit Timeline could not update the selected evaluation time.", error);
      setNotice("Unable to update the Planetary Transits evaluation time.", true);
      return false;
    }
  }

  function updateFromFields() {
    var timestamp = readControlsTimestamp();
    if (timestamp === null) {
      setNotice("Enter a valid date and time.", true);
      return;
    }
    applyEvaluationTime(timestamp);
  }

  function stepDate(days, years) {
    var timestamp = readControlsTimestamp();
    var date = new Date(timestamp === null ? Date.now() : timestamp);
    if (years) date.setFullYear(date.getFullYear() + years);
    else date.setDate(date.getDate() + days);
    applyEvaluationTime(date.getTime());
  }

  function stepTime(minutes) {
    var timestamp = readControlsTimestamp();
    var date = new Date(timestamp === null ? Date.now() : timestamp);
    date.setMinutes(date.getMinutes() + minutes);
    applyEvaluationTime(date.getTime());
  }

  function createWindow() {
    if (windowEl) return;

    windowEl = document.createElement("section");
    windowEl.id = WINDOW_ID;
    windowEl.setAttribute("role", "dialog");
    windowEl.setAttribute("aria-label", "Jupiter Astro Transit Timeline");
    windowEl.setAttribute("aria-modal", "false");
    windowEl.setAttribute("aria-hidden", "true");

    windowEl.innerHTML =
      '<header class="jtt-titlebar" data-jtt-drag-handle>' +
        '<div class="jtt-window-controls" aria-label="Window controls">' +
          '<button class="jtt-dot close" type="button" data-jtt-action="close" title="Close Transit Timeline" aria-label="Close"></button>' +
          '<button class="jtt-dot minimize" type="button" data-jtt-action="minimize" title="Minimize Transit Timeline" aria-label="Minimize"></button>' +
          '<button class="jtt-dot maximize" type="button" data-jtt-action="maximize" title="Maximize or restore Transit Timeline" aria-label="Maximize"></button>' +
        '</div>' +
        '<div class="jtt-window-title">Jupiter Astro · Transit Timeline</div>' +
        '<div class="jtt-titlebar-tools">' +
          '<div class="jtt-info-wrap">' +
            '<button class="jtt-info-button" type="button" data-jtt-action="info" title="Transit Timeline information" aria-label="Transit Timeline information" aria-expanded="false">i</button>' +
          '</div>' +
          '<div class="jtt-global-export-wrap">' +
            '<button class="jtt-global-export-button" type="button" data-jtt-action="export-toggle" title="Copy or export planetary table" aria-label="Copy or export planetary table" aria-expanded="false" aria-controls="jtt-global-export-menu">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path></svg>' +
            '</button>' +
            '<div class="jtt-global-export-menu" id="jtt-global-export-menu" data-jtt-global-export-menu hidden>' +
              '<div class="jtt-global-export-heading">Planetary Table</div>' +
              '<button type="button" data-jtt-export-action="copy"><span>Copy table</span><kbd>TSV</kbd></button>' +
              '<button type="button" data-jtt-export-action="csv"><span>Download CSV</span><kbd>.csv</kbd></button>' +
              '<button type="button" data-jtt-export-action="tsv"><span>Download TSV</span><kbd>.tsv</kbd></button>' +
              '<button type="button" data-jtt-export-action="pdf"><span>Export PDF</span><kbd>.pdf</kbd></button>' +
            '</div>' +
          '</div>' +
          '<button class="jtt-tool-button" type="button" data-jtt-action="fullscreen" title="Enter full screen" aria-label="Enter full screen">⛶</button>' +
          '<button class="jtt-theme-toggle" type="button" data-jtt-action="theme" title="Switch appearance" aria-label="Switch appearance" aria-pressed="false"></button>' +
        '</div>' +
      '</header>' +
      '<main class="jtt-main">' +
        '<section class="jtt-unified-panel" aria-label="Active Kundali and transit evaluation">' +
          '<div class="jtt-context-card">' +
            '<div class="jtt-context-item jtt-active-kundali-item"><span>ACTIVE KUNDALI</span><strong data-jtt-chart-title>No active Research Kundali</strong><select data-jtt-chart-select aria-label="Select active Kundali" hidden></select></div>' +
            '<div class="jtt-context-item jtt-dasha-item"><span>RUNNING DASHA</span><strong data-jtt-dasha>—</strong></div>' +
          '</div>' +
          '<div class="jtt-unified-divider" aria-hidden="true"></div>' +
          '<div class="jtt-control-panel" aria-label="Transit evaluation controls">' +
            '<div class="jtt-fields-row">' +
              '<label class="jtt-field jtt-date-field"><span>Date</span><input type="text" data-jtt-field="date" aria-label="Transit date" placeholder="DD/MM/YYYY" inputmode="numeric" maxlength="10" autocomplete="off" spellcheck="false"></label>' +
              '<label class="jtt-field jtt-time-field"><span>Time</span><input type="time" data-jtt-field="time" aria-label="Transit time" step="60"></label>' +
              '<button class="jtt-now-button" type="button" data-jtt-action="now">Now</button>' +
            '</div>' +
            '<div class="jtt-stepper-row">' +
              '<div class="step-group" style="height:31px; margin-bottom:1px;">' +
                '<span class="group-label">Date:</span>' +
                '<button type="button" class="btn-step" data-tr-year="-1">-1y</button>' +
                '<button type="button" class="btn-step" data-tr-day="-30">-30d</button>' +
                '<button type="button" class="btn-step" data-tr-day="-7">-7d</button>' +
                '<button type="button" class="btn-step" data-tr-day="-1">-1d</button>' +
                '<button type="button" class="btn-step" data-tr-day="1">+1d</button>' +
                '<button type="button" class="btn-step" data-tr-day="7">+7d</button>' +
                '<button type="button" class="btn-step" data-tr-day="30">+30d</button>' +
                '<button type="button" class="btn-step" data-tr-year="1">+1y</button>' +
              '</div>' +
              '<div class="step-group" style="height:31px; margin-bottom:1px;">' +
                '<span class="group-label">Time:</span>' +
                '<button type="button" class="btn-step" data-tr-min="-60">-1h</button>' +
                '<button type="button" class="btn-step" data-tr-min="-10">-10m</button>' +
                '<button type="button" class="btn-step" data-tr-min="-1">-1m</button>' +
                '<button type="button" class="btn-step" data-tr-min="1">+1m</button>' +
                '<button type="button" class="btn-step" data-tr-min="10">+10m</button>' +
                '<button type="button" class="btn-step" data-tr-min="60">+1h</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<div class="jtt-notice" role="status" aria-live="polite" hidden></div>' +
        '<div class="jtt-duration-update-info" data-jtt-duration-update-info role="status" aria-live="polite" hidden>Duration updated for all planets</div>' +
        '<section class="jtt-table-panel" data-jtt-transit-table aria-label="Core planetary transit table">' +
          '<div class="jtt-table-scroll" data-jtt-table-scroll>' +
            '<div class="jtt-table-empty">Open or select a Research Kundali to populate the planetary transit table.</div>' +
          '</div>' +
        '</section>' +
      '</main>';

    document.body.appendChild(windowEl);

    launcher = document.createElement("div");
    launcher.id = LAUNCHER_ID;
    launcher.innerHTML =
      '<button type="button" aria-label="Restore Transit Timeline">' +
        '<span>Transit Timeline</span><span aria-hidden="true">↗</span>' +
      '</button>';
    launcher.querySelector("button").addEventListener("click", restoreWindow);
    document.body.appendChild(launcher);

    windowEl.addEventListener("click", handleWindowClick);
    var dateInput = windowEl.querySelector('[data-jtt-field="date"]');
    var timeInput = windowEl.querySelector('[data-jtt-field="time"]');
    if (dateInput) dateInput.addEventListener("change", updateFromFields);
    if (timeInput) timeInput.addEventListener("change", updateFromFields);

    var chartSelect = windowEl.querySelector("[data-jtt-chart-select]");
    if (chartSelect) {
      chartSelect.addEventListener("change", function () {
        var registry = window.JupiterTransitTimelineCharts;
        if (registry && typeof registry.setActive === "function") {
          registry.setActive(chartSelect.value, true);
        }
      });
    }

    applyTheme(themeMode, false);
    enableDragging();
  }

  function openState() {
    return !!windowEl && windowEl.classList.contains("jtt-open");
  }

  async function openWindow() {
    var user = await waitForAuthReady();
    if (!currentUser() && !user) {
      showAuthPrompt();
      return false;
    }

    dismissAuthPrompt();
    createWindow();
    windowEl.classList.add("jtt-open");
    document.body.classList.add("jtt-window-open");
    windowEl.setAttribute("aria-hidden", "false");
    launcher.classList.remove("visible");
    syncFromContext();
    return true;
  }

  function closeWindow() {
    if (!windowEl) return;
    hideNakshatraStory(true);
    windowEl.classList.remove("jtt-open", "jtt-maximized");
    document.body.classList.remove("jtt-window-open");
    windowEl.setAttribute("aria-hidden", "true");
    launcher.classList.remove("visible");
    maximized = false;
  }

  function minimizeWindow() {
    if (!openState()) return;
    hideNakshatraStory(true);
    windowEl.classList.remove("jtt-open");
    document.body.classList.remove("jtt-window-open");
    launcher.classList.add("visible");
  }

  async function restoreWindow() {
    if (!windowEl) return false;
    var user = await waitForAuthReady();
    if (!currentUser() && !user) {
      showAuthPrompt();
      return false;
    }
    dismissAuthPrompt();
    windowEl.classList.add("jtt-open");
    document.body.classList.add("jtt-window-open");
    windowEl.setAttribute("aria-hidden", "false");
    launcher.classList.remove("visible");
    syncFromContext();
    return true;
  }

  function toggleMaximize() {
    if (!windowEl) return;
    if (!maximized) {
      var rect = windowEl.getBoundingClientRect();
      previousBounds = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
      // Clear any drag/restore inline bounds so the maximized CSS can fill the viewport.
      windowEl.style.left = "";
      windowEl.style.top = "";
      windowEl.style.width = "";
      windowEl.style.height = "";
      windowEl.style.transform = "";
      windowEl.classList.add("jtt-maximized");
      maximized = true;
    } else {
      windowEl.classList.remove("jtt-maximized");
      maximized = false;
      if (previousBounds) {
        windowEl.style.left = previousBounds.left + "px";
        windowEl.style.top = previousBounds.top + "px";
        windowEl.style.width = previousBounds.width + "px";
        windowEl.style.height = previousBounds.height + "px";
        windowEl.style.transform = "none";
      }
    }
  }

  function toggleFullscreen() {
    if (!windowEl || !openState()) return;
    if (document.fullscreenElement === windowEl) {
      if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
      return;
    }
    if (typeof windowEl.requestFullscreen === "function") {
      windowEl.requestFullscreen({ navigationUI: "hide" }).catch(function () {
        setNotice("Full-screen mode is unavailable in this browser session.", true);
      });
    }
  }

  function syncFullscreenButton() {
    if (!windowEl) return;
    var button = windowEl.querySelector('[data-jtt-action="fullscreen"]');
    if (!button) return;
    var active = document.fullscreenElement === windowEl;
    button.textContent = active ? "⤢" : "⛶";
    button.title = active ? "Exit full screen" : "Enter full screen";
    button.setAttribute("aria-label", button.title);
  }

  function handleWindowClick(event) {
    // Nakshatra stories are hover-driven; clicking a Nakshatra does not open
    // or restart the story, and should not count as an outside-panel click.
    if (event.target.closest(".jtt-nakshatra-story-trigger")) return;
    if (event.target.closest(".jtt-planet-signification-panel")) return;
    if (activeNakshatraStory) hideNakshatraStory(false);

    var exportWrap = event.target.closest(".jtt-global-export-wrap");
    if (!exportWrap) closeGlobalExportMenu();

    var infoWrap = event.target.closest(".jtt-info-wrap");
    if (!infoWrap) {
      var existingInfoButton = windowEl.querySelector('[data-jtt-action="info"]');
      if (existingInfoButton) existingInfoButton.setAttribute("aria-expanded", "false");
    }

    var actionButton = event.target.closest("[data-jtt-action]");
    if (actionButton) {
      var action = actionButton.getAttribute("data-jtt-action");
      if (action === "close") closeWindow();
      if (action === "minimize") minimizeWindow();
      if (action === "maximize") toggleMaximize();
      if (action === "fullscreen") toggleFullscreen();
      if (action === "theme") toggleTheme();
      if (action === "info") {
        showDurationStatusToast();
        actionButton.setAttribute("aria-expanded", "false");
      }
      if (action === "export-toggle") {
        var exportMenu = windowEl.querySelector("[data-jtt-global-export-menu]");
        var isExportOpen = exportMenu && exportMenu.hidden;
        if (exportMenu) exportMenu.hidden = !isExportOpen;
        actionButton.setAttribute("aria-expanded", isExportOpen ? "true" : "false");
      }
      if (action === "now") applyEvaluationTime(Date.now());
      return;
    }

    var exportOption = event.target.closest("[data-jtt-export-action]");
    if (exportOption) {
      runTransitTableExport(exportOption.getAttribute("data-jtt-export-action"));
      return;
    }

    var dayButton = event.target.closest("[data-tr-day]");
    if (dayButton) {
      stepDate(Number(dayButton.getAttribute("data-tr-day")) || 0, 0);
      return;
    }

    var yearButton = event.target.closest("[data-tr-year]");
    if (yearButton) {
      stepDate(0, Number(yearButton.getAttribute("data-tr-year")) || 0);
      return;
    }

    var minuteButton = event.target.closest("[data-tr-min]");
    if (minuteButton) {
      stepTime(Number(minuteButton.getAttribute("data-tr-min")) || 0);
    }
  }

  function enableDragging() {
    var handle = windowEl.querySelector("[data-jtt-drag-handle]");
    handle.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || event.target.closest("button")) return;
      if (maximized) toggleMaximize();

      var rect = windowEl.getBoundingClientRect();
      windowEl.style.transform = "none";
      windowEl.style.left = rect.left + "px";
      windowEl.style.top = rect.top + "px";

      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", function (event) {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      var width = windowEl.offsetWidth;
      var height = windowEl.offsetHeight;
      var left = dragState.left + (event.clientX - dragState.startX);
      var top = dragState.top + (event.clientY - dragState.startY);
      var maxLeft = Math.max(0, window.innerWidth - Math.min(100, width));
      var maxTop = Math.max(0, window.innerHeight - 48);
      windowEl.style.left = Math.max(-width + 100, Math.min(maxLeft, left)) + "px";
      windowEl.style.top = Math.max(0, Math.min(maxTop, top)) + "px";
    });

    function stopDragging(event) {
      if (dragState && event.pointerId === dragState.pointerId) dragState = null;
    }
    handle.addEventListener("pointerup", stopDragging);
    handle.addEventListener("pointercancel", stopDragging);
  }

  document.addEventListener("keydown", function (event) {
    var isMac = isApplePlatform();
    // Avoid Ctrl+Alt (AltGr) on Windows/Linux. Use the requested alphabet chord.
    var isTimelineShortcut = isMac
      ? event.code === "KeyT" && event.metaKey && event.altKey &&
        !event.ctrlKey && !event.shiftKey
      : event.code === "KeyX" && event.ctrlKey && event.shiftKey &&
        !event.altKey && !event.metaKey;

    if (isTimelineShortcut) {
      event.preventDefault();
      event.stopPropagation();
      openWindow();
      return;
    }

    if (event.key === "Escape" && !document.fullscreenElement && openState()) {
      closeWindow();
    }
  }, true);

  document.addEventListener("fullscreenchange", syncFullscreenButton);

  window.addEventListener("ja-transit-charts-changed", function () {
    if (windowEl) syncFromContext();
  });

  window.addEventListener("ja-auth-state-changed", function (event) {
    var user = event && event.detail &&
      Object.prototype.hasOwnProperty.call(event.detail, "user")
      ? event.detail.user
      : currentUser();

    if (!user && !currentUser()) closeWindow();
    if (user) dismissAuthPrompt();
  });

  window.addEventListener("storage", function (event) {
    if (event.key === THEME_KEY) {
      applyTheme(event.newValue === "apple" ? "apple" : "website", false);
    }
  });

  window.JupiterTransitTimeline = {
    open: openWindow,
    close: closeWindow,
    minimize: minimizeWindow,
    restore: restoreWindow,
    syncFromContext: syncFromContext,
    isOpen: openState,
    calculateLatta: calculateLatta,
    calculateLattaTarget: calculateLattaTarget,
    getLattaSourcesByTargetNakshatra: getLattaSourcesByTargetNakshatra,
    lattaRules: LATTA_RULES,
    transitResultBasic: {
      name: "Transit Result : Basic",
      rules: JANMA_RASI_TRANSIT_RULES,
      getResult: getJanmaRasiTransitResult,
      calculate: calculateJanmaRasiTransit
    },
    // Backward-compatible aliases for existing callers.
    janmaRasiTransitRules: JANMA_RASI_TRANSIT_RULES,
    getJanmaRasiTransitResult: getJanmaRasiTransitResult,
    calculateJanmaRasiTransit: calculateJanmaRasiTransit,
    shortcut: isApplePlatform() ? "⌘ + Option + T" : "Ctrl + Shift + X"
  };
})();