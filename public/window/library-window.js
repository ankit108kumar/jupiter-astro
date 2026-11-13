/* =========================================================
   JUPITER ASTRO — FLOATING REFERENCE LIBRARY WINDOW
   Shortcut: Ctrl + Shift + L (Cmd + Shift + L on Mac)
   Window shell only. Cloud provider APIs are separate modules.
   ========================================================= */
(function () {
  "use strict";

  if (window.__JA_LIBRARY_WINDOW_LOADED) return;
  window.__JA_LIBRARY_WINDOW_LOADED = true;

  var WINDOW_ID = "ja-reference-library-window";
  var LAUNCHER_ID = "ja-reference-library-launcher";
  var libraryWindow = null;
  var launcher = null;
  var maximized = false;
  var previousBounds = null;
  var activeProvider = "all";
  var THEME_MODE_KEY = "ja-library-theme-mode";
  var themeMode = "website";

  try {
    themeMode = localStorage.getItem(THEME_MODE_KEY) === "apple" ? "apple" : "website";
  } catch (error) {}

  function syncStandaloneWebsiteTheme() {
    if (!isLibraryApp) return;

    var root = document.documentElement;
    try {
      var savedTheme = localStorage.getItem("ja-theme");
      if (!savedTheme) {
        savedTheme = window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
      }
      root.setAttribute("data-theme", savedTheme);

      var savedPalette = localStorage.getItem("ja-palette");
      if (savedPalette) root.setAttribute("data-palette", savedPalette);
      else root.removeAttribute("data-palette");
    } catch (error) {
      root.setAttribute("data-theme", "light");
      root.removeAttribute("data-palette");
    }
  }

  function themeIconMarkup(mode) {
    if (mode === "apple") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.6"></circle><path d="M12 2v2.1M12 19.9V22M4.93 4.93l1.48 1.48m11.18 11.18 1.48 1.48M2 12h2.1m15.8 0H22M4.93 19.07l1.48-1.48M17.59 6.41l1.48-1.48"></path></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"></rect><path d="M3 8h18M7 6h.01M10 6h.01M7 12h10M7 15.5h7"></path></svg>';
  }

  function updateThemeToggle() {
    if (!libraryWindow) return;
    var button = libraryWindow.querySelector('[data-ja-action="theme-toggle"]');
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

  function applyThemeMode(mode, persist) {
    themeMode = mode === "apple" ? "apple" : "website";

    if (libraryWindow) {
      libraryWindow.setAttribute("data-ja-lib-theme", themeMode);
    }

    if (isLibraryApp && themeMode === "website") {
      syncStandaloneWebsiteTheme();
    }

    updateThemeToggle();

    if (persist !== false) {
      try { localStorage.setItem(THEME_MODE_KEY, themeMode); } catch (error) {}
    }
  }

  function toggleThemeMode() {
    applyThemeMode(themeMode === "website" ? "apple" : "website", true);
  }

  window.addEventListener("storage", function (event) {
    if (event.key === THEME_MODE_KEY) {
      applyThemeMode(event.newValue === "apple" ? "apple" : "website", false);
      return;
    }

    if (isLibraryApp && themeMode === "website" &&
        (event.key === "ja-theme" || event.key === "ja-palette")) {
      syncStandaloneWebsiteTheme();
    }
  });
  // The dedicated PWA page opts into app mode explicitly. The normal website
  // keeps the existing floating-window behaviour.
  var isLibraryApp = document.documentElement.getAttribute("data-ja-library-app") === "true";
  if (isLibraryApp) document.documentElement.classList.add("ja-lib-app-mode");

  var providers = [
    { id: "all", label: "All files", icon: "▦" },
    { id: "google-drive", label: "Google Drive", icon: "▣" },
    { id: "dropbox", label: "Dropbox", icon: "◈" },
    { id: "onedrive", label: "OneDrive", icon: "☁" }
  ];

  function createWindow() {
    if (libraryWindow) return;

    libraryWindow = document.createElement("section");
    libraryWindow.id = WINDOW_ID;
    libraryWindow.setAttribute("role", "dialog");
    libraryWindow.setAttribute("aria-label", "Jupiter Astrology Reference Library");
    libraryWindow.setAttribute("aria-modal", "false");

    var providerButtons = providers.map(function (provider) {
      return '<button class="ja-lib-provider' + (provider.id === "all" ? " active" : "") +
        '" type="button" data-ja-provider="' + provider.id + '">' +
        '<span class="ja-lib-provider-icon" aria-hidden="true">' + provider.icon + '</span>' +
        '<span>' + provider.label + '</span>' +
        (provider.id !== "all" ? '<span class="ja-lib-provider-state" title="Not connected"></span>' : "") +
        '</button>';
    }).join("");

    libraryWindow.innerHTML =
      '<header class="ja-lib-titlebar" data-ja-drag-handle>' +
        '<div class="ja-lib-window-controls" aria-label="Window controls">' +
          '<button class="ja-lib-dot close" type="button" data-ja-action="close" title="Close library" aria-label="Close"></button>' +
          '<button class="ja-lib-dot minimize" type="button" data-ja-action="minimize" title="Minimize library" aria-label="Minimize"></button>' +
          '<button class="ja-lib-dot maximize" type="button" data-ja-action="maximize" title="Maximize or restore library" aria-label="Maximize"></button>' +
        '</div>' +
        '<div class="ja-lib-window-title">Jupiter Astrology · Reference Library</div>' +
        '<div class="ja-lib-titlebar-tools">' +
          '<button class="ja-lib-fullscreen" type="button" data-ja-action="fullscreen" title="Enter full screen" aria-label="Enter full screen">⛶</button>' +
          '<button class="ja-lib-theme-toggle" type="button" data-ja-action="theme-toggle" title="Following website theme · Switch to Apple Light" aria-label="Switch to Apple Light mode" aria-pressed="false"></button>' +
        '</div>' +
      '</header>' +
      '<div class="ja-lib-body">' +
        '<aside class="ja-lib-sidebar"><div class="ja-lib-side-heading">Library sources</div><nav aria-label="Cloud storage providers">' +
          providerButtons +
        '</nav></aside>' +
        '<main class="ja-lib-main">' +
          '<div class="ja-lib-main-top">' +
            '<h2 class="ja-lib-heading">Reference Library</h2>' +
            '<span class="ja-lib-readonly">● Read only</span>' +
            '<label class="ja-lib-search-wrap"><span class="ja-lib-search-icon" aria-hidden="true">⌕</span>' +
              '<input class="ja-lib-search" type="search" placeholder="Search files and folders" aria-label="Search files and folders" autocomplete="off">' +
            '</label>' +
          '</div>' +
          '<div class="ja-lib-content"><div class="ja-lib-empty">' +
            '<div class="ja-lib-empty-symbol" aria-hidden="true">▤</div>' +
            '<strong class="ja-lib-empty-title">Your reference library is ready</strong>' +
            '<p class="ja-lib-empty-description">Connect Google Drive, Dropbox or OneDrive to browse your astrology reference files here. Your original cloud files will remain read-only.</p>' +
          '</div></div>' +
          '<div class="ja-lib-notice" role="status" aria-live="polite"></div>' +
          '<footer class="ja-lib-status"><span class="ja-lib-source-label">All storage providers · Not connected</span>' +
            '<div class="ja-lib-actions"><button class="ja-lib-action" type="button" disabled>Preview</button>' +
            '<button class="ja-lib-action primary" type="button" disabled>Use in module</button></div>' +
          '</footer>' +
        '</main>' +
      '</div>';

    document.body.appendChild(libraryWindow);
    applyThemeMode(themeMode, false);

    launcher = document.createElement("div");
    launcher.id = LAUNCHER_ID;
    launcher.innerHTML = '<button type="button" aria-label="Restore Jupiter Astrology Library">' +
      '<span aria-hidden="true">▤</span><span>Reference Library</span><span aria-hidden="true">↗</span></button>';
    launcher.querySelector("button").addEventListener("click", restoreWindow);
    document.body.appendChild(launcher);

    libraryWindow.addEventListener("click", handleWindowClick);
    libraryWindow.querySelectorAll("[data-ja-provider]").forEach(function (button) {
      button.addEventListener("click", function () {
        selectProvider(button.getAttribute("data-ja-provider"));
      });
    });

    enableDragging();
  }

  function selectProvider(providerId) {
    activeProvider = providerId;
    libraryWindow.querySelectorAll("[data-ja-provider]").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-ja-provider") === providerId);
    });

    var provider = providers.find(function (item) { return item.id === providerId; });
    var label = provider ? provider.label : "All files";
    libraryWindow.querySelector(".ja-lib-source-label").textContent =
      label + (providerId === "all" ? " · Not connected" : " · Connector not configured");

    var title = libraryWindow.querySelector(".ja-lib-empty-title");
    var description = libraryWindow.querySelector(".ja-lib-empty-description");
    if (providerId === "all") {
      title.textContent = "Your reference library is ready";
      description.textContent =
        "Connect Google Drive, Dropbox or OneDrive to browse your astrology reference files here. Your original cloud files will remain read-only.";
    } else {
      title.textContent = label + " is not connected yet";
      description.textContent =
        "The library window is ready. Secure " + label +
        " authentication and its read-only file connector will be configured in the next integration phase.";
    }
  }

  function handleWindowClick(event) {
    var button = event.target.closest("[data-ja-action]");
    if (!button) return;
    var action = button.getAttribute("data-ja-action");
    if (action === "close") closeWindow();
    if (action === "minimize") minimizeWindow();
    if (action === "maximize") toggleMaximize();
    if (action === "fullscreen") toggleFullscreen();
    if (action === "theme-toggle") toggleThemeMode();
  }

  function toggleFullscreen() {
    if (!libraryWindow || !libraryWindow.classList.contains("ja-lib-open")) return;

    if (document.fullscreenElement === libraryWindow) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      }
      return;
    }

    if (typeof libraryWindow.requestFullscreen === "function") {
      libraryWindow.requestFullscreen({ navigationUI: "hide" }).catch(function () {
        var notice = libraryWindow.querySelector(".ja-lib-notice");
        if (notice) {
          notice.textContent = "Full-screen mode is unavailable in this browser session.";
          notice.classList.add("visible");
        }
      });
    }
  }

  function syncFullscreenButton() {
    if (!libraryWindow) return;
    var button = libraryWindow.querySelector('[data-ja-action="fullscreen"]');
    if (!button) return;
    var active = document.fullscreenElement === libraryWindow;
    button.textContent = active ? "⤢" : "⛶";
    button.title = active ? "Exit full screen" : "Enter full screen";
    button.setAttribute("aria-label", button.title);
  }

  document.addEventListener("fullscreenchange", syncFullscreenButton);

  function openWindow() {
    createWindow();
    libraryWindow.classList.add("ja-lib-open");
    libraryWindow.setAttribute("aria-hidden", "false");
    launcher.classList.remove("visible");
    window.setTimeout(function () {
      var search = libraryWindow.querySelector(".ja-lib-search");
      if (search) search.focus({ preventScroll: true });
    }, 0);
  }

  function closeWindow() {
    if (!libraryWindow) return;
    libraryWindow.classList.remove("ja-lib-open", "ja-lib-maximized");
    libraryWindow.setAttribute("aria-hidden", "true");
    launcher.classList.remove("visible");
    maximized = false;
  }

  function minimizeWindow() {
    if (!libraryWindow || !libraryWindow.classList.contains("ja-lib-open")) return;
    libraryWindow.classList.remove("ja-lib-open");
    launcher.classList.add("visible");
  }

  function restoreWindow() {
    if (!libraryWindow) return;
    libraryWindow.classList.add("ja-lib-open");
    libraryWindow.setAttribute("aria-hidden", "false");
    launcher.classList.remove("visible");
  }

  function toggleMaximize() {
    if (!libraryWindow) return;
    if (!maximized) {
      var rect = libraryWindow.getBoundingClientRect();
      previousBounds = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      libraryWindow.classList.add("ja-lib-maximized");
      maximized = true;
    } else {
      libraryWindow.classList.remove("ja-lib-maximized");
      maximized = false;
      if (previousBounds) {
        libraryWindow.style.left = previousBounds.left + "px";
        libraryWindow.style.top = previousBounds.top + "px";
        libraryWindow.style.width = previousBounds.width + "px";
        libraryWindow.style.height = previousBounds.height + "px";
        libraryWindow.style.transform = "none";
      }
    }
  }

  function enableDragging() {
    // In the installed app, use the operating system's native app-window
    // controls instead of dragging an HTML dialog inside the page.
    if (isLibraryApp) return;

    var handle = libraryWindow.querySelector("[data-ja-drag-handle]");
    var drag = null;
    handle.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || event.target.closest("button")) return;
      if (maximized) toggleMaximize();
      var rect = libraryWindow.getBoundingClientRect();
      libraryWindow.style.transform = "none";
      libraryWindow.style.left = rect.left + "px";
      libraryWindow.style.top = rect.top + "px";
      drag = { pointerId:event.pointerId, startX:event.clientX, startY:event.clientY, left:rect.left, top:rect.top };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener("pointermove", function (event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      var width = libraryWindow.offsetWidth;
      var height = libraryWindow.offsetHeight;
      var left = drag.left + (event.clientX - drag.startX);
      var top = drag.top + (event.clientY - drag.startY);
      var maxLeft = Math.max(0, window.innerWidth - Math.min(80, width));
      var maxTop = Math.max(0, window.innerHeight - 48);
      libraryWindow.style.left = Math.max(-width + 80, Math.min(maxLeft, left)) + "px";
      libraryWindow.style.top = Math.max(0, Math.min(maxTop, top)) + "px";
    });
    function stopDragging(event) {
      if (drag && event.pointerId === drag.pointerId) drag = null;
    }
    handle.addEventListener("pointerup", stopDragging);
    handle.addEventListener("pointercancel", stopDragging);
  }

  document.addEventListener("keydown", function (event) {
    var isLibraryShortcut = event.key && event.key.toLowerCase() === "l";
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && isLibraryShortcut) {
      event.preventDefault();
      event.stopPropagation();
      if (libraryWindow && libraryWindow.classList.contains("ja-lib-open")) {
        libraryWindow.querySelector(".ja-lib-search").focus({ preventScroll: true });
      } else {
        openWindow();
      }
    }
    // Let the browser handle Escape first when exiting Fullscreen.
    if (event.key === "Escape" && !document.fullscreenElement &&
        libraryWindow && libraryWindow.classList.contains("ja-lib-open")) {
      closeWindow();
    }
  }, true);

  window.JupiterReferenceLibrary = {
    open: openWindow,
    close: closeWindow,
    minimize: minimizeWindow,
    restore: restoreWindow,
    isOpen: function () { return !!libraryWindow && libraryWindow.classList.contains("ja-lib-open"); },
    getActiveProvider: function () { return activeProvider; },
    toggleFullscreen: toggleFullscreen,
    shortcut: "Ctrl + Shift + L"
  };

  // When launched as the installed Library PWA, show the library immediately
  // and register its service worker. This app page runs in its own OS window.
  if (isLibraryApp) {
    syncStandaloneWebsiteTheme();
    openWindow();
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("/window/library-app-sw.js", { scope: "/window/" })
          .catch(function (error) {
            console.warn("Jupiter Astro Library: service worker registration failed.", error);
          });
      });
    }
  }

  console.info("Jupiter Astro: Reference Library window shell loaded. Shortcut: Ctrl + Shift + L");
})();
