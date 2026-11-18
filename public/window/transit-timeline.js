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

  try {
    themeMode = localStorage.getItem(THEME_KEY) === "apple" ? "apple" : "website";
  } catch (error) {}

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

  function dateInputValue(date) {
    return date.getFullYear() + "-" +
      pad(date.getMonth() + 1) + "-" + pad(date.getDate());
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

  function renderDurationCell(interval, displayHtml, label) {
    var display = displayHtml || '<span class="jtt-cell-muted">—</span>';
    if (!interval || !interval.startText || !interval.endText) {
      return '<span class="jtt-duration-value">' + display + '</span>';
    }
    var fullDuration = interval.startText + ' to ' + interval.endText;
    return '<span class="jtt-duration-wrap" tabindex="0" role="button"' +
      ' data-jtt-duration="' + escapeTableText(fullDuration) + '"' +
      ' data-jtt-duration-label="' + escapeTableText(label || 'Transit duration') + '"' +
      ' aria-label="' + escapeTableText((label || 'Transit duration') + '. Hover or focus to view duration') + '">' +
      '<span class="jtt-duration-value">' + display + '</span>' +
    '</span>';
  }

  function renderNatalPlanetMatches(items) {
    if (!Array.isArray(items) || !items.length) {
      return '<span class="jtt-cell-muted">—</span>';
    }
    var abbreviations = {
      Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me',
      Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke'
    };
    return '<div class="jtt-natal-matches">' + items.map(function (item) {
      var markers = Array.isArray(item.markers) && item.markers.length
        ? '<sup class="jtt-planet-markers">' + item.markers.map(escapeTableText).join(" ") + '</sup>'
        : '';
      return '<span class="jtt-natal-match" style="color:' +
        escapeTableText(item.color || "var(--jtt-ink)") + '" title="' +
        escapeTableText(item.name) + '">' +
        escapeTableText(abbreviations[item.name] || item.name.slice(0, 2)) + markers + '</span>';
    }).join('<span class="jtt-match-separator">, </span>') + '</div>';
  }

  function renderTransitTable(data) {
    if (!data || !Array.isArray(data.rows) || !data.rows.length) {
      return '<div class="jtt-table-empty">No planetary transit data is available for the selected Kundali.</div>';
    }

    function houseScore(house, score) {
      var hasScore = score !== null && score !== undefined && score !== "" &&
        Number.isFinite(Number(score));
      var value = hasScore
        ? '<span class="jtt-house-score-detail"> [' + escapeTableText(score) + ']</span>'
        : '';
      return '<span class="jtt-house-score">' + escapeTableText(house) + 'H' + value + '</span>';
    }

    var abbreviations = {
      Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me',
      Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke'
    };

    var rowsHtml = data.rows.map(function (row) {
      var markers = Array.isArray(row.markers) && row.markers.length
        ? '<sup class="jtt-planet-markers">' + row.markers.map(escapeTableText).join(" ") + '</sup>'
        : '';
      var nakshatraLord = abbreviations[row.nakshatraLord] || '';
      var nakshatraHtml = escapeTableText(row.nakshatra) +
        (nakshatraLord ? ' <span class="jtt-nak-lord">(' + nakshatraLord + ')</span>' : '');
      var murti = row.planet === "Moon" ? "" : escapeTableText(row.murti || "");
      var murtiTone = row.planet === "Moon" ? "" :
        row.murti === "Gold" ? " jtt-murti-gold" :
        row.murti === "Silver" ? " jtt-murti-silver" :
        row.murti === "Copper" ? " jtt-murti-copper" :
        row.murti === "Iron" ? " jtt-murti-iron" : "";
      var navamsaNumber = Number.isFinite(Number(row.navamsaIndex)) ? Number(row.navamsaIndex) : '';

      return '<tr>' +
        '<td class="jtt-planet-cell"><strong>' + escapeTableText(row.planet) + '</strong>' + markers + '</td>' +
        '<td class="jtt-sign-cell">' + renderDurationCell(row.signDuration, escapeTableText(row.sign), 'Sign duration') + '</td>' +
        '<td class="jtt-house-cell">' + houseScore(row.fromLagna, row.sav) + '</td>' +
        '<td class="jtt-house-cell">' + houseScore(row.fromMoon, row.bav) + '</td>' +
        '<td class="jtt-match-cell">' + renderNatalPlanetMatches(row.natalPlanetsInSign) + '</td>' +
        '<td class="jtt-nakshatra-cell">' + renderDurationCell(row.nakshatraDuration, nakshatraHtml, 'Nakshatra duration') + '</td>' +
        '<td class="jtt-count-cell">' + escapeTableText(row.countFromJanmaNakshatra) + '</td>' +
        '<td class="jtt-match-cell">' + renderNatalPlanetMatches(row.natalPlanetsInNakshatra) + '</td>' +
        '<td class="jtt-navamsa-cell">' + renderDurationCell(row.navamsaDuration, escapeTableText(row.navamsa || navamsaNumber), 'Navamsa duration') + '</td>' +
        '<td class="jtt-match-cell">' + renderNatalPlanetMatches(row.natalPlanetsInNavamsa) + '</td>' +
        '<td class="jtt-blank-cell"></td>' +
        '<td class="jtt-blank-cell"></td>' +
        '<td class="jtt-murti-cell' + murtiTone + '">' + murti + '</td>' +
      '</tr>';
    }).join("");

    return '<table class="jtt-planetary-table">' +
      '<thead>' +
        '<tr>' +
          '<th rowspan="2" class="jtt-sticky-planet">Planet</th>' +
          '<th>Sign</th>' +
          '<th>From Lagna</th>' +
          '<th>From Moon</th>' +
          '<th rowspan="2" title="Natal Planet (Sign)">Natal (Sign)</th>' +
          '<th>Nakshatra</th>' +
          '<th rowspan="2">Nk. Count</th>' +
          '<th rowspan="2" title="Natal Planet (Nakshatra)">Natal (Nak.)</th>' +
          '<th>Navamsa</th>' +
          '<th rowspan="2" title="Natal Planet (Navamsa)">Natal (D9)</th>' +
          '<th rowspan="2">Vedha (from)</th>' +
          '<th rowspan="2" title="Reverse Vedha (from)">Rev. Vedha</th>' +
          '<th rowspan="2" title="Murti Nirnay">Murti</th>' +
        '</tr>' +
        '<tr>' +
          '<th>Duration</th>' +
          '<th>SAV</th>' +
          '<th>BAV (Planet)</th>' +
          '<th>Duration</th>' +
          '<th>Duration</th>' +
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
    }, 2000);
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
    var heading = document.createElement("span");
    heading.className = "jtt-duration-tooltip-heading";
    heading.textContent = label;
    var text = document.createElement("span");
    text.className = "jtt-duration-tooltip-text";
    text.textContent = duration;
    text.tabIndex = 0;
    var copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "jtt-duration-tooltip-copy";
    copyButton.setAttribute("aria-label", "Copy complete duration");
    copyButton.title = "Copy duration";
    copyButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path></svg>';
    tooltip.appendChild(heading);
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
    positionDurationTooltip(wrapper, tooltip);
    setTimeout(function () {
      if (activeDurationTooltip === tooltip) tooltip.classList.add("is-open");
    }, 10);
  }
  function bindDurationTooltips(host) {
    host.querySelectorAll(".jtt-duration-wrap[data-jtt-duration]").forEach(function (wrapper) {
      wrapper.addEventListener("pointerenter", function () { showDurationTooltip(wrapper); });
      wrapper.addEventListener("pointerleave", function (event) {
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
      host.innerHTML = renderTransitTable(context.getTransitTableData());
      bindDurationTooltips(host);
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
    if (dasha) dasha.textContent = snapshot.dasha || "—";
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

    var dateParts = dateInput.value.split("-").map(Number);
    var timeParts = timeInput.value.split(":").map(Number);
    if (dateParts.length !== 3 || timeParts.length < 2) return null;

    var date = new Date(
      dateParts[0], dateParts[1] - 1, dateParts[2],
      timeParts[0] || 0, timeParts[1] || 0, 0, 0
    );
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
            '<button class="jtt-info-button" type="button" data-jtt-action="info" title="Transit Timeline information" aria-label="Transit Timeline information" aria-expanded="false" aria-controls="jtt-info-popover">i</button>' +
            '<div class="jtt-info-popover" id="jtt-info-popover" data-jtt-info-popover hidden role="note">' +
              'Connected to the active Research Kundali. Date and time changes are shared with Planetary Transits.' +
            '</div>' +
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
            '<div class="jtt-context-item jtt-janma-item"><span>JANMA RASHI</span><strong data-jtt-janma>—</strong></div>' +
            '<div class="jtt-context-item jtt-dasha-item"><span>RUNNING DASHA</span><strong data-jtt-dasha>—</strong></div>' +
          '</div>' +
          '<div class="jtt-unified-divider" aria-hidden="true"></div>' +
          '<div class="jtt-control-panel" aria-label="Transit evaluation controls">' +
            '<div class="jtt-fields-row">' +
              '<label class="jtt-field jtt-date-field"><span>Date</span><input type="date" data-jtt-field="date" aria-label="Transit date"></label>' +
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
    windowEl.setAttribute("aria-hidden", "false");
    launcher.classList.remove("visible");
    syncFromContext();
    return true;
  }

  function closeWindow() {
    if (!windowEl) return;
    windowEl.classList.remove("jtt-open", "jtt-maximized");
    windowEl.setAttribute("aria-hidden", "true");
    launcher.classList.remove("visible");
    maximized = false;
  }

  function minimizeWindow() {
    if (!openState()) return;
    windowEl.classList.remove("jtt-open");
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
    var exportWrap = event.target.closest(".jtt-global-export-wrap");
    if (!exportWrap) closeGlobalExportMenu();

    var infoWrap = event.target.closest(".jtt-info-wrap");
    if (!infoWrap) {
      var existingInfo = windowEl.querySelector("[data-jtt-info-popover]");
      var existingInfoButton = windowEl.querySelector('[data-jtt-action="info"]');
      if (existingInfo) existingInfo.hidden = true;
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
        var infoPopover = windowEl.querySelector("[data-jtt-info-popover]");
        var isOpen = infoPopover && infoPopover.hidden;
        if (infoPopover) infoPopover.hidden = !isOpen;
        actionButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
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
    shortcut: isApplePlatform() ? "⌘ + Option + T" : "Ctrl + Shift + X"
  };
})();