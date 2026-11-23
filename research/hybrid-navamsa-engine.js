/* ==========================================================================
   JupiterAstro — Hybrid Calibrated Longitude Navamsa Engine
   Standalone research module; deliberately NOT imported by the live app.
   Sun/Moon: direct motion. Rahu: retrograde motion.
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JAHybridNavamsa = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const NAKSHATRA_SPAN_DEG = 40 / 3, PADA_SPAN_DEG = 10 / 3;
  const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const NAKSHATRAS = ["Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu","Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni","Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha","Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishtha","Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati"];
  const normalize360 = x => ((x % 360) + 360) % 360;
  function signedDelta(fromDeg, toDeg) {
    let d = normalize360(toDeg) - normalize360(fromDeg);
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }
  function resolveNakshatraIndex(input) {
    if (Number.isInteger(input) && input >= 0 && input < 27) return input;
    if (typeof input === "string") {
      const i = NAKSHATRAS.findIndex(n => n.toLowerCase() === input.trim().toLowerCase());
      if (i >= 0) return i;
    }
    throw new RangeError("nakshatraIndex must be 0–26 or a recognized Nakshatra name.");
  }
  function getNavamsaSign(index, pada) {
    if (!Number.isInteger(pada) || pada < 1 || pada > 4) throw new RangeError("Pada must be 1–4.");
    return SIGNS[(index * 4 + pada - 1) % 12];
  }
  // Correction JSON date-times have no offset; interpret explicitly as IST.
  function parseIstTimestamp(value) {
    if (typeof value !== "string") throw new TypeError("IST timestamp must be a string.");
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
    if (!m) throw new TypeError("Expected YYYY-MM-DDTHH:mm[:ss[.SSS]] without a timezone.");
    const [,y,mo,d,h,mi,sec="0",fraction="0"] = m;
    return Date.UTC(+y,+mo-1,+d,+h,+mi,+sec,Number(fraction.padEnd(3,"0"))) - 330*60000;
  }
  function toMs(value, field) {
    const ms = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
    if (!Number.isFinite(ms)) throw new TypeError(field + " must be Date, offset-aware ISO string, or epoch milliseconds.");
    return ms;
  }
  function calculate(options) {
    if (!options || !["Sun","Moon","Rahu"].includes(options.planet)) throw new TypeError('planet must be "Sun", "Moon", or "Rahu".');
    if (typeof options.getSiderealLongitude !== "function") throw new TypeError("getSiderealLongitude callback is required.");
    const startMs=toMs(options.entryTime,"entryTime"), endMs=toMs(options.exitTime,"exitTime");
    if (!(endMs>startMs)) throw new RangeError("exitTime must be after entryTime.");
    const nakIndex=resolveNakshatraIndex(options.nakshatraIndex), retrograde=options.planet==="Rahu", direction=retrograde?-1:1;
    const getLon=t=>{
      const v=Number(options.getSiderealLongitude(options.planet,t));
      if (!Number.isFinite(v)) throw new TypeError("Ephemeris returned a non-finite longitude at "+new Date(t).toISOString());
      return normalize360(v);
    };
    const startLon=getLon(startMs), endLon=getLon(endMs), rawSignedTravel=signedDelta(startLon,endLon), rawTravel=direction*rawSignedTravel;
    if (!(rawTravel>0 && rawTravel<180)) throw new RangeError("Unexpected endpoint direction/travel ("+rawSignedTravel+"°). "+(retrograde?"Rahu must move retrograde.":"Sun/Moon must move direct.")+" Check interval, ephemeris, ayanamsa and timezone.");
    const sampleCount=Math.max(8,Math.floor(options.monotonicSamples||32)), profile=[];
    let previous=0;
    for(let i=0;i<=sampleCount;i++){
      const t=startMs+(endMs-startMs)*i/sampleCount, progress=direction*signedDelta(startLon,getLon(t));
      if(progress<previous-1e-7) throw new RangeError("Non-monotonic longitude detected inside reference interval.");
      if(progress>rawTravel+1e-5) throw new RangeError("Ephemeris progression exceeds endpoint displacement.");
      profile.push({timestampMs:t,rawProgressDeg:progress}); previous=progress;
    }
    const calibratedAt=t=>NAKSHATRA_SPAN_DEG*(direction*signedDelta(startLon,getLon(t)))/rawTravel;
    function solve(target){
      let lo=startMs,hi=endMs; const max=Math.max(40,Math.floor(options.maxIterations||80)),tol=Math.max(1,Number(options.timeToleranceMs||250));
      for(let i=0;i<max;i++){const mid=(lo+hi)/2;if(calibratedAt(mid)<target)lo=mid;else hi=mid;if(hi-lo<=tol)break;}
      const timestampMs=(lo+hi)/2,calibrated=calibratedAt(timestampMs);
      return {timestampMs,iso:new Date(timestampMs).toISOString(),calibratedProgressDeg:calibrated,targetProgressDeg:target,residualArcsec:(calibrated-target)*3600};
    }
    // Rahu traverses each Nakshatra in reverse Pada order.
    const order=retrograde?[4,3,2,1]:[1,2,3,4];
    const boundaries=[1,2,3].map((step,i)=>({boundaryAfterPada:order[i],nextPada:order[i+1],nextNavamsaSign:getNavamsaSign(nakIndex,order[i+1]),...solve(step*PADA_SPAN_DEG)}));
    const bounds=[{timestampMs:startMs,iso:new Date(startMs).toISOString(),targetProgressDeg:0},...boundaries,{timestampMs:endMs,iso:new Date(endMs).toISOString(),targetProgressDeg:NAKSHATRA_SPAN_DEG}];
    const padas=order.map((pada,i)=>({pada,navamsaSign:getNavamsaSign(nakIndex,pada),startMs:bounds[i].timestampMs,startISO:bounds[i].iso,endMs:bounds[i+1].timestampMs,endISO:bounds[i+1].iso,durationMinutes:(bounds[i+1].timestampMs-bounds[i].timestampMs)/60000}));
    return {
      method:"hybrid-calibrated-longitude",planet:options.planet,motion:retrograde?"retrograde":"direct",
      nakshatra:NAKSHATRAS[nakIndex],nakshatraIndex:nakIndex,
      entry:{timestampMs:startMs,iso:new Date(startMs).toISOString(),siderealLongitude:startLon},
      exit:{timestampMs:endMs,iso:new Date(endMs).toISOString(),siderealLongitude:endLon},
      diagnostics:{referenceSpanDeg:NAKSHATRA_SPAN_DEG,rawEphemerisAngularTravelDeg:rawTravel,rawSignedAngularTravelDeg:rawSignedTravel,calibrationScale:NAKSHATRA_SPAN_DEG/rawTravel,intervalDurationMinutes:(endMs-startMs)/60000,monotonicityCheck:"passed",monotonicSamples:sampleCount,rootTimeToleranceMs:Math.max(1,Number(options.timeToleranceMs||250))},
      boundaries,padas,sampledMotionProfile:profile
    };
  }
  return Object.freeze({calculate,getNavamsaSign,signedDelta,parseIstTimestamp,constants:Object.freeze({nakshatraSpanDeg:NAKSHATRA_SPAN_DEG,padaSpanDeg:PADA_SPAN_DEG,signs:SIGNS.slice(),nakshatras:NAKSHATRAS.slice()})});
});
