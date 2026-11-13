/* =========================================================
   JUPITER ASTRO — GOOGLE DRIVE PUBLIC FOLDER CONNECTOR
   Read-only. Requires Drive API enabled and folder sharing set to
   "Anyone with the link — Viewer". Restrict the public API key by
   HTTP referrer and enabled APIs in Google Cloud Console.
   ========================================================= */
(function () {
  "use strict";
  if (window.__JA_LIBRARY_DRIVE_LOADED) return;
  window.__JA_LIBRARY_DRIVE_LOADED = true;

  var API_ROOT = "https://www.googleapis.com/drive/v3";
  var ROOT = { id:"10ZkA2yVR0xHS9qpWpBRLjOKOCWIrzsNj", name:"Shared Astrology Library" };
  var PAGE_SIZE = 100, stack = [], files = [], nextPageToken = null;
  var loading = false, activeController = null, selectedId = null;
  var requestSerial = 0, searchBound = false;

  function apiKey() {
    var config = window.jaFirebaseConfig;
    if (!config || !config.apiKey) throw new Error("Firebase configuration is not ready. Refresh the page and retry.");
    return config.apiKey;
  }
  function contentEl() { return document.querySelector("#ja-reference-library-window .ja-lib-content"); }
  function searchEl() { return document.querySelector("#ja-reference-library-window .ja-lib-search"); }

  function setStatus(value) {
    var label = document.querySelector("#ja-reference-library-window .ja-lib-source-label");
    if (label) label.textContent = value;
    var provider = document.querySelector('#ja-reference-library-window [data-ja-provider="google-drive"]');
    if (provider) provider.classList.toggle("is-connected", value.indexOf("Connected") !== -1);
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
    if (!value) return "";
    var date = new Date(value);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(undefined,{year:"numeric",month:"short",day:"numeric"}).format(date) : "";
  }
  function isFolder(item) { return item.mimeType === "application/vnd.google-apps.folder"; }
  function iconFor(item) {
    var mime = item.mimeType || "", name = item.name || "";
    if (isFolder(item)) return "▰";
    if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "PDF";
    if (/wordprocessingml|msword/.test(mime) || /\.(docx?|rtf)$/i.test(name)) return "W";
    if (/spreadsheet|excel|csv/.test(mime) || /\.(xlsx?|xlsm|csv)$/i.test(name)) return "▦";
    if (/presentation|powerpoint/.test(mime) || /\.pptx?$/i.test(name)) return "P";
    if (/^image\//.test(mime) || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return "▧";
    if (/^video\//.test(mime)) return "▶";
    if (/^audio\//.test(mime)) return "♫";
    if (/^text\//.test(mime) || /\.(txt|md|json|xml|js|css|html)$/i.test(name)) return "≡";
    if (/^application\/vnd\.google-apps\./.test(mime)) return "G";
    return "▤";
  }
  function isGoogleWorkspace(mime) {
    return /^application\/vnd\.google-apps\.(document|spreadsheet|presentation|drawing)$/.test(mime || "");
  }

  function descriptor(item) {
    var id = item.shortcutDetails && item.shortcutDetails.targetId || item.id;
    var mime = item.shortcutDetails && item.shortcutDetails.targetMimeType || item.mimeType;
    var googleDoc = isGoogleWorkspace(mime);
    var name = googleDoc ? String(item.name).replace(/\.[^.]+$/,"") + ".pdf" : item.name;
    return {
      id:id, name:name, mimeType:googleDoc ? "application/pdf" : mime,
      size:Number(item.size) || undefined, provider:"Google Drive",
      getBlob:function (options) { return downloadFile(id,mime,options && options.signal); }
    };
  }

  async function apiJson(url, signal) {
    var response, raw, body;
    try { response = await fetch(url,{method:"GET",credentials:"omit",signal:signal}); }
    catch (error) {
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
        message = "The current Firebase API key is not authorised for Drive API. Configure a Drive-enabled, HTTP-referrer-restricted API key in Google Cloud Console.";
      } else if (response.status === 404 || /File not found/i.test(message)) {
        message = "The folder was not found or is not publicly viewable. Check the folder ID and set General access to Anyone with the link — Viewer.";
      } else if (response.status === 401 || response.status === 403) {
        message = "Drive denied public read access. Set General access to Anyone with the link — Viewer. A private folder needs Google OAuth instead.";
      }
      throw new Error(message);
    }
    return body;
  }

  async function listFolder(folderId, pageToken, signal) {
    var url = new URL(API_ROOT + "/files");
    url.searchParams.set("q","'" + folderId + "' in parents and trashed = false");
    url.searchParams.set("pageSize",String(PAGE_SIZE));
    url.searchParams.set("orderBy","folder,name");
    url.searchParams.set("fields","nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,shortcutDetails(targetId,targetMimeType))");
    url.searchParams.set("key",apiKey());
    if (pageToken) url.searchParams.set("pageToken",pageToken);
    return apiJson(url.toString(),signal);
  }

  async function downloadFile(fileId,mimeType,signal) {
    var url = new URL(API_ROOT + "/files/" + encodeURIComponent(fileId));
    if (isGoogleWorkspace(mimeType)) {
      url.pathname += "/export";
      url.searchParams.set("mimeType","application/pdf");
    } else {
      url.searchParams.set("alt","media");
    }
    url.searchParams.set("key",apiKey());
    var response;
    try { response = await fetch(url.toString(),{method:"GET",credentials:"omit",signal:signal}); }
    catch (error) {
      if (error && error.name === "AbortError") throw error;
      throw new Error("Could not download this item from Google Drive. Check sharing permission and API access.");
    }
    if (!response.ok) {
      var message = "Drive could not provide the file content (HTTP " + response.status + ").";
      try { var body = await response.json(); if (body.error && body.error.message) message = body.error.message; } catch (error) {}
      throw new Error(message);
    }
    return response.blob();
  }

  function button(label,className,action) {
    var el=document.createElement("button");
    el.type="button"; el.className=className; el.textContent=label; el.dataset.driveAction=action;
    return el;
  }
  function showMessage(title,message,isError) {
    var content=contentEl(); if(!content) return;
    content.innerHTML="";
    var wrap=document.createElement("div"); wrap.className="ja-lib-empty ja-drive-empty";
    var icon=document.createElement("div"); icon.className="ja-lib-empty-symbol"; icon.textContent=isError?"!":"▤";
    var heading=document.createElement("strong"); heading.className="ja-lib-empty-title"; heading.textContent=title;
    var p=document.createElement("p"); p.className="ja-lib-empty-description"; p.textContent=message;
    wrap.append(icon,heading,p);
    if(isError) wrap.appendChild(button("Retry connection","ja-drive-button primary","retry"));
    content.appendChild(wrap);
  }
  function bindSearch() {
    var search=searchEl();
    if(!search || searchBound) return;
    search.addEventListener("input",renderRows);
    searchBound=true;
  }

  function openRoot() {
    if(activeController) activeController.abort();
    requestSerial++; loading=false;
    stack=[{id:ROOT.id,name:ROOT.name}]; files=[]; nextPageToken=null;
    clearSelection(); bindSearch(); setStatus("Google Drive · Connecting…"); setNotice("");
    showMessage("Connecting to Google Drive","Reading the shared folder in read-only mode. Files will not be changed.",false);
    return loadCurrent(false);
  }

  async function loadCurrent(append) {
    if(loading || !stack.length) return;
    loading=true;
    if(activeController) activeController.abort();
    activeController=new AbortController();
    var controller=activeController, serial=++requestSerial, folder=stack[stack.length-1];
    if(!append) { files=[]; nextPageToken=null; showMessage("Loading folder…","Fetching file names and metadata from Google Drive.",false); }
    try {
      var result=await listFolder(folder.id,append?nextPageToken:null,controller.signal);
      if(serial!==requestSerial) return;
      files=append?files.concat(result.files||[]):(result.files||[]);
      nextPageToken=result.nextPageToken||null;
      setStatus("Google Drive · Connected · Read only"); setNotice("");
      renderBrowser();
    } catch(error) {
      if(error && error.name==="AbortError") return;
      if(serial!==requestSerial) return;
      setStatus("Google Drive · Connection needs attention");
      showMessage("Google Drive could not be connected",error.message||"Check the folder sharing and API settings.",true);
    } finally { if(serial===requestSerial) loading=false; }
  }

  function renderBrowser() {
    var content=contentEl(); if(!content) return;
    content.innerHTML="";
    var browser=document.createElement("div"); browser.className="ja-drive-browser";
    var toolbar=document.createElement("div"); toolbar.className="ja-drive-toolbar";
    var crumbs=document.createElement("div"); crumbs.className="ja-drive-breadcrumb";
    stack.forEach(function(folder,index){
      if(index){var sep=document.createElement("span");sep.className="ja-drive-crumb-separator";sep.textContent="›";crumbs.appendChild(sep);}
      var crumb=button(folder.name,"ja-drive-crumb","crumb");
      crumb.dataset.index=String(index);crumb.disabled=index===stack.length-1;crumbs.appendChild(crumb);
    });
    var refresh=button("↻","ja-drive-refresh","refresh");refresh.title="Refresh folder";refresh.setAttribute("aria-label","Refresh folder");
    toolbar.append(crumbs,refresh);browser.appendChild(toolbar);

    var list=document.createElement("div");list.className="ja-drive-list";list.setAttribute("role","list");
    browser.appendChild(list);
    var query=(searchEl()&&searchEl().value||"").trim().toLocaleLowerCase();
    var visible=files.filter(function(item){return !query||String(item.name||"").toLocaleLowerCase().includes(query);})
      .sort(function(a,b){return (Number(isFolder(b))-Number(isFolder(a)))||String(a.name||"").localeCompare(String(b.name||""));});
    if(!visible.length){
      var empty=document.createElement("div");empty.className="ja-drive-no-files";
      empty.textContent=query?"No files match your search.":"This folder is empty, or its contents are not visible to link viewers.";
      list.appendChild(empty);
    }
    visible.forEach(function(item){
      var folder=isFolder(item), row=document.createElement("button");
      row.type="button";row.className="ja-drive-row"+(item.id===selectedId?" selected":"");
      row.dataset.fileId=item.id;row.setAttribute("role","listitem");
      var icon=document.createElement("span");icon.className="ja-drive-file-icon";icon.textContent=iconFor(item);
      var wrap=document.createElement("span");wrap.className="ja-drive-file-name";
      var name=document.createElement("strong");name.textContent=item.name||"Untitled";
      var meta=document.createElement("small");meta.textContent=folder?"Folder":(formatDate(item.modifiedTime)||"Google Drive file");
      wrap.append(name,meta);
      var size=document.createElement("span");size.className="ja-drive-file-size";size.textContent=folder?"":formatBytes(item.size);
      var arrow=document.createElement("span");arrow.className="ja-drive-row-chevron";arrow.textContent=folder?"›":"";
      row.append(icon,wrap,size,arrow);
      row.addEventListener("click",function(){
        if(folder){stack.push({id:item.id,name:item.name||"Folder"});clearSelection();loadCurrent(false);return;}
        selectedId=item.id;
        if(window.JupiterReferenceLibrary) window.JupiterReferenceLibrary.setSelectedFile(descriptor(item));
        renderRows();
      });
      row.addEventListener("dblclick",function(){
        if(!folder && window.JupiterReferenceLibrary) window.JupiterReferenceLibrary.preview(descriptor(item));
      });
      list.appendChild(row);
    });
    if(nextPageToken){var more=document.createElement("div");more.className="ja-drive-more-wrap";more.appendChild(button("Load more files","ja-drive-button","more"));browser.appendChild(more);}
    content.appendChild(browser);
  }
  function renderRows(){renderBrowser();}

  function onContentClick(event) {
    var target=event.target.closest("[data-drive-action]");
    if(!target||target.disabled)return;
    var action=target.dataset.driveAction;
    if(action==="refresh"||action==="retry")loadCurrent(false);
    if(action==="more")loadCurrent(true);
    if(action==="crumb"){
      var index=Number(target.dataset.index);
      if(Number.isInteger(index)&&index>=0&&index<stack.length-1){stack=stack.slice(0,index+1);clearSelection();loadCurrent(false);}
    }
  }
  function init(){
    var content=contentEl();
    if(content&&!content.dataset.driveBound){content.addEventListener("click",onContentClick);content.dataset.driveBound="true";}
  }
  function clear(){
    if(activeController)activeController.abort();
    requestSerial++;loading=false;stack=[];files=[];nextPageToken=null;selectedId=null;
    var provider=document.querySelector('#ja-reference-library-window [data-ja-provider="google-drive"]');
    if(provider)provider.classList.remove("is-connected");
    clearSelection();
  }

  window.JupiterLibraryDrive={
    openRoot:function(){init();return openRoot();},
    clear:clear,
    refresh:function(){return stack.length?loadCurrent(false):openRoot();},
    getFolderId:function(){return ROOT.id;},
    getStatus:function(){return {folderId:ROOT.id,loadedFiles:files.length,connected:stack.length>0};}
  };
  console.info("Jupiter Astro: Google Drive public-folder connector loaded.");
})();