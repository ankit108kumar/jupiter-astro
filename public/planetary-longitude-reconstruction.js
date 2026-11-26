/* JupiterAstro — Reference-Anchored Planetary Longitude Reconstruction
 * v1.0.0
 *
 * Reconstructs sidereal longitude using the timestamps in the Planetary Transit
 * correction v4 JSON database as angular anchors:
 *   Sign ingress     = 30 degrees
 *   Nakshatra ingress= 13 degrees 20 minutes
 *   Navamsa ingress  = 3 degrees 20 minutes
 *
 * The existing sidereal ephemeris is the movement model between anchors.
 * Reference events calibrate its angular residual; they do not replace the
 * ephemeris with straight-line time interpolation.
 *
 * Browser:
 *   const engine = JAPlanetaryLongitude.create();
 *   await engine.init();
 *   const result = engine.calculate({
 *     planet: 'Jupiter',
 *     timestamp: Date.now(),
 *     ephemerisLongitudeAt: (planet, epochMs) =>
 *       siderealPlanetLongitude(planet, epochMs / 86400000 + 2440587.5)
 *   });
 *
 * Node/CommonJS:
 *   const JAPlanetaryLongitude = require('./planetary-longitude-reconstruction.js');
 *   const engine = JAPlanetaryLongitude.create({ database });
 *   engine.init();
 *   const result = engine.calculate({ planet, timestamp, ephemerisLongitudeAt });
 *
 * Notes:
 * - timestamp accepts epoch milliseconds, Date, or ISO with explicit timezone.
 * - The JSON entered_at values are interpreted using metadata.utc_offset.
 * - No corrected longitude is returned outside the available reference-anchor
 *   coverage unless allowUnanchoredFallback is explicitly enabled.
 * - Accuracy is measured by anchor residuals and cross-division consistency;
 *   the script does not claim a fixed arcsecond accuracy without validation.
 */
