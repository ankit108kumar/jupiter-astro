"use strict";

const { createSign, createHmac, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } = require("node:crypto");
const { Readable } = require("node:stream");

const FIREBASE_LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DROPBOX_AUTHORIZE_URL = "https://www.dropbox.com/oauth2/authorize";
const DROPBOX_TOKEN_URL = "https://api.dropbox.com/oauth2/token";
const DROPBOX_API_URL = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT_URL = "https://content.dropboxapi.com/2";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const FIRESTORE_COLLECTION = "dropboxConnections";
const FIREBASE_API_KEY = "AIzaSyDwXS689Y4gdyuD9-3ThCwsDiSHkyuNFpU";
const DEFAULT_REDIRECT_URI = "https://jupiterastrology108.com/api/dropbox";
const DEFAULT_POST_CONNECT_URL = "https://jupiterastrology108.com/8a9K79m85R0t2B7x6C7p48n8V16d0J85.html";
const STATE_COOKIE = "ja_dropbox_oauth";
const STATE_TTL_SECONDS = 600;
const MAX_DOWNLOAD_BYTES = 150 * 1024 * 1024;

let googleAccessToken = null;
let googleAccessTokenExpiresAt = 0;
let googleTokenPromise = null;

function sendJson(res, status, body) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json(body);
}

function sendError(res, status, message) {
  return sendJson(res, status, { error: message });
}

function requestUrl(req) {
  return new URL(req.url || "/", "https://jupiterastrology108.com");
}

function getAction(req) {
  const url = requestUrl(req);
  return String((req.query && req.query.action) || url.searchParams.get("action") || "");
}

function getQuery(req, name) {
  const value = req.query && req.query[name];
  if (Array.isArray(value)) return String(value[0] || "");
  return String(value || requestUrl(req).searchParams.get(name) || "");
}

function parseCookies(req) {
  const raw = String(req.headers && req.headers.cookie || "");
  const cookies = Object.create(null);
  raw.split(";").forEach(function (part) {
    const index = part.indexOf("=");
    if (index < 0) return;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { cookies[name] = decodeURIComponent(value); } catch (error) { cookies[name] = value; }
  });
  return cookies;
}

function setStateCookie(res, value, maxAge) {
  const parts = [
    STATE_COOKIE + "=" + encodeURIComponent(value || ""),
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=" + String(maxAge)
  ];
  res.setHeader("Set-Cookie", parts.join("; "));
}

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    const error = new Error("Missing Vercel environment variable: " + name);
    error.statusCode = 503;
    throw error;
  }
  return value;
}

function getDropboxConfig() {
  return {
    appKey: requiredEnv("DROPBOX_APP_KEY"),
    appSecret: requiredEnv("DROPBOX_APP_SECRET"),
    redirectUri: String(process.env.DROPBOX_REDIRECT_URI || DEFAULT_REDIRECT_URI).trim(),
    postConnectUrl: String(process.env.DROPBOX_POST_CONNECT_URL || DEFAULT_POST_CONNECT_URL).trim()
  };
}

function getEncryptionKey() {
  const value = requiredEnv("DROPBOX_TOKEN_ENCRYPTION_KEY");
  let key;
  if (/^[a-f0-9]{64}$/i.test(value)) key = Buffer.from(value, "hex");
  else key = Buffer.from(value, "base64");
  if (key.length !== 32) {
    const error = new Error("DROPBOX_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex characters or base64).");
    error.statusCode = 503;
    throw error;
  }
  return key;
}

function encryptRefreshToken(refreshToken) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(refreshToken), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", b64url(iv), b64url(tag), b64url(ciphertext)].join(".");
}

function decryptRefreshToken(value) {
  const parts = String(value || "").split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    const error = new Error("The saved Dropbox credential has an unsupported format. Disconnect and reconnect Dropbox.");
    error.statusCode = 503;
    throw error;
  }
  const key = getEncryptionKey();
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const ciphertext = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

async function verifyFirebaseUser(req) {
  const authorization = String(req.headers && req.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error("Please log in to use Dropbox.");
    error.statusCode = 401;
    throw error;
  }

  const response = await fetch(FIREBASE_LOOKUP_URL + "?key=" + encodeURIComponent(process.env.FIREBASE_WEB_API_KEY || FIREBASE_API_KEY), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ idToken: match[1] }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  const user = Array.isArray(data.users) && data.users[0];
  if (!response.ok || !user || !user.localId) {
    const error = new Error("Your login session has expired. Please log in again.");
    error.statusCode = 401;
    throw error;
  }
  if (user.emailVerified === false) {
    const error = new Error("Please verify your email address before connecting Dropbox.");
    error.statusCode = 403;
    throw error;
  }
  return { uid: user.localId, email: user.email || "" };
}

