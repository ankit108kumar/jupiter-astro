"use strict";

const FIREBASE_LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";
const FIREBASE_API_KEY_FALLBACK = "AIzaSyDwXS689Y4gdyuD9-3ThCwsDiSHkyuNFpU";

function authError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Require an active Firebase sign-in session only.
 * No Google Sheets allowlist lookup and no separate email-verification gate.
 */
async function verifyFirebaseUser(req) {
  const authorization = String(req.headers && req.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw authError(401, "Please log in to continue.");

  const idToken = match[1];
  if (idToken.length > 10000) {
    throw authError(401, "Your login session is invalid. Please log in again.");
  }

  const apiKey = String(
    process.env.FIREBASE_WEB_API_KEY || FIREBASE_API_KEY_FALLBACK
  ).trim();

  let response;
  try {
    response = await fetch(
      FIREBASE_LOOKUP_URL + "?key=" + encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ idToken }),
        signal: AbortSignal.timeout(12000)
      }
    );
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

module.exports = { verifyFirebaseUser, authError };
