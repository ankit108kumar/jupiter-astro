/* JupiterAstro planetary reference adapter — global natal + transit reconciliation.
 * Existing ephemeris longitudes are retained unchanged. JSON/hybrid references
 * supply corrected Sign, Nakshatra, Navamsa classifications and intervals.
 */
(function(root){
'use strict';
const PLANETS=['Saturn','Jupiter','Rahu','Ketu'];
const DIVISIONS=['Sign','Nakshatra','Navamsa'];
const SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const NAK=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const ORD=['First','Second','Third','Fourth'];
const CACHE=new Map();
let enginePromise=null,engine=null,requestSequence=0;
const EPHEMERIS_VERSION='JupiterAstro-existing-sidereal-ephemeris';
function nowMs(){return root.performance&&typeof root.performance.now==='function'?root.performance.now():Date.now();}
function msToJd(ms){return Number(ms)/86400000+2440587.5;}
function longitudeAt(planet,timestampMs){
 if(typeof root.siderealPlanetLongitude!=='function')throw new Error('Existing siderealPlanetLongitude() is unavailable.');
 return root.siderealPlanetLongitude(planet,msToJd(timestampMs));
}
function currentLabels(planet,lon){
 const sign=Math.floor((((lon%360)+360)%360)/30),span=360/27,nak=Math.min(26,Math.floor((((lon%360)+360)%360)/span));
 const pada=Math.min(4,Math.floor(((((lon%360)+360)%360)-nak*span)/(span/4))+1);
 const signStart=Math.floor((((lon%360)+360)%360)/30),within=(((lon%360)+360)%360)-signStart*30,part=Math.min(8,Math.floor(within/(30/9))),nav=([0,9,6,3][signStart%4]+part)%12;
 return{Sign:SIGNS[sign]+' ('+(sign+1)+')',Nakshatra:NAK[nak]+' '+ORD[pada-1]+' Pada',Navamsa:SIGNS[nav]+' ('+(nav+1)+')'};
}
function signIndex(label){
 const s=String(label||'').toLowerCase(),n=/\((\d{1,2})\)/.exec(s);
 if(n&&+n[1]>=1&&+n[1]<=12)return +n[1]-1;
 return SIGNS.findIndex(x=>s.startsWith(x.toLowerCase()));
}
function nakInfo(label){
 const s=String(label||'').trim().toLowerCase();
 const i=NAK.findIndex(x=>s.startsWith(x.toLowerCase()));
 if(i<0)return null;
 const p=ORD.findIndex(x=>s.includes(x.toLowerCase()+' pada'));
 return{i,pada:p<0?null:p+1};
}
function dateLabel(ms){
 try{return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).format(new Date(ms))+' IST';}
 catch(_){return new Date(ms).toISOString();}
}
function ensureStrip(){
 let el=document.getElementById('ja-planetary-verification-strip');
 if(el)return el;
 const style=document.createElement('style');
 style.id='ja-planetary-verification-style';
 style.textContent='#ja-planetary-verification-strip{position:fixed;left:10px;bottom:10px;z-index:100600;max-width:min(560px,calc(100vw - 20px));padding:7px 10px;border:1px solid rgba(117,104,139,.24);border-radius:8px;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);box-shadow:0 3px 14px rgba(40,32,54,.09);color:#514b5e;font:500 10px/1.45 Inter,system-ui,sans-serif;pointer-events:none}#ja-planetary-verification-strip strong{font-weight:700;color:#34303d}#ja-planetary-verification-strip[data-state="error"]{color:#a23d3d}';
 document.head.appendChild(style);
 el=document.createElement('div');el.id='ja-planetary-verification-strip';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.dataset.state='loading';el.textContent='Verifying planetary reference data…';document.body.appendChild(el);
 return el;
}
function showStatus(result,elapsed,scope){
 const el=ensureStrip(),updated=result.updated||[],verified=result.verified||[];
 const names=updated.length?updated.join(', '):'None (reference values already matched)';
 el.dataset.state=result.errors&&result.errors.length?'warning':'ready';
 el.innerHTML='<strong>Planetary data verified and updated</strong> · '+(scope||'Chart')+
  '<br>Updated: '+escapeHtml(names)+' · Verified: '+escapeHtml(verified.join(', ')||'—')+
  '<br>Verification: '+Math.max(0,elapsed).toFixed(1)+' ms · '+escapeHtml(dateLabel(Date.now()));
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function getEngine(){
 if(engine)return engine;
 if(!root.JAPlanetaryReference)throw new Error('Planetary reconciliation engine has not loaded.');
 if(!enginePromise){
  const instance=root.JAPlanetaryReference.create({url:'/data/Planetary%20Transit%20correction%20v4.json',cacheKey:'ja-planetary-reference-v4-global'});
  enginePromise=instance.init().then(()=>{engine=instance;return instance;}).catch(e=>{enginePromise=null;throw e;});
 }
 return enginePromise;
}
function makePositions(positions,results){
 const out={};for(const p of Object.keys(positions||{})){
  const original=positions[p],copy=Object.assign({},original);
  const item=results&&results[p],labels={},indices={},intervals={};
  if(item){
   for(const d of DIVISIONS){
    const row=item.divisions&&item.divisions[d.toLowerCase()];
    const label=row&&row.final;
    if(label){labels[d]=label;intervals[d]=row;
     if(d==='Sign')indices.sign=signIndex(label);
     if(d==='Nakshatra'){const q=nakInfo(label);if(q){indices.nakshatra=q.i;indices.pada=q.pada;}}
     if(d==='Navamsa')indices.navamsa=signIndex(label);
    }
   }
  }
  if(Object.keys(labels).length)copy.jaReference={labels,indices,intervals,verified:true};
  out[p]=copy;
 }
 return out;
}
async function reconcilePositions(positions,timestamp,scope,options){
 options=options||{};
 const token=++requestSequence,start=nowMs(),at=Math.trunc(Number(timestamp));
 if(!Number.isFinite(at))throw new Error('Invalid timestamp for planetary reconciliation.');
 const cacheKey=at+'|'+PLANETS.map(p=>p+':'+(positions[p]&&positions[p].lon)).join('|');
 let payload=CACHE.get(cacheKey);
 try{
  const e=await getEngine();
  if(!payload){
   const calculated={};
   PLANETS.forEach(p=>{if(positions[p]&&Number.isFinite(positions[p].lon))calculated[p]=currentLabels(p,positions[p].lon);});
   const result=await e.verifyAll({timestamp:at,calculated,ephemerisLongitudeAt:longitudeAt,ephemerisVersion:EPHEMERIS_VERSION});
   const verified=[],updated=[],errors=[];
   PLANETS.forEach(p=>{
    const item=result.results&&result.results[p];
    if(!item){errors.push((result.errors&&result.errors[p]&&result.errors[p].message)||p+' verification unavailable');return;}
    const supported=DIVISIONS.map(d=>item.divisions&&item.divisions[d.toLowerCase()]).filter(Boolean);
    if(supported.some(x=>x.reference))verified.push(p);
    if(supported.some(x=>x.corrected))updated.push(p);
   });
   payload={results:result.results||{},verified,updated,errors,version:e.getDiagnostics().version};
   CACHE.set(cacheKey,payload);while(CACHE.size>40)CACHE.delete(CACHE.keys().next().value);
  }
  const out=makePositions(positions,payload.results),elapsed=nowMs()-start;
  if(token===requestSequence&&!options.silent)showStatus(payload,elapsed,scope);
  return{positions:out,results:payload.results,verified:payload.verified.slice(),updated:payload.updated.slice(),errors:payload.errors.slice(),elapsedMs:elapsed,referenceVersion:payload.version};
 }catch(error){
  const elapsed=nowMs()-start;
  if(token===requestSequence&&!options.silent)showStatus({verified:[],updated:[],errors:[error.message]},elapsed,scope);
  console.error('JupiterAstro planetary reference verification failed:',error);
  return{positions:Object.assign({},positions),results:{},verified:[],updated:[],errors:[error.message],elapsedMs:elapsed,referenceVersion:null};
 }
}
function getInterval(planet,division,timestamp){
 if(!engine)return null;
 try{
  const q=engine.getTransitReference(planet,division,Number(timestamp),longitudeAt,EPHEMERIS_VERSION);
  if(!q||!Number.isFinite(Number(q.startMs))||!Number.isFinite(Number(q.endMs)))return null;
  return{startMs:Number(q.startMs),endMs:Number(q.endMs),source:q.referenceSource||'json',derived:!!q.derived};
 }catch(e){return null;}
}
root.JAPlanetaryReconciliation=Object.freeze({
 version:'2.0.0',planets:PLANETS,divisions:DIVISIONS,init:getEngine,
 reconcilePositions,getInterval,showStatus:showStatus
});
})(window);