function getGoogleServiceAccount() {
  const email = String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const privateKey = String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY || "")
    .replace(/\\n/g, "\n").trim();
  if (!email || !privateKey || !privateKey.includes("BEGIN PRIVATE KEY")) {
    const error = new Error("Firestore token storage needs GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL and GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY in Vercel.");
    error.statusCode = 503;
    throw error;
  }
  return { email, privateKey };
}

async function getGoogleFirestoreToken() {
  if (googleAccessToken && googleAccessTokenExpiresAt > Date.now() + 60000) return googleAccessToken;
  if (googleTokenPromise) return googleTokenPromise;

  googleTokenPromise = (async function () {
    const account = getGoogleServiceAccount();
    const now = Math.floor(Date.now() / 1000);
    const unsigned = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
      b64url(JSON.stringify({
        iss: account.email,
        scope: FIRESTORE_SCOPE,
        aud: GOOGLE_TOKEN_URL,
        iat: now,
        exp: now + 3600
      }));
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const assertion = unsigned + "." + signer.sign(account.privateKey, "base64url");
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: assertion
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      console.error("Dropbox Firestore service-account authentication failed:", response.status, data.error || "");
      const error = new Error("Google could not authenticate the Library service account for Firestore. Check its key and IAM permission.");
      error.statusCode = 503;
      throw error;
    }
    googleAccessToken = data.access_token;
    googleAccessTokenExpiresAt = Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000;
    return googleAccessToken;
  })();

  try {
    return await googleTokenPromise;
  } finally {
    googleTokenPromise = null;
  }
}

function firestoreDocumentUrl(uid) {
  const projectId = String(process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "jupiter-astro").trim();
  return "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) +
    "/databases/(default)/documents/" + FIRESTORE_COLLECTION + "/" + encodeURIComponent(uid);
}

async function firestoreRequest(url, options) {
  const token = await getGoogleFirestoreToken();
  const response = await fetch(url, Object.assign({
    headers: Object.assign({
      Authorization: "Bearer " + token,
      Accept: "application/json"
    }, options && options.body ? { "Content-Type": "application/json" } : {}),
    signal: AbortSignal.timeout(20000)
  }, options || {}));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Dropbox Firestore request failed:", response.status, data.error && data.error.status || "");
    if (response.status === 404) return { notFound: true };
    const error = new Error(
      response.status === 403
        ? "Firestore denied access. Enable Cloud Firestore and grant the Google service account the Cloud Datastore User role."
        : response.status === 404
          ? "Cloud Firestore database is not configured. Create the default Firestore database in the jupiter-astro project."
          : "Secure Dropbox token storage failed. Check Firestore setup and service-account permissions."
    );
    error.statusCode = response.status === 403 ? 503 : 503;
    throw error;
  }
  return data;
}

function firestoreString(document, name) {
  return document && document.fields && document.fields[name]
    ? String(document.fields[name].stringValue || "")
    : "";
}

async function getStoredConnection(uid) {
  const result = await firestoreRequest(firestoreDocumentUrl(uid), { method: "GET" });
  if (result.notFound) return null;
  const encrypted = firestoreString(result, "encryptedRefreshToken");
  if (!encrypted) return null;
  return {
    refreshToken: decryptRefreshToken(encrypted),
    accountId: firestoreString(result, "accountId"),
    connectedAt: firestoreString(result, "connectedAt")
  };
}

async function saveStoredConnection(uid, refreshToken, accountId) {
  const documentUrl = firestoreDocumentUrl(uid);
  const body = {
    fields: {
      encryptedRefreshToken: { stringValue: encryptRefreshToken(refreshToken) },
      accountId: { stringValue: String(accountId || "") },
      connectedAt: { stringValue: new Date().toISOString() },
      provider: { stringValue: "dropbox" }
    }
  };

  const created = await firestoreRequest(
    "https://firestore.googleapis.com/v1/projects/" +
      encodeURIComponent(String(process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "jupiter-astro")) +
      "/databases/(default)/documents/" + FIRESTORE_COLLECTION + "?documentId=" + encodeURIComponent(uid),
    { method: "POST", body: JSON.stringify(body) }
  );
  if (!created.notFound) return;

  // The helper returns notFound only for 404. A create request normally
  // returns 409 if this user has already connected Dropbox.
}

