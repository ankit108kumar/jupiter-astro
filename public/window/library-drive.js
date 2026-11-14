/* =========================================================
   JUPITER ASTRO — GOOGLE DRIVE LIBRARY CONNECTOR
   Read-only folder browser with 7-day IndexedDB cache.
   ========================================================= */
(function () {
  "use strict";
  if (window.__JA_LIBRARY_DRIVE_LOADED) return;
  window.__JA_LIBRARY_DRIVE_LOADED = true;

  var API_ROOT = "https://www.googleapis.com/drive/v3";
  var ROOT = { id: "10ZkA2yVR0xHS9qpWpBRLjOKOCWIrzsNj", name: "Shared Astrology Library" };
  var PAGE_SIZE = 100;
  var CACHE_DB = "ja-library-drive-cache";
  var CACHE_VERSION = 1;
  var CACHE_STORE = "entries";
  var CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
  var MAX_CACHED_FILE_BYTES = 150 * 1024 * 1024;

  var stack = [];
  var files = [];
  var nextPageToken = null;
  var loading = false;
  var activeController = null;
  var refreshController = null;
  var selectedId = null;
  var requestSerial = 0;
  var searchBound = false;
  var dbPromise = null;
  var memoryCache = new Map();
  var currentFilter = "all";
  var currentSort = "name-asc";
  var driveToolbar = null;
  var driveToolbarMainTop = null;
  var driveFilterSelect = null;
  var driveSortSelect = null;
  var driveCount = null;
  var drivePath = null;

  function apiKey() {
    var config = window.jaFirebaseConfig;
    if (!config || !(config.driveApiKey || config.apiKey)) {
      throw new Error("Firebase configuration is not ready. Refresh the page and retry.");
    }
    return config.driveApiKey || config.apiKey;
  }

  function contentEl() {
    return document.querySelector("#ja-reference-library-window .ja-lib-content");
  }
  function searchEl() {
    return document.querySelector("#ja-reference-library-window .ja-lib-search");
  }

  function openCacheDb() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      var request;
      try {
        request = indexedDB.open(CACHE_DB, CACHE_VERSION);
      } catch (error) {
        resolve(null);
        return;
      }
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { resolve(null); };
      request.onblocked = function () { resolve(null); };
    });
    return dbPromise;
  }

  async function cacheGet(key) {
    var memoryEntry = memoryCache.get(key);
    if (memoryEntry) {
      if (memoryEntry.expiresAt > Date.now()) return memoryEntry.value;
      memoryCache.delete(key);
    }
    var db = await openCacheDb();
    if (!db) return null;
    return new Promise(function (resolve) {
      var tx, request;
      try {
        tx = db.transaction(CACHE_STORE, "readonly");
        request = tx.objectStore(CACHE_STORE).get(key);
      } catch (error) {
        resolve(null);
        return;
      }
      request.onsuccess = function () {
        var entry = request.result;
        if (!entry) {
          resolve(null);
        } else if (entry.expiresAt > Date.now()) {
          memoryCache.set(key, entry);
          resolve(entry.value);
        } else {
          resolve(null);
          cacheDelete(key);
        }
      };
      request.onerror = function () { resolve(null); };
    });
  }

  async function cachePut(key, value) {
    var entry = {
      key: key,
      value: value,
      savedAt: Date.now(),
      expiresAt: Date.now() + CACHE_TTL
    };
    memoryCache.set(key, entry);
    var db = await openCacheDb();
    if (!db) return false;
    return new Promise(function (resolve) {
      var tx;
      try {
        tx = db.transaction(CACHE_STORE, "readwrite");
        tx.objectStore(CACHE_STORE).put(entry);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
        tx.onabort = function () { resolve(false); };
      } catch (error) {
        resolve(false);
      }
    });
  }

  async function cacheDelete(key) {
    memoryCache.delete(key);
    var db = await openCacheDb();
    if (!db) return;
    try {
      var tx = db.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).delete(key);
    } catch (error) {}
  }

  function requestPersistentStorage() {
    if (!navigator.storage || typeof navigator.storage.persist !== "function") return;
    navigator.storage.persist().then(function (granted) {
      if (granted) {
        console.info("Jupiter Astro Library: browser granted persistent storage.");
      } else {
        console.info("Jupiter Astro Library: local cache is best-effort browser storage.");
      }
    }).catch(function () {});
  }

  async function clearLocalCache() {
    memoryCache.clear();
    var db = await openCacheDb();
    if (!db) return false;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(CACHE_STORE, "readwrite");
        tx.objectStore(CACHE_STORE).clear();
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
        tx.onabort = function () { resolve(false); };
      } catch (error) {
        resolve(false);
      }
    });
  }

  function setStatus(value) {
    var label = document.querySelector("#ja-reference-library-window .ja-lib-source-label");
    if (label) label.textContent = value;
    var provider = document.querySelector('#ja-reference-library-window [data-ja-provider="google-drive"]');
    if (provider) provider.classList.toggle("is-connected", value.indexOf("Connected") !== -1 || value.indexOf("Cached") !== -1);
  }

  function setNotice(value, isError) {
    var notice = document.querySelector("#ja-reference-library-window .ja-lib-notice");
    if (!notice) return;
    notice.textContent = value || "";
    notice.classList.toggle("visible", !!value);
    notice.classList.toggle("error", !!isError);
  }

  function clearSelection() {
    selectedId = null;
    if (window.JupiterReferenceLibrary) window.JupiterReferenceLibrary.setSelectedFile(null);
  }

  function formatBytes(value) {
    var n = Number(value);
    if (!Number.isFinite(n) || n < 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
    return (n / 1073741824).toFixed(1) + " GB";
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

  function isFolder(item) {
    return item.mimeType === "application/vnd.google-apps.folder";
  }

  function categoryOf(item) {
    if (isFolder(item)) return "folder";
    var mime = item.mimeType || "";
    var ext = extensionOf(item.name);
    if (mime === "application/pdf" || ext === "pdf") return "pdf";
    if (/spreadsheet|excel|csv/.test(mime) || /^(xlsx?|xlsm|xlsb|ods|csv)$/.test(ext) ||
        mime === "application/vnd.google-apps.spreadsheet") return "spreadsheet";
    if (/presentation|powerpoint/.test(mime) || /^(pptx?|odp)$/.test(ext) ||
        mime === "application/vnd.google-apps.presentation") return "presentation";
    if (/wordprocessingml|msword|rtf/.test(mime) || /^(docx?|rtf|odt)$/.test(ext) ||
        mime === "application/vnd.google-apps.document") return "document";
    if (/^image\//.test(mime) || /^(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/.test(ext)) return "image";
    if (/^(audio|video)\//.test(mime) || /^(mp3|wav|ogg|m4a|aac|flac|mp4|webm|mov|m4v)$/.test(ext)) return "media";
    return "other";
  }

  function categoryLabel(item) {
    var map = {
      folder: "Folder", pdf: "PDF", document: "Document", spreadsheet: "Spreadsheet",
      presentation: "Presentation", image: "Image", media: "Media", other: "File"
    };
    return map[categoryOf(item)] || "File";
  }

  function iconFor(item) {
    var icons = {
      folder: "▰", pdf: "PDF", document: "W", spreadsheet: "▦",
      presentation: "P", image: "▧", media: "▶", other: "▤"
    };
    return icons[categoryOf(item)] || "▤";
  }

  function isGoogleWorkspace(mime) {
    return /^application\/vnd\.google-apps\.(document|spreadsheet|presentation|drawing)$/.test(mime || "");
  }

  function workspaceExport(mime) {
    switch (mime) {
      case "application/vnd.google-apps.document":
        return {
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          extension: ".docx"
        };
      case "application/vnd.google-apps.spreadsheet":
        return {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          extension: ".xlsx"
        };
      case "application/vnd.google-apps.presentation":
        return {
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          extension: ".pptx"
        };
      case "application/vnd.google-apps.drawing":
        return { mimeType: "application/pdf", extension: ".pdf" };
      default:
        return null;
    }
  }

  function resourceHeader(fileId, resourceKey) {
    return resourceKey ? { "X-Goog-Drive-Resource-Keys": fileId + "/" + resourceKey } : {};
  }

  async function apiJson(url, signal) {
    var response, raw, body;
    try {
      response = await fetch(url, { method: "GET", credentials: "omit", signal: signal });
    } catch (error) {
      if (error && error.name === "AbortError") throw error;
      throw new Error("Could not reach Google Drive. Check your network, Drive API settings and API-key referrer restrictions.");
    }
    raw = await response.text();
    try { body = raw ? JSON.parse(raw) : {}; } catch (error) { body = {}; }
    if (!response.ok) {
      var apiError = body.error || {};
      var reason = apiError.errors && apiError.errors[0] && apiError.errors[0].reason || "";
      var message = apiError.message || ("Google Drive returned HTTP " + response.status + ".");
      if (reason === "accessNotConfigured" || reason === "SERVICE_DISABLED") {
        message = "Google Drive API is not enabled for the Jupiter Astrology Google Cloud project. Enable it, then retry.";
      } else if (/API_KEY_INVALID|API key not valid|API_KEY_SERVICE_BLOCKED/i.test(message + " " + reason)) {
        message = "The Google Drive API key is not authorised for Drive API. Check its API and website restrictions.";
      } else if (response.status === 404 || /File not found/i.test(message)) {
        message = "The folder or file was not found or is not publicly viewable. Check its sharing permission.";
      } else if (response.status === 401 || response.status === 403) {
        message = "Google Drive denied read access. Check that the folder is shared as Anyone with the link — Viewer.";
      }
      throw new Error(message);
    }
    return body;
  }

  async function listFolder(folderId, pageToken, signal) {
    var url = new URL(API_ROOT + "/files");
    url.searchParams.set("q", "'" + folderId + "' in parents and trashed = false");
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    url.searchParams.set("orderBy", "folder,name");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,resourceKey,capabilities(canDownload),shortcutDetails(targetId,targetMimeType,targetResourceKey))");
    url.searchParams.set("key", apiKey());
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    return apiJson(url.toString(), signal);
  }

  async function downloadFile(item, signal) {
    var shortcut = item.shortcutDetails || {};
    var fileId = shortcut.targetId || item.id;
    var resourceKey = shortcut.targetResourceKey || item.resourceKey || "";
    var params = new URLSearchParams({
      action: "download",
      fileId: fileId
    });
    if (resourceKey) params.set("resourceKey", resourceKey);

    var response;
    try {
      response = await fetch("/api/drive?" + params.toString(), {
        method: "GET",
        credentials: "same-origin",
        signal: signal,
        headers: { Accept: "*/*" }
      });
    } catch (error) {
      if (error && error.name === "AbortError") throw error;
      throw new Error("Could not reach the Jupiter Drive preview service. Check your connection and try again.");
    }

    if (!response.ok) {
      var message = "The Drive preview service returned HTTP " + response.status + ".";
      try {
        var body = await response.json();
        if (body && body.error) message = body.error;
      } catch (error) {}
      throw new Error(message);
    }

    var blob = await response.blob();
    if (!blob.size) throw new Error("Google Drive returned an empty file.");
    var mimeType = response.headers.get("content-type") || "";
    if (!blob.type && mimeType) blob = new Blob([blob], { type: mimeType });
    return blob;
  }

  function fileCacheKey(item) {
    var shortcut = item.shortcutDetails || {};
    var id = shortcut.targetId || item.id;
    var mime = shortcut.targetMimeType || item.mimeType || "";
    var exportInfo = workspaceExport(mime);
    var modified = item.modifiedTime || "unversioned";
    return "file:" + id + ":" + modified + ":" + (exportInfo ? exportInfo.extension : "original");
  }

  async function getCachedFile(item, signal) {
    var key = fileCacheKey(item);
    var cached = await cacheGet(key);
    if (cached && cached.blob instanceof Blob) return cached.blob;
    var blob = await downloadFile(item, signal);
    if (blob.size <= MAX_CACHED_FILE_BYTES) {
      var saved = await cachePut(key, {
        blob: blob,
        name: item.name || "",
        mimeType: blob.type || item.mimeType || "",
        modifiedTime: item.modifiedTime || ""
      });
      if (!saved) {
        setNotice("The file opened, but the browser could not save its local copy. Check available device storage.", false);
      }
    } else {
      setNotice("This file is larger than the local cache limit, so it will not be stored on this device.", false);
    }
    return blob;
  }

  function descriptor(item) {
    var shortcut = item.shortcutDetails || {};
    var id = shortcut.targetId || item.id;
    var mime = shortcut.targetMimeType || item.mimeType;
    var exportInfo = workspaceExport(mime);
    var name = exportInfo
      ? String(item.name).replace(/\.[^.]+$/, "") + exportInfo.extension
      : item.name;
    return {
      id: id,
      name: name,
      mimeType: exportInfo ? exportInfo.mimeType : mime,
      size: Number(item.size) || undefined,
      provider: "Google Drive",
      modifiedTime: item.modifiedTime || "",
      resourceKey: shortcut.targetResourceKey || item.resourceKey || "",
      webViewLink: item.webViewLink || "",
      getBlob: function (options) {
        return getCachedFile(item, options && options.signal);
      }
    };
  }

  function button(label, className, action) {
    var el = document.createElement("button");
    el.type = "button";
    el.className = className;
    el.textContent = label;
    el.dataset.driveAction = action;
    return el;
  }

  function selectControl(className, label, options, selected) {
    var select = document.createElement("select");
    select.className = className;
    select.setAttribute("aria-label", label);
    options.forEach(function (option) {
      var item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      item.selected = option.value === selected;
      select.appendChild(item);
    });
    return select;
  }

  function showMessage(title, message, isError) {
    var content = contentEl();
    if (!content) return;
    content.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "ja-lib-empty ja-drive-empty";
    var icon = document.createElement("div");
    icon.className = "ja-lib-empty-symbol";
    icon.textContent = isError ? "!" : "▤";
    var heading = document.createElement("strong");
    heading.className = "ja-lib-empty-title";
    heading.textContent = title;
    var p = document.createElement("p");
    p.className = "ja-lib-empty-description";
    p.textContent = message;
    wrap.append(icon, heading, p);
    if (isError) wrap.appendChild(button("Retry connection", "ja-drive-button primary", "retry"));
    content.appendChild(wrap);
  }

  function bindSearch() {
    var search = searchEl();
    if (!search || searchBound) return;
    search.addEventListener("input", renderRows);
    searchBound = true;
  }

  function openRoot() {
    requestPersistentStorage();
    if (activeController) activeController.abort();
    if (refreshController) refreshController.abort();
    requestSerial++;
    loading = false;
    stack = [{ id: ROOT.id, name: ROOT.name }];
    files = [];
    nextPageToken = null;
    currentFilter = "all";
    currentSort = "name-asc";
    ensureDriveToolbar();
    if (driveFilterSelect) driveFilterSelect.value = currentFilter;
    if (driveSortSelect) driveSortSelect.value = currentSort;
    clearSelection();
    bindSearch();
    var search = searchEl();
    if (search) search.value = "";
    setStatus("Google Drive · Opening library…");
    setNotice("");
    showMessage("Opening your library", "Checking this device's seven-day cache first.", false);
    return loadCurrent(false, false);
  }

  function applyPage(data, append) {
    var incoming = Array.isArray(data.files) ? data.files : [];
    if (append) {
      var seen = new Set(files.map(function (file) { return file.id; }));
      incoming.forEach(function (file) {
        if (!seen.has(file.id)) files.push(file);
      });
    } else {
      files = incoming;
    }
    nextPageToken = data.nextPageToken || null;
  }

  function folderCacheKey(folderId, pageToken) {
    return "folder:" + folderId + ":" + (pageToken || "first");
  }

  async function refreshInBackground(folderId, pageToken, serial, append) {
    if (refreshController) refreshController.abort();
    refreshController = new AbortController();
    var controller = refreshController;
    try {
      var result = await listFolder(folderId, pageToken, controller.signal);
      if (serial !== requestSerial || !stack.length || stack[stack.length - 1].id !== folderId) return;
      await cachePut(folderCacheKey(folderId, pageToken), result);
      applyPage(result, append);
      setStatus("Google Drive · Connected");
      // Keep the current DOM intact during a background refresh so it cannot
      // interrupt row selection, text selection or a double-click gesture.
    } catch (error) {
      if (error && error.name === "AbortError") return;
      if (serial !== requestSerial) return;
      if (files.length) {
        setStatus("Google Drive · Cached");
        setNotice("");
      } else {
        setStatus("Google Drive · Connection needs attention");
        showMessage("Google Drive could not be connected", error.message || "Check folder sharing and API settings.", true);
      }
    }
  }

  async function loadCurrent(append, forceNetwork) {
    if (loading || !stack.length) return;
    loading = true;
    if (activeController) activeController.abort();
    var controller = new AbortController();
    activeController = controller;
    var serial = ++requestSerial;
    var folder = stack[stack.length - 1];
    var pageToken = append ? nextPageToken : null;
    var cacheKey = folderCacheKey(folder.id, pageToken);

    if (!forceNetwork) {
      var cached = await cacheGet(cacheKey);
      if (serial !== requestSerial) return;
      if (cached && Array.isArray(cached.files)) {
        applyPage(cached, append);
        setStatus("Google Drive · Cached");
        setNotice("");
        renderBrowser();
        loading = false;
        refreshInBackground(folder.id, pageToken, serial, append);
        return;
      }
    }

    if (!append && !files.length) {
      showMessage(forceNetwork ? "Refreshing folder…" : "Loading folder…",
        "Fetching file names and metadata from Google Drive.", false);
    }

    try {
      var result = await listFolder(folder.id, pageToken, controller.signal);
      if (serial !== requestSerial) return;
      await cachePut(cacheKey, result);
      applyPage(result, append);
      setStatus("Google Drive · Connected");
      setNotice("");
      renderBrowser();
    } catch (error) {
      if (error && error.name === "AbortError") return;
      if (serial !== requestSerial) return;
      if (files.length) {
        setStatus("Google Drive · Cached");
        setNotice("");
        renderBrowser();
      } else {
        setStatus("Google Drive · Connection needs attention");
        showMessage("Google Drive could not be connected", error.message || "Check the folder sharing and API settings.", true);
      }
    } finally {
      if (serial === requestSerial) loading = false;
    }
  }

  function matchesFilter(item) {
    if (currentFilter === "all") return true;
    return categoryOf(item) === currentFilter;
  }

  function sortItems(items) {
    var result = items.slice();
    result.sort(function (a, b) {
      var folderDiff = Number(isFolder(b)) - Number(isFolder(a));
      if (folderDiff) return folderDiff;
      var nameDiff, dateDiff, sizeDiff;
      switch (currentSort) {
        case "name-desc":
          return String(b.name || "").localeCompare(String(a.name || ""), undefined, { sensitivity: "base" });
        case "modified-newest":
          dateDiff = new Date(b.modifiedTime || 0).getTime() - new Date(a.modifiedTime || 0).getTime();
          return dateDiff || String(a.name || "").localeCompare(String(b.name || ""));
        case "modified-oldest":
          dateDiff = new Date(a.modifiedTime || 0).getTime() - new Date(b.modifiedTime || 0).getTime();
          return dateDiff || String(a.name || "").localeCompare(String(b.name || ""));
        case "size-largest":
          sizeDiff = (Number(b.size) || 0) - (Number(a.size) || 0);
          return sizeDiff || String(a.name || "").localeCompare(String(b.name || ""));
        case "size-smallest":
          sizeDiff = (Number(a.size) || 0) - (Number(b.size) || 0);
          return sizeDiff || String(a.name || "").localeCompare(String(b.name || ""));
        default:
          nameDiff = String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
          return nameDiff;
      }
    });
    return result;
  }

  function ensureDriveToolbar() {
    var mainTop = document.querySelector("#ja-reference-library-window .ja-lib-main-top");
    if (!mainTop) return;

    var libraryWindow = document.getElementById("ja-reference-library-window");
    if (libraryWindow) libraryWindow.classList.add("ja-lib-drive-active");

    var readonly = mainTop.querySelector(".ja-lib-readonly");
    if (readonly) readonly.hidden = true;

    if (driveToolbar && driveToolbar.isConnected) return;

    driveToolbarMainTop = mainTop;
    driveToolbar = document.createElement("div");
    driveToolbar.className = "ja-drive-inline-controls";
    driveToolbar.setAttribute("aria-label", "Google Drive folder controls");

    driveFilterSelect = selectControl("ja-drive-select", "Filter files", [
      { value: "all", label: "All files" },
      { value: "folder", label: "Folders" },
      { value: "pdf", label: "PDF files" },
      { value: "document", label: "Documents" },
      { value: "spreadsheet", label: "Spreadsheets" },
      { value: "presentation", label: "Presentations" },
      { value: "image", label: "Images" },
      { value: "media", label: "Audio & video" },
      { value: "other", label: "Other files" }
    ], currentFilter);
    driveFilterSelect.addEventListener("change", function () {
      currentFilter = driveFilterSelect.value;
      renderRows();
    });

    driveSortSelect = selectControl("ja-drive-select", "Sort files", [
      { value: "name-asc", label: "Name · A–Z" },
      { value: "name-desc", label: "Name · Z–A" },
      { value: "modified-newest", label: "Recently modified" },
      { value: "modified-oldest", label: "Oldest modified" },
      { value: "size-largest", label: "Largest first" },
      { value: "size-smallest", label: "Smallest first" }
    ], currentSort);
    driveSortSelect.addEventListener("change", function () {
      currentSort = driveSortSelect.value;
      renderRows();
    });

    driveCount = document.createElement("span");
    driveCount.className = "ja-drive-inline-count";
    driveCount.textContent = files.length + " items";

    drivePath = document.createElement("div");
    drivePath.className = "ja-drive-inline-path";
    drivePath.setAttribute("aria-label", "Current folder");

    var refresh = button("↻", "ja-drive-icon-button", "refresh");
    refresh.title = "Refresh from Google Drive";
    refresh.setAttribute("aria-label", "Refresh from Google Drive");
    refresh.addEventListener("click", function () {
      loadCurrent(false, true);
    });

    var clear = button("Clear cache", "ja-drive-text-button", "clear-cache");
    clear.addEventListener("click", function () {
      if (!window.confirm("Clear saved Google Drive folder lists and opened-file copies from this device?")) return;
      clearLocalCache().then(function () {
        setNotice("");
        loadCurrent(false, true);
      });
    });

    driveToolbar.append(
      driveFilterSelect,
      driveSortSelect,
      driveCount,
      drivePath,
      refresh,
      clear
    );
    mainTop.appendChild(driveToolbar);
    updateDrivePath();
  }

  function updateDrivePath() {
    if (!drivePath || !drivePath.isConnected) return;
    drivePath.innerHTML = "";
    stack.forEach(function (folder, index) {
      if (index) {
        var sep = document.createElement("span");
        sep.className = "ja-drive-crumb-separator";
        sep.textContent = "›";
        drivePath.appendChild(sep);
      }
      var crumb = button(folder.name, "ja-drive-crumb", "crumb");
      crumb.dataset.index = String(index);
      crumb.disabled = index === stack.length - 1;
      crumb.title = folder.name;
      crumb.addEventListener("click", function () {
        var targetIndex = Number(crumb.dataset.index);
        if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= stack.length - 1) return;
        if (activeController) activeController.abort();
        if (refreshController) refreshController.abort();
        stack = stack.slice(0, targetIndex + 1);
        clearSelection();
        loadCurrent(false, false);
      });
      drivePath.appendChild(crumb);
    });
  }

  function restoreMainHeader() {
    var libraryWindow = document.getElementById("ja-reference-library-window");
    if (libraryWindow) libraryWindow.classList.remove("ja-lib-drive-active");
    var mainTop = driveToolbarMainTop || document.querySelector("#ja-reference-library-window .ja-lib-main-top");
    if (driveToolbar && driveToolbar.parentNode) driveToolbar.parentNode.removeChild(driveToolbar);
    driveToolbar = null;
    driveToolbarMainTop = null;
    driveFilterSelect = null;
    driveSortSelect = null;
    driveCount = null;
    drivePath = null;
    if (mainTop) {
      var readonly = mainTop.querySelector(".ja-lib-readonly");
      if (readonly) readonly.hidden = false;
    }
  }

  function renderBrowser() {
    var content = contentEl();
    if (!content) return;
    ensureDriveToolbar();
    renderRows();
  }

  function matchesFilter(item) {
    if (currentFilter === "all") return true;
    return categoryOf(item) === currentFilter;
  }

  function renderRows() {
    var content = contentEl();
    if (!content) return;
    if (!driveToolbar || !driveToolbar.isConnected) ensureDriveToolbar();

    var query = (searchEl() && searchEl().value || "").trim().toLocaleLowerCase();
    var visible = sortItems(files.filter(function (item) {
      return (!query || String(item.name || "").toLocaleLowerCase().includes(query)) && matchesFilter(item);
    }));

    if (driveCount) {
      driveCount.textContent = visible.length + (visible.length === 1 ? " item" : " items");
    }
    updateDrivePath();

    content.innerHTML = "";
    var browser = document.createElement("div");
    browser.className = "ja-drive-browser";
    var table = document.createElement("div");
    table.className = "ja-drive-table";

    var header = document.createElement("div");
    header.className = "ja-drive-columns";
    header.innerHTML = '<span>Name</span><span>Modified</span><span>Size</span>';
    table.appendChild(header);

    if (!visible.length) {
      var empty = document.createElement("div");
      empty.className = "ja-drive-no-files";
      empty.textContent = query || currentFilter !== "all"
        ? "No files match the current search or filter."
        : "This folder is empty, or its contents are not visible to link viewers.";
      table.appendChild(empty);
    }

    visible.forEach(function (item) {
      var folder = isFolder(item);
      var row = document.createElement("div");
      row.className = "ja-drive-row" + (item.id === selectedId ? " selected" : "");
      row.dataset.fileId = item.id;
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");
      row.setAttribute("aria-pressed", item.id === selectedId ? "true" : "false");

      var first = document.createElement("span");
      first.className = "ja-drive-name-cell";
      var icon = document.createElement("span");
      icon.className = "ja-drive-file-icon type-" + categoryOf(item);
      icon.textContent = iconFor(item);

      var name = document.createElement("strong");
      name.className = "ja-drive-file-title";
      name.textContent = item.name || "Untitled";
      name.title = item.name || "Untitled";
      first.append(icon, name);

      var modified = document.createElement("span");
      modified.className = "ja-drive-modified";
      modified.textContent = folder ? "—" : formatDate(item.modifiedTime);
      var size = document.createElement("span");
      size.className = "ja-drive-file-size";
      size.textContent = folder ? "—" : formatBytes(item.size);
      row.append(first, modified, size);

      function navigateFolder() {
        if (activeController) activeController.abort();
        if (refreshController) refreshController.abort();
        stack.push({ id: item.id, name: item.name || "Folder" });
        clearSelection();
        loadCurrent(false, false);
      }

      function selectFile() {
        selectedId = item.id;
        if (window.JupiterReferenceLibrary) {
          window.JupiterReferenceLibrary.setSelectedFile(descriptor(item));
        }
        table.querySelectorAll(".ja-drive-row.selected").forEach(function (selected) {
          selected.classList.remove("selected");
          selected.setAttribute("aria-pressed", "false");
        });
        row.classList.add("selected");
        row.setAttribute("aria-pressed", "true");
      }

      row.addEventListener("click", function () {
        if (folder) navigateFolder();
        else selectFile();
      });

      row.addEventListener("dblclick", function (event) {
        if (folder) return;
        if (window.JupiterReferenceLibrary) {
          window.JupiterReferenceLibrary.preview(descriptor(item));
        }
      });

      row.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          if (folder) navigateFolder();
          else if (window.JupiterReferenceLibrary) {
            window.JupiterReferenceLibrary.preview(descriptor(item));
          }
        } else if (event.key === " ") {
          event.preventDefault();
          if (folder) navigateFolder();
          else selectFile();
        }
      });

      table.appendChild(row);
    });

    browser.appendChild(table);
    if (nextPageToken) {
      var moreWrap = document.createElement("div");
      moreWrap.className = "ja-drive-more-wrap";
      var more = button("Load more files", "ja-drive-load-more", "more");
      more.addEventListener("click", function () { loadCurrent(true, false); });
      moreWrap.appendChild(more);
      browser.appendChild(moreWrap);
    }
    content.appendChild(browser);
  }

  function onContentClick(event) {
    var target = event.target.closest("[data-drive-action]");
    if (!target || target.disabled) return;
    var action = target.dataset.driveAction;
    if (action === "retry") {
      loadCurrent(false, true);
    } else if (action === "more") {
      loadCurrent(true, false);
    }
  }

  function init() {
    var content = contentEl();
    if (content && !content.dataset.driveBound) {
      content.addEventListener("click", onContentClick);
      content.dataset.driveBound = "true";
    }
  }

  function clear() {
    restoreMainHeader();
    if (activeController) activeController.abort();
    if (refreshController) refreshController.abort();
    requestSerial++;
    loading = false;
    stack = [];
    files = [];
    nextPageToken = null;
    selectedId = null;
    var provider = document.querySelector('#ja-reference-library-window [data-ja-provider="google-drive"]');
    if (provider) provider.classList.remove("is-connected");
    clearSelection();
  }

  window.JupiterLibraryDrive = {
    openRoot: function () { init(); return openRoot(); },
    clear: clear,
    refresh: function () { return stack.length ? loadCurrent(false, true) : openRoot(); },
    clearCache: clearLocalCache,
    getConvertedPreview: async function (key) {
      return cacheGet("converted-docx-pdf:v1:" + String(key || ""));
    },
    setConvertedPreview: async function (key, blob, fileName) {
      if (!(blob instanceof Blob) || !blob.size) return false;
      return cachePut("converted-docx-pdf:v1:" + String(key || ""), {
        blob: blob,
        name: fileName || "",
        mimeType: "application/pdf",
        savedAt: Date.now()
      });
    },
    getFolderId: function () { return ROOT.id; },
    getStatus: function () {
      return {
        folderId: ROOT.id,
        loadedFiles: files.length,
        connected: stack.length > 0,
        cacheTtlDays: 7,
        cacheStorage: "IndexedDB"
      };
    }
  };
  console.info("Jupiter Astro: Google Drive Library connector loaded. Folder and opened-file cache TTL: 7 days.");
})();