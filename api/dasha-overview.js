"use strict";

const crypto = require("node:crypto");

const PROJECT_ID = "jupiter-astro";
const ISSUER = "https://securetoken.google.com/" + PROJECT_ID;
const CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const VIM_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
const VIM_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };

let certCache = { expiresAt: 0, certs: null, pending: null };

function decodePart(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

async function getCertificates() {
  if (certCache.certs && certCache.expiresAt > Date.now()) return certCache.certs;
  if (certCache.pending) return certCache.pending;

  certCache.pending = (async () => {
    const response = await fetch(CERT_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Unable to retrieve Firebase signing certificates.");
    const certs = await response.json();
    const cacheControl = response.headers.get("cache-control") || "";
    const match = cacheControl.match(/max-age=(\d+)/i);
    const maxAge = match ? Number(match[1]) : 300;
    certCache = { certs, expiresAt: Date.now() + Math.max(60, maxAge) * 1000, pending: null };
    return certs;
  })();

  try {
    return await certCache.pending;
  } finally {
    certCache.pending = null;
  }
}

async function verifyFirebaseToken(req) {
  const authHeader = String(req.headers.authorization || "");
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }

  const token = match[1];
  const parts = token.split(".");
  if (parts.length !== 3) {
    const error = new Error("Invalid authentication token.");
    error.statusCode = 401;
    throw error;
  }

  let header;
  let claims;
  try {
    header = decodePart(parts[0]);
    claims = decodePart(parts[1]);
  } catch (_) {
    const error = new Error("Invalid authentication token.");
    error.statusCode = 401;
    throw error;
  }

  if (header.alg !== "RS256" || !header.kid) {
    const error = new Error("Unsupported authentication token.");
    error.statusCode = 401;
    throw error;
  }

  const certs = await getCertificates();
  const cert = certs[header.kid];
  if (!cert) {
    certCache.expiresAt = 0;
    const error = new Error("Authentication signing key is not recognised.");
    error.statusCode = 401;
    throw error;
  }

  const signed = parts[0] + "." + parts[1];
  const signature = Buffer.from(parts[2], "base64url");
  const validSignature = crypto.verify("RSA-SHA256", Buffer.from(signed), cert, signature);
  const now = Math.floor(Date.now() / 1000);

  if (
    !validSignature ||
    claims.aud !== PROJECT_ID ||
    claims.iss !== ISSUER ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    claims.sub.length > 128 ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now ||
    !Number.isFinite(claims.iat) ||
    claims.iat > now + 300 ||
    !Number.isFinite(claims.auth_time) ||
    claims.auth_time > now + 300
  ) {
    const error = new Error("Your login session is invalid or has expired.");
    error.statusCode = 401;
    throw error;
  }

  return { uid: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
}

function sequenceNumber(referenceLord, targetLord) {
  const reference = VIM_ORDER.indexOf(referenceLord);
  const target = VIM_ORDER.indexOf(targetLord);
  if (reference < 0 || target < 0) return "—";
  return String(((target - reference + 9) % 9) + 1);
}

function subPeriods(lord, startMs, years, yearDays) {
  const startIndex = VIM_ORDER.indexOf(lord);
  if (startIndex < 0) throw new Error("Invalid Dasha lord.");
  const out = [];
  let cursor = startMs;
  for (let index = 0; index < 9; index++) {
    const currentLord = VIM_ORDER[(startIndex + index) % 9];
    const periodYears = years * VIM_YEARS[currentLord] / 120;
    const lengthMs = periodYears * yearDays * 86400000;
    out.push({ lord: currentLord, start: cursor, end: cursor + lengthMs, years: periodYears });
    cursor += lengthMs;
  }
  return out;
}

function cleanDetailMap(value, planets) {
  if (!value || typeof value !== "object") throw new Error("Chart placement details are missing.");
  const result = {};
  for (const key of ["d1Placement", "d1Lordship", "d9Placement"]) {
    if (!value[key] || typeof value[key] !== "object") throw new Error("Chart placement details are incomplete.");
    result[key] = {};
    for (const planet of planets) {
      const item = value[key][planet];
      if (typeof item !== "string" || item.length > 120) throw new Error("Invalid chart placement detail.");
      result[key][planet] = item;
    }
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Vary", "Authorization");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    await verifyFirebaseToken(req);

    const body = req.body || {};
    if (body.action === "authorize") {
      return res.status(200).json({ authorized: true });
    }

    const mdList = body.mdList;
    const yearDays = Number(body.yearDays || 365.25);
    if (!Array.isArray(mdList) || mdList.length < 1 || mdList.length > 10) {
      return res.status(400).json({ error: "Invalid Mahadasha timeline." });
    }
    if (!Number.isFinite(yearDays) || yearDays < 360 || yearDays > 370) {
      return res.status(400).json({ error: "Invalid Dasha year length." });
    }

    const planets = VIM_ORDER;
    const details = cleanDetailMap(body.details, planets);
    const safeMds = mdList.map(md => {
      if (!md || !VIM_YEARS[md.lord]) throw new Error("Invalid Mahadasha lord.");
      const start = Number(md.start);
      const years = Number(md.years);
      if (!Number.isFinite(start) || !Number.isFinite(years) || years <= 0 || years > 20) {
        throw new Error("Invalid Mahadasha period.");
      }
      return { lord: md.lord, start, years };
    });

    const firstMdLord = safeMds[0].lord;
    const rows = [];

    for (let mdIndex = 0; mdIndex < safeMds.length; mdIndex++) {
      const md = safeMds[mdIndex];
      const adList = subPeriods(md.lord, md.start, md.years, yearDays);

      for (let adIndex = 0; adIndex < adList.length; adIndex++) {
        const ad = adList[adIndex];
        const pdList = subPeriods(ad.lord, ad.start, ad.years, yearDays);

        for (let pdIndex = 0; pdIndex < pdList.length; pdIndex++) {
          const pd = pdList[pdIndex];
          rows.push({
            id: mdIndex + "-" + adIndex + "-" + pdIndex,
            md: md.lord,
            ad: ad.lord,
            pd: pd.lord,
            mdNo: sequenceNumber(firstMdLord, md.lord),
            adNo: sequenceNumber(md.lord, ad.lord),
            pdNo: sequenceNumber(md.lord, pd.lord),
            start: pd.start,
            end: pd.end,
            d1Placement: details.d1Placement[md.lord] + " – " + details.d1Placement[ad.lord] + " – " + details.d1Placement[pd.lord],
            d1Lordship: details.d1Lordship[md.lord] + " – " + details.d1Lordship[ad.lord] + " – " + details.d1Lordship[pd.lord],
            d9Placement: details.d9Placement[md.lord] + " – " + details.d9Placement[ad.lord] + " – " + details.d9Placement[pd.lord]
          });
        }
      }
    }

    rows.sort((a, b) => a.start - b.start);
    return res.status(200).json({ authorized: true, rows });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error("Dasha overview API error:", error);
    return res.status(status).json({
      error: status === 401 ? error.message : "Unable to prepare the Detailed Dasha Overview."
    });
  }
}