async function upsertStoredConnection(uid, refreshToken, accountId) {
  const projectId = String(process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "jupiter-astro").trim();
  const collectionUrl = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) +
    "/databases/(default)/documents/" + FIRESTORE_COLLECTION + "?documentId=" + encodeURIComponent(uid);
  const body = {
    fields: {
      encryptedRefreshToken: { stringValue: encryptRefreshToken(refreshToken) },
      accountId: { stringValue: String(accountId || "") },
      connectedAt: { stringValue: new Date().toISOString() },
      provider: { stringValue: "dropbox" }
    }
  };
  const token = await getGoogleFirestoreToken();
  const createResponse = await fetch(collectionUrl, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  });
  if (createResponse.ok) return;
  if (createResponse.status !== 409) {
    const data = await createResponse.json().catch(() => ({}));
    console.error("Dropbox Firestore create failed:", createResponse.status, data.error && data.error.status || "");
    throw new Error("Could not save the secure Dropbox connection. Check Firestore configuration and service-account permissions.");
  }

  const patchUrl = documentUrlWithMask(uid, projectId);
  const patchResponse = await fetch(patchUrl, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  });
  if (!patchResponse.ok) {
    const data = await patchResponse.json().catch(() => ({}));
    console.error("Dropbox Firestore update failed:", patchResponse.status, data.error && data.error.status || "");
    throw new Error("Could not update the secure Dropbox connection.");
  }
}

function documentUrlWithMask(uid, projectId) {
  const url = new URL(firestoreDocumentUrl(uid));
  url.searchParams.append("updateMask.fieldPaths", "encryptedRefreshToken");
  url.searchParams.append("updateMask.fieldPaths", "accountId");
  url.searchParams.append("updateMask.fieldPaths", "connectedAt");
  url.searchParams.append("updateMask.fieldPaths", "provider");
  return url.toString();
}

async function deleteStoredConnection(uid) {
  const response = await firestoreRequest(firestoreDocumentUrl(uid), { method: "DELETE" });
  return !response.notFound;
}

function createSignedState(uid) {
  const secret = requiredEnv("DROPBOX_STATE_SECRET");
  const data = {
    state: randomBytes(24).toString("hex"),
    uid: uid,
    expiresAt: Date.now() + STATE_TTL_SECONDS * 1000
  };
  const payload = b64url(JSON.stringify(data));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return { state: data.state, cookie: payload + "." + signature };
}

function verifySignedState(cookieValue, state) {
  const secret = requiredEnv("DROPBOX_STATE_SECRET");
  const parts = String(cookieValue || "").split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", secret).update(parts[0]).digest("base64url");
  if (!constantTimeEqual(expected, parts[1])) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!data.uid || !data.state || data.expiresAt < Date.now() || !constantTimeEqual(data.state, state)) return null;
    return data;
  } catch (error) {
    return null;
  }
}

async function exchangeDropboxCode(code, config) {
  const body = new URLSearchParams({
    code: code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri
  });
  const basic = Buffer.from(config.appKey + ":" + config.appSecret).toString("base64");
  const response = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + basic,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: body,
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token || !data.refresh_token) {
    console.error("Dropbox authorization-code exchange failed:", response.status, data.error || "");
    const error = new Error("Dropbox could not complete authorization. Check the registered Redirect URI and app credentials.");
    error.statusCode = 502;
    throw error;
  }
  return data;
}

async function refreshDropboxAccessToken(refreshToken, config) {
  const basic = Buffer.from(config.appKey + ":" + config.appSecret).toString("base64");
  const response = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + basic,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }),
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    console.error("Dropbox refresh-token request failed:", response.status, data.error || "");
    if (response.status === 400 || response.status === 401) {
      const error = new Error("Dropbox authorization has expired or was revoked. Reconnect Dropbox.");
      error.statusCode = 401;
      throw error;
    }
    const error = new Error("Dropbox could not refresh its access token.");
    error.statusCode = 502;
    throw error;
  }
  return data.access_token;
}

