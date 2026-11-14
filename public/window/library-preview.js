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
  var MAMMOTH_URL = "https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js";
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
        '<div class="ja-lib-preview-tools" aria-label="Preview controls"></div>' +
      '</header>' +
      '<div class="ja-lib-preview-stage" tabindex="0"><div class="ja-lib-preview-loading"><span class="ja-lib-preview-spinner"></span><span>Preparing preview…</span></div></div>';
    main.appendChild(panel);
    panel.addEventListener("click", handlePanelClick);
    panel.addEventListener("wheel", handlePreviewWheel, { passive: false });
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
    cancelPdfPageStates();
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
      docxRenderer: "html", docxPdfBlob: null
    };

    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    previousFocus = returnFocus;
    panel.querySelector(".ja-lib-preview-stage").scrollTop = 0;
    var backButton = panel.querySelector('[data-preview-action="back"]');
    if (backButton) backButton.focus({ preventScroll: true });
    setMetadata(file, current.type);
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
    });
  }

  async function renderCurrent(id) {
    ensureCurrent(id);
    var previewStage = panel.querySelector(".ja-lib-preview-stage");
    previewStage.classList.remove("is-spreadsheet","is-pdf","is-pdf-vertical","is-pdf-horizontal","is-docx","is-pptx");
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
    var mode = current.pdfScrollMode || "vertical";
    var hadLayout = !!current.pdfHasLayout;
    var previousMode = current.previousPdfScrollMode || mode;
    var previousScrollTop = stage.scrollTop;
    var previousScrollLeft = stage.scrollLeft;
    var previousScrollHeight = stage.scrollHeight;
    var previousScrollWidth = stage.scrollWidth;
    stage.classList.remove("is-spreadsheet","is-pdf","is-pdf-vertical","is-pdf-horizontal","is-docx","is-pptx");
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

  function sanitizeDocxHtml(html) {
    var parsed = new DOMParser().parseFromString(String(html || ""), "text/html");
    var allowed = new Set([
      "P","BR","STRONG","B","EM","I","U","S","H1","H2","H3","H4","H5","H6",
      "UL","OL","LI","BLOCKQUOTE","TABLE","THEAD","TBODY","TFOOT","TR","TH","TD",
      "A","IMG","DIV","SPAN","PRE","CODE","HR","SUB","SUP"
    ]);
    function clean(node) {
      Array.from(node.childNodes).forEach(function (child) {
        if (child.nodeType === Node.COMMENT_NODE) { child.remove(); return; }
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        if (!allowed.has(child.tagName)) {
          clean(child);
          child.replaceWith.apply(child, Array.from(child.childNodes));
          return;
        }
        Array.from(child.attributes).forEach(function (attribute) {
          var name = attribute.name.toLowerCase();
          var value = attribute.value.trim();
          var safe = (child.tagName === "A" && name === "href" && /^(https?:|mailto:)/i.test(value)) ||
            (child.tagName === "IMG" && name === "src" && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value)) ||
            ((child.tagName === "TD" || child.tagName === "TH") && /^(colspan|rowspan)$/.test(name) && /^\d{1,3}$/.test(value)) ||
            (child.tagName === "IMG" && /^(alt|title|width|height)$/.test(name) && /^[\w\s.%()-]{0,120}$/.test(value));
          if (!safe) child.removeAttribute(attribute.name);
        });
        if (child.tagName === "A") {
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        }
        clean(child);
      });
    }
    clean(parsed.body);
    return parsed.body;
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
    setTools(docxRendererTools());
    setPreviewStatus("DOCX → HTML · Browser rendering", current.blob.size);
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
    destroyPdfView();
    var pdfBlob = await convertDocxToPdf(id);
    ensureCurrent(id);
    current.docxPdfBlob = pdfBlob;
    await renderPdfBlob(id, pdfBlob, true);
    ensureCurrent(id);
    setTools(docxRendererTools() + panel.querySelector(".ja-lib-preview-tools").innerHTML);
    setPreviewStatus("DOCX → PDF · LibreOffice conversion", pdfBlob.size);
  }

  async function renderDocx(id) {
    if (!current.docxRenderer) current.docxRenderer = "html";
    if (current.docxRenderer === "pdf") {
      return renderDocxPdf(id);
    }
    destroyPdfView();
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
        renderSheet(id);
      });
      tabs.appendChild(button);
    });
    setTools('<span class="ja-lib-preview-note">Read-only cell values · No formula recalculation</span>');
    renderSheet(id);
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
    var lastRow = Math.min(range.e.r, range.s.r + 249);
    var lastCol = Math.min(range.e.c, range.s.c + 39);
    var clipped = range.e.r > lastRow || range.e.c > lastCol;
    var rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, raw: false, defval: "", blankrows: true,
      range: XLSX.utils.encode_range({ s: { r: range.s.r, c: range.s.c }, e: { r: lastRow, c: lastCol } })
    });
    var table = document.createElement("table");
    table.className = "ja-lib-sheet-table";
    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    var corner = document.createElement("th");
    corner.className = "row-number";
    corner.textContent = "#";
    headRow.appendChild(corner);
    for (var col = range.s.c; col <= lastCol; col++) {
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
      number.textContent = String(range.s.r + rowIndex + 1);
      tr.appendChild(number);
      for (var c = range.s.c; c <= lastCol; c++) {
        var td = document.createElement("td");
        td.textContent = row[c - range.s.c] == null ? "" : String(row[c - range.s.c]);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    var limit = stage.querySelector(".ja-lib-sheet-limit");
    limit.hidden = !clipped;
    limit.textContent = clipped
      ? "Preview limited to the first " + (lastRow - range.s.r + 1) + " rows and " +
        (lastCol - range.s.c + 1) + " columns of this worksheet for performance."
      : "";
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
  }

  function handlePanelClick(event) {
    var button = event.target.closest("[data-preview-action]");
    if (!button || button.disabled || !current) return;
    var action = button.getAttribute("data-preview-action");
    if (action === "back") close();
    else if (action === "docx-mode-html" && current.type === "docx") {
      selectDocxRenderer("html");
    } else if (action === "docx-mode-pdf" && current.type === "docx") {
      selectDocxRenderer("pdf");
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
    if (current) showError(error && error.message ? error.message : "The preview could not be rendered.");
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