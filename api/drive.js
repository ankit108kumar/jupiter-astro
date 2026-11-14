"use strict";

const { createSign } = require("node:crypto");
const { Readable } = require("node:stream");

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ROOT_FOLDER_ID = "10ZkA2yVR0xHS9qpWpBRLjOKOCWIrzsNj";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const MAX_FOLDER_DEPTH = 30;

const EXPORTS = {
  "application/vnd.google-apps.document": {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: ".docx"
  },
  "application/vnd.google-apps.spreadsheet": {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: ".xlsx"
  },
  "application/vnd.google-apps.presentation": {
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: ".pptx"
  },
  "application/vnd.google-apps.drawing": {
    mimeType: "application/pdf",
    extension: ".pdf"
  }
};

let cachedAccessToken = null;
let tokenExpiresAt = 0;
let tokenPromise = null;

function sendError(res, status, message) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json({ error: message });
}

function getCredentials() {
  const email = String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const privateKey = String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY || "")
    .replace(/\\n/g, "\n")
    .trim();

  if (!email || !privateKey || !privateKey.includes("BEGIN PRIVATE KEY")) {
    const error = new Error(
      "Google Drive preview needs server credentials. Add GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL and GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY to Vercel, then redeploy."
    );
    error.statusCode = 503;
    throw error;
  }
  return { email, privateKey };
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

async function getAccessToken() {
  if (cachedAccessToken && tokenExpiresAt > Date.now() + 60000) {
    return cachedAccessToken;
  }
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async function () {
    const credentials = getCredentials();
    const now = Math.floor(Date.now() / 1000);
    const unsigned =
      base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
      base64Url(JSON.stringify({
        iss: credentials.email,
        scope: DRIVE_SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600
      }));

    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const assertion = unsigned + "." + signer.sign(credentials.privateKey, "base64url");

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.access_token) {
      console.error("Drive service-account authentication failed:", response.status, data.error || "");
      const error = new Error(
        "Google could not authenticate the Library service account. Check the service-account email and private key in Vercel."
      );
      error.statusCode = 502;
      throw error;
    }

    cachedAccessToken = data.access_token;
    tokenExpiresAt = Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000;
    return cachedAccessToken;
  })();

  try {
    return await tokenPromise;
  } finally {
    tokenPromise = null;
  }
}

function buildUrl(path, params) {
  const url = new URL(DRIVE_API + path);
  Object.keys(params || {}).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      url.searchParams.set(key, String(params[key]));
    }
  });
  return url;
}

function resourceKeyHeader(fileId, resourceKey) {
  return resourceKey
    ? { "X-Goog-Drive-Resource-Keys": fileId + "/" + resourceKey }
    : {};
}

async function getMetadata(fileId, token, resourceKey) {
  const url = buildUrl("/files/" + encodeURIComponent(fileId), {
    supportsAllDrives: "true",
    fields: "id,name,mimeType,parents,resourceKey,shortcutDetails(targetId,targetMimeType,targetResourceKey),capabilities(canDownload),size,modifiedTime,webViewLink"
  });
  const response = await fetch(url.toString(), {
    headers: Object.assign(
      { Authorization: "Bearer " + token, Accept: "application/json" },
      resourceKeyHeader(fileId, resourceKey)
    )
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error && body.error.message || "Google Drive metadata request failed.");
    error.statusCode = response.status;
    throw error;
  }
  return body;
}

async function assertInsideLibrary(fileId, token, resourceKey) {
  let currentId = fileId;
  let currentKey = resourceKey || "";
  const visited = new Set();

  for (let depth = 0; depth < MAX_FOLDER_DEPTH; depth++) {
    if (currentId === ROOT_FOLDER_ID) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const metadata = await getMetadata(currentId, token, currentKey);
    const parents = Array.isArray(metadata.parents) ? metadata.parents : [];
    if (parents.includes(ROOT_FOLDER_ID)) return true;
    if (!parents.length) return false;

    currentId = parents[0];
    currentKey = "";
  }
  return false;
}