async function getDropboxAccessToken(uid) {
  const config = getDropboxConfig();
  const stored = await getStoredConnection(uid);
  if (!stored) {
    const error = new Error("Dropbox is not connected. Choose Connect Dropbox to authorize this account.");
    error.statusCode = 409;
    throw error;
  }
  const accessToken = await refreshDropboxAccessToken(stored.refreshToken, config);
  return { accessToken: accessToken, accountId: stored.accountId, connectedAt: stored.connectedAt };
}

function safeFilename(value) {
  return String(value || "dropbox-file").replace(/[\r\n"\\/]/g, "_").slice(0, 180) || "dropbox-file";
}

function mapDropboxEntry(entry) {
  const tag = entry[".tag"];
  const folder = tag === "folder";
  return {
    id: String(entry.id || entry.path_lower || entry.path_display || ""),
    path: String(entry.path_lower || entry.path_display || ""),
    pathDisplay: String(entry.path_display || ""),
    name: String(entry.name || "Untitled"),
    mimeType: folder ? "application/vnd.google-apps.folder" : "application/octet-stream",
    size: folder ? 0 : Number(entry.size) || 0,
    modifiedTime: String(entry.server_modified || entry.client_modified || ""),
    isFolder: folder
  };
}

async function dropboxApiJson(endpoint, accessToken, body) {
  const response = await fetch(DROPBOX_API_URL + endpoint, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const status = response.status === 401 ? 401 : response.status === 409 ? 404 : 502;
    const error = new Error(
      response.status === 401
        ? "Dropbox authorization is no longer valid. Reconnect Dropbox."
        : response.status === 409
          ? "Dropbox could not find this folder. It may have been moved or deleted."
          : "Dropbox could not list this folder."
    );
    error.statusCode = status;
    throw error;
  }
  return data;
}

function redirectAfterDropbox(res, outcome) {
  const base = String(process.env.DROPBOX_POST_CONNECT_URL || DEFAULT_POST_CONNECT_URL).trim();
  let destination;
  try {
    destination = new URL(base);
    const allowed = new URL(DEFAULT_POST_CONNECT_URL).origin;
    if (destination.origin !== allowed) throw new Error("Post-connect URL must use the Jupiter Astrology origin.");
  } catch (error) {
    destination = new URL(DEFAULT_POST_CONNECT_URL);
  }
  destination.searchParams.set("dropbox", outcome);
  res.statusCode = 302;
  res.setHeader("Location", destination.toString());
  res.setHeader("Cache-Control", "no-store");
  return res.end();
}

async function handleConnect(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method not allowed.");
  }
  const user = await verifyFirebaseUser(req);
  const config = getDropboxConfig();
  const signed = createSignedState(user.uid);
  setStateCookie(res, signed.cookie, STATE_TTL_SECONDS);

  const authorization = new URL(DROPBOX_AUTHORIZE_URL);
  authorization.searchParams.set("client_id", config.appKey);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("redirect_uri", config.redirectUri);
  authorization.searchParams.set("token_access_type", "offline");
  authorization.searchParams.set("scope", "files.metadata.read files.content.read");
  authorization.searchParams.set("state", signed.state);

  return sendJson(res, 200, { authorizationUrl: authorization.toString() });
}

async function handleCallback(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "Method not allowed.");
  }
  const cookies = parseCookies(req);
  const state = getQuery(req, "state");
  const signed = verifySignedState(cookies[STATE_COOKIE], state);
  setStateCookie(res, "", 0);
  if (!signed) return redirectAfterDropbox(res, "error");

  const oauthError = getQuery(req, "error");
  if (oauthError) return redirectAfterDropbox(res, "denied");

  const code = getQuery(req, "code");
  if (!code) return redirectAfterDropbox(res, "error");

  try {
    const config = getDropboxConfig();
    const tokens = await exchangeDropboxCode(code, config);
    await upsertStoredConnection(signed.uid, tokens.refresh_token, tokens.account_id || "");
    return redirectAfterDropbox(res, "connected");
  } catch (error) {
    console.error("Dropbox OAuth callback failed:", error && error.message);
    return redirectAfterDropbox(res, "error");
  }
}

async function handleStatus(req, res, user) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "Method not allowed.");
  }
  const stored = await getStoredConnection(user.uid);
  return sendJson(res, 200, {
    connected: !!stored,
    provider: "Dropbox",
    connectedAt: stored ? stored.connectedAt : ""
  });
}