(function(root){
'use strict';
const VERSION='1.0.0';
const PLANETS=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu'];
const DIVISIONS=['Sign','Nakshatra','Navamsa'];
const SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const NAK=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const PADA=['First','Second','Third','Fourth'];
const SIGN_SPAN=30, NAK_SPAN=360/27, NAV_SPAN=360/108;
const MODAL_START=[0,9,6,3];
const EPS=1e-9;
const fail=(message,code)=>Object.assign(new Error(message),{code:code||'JA_LONGITUDE_ERROR'});
const isObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const mod=x=>((x%360)+360)%360;
const signedDelta=(a,b)=>((b-a+540)%360)-180;
const norm=s=>String(s==null?'':s).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase().replace('dhanishtha','dhanishta');
function timestampMs(value){
 if(value instanceof Date)value=value.getTime();
 if(typeof value==='number'&&Number.isFinite(value))return value;
 if(typeof value==='string'&&/(Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())){const n=Date.parse(value);if(Number.isFinite(n))return n;}
 throw fail('timestamp must be epoch milliseconds, Date, or ISO with an explicit timezone','INVALID_TIMESTAMP');
}
function parseOffset(value){
 const m=/^([+-])(\d{2}):(\d{2})$/.exec(String(value||''));
 if(!m||+m[2]>14||+m[3]>59)throw fail('metadata.utc_offset must use ±HH:MM format','INVALID_UTC_OFFSET');
 return(m[1]==='-'?-1:1)*(+m[2]*60 + +m[3]);
}
function parseLocalTimestamp(value,offsetMinutes){
 const m=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(String(value||''));
 if(!m)throw fail('Invalid JSON entered_at timestamp: '+value,'INVALID_EVENT_TIME');
 const [y,mo,d,h,mi,se,ms]=[+m[1],+m[2],+m[3],+m[4],+m[5],+(m[6]||0),+(String(m[7]||'').padEnd(3,'0')||0)];
 const t=Date.UTC(y,mo-1,d,h,mi,se,ms),check=new Date(t);
 if(check.getUTCFullYear()!==y||check.getUTCMonth()!==mo-1||check.getUTCDate()!==d||h>23||mi>59||se>59)throw fail('Invalid calendar timestamp: '+value,'INVALID_EVENT_TIME');
 return t-offsetMinutes*60000;
}
function signIndex(label){
 const s=norm(label),m=/\((\d{1,2})\)\s*$/.exec(s);
 if(m&&+m[1]>=1&&+m[1]<=12)return +m[1]-1;
 return SIGNS.findIndex(x=>s===norm(x)||s.startsWith(norm(x)+' '));
}
function nakIndex(label){
 const s=norm(label);
 return NAK.findIndex(x=>s===norm(x)||s.startsWith(norm(x)+' ')||s.startsWith(norm(x)+'('));
}
function divisionLabel(row,division){
 const v=row[division.toLowerCase()]??row.label??row.value;
 if(typeof v!=='string'||!v.trim())throw fail('Missing '+division+' label','INVALID_EVENT_LABEL');
 return v.trim();
}
function navSignForSegment(segmentIndex){
 const sign=Math.floor(segmentIndex/9),part=segmentIndex%9;
 return (MODAL_START[sign%4]+part)%12;
}
function navSignAt(longitude){
 const lon=mod(longitude),segment=Math.min(107,Math.floor((lon+EPS)/NAV_SPAN));
 return navSignForSegment(segment);
}
function labelMatchesNavamsa(label,index){
 const wanted=signIndex(label);
 return wanted>=0&&wanted===navSignForSegment(index);
}
function longitudeForEvent(label,division,rawLongitude){
 if(division==='Sign'){
  const i=signIndex(label);
  if(i<0)throw fail('Unrecognized Sign label: '+label,'UNKNOWN_SIGN');
  return i*SIGN_SPAN;
 }
 if(division==='Nakshatra'){
  const i=nakIndex(label);
  if(i<0)throw fail('Unrecognized Nakshatra label: '+label,'UNKNOWN_NAKSHATRA');
  return i*NAK_SPAN;
 }
 const candidates=[];
 for(let i=0;i<108;i++)if(labelMatchesNavamsa(label,i))candidates.push(i*NAV_SPAN);
 if(!candidates.length)throw fail('Unrecognized Navamsa sign label: '+label,'UNKNOWN_NAVAMSA');
 let best=candidates[0],distance=Infinity;
 for(const candidate of candidates){
  const d=Math.abs(signedDelta(rawLongitude,candidate));
  if(d<distance){distance=d;best=candidate;}
 }
 return best;
}
function describeLongitude(longitude){
 const lon=mod(longitude);
 const sign=Math.min(11,Math.floor(lon/30)),inSign=lon-sign*30;
 const nak=Math.min(26,Math.floor(lon/NAK_SPAN));
 const inNak=lon-nak*NAK_SPAN;
 const pada=Math.min(3,Math.floor((inNak+EPS)/(NAK_SPAN/4)));
 const nav=Math.min(107,Math.floor((lon+EPS)/NAV_SPAN));
 const d=Math.floor(inSign),mf=(inSign-d)*60,m=Math.floor(mf),sec=(mf-m)*60;
 const degText=String(d).padStart(2,'0')+'° '+String(m).padStart(2,'0')+'′ '+sec.toFixed(2).padStart(5,'0')+'″';
 return{
  longitude:lon,
  longitudeDMS:(Math.floor(lon)).toString().padStart(3,'0')+'° '+String(Math.floor((lon-Math.floor(lon))*60)).padStart(2,'0')+'′ '+(((lon*3600)%60).toFixed(2)).padStart(5,'0')+'″',
  sign:SIGNS[sign],signNumber:sign+1,degreeInSign:degText,degree: d,minute:m,second:sec,
  nakshatra:NAK[nak],nakshatraIndex:nak+1,pada:pada+1,padaName:PADA[pada],
  navamsa:SIGNS[navSignForSegment(nav)],navamsaNumber:navSignForSegment(nav)+1,navamsaSegment:nav+1
 };
}
function validateDatabase(db){
 if(!isObject(db)||!isObject(db.metadata)||!isObject(db.data))throw fail('JSON must contain metadata and data objects','INVALID_DATABASE');
 if(!db.metadata.timezone)throw fail('metadata.timezone is required','INVALID_DATABASE');
 const offset=parseOffset(db.metadata.utc_offset),index={},warnings=[],errors=[];
 for(const planet of PLANETS){
  const source=db.data[planet];
  if(!isObject(source)){warnings.push(planet+': missing planet data');continue;}
  index[planet]={};
  for(const division of DIVISIONS){
   const rows=source[division];
   if(!Array.isArray(rows)){warnings.push(planet+'.'+division+': missing event array');continue;}
   let previous=-Infinity;
   const events=[];
   for(let i=0;i<rows.length;i++){
    try{
     const enteredAtUTC=parseLocalTimestamp(rows[i].entered_at,offset);
     const label=divisionLabel(rows[i],division);
     if(enteredAtUTC<=previous)throw fail('Events must be strictly chronological','NON_CHRONOLOGICAL');
     previous=enteredAtUTC;
     events.push({planet,division,label,enteredAt:rows[i].entered_at,enteredAtUTC,source:'json',rowIndex:i});
    }catch(e){errors.push(planet+'.'+division+'['+i+']: '+e.message);}
   }
   if(events.length!==rows.length){warnings.push(planet+'.'+division+': series rejected because one or more rows are invalid');}
   else index[planet][division]=events;
  }
 }
 if(!PLANETS.some(p=>index[p]&&DIVISIONS.some(d=>index[p][d]&&index[p][d].length)))throw fail('No usable planetary reference events found','NO_USABLE_REFERENCE_EVENTS');
 return{index,offset,timezone:db.metadata.timezone,version:String(db.metadata.version||db.metadata.updated_at||db.metadata.generated_at||'unversioned'),warnings,errors};
}
function upperBound(events,t){
 let lo=0,hi=events.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(events[mid].enteredAtUTC<=t)lo=mid+1;else hi=mid;}
 return lo;
}
function collectAnchors(planet,series,ephemerisLongitudeAt,options){
 const all=[];
 for(const division of DIVISIONS){
  const events=series[division]||[];
  for(const event of events){
   let raw;
   try{raw=Number(ephemerisLongitudeAt(planet,event.enteredAtUTC));}catch(e){options.onWarning&&options.onWarning('Ephemeris failed at '+event.enteredAt+': '+e.message);continue;}
   if(!Number.isFinite(raw))continue;
   raw=mod(raw);
   try{
    const boundary=longitudeForEvent(event.label,division,raw);
    const residual=signedDelta(raw,boundary);
    all.push({timestamp:event.enteredAtUTC,rawLongitude:raw,boundaryLongitude:boundary,residual,division,label:event.label,source:'json',priority:division==='Sign'?3:division==='Nakshatra'?2:1,anchorDistanceDeg:Math.abs(residual),rowIndex:event.rowIndex});
   }catch(e){options.onWarning&&options.onWarning(planet+'.'+division+': '+e.message);}
  }
 }
 all.sort((a,b)=>a.timestamp-b.timestamp||b.priority-a.priority);
 // Coalesce same-instant events; retain the most informative anchor and keep
 // all observations for cross-division consistency diagnostics.
 const grouped=[];
 for(const a of all){
  const last=grouped[grouped.length-1];
  if(last&&last.timestamp===a.timestamp){
   last.observations.push(a);
   if(a.anchorDistanceDeg<last.anchor.anchorDistanceDeg-1e-8||
      (Math.abs(a.anchorDistanceDeg-last.anchor.anchorDistanceDeg)<=1e-8&&a.priority>last.anchor.priority))last.anchor=a;
  }else grouped.push({timestamp:a.timestamp,anchor:a,observations:[a]});
 }
 return grouped.map(g=>Object.assign({},g.anchor,{observations:g.observations}));
}
function interpolateResidual(anchors,t){
 let lo=0,hi=anchors.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(anchors[mid].timestamp<t)lo=mid+1;else hi=mid;}
 if(lo<anchors.length&&anchors[lo].timestamp===t)return{residual:anchors[lo].residual,mode:'exact-reference-anchor',left:lo,right:lo};
 if(lo===0||lo===anchors.length)return null;
 const a=anchors[lo-1],b=anchors[lo],span=b.timestamp-a.timestamp;
 if(span<=0)return{residual:a.residual,mode:'duplicate-anchor-timestamp',left:lo-1,right:lo};
 const f=(t-a.timestamp)/span;
 return{residual:a.residual+(b.residual-a.residual)*f,mode:'linear-interpolation-of-ephemeris-residual',left:lo-1,right:lo,fraction:f};
}
function directionAt(fn,planet,t,raw,epsilon,sampleMs){
 const a=raw,b=Number(fn(planet,t+sampleMs));
 if(!Number.isFinite(b))return'unknown';
 const d=signedDelta(a,mod(b));
 return Math.abs(d)<=epsilon?'stationary':d<0?'retrograde':'direct';
}
function create(config){
 config=config||{};
 const cfg={url:config.url||'/data/Planetary%20Transit%20correction%20v4.json',cache:config.cache!==false,cacheKey:config.cacheKey||'JA_LONGITUDE_REFERENCE_V1',sampleMs:config.sampleMs||21600000,stationaryEpsilonDeg:config.stationaryEpsilonDeg??0.00001,maxAnchorCorrectionDeg:config.maxAnchorCorrectionDeg??15};
 let database=null,state=null,loading=null;
 async function init(input){
  input=input||{};
  if(input.database||config.database){database=input.database||config.database;state=validateDatabase(database);return getDiagnostics();}
  if(state&&!input.forceReload)return getDiagnostics();
  if(loading)return loading;
  loading=(async()=>{
   if(cfg.cache&&root.indexedDB&&!input.forceReload){
    try{
     const cached=await new Promise(resolve=>{
      const req=root.indexedDB.open('JA_PlanetaryReference',1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('databases'))req.result.createObjectStore('databases',{keyPath:'key'});};
      req.onsuccess=()=>{const db=req.result;try{const get=db.transaction('databases','readonly').objectStore('databases').get('planetary-transit-correction-v4');get.onsuccess=()=>resolve(get.result&&get.result.database||null);get.onerror=()=>resolve(null);}catch(_){resolve(null);}};
      req.onerror=()=>resolve(null);
     });
     if(cached){database=cached;state=validateDatabase(cached);if(!input.forceReload)return getDiagnostics();}
    }catch(_){}
   }
   if(!root.fetch)throw fail('fetch is unavailable and no cached reference JSON exists','FETCH_UNAVAILABLE');
   const response=await root.fetch(cfg.url,{cache:'no-store'});
   if(!response.ok)throw fail('Reference JSON request failed: HTTP '+response.status,'FETCH_FAILED');
   const json=await response.json();state=validateDatabase(json);database=json;return getDiagnostics();
  })();
  try{return await loading;}finally{loading=null;}
 }
 function getDiagnostics(){return{ready:!!state,version:state&&state.version||null,timezone:state&&state.timezone||null,utcOffsetMinutes:state?state.offset:null,validationWarnings:state&&state.warnings||[],validationErrors:state&&state.errors||[],engineVersion:VERSION};}
 function calculate(input){
  if(!state)throw fail('Call init() before calculate()','NOT_INITIALIZED');
  if(!isObject(input))throw fail('calculate expects an object','INVALID_ARGUMENT');
  const planet=String(input.planet||'');
  if(!PLANETS.includes(planet))throw fail('Unsupported planet: '+planet,'UNSUPPORTED_PLANET');
  if(typeof input.ephemerisLongitudeAt!=='function')throw fail('Provide ephemerisLongitudeAt(planet, epochMs)','MISSING_EPHEMERIS_CALLBACK');
  const t=timestampMs(input.timestamp),series=state.index[planet];
  if(!series)throw fail('No reference series for '+planet,'MISSING_PLANET_SERIES');
  const anchors=collectAnchors(planet,series,input.ephemerisLongitudeAt,{onWarning:input.onWarning});
  if(!anchors.length)throw fail('No usable angular anchors for '+planet,'NO_USABLE_ANCHORS');
  const interpolation=interpolateResidual(anchors,t);
  const raw=Number(input.ephemerisLongitudeAt(planet,t));
  if(!Number.isFinite(raw))throw fail('Ephemeris returned an invalid longitude','INVALID_EPHEMERIS_LONGITUDE');
  const rawLongitude=mod(raw);
  if(!interpolation&&!input.allowUnanchoredFallback)throw fail('Timestamp is outside the time span covered by reference anchors','OUTSIDE_REFERENCE_COVERAGE');
  const residual=interpolation?interpolation.residual:0;
  const reconstructed=mod(rawLongitude+residual);
  const details=describeLongitude(reconstructed);
  const sampleMs=input.directionSampleMs||cfg.sampleMs;
  const motion=directionAt(input.ephemerisLongitudeAt,planet,t,rawLongitude,cfg.stationaryEpsilonDeg,sampleMs);
  const nearest=interpolation?{before:anchors[interpolation.left],after:anchors[interpolation.right]}:null;
  const warnings=[];
  if(interpolation&&Math.abs(residual)>2)warnings.push('Interpolated correction exceeds 2 degrees; inspect ephemeris model and reference alignment.');
  if(interpolation&&Math.abs(residual)>cfg.maxAnchorCorrectionDeg)warnings.push('Correction exceeds configured safety threshold.');
  const anchorResiduals=anchors.map(a=>({timestamp:a.timestamp,division:a.division,label:a.label,anchorCorrectionDegrees:a.residual,absoluteCorrectionDegrees:a.anchorDistanceDeg}));
  const observations=nearest?[...(nearest.before.observations||[nearest.before]),...(nearest.after.observations||[nearest.after])]:[];
  const consistency=observations.map(a=>({division:a.division,label:a.label,anchorLongitude:a.boundaryLongitude,correctionDegrees:a.residual}));
  return{
   engineVersion:VERSION,planet,timestamp:t,timestampISO:new Date(t).toISOString(),referenceVersion:state.version,
   rawEphemerisLongitude:rawLongitude,correctionDegrees:residual,reconstructedLongitude:details.longitude,
   position:details,motion,calibration:interpolation?{method:interpolation.mode,referenceAnchorCount:anchors.length,anchorBefore:nearest.before.timestamp,anchorAfter:nearest.after.timestamp,fraction:interpolation.fraction??0,anchorBeforeDivision:nearest.before.division,anchorAfterDivision:nearest.after.division,observedAnchorCorrections:consistency}: {method:'unanchored-ephemeris-fallback',referenceAnchorCount:anchors.length},
   diagnostics:{warnings,referenceCoverage:{start:anchors[0].timestamp,end:anchors[anchors.length-1].timestamp},maxAbsoluteAnchorCorrectionDegrees:Math.max(...anchors.map(a=>a.anchorDistanceDeg)),anchorResiduals}
  };
 }
 function calculateAll(input){
  if(!state)throw fail('Call init() before calculateAll()','NOT_INITIALIZED');
  const results={},errors={};
  for(const planet of PLANETS){
   try{results[planet]=calculate(Object.assign({},input,{planet}));}
   catch(e){errors[planet]={code:e.code||'ERROR',message:e.message};}
  }
  return{engineVersion:VERSION,timestamp:timestampMs(input.timestamp),referenceVersion:state.version,results,errors};
 }
 function getReferenceEvents(planet){
  if(!state)throw fail('Call init() before getReferenceEvents()','NOT_INITIALIZED');
  if(!PLANETS.includes(planet))throw fail('Unsupported planet: '+planet,'UNSUPPORTED_PLANET');
  return JSON.parse(JSON.stringify(state.index[planet]||{}));
 }
 return Object.freeze({version:VERSION,planets:PLANETS.slice(),init,calculate,calculateAll,getReferenceEvents,getDiagnostics});
}
const api=Object.freeze({version:VERSION,planets:PLANETS.slice(),create,describeLongitude});
root.JAPlanetaryLongitude=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
