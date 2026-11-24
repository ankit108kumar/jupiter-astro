/* JupiterAstro Hybrid Planetary Reference Reconciliation
 * v1.0.0 — standalone browser module; does not modify the ephemeris.
 * API: window.JAPlanetaryReference.create({url}).init(); engine.verify({...})
 * Direct JSON scope: Saturn, Jupiter, Rahu, Ketu. No direct Rahu/Ketu Navamsa exists.
 */
(function(root){
'use strict';
const VERSION='1.3.0', PLANETS=['Saturn','Jupiter','Rahu','Ketu'], DIVS=['Sign','Nakshatra','Navamsa'];
const DB='JA_PlanetaryReference', STORE='databases', NAK=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const err=(m,c='JA_REFERENCE_ERROR')=>Object.assign(new Error(m),{code:c});
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const norm=s=>{s=String(s).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();return s==='dhanishtha'?'dhanishta':s;};
function epoch(v){if(v instanceof Date)v=v.getTime();if(typeof v==='number'&&Number.isFinite(v))return v;if(typeof v==='string'&&/(Z|[+-]\d{2}:?\d{2})$/i.test(v.trim())){const n=Date.parse(v);if(Number.isFinite(n))return n;}throw err('timestamp must be epoch milliseconds, Date, or ISO with explicit timezone','INVALID_TIMESTAMP');}
function offset(s){const m=/^([+-])(\d{2}):(\d{2})$/.exec(String(s||''));if(!m||+m[2]>14||+m[3]>59)throw err('metadata.utc_offset must be like +05:30','INVALID_UTC_OFFSET');return(m[1]==='-'?-1:1)*(+m[2]*60 + +m[3]);}
function localTime(s,off){const m=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(String(s||''));if(!m)throw err('Invalid entered_at: '+s,'INVALID_EVENT_TIME');const [y,mo,d,h,mi,se,ms]=[+m[1],+m[2],+m[3],+m[4],+m[5],+(m[6]||0),+(String(m[7]||'').padEnd(3,'0')||0)];const t=Date.UTC(y,mo-1,d,h,mi,se,ms),dt=new Date(t);if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d||h>23||mi>59||se>59)throw err('Invalid calendar timestamp: '+s,'INVALID_EVENT_TIME');return t-off*60000;}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return'fnv1a-'+(h>>>0).toString(16)+'-'+s.length;}
function label(row,d){const v=row[d.toLowerCase()]??row.label??row.value;if(typeof v!=='string'||!v.trim())throw err('Missing '+d+' label','INVALID_EVENT_LABEL');return v.trim();}
function ordinal(s){const m=/\((\d{1,2})\)\s*$/.exec(s);return m?+m[1]:null;}
function nakIndex(s){const v=norm(s);return NAK.findIndex(n=>v===norm(n)||v.startsWith(norm(n)+' ')||v.startsWith(norm(n)+'('));}
function direction(a,b,d){if(d==='Nakshatra'){const x=nakIndex(a),y=nakIndex(b);if(x<0||y<0)return'unknown';const k=(y-x+27)%27;return k===1?'direct':k===26?'retrograde':'non-adjacent';}const x=ordinal(a),y=ordinal(b);if(x===null||y===null)return'unknown';const k=(y-x+12)%12;return k===1?'direct':k===11?'retrograde':'non-adjacent';}
function build(db){if(!obj(db)||!obj(db.metadata)||!obj(db.data))throw err('JSON must contain metadata and data','INVALID_DATABASE');if(!db.metadata.timezone)throw err('metadata.timezone is required','INVALID_DATABASE');const off=offset(db.metadata.utc_offset),idx={},warnings=[],errors=[];
for(const p of PLANETS){if(!obj(db.data[p])){errors.push(p+': missing planet');continue;}idx[p]={};for(const d of DIVS){const a=db.data[p][d];if(!Array.isArray(a)){errors.push(p+'.'+d+': expected array');idx[p][d]=null;continue;}if(!a.length){idx[p][d]=[];continue;}let prev=-Infinity,bad=false;const events=[];for(let i=0;i<a.length;i++){try{const at=localTime(a[i].entered_at,off),lab=label(a[i],d);if(at<=prev)throw err(at===prev?'Duplicate timestamp':'Out-of-order timestamp',at===prev?'DUPLICATE_TIMESTAMP':'NON_CHRONOLOGICAL');prev=at;events.push(Object.freeze({label:lab,enteredAt:a[i].entered_at,enteredAtUTC:at,index:i,source:'json'}));}catch(e){bad=true;errors.push(p+'.'+d+'['+i+']: '+e.message);}}if(bad||events.length!==a.length){idx[p][d]=null;warnings.push(p+'.'+d+' quarantined; invalid event(s) found');}else{for(let i=1;i<events.length;i++)if(direction(events[i-1].label,events[i].label,d)==='non-adjacent')warnings.push(p+'.'+d+' non-adjacent transition: '+events[i-1].label+' → '+events[i].label);idx[p][d]=events;}}}
if(!PLANETS.some(p=>idx[p]&&DIVS.some(d=>Array.isArray(idx[p][d])&&idx[p][d].length)))throw err('No valid supported reference series','NO_USABLE_SERIES');
return{index:idx,offset:off,timezone:db.metadata.timezone,version:String(db.metadata.version||db.metadata.updated_at||db.metadata.generated_at||hash(JSON.stringify(db))),warnings,errors};}
function upper(a,t){let l=0,h=a.length;while(l<h){const m=(l+h)>>>1;if(a[m].enteredAtUTC<=t)l=m+1;else h=m;}return l;}
function interval(a,t){if(!Array.isArray(a)||!a.length)return{status:'unavailable',reason:'reference-series-missing'};const n=upper(a,t);if(!n)return{status:'outside-coverage',reason:'before-first-event'};const e=a[n-1],x=a[n]||null;return{status:x?'covered':'covered-open-ended',label:e.label,index:n-1,entry:e.enteredAtUTC,exit:x?x.enteredAtUTC:null,entryEvent:e,exitEvent:x,elapsedMs:t-e.enteredAtUTC,remainingMs:x?x.enteredAtUTC-t:null,totalMs:x?x.enteredAtUTC-e.enteredAtUTC:null,durationComplete:!!x};}
function calcValue(c,d){if(!c)return null;const v=c[d.toLowerCase()]??c[d]??null;return v==null?null:(typeof v==='object'&&v.label?v.label:String(v));}
function create(opts){opts=opts||{};const cfg={url:opts.url||'/data/Planetary%20Transit%20correction%20v4.json',cacheKey:opts.cacheKey||'planetary-transit-correction-v4',maxAgeMs:opts.maxAgeMs||86400000,motionSampleMs:opts.motionSampleMs||21600000,stationaryEpsilonDeg:opts.stationaryEpsilonDeg??0.00001};let state=null,raw=null,loading=null,revalidating=null,lastRevalidation=null;const resultCache=new Map(),derivedCache=new Map(),fnIds=new WeakMap();let nextFnId=1;
async function dbOpen(){if(!root.indexedDB)return null;return new Promise(resolve=>{const r=root.indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);r.onblocked=()=>resolve(null);});}
async function getCached(){const db=await dbOpen();if(!db)return null;return new Promise(resolve=>{try{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(cfg.cacheKey);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null);}catch(_){resolve(null);}});}
async function saveCache(){const db=await dbOpen();if(!db)return;await new Promise(resolve=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key:cfg.cacheKey,database:raw,version:state.version,savedAt:Date.now()});tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();}catch(_){resolve();}});}
function summary(){return{ready:!!state,version:state?.version||null,engineVersion:VERSION,timezone:state?.timezone||null,validationWarnings:state?.warnings||[],validationErrors:state?.errors||[]};}
async function init(o){o=o||{};if(o.database){const built=build(o.database);raw=o.database;state=built;await saveCache();return summary();}if(state&&!o.forceReload)return summary();if(loading&&!o.forceReload)return loading;loading=(async()=>{if(!o.forceReload){const cached=await getCached();if(cached&&cached.database){try{raw=cached.database;state=build(cached.database);if(Date.now()-(cached.savedAt||0)>cfg.maxAgeMs)revalidate().catch(()=>{});return summary();}catch(e){state=null;raw=null;}}}if(state&&o.forceReload){await revalidate();if(!state)throw err('Unable to refresh reference database','REVALIDATION_FAILED');return summary();}if(!root.fetch)throw err('fetch unavailable; no valid cached database','FETCH_UNAVAILABLE');const response=await root.fetch(cfg.url,{cache:'no-store'});if(!response.ok)throw err('Database request failed: HTTP '+response.status,'FETCH_FAILED');const source=await response.json(),built=build(source);raw=source;state=built;await saveCache();return summary();})();try{return await loading;}finally{loading=null;}}
async function revalidate(){if(revalidating)return revalidating;if(!root.fetch){lastRevalidation={status:'unavailable',at:Date.now()};return lastRevalidation;}revalidating=(async()=>{try{const response=await root.fetch(cfg.url,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});if(!response.ok)throw err('Background refresh failed: HTTP '+response.status,'REVALIDATION_FAILED');const source=await response.json(),built=build(source),previous=state?.version||null,changed=previous!==built.version;raw=source;state=built;if(changed){resultCache.clear();derivedCache.clear();}await saveCache();lastRevalidation={status:'success',changed,previousVersion:previous,currentVersion:built.version,at:Date.now()};if(typeof opts.onDatabaseUpdated==='function')try{opts.onDatabaseUpdated(summary(),lastRevalidation);}catch(_){}return lastRevalidation;}catch(e){lastRevalidation={status:'failed',message:e.message,at:Date.now(),usingStale:!!state};return lastRevalidation;}finally{revalidating=null;}})();return revalidating;}
function ephemDirection(fn,p,t){if(typeof fn!=='function')return{status:'not-checked'};try{const a=+fn(p,t),b=+fn(p,t+cfg.motionSampleMs);if(!Number.isFinite(a)||!Number.isFinite(b))return{status:'invalid-sample'};const delta=((b-a+540)%360)-180;return{status:Math.abs(delta)<=cfg.stationaryEpsilonDeg?'stationary':delta<0?'retrograde':'direct',deltaDegrees:delta,sampleMs:cfg.motionSampleMs};}catch(e){return{status:'callback-error',message:e.message};}}
function rev360(x){return((x%360)+360)%360;}
function signedDelta(a,b){return((b-a+540)%360)-180;}
const SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const NAK_SPAN=360/27, NAV_SPAN=360/108;
function navamsaLabel(lon){const slot=Math.floor(rev360(lon)/NAV_SPAN+1e-9),sign=slot%12;return SIGNS[sign]+' ('+(sign+1)+')';}
function longitudeAt(fn,planet,t){let v=fn(planet,t);if(typeof v!=='number'||!Number.isFinite(v)){if(planet==='Ketu'){const r=fn('Rahu',t);if(typeof r==='number'&&Number.isFinite(r))return rev360(r+180);}throw err('Ephemeris longitude callback must return a finite sidereal degree for '+planet+' at '+t,'INVALID_EPHEMERIS_LONGITUDE');}return rev360(v);}
function nakStep(a,b){const x=nakIndex(a),y=nakIndex(b);if(x<0||y<0)throw err('Unrecognized Nakshatra label in reference series: '+a+' / '+b,'UNKNOWN_NAKSHATRA');const k=(y-x+27)%27;if(k===1)return 1;if(k===26)return-1;throw err('Consecutive Nakshatra reference labels are not adjacent: '+a+' → '+b,'NON_ADJACENT_NAKSHATRA');}
function buildDerivedNavamsa(planet,fn,ephemerisVersion){
 if(typeof fn!=='function')throw err('An ephemerisLongitudeAt callback is required to derive '+planet+' Navamsa','MISSING_EPHEMERIS_CALLBACK');
 let id=fnIds.get(fn);if(!id){id=nextFnId++;fnIds.set(fn,id);}
 const sampleCount=cfg.navamsaSampleCount||512,timeToleranceMs=cfg.navamsaTimeToleranceMs||250;
 const cacheKey=[state.version,ephemerisVersion||'unspecified',planet,id,sampleCount,timeToleranceMs,'hybrid-sampled-profile-v3'].join('|');
 if(derivedCache.has(cacheKey))return derivedCache.get(cacheKey);
 const nak=state.index[planet]?.Nakshatra;
 if(!Array.isArray(nak)||nak.length<2)throw err('At least two consecutive '+planet+' Nakshatra reference events are required','INSUFFICIENT_NAKSHATRA_REFERENCE');
 const events=[],warnings=[],calibrations=[];let totalSamples=0;
 // Hybrid sampled-profile method: unwrap the ephemeris longitude through each
 // reference Nakshatra interval, calibrate net travel to its signed 13°20′
 // reference span, then solve each internal quarter crossing independently.
 for(let i=0;i<nak.length-1;i++){
  const a=nak[i],b=nak[i+1],start=a.enteredAtUTC,end=b.enteredAtUTC;
  if(end<=start)throw err('Non-positive Nakshatra reference interval','INVALID_NAKSHATRA_INTERVAL');
  const direction=nakStep(a.label,b.label),targetSpan=direction*NAK_SPAN;
  // Chronological entry is the lower Nakshatra boundary for direct motion,
  // but the upper boundary for retrograde motion.
  const zodiacStart=rev360((nakIndex(a.label)+(direction<0?1:0))*NAK_SPAN);
  const samples=[];let previous=null,unwrapped=0;
  for(let j=0;j<=sampleCount;j++){
   const t=start+(end-start)*j/sampleCount;
   const lon=longitudeAt(fn,planet,t);
   if(previous!==null)unwrapped+=signedDelta(previous,lon);
   samples.push({timestampMs:t,longitude:lon,unwrappedDeg:unwrapped});
   previous=lon;totalSamples++;
  }
  const rawNetTravel=samples[samples.length-1].unwrappedDeg;
  if(Math.abs(rawNetTravel)<1e-7)throw err('Ephemeris net angular travel is effectively zero across Nakshatra interval','STATIONARY_NAKSHATRA_INTERVAL');
  if(Math.sign(rawNetTravel)!==direction)throw err('Ephemeris angular direction conflicts with chronological Nakshatra reference direction','DIRECTION_MISMATCH');
  const calibrationScale=targetSpan/rawNetTravel;
  if(!Number.isFinite(calibrationScale)||calibrationScale<0.5||calibrationScale>2)throw err('Angular-travel calibration scale outside safety range: '+calibrationScale,'CALIBRATION_OUT_OF_RANGE');
  for(let quarter=1;quarter<=3;quarter++){
   const targetProgress=targetSpan*quarter/4;
   let found=0;
   for(let j=0;j<sampleCount;j++){
    const leftSample=samples[j],rightSample=samples[j+1];
    const leftProgress=leftSample.unwrappedDeg*calibrationScale;
    const rightProgress=rightSample.unwrappedDeg*calibrationScale;
    if(targetProgress<Math.min(leftProgress,rightProgress)-1e-9||targetProgress>Math.max(leftProgress,rightProgress)+1e-9)continue;
    let lo=leftSample.timestampMs,hi=rightSample.timestampMs;
    const targetRaw=targetProgress/calibrationScale;
    const increasing=rightSample.unwrappedDeg>=leftSample.unwrappedDeg;
    const rawAt=t=>leftSample.unwrappedDeg+signedDelta(leftSample.longitude,longitudeAt(fn,planet,t));
    for(let k=0;k<70&&hi-lo>timeToleranceMs;k++){
     const mid=(lo+hi)/2,value=rawAt(mid);
     if((value<targetRaw)===increasing)lo=mid;else hi=mid;
    }
    const crossing=Math.round((lo+hi)/2);
    const boundaryLongitude=rev360(zodiacStart+targetSpan*quarter/4);
    events.push({label:navamsaLabel(boundaryLongitude),enteredAtUTC:crossing,enteredAt:new Date(crossing).toISOString(),source:'derived-hybrid-sampled-angular-profile',boundaryLongitude,anchor:'calibrated-ephemeris-quarter-crossing',referenceInterval:{start:a.enteredAt,end:b.enteredAt},direction:direction>0?'direct':'retrograde'});
    found++;
   }
   if(!found)warnings.push('Quarter '+quarter+' crossing not bracketed for '+a.label+' → '+b.label);
  }
  events.push({label:navamsaLabel(zodiacStart),enteredAtUTC:start,enteredAt:a.enteredAt,source:'derived-hybrid-sampled-angular-profile',boundaryLongitude:zodiacStart,anchor:'json-nakshatra-ingress',direction:direction>0?'direct':'retrograde'});
  calibrations.push({nakshatraFrom:a.label,nakshatraTo:b.label,startAtUTC:start,endAtUTC:end,referenceDirection:direction>0?'direct':'retrograde',rawEphemerisTravelDegrees:rawNetTravel,referenceSpanDegrees:targetSpan,calibrationScale,calibratedTravelDegrees:rawNetTravel*calibrationScale,endpointResidualDegrees:rawNetTravel*calibrationScale-targetSpan,sampleCount:samples.length,sampling:'uniform timestamp samples; unwrapped sidereal longitude; calibrated to signed reference Nakshatra span'});
 }
 events.sort((a,b)=>a.enteredAtUTC-b.enteredAtUTC);
 const dedup=[];for(const e of events){if(dedup.length&&dedup[dedup.length-1].enteredAtUTC===e.enteredAtUTC){dedup[dedup.length-1]=e;continue;}dedup.push(e);}
 for(let i=1;i<dedup.length;i++)if(dedup[i].enteredAtUTC<=dedup[i-1].enteredAtUTC)throw err('Derived Navamsa events are not strictly chronological','DERIVED_EVENT_ORDER');
 const result={events:dedup,warnings,calibrations,source:'derived-hybrid-sampled-angular-profile',calibrationMethod:'Adapted from Hybrid Transit Engine V2.1: sample sidereal longitude across each reference Nakshatra interval, unwrap angular progression, calibrate signed net travel to the exact signed 13°20′ reference span, and refine each internal quarter crossing by bisection inside its sampled bracket. Retrograde intervals anchor at the upper Nakshatra boundary.',ephemerisVersion:ephemerisVersion||null,referenceVersion:state.version,sampleCount,samples:totalSamples,timeToleranceMs};
 derivedCache.set(cacheKey,result);return result;
}
function derivedInterval(planet,t,fn,ephemerisVersion){const built=buildDerivedNavamsa(planet,fn,ephemerisVersion),q=interval(built.events,t);if(q.status==='outside-coverage'||q.status==='unavailable')return q;return Object.assign(q,{source:'derived-angular-speed-endpoint-calibrated',warnings:built.warnings,calibrations:built.calibrations,calibrationMethod:built.calibrationMethod,ephemerisVersion:built.ephemerisVersion,referenceVersion:built.referenceVersion});}
async function verify(input){if(!obj(input))throw err('verify expects an object','INVALID_ARGUMENT');const p=String(input.planet||'');if(!PLANETS.includes(p))throw err('Unsupported planet: '+p,'UNSUPPORTED_PLANET');const t=epoch(input.timestamp);if(!state)await init();const rows=state.index[p]||{},out={planet:p,timestamp:t,sourceVersion:state.version,calculated:{},verified:{},divisions:{},diagnostics:{warnings:[],referenceTimezone:state.timezone,utcOffsetMinutes:state.offset,validationWarnings:state.warnings,validationErrors:state.errors}};
for(const d of DIVS){const c=calcValue(input.calculated,d);out.calculated[d.toLowerCase()]=c;let a=rows[d],q,source='json';if(!Array.isArray(a)&&d==='Navamsa'&&(p==='Rahu'||p==='Ketu')){try{q=derivedInterval(p,t,input.ephemerisLongitudeAt,input.ephemerisVersion);source='derived-angular-speed-endpoint-calibrated';}catch(e){out.diagnostics.warnings.push('Navamsa derivation unavailable: '+e.message);q={status:'unavailable',reason:e.code||e.message};}}else q=Array.isArray(a)?interval(a,t):{status:a===null?'invalid-reference-series':'unavailable'};if(q.status==='outside-coverage'||q.status==='unavailable'){const s=q.status==='unavailable'?(q.reason||'reference-series-missing'):q.status;out.divisions[d.toLowerCase()]={status:s,calculated:c,reference:null,final:c,corrected:false,duration:null,referenceSource:source};out.verified[d.toLowerCase()]=c;continue;}const match=c===null?null:norm(c)===norm(q.label),dir=q.index&&Array.isArray(a)?direction(a[q.index-1].label,q.label,d):'unknown';const row={status:q.status,calculated:c,reference:q.label,final:q.label,matches:match,corrected:c!==null&&!match,referenceSource:source,direction:dir,entryAtUTC:q.entry,exitAtUTC:q.exit,entryAtISO:new Date(q.entry).toISOString(),exitAtISO:q.exit===null?null:new Date(q.exit).toISOString(),elapsedMs:q.elapsedMs,remainingMs:q.remainingMs,totalStayMs:q.totalMs,durationComplete:q.durationComplete};if(source==='derived-angular-speed-endpoint-calibrated'){row.derived=true;row.warning='Navamsa boundaries use integrated angular speed, calibrated to the exact 13°20′ Nakshatra reference span; they are derived, not direct JSON observations.';row.derivationWarnings=q.warnings||[];row.ephemerisVersion=q.ephemerisVersion;}if(!q.exit)row.warning=(row.warning?row.warning+' ':'')+'Exit is unknown at the end of reference coverage.';if(p==='Saturn'||p==='Jupiter'){row.ephemerisDirection=ephemDirection(input.ephemerisLongitudeAt,p,t);if(dir!=='unknown'&&row.ephemerisDirection.status!=='not-checked'&&row.ephemerisDirection.status!=='stationary'&&row.ephemerisDirection.status!==dir){row.directionMismatch=true;out.diagnostics.warnings.push(d+' reference direction differs from ephemeris sample');}if(row.ephemerisDirection.status==='stationary')row.possibleStation=true;}out.divisions[d.toLowerCase()]=row;out.verified[d.toLowerCase()]=q.label;}
out.motionPolicy=(p==='Rahu'||p==='Ketu')?'preserve-existing-node-retrograde-policy':'preserve-existing-ephemeris-motion';out.diagnostics.completedAt=new Date().toISOString();const ck=[state.version,p,...DIVS.map(d=>{const a=rows[d];return Array.isArray(a)?d+':'+(upper(a,t)-1):d+':x';})].join('|');out.cache={intervalKey:ck,previouslySeen:resultCache.has(ck)};resultCache.set(ck,true);return out;}
async function verifyAll(input){await init();const result={timestamp:input.timestamp,results:{},errors:{}};await Promise.all(PLANETS.map(async p=>{try{result.results[p]=await verify({planet:p,timestamp:input.timestamp,calculated:input.calculated?.[p]||{},ephemerisLongitudeAt:input.ephemerisLongitudeAt});}catch(e){result.errors[p]={code:e.code||'ERROR',message:e.message};}}));return result;}
function getInterval(p,d,t){if(!state)throw err('Call init first','NOT_INITIALIZED');if(!PLANETS.includes(p)||!DIVS.includes(d))throw err('Invalid planet/division','INVALID_ARGUMENT');return interval(state.index[p]?.[d],epoch(t));}
async function clearCache(){state=raw=null;resultCache.clear();derivedCache.clear();const db=await dbOpen();if(!db)return false;return new Promise(resolve=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(cfg.cacheKey);tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);}catch(_){resolve(false);}});}
return Object.freeze({version:VERSION,init,revalidate,verify,verifyAll,getInterval,getDiagnostics:()=>Object.assign(summary(),{cachedIntervalKeys:resultCache.size,derivedNavamsaCaches:derivedCache.size,lastRevalidation}),clearCache});}
const api=Object.freeze({version:VERSION,planets:PLANETS,divisions:DIVS,create});
root.JAPlanetaryReference=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
