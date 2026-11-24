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
let enginePromise=null,engine=null,requestSequence=0,statusHideTimer=null,latestStatus=null,timelineTimestamp=null,timelineUpdated=new Set(),timelineRefreshTimer=null,lastStatusModel=null;
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
 const raw=String(label||'').trim().toLowerCase();
 const s=raw.replace(/^dhanishtha/,'dhanishta');
 const i=NAK.findIndex(x=>s.startsWith(x.toLowerCase()));
 if(i<0)return null;
 const p=ORD.findIndex(x=>s.includes(x.toLowerCase()+' pada'));
 return{i,pada:p<0?null:p+1};
}
function navamsaAt(longitude){const lon=((longitude%360)+360)%360,s=Math.floor(lon/30),deg=lon-s*30,part=Math.min(8,Math.floor(deg/(30/9)));return([0,9,6,3][s%4]+part)%12;}
function padaFromNakshatraAndNavamsa(nakIndex,navIndex){for(let pada=1;pada<=4;pada++){const segment=nakIndex*4+(pada-1),midpoint=segment*(10/3)+(5/3);if(navamsaAt(midpoint)===navIndex)return pada;}return null;}
function dateLabel(ms){
 try{return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).format(new Date(ms))+' IST';}
 catch(_){return new Date(ms).toISOString();}
}
function ensureStrip(){
 let el=document.getElementById('ja-planetary-verification-strip');
 if(el)return el;
 const style=document.createElement('style');
 style.id='ja-planetary-verification-style';
 style.textContent='#ja-planetary-verification-strip{position:fixed!important;left:50%!important;bottom:10px!important;transform:translateX(-50%);z-index:100600;width:min(1120px,calc(100vw - 24px));box-sizing:border-box;padding:5px 12px;border:1px solid rgba(117,104,139,.3);border-radius:8px;background:color-mix(in srgb,var(--surface,#fff) 30%,transparent);backdrop-filter:blur(12px);box-shadow:0 3px 14px rgba(40,32,54,.09);color:#514b5e;font:500 11px/1.3 Inter,system-ui,sans-serif;pointer-events:none;opacity:1!important;visibility:visible!important;animation:none!important;transition:none!important}#ja-planetary-verification-strip[hidden]{display:none!important}#ja-planetary-verification-strip .ja-pr-line{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:100%}#ja-planetary-verification-strip strong{font-weight:700;color:#34303d}#ja-planetary-verification-strip[data-state="error"],#ja-planetary-verification-strip[data-state="warning"]{color:#a23d3d}#ja-planetary-verification-info{position:fixed!important;left:30px!important;bottom:72px!important;z-index:100001!important;width:25px;height:25px;min-width:25px;padding:0;border:1px solid rgba(100,91,115,.24);border-radius:50%;background:color-mix(in srgb,var(--surface,#fff) 35%,transparent);color:var(--muted,#766f82);font:600 13px/1 Inter,system-ui,sans-serif;opacity:.52;cursor:pointer;box-shadow:0 2px 8px rgba(30,25,40,.10);backdrop-filter:blur(8px);transition:opacity .16s ease,transform .16s ease}#ja-planetary-verification-info:hover,#ja-planetary-verification-info:focus-visible{opacity:.95;transform:translateY(-1px)}#ja-planetary-verification-info[hidden]{display:none!important}';
 document.head.appendChild(style);
 el=document.createElement('div');el.id='ja-planetary-verification-strip';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.dataset.state='loading';el.hidden=true;document.body.appendChild(el);
 const info=document.createElement('button');info.id='ja-planetary-verification-info';info.type='button';info.textContent='i';info.setAttribute('aria-label','Show latest planetary verification status');info.title='Show latest planetary verification status for 1 second';info.hidden=true;info.addEventListener('click',showLatestStatus);document.body.appendChild(info);
 return el;
}
function displayStatusForOneSecond(){
 const el=ensureStrip();
 el.hidden=false;el.style.display='block';
 const info=document.getElementById('ja-planetary-verification-info');
 if(info)info.hidden=false;
 if(statusHideTimer!==null)root.clearTimeout(statusHideTimer);
 statusHideTimer=root.setTimeout(()=>{el.hidden=true;statusHideTimer=null;},1000);
}
function showLatestStatus(){
 if(!latestStatus)return;
 const el=ensureStrip();
 el.dataset.state=latestStatus.state;
 el.title=latestStatus.title;
 el.innerHTML=latestStatus.html;
 displayStatusForOneSecond();
}
function showStatus(result,elapsed,scope){
 const updated=result.updated||[],verified=result.verified||[],unavailable=result.unavailable||[],partial=result.partial||[],errors=result.errors||[];
 const durations=Array.from(new Set([...(result.timelineUpdated||[]),...timelineUpdated])).sort();
 const heading=errors.length?'Reference check incomplete':unavailable.length&&!verified.length?'Reference data unavailable':updated.length?'Reference check · corrections applied':'Reference check complete';
 const firstLine=heading+' · '+(scope||'Chart');
 const secondLine='Verified: '+(verified.join(', ')||'—')+
  ' · Updated: '+(updated.join(', ')||'—')+
  ' · No data: '+(unavailable.join(', ')||'—')+
  (partial.length?' · Partial: '+partial.join(', '):'')+
  ' · Timeline duration: '+(durations.join(', ')||'—')+
  ' · '+Math.max(0,elapsed).toFixed(1)+' ms'+
  (errors.length?' · Errors: '+errors.join('; '):'');
 latestStatus={state:errors.length?'warning':unavailable.length?'warning':'ready',title:firstLine+'\n'+secondLine,html:'<span class="ja-pr-line"><strong>'+escapeHtml(heading)+'</strong> · '+escapeHtml(scope||'Chart')+'</span>'+
  '<span class="ja-pr-line">'+escapeHtml(secondLine)+'</span>'};
 lastStatusModel={result,elapsed,scope};
 showLatestStatus();
}
function scheduleTimelineStatusRefresh(){
 if(!lastStatusModel||timelineRefreshTimer!==null)return;
 timelineRefreshTimer=root.setTimeout(()=>{timelineRefreshTimer=null;if(lastStatusModel)showStatus(lastStatusModel.result,lastStatusModel.elapsed,lastStatusModel.scope);},40);
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
    const label=row&&row.reference?row.final:null;
    if(label){labels[d]=label;intervals[d]=row;
     if(d==='Sign')indices.sign=signIndex(label);
     if(d==='Nakshatra'){const q=nakInfo(label);if(q){indices.nakshatra=q.i;indices.pada=q.pada;}}
     if(d==='Navamsa')indices.navamsa=signIndex(label);
    }
   }
  }
  if(Number.isInteger(indices.nakshatra)&&Number.isInteger(indices.navamsa)&&!Number.isInteger(indices.pada))indices.pada=padaFromNakshatraAndNavamsa(indices.nakshatra,indices.navamsa);
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
   const result={results:{},errors:{}};await Promise.all(PLANETS.map(async p=>{try{result.results[p]=await e.verify({planet:p,timestamp:at,calculated:calculated[p]||{},ephemerisLongitudeAt:longitudeAt,ephemerisVersion:EPHEMERIS_VERSION});}catch(error){result.errors[p]={code:error.code||'ERROR',message:error.message};}}));
   const verified=[],updated=[],unavailable=[],partial=[],errors=[];
   PLANETS.forEach(p=>{
    const item=result.results&&result.results[p];
    if(!item){unavailable.push(p);errors.push((result.errors&&result.errors[p]&&result.errors[p].message)||p+' verification unavailable');return;}
    const supported=DIVISIONS.map(d=>item.divisions&&item.divisions[d.toLowerCase()]).filter(Boolean);
    const covered=supported.filter(x=>x.reference&&x.status!=='coverage-open-ended');
    if(covered.length===DIVISIONS.length)verified.push(p);
    else if(covered.length)partial.push(p);
    else unavailable.push(p);
    if(supported.some(x=>x.corrected))updated.push(p);
   });
   payload={results:result.results||{},verified,updated,unavailable,partial,errors,version:e.getDiagnostics().version};
   CACHE.set(cacheKey,payload);while(CACHE.size>40)CACHE.delete(CACHE.keys().next().value);
  }
  const out=makePositions(positions,payload.results),elapsed=nowMs()-start;
  if(token===requestSequence&&!options.silent)showStatus(payload,elapsed,scope);
  return{positions:out,results:payload.results,verified:payload.verified.slice(),updated:payload.updated.slice(),unavailable:(payload.unavailable||[]).slice(),partial:(payload.partial||[]).slice(),errors:payload.errors.slice(),elapsedMs:elapsed,referenceVersion:payload.version};
 }catch(error){
  const elapsed=nowMs()-start;
  if(token===requestSequence&&!options.silent)showStatus({verified:[],updated:[],unavailable:PLANETS.slice(),partial:[],errors:[error.message]},elapsed,scope);
  console.error('JupiterAstro planetary reference verification failed:',error);
  return{positions:Object.assign({},positions),results:{},verified:[],updated:[],unavailable:PLANETS.slice(),partial:[],errors:[error.message],elapsedMs:elapsed,referenceVersion:null};
 }
}
function getInterval(planet,division,timestamp){
 if(!engine)return null;
 const at=Number(timestamp);
 if(at!==timelineTimestamp){timelineTimestamp=at;timelineUpdated.clear();scheduleTimelineStatusRefresh();}
 try{
  const q=engine.getTransitReference(planet,division,at,longitudeAt,EPHEMERIS_VERSION);
  if(!q||q.startMs==null||q.endMs==null||!Number.isFinite(Number(q.startMs))||!Number.isFinite(Number(q.endMs)))return null;
  if(Number(q.startMs)>at||Number(q.endMs)<=at)return null;
  timelineUpdated.add(planet+' '+division);
  scheduleTimelineStatusRefresh();
  return{startMs:Number(q.startMs),endMs:Number(q.endMs),source:q.referenceSource||'json',derived:!!q.derived};
 }catch(e){return null;}
}
root.JAPlanetaryReconciliation=Object.freeze({
 version:'2.0.0',planets:PLANETS,divisions:DIVISIONS,init:getEngine,
 reconcilePositions,getInterval,showStatus:showStatus
});
})(window);
