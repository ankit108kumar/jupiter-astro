"use strict";
const { verifyFirebaseUser } = require("../lib/server-auth");
const { createHash } = require("node:crypto");

const SHEETS_URL = "https://script.google.com/macros/s/AKfycbx02wG3xKMKegEYNYMI-pQbmXhnPiielVJbYtPIXs0waU7150qys4Y1psaulXX1U4qx/exec";
const MAX_BYTES = 4 * 1024 * 1024;

function fail(res, status, message) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization");
  return res.status(status).json({ error: message });
}
function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) return String(row[key]).trim();
  }
  return "";
}
function normalize(payload) {
  if (!Array.isArray(payload)) throw Object.assign(new Error("Saved Profiles service returned an unexpected response."), { statusCode: 502 });
  return payload.filter(row => row && typeof row === "object").map((row, index) => {
    const name = pick(row, ["name","Name","profileName","Profile Name"]);
    const dob = pick(row, ["dob","DOB","dateOfBirth","Date of Birth"]);
    const tob = pick(row, ["tob","TOB","timeOfBirth","Time of Birth"]);
    const pob = pick(row, ["pob","POB","placeOfBirth","Place of Birth"]);
    const tags = pick(row, ["tags","Tags","tag","Tag"]);
    const desc = pick(row, ["desc","description","Description","notes","Notes","remark","Remarks"]);
    const id = pick(row, ["id","ID","profileId","Profile ID"]) ||
      createHash("sha256").update([name,dob,tob,pob,index].join("\u001f")).digest("hex").slice(0,20);
    return {
      id, name, dob, tob, pob,
      lat: pick(row, ["lat","latitude","Latitude"]),
      lon: pick(row, ["lon","lng","longitude","Longitude"]),
      tz: pick(row, ["tz","timezone","timeZone","Timezone"]),
      tags, desc, keywords: pick(row, ["keywords","Keywords"])
    };
  }).filter(row => row.name);
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return fail(res, 405, "Method not allowed.");
  }
  try {
    await verifyFirebaseUser(req);
    const response = await fetch(SHEETS_URL + "?_=" + Date.now(), {
      headers: { Accept: "application/json, text/javascript" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw Object.assign(new Error("Saved Profiles service is temporarily unavailable."), { statusCode: 502 });
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BYTES) throw Object.assign(new Error("Saved Records response exceeds the size limit."), { statusCode: 502 });
    let payload;
    try { payload = JSON.parse(raw); }
    catch (_) {
      const match = raw.trim().match(/^[\w.$]+\s*\(([\s\S]*)\)\s*;?$/);
      if (!match) throw Object.assign(new Error("Saved Profiles service returned invalid JSON."), { statusCode: 502 });
      payload = JSON.parse(match[1]);
    }
    const records = normalize(payload);
    return res.status(200).json({ records, count: records.length });
  } catch (error) {
    const status = Number(error && error.statusCode) || 502;
    if (status >= 500) console.error("Saved Records API:", error && error.message);
    return fail(res, status, error.message || "Unable to load Saved Records.");
  }
};
