"use strict";

const { verifyFirebaseSession } = require("../lib/server-auth");

const VIM_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
const VIM_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };

function sendError(res, status, message) {
  res.setHeader("Cache-Control", "no-store, private");
  return res.status(status).json({ error: message });
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

    out.push({
      lord: currentLord,
      start: cursor,
      end: cursor + lengthMs,
      years: periodYears
    });

    cursor += lengthMs;
  }

  return out;
}

function cleanDetailMap(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Chart placement details are missing.");
  }

  const result = {};
  for (const key of ["d1Placement", "d1Lordship", "d9Placement"]) {
    if (!value[key] || typeof value[key] !== "object") {
      throw new Error("Chart placement details are incomplete.");
    }

    result[key] = {};
    for (const planet of VIM_ORDER) {
      const item = value[key][planet];
      if (typeof item !== "string" || item.length > 120) {
        throw new Error("Invalid chart placement detail.");
      }
      result[key][planet] = item;
    }
  }

  return result;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Vary", "Authorization");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method not allowed.");
  }

  try {
    // A valid Firebase login session is sufficient for this feature.
    await verifyFirebaseSession(req);

    const body = req.body || {};
    const mdList = body.mdList;
    const yearDays = Number(body.yearDays || 365.25);

    if (!Array.isArray(mdList) || mdList.length < 1 || mdList.length > 10) {
      return sendError(res, 400, "Invalid Mahadasha timeline.");
    }

    if (!Number.isFinite(yearDays) || yearDays < 360 || yearDays > 370) {
      return sendError(res, 400, "Invalid Dasha year length.");
    }

    const details = cleanDetailMap(body.details);
    const safeMds = mdList.map(md => {
      if (!md || !VIM_YEARS[md.lord]) {
        throw new Error("Invalid Mahadasha lord.");
      }

      const start = Number(md.start);
      const years = Number(md.years);

      if (!Number.isFinite(start) || !Number.isFinite(years) || years <= 0 || years > 20) {
        throw new Error("Invalid Mahadasha period.");
      }

      return { lord: md.lord, start, years };
    });

    // Each row uses its own Mahadasha lord as the single reference
    // for MD, AD and PD numbering. The MD itself therefore always equals 1.
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
            mdNo: sequenceNumber(md.lord, md.lord),
            adNo: sequenceNumber(md.lord, ad.lord),
            pdNo: sequenceNumber(md.lord, pd.lord),
            start: pd.start,
            end: pd.end,
            d1Placement: details.d1Placement[md.lord] + " – " + details.d1Placement[ad.lord] + " – " + details.d1Placement[pd.lord],
            d1Lordship: details.d1Lordship[md.lord] + " \\ " + details.d1Lordship[ad.lord] + " \\ " + details.d1Lordship[pd.lord],
            d9Placement: details.d9Placement[md.lord] + " – " + details.d9Placement[ad.lord] + " – " + details.d9Placement[pd.lord]
          });
        }
      }
    }

    rows.sort((a, b) => a.start - b.start);
    return res.status(200).json({ authorized: true, rows });
  } catch (error) {
    const status = Number(error && error.statusCode) || 500;
    if (status >= 500) console.error("Jupiter Dasha overview API:", error);
    return sendError(res, status, error.message || "Unable to prepare the Detailed Dasha Overview.");
  }
};
