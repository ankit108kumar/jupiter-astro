/* =========================================================
   JUPITER ASTRO — DOCUMENT PREVIEW ENGINE
   Provider-neutral API:
   JupiterLibraryPreview.open({
     name, mimeType, size, provider,
     blob | arrayBuffer | content | getBlob() | fetchContent()
   })
   ========================================================= */
(function () {
  "use strict";
  if (window.__JA_LIBRARY_PREVIEW_LOADED) return;
  window.__JA_LIBRARY_PREVIEW_LOADED = true;

  var PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.mjs";
  var PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.worker.mjs";
  var JSZIP_URL = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
  var DOCX_PREVIEW_URL = "https://cdn.jsdelivr.net/npm/docx-preview@0.4.1/dist/docx-preview.min.js";
  var SHEETJS_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
  var PAGUS_CORE_URL = "https://esm.sh/@pagus-kit/core@0.1.1?bundle";
  var PAGUS_RENDERER_URL = "https://esm.sh/@pagus-kit/renderer@0.1.1?bundle";
  var MAX_PREVIEW_BYTES = 150 * 1024 * 1024;
  var panel = null;
  var current = null;
  var requestId = 0;
  var previousFocus = null;
  var spreadsheetEngine = null;
  var modulePromises = Object.create(null);
  var scriptPromises = Object.create(null);

  function loadScript(url, key, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (scriptPromises[key]) return scriptPromises[key];
    scriptPromises[key] = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.jaPreviewLib = key;
      script.onload = function () {
        if (window[globalName]) resolve(window[globalName]);
        else reject(new Error("The " + key + " library did not initialize."));
      };
      script.onerror = function () {
        reject(new Error("Could not load " + key + ". Check your internet connection or CDN access."));
      };
      document.head.appendChild(script);
    }).catch(function (error) {
      delete scriptPromises[key];
      throw error;
    });
    return scriptPromises[key];
  }

  function loadModule(key, url) {
    if (!modulePromises[key]) {
      modulePromises[key] = import(url).catch(function (error) {
        delete modulePromises[key];
        throw error;
      });
    }
    return modulePromises[key];
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(Number(bytes)) || Number(bytes) < 0) return "Size unavailable";
    var n = Number(bytes);
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
    return (n / 1073741824).toFixed(2) + " GB";
  }

  function extensionOf(name) {
    var match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function detectType(file) {
    var ext = extensionOf(file.name);
    var mime = String(file.mimeType || file.mime_type || file.type || "").toLowerCase().split(";")[0].trim();
    if (file.embedUrl) return "remote";
    if (mime === "application/pdf" || ext === "pdf") return "pdf";
    if (/^image\//.test(mime) || /^(png|jpe?g|gif|webp|bmp|svg|avif|tif?f)$/.test(ext)) return "image";
    if (/wordprocessingml\.document/.test(mime) || ext === "docx") return "docx";
    if (/spreadsheetml|ms-excel/.test(mime) || /^(xlsx|xls|xlsm|xlsb|csv|ods)$/.test(ext)) return "spreadsheet";
    if (/presentationml\.presentation/.test(mime) || ext === "pptx") return "pptx";
    if (/^(mp3|wav|ogg|m4a|aac|flac)$/.test(ext) || /^audio\//.test(mime)) return "audio";
    if (/^(mp4|webm|mov|m4v|ogv)$/.test(ext) || /^video\//.test(mime)) return "video";
    if (/^(txt|md|markdown|json|xml|html|htm|css|js|ts|log|yaml|yml|rtf|ini|sql)$/.test(ext) ||
        /^(text\/|application\/json|application\/xml)/.test(mime)) return "text";
    return "unsupported";
  }

  var SEARCHABLE_PREVIEW_TYPES = new Set(["pdf", "docx", "spreadsheet", "pptx", "text"]);
  var SEARCH_MAX_MATCHES = 20000;

  function isSearchAvailable() {
    return !!current && SEARCHABLE_PREVIEW_TYPES.has(current.type);
  }

  function setSearchToolbarVisibility() {
    if (!panel) return;
    var wrap = panel.querySelector("[data-preview-search-wrap]");
    if (wrap) wrap.hidden = !isSearchAvailable();
  }

  function updateSearchToolbar() {
    if (!panel || !current || !current.search) return;
    var wrap = panel.querySelector("[data-preview-search-wrap]");
    var input = panel.querySelector("[data-preview-search-input]");
    var count = panel.querySelector("[data-preview-search-count]");
    var previous = panel.querySelector('[data-preview-action="search-prev"]');
    var next = panel.querySelector('[data-preview-action="search-next"]');
    if (!wrap || !input || !count) return;
    wrap.hidden = !isSearchAvailable();
    if (input.value !== current.search.query) input.value = current.search.query;
    input.disabled = !current.search.ready;
    count.textContent = current.search.building ? "…" :
      (current.search.matches.length && current.search.index >= 0
        ? (current.search.index + 1) + "/" + current.search.matches.length : "0/0");
    var enabled = current.search.ready && current.search.matches.length > 0;
    if (previous) previous.disabled = !enabled;
    if (next) next.disabled = !enabled;
  }

  function setSearchReady(value) {
    if (!current || !current.search) return;
    current.search.ready = !!value;
    updateSearchToolbar();
    if (current.search.ready && current.search.query && !current.search.building) {
      runPreviewSearch(current.search.query);
    }
  }

  function prepareSearchForRerender() {
    if (!current || !current.search) return;
    if (current.search.timer) window.clearTimeout(current.search.timer);
    current.search.timer = null;
    current.search.token++;
    current.search.matches = [];
    current.search.index = -1;
    current.search.building = false;
    current.search.ready = false;
    clearSearchHighlights();
    updateSearchToolbar();
  }

  function clearSearchHighlights() {
    if (!window.CSS || !CSS.highlights) return;
    CSS.highlights.delete("ja-lib-search-results");
    CSS.highlights.delete("ja-lib-search-active");
  }

  function getTextRanges(root, query) {
    if (!root || !query) return [];
    var needle = String(query).toLocaleLowerCase();
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var segments = [];
    var combined = "";
    var node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.parentElement ||
          node.parentElement.closest("script,style,noscript,template,[aria-hidden='true']")) continue;
      var value = node.nodeValue;
      if (!value) continue;
      segments.push({ node: node, start: combined.length, end: combined.length + value.length });
      combined += value;
    }
    if (!combined) return [];
    var lower = combined.toLocaleLowerCase();
    function locate(offset, endOffset) {
      for (var i = 0; i < segments.length; i++) {
        var segment = segments[i];
        if (offset >= segment.start && (offset < segment.end || (endOffset && offset === segment.end))) return segment;
      }
      return null;
    }
    var ranges = [];
    var cursor = 0;
    while (cursor <= lower.length - needle.length && ranges.length < SEARCH_MAX_MATCHES) {
      var start = lower.indexOf(needle, cursor);
      if (start < 0) break;
      var end = start + needle.length;
      var first = locate(start, false);
      var last = locate(end, true);
      if (first && last) {
        try {
          var range = document.createRange();
          range.setStart(first.node, start - first.start);
          range.setEnd(last.node, end - last.start);
          ranges.push(range);
        } catch (error) {}
      }
      cursor = start + Math.max(1, needle.length);
    }
    return ranges;
  }

  function applySearchHighlights(ranges, activeRange) {
    if (!window.CSS || !CSS.highlights || typeof window.Highlight !== "function") return;
    try {
      CSS.highlights.delete("ja-lib-search-results");
      CSS.highlights.delete("ja-lib-search-active");
      if (ranges && ranges.length) CSS.highlights.set("ja-lib-search-results", new Highlight(...ranges));
      if (activeRange) CSS.highlights.set("ja-lib-search-active", new Highlight(activeRange));
    } catch (error) {
      console.warn("Jupiter Library: could not highlight search results.", error);
    }
  }

  function scrollSearchRange(range) {
    if (!range) return;
    var element = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer : range.startContainer.parentElement;
    if (element && element.scrollIntoView) {
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }
  }

  function findOccurrences(value, query) {
    var haystack = String(value == null ? "" : value).toLocaleLowerCase();
    var needle = String(query || "").toLocaleLowerCase();
    var result = [];
    var cursor = 0;
    while (needle && cursor <= haystack.length - needle.length && result.length < SEARCH_MAX_MATCHES) {
      var found = haystack.indexOf(needle, cursor);
      if (found < 0) break;
      result.push(found);
      cursor = found + Math.max(1, needle.length);
    }
    return result;
  }

  function getDomSearchRoot() {
    if (!current) return null;
    var stage = panel.querySelector(".ja-lib-preview-stage");
    if (current.type === "docx" && current.docxRenderer !== "pdf") return stage.querySelector(".ja-lib-docxjs-body");
    if (current.type === "text") return stage.querySelector(".ja-lib-text-preview");
    return null;
  }

  function buildDomSearchMatches(query) {
    return getTextRanges(getDomSearchRoot(), query).map(function (_, index) {
      return { kind: "dom", rangeIndex: index };
    });
  }

  async function buildPdfSearchMatches(id, query) {
    if (!current.pdfDocument) return [];
    var matches = [];
    for (var pageNo = 1; pageNo <= current.pdfDocument.numPages; pageNo++) {
      ensureCurrent(id);
      var page = current.pdfPageObjects[pageNo - 1] || await current.pdfDocument.getPage(pageNo);
      var content = await page.getTextContent();
      ensureCurrent(id);
      var text = (content.items || []).map(function (item) { return String(item.str || ""); }).join("");
      findOccurrences(text, query).forEach(function (_, localIndex) {
        if (matches.length < SEARCH_MAX_MATCHES) matches.push({ kind: "pdf", pageNumber: pageNo, localIndex: localIndex });
      });
      if (matches.length >= SEARCH_MAX_MATCHES) break;
    }
    return matches;
  }

  function getSpreadsheetCellText(cell) {
    if (!cell) return "";
    if (cell.w != null && String(cell.w) !== "") return String(cell.w);
    if (cell.v == null) return "";
    if (cell.v instanceof Date) return cell.v.toLocaleString();
    return String(cell.v);
  }

  function buildSpreadsheetSearchMatches(query) {
    var XLSX = spreadsheetEngine;
    var workbook = current.workbook;
    if (!XLSX || !workbook) return [];
    var matches = [];
    for (var sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex++) {
      var worksheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];
      if (!worksheet) continue;
      var addresses = Object.keys(worksheet).filter(function (address) {
        return /^[A-Z]{1,3}[1-9]\d*$/i.test(address);
      });
      addresses.sort(function (a, b) {
        var aa = XLSX.utils.decode_cell(a);
        var bb = XLSX.utils.decode_cell(b);
        return aa.r - bb.r || aa.c - bb.c;
      });
      for (var a = 0; a < addresses.length; a++) {
        var address = addresses[a];
        findOccurrences(getSpreadsheetCellText(worksheet[address]), query).forEach(function (_, cellMatchIndex) {
          if (matches.length < SEARCH_MAX_MATCHES) matches.push({
            kind: "spreadsheet", sheetIndex: sheetIndex, address: address, cellMatchIndex: cellMatchIndex
          });
        });
        if (matches.length >= SEARCH_MAX_MATCHES) break;
      }
      if (matches.length >= SEARCH_MAX_MATCHES) break;
    }
    return matches;
  }

  function resolveZipPath(target) {
    try {
      var path = new URL(String(target || ""), "https://zip.invalid/ppt/presentation.xml").pathname;
      return path.charAt(0) === "/" ? path.slice(1) : path;
    } catch (error) { return ""; }
  }

  async function buildPptxSlideTexts(id) {
    if (current.pptxSlideTexts) return current.pptxSlideTexts;
    await loadScript(JSZIP_URL, "docx-jszip", "JSZip");
    ensureCurrent(id);
    var zip = await window.JSZip.loadAsync(current.blob);
    var presentationFile = zip.file("ppt/presentation.xml");
    var relsFile = zip.file("ppt/_rels/presentation.xml.rels");
    if (!presentationFile || !relsFile) throw new Error("The PowerPoint slide list could not be read.");
    var parser = new DOMParser();
    var presentation = parser.parseFromString(await presentationFile.async("string"), "application/xml");
    var rels = parser.parseFromString(await relsFile.async("string"), "application/xml");
    if (presentation.querySelector("parsererror") || rels.querySelector("parsererror")) {
      throw new Error("PowerPoint slide metadata is invalid.");
    }
    var relationshipMap = Object.create(null);
    Array.from(rels.getElementsByTagNameNS("http://schemas.openxmlformats.org/package/2006/relationships", "Relationship"))
      .forEach(function (item) { relationshipMap[item.getAttribute("Id")] = item.getAttribute("Target"); });
    var slideIds = Array.from(presentation.getElementsByTagNameNS("http://schemas.openxmlformats.org/presentationml/2006/main", "sldId"));
    var texts = [];
    for (var i = 0; i < slideIds.length; i++) {
      ensureCurrent(id);
      var relId = slideIds[i].getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      var target = relationshipMap[relId];
      if (!target) { texts.push(""); continue; }
      var slide = zip.file(resolveZipPath(target));
      if (!slide) { texts.push(""); continue; }
      var xml = parser.parseFromString(await slide.async("string"), "application/xml");
      texts.push(Array.from(xml.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/main", "t"))
        .map(function (item) { return item.textContent || ""; }).join(" "));
    }
    current.pptxSlideTexts = texts;
    return texts;
  }

  async function buildPptxSearchMatches(id, query) {
    var texts = await buildPptxSlideTexts(id);
    var matches = [];
    texts.forEach(function (text, slideIndex) {
      findOccurrences(text, query).forEach(function (_, localIndex) {
        if (matches.length < SEARCH_MAX_MATCHES) matches.push({ kind: "pptx", slideIndex: slideIndex, localIndex: localIndex });
      });
    });
    return matches;
  }

  async function buildSearchMatches(id, query) {
    if (current.type === "pdf" || (current.type === "docx" && isPdfView())) return buildPdfSearchMatches(id, query);
    if (current.type === "docx" || current.type === "text") return buildDomSearchMatches(query);
    if (current.type === "spreadsheet") return buildSpreadsheetSearchMatches(query);
    if (current.type === "pptx") return buildPptxSearchMatches(id, query);
    return [];
  }

  async function runPreviewSearch(query) {
    if (!current || !current.search || !current.search.ready) return;
    var id = current.id;
    var state = current.search;
    state.token++;
    var token = state.token;
    state.query = String(query || "").trim();
    state.matches = [];
    state.index = -1;
    state.building = false;
    clearSearchHighlights();
    if (!state.query) { updateSearchToolbar(); return; }
    state.building = true;
    updateSearchToolbar();
    try {
      var matches = await buildSearchMatches(id, state.query);
      ensureCurrent(id);
      if (current.search.token !== token) return;
      state.matches = matches;
      state.building = false;
      updateSearchToolbar();
      if (matches.length) await navigatePreviewSearch(0);
    } catch (error) {
      if (!current || current.id !== id || (error && error.name === "AbortError")) return;
      state.building = false;
      state.matches = [];
      state.index = -1;
      updateSearchToolbar();
      console.warn("Jupiter Library: in-document search failed.", error);
    }
  }

  function handlePreviewSearchInput(event) {
    if (!event.target.matches("[data-preview-search-input]") || !current || !current.search) return;
    if (current.search.timer) window.clearTimeout(current.search.timer);
    var id = current.id;
    var query = event.target.value;
    current.search.timer = window.setTimeout(function () {
      if (!current || current.id !== id) return;
      current.search.timer = null;
      runPreviewSearch(query);
    }, 140);
  }

  function handlePreviewSearchKeydown(event) {
    if (!event.target.matches("[data-preview-search-input]")) return;
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (current && current.search && event.target.value.trim() !== current.search.query) {
        if (current.search.timer) window.clearTimeout(current.search.timer);
        current.search.timer = null;
        runPreviewSearch(event.target.value);
        return;
      }
      navigatePreviewSearch(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape" && event.target.value) {
      event.preventDefault();
      event.stopPropagation();
      event.target.value = "";
      runPreviewSearch("");
    }
  }

  async function navigatePreviewSearch(direction) {
    if (!current || !current.search || !current.search.matches.length) return;
    var search = current.search;
    var index = search.index + direction;
    if (direction !== 1 && direction !== -1) index = Math.max(0, Number(direction) || 0);
    if (index < 0) index = search.matches.length - 1;
    if (index >= search.matches.length) index = 0;
    search.index = index;
    updateSearchToolbar();
    var id = current.id;
    var entry = search.matches[index];
    var stage = panel.querySelector(".ja-lib-preview-stage");

    if (entry.kind === "dom") {
      var ranges = getTextRanges(getDomSearchRoot(), search.query);
      applySearchHighlights(ranges, ranges[entry.rangeIndex] || null);
      scrollSearchRange(ranges[entry.rangeIndex]);
    } else if (entry.kind === "pdf") {
      var state = current.pdfPageStates[entry.pageNumber - 1];
      if (!state) return;
      state.frame.scrollIntoView({ block: "start", inline: "nearest", behavior: "smooth" });
      await renderPdfPageFrame(id, state, current.pdfGeneration);
      ensureCurrent(id);
      var pdfRanges = getTextRanges(state.textContainer || state.frame.querySelector(".textLayer"), search.query);
      var activePdf = pdfRanges[entry.localIndex] || pdfRanges[0] || null;
      applySearchHighlights(pdfRanges, activePdf);
      scrollSearchRange(activePdf);
    } else if (entry.kind === "spreadsheet") {
      var XLSX = spreadsheetEngine;
      var decoded = XLSX.utils.decode_cell(entry.address);
      var info = current.renderedSheetWindow;
      var needsRender = current.sheetIndex !== entry.sheetIndex || !info ||
        decoded.r < info.startRow || decoded.r > info.endRow ||
        decoded.c < info.startCol || decoded.c > info.endCol;
      current.searchTargetCell = { sheetIndex: entry.sheetIndex, row: decoded.r, col: decoded.c, address: entry.address };
      if (needsRender) {
        current.sheetIndex = entry.sheetIndex;
        renderSheet(id);
      }
      ensureCurrent(id);
      var wrap = stage.querySelector(".ja-lib-sheet-wrap");
      var cell = wrap && wrap.querySelector('[data-cell-address="' + entry.address + '"]');
      if (!cell) return;
      var cellRanges = getTextRanges(cell, search.query);
      var activeCell = cellRanges[entry.cellMatchIndex] || cellRanges[0] || null;
      applySearchHighlights(getTextRanges(wrap, search.query), activeCell);
      cell.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      scrollSearchRange(activeCell);
    } else if (entry.kind === "pptx") {
      if (current.slideIndex !== entry.slideIndex) {
        current.slideIndex = entry.slideIndex;
        await renderSlide(id);
        ensureCurrent(id);
      }
      var slideRoot = stage.querySelector(".ja-lib-slide-frame");
      var slideRanges = getTextRanges(slideRoot, search.query);
      var activeSlide = slideRanges[entry.localIndex] || slideRanges[0] || null;
      applySearchHighlights(slideRanges, activeSlide);
      scrollSearchRange(activeSlide);
    }
  }

  function refreshVisibleSearchHighlights() {
    if (!current || !current.search || !current.search.query) return;
    var state = current.search;
    if ((current.type === "docx" && !isPdfView()) || current.type === "text") {
      var domRanges = getTextRanges(getDomSearchRoot(), state.query);
      var domEntry = state.matches[state.index];
      applySearchHighlights(domRanges, domEntry && domRanges[domEntry.rangeIndex] || null);
    } else if (current.type === "spreadsheet") {
      var wrap = panel.querySelector(".ja-lib-sheet-wrap");
      var allRanges = getTextRanges(wrap, state.query);
      var entry = state.matches[state.index];
      var active = null;
      if (entry && entry.sheetIndex === current.sheetIndex) {
        var cell = wrap && wrap.querySelector('[data-cell-address="' + entry.address + '"]');
        var cellRanges = getTextRanges(cell, state.query);
        active = cellRanges[entry.cellMatchIndex] || cellRanges[0] || null;
      }
      applySearchHighlights(allRanges, active);
    } else if (current.type === "pptx") {
      var slide = panel.querySelector(".ja-lib-slide-frame");
      var pptRanges = getTextRanges(slide, state.query);
      var pptEntry = state.matches[state.index];
      var pptActive = pptEntry && pptEntry.slideIndex === current.slideIndex
        ? pptRanges[pptEntry.localIndex] || pptRanges[0] || null : null;
      applySearchHighlights(pptRanges, pptActive);
    } else if (isPdfView()) {
      var pageState = current.pdfPageStates[current.page - 1];
      if (pageState && pageState.textContainer) {
        var pageRanges = getTextRanges(pageState.textContainer, state.query);
        var pdfEntry = state.matches[state.index];
        var pdfActive = pdfEntry && pdfEntry.pageNumber === current.page
          ? pageRanges[pdfEntry.localIndex] || pageRanges[0] || null : null;
        applySearchHighlights(pageRanges, pdfActive);
      }
    }
  }

  function ensurePanel() {
    if (panel && panel.isConnected) return panel;
    var main = document.querySelector("#ja-reference-library-window .ja-lib-main");
    if (!main && window.JupiterReferenceLibrary) {
      window.JupiterReferenceLibrary.open();
      main = document.querySelector("#ja-reference-library-window .ja-lib-main");
    }
    if (!main) throw new Error("Open the Library window before previewing a file.");

    panel = document.createElement("section");
    panel.className = "ja-lib-preview";
    panel.setAttribute("aria-label", "Document preview");
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML =
      '<header class="ja-lib-preview-toolbar">' +
        '<button class="ja-lib-preview-back" type="button" data-preview-action="back" aria-label="Back to Library" title="Back to Library"><span aria-hidden="true">‹</span><span>Library</span></button>' +
        '<div class="ja-lib-preview-file"><span class="ja-lib-preview-file-icon" aria-hidden="true">▤</span>' +
          '<div class="ja-lib-preview-file-meta"><strong class="ja-lib-preview-name"></strong><span class="ja-lib-preview-subtitle"></span></div></div>' +
        '<div class="ja-lib-preview-search" data-preview-search-wrap hidden>' +
          '<span class="ja-lib-preview-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.7"></circle><path d="m16 16 5 5"></path></svg></span>' +
          '<input class="ja-lib-preview-search-input" data-preview-search-input type="search" placeholder="Search in file" aria-label="Search in opened file" autocomplete="off" disabled>' +
          '<span class="ja-lib-preview-search-count" data-preview-search-count aria-live="polite">0/0</span>' +
          '<button class="ja-lib-preview-search-nav" type="button" data-preview-action="search-prev" title="Previous match (Shift+Enter)" aria-label="Previous match" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"></path></svg></button>' +
          '<button class="ja-lib-preview-search-nav" type="button" data-preview-action="search-next" title="Next match (Enter)" aria-label="Next match" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6 6 6-6"></path></svg></button>' +
        '</div>' +
        '<div class="ja-lib-preview-tools" aria-label="Preview controls"></div>' +
      '</header>' +
      '<div class="ja-lib-preview-stage" tabindex="0"><div class="ja-lib-preview-loading"><span class="ja-lib-preview-spinner"></span><span>Preparing preview…</span></div></div>';
    main.appendChild(panel);
    panel.addEventListener("click", handlePanelClick);
    panel.addEventListener("wheel", handlePreviewWheel, { passive: false });
    panel.addEventListener("input", handlePreviewSearchInput);
    panel.addEventListener("keydown", handlePreviewSearchKeydown);
    panel.querySelector('[data-preview-action="back"]').addEventListener("click", close);
    return panel;
  }

  function setLoading(message) {
    panel.querySelector(".ja-lib-preview-stage").innerHTML =
      '<div class="ja-lib-preview-loading"><span class="ja-lib-preview-spinner"></span><span>' +
      escapeHtml(message || "Preparing preview…") + "</span></div>";
  }

  function setTools(html) {
    panel.querySelector(".ja-lib-preview-tools").innerHTML = html || "";
  }

  function toolButton(action, label, symbol) {
    return '<button type="button" class="ja-lib-preview-tool" data-preview-action="' + action +
      '" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '">' + symbol + "</button>";
  }

  function showError(message, detail) {
    var stage = panel.querySelector(".ja-lib-preview-stage");
    stage.innerHTML =
      '<div class="ja-lib-preview-message-card"><div class="ja-lib-preview-message-icon" aria-hidden="true">!</div>' +
      "<h3>Preview unavailable</h3><p>" + escapeHtml(message) + "</p>" +
      (detail ? "<small>" + escapeHtml(detail) + "</small>" : "") + "</div>";
    var linkUrl = current && current.file ? current.file.webViewLink : "";
    if (linkUrl) {
      try {
        var safeUrl = new URL(linkUrl);
        if (safeUrl.protocol === "https:" && ["drive.google.com", "docs.google.com"].includes(safeUrl.hostname)) {
          var link = document.createElement("a");
          link.className = "ja-lib-preview-open-drive";
          link.href = safeUrl.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Open in Google Drive";
          stage.querySelector(".ja-lib-preview-message-card").appendChild(link);
        }
      } catch (error) {}
    }
    setTools("");
    setSearchReady(false);
  }

  function setMetadata(file, type) {
    var labels = {
      pdf: "PDF", image: "Image", docx: "Word", spreadsheet: "Excel",
      pptx: "PowerPoint", text: "Text", audio: "Audio", video: "Video",
      remote: "Google Drive", unsupported: "File"
    };
    var icons = { pdf:"PDF", image:"▧", docx:"W", spreadsheet:"▦", pptx:"▤", text:"≡", audio:"♫", video:"▶", remote:"G", unsupported:"?" };
    panel.querySelector(".ja-lib-preview-name").textContent = file.name || "Untitled file";
    panel.querySelector(".ja-lib-preview-file-icon").textContent = icons[type] || "▤";
    setPreviewStatus("Preview", file.size);
  }

  function setPreviewStatus(status, size) {
    if (!panel || !current) return;
    var labels = {
      pdf:"PDF", image:"Image", docx:"Word", spreadsheet:"Excel",
      pptx:"PowerPoint", text:"Text", audio:"Audio", video:"Video",
      remote:"Google Drive", unsupported:"File"
    };
    var parts = [
      labels[current.type] || "File",
      String(current.file.provider || "Cloud file"),
      status || "Preview",
      formatBytes(size || current.blob && current.blob.size || current.file.size)
    ].filter(Boolean);
    var subtitle = panel.querySelector(".ja-lib-preview-subtitle");
    if (subtitle) subtitle.textContent = parts.join(" · ");
  }

  function cleanupCurrent() {
    if (!current) return;
    restoreDocxFallbackFont();
    restoreWindowsFontAliases();
    cancelPdfPageStates();
    if (current.search && current.search.timer) window.clearTimeout(current.search.timer);
    clearSearchHighlights();
    if (current.controller) current.controller.abort();
    if (current.objectUrl) URL.revokeObjectURL(current.objectUrl);
    if (current.pdfDocument && typeof current.pdfDocument.destroy === "function") {
      try { current.pdfDocument.destroy(); } catch (error) {}
    }
    current = null;
  }

  async function getBlob(file, signal) {
    var value = null;
    if (typeof file.getBlob === "function") value = await file.getBlob({ signal: signal });
    else if (typeof file.fetchContent === "function") value = await file.fetchContent({ signal: signal });
    else if (file.blob instanceof Blob) value = file.blob;
    else if (file.contentBlob instanceof Blob) value = file.contentBlob;
    else if (file.file instanceof Blob) value = file.file;
    else if (file instanceof Blob) value = file;
    else if (file.arrayBuffer instanceof ArrayBuffer) value = file.arrayBuffer;
    else if (file.data instanceof ArrayBuffer || ArrayBuffer.isView(file.data)) value = file.data;
    else if (typeof file.content === "string") value = file.content;

    if (value == null && file.url) {
      var url = String(file.url);
      if (!/^https?:\/\//i.test(url) && !/^blob:/i.test(url)) {
        throw new Error("The preview source URL must be HTTPS or a temporary Blob URL.");
      }
      var response = await fetch(url, { signal: signal, credentials: "omit" });
      if (!response.ok) throw new Error("The temporary file URL returned HTTP " + response.status + ".");
      value = await response.blob();
    }
    if (typeof Response !== "undefined" && value instanceof Response) value = await value.blob();
    if (value instanceof Blob) return value;
    if (value instanceof ArrayBuffer) return new Blob([value], { type: file.mimeType || file.mime_type || "" });
    if (ArrayBuffer.isView(value)) return new Blob([value], { type: file.mimeType || file.mime_type || "" });
    if (typeof value === "string") return new Blob([value], { type: file.mimeType || file.mime_type || "text/plain" });
    throw new Error("No content supplied. Pass a Blob, ArrayBuffer, getBlob() or fetchContent() callback.");
  }

  function ensureCurrent(id) {
    if (!current || current.id !== id || current.controller.signal.aborted) {
      var error = new Error("Preview cancelled.");
      error.name = "AbortError";
      throw error;
    }
  }

  function open(file) {
    if (!file || typeof file !== "object") return Promise.reject(new TypeError("Preview expects a file metadata object."));
    var alreadyOpen = !!panel && panel.classList.contains("is-open");
    var returnFocus = alreadyOpen ? previousFocus : document.activeElement;
    if (window.JupiterReferenceLibrary && typeof window.JupiterReferenceLibrary.open === "function") {
      window.JupiterReferenceLibrary.open({ focusSearch: false });
    }
    try { ensurePanel(); } catch (error) { return Promise.reject(error); }

    cleanupCurrent();
    var id = ++requestId;
    var controller = new AbortController();
    current = {
      id: id, controller: controller, file: file, type: detectType(file),
      blob: null, objectUrl: null, pdfDocument: null, page: 1, zoom: 1,
      docxRenderer: "html", docxPdfBlob: null,
      windowsFontsEnabled: false, windowsLocalFonts: null,
      windowsFontOverrides: [], windowsFontStyle: null, windowsFontObjectUrls: [],
      windowsFontAliasMap: Object.create(null), windowsFontMatchCount: 0,
      windowsFontDiagnostics: null,
      docxFallbackOverrides: [], docxFallbackAppliedCount: 0,
      search: { query: "", matches: [], index: -1, ready: false, token: 0, timer: null, pptxSlideTexts: null },
      renderedSheetWindow: null, searchTargetCell: null
    };

    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    previousFocus = returnFocus;
    panel.querySelector(".ja-lib-preview-stage").scrollTop = 0;
    var backButton = panel.querySelector('[data-preview-action="back"]');
    if (backButton) backButton.focus({ preventScroll: true });
    setMetadata(file, current.type);
    setSearchToolbarVisibility();
    setSearchReady(false);
    setTools("");
    setLoading("Retrieving " + (file.name || "file") + "…");

    return (async function () {
      ensureCurrent(id);
      if (current.type === "remote") {
        await renderCurrent(id);
      } else {
        var blob = await getBlob(file, controller.signal);
        ensureCurrent(id);
        current.blob = blob;
        if (blob.size > MAX_PREVIEW_BYTES) {
          throw new Error("This file is " + formatBytes(blob.size) + ". The in-browser preview limit is " + formatBytes(MAX_PREVIEW_BYTES) + ".");
        }
        setPreviewStatus("Preview", blob.size);
        await renderCurrent(id);
      }
      ensureCurrent(id);
      setPreviewStatus("Preview", current.blob && current.blob.size || file.size);
    })().catch(function (error) {
      if (error && error.name === "AbortError") return;
      if (!current || current.id !== id) return;
      showError(error && error.message ? error.message : "The file could not be previewed.");
      if (current.type === "docx") setTools(docxRendererTools());
    });
  }

  async function renderCurrent(id) {
    ensureCurrent(id);
    var previewStage = panel.querySelector(".ja-lib-preview-stage");
    previewStage.classList.remove("is-spreadsheet","is-pdf","is-pdf-vertical","is-pdf-horizontal","is-docx","is-docxjs","is-pptx");
    previewStage.style.zoom = "";
    switch (current.type) {
      case "pdf": return renderPdf(id);
      case "image": return renderImage(id);
      case "docx": return renderDocx(id);
      case "spreadsheet": return renderSpreadsheet(id);
      case "pptx": return renderPptx(id);
      case "text": return renderText(id);
      case "audio": return renderMedia(id, "audio");
      case "video": return renderMedia(id, "video");
      case "remote": return renderRemote(id);
      default:
        return showError("This file format is not supported by the current preview engine.",
          "Supported: PDF, common images, DOCX, XLSX, XLS, XLSM, CSV, PPTX, TXT, Markdown, JSON, XML, audio and video. Legacy .PPT files are not supported.");
    }
  }

  async function renderPdf(id) {
    return renderPdfBlob(id, current.blob, false);
  }

  async function renderPdfBlob(id, blob, keepZoom) {
    setLoading("Loading PDF viewer…");
    var pdfjs = await loadModule("pdfjs", PDFJS_URL);
    ensureCurrent(id);
    if (!pdfjs.TextLayer) {
      throw new Error("The loaded PDF.js build does not expose its selectable text layer.");
    }
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    var pdf = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
    ensureCurrent(id);

    current.pdfDocument = pdf;
    current.pdfjs = pdfjs;
    current.pdfPageObjects = [];
    current.pageCount = pdf.numPages;
    current.page = 1;
    if (!keepZoom) current.zoom = 1;
    current.pdfScrollMode = "vertical";
    current.pdfPageObjects = await Promise.all(
      Array.from({ length: pdf.numPages }, function (_, index) {
        return pdf.getPage(index + 1);
      })
    );
    ensureCurrent(id);
    await rebuildPdfPageLayout(id, 1);
    setSearchReady(true);
  }

  function cancelPdfPageStates() {
    if (!current) return;
    if (current.pdfRenderObserver) {
      current.pdfRenderObserver.disconnect();
      current.pdfRenderObserver = null;
    }
    (current.pdfPageStates || []).forEach(function (state) {
      if (state.renderTask && typeof state.renderTask.cancel === "function") {
        try { state.renderTask.cancel(); } catch (error) {}
      }
      if (state.textLayer && typeof state.textLayer.cancel === "function") {
        try { state.textLayer.cancel(); } catch (error) {}
      }
    });
    current.pdfPageStates = [];
  }

  function updatePdfTools() {
    if (!isPdfView()) return;
    var mode = current.pdfScrollMode || "vertical";
    var docxToggle = current.type === "docx" ? docxRendererTools() : "";
    setTools(
      docxToggle +
      toolButton("zoom-out", "Zoom out", "−") +
      toolButton("zoom-reset", "Reset zoom", "100%") +
      toolButton("zoom-in", "Zoom in", "+") +
      '<span class="ja-lib-preview-counter" data-preview-counter>' +
        "Page " + (current.page || 1) + " of " + current.pageCount +
      "</span>" +
      toolButton(
        "scroll-mode",
        mode === "vertical" ? "Switch to horizontal scrolling" : "Switch to vertical scrolling",
        mode === "vertical" ? "↔" : "↕"
      )
    );
  }

  async function rebuildPdfPageLayout(id, keepPage) {
    ensureCurrent(id);
    cancelPdfPageStates();
    current.pdfGeneration = (current.pdfGeneration || 0) + 1;
    var generation = current.pdfGeneration;
    var stage = panel.querySelector(".ja-lib-preview-stage");
    stage.classList.remove("is-docxjs","is-docx");
    var mode = current.pdfScrollMode || "vertical";
    var hadLayout = !!current.pdfHasLayout;
    var previousMode = current.previousPdfScrollMode || mode;
    var previousScrollTop = stage.scrollTop;
    var previousScrollLeft = stage.scrollLeft;
    var previousScrollHeight = stage.scrollHeight;
    var previousScrollWidth = stage.scrollWidth;
    stage.classList.remove("is-spreadsheet","is-pdf","is-pdf-vertical","is-pdf-horizontal","is-docx","is-docxjs","is-pptx");
    stage.classList.add("is-pdf", "is-pdf-" + mode);
    stage.innerHTML = "";

    var documentView = document.createElement("div");
    documentView.className = "ja-lib-pdf-document " + (mode === "horizontal" ? "is-horizontal" : "is-vertical");
    stage.appendChild(documentView);

    var states = [];
    current.pdfPageObjects.forEach(function (page, index) {
      var viewport = page.getViewport({ scale: current.zoom });
      var frame = document.createElement("div");
      frame.className = "ja-lib-pdf-page-frame";
      frame.dataset.pageNumber = String(index + 1);
      frame.style.width = Math.ceil(viewport.width) + "px";
      frame.style.height = Math.ceil(viewport.height) + "px";
      frame.style.setProperty("--total-scale-factor", String(current.zoom));

      var canvas = document.createElement("canvas");
      canvas.className = "ja-lib-pdf-page-canvas";
      canvas.setAttribute("aria-hidden", "true");
      frame.appendChild(canvas);
      documentView.appendChild(frame);

      states.push({
        pageNumber: index + 1,
        page: page,
        viewport: viewport,
        frame: frame,
        canvas: canvas,
        rendered: false,
        rendering: false,
        renderTask: null,
        textLayer: null,
        ratio: 0,
        generation: generation
      });
    });
    current.pdfPageStates = states;

    var counter = panel.querySelector("[data-preview-counter]");
    if (counter) counter.textContent = "Page " + (keepPage || 1) + " of " + current.pageCount;

    if ("IntersectionObserver" in window) {
      current.pdfRenderObserver = new IntersectionObserver(function (entries) {
        if (!current || current.id !== id || current.pdfGeneration !== generation) return;
        entries.forEach(function (entry) {
          var pageNumber = Number(entry.target.dataset.pageNumber);
          var state = current.pdfPageStates[pageNumber - 1];
          if (!state) return;
          state.ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
          if (entry.isIntersecting && !state.rendered && !state.rendering) {
            renderPdfPageFrame(id, state, generation).catch(handleRenderError);
          }
        });
        var visibleStates = current.pdfPageStates
          .filter(function (state) { return state.ratio > 0; })
          .sort(function (a, b) { return b.ratio - a.ratio; });
        if (visibleStates.length) {
          current.page = visibleStates[0].pageNumber;
          updatePdfCounter();
        }
      }, {
        root: stage,
        rootMargin: mode === "vertical" ? "1000px 0px" : "0px 1100px",
        threshold: [0, 0.15, 0.35, 0.6, 0.85, 1]
      });
      states.forEach(function (state) {
        current.pdfRenderObserver.observe(state.frame);
      });
    }

    updatePdfTools();

    var targetPage = Math.min(Math.max(1, Number(keepPage) || 1), current.pageCount);
    var targetState = states[targetPage - 1];
    if (targetState) {
      if (mode === "vertical") {
        if (hadLayout && previousMode === "vertical" && previousScrollHeight > stage.clientHeight) {
          var verticalProgress = previousScrollTop / Math.max(1, previousScrollHeight - stage.clientHeight);
          stage.scrollTop = verticalProgress * Math.max(0, stage.scrollHeight - stage.clientHeight);
        } else if (hadLayout && previousMode === "horizontal") {
          var verticalRect = targetState.frame.getBoundingClientRect();
          var verticalStageRect = stage.getBoundingClientRect();
          stage.scrollTop = Math.max(0, stage.scrollTop + verticalRect.top - verticalStageRect.top - 12);
        } else {
          stage.scrollTop = 0;
        }
        stage.scrollLeft = 0;
      } else {
        stage.scrollTop = 0;
        if (hadLayout && current.previousPdfScrollMode === "horizontal" && previousScrollWidth > stage.clientWidth) {
          var horizontalProgress = previousScrollLeft / Math.max(1, previousScrollWidth - stage.clientWidth);
          stage.scrollLeft = horizontalProgress * Math.max(0, stage.scrollWidth - stage.clientWidth);
        } else {
          var frameRect = targetState.frame.getBoundingClientRect();
          var stageRect = stage.getBoundingClientRect();
          stage.scrollLeft = Math.max(0, stage.scrollLeft + frameRect.left - stageRect.left - stage.clientWidth * 0.12);
        }
      }
      current.pdfHasLayout = true;
      current.previousPdfScrollMode = mode;
      await renderPdfPageFrame(id, targetState, generation);
    }

    // Also prime the adjacent page so a quick scroll feels immediate.
    var adjacent = states[targetPage];
    if (adjacent) renderPdfPageFrame(id, adjacent, generation).catch(handleRenderError);
  }

  function updatePdfCounter() {
    if (!current || current.type !== "pdf") return;
    var counter = panel.querySelector("[data-preview-counter]");
    if (counter) counter.textContent = "Page " + current.page + " of " + current.pageCount;
  }

  async function renderPdfPageFrame(id, state, generation) {
    ensureCurrent(id);
    if (state.rendered || state.rendering) return;
    state.rendering = true;

    try {
      var page = state.page;
      var viewport = page.getViewport({ scale: current.zoom });
      state.viewport = viewport;
      state.frame.style.width = Math.ceil(viewport.width) + "px";
      state.frame.style.height = Math.ceil(viewport.height) + "px";
      state.frame.style.setProperty("--total-scale-factor", String(current.zoom));

      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      var canvas = state.canvas;
      var context = canvas.getContext("2d", { alpha: false });
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = Math.ceil(viewport.width) + "px";
      canvas.style.height = Math.ceil(viewport.height) + "px";
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      var task = page.render({ canvasContext: context, viewport: viewport });
      state.renderTask = task;
      await task.promise;
      ensureCurrent(id);
      if (current.pdfGeneration !== generation) return;

      var textContent = await page.getTextContent();
      ensureCurrent(id);
      if (current.pdfGeneration !== generation) return;

      var textContainer = document.createElement("div");
      textContainer.className = "textLayer";
      textContainer.setAttribute("aria-label", "Selectable PDF text, page " + state.pageNumber);
      state.textContainer = textContainer;
      textContainer.style.width = Math.ceil(viewport.width) + "px";
      textContainer.style.height = Math.ceil(viewport.height) + "px";
      textContainer.style.setProperty("--total-scale-factor", String(current.zoom));
      state.frame.appendChild(textContainer);

      var textLayer = new current.pdfjs.TextLayer({
        textContentSource: textContent,
        container: textContainer,
        viewport: viewport
      });
      state.textLayer = textLayer;
      await textLayer.render();
      ensureCurrent(id);
      if (current.pdfGeneration !== generation) return;
      state.rendered = true;
      if (current.search && current.search.query) refreshVisibleSearchHighlights();
    } catch (error) {
      if (error && (error.name === "RenderingCancelledException" || error.name === "AbortException")) return;
      throw error;
    } finally {
      state.rendering = false;
      state.renderTask = null;
    }
  }

  function setPdfScrollMode(mode) {
    if (!isPdfView() || current.pdfScrollMode === mode) return;
    var page = current.page || 1;
    current.pdfScrollMode = mode;
    rebuildPdfPageLayout(current.id, page).catch(handleRenderError);
  }

  function renderRemote(id) {
    ensureCurrent(id);
    var rawUrl = current.file.embedUrl;
    var embed;
    try {
      embed = new URL(rawUrl);
    } catch (error) {
      throw new Error("Google Drive did not supply a valid preview link.");
    }
    if (embed.protocol !== "https:" ||
        !["drive.google.com", "docs.google.com"].includes(embed.hostname)) {
      throw new Error("The preview link is not an approved Google Drive viewer URL.");
    }

    var stage = panel.querySelector(".ja-lib-preview-stage");
    stage.innerHTML = "";
    var frame = document.createElement("div");
    frame.className = "ja-lib-drive-frame";
    var iframe = document.createElement("iframe");
    iframe.title = "Read-only Google Drive preview: " + (current.file.name || "file");
    iframe.src = embed.href;
    iframe.loading = "eager";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox");
    frame.appendChild(iframe);
    stage.appendChild(frame);
    setTools('<span class="ja-lib-preview-note">Google Drive viewer · Read-only</span>');
  }

  function renderImage(id) {
    ensureCurrent(id);
    current.objectUrl = URL.createObjectURL(current.blob);
    current.zoom = 1;
    setTools(toolButton("zoom-out", "Zoom out", "−") +
      toolButton("zoom-reset", "Reset zoom", "100%") +
      toolButton("zoom-in", "Zoom in", "+"));
    var stage = panel.querySelector(".ja-lib-preview-stage");
    stage.innerHTML = '<div class="ja-lib-preview-image-wrap"><img class="ja-lib-preview-image" alt="' +
      escapeHtml(current.file.name || "Image preview") + '"></div>';
    var image = stage.querySelector("img");
    image.src = current.objectUrl;
    image.addEventListener("error", function () {
      if (current && current.id === id) showError("This image could not be decoded by the browser.");
    });
  }

  var DOCX_WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  var DOCX_DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";

  function normalizeFontName(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/^[\"']|[\"']$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase();
  }

  function firstFontFamily(value) {
    var first = String(value || "").split(",")[0] || "";
    return first.replace(/^[\"']|[\"']$/g, "").trim();
  }

  function cssQuotedString(value) {
    return "\"" + String(value == null ? "" : value)
      .replace(/\\/g, "\\\\")
      .replace(/\"/g, "\\\"")
      .replace(/[\r\n\f]/g, " ") + "\"";
  }

  function localFontWeight(styleName) {
    var style = String(styleName || "").toLowerCase().replace(/[-_]/g, " ");
    if (/hairline|ultra\s*thin/.test(style)) return 100;
    if (/\bthin\b/.test(style)) return 200;
    if (/extra\s*light|ultra\s*light/.test(style)) return 200;
    if (/\blight\b/.test(style)) return 300;
    if (/\bmedium\b/.test(style)) return 500;
    if (/semi\s*bold|demi/.test(style)) return 600;
    if (/extra\s*bold|ultra\s*bold/.test(style)) return 800;
    if (/\bblack\b|\bheavy\b/.test(style)) return 900;
    if (/\bbold\b/.test(style)) return 700;
    return 400;
  }

  function localFontStyle(styleName) {
    return /italic|oblique/i.test(String(styleName || "")) ? "italic" : "normal";
  }

  function addDocxFontName(target, value) {
    var name = String(value || "").replace(/^[\"']|[\"']$/g, "").trim();
    if (!name || name.charAt(0) === "+" ||
        /^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(name)) return;
    var key = normalizeFontName(name);
    if (key && !target.has(key)) target.set(key, name);
  }

  function xmlElementsByNs(xmlDocument, namespace, localName) {
    return Array.from(xmlDocument.getElementsByTagNameNS(namespace, localName));
  }

  function readThemeFontNames(themeXml, target, themeMap) {
    if (!themeXml) return;
    var parser = new DOMParser();
    var xml = parser.parseFromString(themeXml, "application/xml");
    if (xml.querySelector("parsererror")) return;

    var schemes = xmlElementsByNs(xml, DOCX_DRAWING_NS, "fontScheme");
    if (!schemes.length) return;
    var scheme = schemes[0];

    function findFontGroup(groupName, prefix) {
      var group = xmlElementsByNs(scheme, DOCX_DRAWING_NS, groupName)[0];
      if (!group) return;

      var latin = xmlElementsByNs(group, DOCX_DRAWING_NS, "latin")[0];
      var eastAsia = xmlElementsByNs(group, DOCX_DRAWING_NS, "ea")[0];
      var complexScript = xmlElementsByNs(group, DOCX_DRAWING_NS, "cs")[0];
      var latinName = latin && latin.getAttribute("typeface");
      var eastAsiaName = eastAsia && eastAsia.getAttribute("typeface");
      var complexName = complexScript && complexScript.getAttribute("typeface");

      addDocxFontName(target, latinName);
      addDocxFontName(target, eastAsiaName);
      addDocxFontName(target, complexName);

      themeMap[prefix + "ascii"] = latinName || "";
      themeMap[prefix + "hansi"] = latinName || "";
      themeMap[prefix + "eastasia"] = eastAsiaName || latinName || "";
      themeMap[prefix + "bidi"] = complexName || latinName || "";

      xmlElementsByNs(group, DOCX_DRAWING_NS, "font").forEach(function (font) {
        addDocxFontName(target, font.getAttribute("typeface"));
      });
    }

    findFontGroup("majorFont", "major");
    findFontGroup("minorFont", "minor");
  }

  async function extractDocxFontFamilies(blob) {
    var result = { families: [], warning: "" };
    if (!window.JSZip || typeof window.JSZip.loadAsync !== "function") {
      result.warning = "DOCX font metadata could not be inspected because JSZip is unavailable.";
      return result;
    }

    try {
      var zip = await window.JSZip.loadAsync(blob);
      var fonts = new Map();
      var themeMap = Object.create(null);
      var themeFile = zip.file("word/theme/theme1.xml");
      if (themeFile) {
        readThemeFontNames(await themeFile.async("string"), fonts, themeMap);
      }

      var xmlPaths = Object.keys(zip.files).filter(function (path) {
        return /^word\/.*\.xml$/i.test(path) && !zip.files[path].dir;
      });

      for (var i = 0; i < xmlPaths.length; i++) {
        var path = xmlPaths[i];
        var xmlText = await zip.files[path].async("string");
        var xml = new DOMParser().parseFromString(xmlText, "application/xml");
        if (xml.querySelector("parsererror")) continue;

        xmlElementsByNs(xml, DOCX_WORD_NS, "rFonts").forEach(function (node) {
          Array.from(node.attributes).forEach(function (attribute) {
            var attributeName = String(attribute.localName || attribute.name.split(":").pop()).toLowerCase();
            var value = String(attribute.value || "").trim();
            if (attributeName === "ascii" || attributeName === "hansi" ||
                attributeName === "eastasia" || attributeName === "cs") {
              addDocxFontName(fonts, value);
            } else if (/theme$/.test(attributeName)) {
              var themeName = normalizeFontName(value).replace(/[^a-z]/g, "");
              addDocxFontName(fonts, themeMap[themeName]);
            }
          });
        });

        if (/^word\/fontTable\.xml$/i.test(path)) {
          xmlElementsByNs(xml, DOCX_WORD_NS, "font").forEach(function (node) {
            addDocxFontName(fonts, node.getAttributeNS(DOCX_WORD_NS, "name") || node.getAttribute("w:name") || node.getAttribute("name"));
          });
        }
      }

      result.families = Array.from(fonts.values());
    } catch (error) {
      result.warning = "DOCX font metadata inspection failed: " +
        (error && error.message ? error.message : "Unknown ZIP/XML error.");
    }

    return result;
  }

  function restoreWindowsFontAliases() {
    if (!current) return;
    (current.windowsFontOverrides || []).forEach(function (entry) {
      if (!entry.element || !entry.element.isConnected) return;
      if (entry.value) {
        entry.element.style.setProperty("font-family", entry.value, entry.priority || "");
      } else {
        entry.element.style.removeProperty("font-family");
      }
    });
    current.windowsFontOverrides = [];

    if (current.windowsFontStyle && current.windowsFontStyle.parentNode) {
      current.windowsFontStyle.parentNode.removeChild(current.windowsFontStyle);
    }
    current.windowsFontStyle = null;

    (current.windowsFontObjectUrls || []).forEach(function (url) {
      try { URL.revokeObjectURL(url); } catch (error) {}
    });
    current.windowsFontObjectUrls = [];
    current.windowsFontAliasMap = Object.create(null);
    current.windowsFontMatchCount = 0;
    current.windowsFontDiagnostics = null;
  }

  var DOCX_FALLBACK_FONT_FAMILY = "Bookman Antiqua";

  function splitCssFontFamilyList(value) {
    var parts = [];
    var currentPart = "";
    var quote = "";
    var escaped = false;
    String(value || "").split("").forEach(function (character) {
      if (escaped) {
        currentPart += character;
        escaped = false;
        return;
      }
      if (character === "\\") {
        currentPart += character;
        escaped = true;
        return;
      }
      if (quote) {
        currentPart += character;
        if (character === quote) quote = "";
        return;
      }
      if (character === "\"" || character === "'") {
        quote = character;
        currentPart += character;
        return;
      }
      if (character === ",") {
        if (currentPart.trim()) parts.push(currentPart.trim());
        currentPart = "";
        return;
      }
      currentPart += character;
    });
    if (currentPart.trim()) parts.push(currentPart.trim());
    return parts;
  }

  function unquoteCssFontFamily(value) {
    return String(value || "").trim().replace(/^["']|["']$/g, "");
  }

  function addBookmanFallback(fontFamilyValue) {
    var parts = splitCssFontFamilyList(fontFamilyValue);
    var ordered = [];
    var seen = new Set();

    function addFamily(value) {
      var family = String(value || "").trim();
      var key = normalizeFontName(unquoteCssFontFamily(family));
      if (!key || seen.has(key)) return;
      seen.add(key);
      ordered.push(family);
    }

    // Keep real document font families first. Remove generic/system keywords
    // such as "monospace": retaining one after an unavailable Bookman causes
    // the browser to fall back to the very monospaced face we are replacing.
    parts.forEach(function (part) {
      var name = unquoteCssFontFamily(part);
      if (!isGenericOrSystemFont(name) && !/^(math|fangsong)$/i.test(name)) {
        addFamily(part);
      }
    });

    // This is a last-resort hierarchy, not a replacement for an installed
    // font specified by the DOCX.
    addFamily(cssQuotedString(DOCX_FALLBACK_FONT_FAMILY));
    addFamily("Georgia");
    addFamily(cssQuotedString("Times New Roman"));
    addFamily("serif");

    // Preserve specialist browser fallback keywords only after the requested
    // Bookman/serif chain, never before it.
    parts.forEach(function (part) {
      var name = unquoteCssFontFamily(part);
      if (/^(math|fangsong)$/i.test(name)) addFamily(part);
    });

    return ordered.join(", ");
  }

  function isWindowsLocalFontFamilyAvailable(familyName) {
    if (!current || !Array.isArray(current.windowsLocalFonts)) return null;
    var key = normalizeFontName(familyName);
    return current.windowsLocalFonts.some(function (font) {
      return normalizeFontName(font.family) === key ||
        normalizeFontName(font.fullName) === key ||
        normalizeFontName(font.postscriptName) === key;
    });
  }

  function restoreDocxFallbackFont() {
    if (!current) return;
    (current.docxFallbackOverrides || []).forEach(function (entry) {
      if (!entry.element || !entry.element.isConnected) return;
      if (entry.value) {
        entry.element.style.setProperty("font-family", entry.value, entry.priority || "");
      } else {
        entry.element.style.removeProperty("font-family");
      }
    });
    current.docxFallbackOverrides = [];
    current.docxFallbackAppliedCount = 0;
  }

  function applyDocxFallbackFont(root) {
    if (!current || !root) return 0;
    restoreDocxFallbackFont();

    var nodes = [root].concat(Array.from(root.querySelectorAll("*")));
    var applied = 0;
    nodes.forEach(function (node) {
      var computedFamily = window.getComputedStyle(node).fontFamily || "";
      var fallbackFamily = addBookmanFallback(computedFamily);
      if (!fallbackFamily) fallbackFamily = cssQuotedString(DOCX_FALLBACK_FONT_FAMILY) + ", serif";

      var previous = node.style.getPropertyValue("font-family");
      var previousPriority = node.style.getPropertyPriority("font-family");
      current.docxFallbackOverrides.push({
        element: node,
        value: previous,
        priority: previousPriority
      });
      node.style.setProperty("font-family", fallbackFamily, "important");
      applied++;
    });

    current.docxFallbackAppliedCount = applied;
    return applied;
  }

  function isGenericOrSystemFont(value) {
    return /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont)$/i
      .test(normalizeFontName(value));
  }

  function collectRenderedFontUsage(root) {
    var usage = Object.create(null);
    if (!root) return usage;

    var nodes = [root].concat(Array.from(root.querySelectorAll("*")));
    nodes.forEach(function (node) {
      var computed = window.getComputedStyle(node);
      var family = firstFontFamily(computed.fontFamily);
      var key = normalizeFontName(family);
      if (!key || isGenericOrSystemFont(family)) return;

      if (!usage[key]) usage[key] = { family: family, variants: Object.create(null), elements: [] };
      var weightValue = String(computed.fontWeight || "400").toLowerCase();
      var weight = weightValue === "bold" ? 700 : weightValue === "normal" ? 400 : Number.parseInt(weightValue, 10);
      if (!Number.isFinite(weight)) weight = 400;
      weight = Math.max(100, Math.min(900, Math.round(weight / 100) * 100));
      var style = /italic|oblique/i.test(computed.fontStyle || "") ? "italic" : "normal";
      var variantKey = weight + "|" + style;
      if (!usage[key].variants[variantKey]) {
        usage[key].variants[variantKey] = { weight: weight, style: style, count: 0 };
      }
      usage[key].variants[variantKey].count++;
      usage[key].elements.push(node);
    });
    return usage;
  }

  function fontFaceKey(face) {
    return normalizeFontName(
      face.postscriptName || face.fullName || (face.family + " " + face.style)
    );
  }

  function findLocalFontFaces(family, localFonts) {
    var key = normalizeFontName(family);
    var exactFamily = localFonts.filter(function (font) {
      return normalizeFontName(font.family) === key;
    });
    if (exactFamily.length) return exactFamily;

    // Some Windows font collections expose a family through the full or
    // PostScript name rather than the family field. Keep this as fallback only.
    return localFonts.filter(function (font) {
      return normalizeFontName(font.fullName) === key ||
        normalizeFontName(font.postscriptName) === key;
    });
  }

  function selectLocalFontFaces(faces, variants) {
    var selected = new Map();
    var orderedVariants = variants.slice().sort(function (a, b) {
      return b.count - a.count;
    });

    orderedVariants.forEach(function (variant) {
      var sameStyle = faces.filter(function (face) {
        return localFontStyle(face.style) === variant.style;
      });
      var pool = sameStyle.length ? sameStyle : faces;
      if (!pool.length) return;

      pool = pool.slice().sort(function (a, b) {
        var aWeight = localFontWeight(a.style);
        var bWeight = localFontWeight(b.style);
        var aDistance = Math.abs(aWeight - variant.weight);
        var bDistance = Math.abs(bWeight - variant.weight);
        if (aDistance !== bDistance) return aDistance - bDistance;

        // For an equally close choice, prefer the heavier face when the
        // requested weight is above regular, and the lighter face otherwise.
        if (variant.weight >= 500) return bWeight - aWeight;
        return aWeight - bWeight;
      });

      var chosen = pool[0];
      var key = fontFaceKey(chosen);
      if (key && !selected.has(key)) selected.set(key, chosen);
    });

    return Array.from(selected.values());
  }

  async function buildWindowsFontAliases(renderedUsage, localFonts, id) {
    var aliases = Object.create(null);
    var cssRules = [];
    var matched = [];
    var missing = [];
    var failed = [];
    var objectUrls = [];
    var loadedFaceCount = 0;
    var failedFaceCount = 0;
    var totalBytes = 0;
    var maxTotalBytes = 64 * 1024 * 1024;
    var aliasIndex = 0;
    var familyEntries = Object.keys(renderedUsage).map(function (key) {
      return { key: key, usage: renderedUsage[key] };
    });

    // Load the fonts with the largest visible footprint first. The byte cap
    // should protect the browser without letting unused font-table entries
    // consume the budget ahead of the text the reader is actually viewing.
    familyEntries.sort(function (a, b) {
      return b.usage.elements.length - a.usage.elements.length;
    });

    for (var entry of familyEntries) {
      var family = entry.usage.family;
      var key = entry.key;
      var availableFaces = findLocalFontFaces(family, localFonts);
      if (!availableFaces.length) {
        missing.push(family);
        continue;
      }

      var variants = Object.keys(entry.usage.variants).map(function (variantKey) {
        return entry.usage.variants[variantKey];
      });
      var faces = selectLocalFontFaces(availableFaces, variants);
      if (!faces.length) {
        missing.push(family);
        continue;
      }

      var alias = "JupiterDOCXLocal_" + id + "_" + (++aliasIndex);
      var familyLoaded = 0;

      for (var face of faces) {
        try {
          if (typeof face.blob !== "function") throw new Error("This browser did not provide font bytes.");
          var fontBlob = await face.blob();
          ensureCurrent(id);
          if (!(fontBlob instanceof Blob) || !fontBlob.size) throw new Error("The returned font file was empty.");
          if (fontBlob.size > maxTotalBytes || totalBytes + fontBlob.size > maxTotalBytes) {
            throw new Error("The selected font face would exceed the 64 MB local-font loading limit.");
          }

          var objectUrl = URL.createObjectURL(fontBlob);
          objectUrls.push(objectUrl);
          if (current && current.id === id) current.windowsFontObjectUrls.push(objectUrl);
          totalBytes += fontBlob.size;
          cssRules.push(
            "@font-face{" +
              "font-family:" + cssQuotedString(alias) + ";" +
              "src:url(" + cssQuotedString(objectUrl) + ");" +
              "font-weight:" + localFontWeight(face.style) + ";" +
              "font-style:" + localFontStyle(face.style) + ";" +
              "font-display:block;" +
            "}"
          );
          familyLoaded++;
          loadedFaceCount++;
        } catch (error) {
          if (error && error.name === "AbortError") throw error;
          failedFaceCount++;
          failed.push(family + " (" + String(face.style || "unknown style") + "): " +
            (error && error.message ? error.message : "Font data could not be read."));
        }
      }

      if (familyLoaded) {
        aliases[key] = alias;
        matched.push(family);
      } else {
        missing.push(family);
      }
    }

    return {
      aliases: aliases,
      rules: cssRules,
      matched: matched,
      missing: missing,
      failed: failed,
      objectUrls: objectUrls,
      loadedFaceCount: loadedFaceCount,
      failedFaceCount: failedFaceCount,
      totalBytes: totalBytes
    };
  }

  async function applyWindowsFontAliases(id) {
    ensureCurrent(id);
    restoreWindowsFontAliases();

    var stage = panel.querySelector(".ja-lib-preview-stage");
    var root = stage && stage.querySelector(".ja-lib-docxjs-body");
    if (!root || !current.windowsLocalFonts || !current.windowsLocalFonts.length) {
      return {
        docxFamilies: [], usedFamilies: [], unusedDeclaredFamilies: [],
        matchedFamilies: [], loadedFamilies: [], missingFamilies: [],
        failedFamilies: [], failedFaces: [], loadedFaces: 0,
        failedFaceCount: 0, appliedElements: 0, totalBytes: 0, warning: ""
      };
    }

    var renderedUsage = collectRenderedFontUsage(root);
    var docxMetadata = await extractDocxFontFamilies(current.blob);
    ensureCurrent(id);

    var usedKeys = new Set(Object.keys(renderedUsage));
    var usedFamilies = Object.keys(renderedUsage).map(function (key) {
      return renderedUsage[key].family;
    });
    var unusedDeclaredFamilies = docxMetadata.families.filter(function (family) {
      return !usedKeys.has(normalizeFontName(family));
    });

    // Only rendered families are eligible for loading. The DOCX font table
    // also lists theme and fallback fonts which may never be used in this file.
    var result = await buildWindowsFontAliases(renderedUsage, current.windowsLocalFonts, id);
    ensureCurrent(id);
    current.windowsFontAliasMap = result.aliases;
    current.windowsFontMatchCount = result.matched.length;

    if (result.rules.length) {
      var style = document.createElement("style");
      style.id = "ja-docx-local-fonts-" + id;
      style.type = "text/css";
      style.textContent = result.rules.join("\n");
      document.head.appendChild(style);
      current.windowsFontStyle = style;
    }

    var appliedElements = 0;
    Object.keys(renderedUsage).forEach(function (key) {
      var alias = current.windowsFontAliasMap[key];
      if (!alias) return;
      renderedUsage[key].elements.forEach(function (node) {
        current.windowsFontOverrides.push({
          element: node,
          value: node.style.getPropertyValue("font-family"),
          priority: node.style.getPropertyPriority("font-family")
        });
        node.style.setProperty(
          "font-family",
          cssQuotedString(alias) + ", " + cssQuotedString(DOCX_FALLBACK_FONT_FAMILY) + ", serif",
          "important"
        );
        appliedElements++;
      });
    });

    var loadedFamilies = [];
    var failedFamilies = [];
    var failedVariants = [];
    var loadChecks = [];
    Object.keys(current.windowsFontAliasMap).forEach(function (key) {
      var alias = current.windowsFontAliasMap[key];
      var usage = renderedUsage[key];
      var variants = Object.keys(usage.variants).map(function (variantKey) {
        return usage.variants[variantKey];
      });

      variants.forEach(function (variant) {
        var descriptor = variant.weight + " " + variant.style + " 12px " + cssQuotedString(alias);
        loadChecks.push(
          document.fonts.load(descriptor).then(function (faces) {
            return {
              key: key,
              variant: variant.weight + " " + variant.style,
              count: variant.count,
              ok: Array.isArray(faces) && faces.length > 0
            };
          }).catch(function (error) {
            return {
              key: key,
              variant: variant.weight + " " + variant.style,
              count: variant.count,
              ok: false,
              error: error && error.message ? error.message : "FontFace loading failed."
            };
          })
        );
      });
    });

    var checked = await Promise.all(loadChecks);
    ensureCurrent(id);
    var loadState = Object.create(null);
    checked.forEach(function (item) {
      if (!loadState[item.key]) loadState[item.key] = { loaded: true, variants: 0, failedVariants: 0 };
      if (item.ok) {
        loadState[item.key].variants++;
      } else {
        loadState[item.key].loaded = false;
        loadState[item.key].failedVariants++;
        failedVariants.push(
          renderedUsage[item.key].family + " " + item.variant +
          (item.error ? " (" + item.error + ")" : "")
        );
      }
    });

    Object.keys(current.windowsFontAliasMap).forEach(function (key) {
      if (loadState[key] && loadState[key].loaded) {
        loadedFamilies.push(renderedUsage[key].family);
      } else {
        failedFamilies.push(renderedUsage[key].family);
      }
    });

    var diagnostics = {
      docxFamilies: docxMetadata.families,
      usedFamilies: usedFamilies,
      unusedDeclaredFamilies: unusedDeclaredFamilies,
      matchedFamilies: result.matched,
      loadedFamilies: loadedFamilies,
      missingFamilies: result.missing,
      failedFamilies: failedFamilies,
      failedVariants: failedVariants,
      failedFaces: result.failed,
      loadedFaces: result.loadedFaceCount,
      failedFaceCount: result.failedFaceCount,
      appliedElements: appliedElements,
      totalBytes: result.totalBytes,
      fallbackFamily: DOCX_FALLBACK_FONT_FAMILY,
      bookmanDetectedOnWindows: isWindowsLocalFontFamilyAvailable(DOCX_FALLBACK_FONT_FAMILY),
      fallbackElements: current.docxFallbackAppliedCount || 0,
      warning: docxMetadata.warning || ""
    };
    current.windowsFontDiagnostics = diagnostics;
    return diagnostics;
  }

  function formatWindowsFontDiagnostics(diagnostics) {
    if (!diagnostics) return "No Windows font diagnostics are available.";
    var parts = [
      "DOCX families declared: " + diagnostics.docxFamilies.length + ".",
      "Families used in rendered content: " + diagnostics.usedFamilies.length + ".",
      "Windows font families loaded: " + diagnostics.loadedFamilies.length + ".",
      "Selected font faces loaded: " + diagnostics.loadedFaces + ".",
      "Document elements updated: " + diagnostics.appliedElements + ".",
      (diagnostics.fallbackFamily || DOCX_FALLBACK_FONT_FAMILY) +
        " is the final fallback on " + (diagnostics.fallbackElements || 0) + " elements when installed.",
      "Local font data: " + (diagnostics.totalBytes / 1048576).toFixed(1) + " MB."
    ];
    if (diagnostics.bookmanDetectedOnWindows === true) {
      parts.push("Bookman Antiqua was found in Chrome's Windows font list.");
    } else if (diagnostics.bookmanDetectedOnWindows === false) {
      parts.push("Bookman Antiqua was NOT found in Chrome's Windows font list; missing document fonts will fall back to Georgia, Times New Roman or another serif face instead of monospace.");
    }
    if (diagnostics.loadedFamilies.length) {
      parts.push("Loaded: " + diagnostics.loadedFamilies.join(", ") + ".");
    }
    if (diagnostics.missingFamilies.length) {
      parts.push("Used fonts not installed or not matched: " + diagnostics.missingFamilies.join(", ") + ".");
    }
    if (diagnostics.unusedDeclaredFamilies.length) {
      parts.push("Declared but not used in rendered content: " + diagnostics.unusedDeclaredFamilies.join(", ") + ".");
    }
    if (diagnostics.failedFamilies.length) {
      parts.push("Used font families not fully loaded: " + diagnostics.failedFamilies.join(", ") + ".");
    }
    if (diagnostics.failedVariants.length) {
      parts.push("Variants not verified: " + diagnostics.failedVariants.slice(0, 6).join("; ") + ".");
    }
    if (diagnostics.failedFaces.length) {
      parts.push("Selected font faces could not be read: " + diagnostics.failedFaces.slice(0, 5).join("; ") + ".");
    }
    if (diagnostics.warning) parts.push(diagnostics.warning);
    return parts.join(" ");
  }

  async function toggleWindowsFonts() {
    if (!current || current.type !== "docx" || current.docxRenderer !== "html") return;
    var id = current.id;

    if (current.windowsFontsEnabled) {
      // Undo the fallback first, then undo the Windows aliases beneath it.
      restoreDocxFallbackFont();
      restoreWindowsFontAliases();
      current.windowsFontsEnabled = false;
      current.windowsLocalFonts = null;
      setTools(docxRendererTools());
      setPreviewStatus("DOCX → HTML · Browser font matching", current.blob.size);
      showDocxRendererNotice("Windows font loading is off. The browser's normal font selection is active.");
      return;
    }

    if (typeof window.queryLocalFonts !== "function") {
      showDocxRendererNotice("This browser does not support Local Font Access. Use desktop Chrome or Edge on a secure site, or switch to DOCX → PDF.");
      return;
    }

    var request;
    try {
      request = window.queryLocalFonts();
    } catch (error) {
      showDocxRendererNotice("Chrome could not request local font access: " + (error.message || "Permission unavailable."));
      return;
    }

    setPreviewStatus("Requesting Windows font permission…", current.blob.size);
    try {
      var localFonts = await request;
      ensureCurrent(id);
      if (!Array.isArray(localFonts) || !localFonts.length) {
        showDocxRendererNotice("No local fonts were returned. Check Chrome's local-font permission for this site.");
        setPreviewStatus("DOCX → HTML · Browser font matching", current.blob.size);
        return;
      }

      current.windowsLocalFonts = localFonts;
      var diagnostics = await applyWindowsFontAliases(id);
      ensureCurrent(id);
      current.windowsFontDiagnostics = diagnostics;
      current.windowsFontsEnabled = diagnostics.loadedFamilies.length > 0;
      setTools(docxRendererTools());

      if (current.windowsFontsEnabled) {
        setPreviewStatus(
          "Windows fonts · " + diagnostics.loadedFamilies.length + " loaded",
          current.blob.size
        );
      } else {
        current.windowsLocalFonts = null;
        restoreWindowsFontAliases();
        setPreviewStatus("DOCX → HTML · No local font faces loaded", current.blob.size);
      }
      showDocxRendererNotice(formatWindowsFontDiagnostics(diagnostics));
    } catch (error) {
      if (!current || current.id !== id) return;
      restoreWindowsFontAliases();
      current.windowsFontsEnabled = false;
      current.windowsLocalFonts = null;
      setTools(docxRendererTools());
      setPreviewStatus("DOCX → HTML · Browser font matching", current.blob.size);
      showDocxRendererNotice(
        error && error.name === "NotAllowedError"
          ? "Local font access was not granted. Allow local-font access in Chrome's site permissions and try again."
          : "Could not load local Windows fonts: " + (error && error.message ? error.message : "Permission unavailable.")
      );
    }
  }

    function docxRendererTools() {
    var mode = current && current.docxRenderer || "html";
    return (
      '<div class="ja-lib-docx-renderer-toggle" role="group" aria-label="Word preview method">' +
        '<button type="button" class="ja-lib-docx-toggle' + (mode === "html" ? " active" : "") +
          '" data-preview-action="docx-mode-html" aria-pressed="' + (mode === "html" ? "true" : "false") +
          '" title="Render DOCX directly as HTML in this browser">DOCX → HTML</button>' +
        '<button type="button" class="ja-lib-docx-toggle' + (mode === "pdf" ? " active" : "") +
          '" data-preview-action="docx-mode-pdf" aria-pressed="' + (mode === "pdf" ? "true" : "false") +
          '" title="Convert DOCX to PDF using LibreOffice, then view with PDF.js">DOCX → PDF</button>' +
        (mode === "html" ?
          '<button type="button" class="ja-lib-docx-toggle ja-lib-docx-local-fonts' +
            (current && current.windowsFontsEnabled ? ' active' : '') +
            '" data-preview-action="windows-fonts" aria-pressed="' +
            (current && current.windowsFontsEnabled ? "true" : "false") +
            '" title="Ask Chrome to match this document to fonts installed on your Windows computer. Font files stay local.">' +
            (current && current.windowsFontsEnabled ? "Windows fonts ✓" : "Use Windows fonts") +
          '</button>' : '') +
      '</div>'
    );
  }

  function isPdfView() {
    return !!current && (
      current.type === "pdf" ||
      (current.type === "docx" && current.docxRenderer === "pdf")
    );
  }

  function destroyPdfView() {
    if (!current) return;
    cancelPdfPageStates();
    if (current.pdfDocument && typeof current.pdfDocument.destroy === "function") {
      try { current.pdfDocument.destroy(); } catch (error) {}
    }
    current.pdfDocument = null;
    current.pdfjs = null;
    current.pdfPageObjects = [];
    current.pdfPageStates = [];
    current.pdfHasLayout = false;
    current.pageCount = 0;
    current.page = 1;
  }

  function showDocxRendererNotice(message) {
    if (!current || current.type !== "docx") return;
    var stage = panel.querySelector(".ja-lib-preview-stage");
    var notice = document.createElement("div");
    notice.className = "ja-lib-docx-renderer-notice";
    notice.textContent = message;
    stage.insertBefore(notice, stage.firstChild);
  }

  async function renderDocxHtml(id) {
    destroyPdfView();
    setLoading("Loading DOCX browser renderer…");
    await loadScript(JSZIP_URL, "docx-jszip", "JSZip");
    ensureCurrent(id);
    var docxLibrary = await loadScript(DOCX_PREVIEW_URL, "docx-preview", "docx");
    ensureCurrent(id);
    if (!docxLibrary || typeof docxLibrary.renderAsync !== "function") {
      throw new Error("The docx-preview library did not expose renderAsync().");
    }

    var stage = panel.querySelector(".ja-lib-preview-stage");
    stage.classList.remove("is-pdf","is-pdf-vertical","is-pdf-horizontal","is-docx","is-spreadsheet","is-pptx");
    restoreDocxFallbackFont();
    restoreWindowsFontAliases();
    stage.classList.add("is-docxjs");
    stage.innerHTML =
      '<div class="ja-lib-docxjs-styles"></div>' +
      '<div class="ja-lib-docxjs-body"></div>';

    var styles = stage.querySelector(".ja-lib-docxjs-styles");
    var body = stage.querySelector(".ja-lib-docxjs-body");
    await docxLibrary.renderAsync(current.blob, body, styles, {
      className: "jaDocxLayout",
      inWrapper: true,
      hideWrapperOnPrint: false,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      renderComments: false,
      renderAltChunks: true,
      useBase64URL: false,
      experimental: false,
      debug: false
    });
    ensureCurrent(id);
    var fontDiagnostics = null;
    if (current.windowsFontsEnabled && current.windowsLocalFonts && current.windowsLocalFonts.length) {
      // Match Windows fonts against the original DOCX-rendered styles first.
      // Applying the fallback earlier would make Bookman appear to be the
      // requested font and would prevent the document's own fonts matching.
      fontDiagnostics = await applyWindowsFontAliases(id);
      ensureCurrent(id);
      current.windowsFontDiagnostics = fontDiagnostics;
      current.windowsFontsEnabled = fontDiagnostics.loadedFamilies.length > 0;
    }

    // Apply the Bookman/serif fallback only after Windows font matching.
    var fallbackElements = applyDocxFallbackFont(body);
    if (fontDiagnostics) {
      fontDiagnostics.fallbackElements = fallbackElements;
      fontDiagnostics.bookmanDetectedOnWindows =
        isWindowsLocalFontFamilyAvailable(DOCX_FALLBACK_FONT_FAMILY);
    }
    setTools(docxRendererTools());
    setPreviewStatus(
      current.windowsFontsEnabled
        ? "DOCX → HTML · " + fontDiagnostics.loadedFamilies.length + " Windows font families loaded"
        : "DOCX → HTML · " + DOCX_FALLBACK_FONT_FAMILY + " fallback enabled",
      current.blob.size
    );
    if (fontDiagnostics) {
      showDocxRendererNotice(formatWindowsFontDiagnostics(fontDiagnostics));
    } else {
      showDocxRendererNotice(
        DOCX_FALLBACK_FONT_FAMILY +
        " is the preferred final fallback after the document's own fonts. If it is not installed, " +
        "the viewer uses Georgia, Times New Roman or a generic serif font; it will not fall back to monospace."
      );
    }
    setSearchReady(true);
    refreshVisibleSearchHighlights();
  }

  async function convertDocxToPdf(id) {
    ensureCurrent(id);
    var file = current.file || {};
    if (!file.id) {
      throw new Error("This file has no Google Drive file ID for server-side PDF conversion.");
    }

    var cacheKey = [
      file.id,
      file.modifiedTime || "unversioned",
      "libreoffice-v1"
    ].join(":");

    var driveCache = window.JupiterLibraryDrive;
    if (driveCache && typeof driveCache.getConvertedPreview === "function") {
      var cached = await driveCache.getConvertedPreview(cacheKey);
      ensureCurrent(id);
      if (cached && cached.blob instanceof Blob && cached.blob.size) {
        setPreviewStatus("DOCX → PDF · Cached conversion", cached.blob.size);
        return cached.blob;
      }
    }

    setLoading("Converting Word document to PDF…");
    var params = new URLSearchParams({
      action: "convert-docx",
      fileId: String(file.id)
    });
    if (file.resourceKey) params.set("resourceKey", String(file.resourceKey));

    var response;
    try {
      response = await fetch("/api/drive?" + params.toString(), {
        method: "GET",
        credentials: "same-origin",
        signal: current.controller.signal,
        headers: { Accept: "application/pdf, application/json" }
      });
    } catch (error) {
      if (error && error.name === "AbortError") throw error;
      throw new Error("Could not reach the DOCX-to-PDF conversion service.");
    }

    if (!response.ok) {
      var message = "DOCX-to-PDF conversion returned HTTP " + response.status + ".";
      try {
        var body = await response.json();
        if (body && body.error) message = body.error;
      } catch (error) {}
      throw new Error(message);
    }

    var pdfBlob = await response.blob();
    ensureCurrent(id);
    if (!pdfBlob.size || (pdfBlob.type && !pdfBlob.type.toLowerCase().includes("pdf"))) {
      throw new Error("The conversion service did not return a valid PDF.");
    }
    if (!pdfBlob.type) pdfBlob = new Blob([pdfBlob], { type: "application/pdf" });

    if (driveCache && typeof driveCache.setConvertedPreview === "function") {
      await driveCache.setConvertedPreview(cacheKey, pdfBlob, file.name || "");
    }
    ensureCurrent(id);
    return pdfBlob;
  }

  async function renderDocxPdf(id) {
    restoreDocxFallbackFont();
    restoreWindowsFontAliases();
    destroyPdfView();
    var pdfBlob = await convertDocxToPdf(id);
    ensureCurrent(id);
    current.docxPdfBlob = pdfBlob;
    await renderPdfBlob(id, pdfBlob, true);
    ensureCurrent(id);
    setPreviewStatus("DOCX → PDF · LibreOffice conversion", pdfBlob.size);
  }

  async function renderDocx(id) {
    if (!current.docxRenderer) current.docxRenderer = "html";
    if (current.docxRenderer === "pdf") {
      return renderDocxPdf(id);
    }
    return renderDocxHtml(id);
  }

  async function renderSpreadsheet(id) {
    setLoading("Loading spreadsheet viewer…");
    spreadsheetEngine = await loadScript(SHEETJS_URL, "sheetjs", "XLSX");
    ensureCurrent(id);
    var workbook = spreadsheetEngine.read(await current.blob.arrayBuffer(), {
      type: "array", cellDates: true, dense: true, WTF: false
    });
    ensureCurrent(id);
    if (!workbook.SheetNames || !workbook.SheetNames.length) throw new Error("No worksheets were found.");
    current.workbook = workbook;
    current.sheetIndex = 0;
    var stage = panel.querySelector(".ja-lib-preview-stage");
    stage.innerHTML =
      '<div class="ja-lib-sheet-tabs" role="tablist" aria-label="Worksheets"></div>' +
      '<div class="ja-lib-sheet-wrap"></div><div class="ja-lib-sheet-limit" hidden></div>';
    stage.classList.add("is-spreadsheet");
    var tabs = stage.querySelector(".ja-lib-sheet-tabs");
    workbook.SheetNames.forEach(function (name, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "ja-lib-sheet-tab";
      button.setAttribute("role", "tab");
      button.textContent = name;
      button.addEventListener("click", function () {
        if (!current) return;
        current.sheetIndex = index;
        current.searchTargetCell = null;
        renderSheet(id);
      });
      tabs.appendChild(button);
    });
    setTools('<span class="ja-lib-preview-note">Read-only cell values · No formula recalculation</span>');
    renderSheet(id);
    setSearchReady(true);
  }

  function renderSheet(id) {
    ensureCurrent(id);
    var XLSX = spreadsheetEngine;
    var workbook = current.workbook;
    var name = workbook.SheetNames[current.sheetIndex];
    var worksheet = workbook.Sheets[name];
    var stage = panel.querySelector(".ja-lib-preview-stage");
    stage.querySelectorAll(".ja-lib-sheet-tab").forEach(function (tab, index) {
      tab.classList.toggle("active", index === current.sheetIndex);
      tab.setAttribute("aria-selected", index === current.sheetIndex ? "true" : "false");
    });
    var wrap = stage.querySelector(".ja-lib-sheet-wrap");
    wrap.innerHTML = "";
    if (!worksheet || !worksheet["!ref"]) {
      wrap.innerHTML = '<div class="ja-lib-preview-empty-sheet">This worksheet is empty.</div>';
      return;
    }
    var range = XLSX.utils.decode_range(worksheet["!ref"]);
    var viewStartRow = range.s.r;
    var viewStartCol = range.s.c;
    var targetCell = current.searchTargetCell;
    if (targetCell && targetCell.sheetIndex === current.sheetIndex) {
      var maxRowStart = Math.max(range.s.r, range.e.r - 249);
      var maxColStart = Math.max(range.s.c, range.e.c - 39);
      viewStartRow = Math.max(range.s.r, Math.min(targetCell.row - 125, maxRowStart));
      viewStartCol = Math.max(range.s.c, Math.min(targetCell.col - 20, maxColStart));
    }
    var lastRow = Math.min(range.e.r, viewStartRow + 249);
    var lastCol = Math.min(range.e.c, viewStartCol + 39);
    var clipped = viewStartRow > range.s.r || viewStartCol > range.s.c ||
      range.e.r > lastRow || range.e.c > lastCol;
    var rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, raw: false, defval: "", blankrows: true,
      range: XLSX.utils.encode_range({ s: { r: viewStartRow, c: viewStartCol }, e: { r: lastRow, c: lastCol } })
    });
    current.renderedSheetWindow = {
      sheetIndex: current.sheetIndex, startRow: viewStartRow, endRow: lastRow,
      startCol: viewStartCol, endCol: lastCol
    };
    var table = document.createElement("table");
    table.className = "ja-lib-sheet-table";
    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    var corner = document.createElement("th");
    corner.className = "row-number";
    corner.textContent = "#";
    headRow.appendChild(corner);
    for (var col = viewStartCol; col <= lastCol; col++) {
      var th = document.createElement("th");
      th.textContent = XLSX.utils.encode_col(col);
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    rows.forEach(function (row, rowIndex) {
      var tr = document.createElement("tr");
      var number = document.createElement("th");
      number.className = "row-number";
      number.textContent = String(viewStartRow + rowIndex + 1);
      tr.appendChild(number);
      for (var c = viewStartCol; c <= lastCol; c++) {
        var td = document.createElement("td");
        td.textContent = row[c - viewStartCol] == null ? "" : String(row[c - viewStartCol]);
        td.setAttribute("data-cell-address", XLSX.utils.encode_cell({
          r: viewStartRow + rowIndex, c: c
        }));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    var limit = stage.querySelector(".ja-lib-sheet-limit");
    limit.hidden = !clipped;
    limit.textContent = clipped
      ? "Preview window: rows " + (viewStartRow + 1) + "–" + (lastRow + 1) +
        ", columns " + XLSX.utils.encode_col(viewStartCol) + "–" + XLSX.utils.encode_col(lastCol) +
        ". Search checks all populated cells in this worksheet."
      : "";
    if (current.search && current.search.query) refreshVisibleSearchHighlights();
  }

  function renderText(id) {
    ensureCurrent(id);
    return current.blob.text().then(function (text) {
      ensureCurrent(id);
      var stage = panel.querySelector(".ja-lib-preview-stage");
      var pre = document.createElement("pre");
      pre.className = "ja-lib-text-preview";
      pre.textContent = text;
      stage.innerHTML = "";
      stage.appendChild(pre);
      setTools('<span class="ja-lib-preview-note">Plain-text view · Content is not executed</span>');
      setSearchReady(true);
      refreshVisibleSearchHighlights();
    });
  }

  function renderMedia(id, type) {
    ensureCurrent(id);
    current.objectUrl = URL.createObjectURL(current.blob);
    var stage = panel.querySelector(".ja-lib-preview-stage");
    var element = document.createElement(type === "video" ? "video" : "audio");
    element.className = type === "video" ? "ja-lib-video" : "ja-lib-audio";
    element.controls = true;
    element.preload = "metadata";
    element.src = current.objectUrl;
    stage.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "ja-lib-media-wrap";
    wrap.appendChild(element);
    stage.appendChild(wrap);
    setTools('<span class="ja-lib-preview-note">Browser media playback</span>');
  }

  function sanitizeRenderedSvg(svg) {
    var parsed = new DOMParser().parseFromString(String(svg), "image/svg+xml");
    var root = parsed.documentElement;
    if (!root || root.nodeName.toLowerCase() !== "svg" || parsed.querySelector("parsererror")) {
      throw new Error("The presentation renderer returned an invalid slide.");
    }
    root.querySelectorAll("script,iframe,object,embed").forEach(function (node) { node.remove(); });
    root.querySelectorAll("*").forEach(function (node) {
      Array.from(node.attributes).forEach(function (attribute) {
        var name = attribute.name.toLowerCase();
        var value = attribute.value.trim();
        if (name.startsWith("on") ||
            ((name === "href" || name === "xlink:href") && !/^(data:image\/|#)/i.test(value)) ||
            (name === "style" && /(url\s*\(|expression\s*\(|@import)/i.test(value))) {
          node.removeAttribute(attribute.name);
        }
      });
    });
    return document.importNode(root, true);
  }

  async function renderPptx(id) {
    setLoading("Loading PowerPoint slide viewer…");
    var modules = await Promise.all([
      loadModule("pagus-core", PAGUS_CORE_URL),
      loadModule("pagus-renderer", PAGUS_RENDERER_URL)
    ]);
    ensureCurrent(id);
    if (!modules[0].parse || !modules[1].renderSlide) {
      throw new Error("The PowerPoint renderer API could not be initialized.");
    }
    var presentation = await modules[0].parse(await current.blob.arrayBuffer());
    ensureCurrent(id);
    if (!presentation.slides || !presentation.slides.length) throw new Error("No slides were found.");
    current.presentation = presentation;
    current.renderer = modules[1];
    current.slideIndex = 0;
    current.fontSubstitutes = modules[1].buildFontSubstitutes
      ? modules[1].buildFontSubstitutes(presentation.fonts) : undefined;
    setTools(toolButton("slide-prev", "Previous slide", "‹") +
      '<span class="ja-lib-preview-counter" data-preview-counter></span>' +
      toolButton("slide-next", "Next slide", "›"));
    await renderSlide(id);
    setSearchReady(true);
  }

  async function renderSlide(id) {
    ensureCurrent(id);
    var presentation = current.presentation;
    var options = current.fontSubstitutes ? { fontSubstitutes: current.fontSubstitutes } : {};
    var rendered = current.renderer.renderSlide(presentation.slides[current.slideIndex], presentation.slideSize, options);
    var stage = panel.querySelector(".ja-lib-preview-stage");
    stage.classList.add("is-pptx");
    stage.innerHTML = '<div class="ja-lib-slide-frame"></div>';
    stage.querySelector(".ja-lib-slide-frame").appendChild(sanitizeRenderedSvg(rendered.svg));
    var counter = panel.querySelector("[data-preview-counter]");
    if (counter) counter.textContent = (current.slideIndex + 1) + " / " + presentation.slides.length;
    var prev = panel.querySelector('[data-preview-action="slide-prev"]');
    var next = panel.querySelector('[data-preview-action="slide-next"]');
    if (prev) prev.disabled = current.slideIndex <= 0;
    if (next) next.disabled = current.slideIndex >= presentation.slides.length - 1;
    if (current.search && current.search.query) refreshVisibleSearchHighlights();
  }

  function handlePanelClick(event) {
    var button = event.target.closest("[data-preview-action]");
    if (!button || button.disabled || !current) return;
    var action = button.getAttribute("data-preview-action");
    if (action === "search-prev") navigatePreviewSearch(-1);
    else if (action === "search-next") navigatePreviewSearch(1);
    else if (action === "back") close();
    else if (action === "docx-mode-html" && current.type === "docx") {
      selectDocxRenderer("html");
    } else if (action === "docx-mode-pdf" && current.type === "docx") {
      selectDocxRenderer("pdf");
    } else if (action === "windows-fonts" && current.type === "docx" && current.docxRenderer === "html") {
      toggleWindowsFonts();
    } else if (action === "zoom-in") changeZoom(1.2);
    else if (action === "zoom-out") changeZoom(1 / 1.2);
    else if (action === "zoom-reset") resetZoom();
    else if (action === "scroll-mode") {
      setPdfScrollMode(current.pdfScrollMode === "vertical" ? "horizontal" : "vertical");
    } else if (action === "slide-prev" && current.slideIndex > 0) {
      current.slideIndex--;
      renderSlide(current.id).catch(handleRenderError);
    } else if (action === "slide-next" && current.slideIndex < current.presentation.slides.length - 1) {
      current.slideIndex++;
      renderSlide(current.id).catch(handleRenderError);
    }
  }

  async function selectDocxRenderer(mode) {
    if (!current || current.type !== "docx" || current.docxRenderer === mode) return;
    var id = current.id;
    var previousMode = current.docxRenderer || "html";
    prepareSearchForRerender();
    current.docxRenderer = mode;

    try {
      if (mode === "pdf") await renderDocxPdf(id);
      else await renderDocxHtml(id);
    } catch (error) {
      if (!current || current.id !== id) return;
      if (mode === "pdf") {
        current.docxRenderer = previousMode;
        try {
          await renderDocxHtml(id);
          showDocxRendererNotice(error && error.message ? error.message : "PDF conversion is unavailable.");
        } catch (renderError) {
          handleRenderError(renderError);
        }
      } else {
        handleRenderError(error);
      }
    }
  }

  function changeZoom(factor) {
    if (!current) return;
    var next = Math.min(3, Math.max(.35, current.zoom * factor));
    if (Math.abs(next - current.zoom) < .001) return;
    current.zoom = next;

    if (isPdfView()) {
      rebuildPdfPageLayout(current.id, current.page || 1).catch(handleRenderError);
    } else if (current.type === "image") {
      var image = panel.querySelector(".ja-lib-preview-image");
      if (image) image.style.transform = "scale(" + current.zoom + ")";
    } else if (current.type === "docx") {
      var docxPage = panel.querySelector(".jaDocxLayout-wrapper, .ja-lib-docx-page");
      if (docxPage) docxPage.style.zoom = String(current.zoom);
    } else if (current.type === "spreadsheet") {
      var sheet = panel.querySelector(".ja-lib-sheet-wrap");
      if (sheet) sheet.style.zoom = String(current.zoom);
    } else if (current.type === "pptx") {
      var slide = panel.querySelector(".ja-lib-slide-frame");
      if (slide) slide.style.zoom = String(current.zoom);
    }
  }

  function resetZoom() {
    if (!current) return;
    current.zoom = 1;
    if (isPdfView()) {
      rebuildPdfPageLayout(current.id, current.page || 1).catch(handleRenderError);
    } else if (current.type === "image") {
      var image = panel.querySelector(".ja-lib-preview-image");
      if (image) image.style.transform = "scale(1)";
    } else {
      var stage = panel.querySelector(".ja-lib-preview-stage");
      if (stage) stage.style.zoom = "1";
      var scaled = stage && stage.querySelector(".jaDocxLayout-wrapper, .ja-lib-docx-page, .ja-lib-sheet-wrap, .ja-lib-slide-frame");
      if (scaled) scaled.style.zoom = "1";
    }
  }

  function handlePreviewWheel(event) {
    if (!current || (!event.ctrlKey && !event.metaKey)) return;
    // Chromium reports touchpad pinch as a Ctrl+wheel gesture. Keep the zoom
    // inside the document viewer rather than zooming the whole web page.
    event.preventDefault();
    event.stopPropagation();
    var delta = Math.max(-120, Math.min(120, event.deltaY));
    changeZoom(Math.exp(-delta * .003));
  }

  function handleRenderError(error) {
    if (error && error.name === "AbortError") return;
    if (!current) return;
    showError(error && error.message ? error.message : "The preview could not be rendered.");
    if (current.type === "docx") setTools(docxRendererTools());
  }

  function close(options) {
    options = options || {};
    cleanupCurrent();
    if (panel) {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      panel.querySelector(".ja-lib-preview-stage").innerHTML = "";
    }
    if (!options.silent) {
      var button = document.querySelector('#ja-reference-library-window [data-ja-action="preview-selected"]');
      var closeButton = document.querySelector('#ja-reference-library-window [data-ja-action="close"]');
      var target = previousFocus;
      previousFocus = null;
      if (target && target.isConnected && target !== document.body && target !== document.documentElement &&
          !target.disabled && (!panel || !panel.contains(target))) {
        target.focus({ preventScroll: true });
      } else if (button && !button.disabled) {
        button.focus({ preventScroll: true });
      } else if (closeButton) {
        closeButton.focus({ preventScroll: true });
      }
    } else {
      previousFocus = null;
    }
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && panel && panel.classList.contains("is-open")) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });

  window.JupiterLibraryPreview = {
    open: open,
    close: close,
    isOpen: function () { return !!panel && panel.classList.contains("is-open"); },
    getSupportedTypes: function () {
      return ["pdf", "image", "docx", "spreadsheet", "pptx", "text", "audio", "video", "remote"];
    },
    maxPreviewBytes: MAX_PREVIEW_BYTES
  };
  console.info("Jupiter Astro: Document preview engine loaded.");
})();