async function handleList(req, res, user) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "Method not allowed.");
  }
  const tokenData = await getDropboxAccessToken(user.uid);
  const cursor = getQuery(req, "cursor");
  let result;
  if (cursor) {
    result = await dropboxApiJson("/files/list_folder/continue", tokenData.accessToken, { cursor: cursor });
  } else {
    const path = getQuery(req, "path");
    if (path && (!path.startsWith("/") || path.includes("\\") || path.split("/").includes(".."))) {
      return sendError(res, 400, "Invalid Dropbox folder path.");
    }
    result = await dropboxApiJson("/files/list_folder", tokenData.accessToken, {
      path: path,
      recursive: false,
      include_deleted: false,
      include_non_downloadable_files: true,
      limit: 1000
    });
  }
  return sendJson(res, 200, {
    entries: (result.entries || []).map(mapDropboxEntry),
    hasMore: !!result.has_more,
    cursor: result.cursor || ""
  });
}

async function handleDownload(req, res, user) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "Method not allowed.");
  }
  const path = getQuery(req, "path");
  if (!path || !path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) {
    return sendError(res, 400, "Invalid Dropbox file path.");
  }
  const tokenData = await getDropboxAccessToken(user.uid);
  const response = await fetch(DROPBOX_CONTENT_URL + "/files/download", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + tokenData.accessToken,
      "Dropbox-API-Arg": JSON.stringify({ path: path }),
      Accept: "*/*"
    },
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) {
    const details = await response.text();
    console.error("Dropbox file download failed:", response.status, details.slice(0, 500));
    return sendError(res, response.status === 409 ? 404 : response.status === 401 ? 401 : 502,
      response.status === 409 ? "Dropbox could not find this file." :
      response.status === 401 ? "Dropbox authorization has expired. Reconnect Dropbox." :
      "Dropbox could not download this file.");
  }
  if (!response.body) return sendError(res, 502, "Dropbox returned an empty file.");
  const resultHeader = response.headers.get("Dropbox-API-Result");
  let metadata = {};
  try { metadata = resultHeader ? JSON.parse(resultHeader) : {}; } catch (error) {}
  const filename = safeFilename(metadata.name || path.split("/").pop() || "dropbox-file");
  const mime = response.headers.get("Content-Type") || "application/octet-stream";
  const length = Number(response.headers.get("Content-Length") || 0);
  if (length > MAX_DOWNLOAD_BYTES) return sendError(res, 413, "This file exceeds the current 150 MB preview limit.");
  res.statusCode = 200;
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", "inline; filename*=UTF-8''" + encodeURIComponent(filename));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (length > 0) res.setHeader("Content-Length", String(length));
  Readable.fromWeb(response.body).on("error", function (error) {
    console.error("Dropbox download stream failed:", error.message);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end("Dropbox stream failed.");
    } else {
      res.destroy(error);
    }
  }).pipe(res);
}

async function handleDisconnect(req, res, user) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method not allowed.");
  }
  const stored = await getStoredConnection(user.uid);
  if (stored) {
    try {
      const tokenData = await getDropboxAccessToken(user.uid);
      await fetch(DROPBOX_API_URL + "/auth/token/revoke", {
        method: "POST",
        headers: { Authorization: "Bearer " + tokenData.accessToken },
        signal: AbortSignal.timeout(10000)
      });
    } catch (error) {
      console.warn("Dropbox token revocation did not complete; deleting local credentials anyway.");
    }
  }
  await deleteStoredConnection(user.uid);
  return sendJson(res, 200, { disconnected: true });
}

module.exports = async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");

  try {
    const action = getAction(req);
    if (action === "callback") return await handleCallback(req, res);
    if (action === "connect") return await handleConnect(req, res);

    const user = await verifyFirebaseUser(req);
    if (action === "status") return await handleStatus(req, res, user);
    if (action === "list") return await handleList(req, res, user);
    if (action === "download") return await handleDownload(req, res, user);
    if (action === "disconnect") return await handleDisconnect(req, res, user);
    return sendError(res, 400, "Unsupported Dropbox action.");
  } catch (error) {
    const status = Number(error && error.statusCode) || 502;
    console.error("Jupiter Dropbox API:", status, error && error.message);
    return sendError(res, status, error.message || "Dropbox request failed.");
  }
};
