"use strict";

const FIREBASE_LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";
const AUTH_CHECK_URL = "https://script.google.com/macros/s/AKfycbx02wG3xKMKegEYNYMI-pQbmXhnPiielVJbYtPIXs0waU7150qys4Y1psaulXX1U4qx/exec";
const FIREBASE_API_KEY_FALLBACK = "AIzaSyDwXS689Y4gdyuD9-3ThCwsDiSHkyuNFpU";
const allowlistCache = new Map();
const ALLOWLIST_TTL_MS = 60 * 1000;

function authError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseScriptResult(raw) {
  const text = String(raw || "").trim();
  try { return JSON.parse(text); } catch (_) {}
  const match = text.match(/^[\w.$]+\s*\(([\s\S]*)\)\s*;?$/);
  if (match) {
    try { return JSON.parse(match[1]); } catch (_) {}
  }
  throw authError(503, "The authorization service returned an unreadable response.");
}

async function isAuthorizedEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  const cached = allowlistCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.authorized;

  const url = new URL(AUTH_CHECK_URL);
  url.searchParams.set("action", "verifyEmail");
  url.searchParams.set("email", normalized);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json, text/javascript" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw authError(503, "The email authorization service is temporarily unavailable.");
  const result = parseScriptResult(await response.text());
  if (!result || result.success !== true || typeof result.authorized !== "boolean") {
    throw authError(503, "The email authorization service did not confirm access.");
  }
  allowlistCache.set(normalized, { authorized: result.authorized, expiresAt: Date.now() + ALLOWLIST_TTL_MS });
  return result.authorized;
}

async function verifyFirebaseUser(req, options) {
  const authorization = String(req.headers && req.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw authError(401, "Please log in to continue.");

  const idToken = match[1];
  if (idToken.length > 10000) throw authError(401, "Your login session is invalid. Please log in again.");

  const apiKey = String(process.env.FIREBASE_WEB_API_KEY || FIREBASE_API_KEY_FALLBACK).trim();
  const response = await fetch(FIREBASE_LOOKUP_URL + "?key=" + encodeURIComponent(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ idToken }),
    signal: AbortSignal.timeout(12000)
  });
  const data = await response.json().catch(() => ({}));
  const user = Array.isArray(data.users) && data.users[0];
  if (!response.ok || !user || !user.localId || !user.email) {
    throw authError(401, "Your login session has expired. Please log in again.");
  }
  if (user.emailVerified !== true) {
    throw authError(403, "Please verify your email address before using this feature.");
  }
  if (!options || options.requireAuthorizedEmail !== false) {
    let authorized;
    try { authorized = await isAuthorizedEmail(user.email); }
    catch (error) { throw error.statusCode ? error : authError(503, "Could not verify your access. Please try again later."); }
    if (!authorized) throw authError(403, "This email address is not authorized to use Jupiter Astrology.");
  }
  return { uid: user.localId, email: String(user.email).toLowerCase() };
}



/**
 * Feature-only session check.
 * Validates the Firebase ID token without invoking the account allowlist
 * or changing the existing verifyFirebaseUser account-preauthorization flow.
 */
async function verifyFirebaseSession(req) {
  const authorization = String(req.headers && req.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw authError(401, "Please log in to continue.");

  const idToken = match[1];
  if (idToken.length > 10000) {
    throw authError(401, "Your login session is invalid. Please log in again.");
  }

  const apiKey = String(process.env.FIREBASE_WEB_API_KEY || FIREBASE_API_KEY_FALLBACK).trim();
  let response;
  try {
    response = await fetch(FIREBASE_LOOKUP_URL + "?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(12000)
    });
  } catch (_) {
    throw authError(503, "Could not validate your login session. Please try again.");
  }

  const data = await response.json().catch(() => ({}));
  const user = Array.isArray(data.users) && data.users[0];
  if (!response.ok || !user || !user.localId || !user.email) {
    throw authError(401, "Your login session has expired. Please log in again.");
  }

  return {
    uid: user.localId,
    email: String(user.email).trim().toLowerCase()
  };
}

module.exports = { verifyFirebaseUser, verifyFirebaseSession, isAuthorizedEmail, authError };
