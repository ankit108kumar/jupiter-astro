/* =========================================================
   JUPITER ASTRO — FLOATING REFERENCE LIBRARY WINDOW
   Shortcut: Ctrl + Shift + L
   Window shell only. Cloud provider APIs are separate modules.
   ========================================================= */
(function () {
  "use strict";

  if (window.__JA_LIBRARY_WINDOW_LOADED) return;
  window.__JA_LIBRARY_WINDOW_LOADED = true;

  var WINDOW_ID = "ja-reference-library-window";
  var LAUNCHER_ID = "ja-reference-library-launcher";
  var STYLE_ID = "ja-reference-library-styles";
  var libraryWindow = null;
  var launcher = null;
  var maximized = false;
  var previousBounds = null;
  var activeProvider = "all";

  var providers = [
    { id: "all", label: "All files", icon: "▦" },
    { id: "google-drive", label: "Google Drive", icon: "▣" },
    { id: "dropbox", label: "Dropbox", icon: "◈" },
    { id: "onedrive", label: "OneDrive", icon: "☁" }
  ];

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "#" + WINDOW_ID + ",#" + WINDOW_ID + " *,#" + LAUNCHER_ID + ",#" + LAUNCHER_ID + " *{box-sizing:border-box}",
      "#" + WINDOW_ID + "{--bg:#fbfaf8;--panel:#f3f1ed;--line:rgba(70,60,48,.13);--ink:#292722;--muted:#77736b;position:fixed;z-index:2147483000;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1060px,calc(100vw - 36px));height:min(720px,calc(100vh - 36px));min-width:min(340px,calc(100vw - 16px));min-height:300px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);display:none;flex-direction:column;overflow:hidden;resize:both;color:var(--ink);background:var(--bg);border:1px solid rgba(255,255,255,.85);border-radius:15px;box-shadow:0 24px 80px rgba(0,0,0,.30),0 4px 18px rgba(0,0,0,.13);font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;isolation:isolate}",
      "#" + WINDOW_ID + ".ja-lib-open{display:flex}",
      "#" + WINDOW_ID + ".ja-lib-maximized{inset:10px;left:10px;top:10px;width:auto;height:auto;max-width:none;max-height:none;min-width:0;min-height:0;transform:none;resize:none;border-radius:12px}",
      "#" + WINDOW_ID + " button,#" + LAUNCHER_ID + " button{font:inherit}",
      "#" + WINDOW_ID + " .ja-lib-titlebar{height:48px;min-height:48px;display:flex;align-items:center;gap:12px;padding:0 14px;background:linear-gradient(#f4f2ee,#eae7e1);border-bottom:1px solid var(--line);cursor:grab;user-select:none;touch-action:none}",
      "#" + WINDOW_ID + " .ja-lib-titlebar:active{cursor:grabbing}",
      "#" + WINDOW_ID + " .ja-lib-window-controls{display:flex;align-items:center;gap:8px;flex:0 0 auto}",
      "#" + WINDOW_ID + " .ja-lib-dot{width:12px;height:12px;border:0;border-radius:50%;padding:0;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.10)}",
      "#" + WINDOW_ID + " .close{background:#ff6058}#" + WINDOW_ID + " .minimize{background:#ffbd2e}#" + WINDOW_ID + " .maximize{background:#28c840}",
      "#" + WINDOW_ID + " .ja-lib-window-title{flex:1;min-width:0;text-align:center;font-weight:650;font-size:13px;letter-spacing:.15px;color:#45413b;pointer-events:none}",
      "#" + WINDOW_ID + " .ja-lib-header-spacer{width:44px;flex:0 0 44px}",
      "#" + WINDOW_ID + " .ja-lib-body{display:grid;grid-template-columns:205px minmax(0,1fr);min-height:0;flex:1}",
      "#" + WINDOW_ID + " .ja-lib-sidebar{min-height:0;overflow:auto;padding:18px 12px;background:#f5f3ef;border-right:1px solid var(--line)}",
      "#" + WINDOW_ID + " .ja-lib-side-heading{margin:0 9px 10px;color:#89847b;font-size:10px;font-weight:750;letter-spacing:1.1px;text-transform:uppercase}",
      "#" + WINDOW_ID + " .ja-lib-provider{width:100%;display:flex;align-items:center;gap:10px;padding:10px 11px;margin:3px 0;border:0;border-radius:8px;color:#4a463f;background:transparent;text-align:left;cursor:pointer}",
      "#" + WINDOW_ID + " .ja-lib-provider:hover{background:#eae7e1}#" + WINDOW_ID + " .ja-lib-provider.active{background:#e9dfd0;color:#694516;font-weight:650}",
      "#" + WINDOW_ID + " .ja-lib-provider-icon{width:20px;text-align:center;font-size:17px}",
      "#" + WINDOW_ID + " .ja-lib-provider-state{margin-left:auto;width:7px;height:7px;border-radius:50%;background:#c7c2b9}",
      "#" + WINDOW_ID + " .ja-lib-main{min-width:0;min-height:0;display:flex;flex-direction:column;padding:22px 24px 16px;overflow:hidden}",
      "#" + WINDOW_ID + " .ja-lib-main-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:17px}",
      "#" + WINDOW_ID + " .ja-lib-heading{margin:0;font-size:20px;line-height:1.2;font-weight:700;color:#302c26}",
      "#" + WINDOW_ID + " .ja-lib-readonly{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;color:#39744d;background:#e7f2e9;font-size:11px;font-weight:650}",
      "#" + WINDOW_ID + " .ja-lib-search-wrap{position:relative;margin-left:auto;min-width:190px;flex:1 1 240px;max-width:390px}",
      "#" + WINDOW_ID + " .ja-lib-search{width:100%;height:37px;padding:0 12px 0 35px;border:1px solid #dedad2;border-radius:8px;outline:none;color:var(--ink);background:#fff;font:inherit}",
      "#" + WINDOW_ID + " .ja-lib-search:focus{border-color:#c18b48;box-shadow:0 0 0 3px rgba(193,139,72,.13)}",
      "#" + WINDOW_ID + " .ja-lib-search-icon{position:absolute;left:12px;top:8px;color:#89847b;pointer-events:none}",
      "#" + WINDOW_ID + " .ja-lib-content{min-height:0;flex:1;overflow:auto;border:1px solid #e7e3dc;border-radius:10px;background:#fff}",
      "#" + WINDOW_ID + " .ja-lib-empty{min-height:250px;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:25px;text-align:center;color:var(--muted)}",
      "#" + WINDOW_ID + " .ja-lib-empty-symbol{width:54px;height:54px;display:grid;place-items:center;border-radius:15px;background:#f3eee6;color:#a97534;font-size:25px}",
      "#" + WINDOW_ID + " .ja-lib-empty strong{color:#464139;font-size:15px}",
      "#" + WINDOW_ID + " .ja-lib-empty p{max-width:410px;margin:0;font-size:12px}",
      "#" + WINDOW_ID + " .ja-lib-status{min-height:30px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:10px;color:#89847b;font-size:11px}",
      "#" + WINDOW_ID + " .ja-lib-actions{display:flex;align-items:center;gap:8px}",
      "#" + WINDOW_ID + " .ja-lib-action{padding:7px 12px;border:1px solid #ded9d0;border-radius:7px;color:#777168;background:#f7f5f1;font-size:11px;cursor:not-allowed;opacity:.72}",
      "#" + WINDOW_ID + " .ja-lib-action.primary{color:#fff;border-color:#9e6929;background:#a87332}",
      "#" + WINDOW_ID + " .ja-lib-notice{display:none;margin-top:10px;padding:9px 11px;border:1px solid #ead8b9;border-radius:7px;color:#795522;background:#fff8eb;font-size:11px}",
      "#" + WINDOW_ID + " .ja-lib-notice.visible{display:block}",
      "#" + LAUNCHER_ID + "{position:fixed;z-index:2147483001;right:22px;bottom:22px;display:none;padding:0;border:1px solid rgba(255,255,255,.85);border-radius:12px;background:#f5f1e9;box-shadow:0 8px 28px rgba(0,0,0,.2)}",
      "#" + LAUNCHER_ID + ".visible{display:block}",
      "#" + LAUNCHER_ID + " button{display:flex;align-items:center;gap:9px;padding:11px 15px;border:0;border-radius:12px;color:#443a2d;background:transparent;font-weight:650;cursor:pointer}",
      "#" + LAUNCHER_ID + " button:hover{background:#ebe3d6}",
      "@media(max-width:620px){#" + WINDOW_ID + "{width:calc(100vw - 12px);height:calc(100vh - 12px);min-width:0;min-height:260px;max-width:calc(100vw - 12px);max-height:calc(100vh - 12px);border-radius:10px}#" + WINDOW_ID + " .ja-lib-body{grid-template-columns:132px minmax(0,1fr)}#" + WINDOW_ID + " .ja-lib-sidebar{padding:12px 7px}#" + WINDOW_ID + " .ja-lib-provider{gap:6px;padding:9px 6px;font-size:11px}#" + WINDOW_ID + " .ja-lib-main{padding:15px 12px 10px}#" + WINDOW_ID + " .ja-lib-heading{font-size:17px}#" + WINDOW_ID + " .ja-lib-header-spacer{width:10px;flex-basis:10px}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function createWindow() {
    if (libraryWindow) return;
    addStyles();

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
  }

  function openWindow() {
    createWindow();
    libraryWindow.classList.add("ja-lib-open");
    libraryWindow.style.display = "flex";
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
    libraryWindow.style.display = "none";
    libraryWindow.setAttribute("aria-hidden", "true");
    launcher.classList.remove("visible");
    maximized = false;
  }

  function minimizeWindow() {
    if (!libraryWindow || !libraryWindow.classList.contains("ja-lib-open")) return;
    libraryWindow.classList.remove("ja-lib-open");
    libraryWindow.style.display = "none";
    launcher.classList.add("visible");
  }

  function restoreWindow() {
    if (!libraryWindow) return;
    libraryWindow.classList.add("ja-lib-open");
    libraryWindow.style.display = "flex";
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
    var handle = libraryWindow.querySelector("[data-ja-drag-handle]");
    var drag = null;

    handle.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || event.target.closest("button")) return;
      if (maximized) toggleMaximize();

      var rect = libraryWindow.getBoundingClientRect();
      libraryWindow.style.transform = "none";
      libraryWindow.style.left = rect.left + "px";
      libraryWindow.style.top = rect.top + "px";

      drag = {
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

    if (event.key === "Escape" && libraryWindow &&
        libraryWindow.classList.contains("ja-lib-open")) {
      closeWindow();
    }
  }, true);

  window.JupiterReferenceLibrary = {
    open: openWindow,
    close: closeWindow,
    minimize: minimizeWindow,
    restore: restoreWindow,
    isOpen: function () {
      return !!libraryWindow && libraryWindow.classList.contains("ja-lib-open");
    },
    getActiveProvider: function () { return activeProvider; },
    shortcut: "Ctrl + Shift + L"
  };

  console.info("Jupiter Astro: Reference Library window shell loaded. Shortcut: Ctrl + Shift + L");
})();