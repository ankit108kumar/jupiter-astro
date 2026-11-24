/* JupiterAstro transit reference adapter — Phase 1
 * Keeps the application's ephemeris as the sole longitude calculator.
 * The separate JAPlanetaryReference module supplies reference labels and
 * ingress/egress intervals; Rahu/Ketu Navamsa is derived by its hybrid path.
 */
(function(root){
'use strict';
const PLANETS=['Saturn','Jupiter','Rahu','Ketu'];
const DIVISIONS=['Sign','Nakshatra','Navamsa'];
const SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const NAK=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const ORD=['First','Second','Third','Fourth'];
let enginePromise=null;
const rendered=new WeakMap();
function msToJd(ms){return Number(ms)/86400000+2440587.5;}
function longitudeAt(planet,timestampMs){
 if(typeof root.siderealPlanetLongitude!=='function')throw new Error('Existing siderealPlanetLongitude() is not available.');
 return root.siderealPlanetLongitude(planet,msToJd(timestampMs));
}
function currentLabels(planet,lon){
 const signIndex=Math.floor(lon/30);
 const nakSpan=360/27,nakIndex=Math.min(26,Math.floor(lon/nakSpan));
 const pada=Math.min(4,Math.floor((lon-nakIndex*nakSpan)/(nakSpan/4))+1);
 const navIndex=Math.floor(lon/(10/3))%12;
 return{
  Sign:SIGNS[signIndex]+' ('+(signIndex+1)+')',
  Nakshatra:NAK[nakIndex]+' '+ORD[pada-1]+' Pada',
  Navamsa:SIGNS[navIndex]+' ('+(navIndex+1)+')'
 };
}
function dateTime(ms){
 if(!Number.isFinite(ms))return '—';
 return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(ms));
}
function duration(ms){
 if(!Number.isFinite(ms)||ms<0)return '—';
 const total=Math.round(ms/60000),days=Math.floor(total/1440),hours=Math.floor((total%1440)/60),minutes=total%60;
 const parts=[];if(days)parts.push(days+'d');if(hours)parts.push(hours+'h');if(minutes||!parts.length)parts.push(minutes+'m');return parts.join(' ');
}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function rowHtml(planet,division,row){
 const q=row||{},available=!!q.reference;
 const entry=Number.isFinite(q.entryAtUTC)?q.entryAtUTC:null,exit=Number.isFinite(q.exitAtUTC)?q.exitAtUTC:null;
 const span=Number.isFinite(q.totalStayMs)?q.totalStayMs:(entry!==null&&exit!==null?exit-entry:null);
 const src=q.referenceSource==='json'?'JSON reference':q.derived?'Hybrid + ephemeris':q.referenceSource||'Unavailable';
 const status=available?(q.derived?'Derived':'Reference'):'Unavailable';
 return '<tr><td>'+esc(planet)+'</td><td>'+esc(division)+'</td><td>'+esc(q.final||'—')+'</td><td>'+esc(dateTime(entry))+'</td><td>'+esc(dateTime(exit))+'</td><td>'+esc(duration(span))+'</td><td>'+esc(src)+'</td><td>'+esc(status)+'</td></tr>';
}
async function render(host){
 if(!host||rendered.get(host)===host.dataset.evalMs)return;
 const timestamp=Number(host.dataset.evalMs);
 if(!Number.isFinite(timestamp))return;
 host.innerHTML='<div class="card ja-reference-reconciliation-card"><header><h3>Planetary Reference Reconciliation</h3></header><p>Loading reference intervals…</p></div>';
 try{
  if(!root.JAPlanetaryReference)throw new Error('Reconciliation engine script is not loaded.');
  if(!enginePromise){const engine=root.JAPlanetaryReference.create({url:'/data/Planetary%20Transit%20correction%20v4.json',cacheKey:'ja-transit-correction-v4-phase1'});enginePromise=engine.init().then(()=>engine);}
  const engine=await enginePromise;
  const calculated={};
  for(const planet of PLANETS){
   const lon=longitudeAt(planet,timestamp);
   calculated[planet]=currentLabels(planet,lon);
  }
  const result=await engine.verifyAll({
   timestamp,
   calculated,
   ephemerisLongitudeAt:longitudeAt,
   ephemerisVersion:'JupiterAstro-existing-sidereal-ephemeris'
  });
  const rows=[];
  for(const planet of PLANETS){
   const item=result.results&&result.results[planet];
   for(const division of DIVISIONS)rows.push(rowHtml(planet,division,item&&item.divisions&&item.divisions[division.toLowerCase()]));
  }
  const warnings=Object.values(result.errors||{}).map(x=>x.message);
  host.innerHTML='<div class="card ja-reference-reconciliation-card"><header><h3>Planetary Reference Reconciliation</h3><span class="sub">Evaluation: '+esc(dateTime(timestamp))+' IST</span></header><div class="scroll"><table><thead><tr><th>Planet</th><th>Division</th><th>Current</th><th>Entry (IST)</th><th>Exit (IST)</th><th>Duration</th><th>Source</th><th>Status</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>'+(warnings.length?'<p class="sub">Some planetary intervals could not be reconciled: '+esc(warnings.join('; '))+'</p>':'')+'</div>';
  rendered.set(host,host.dataset.evalMs);
  host.dataset.referenceVersion=engine.getDiagnostics().version||'';
  host.dataset.reconciliationStatus='ready';
 }catch(error){
  host.innerHTML='<div class="card ja-reference-reconciliation-card"><header><h3>Planetary Reference Reconciliation</h3></header><p>Unable to reconcile reference intervals: '+esc(error.message)+'</p></div>';
  host.dataset.reconciliationStatus='error';
  console.error('JupiterAstro reference reconciliation failed:',error);
 }
}
function scan(){
 document.querySelectorAll('.ja-transit-reference-reconciliation[data-eval-ms]').forEach(host=>render(host));
}
if(root.MutationObserver&&document.documentElement){
 new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();
root.JATransitReferenceReconciliation=Object.freeze({refresh:scan,version:'1.0.0'});
})(window);
