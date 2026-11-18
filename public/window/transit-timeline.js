/* =========================================================
   JUPITER ASTRO — TRANSIT TIMELINE FLOATING WINDOW
   Shortcut: Ctrl + Shift + T (Cmd + Shift + T on Mac)
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

  function syncFromContext() {
    if (!windowEl) return;
    var snapshot = readContextSnapshot();
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
      setNotice("Generate or open a Research Kundali to connect its Planetary Transits evaluation.", false);
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
    setNotice("Connected to the active Research Kundali. Date and time changes are shared with Planetary Transits.", false);
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
          '<button class="jtt-tool-button" type="button" data-jtt-action="fullscreen" title="Enter full screen" aria-label="Enter full screen">⛶</button>' +
          '<button class="jtt-theme-toggle" type="button" data-jtt-action="theme" title="Switch appearance" aria-label="Switch appearance" aria-pressed="false"></button>' +
        '</div>' +
      '</header>' +
      '<main class="jtt-main">' +
        '<div class="jtt-heading-row">' +
          '<div class="jtt-heading-copy">' +
            '<div class="jtt-eyebrow">RESEARCH WORKSPACE</div>' +
            '<h2>Transit Timeline</h2>' +
            '<p data-jtt-selected>Waiting for a connected Kundali</p>' +
          '</div>' +
          '<div class="jtt-context-card">' +
            '<div class="jtt-context-item"><span>ACTIVE KUNDALI</span><strong data-jtt-chart-title>No active Research Kundali</strong></div>' +
            '<div class="jtt-context-item"><span>JANMA RASHI</span><strong data-jtt-janma>—</strong></div>' +
            '<div class="jtt-context-item jtt-dasha-item"><span>RUNNING DASHA · MD – AD – PD</span><strong data-jtt-dasha>—</strong></div>' +
          '</div>' +
        '</div>' +
        '<section class="jtt-control-panel" aria-label="Transit evaluation controls">' +
          '<div class="jtt-control-heading"><strong>Transit Evaluation</strong><span>Shared with Planetary Transits</span></div>' +
          '<div class="jtt-fields-row">' +
            '<label class="jtt-field"><span>Transit Date</span><input type="date" data-jtt-field="date" aria-label="Transit date"></label>' +
            '<label class="jtt-field jtt-time-field"><span>Transit Time</span><input type="time" data-jtt-field="time" aria-label="Transit time" step="60"></label>' +
            '<button class="jtt-now-button" type="button" data-jtt-action="now">Now</button>' +
          '</div>' +
          '<div class="jtt-steppers">' +
            '<div class="jtt-step-group"><span class="jtt-step-label">Stepper for Date</span><div class="jtt-step-buttons">' +
              '<button type="button" data-jtt-year="-1">−1y</button>' +
              '<button type="button" data-jtt-day="-30">−30d</button>' +
              '<button type="button" data-jtt-day="-7">−7d</button>' +
              '<button type="button" data-jtt-day="-1">−1d</button>' +
              '<button type="button" data-jtt-day="1">+1d</button>' +
              '<button type="button" data-jtt-day="7">+7d</button>' +
              '<button type="button" data-jtt-day="30">+30d</button>' +
              '<button type="button" data-jtt-year="1">+1y</button>' +
            '</div></div>' +
            '<div class="jtt-step-group"><span class="jtt-step-label">Stepper for Time</span><div class="jtt-step-buttons">' +
              '<button type="button" data-jtt-min="-60">−1h</button>' +
              '<button type="button" data-jtt-min="-10">−10m</button>' +
              '<button type="button" data-jtt-min="-1">−1m</button>' +
              '<button type="button" data-jtt-min="1">+1m</button>' +
              '<button type="button" data-jtt-min="10">+10m</button>' +
              '<button type="button" data-jtt-min="60">+1h</button>' +
            '</div></div>' +
          '</div>' +
        '</section>' +
        '<div class="jtt-notice" role="status" aria-live="polite" hidden></div>' +
        '<section class="jtt-stage-panel">' +
          '<div class="jtt-stage-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7v5l3.5 2"></path></svg>' +
          '</div>' +
          '<strong>Timeline workspace</strong>' +
          '<p>The popup and shared evaluation controls are ready. Planetary rows, duration details, natal matches, Vedha and Murti Nirnaya will be added in the next implementation stage.</p>' +
        '</section>' +
      '</main>';

    document.body.appendChild(windowEl);

    launcher = document.createElement("div");
    launcher.id = LAUNCHER_ID;
    launcher.innerHTML =
      '<button type="button" aria-label="Restore Transit Timeline">' +
        '<span aria-hidden="true">◷</span><span>Transit Timeline</span><span aria-hidden="true">↗</span>' +
      '</button>';
    launcher.querySelector("button").addEventListener("click", restoreWindow);
    document.body.appendChild(launcher);

    windowEl.addEventListener("click", handleWindowClick);
    var dateInput = windowEl.querySelector('[data-jtt-field="date"]');
    var timeInput = windowEl.querySelector('[data-jtt-field="time"]');
    if (dateInput) dateInput.addEventListener("change", updateFromFields);
    if (timeInput) timeInput.addEventListener("change", updateFromFields);

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
    var actionButton = event.target.closest("[data-jtt-action]");
    if (actionButton) {
      var action = actionButton.getAttribute("data-jtt-action");
      if (action === "close") closeWindow();
      if (action === "minimize") minimizeWindow();
      if (action === "maximize") toggleMaximize();
      if (action === "fullscreen") toggleFullscreen();
      if (action === "theme") toggleTheme();
      if (action === "now") applyEvaluationTime(Date.now());
      return;
    }

    var dayButton = event.target.closest("[data-jtt-day]");
    if (dayButton) {
      stepDate(Number(dayButton.getAttribute("data-jtt-day")) || 0, 0);
      return;
    }

    var yearButton = event.target.closest("[data-jtt-year]");
    if (yearButton) {
      stepDate(0, Number(yearButton.getAttribute("data-jtt-year")) || 0);
      return;
    }

    var minuteButton = event.target.closest("[data-jtt-min]");
    if (minuteButton) {
      stepTime(Number(minuteButton.getAttribute("data-jtt-min")) || 0);
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
    var isTimelineShortcut = event.key && event.key.toLowerCase() === "t";
    var isMac = isApplePlatform();
    var primaryModifier = isMac
      ? event.metaKey && !event.ctrlKey && !event.altKey
      : event.ctrlKey && !event.metaKey && !event.altKey;
    // Chrome reserves Ctrl/Cmd + Shift + T for restoring a closed tab.
    // Offer an app-specific alternative while retaining the requested shortcut.
    var alternateModifier = isMac
      ? event.metaKey && event.altKey && !event.ctrlKey
      : event.ctrlKey && event.altKey && !event.metaKey;

    if ((primaryModifier || alternateModifier) && event.shiftKey && isTimelineShortcut) {
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
    shortcut: isApplePlatform()
      ? "⌘ + Shift + T (alternate: ⌘ + Option + Shift + T)"
      : "Ctrl + Shift + T (alternate: Ctrl + Alt + Shift + T)"
  };
})();