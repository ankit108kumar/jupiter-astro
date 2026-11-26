/* JupiterAstro planetary reference adapter — all-nine-planet natal + transit reconciliation.
 * Existing ephemeris longitudes remain unchanged. Each division uses reference data
 * only when that exact planet/date/division is covered; otherwise the live engine is retained.
 */
(function(root){
'use strict';
const PLANETS=['Saturn','Jupiter','Rahu','Ketu','Mars','Mercury','Venus','Sun','Moon'];
const DIVISIONS=['Sign','Nakshatra','Navamsa'];
const SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const NAK=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const ORD=['First','Second','Third','Fourth'];
const CACHE=new Map();
let enginePromise=null,engine=null,requestSequence=0,latestStatus=null,latestByScope={},timelineTimestamp=null,timelineUpdated=new Set(),timelineRefreshTimer=null,lastStatusModel=null;
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
function showLatestStatus(){
 if(!latestStatus||!root.JAInfoToast||typeof root.JAInfoToast.show!=='function')return;
 root.JAInfoToast.show(latestStatus.message,{source:'planetary-verification',priority:3,duration:5500,variant:latestStatus.state==='warning'?'warning':'success',position:'bottom',remember:true});
}
function showStatus(result,elapsed,scope){
 const durations=Array.from(new Set([...(result.timelineUpdated||[]),...timelineUpdated])).sort();
 const contexts=result.contexts||{Natal:latestByScope.Natal||null,Transit:latestByScope.Transit||null};
 const labelList=(items)=>items&&items.length?items.join(', '):'—';
 const correctionList=(items)=>items&&items.length?items.join(', '):'No change in Sign, Nakshatra or Navamsa required';
 const fallbackList=(map)=>Object.entries(map||{}).map(([planet,divisions])=>planet+' ('+divisions.join('/')+')').join(', ')||'—';
 const contextLine=(name,item)=>{if(!item)return name+': pending';return name+' — Verified: '+labelList(item.verified)+' · Updated: '+correctionList(item.updated)+' · No data: '+labelList(item.unavailable)+(item.partial&&item.partial.length?' · Partial: '+labelList(item.partial):'')+' · Engine fallback: '+fallbackList(item.fallbackByPlanet);};
 const hasContexts=!!(contexts.Natal||contexts.Transit),errors=result.errors||[];
 const heading=errors.length?'Reference check incomplete':(result.unavailable||[]).length?'Reference coverage incomplete':(result.updated||[]).length?'Reference check · corrections applied':'Reference check complete';
 const firstLine=hasContexts?heading+' · '+contextLine('Natal',contexts.Natal):heading+' · '+(scope||'Chart');
 const secondLine=hasContexts?contextLine('Transit',contexts.Transit)+' · Timeline durations: '+labelList(durations)+' · '+Math.max(0,elapsed).toFixed(1)+' ms · Checked: '+dateLabel(Date.now()):'Verified: '+labelList(result.verified)+' · Updated: '+correctionList(result.updated)+' · No data: '+labelList(result.unavailable)+(result.partial&&result.partial.length?' · Partial: '+labelList(result.partial):'')+' · Engine fallback: '+fallbackList(result.fallbackByPlanet)+' · Timeline durations: '+labelList(durations)+' · '+Math.max(0,elapsed).toFixed(1)+' ms · Checked: '+dateLabel(Date.now());
 const warning=errors.length||(result.unavailable||[]).length||(result.partial||[]).length;
 latestStatus={state:warning?'warning':'ready',message:firstLine+'\\n'+secondLine};lastStatusModel={result,elapsed,scope};showLatestStatus();
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
  const item=results&&results[p],labels={},indices={},intervals={},divisionStatus={};
  if(item){
   for(const d of DIVISIONS){
    const row=item.divisions&&item.divisions[d.toLowerCase()];
    const label=row&&row.reference?row.final:null;
    divisionStatus[d]={
     verified:!!(label&&(row.status==='covered'||row.status==='coverage-open-ended')),
     fallback:!label,
     source:row&&row.referenceSource||null,
     reason:row&&row.fallbackReason||(!label&&row&&row.status)||null
    };
    if(label){labels[d]=label;intervals[d]=row;
     if(d==='Sign')indices.sign=signIndex(label);
     if(d==='Nakshatra'){const q=nakInfo(label);if(q){indices.nakshatra=q.i;indices.pada=q.pada;}}
     if(d==='Navamsa')indices.navamsa=signIndex(label);
    }
   }
   if(Number.isInteger(indices.nakshatra)&&Number.isInteger(indices.navamsa)&&!Number.isInteger(indices.pada))indices.pada=padaFromNakshatraAndNavamsa(indices.nakshatra,indices.navamsa);
   const verifiedDivisions=DIVISIONS.filter(d=>divisionStatus[d].verified);
   const fallbackDivisions=DIVISIONS.filter(d=>divisionStatus[d].fallback);
   copy.jaReference={labels,indices,intervals,divisionStatus,verified:verifiedDivisions.length===DIVISIONS.length,verifiedDivisions,fallbackDivisions};
  }
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
   const result={results:{},errors:{}};await Promise.all(PLANETS.map(async p=>{try{result.results[p]=await e.verify({planet:p,timestamp:at,calculated:calculated[p]||{},ephemerisLongitudeAt:longitudeAt,ephemerisVersion:EPHEMERIS_VERSION,hybridNavamsa:p==='Sun'||p==='Moon'});}catch(error){result.errors[p]={code:error.code||'ERROR',message:error.message};}}));
   const verified=[],updated=[],unavailable=[],partial=[],errors=[],fallbackByPlanet={};
   PLANETS.forEach(p=>{
    const item=result.results&&result.results[p];
    if(!item){unavailable.push(p);fallbackByPlanet[p]=DIVISIONS.slice();errors.push((result.errors&&result.errors[p]&&result.errors[p].message)||p+' verification unavailable');return;}
    const supported=DIVISIONS.map(d=>item.divisions&&item.divisions[d.toLowerCase()]).filter(Boolean);
    const covered=supported.filter(x=>x.reference&&(x.status==='covered'||x.status==='coverage-open-ended'));
    const missingDivisions=DIVISIONS.filter(d=>{const row=item.divisions&&item.divisions[d.toLowerCase()];return !row||!row.reference||(row.status!=='covered'&&row.status!=='coverage-open-ended');});
    if(missingDivisions.length)fallbackByPlanet[p]=missingDivisions;
    if(covered.length===DIVISIONS.length)verified.push(p);
    else if(covered.length)partial.push(p);
    else unavailable.push(p);
    if(supported.some(x=>x.corrected))updated.push(p);
   });
   payload={results:result.results||{},verified,updated,unavailable,partial,fallbackByPlanet,errors,version:e.getDiagnostics().version};
   CACHE.set(cacheKey,payload);while(CACHE.size>40)CACHE.delete(CACHE.keys().next().value);
  }
  if(scope==='Natal'||scope==='Transit')latestByScope[scope]=payload;
  const out=makePositions(positions,payload.results),elapsed=nowMs()-start;
  if(token===requestSequence&&!options.silent)showStatus(payload,elapsed,scope);
  return{positions:out,results:payload.results,verified:payload.verified.slice(),updated:payload.updated.slice(),unavailable:(payload.unavailable||[]).slice(),partial:(payload.partial||[]).slice(),fallbackByPlanet:Object.assign({},payload.fallbackByPlanet||{}),errors:payload.errors.slice(),elapsedMs:elapsed,referenceVersion:payload.version};
 }catch(error){
  const elapsed=nowMs()-start;
  const failed={verified:[],updated:[],unavailable:PLANETS.slice(),partial:[],fallbackByPlanet:Object.fromEntries(PLANETS.map(p=>[p,DIVISIONS.slice()])),errors:[error.message]};
  if(scope==='Natal'||scope==='Transit')latestByScope[scope]=failed;
  if(token===requestSequence&&!options.silent)showStatus(failed,elapsed,scope);
  console.error('JupiterAstro planetary reference verification failed:',error);
  return{positions:Object.assign({},positions),results:{},verified:[],updated:[],unavailable:PLANETS.slice(),partial:[],errors:[error.message],elapsedMs:elapsed,referenceVersion:null};
 }
}
function getInterval(planet,division,timestamp){
 if(!engine)return null;
 const at=Number(timestamp);
 if(at!==timelineTimestamp){timelineTimestamp=at;timelineUpdated.clear();scheduleTimelineStatusRefresh();}
 try{
  const q=engine.getTransitReference(planet,division,at,longitudeAt,EPHEMERIS_VERSION,{hybridNavamsa:division==='Navamsa'&&(planet==='Sun'||planet==='Moon')});
  if(!q||q.startMs==null||q.endMs==null||!Number.isFinite(Number(q.startMs))||!Number.isFinite(Number(q.endMs)))return null;
  if(Number(q.startMs)>at||Number(q.endMs)<=at)return null;
  timelineUpdated.add(planet+' '+division);
  scheduleTimelineStatusRefresh();
  return{label:q.label||null,startMs:Number(q.startMs),endMs:Number(q.endMs),source:q.referenceSource||'json',derived:!!q.derived};
 }catch(e){return null;}
}
root.JAPlanetaryReconciliation=Object.freeze({
 version:'2.1.0',planets:PLANETS,divisions:DIVISIONS,init:getEngine,
 reconcilePositions,getInterval,showStatus:showStatus
});
})(window);
