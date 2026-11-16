"use strict";

const { createSign, createHash } = require("node:crypto");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/datastore";
const COLLECTION = "geminiUsage";
let cachedToken = "";
let tokenExpiresAt = 0;
let tokenPromise = null;

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    const error = new Error("Missing Vercel environment variable: " + name);
    error.statusCode = 503;
    throw error;
  }
  return value;
}

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function getFirestoreToken() {
  if (cachedToken && tokenExpiresAt > Date.now() + 60000) return cachedToken;
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async function () {
    const email = requiredEnv("GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL");
    const privateKey = requiredEnv("GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n").trim();
    const now = Math.floor(Date.now() / 1000);
    const unsigned = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
      b64url(JSON.stringify({
        iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600
      }));
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const assertion = unsigned + "." + signer.sign(privateKey, "base64url");
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      const error = new Error("Could not authenticate the Firestore service account.");
      error.statusCode = 503;
      throw error;
    }
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000;
    return cachedToken;
  })();

  try { return await tokenPromise; }
  finally { tokenPromise = null; }
}

function firestoreBase() {
  const projectId = String(process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "jupiter-astro").trim();
  return "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) +
    "/databases/(default)/documents";
}

async function firestoreFetch(url, options, token) {
  const response = await fetch(url, Object.assign({
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(15000)
  }, options || {}));
  const data = await response.json().catch(() => ({}));
  if (response.status === 404) return { notFound: true };
  if (!response.ok) {
    console.error("Gemini usage Firestore error:", response.status, data.error && data.error.status || "");
    const error = new Error("Gemini usage control is temporarily unavailable.");
    error.statusCode = 503;
    throw error;
  }
  return data;
}

function fieldString(doc, key) {
  return String(doc && doc.fields && doc.fields[key] && doc.fields[key].stringValue || "");
}

function fieldInteger(doc, key) {
  return Number(doc && doc.fields && doc.fields[key] && doc.fields[key].integerValue || 0);
}

// Atomically update one user's daily unknown-question count.
async function updateUnknownQuestionCount(clientAddress, relevance) {
  const token = await getFirestoreToken();
  const base = firestoreBase();
  // Hash the network address so raw IP addresses are never stored in Firestore.
  const usageId = createHash("sha256").update(String(clientAddress || "unknown")).digest("hex");
  const documentUrl = base + "/" + COLLECTION + "/" + usageId;
  const transactionData = await firestoreFetch(base + ":beginTransaction", {
    method: "POST",
    body: JSON.stringify({ options: { readWrite: {} } })
  }, token);
  const transaction = transactionData.transaction;
  if (!transaction) {
    const error = new Error("Firestore did not start a usage-control transaction.");
    error.statusCode = 503;
    throw error;
  }

  const readUrl = documentUrl + "?transaction=" + encodeURIComponent(transaction);
  const current = await firestoreFetch(readUrl, { method: "GET" }, token);

  const today = new Date().toISOString().slice(0, 10);
  const storedDate = current.notFound ? "" : fieldString(current, "date");
  let count = storedDate === today ? fieldInteger(current, "unknownCount") : 0;
  let requestCount = storedDate === today ? fieldInteger(current, "requestCount") : 0;
  requestCount += 1;
  if (relevance === "allowed") count = 0;
  else if (relevance === "unknown") count += 1;

  await firestoreFetch(base + ":commit", {
    method: "POST",
    body: JSON.stringify({
      transaction,
      writes: [{
        update: {
          name: documentUrl,
          fields: {
            date: { stringValue: today },
            unknownCount: { integerValue: String(count) },
            requestCount: { integerValue: String(requestCount) },
            updatedAt: { timestampValue: new Date().toISOString() }
          }
        },
        updateMask: { fieldPaths: ["date", "unknownCount", "requestCount", "updatedAt"] }
      }]
    })
  }, token);

  return { unknownCount: count, requestCount };
}

module.exports = { updateUnknownQuestionCount };
