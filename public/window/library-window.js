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
        '<button class="ja-lib-fullscreen" type="button" data-ja-action="fullscreen" title="Enter full screen" aria-label="Enter full screen">⛶</button>' +
        '<div class="ja-lib-header-spacer"></div>' +
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
