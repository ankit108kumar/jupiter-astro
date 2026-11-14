/* =========================================================
   JUPITER ASTRO — DROPBOX LIBRARY CONNECTOR
   Read-only Dropbox browser; OAuth and tokens remain server-side.
   ========================================================= */
(function () {
  "use strict";
  if (window.__JA_LIBRARY_DROPBOX_LOADED) return;
  window.__JA_LIBRARY_DROPBOX_LOADED = true;

  var API_URL = "/api/dropbox";
  var PAGE_SIZE = 1000;
  var stack = [];
  var files = [];
  var cursor = "";
  var loading = false;
  var requestSerial = 0;
  var toolbar = null;
  var toolbarMainTop = null;
  var pathElement = null;
  var countElement = null;
  var searchInput = null;
  var connected = false;
  var statusLabel = null;

  function contentEl() {
    return document.querySelector("#ja-reference-library-window .ja-lib-content");
  }

  function providerButton() {
    return document.querySelector('#ja-reference-library-window [data-ja-provider="dropbox"]');
  }

  function setProviderStatus(text) {
    var label = document.querySelector("#ja-reference-library-window .ja-lib-source-label");
    if (label) label.textContent = text;
    statusLabel = text;
  }

  async function authHeaders() {
    var user = window.jaAuthUser;
    if (!user || typeof user.getIdToken !== "function") {
      throw new Error("Please log in or sign up to use Dropbox.");
    }
    var token = await user.getIdToken();
    if (!token) throw new Error("Your login session has expired. Please log in again.");
    return { Authorization: "Bearer " + token };
  }

  async function api(action, params, method, body) {
    var url = new URL(API_URL, window.location.origin);
    url.searchParams.set("action", action);
    Object.keys(params || {}).forEach(function (key) {
      if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
        url.searchParams.set(key, String(params[key]));
      }
    });
    var headers = await authHeaders();
    if (body) headers["Content-Type"] = "application/json";
    var response = await fetch(url.toString(), {
      method: method || "GET",
      credentials: "same-origin",
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
      var message = "Dropbox returned HTTP " + response.status + ".";
      try {
        var result = await response.json();
        if (result && result.error) message = result.error;
      } catch (error) {}
      throw new Error(message);
    }
    return response;
  }

  function createButton(label, className, action) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    if (action) button.dataset.dropboxAction = action;
    return button;
  }

  function showMessage(title, description, isError, actionLabel, action) {
    var content = contentEl();
    if (!content) return;
    content.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "ja-lib-empty ja-drive-empty";
    var symbol = document.createElement("div");
    symbol.className = "ja-lib-empty-symbol";
    symbol.textContent = isError ? "!" : "D";
    var heading = document.createElement("strong");
    heading.className = "ja-lib-empty-title";
    heading.textContent = title;
    var text = document.createElement("p");
    text.className = "ja-lib-empty-description";
    text.textContent = description;
    wrap.append(symbol, heading, text);
    if (actionLabel && action) {
      var button = createButton(actionLabel, "ja-drive-text-button", action);
      button.addEventListener("click", action);
      wrap.appendChild(button);
    }
    content.appendChild(wrap);
  }

  function connect() {
    setProviderStatus("Dropbox · Connecting…");
    api("connect", {}, "POST").then(function (response) {
      return response.json();
    }).then(function (data) {
      if (!data.authorizationUrl) throw new Error("Dropbox did not return an authorization URL.");
      window.location.assign(data.authorizationUrl);
    }).catch(function (error) {
      setProviderStatus("Dropbox · Connection needs attention");
      showMessage("Dropbox could not be connected", error.message || "Check Dropbox app settings and Vercel configuration.", true, "Try again", connect);
    });
  }

  function formatBytes(value) {
    var size = Number(value) || 0;
    if (size < 1024) return size + " B";
    if (size < 1048576) return (size / 1024).toFixed(1) + " KB";
    if (size < 1073741824) return (size / 1048576).toFixed(1) + " MB";
    return (size / 1073741824).toFixed(2) + " GB";
  }

  function formatDate(value) {
    if (!value) return "—";
    var date = new Date(value);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date)
      : "—";
  }

  function extensionOf(name) {
    var match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function mimeTypeOf(item) {
    var ext = extensionOf(item.name);
    var map = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
      xlsb: "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
      csv: "text/csv",
      ods: "application/vnd.oasis.opendocument.spreadsheet",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ppt: "application/vnd.ms-powerpoint",
      odp: "application/vnd.oasis.opendocument.presentation",
      rtf: "application/rtf",
      txt: "text/plain",
      md: "text/markdown",
      json: "application/json",
      xml: "application/xml",
      html: "text/html",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      mp4: "video/mp4",
      webm: "video/webm"
    };
    return map[ext] || "application/octet-stream";
  }

  function categoryOf(item) {
    if (item.isFolder) return "folder";
    var ext = extensionOf(item.name);
    if (ext === "pdf") return "pdf";
    if (/^(doc|docx|rtf|odt)$/.test(ext)) return "document";
    if (/^(xls|xlsx|xlsm|xlsb|csv|ods)$/.test(ext)) return "spreadsheet";
    if (/^(ppt|pptx|odp)$/.test(ext)) return "presentation";
    if (/^(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/.test(ext)) return "image";
    if (/^(mp3|wav|ogg|m4a|aac|flac|mp4|webm|mov|m4v)$/.test(ext)) return "media";
    return "other";
  }

  function iconFor(item) {
    return ({
      folder: "▰", pdf: "PDF", document: "W", spreadsheet: "▦",
      presentation: "P", image: "▧", media: "▶", other: "▤"
    })[categoryOf(item)] || "▤";
  }

  function descriptor(item) {
    return {
      id: item.path,
      path: item.path,
      name: item.name,
      mimeType: mimeTypeOf(item),
      size: Number(item.size) || undefined,
      modifiedTime: item.modifiedTime || "",
      provider: "Dropbox",
      getBlob: function (options) {
        return downloadFile(item, options && options.signal);
      }
    };
  }

  async function downloadFile(item, signal) {
    var response;
    try {
      var headers = await authHeaders();
      var url = new URL(API_URL, window.location.origin);
      url.searchParams.set("action", "download");
      url.searchParams.set("path", item.path);
      response = await fetch(url.toString(), {
        method: "GET",
        credentials: "same-origin",
        headers: headers,
        signal: signal
      });
    } catch (error) {
      if (error && error.name === "AbortError") throw error;
      throw new Error(error && error.message || "Could not reach the Dropbox preview service.");
    }
    if (!response.ok) {
      var message = "Dropbox could not download this file.";
      try {
        var result = await response.json();
        if (result && result.error) message = result.error;
      } catch (error) {}
      throw new Error(message);
    }
    var blob = await response.blob();
    if (!blob.size) throw new Error("Dropbox returned an empty file.");
    var mime = response.headers.get("content-type") || mimeTypeOf(item);
    if (!blob.type || blob.type === "application/octet-stream") {
      blob = new Blob([blob], { type: mimeTypeOf(item) || mime });
    }
    return blob;
  }

  function clearSelection() {
    if (window.JupiterReferenceLibrary) window.JupiterReferenceLibrary.setSelectedFile(null);
  }

  function updatePath() {
    if (!pathElement || !pathElement.isConnected) return;
    pathElement.innerHTML = "";
    stack.forEach(function (folder, index) {
      if (index) {
        var separator = document.createElement("span");
        separator.className = "ja-drive-crumb-separator";
        separator.textContent = "›";
        pathElement.appendChild(separator);
      }
      var crumb = createButton(folder.name, "ja-drive-crumb");
      crumb.disabled = index === stack.length - 1;
      crumb.title = folder.name;
      crumb.addEventListener("click", function () {
        stack = stack.slice(0, index + 1);
        loadFolder(false);
      });
      pathElement.appendChild(crumb);
    });
  }

  function ensureToolbar() {
    var mainTop = document.querySelector("#ja-reference-library-window .ja-lib-main-top");
    if (!mainTop) return;
    var libraryWindow = document.getElementById("ja-reference-library-window");
    if (libraryWindow) libraryWindow.classList.add("ja-lib-drive-active");
    var readOnly = mainTop.querySelector(".ja-lib-readonly");
    if (readOnly) readOnly.hidden = true;
    if (toolbar && toolbar.isConnected) return;

    toolbarMainTop = mainTop;
    toolbar = document.createElement("div");
    toolbar.className = "ja-drive-inline-controls";
    toolbar.setAttribute("aria-label", "Dropbox folder controls");

    searchInput = document.createElement("input");
    searchInput.className = "ja-drive-select";
    searchInput.type = "search";
    searchInput.placeholder = "Search this folder";
    searchInput.setAttribute("aria-label", "Search Dropbox folder");
    searchInput.addEventListener("input", renderRows);

    countElement = document.createElement("span");
    countElement.className = "ja-drive-inline-count";
    countElement.textContent = "0 items";

    pathElement = document.createElement("div");
    pathElement.className = "ja-drive-inline-path";
    pathElement.setAttribute("aria-label", "Dropbox folder path");

    var refresh = createButton("↻", "ja-drive-icon-button");
    refresh.title = "Refresh Dropbox folder";
    refresh.setAttribute("aria-label", refresh.title);
    refresh.addEventListener("click", function () { loadFolder(false); });

    var disconnect = createButton("Disconnect", "ja-drive-text-button");
    disconnect.addEventListener("click", disconnectDropbox);

    toolbar.append(searchInput, countElement, pathElement, refresh, disconnect);
    mainTop.appendChild(toolbar);
    updatePath();
  }

  function restoreMainHeader() {
    var libraryWindow = document.getElementById("ja-reference-library-window");
    if (libraryWindow) libraryWindow.classList.remove("ja-lib-drive-active");
    var mainTop = toolbarMainTop || document.querySelector("#ja-reference-library-window .ja-lib-main-top");
    if (toolbar && toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
    toolbar = null;
    toolbarMainTop = null;
    pathElement = null;
    countElement = null;
    searchInput = null;
    if (mainTop) {
      var readOnly = mainTop.querySelector(".ja-lib-readonly");
      if (readOnly) readOnly.hidden = false;
    }
  }

  function renderRows() {
    var content = contentEl();
    if (!content) return;
    ensureToolbar();
    var query = String(searchInput && searchInput.value || "").trim().toLocaleLowerCase();
    var visible = files.filter(function (item) {
      return !query || String(item.name || "").toLocaleLowerCase().includes(query);
    });

    if (countElement) countElement.textContent = visible.length + " / " + files.length + " items";
    updatePath();
    content.innerHTML = "";
    var browser = document.createElement("div");
    browser.className = "ja-drive-browser";
    var table = document.createElement("div");
    table.className = "ja-drive-table";
    var header = document.createElement("div");
    header.className = "ja-drive-columns";
    header.innerHTML = "<span>Name</span><span>Modified</span><span>Size</span>";
    table.appendChild(header);

    if (!visible.length) {
      var empty = document.createElement("div");
      empty.className = "ja-drive-no-files";
      empty.textContent = query ? "No Dropbox files match your search." : "This Dropbox folder is empty.";
      table.appendChild(empty);
    }

    visible.forEach(function (item) {
      var folder = !!item.isFolder;
      var row = document.createElement("div");
      row.className = "ja-drive-row";
      row.dataset.fileId = item.id;
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");

      var first = document.createElement("span");
      first.className = "ja-drive-name-cell";
      var icon = document.createElement("span");
      icon.className = "ja-drive-file-icon type-" + categoryOf(item);
      icon.textContent = iconFor(item);
      var title = document.createElement("strong");
      title.className = "ja-drive-file-title";
      title.textContent = item.name;
      title.title = item.name;
      first.append(icon, title);

      var modified = document.createElement("span");
      modified.className = "ja-drive-modified";
      modified.textContent = folder ? "—" : formatDate(item.modifiedTime);
      var size = document.createElement("span");
      size.className = "ja-drive-file-size";
      size.textContent = folder ? "—" : formatBytes(item.size);
      row.append(first, modified, size);

      function openFolder() {
        stack.push({ path: item.path, name: item.name });
        loadFolder(false);
      }
      function selectFile() {
        if (!window.JupiterReferenceLibrary) return;
        window.JupiterReferenceLibrary.setSelectedFile(descriptor(item));
        table.querySelectorAll(".ja-drive-row.selected").forEach(function (node) {
          node.classList.remove("selected");
        });
        row.classList.add("selected");
      }
      function previewFile() {
        if (window.JupiterReferenceLibrary) window.JupiterReferenceLibrary.preview(descriptor(item));
      }

      row.addEventListener("click", function () {
        if (folder) openFolder();
        else selectFile();
      });
      row.addEventListener("dblclick", function () {
        if (!folder) previewFile();
      });
      row.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          if (folder) openFolder();
          else previewFile();
        } else if (event.key === " ") {
          event.preventDefault();
          if (folder) openFolder();
          else selectFile();
        }
      });
      table.appendChild(row);
    });

    browser.appendChild(table);
    if (cursor) {
      var moreWrap = document.createElement("div");
      moreWrap.className = "ja-drive-more-wrap";
      var more = createButton("Load more files", "ja-drive-text-button");
      more.addEventListener("click", function () { loadFolder(true); });
      moreWrap.appendChild(more);
      browser.appendChild(moreWrap);
    }
    content.appendChild(browser);
  }

  function renderConnectPrompt() {
    restoreMainHeader();
    setProviderStatus("Dropbox · Not connected");
    showMessage(
      "Connect Dropbox",
      "Authorize read-only access to browse and preview files in your Dropbox account. Jupiter Astrology will not upload, edit or delete your files.",
      false,
      "Connect Dropbox",
      connect
    );
  }

  async function loadFolder(append) {
    if (loading) return;
    loading = true;
    var serial = ++requestSerial;
    setProviderStatus("Dropbox · Loading…");
    try {
      var params = append ? { cursor: cursor } : { path: stack.length ? stack[stack.length - 1].path : "" };
      var response = await api("list", params, "GET");
      var result = await response.json();
      if (serial !== requestSerial) return;
      if (append) {
        var seen = new Set(files.map(function (item) { return item.id; }));
        (result.entries || []).forEach(function (item) {
          if (!seen.has(item.id)) files.push(item);
        });
      } else {
        files = result.entries || [];
      }
      cursor = result.hasMore ? result.cursor : "";
      setProviderStatus("Dropbox · Connected");
      var provider = providerButton();
      if (provider) provider.classList.add("is-connected");
      ensureToolbar();
      renderRows();
    } catch (error) {
      if (serial !== requestSerial) return;
      setProviderStatus("Dropbox · Connection needs attention");
      showMessage("Dropbox could not load this folder", error.message || "Check your Dropbox connection.", true, "Retry", function () { loadFolder(false); });
    } finally {
      if (serial === requestSerial) loading = false;
    }
  }

  async function openRoot() {
    requestSerial++;
    loading = false;
    files = [];
    cursor = "";
    stack = [{ path: "", name: "Dropbox" }];
    setProviderStatus("Dropbox · Checking connection…");
    var provider = providerButton();
    if (provider) provider.classList.remove("is-connected");
    try {
      var response = await api("status", {}, "GET");
      var status = await response.json();
      if (!status.connected) {
        renderConnectPrompt();
        return;
      }
      connected = true;
      await loadFolder(false);
    } catch (error) {
      connected = false;
      setProviderStatus("Dropbox · Setup required");
      showMessage("Dropbox is not ready", error.message || "Check Vercel and Firestore setup.", true, "Retry", openRoot);
    }
  }

  async function disconnectDropbox() {
    if (!window.confirm("Disconnect Dropbox from this Jupiter Astrology account? Your Dropbox files will not be changed.")) return;
    try {
      await api("disconnect", {}, "POST");
      connected = false;
      files = [];
      cursor = "";
      stack = [];
      var provider = providerButton();
      if (provider) provider.classList.remove("is-connected");
      renderConnectPrompt();
    } catch (error) {
      showMessage("Dropbox could not be disconnected", error.message || "Please try again.", true, "Retry", disconnectDropbox);
    }
  }

  function clear() {
    requestSerial++;
    loading = false;
    files = [];
    cursor = "";
    stack = [];
    connected = false;
    restoreMainHeader();
    var provider = providerButton();
    if (provider) provider.classList.remove("is-connected");
    clearSelection();
  }

  window.JupiterLibraryDropbox = {
    openRoot: openRoot,
    clear: clear,
    refresh: function () { return loadFolder(false); },
    connect: connect,
    disconnect: disconnectDropbox,
    getStatus: function () {
      return { connected: connected, loadedFiles: files.length, folder: stack.length ? stack[stack.length - 1].path : "" };
    }
  };

  window.dispatchEvent(new CustomEvent("ja-dropbox-connector-ready"));
  console.info("Jupiter Astro: Dropbox read-only Library connector loaded.");
})();