function safeFilename(value) {
  return String(value || "drive-file")
    .replace(/[\r\n"\\/]/g, "_")
    .slice(0, 180) || "drive-file";
}

async function downloadFile(req, res, token) {
  const fileId = String(req.query.fileId || "").trim();
  const resourceKey = String(req.query.resourceKey || "").trim();

  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) {
    return sendError(res, 400, "Invalid Google Drive file identifier.");
  }

  if (!(await assertInsideLibrary(fileId, token, resourceKey))) {
    return sendError(res, 403, "This file is not inside the configured Jupiter Astrology Library folder.");
  }

  let metadata = await getMetadata(fileId, token, resourceKey);
  if (metadata.mimeType === "application/vnd.google-apps.shortcut" &&
      metadata.shortcutDetails && metadata.shortcutDetails.targetId) {
    const shortcut = metadata.shortcutDetails;
    const targetId = shortcut.targetId;
    const targetKey = shortcut.targetResourceKey || "";
    if (!(await assertInsideLibrary(targetId, token, targetKey))) {
      return sendError(res, 403, "This shortcut points to a file outside the configured Library folder.");
    }
    metadata = await getMetadata(targetId, token, targetKey);
  }

  if (metadata.capabilities && metadata.capabilities.canDownload === false) {
    return sendError(res, 403, "The file owner has disabled downloading. Open this item in Google Drive instead.");
  }

  const exportInfo = EXPORTS[metadata.mimeType] || null;
  const url = exportInfo
    ? buildUrl("/files/" + encodeURIComponent(metadata.id) + "/export", { mimeType: exportInfo.mimeType })
    : buildUrl("/files/" + encodeURIComponent(metadata.id), { alt: "media", supportsAllDrives: "true" });

  const headers = { Authorization: "Bearer " + token };
  if (metadata.resourceKey) {
    headers["X-Goog-Drive-Resource-Keys"] = metadata.id + "/" + metadata.resourceKey;
  }

  const upstream = await fetch(url.toString(), { method: "GET", headers });
  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    const message = body.error && body.error.message || "Google Drive could not return this file.";
    if (exportInfo && /10.?MB|export.*size|file.*too large/i.test(message)) {
      return sendError(res, 413, "Google Drive limits native Docs, Sheets and Slides exports to 10 MB. Open this file in Google Drive instead.");
    }
    console.error("Drive file content request failed:", upstream.status, message);
    return sendError(
      res,
      upstream.status === 403 ? 403 : upstream.status === 404 ? 404 : 502,
      upstream.status === 403
        ? "The Library service account does not have Viewer/download access to this file. Share the Library folder with its service-account email as Viewer."
        : message
    );
  }

  if (!upstream.body) {
    return sendError(res, 502, "Google Drive returned an empty file stream.");
  }

  const filename = exportInfo
    ? safeFilename(String(metadata.name || "document").replace(/\.[^.]+$/, "") + exportInfo.extension)
    : safeFilename(metadata.name || "drive-file");

  res.statusCode = 200;
  res.setHeader("Content-Type", exportInfo ? exportInfo.mimeType : upstream.headers.get("content-type") || "application/octet-stream");
  res.setHeader("Content-Disposition", "inline; filename*=UTF-8''" + encodeURIComponent(filename));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const length = upstream.headers.get("content-length");
  if (length) res.setHeader("Content-Length", length);

  // Stream binary content to avoid buffering large files in the function.
  Readable.fromWeb(upstream.body).on("error", (error) => {
    console.error("Drive response stream failed:", error.message);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end("Google Drive stream failed.");
    } else {
      res.destroy(error);
    }
  }).pipe(res);
}


async function convertDocxToPdf(req, res, token) {
  const fileId = String(req.query.fileId || "").trim();
  const resourceKey = String(req.query.resourceKey || "").trim();

  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) {
    return sendError(res, 400, "Invalid Google Drive file identifier.");
  }

  const converterBase = String(process.env.DOCX_PDF_CONVERTER_URL || "").trim().replace(/\/+$/, "");
  const converterUser = String(process.env.DOCX_PDF_CONVERTER_USERNAME || "").trim();
  const converterPassword = String(process.env.DOCX_PDF_CONVERTER_PASSWORD || "");

  if (!converterBase || !converterUser || !converterPassword) {
    return sendError(
      res,
      503,
      "The DOCX-to-PDF option is not configured yet. Deploy the private LibreOffice converter and set DOCX_PDF_CONVERTER_URL, DOCX_PDF_CONVERTER_USERNAME and DOCX_PDF_CONVERTER_PASSWORD in Vercel."
    );
  }

  let converterUrl;
  try {
    converterUrl = new URL(converterBase);
    if (converterUrl.protocol !== "https:") throw new Error("HTTPS required.");
  } catch (error) {
    return sendError(res, 503, "DOCX PDF converter URL must be a valid HTTPS URL.");
  }

  if (!(await assertInsideLibrary(fileId, token, resourceKey))) {
    return sendError(res, 403, "This file is not inside the configured Jupiter Astrology Library folder.");
  }

  let metadata = await getMetadata(fileId, token, resourceKey);
  if (metadata.mimeType === "application/vnd.google-apps.shortcut" &&
      metadata.shortcutDetails && metadata.shortcutDetails.targetId) {
    const shortcut = metadata.shortcutDetails;
    const targetId = shortcut.targetId;
    const targetKey = shortcut.targetResourceKey || "";
    if (!(await assertInsideLibrary(targetId, token, targetKey))) {
      return sendError(res, 403, "This shortcut points to a file outside the configured Library folder.");
    }
    metadata = await getMetadata(targetId, token, targetKey);
  }

  const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
  const isGoogleDoc = metadata.mimeType === GOOGLE_DOC_MIME;
  if (!isGoogleDoc && metadata.mimeType !== DOCX_MIME && !/\.docx$/i.test(metadata.name || "")) {
    return sendError(res, 415, "PDF conversion is currently available for Word DOCX files only.");
  }
  if (metadata.capabilities && metadata.capabilities.canDownload === false) {
    return sendError(res, 403, "The file owner has disabled downloading. This DOCX cannot be converted.");
  }

  const driveFileUrl = isGoogleDoc
    ? buildUrl("/files/" + encodeURIComponent(metadata.id) + "/export", {
        mimeType: DOCX_MIME
      })
    : buildUrl("/files/" + encodeURIComponent(metadata.id), {
        alt: "media",
        supportsAllDrives: "true"
      });
  const driveHeaders = { Authorization: "Bearer " + token };
  if (metadata.resourceKey) {
    driveHeaders["X-Goog-Drive-Resource-Keys"] = metadata.id + "/" + metadata.resourceKey;
  }

  const source = await fetch(driveFileUrl.toString(), {
    method: "GET",
    headers: driveHeaders
  });
  if (!source.ok) {
    const body = await source.json().catch(() => ({}));
    return sendError(
      res,
      source.status === 403 ? 403 : source.status === 404 ? 404 : 502,
      body.error && body.error.message || "Google Drive could not retrieve the original DOCX."
    );
  }

  const contentLength = Number(source.headers.get("content-length") || 0);
  const maxDocxBytes = 50 * 1024 * 1024;
  if (contentLength > maxDocxBytes) {
    return sendError(res, 413, "This DOCX exceeds the 50 MB conversion limit.");
  }

  const fileBytes = Buffer.from(await source.arrayBuffer());
  if (!fileBytes.length) return sendError(res, 502, "Google Drive returned an empty DOCX.");
  if (fileBytes.length > maxDocxBytes) {
    return sendError(res, 413, "This DOCX exceeds the 50 MB conversion limit.");
  }

  let sourceFilename = metadata.name || "document";
  if (!/\.docx$/i.test(sourceFilename)) sourceFilename += ".docx";
  const filename = safeFilename(sourceFilename);
  const form = new FormData();
  form.append("files", new Blob([fileBytes], { type: DOCX_MIME }), filename);

  const basicAuth = Buffer.from(converterUser + ":" + converterPassword).toString("base64");
  const conversionEndpoint = converterBase + "/forms/libreoffice/convert";

  let converted;
  try {
    converted = await fetch(conversionEndpoint, {
      method: "POST",
      headers: {
        Authorization: "Basic " + basicAuth,
        Accept: "application/pdf"
      },
      body: form,
      signal: AbortSignal.timeout(240000)
    });
  } catch (error) {
    console.error("DOCX PDF conversion service request failed:", error && error.message);
    return sendError(res, 502, "The LibreOffice conversion service could not be reached or timed out.");
  }

  if (!converted.ok) {
    const responseText = await converted.text();
    console.error("Gotenberg conversion failed:", converted.status, responseText.slice(0, 1200));
    return sendError(
      res,
      converted.status === 401 ? 502 : 502,
      converted.status === 401
        ? "The LibreOffice conversion service rejected its server credentials. Check the converter username and password in Vercel."
        : "LibreOffice could not convert this DOCX to PDF. Check the document and converter service logs."
    );
  }

  const contentType = converted.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/pdf")) {
    const responseText = await converted.text();
    console.error("Unexpected Gotenberg response:", contentType, responseText.slice(0, 500));
    return sendError(res, 502, "The conversion service did not return a PDF file.");
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    "inline; filename*=UTF-8''" + encodeURIComponent(String(metadata.name || "document").replace(/\.docx$/i, ".pdf"))
  );
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const resultLength = converted.headers.get("content-length");
  if (resultLength) res.setHeader("Content-Length", resultLength);

  if (!converted.body) {
    return sendError(res, 502, "The conversion service returned an empty PDF stream.");
  }
  Readable.fromWeb(converted.body).on("error", (error) => {
    console.error("Converted PDF response stream failed:", error.message);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end("Converted PDF stream failed.");
    } else {
      res.destroy(error);
    }
  }).pipe(res);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "Method not allowed.");
  }

  try {
    const action = String(req.query.action || "");
    if (action !== "download" && action !== "status" && action !== "convert-docx") {
      return sendError(res, 400, "Unsupported Drive action.");
    }
    const token = await getAccessToken();

    if (action === "convert-docx") {
      return await convertDocxToPdf(req, res, token);
    }

    if (action === "status") {
      const root = await getMetadata(ROOT_FOLDER_ID, token);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        configured: true,
        folderId: ROOT_FOLDER_ID,
        folderName: root.name || "Shared Astrology Library",
        permission: "Drive read-only"
      });
    }

    return await downloadFile(req, res, token);
  } catch (error) {
    const status = Number(error && error.statusCode) || 502;
    console.error("Jupiter Drive preview endpoint:", status, error && error.message);

    if (status === 503) return sendError(res, 503, error.message);
    if (status === 403) {
      return sendError(res, 403, "The service account cannot access this file. Share the configured Library folder with the service-account email as Viewer.");
    }
    if (status === 404) return sendError(res, 404, "Google Drive could not find this file. It may have been moved or deleted.");
    return sendError(res, status >= 400 && status < 500 ? status : 502, error.message || "Google Drive preview request failed.");
  }
};
