/* Jupiter Astrology — weekly Panchang detail popups */
(function(){
'use strict';
var DAY=86400000, DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var TN=['Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima'];
var CAT=['Nanda','Bhadra','Jaya','Rikta','Purna'], LORD={Nanda:'Venus',Bhadra:'Mercury',Jaya:'Mars',Rikta:'Saturn',Purna:'Jupiter'};
var PANCHANG_REFERENCE=null,REFERENCE_PROMISE=null;
function loadPanchangReference(){if(PANCHANG_REFERENCE)return Promise.resolve(PANCHANG_REFERENCE);if(!REFERENCE_PROMISE)REFERENCE_PROMISE=fetch('/data/panchang-reference.json',{cache:'force-cache'}).then(function(r){if(!r.ok)throw new Error('Panchang reference data unavailable ('+r.status+')');return r.json();}).then(function(data){PANCHANG_REFERENCE=data;window.JA_PANCHANG_REFERENCE=data;return data;}).catch(function(err){REFERENCE_PROMISE=null;throw err;});return REFERENCE_PROMISE;}
var modal,titleNode,subtitleNode,bodyNode,weekLabel,kind='tithi',activePanel='yoga',offset=0,dayOffset=0,ctx,windowMinimized=false;
var THEME_KEY='ja-transit-timeline-theme-mode',themeMode=(function(){try{return localStorage.getItem(THEME_KEY)==='apple'?'apple':'website';}catch(e){return 'website';}})();
function themeIconMarkup(mode){return mode==='apple'?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.6"></circle><path d="M12 2v2.1M12 19.9V22M4.93 4.93l1.48 1.48m11.18 11.18 1.48 1.48M2 12h2.1m15.8 0H22M4.93 19.07l1.48-1.48M17.59 6.41l1.48-1.48"></path></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"></rect><path d="M3 8h18M7 6h.01M10 6h.01M7 12h10M7 15.5h7"></path></svg>';}
function applyTheme(mode){if(!modal)return;var d=modal.querySelector('.ja-panchang-dialog');d.setAttribute('data-jtt-theme',mode);d.setAttribute('data-ja-panchang-theme',mode);var b=modal.querySelector('[data-theme-toggle]');if(b){b.innerHTML=themeIconMarkup(mode);b.title=mode==='apple'?'Apple Light is active · Switch to website theme':'Following website theme · Switch to Apple Light';b.setAttribute('aria-label',mode==='apple'?'Switch to website theme':'Switch to Apple Light mode');b.setAttribute('aria-pressed',mode==='apple'?'true':'false');}}
function setTheme(mode){themeMode=mode==='apple'?'apple':'website';try{localStorage.setItem(THEME_KEY,themeMode);}catch(e){}applyTheme(themeMode);}
function pad(n){return String(n).padStart(2,'0');}
function esc(s){return String(s==null?'—':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmt(ms,tz){var d=new Date(ms+tz*3600000);return pad(d.getUTCDate())+'/'+pad(d.getUTCMonth()+1)+'/'+d.getUTCFullYear()+' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes());}
function dayFmt(ms,tz){var d=new Date(ms+tz*3600000);return DAYS[d.getUTCDay()]+', '+pad(d.getUTCDate())+'/'+pad(d.getUTCMonth()+1)+'/'+d.getUTCFullYear();}
function context(){
 var q=window.state&&window.state.last&&window.state.last.input,y,m,d,hh,mm,ss,lat,lon,tz;
 if(q){y=+q.y;m=+q.m;d=+q.d;hh=+q.hh;mm=+q.mm;ss=+(q.ss||0);lat=+q.lat;lon=+q.lon;tz=+q.tz;}
 else{
  var p=(document.getElementById('dob')||{}).value||'',v=p.split(/[\/.-]/).map(Number),t=((document.getElementById('tob')||{}).value||'12:00:00').split(':').map(Number),now=new Date();
  if(v.length===3&&v.every(Number.isFinite)){d=v[0];m=v[1];y=v[2];}else{y=now.getFullYear();m=now.getMonth()+1;d=now.getDate();}
  hh=t[0]||0;mm=t[1]||0;ss=t[2]||0;
  var pob=document.getElementById('pob');lat=+(pob&&pob.dataset.lat||28.6139);lon=+(pob&&pob.dataset.lon||77.209);tz=+(pob&&pob.dataset.tz||5.5);
 }
 if(!Number.isFinite(tz))tz=5.5;
 return {tz:tz,lat:lat,lon:lon,instant:Date.UTC(y,m-1,d,hh,mm,ss)-tz*3600000};
}
function longitudes(ms){
 var jd=ms/86400000+2440587.5,dd=jd-2451543.5,sun=sunPos(dd),moon=moonLon(dd,sun),aya=lahiri(jd);
 return {sun:rev(sun.lon-aya),moon:rev(moon-aya)};
}
function indices(ms){var p=longitudes(ms);return {tithi:Math.min(29,Math.floor(rev(p.moon-p.sun)/12)),nak:Math.min(26,Math.floor(p.moon/(40/3)))};}
function name(k,i){if(k==='nak')return PANCHANG_REFERENCE.nakshatras[i].name;var n=i%15;return (i<15?'Shukla ':'Krishna ')+(n===14?(i<15?'Purnima':'Amavasya'):TN[n]);}
function meta(k,i){
 if(k==='nak'){var n=PANCHANG_REFERENCE.nakshatras[i];return [['Ruling Planet',n.lord],['Nakshatra Deity',n.deity],['Symbol',n.symbol],['Shape',n.shape],['Color',n.color],['Animals',n.animal],['Birds',n.bird],['Body Parts',n.bodyPart],['Nature',n.nature],['Object',n.object],['Category',n.category],['Naming Letters',n.letters.join(' · ')],['Associated Tree',n.tree],['Associated Flower',n.flower]];}
 var n=i%15,ref=PANCHANG_REFERENCE.tithis[n],planet=PANCHANG_REFERENCE.planets.find(function(p){return p.planet===ref.lord;});
 var category=CAT[n%5];
 return [['Tithi Category',category],['Tithi Lord',ref.lord],['Tithi Deity',ref.deity],['Planet Deity',planet?planet.deity:'—'],['Planet Nature',planet?planet.nature:'—']];
}
function bounds(){
 var local=new Date(ctx.instant+ctx.tz*3600000),wd=local.getUTCDay(),mid=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())-wd*DAY-ctx.tz*3600000+offset*7*DAY;
 return {start:mid,end:mid+7*DAY};
}
function transitions(start,end,k){
 var out=[],step=2*3600000,a=start,ia=indices(a)[k];
 for(var b=Math.min(a+step,end);;b=Math.min(b+step,end)){
  var ib=indices(b)[k];
  if(ib!==ia){var lo=a,hi=b;while(hi-lo>1000){var mid=Math.floor((lo+hi)/2);if(indices(mid)[k]===ia)lo=mid;else hi=mid;}out.push({at:hi,index:ib});ia=ib;}
  if(b===end)break;a=b;
 }
 return out;
}
function renderWeek(k){
 var w=bounds(),changes=transitions(w.start-2*DAY,w.end+2*DAY,k),cuts=[{at:w.start-2*DAY,index:indices(w.start-2*DAY)[k]}].concat(changes,[{at:w.end+2*DAY,index:indices(w.end+2*DAY)[k]}]);
 weekLabel.textContent='';
 var nowLocal=ctx.instant+ctx.tz*3600000,rows='',sample=meta(k,0),label=k==='tithi'?'Tithi':'Nakshatra';
 var headings=sample.map(function(x){return '<th>'+esc(x[0])+'</th>';}).join('');
 for(var day=0;day<7;day++){var ds=w.start+day*DAY,de=ds+DAY,today=nowLocal>=ds&&nowLocal<de,dd=new Date(ds+ctx.tz*3600000),dayLabel='<span>'+DAYS[dd.getUTCDay()]+'</span><small>'+pad(dd.getUTCDate())+'/'+pad(dd.getUTCMonth()+1)+'/'+dd.getUTCFullYear()+'</small>',dayRows=[];
  for(var j=0;j<cuts.length-1;j++){var a=cuts[j],b=cuts[j+1];if(b.at<=ds||a.at>=de)continue;var active=today&&ctx.instant>=a.at&&ctx.instant<b.at,fields=meta(k,a.index),cells=fields.map(function(x){return '<td>'+esc(x[1])+'</td>';}).join('');
   dayRows.push('<tr class="'+(active?'is-today':'')+'"><th>'+dayLabel+'</th><td><strong>'+esc(name(k,a.index))+'</strong>'+(active?' <em class="ja-panchang-now">Current</em>':'')+'</td><td class="ja-panchang-duration">'+fmt(a.at,ctx.tz)+' – '+fmt(b.at,ctx.tz)+'</td>'+cells+'</tr>');
  }
  if(!dayRows.length)dayRows.push('<tr class="'+(today?'is-today':'')+'"><th>'+dayLabel+'</th><td colspan="'+(2+sample.length)+'">—</td></tr>');
  rows+=dayRows.join('');
 }
 bodyNode.innerHTML='<div class="ja-panchang-table-wrap"><table class="ja-panchang-week-table ja-panchang-single-line ja-panchang-lunar-detail-table"><thead><tr><th>Day</th><th>'+label+'</th><th>Duration</th>'+headings+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function yogaKaranaIndex(ms,which){
 var p=longitudes(ms),sum=rev(p.sun+p.moon),diff=rev(p.moon-p.sun);
 return which==='yoga'?Math.floor(sum/(40/3))%27:Math.min(59,Math.floor(diff/6));
}
var YOGA_NAMES=['Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarma','Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra','Siddhi','Vyatipata','Variyana','Parigha','Shiva','Siddha','Sadhya','Shubha','Shukla','Brahma','Indra','Vaidhriti'];
var KARANA_NAMES=['Kimstughna','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Shakuni','Chatushpada','Naga'];
function eventName(which,i){return which==='yoga'?YOGA_NAMES[i]:KARANA_NAMES[i];}
function renderLunarWeek(){
 var w=bounds(),start=w.start-2*DAY,end=w.end+2*DAY,step=2*3600000,changes={yoga:[],karana:[]},current={yoga:yogaKaranaIndex(start,'yoga'),karana:yogaKaranaIndex(start,'karana')},a=start;
 for(var b=Math.min(a+step,end);;b=Math.min(b+step,end)){
  ['yoga','karana'].forEach(function(which){var ib=yogaKaranaIndex(b,which);if(ib!==current[which]){var lo=a,hi=b;while(hi-lo>1000){var mid=Math.floor((lo+hi)/2);if(yogaKaranaIndex(mid,which)===current[which])lo=mid;else hi=mid;}changes[which].push({at:hi,index:ib});current[which]=ib;}});
  if(b===end)break;a=b;
 }
 weekLabel.textContent='';
 function part(which){var cuts=[{at:start,index:yogaKaranaIndex(start,which)}].concat(changes[which],[{at:end,index:yogaKaranaIndex(end,which)}]),rows='',nowLocal=ctx.instant+ctx.tz*3600000;
  for(var day=0;day<7;day++){var ds=w.start+day*DAY,de=ds+DAY,today=nowLocal>=ds&&nowLocal<de,events='';
   for(var j=0;j<cuts.length-1;j++){var x=cuts[j],y=cuts[j+1];if(y.at<=ds||x.at>=de)continue;var active=today&&ctx.instant>=x.at&&ctx.instant<y.at;events+='<div class="ja-panchang-event'+(active?' is-active':'')+'"><strong>'+esc(eventName(which,x.index))+'</strong><span class="ja-panchang-duration">'+fmt(x.at,ctx.tz)+' – '+fmt(y.at,ctx.tz)+'</span>'+(active?'<em class="ja-panchang-now">Current</em>':'')+'</div>';}
   var dd=new Date(ds+ctx.tz*3600000);rows+='<tr class="'+(today?'is-today':'')+'"><th><span>'+DAYS[dd.getUTCDay()]+'</span><small>'+pad(dd.getUTCDate())+'/'+pad(dd.getUTCMonth()+1)+'</small></th><td>'+(events||'—')+'</td></tr>';
  }
  var heading=which==='yoga'?'Yoga':'Karana';return '<section class="ja-panchang-section ja-panchang-half"><h3>'+heading+'</h3><div class="ja-panchang-table-wrap"><table class="ja-panchang-week-table"><thead><tr><th>Day</th><th>'+heading+' · Duration</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
 }
 bodyNode.innerHTML='<div class="ja-panchang-dual-grid ja-panchang-lunar-grid">'+part('yoga')+part('karana')+'</div>';
}
function localDayStart(ms,tz){var d=new Date(ms+tz*3600000);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());}
function sunEventForLocalDay(localMidnight,lat,lon,isRise){
 var utcDate=new Date(localMidnight),utcMidnight=Date.UTC(utcDate.getUTCFullYear(),utcDate.getUTCMonth(),utcDate.getUTCDate());
 if(typeof sunCross==='function'&&typeof RAD!=='undefined'){
  try{var v=sunCross(utcMidnight,lat*RAD,lon*RAD,isRise);if(Number.isFinite(v)&&v>0)return v;}catch(e){}
 }
 return calculateSunEventUTC(utcMidnight,lat,lon,isRise);
}
function renderChaughadiyaHora(which){
 var localMid=localDayStart(ctx.instant,ctx.tz),todaySunrise=sunEventForLocalDay(localMid,ctx.lat,ctx.lon,true);
 if(ctx.instant<todaySunrise)localMid-=DAY;
 localMid+=dayOffset*DAY;
 var sunrise=sunEventForLocalDay(localMid,ctx.lat,ctx.lon,true),sunset=sunEventForLocalDay(localMid,ctx.lat,ctx.lon,false),nextSunrise=sunEventForLocalDay(localMid+DAY,ctx.lat,ctx.lon,true);
 if(![sunrise,sunset,nextSunrise].every(Number.isFinite)||sunrise>=sunset||sunset>=nextSunrise){
  weekLabel.textContent='';
  bodyNode.innerHTML='<div class="ja-panchang-current-summary"><strong>Unable to calculate this Panchang day.</strong><small>Check the selected location and date.</small></div>';return;
 }
 var localDate=new Date(sunrise+ctx.tz*3600000),wd=localDate.getUTCDay();
 weekLabel.textContent='';
 function table(title,slots){
  var rows=slots.map(function(x){var active=ctx.instant>=x.start&&ctx.instant<x.end;return '<tr class="'+(active?'is-today':'')+'"><td>'+x.label+(active?' <em class="ja-panchang-now">Now</em>':'')+'</td><td class="ja-panchang-duration">'+fmt(x.start,ctx.tz)+' – '+fmt(x.end,ctx.tz)+'</td></tr>';}).join('');
  return '<section class="ja-panchang-section"><h3>'+title+'</h3><div class="ja-panchang-table-wrap"><table class="ja-panchang-week-table ja-panchang-slots"><thead><tr><th>'+title+'</th><th>Duration</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
 }
 var cycle=['Udveg','Chal','Labh','Amrit','Kaal','Shubh','Rog'],dayStart=[0,3,6,2,5,1,4],lordStart={0:0,1:3,2:6,3:2,4:5,5:1,6:4},planets=['Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars'];
 var chSlots=[],horaSlots=[];
 function addPeriod(start,end,isDay){
  var duration=end-start,base=dayStart[wd],startIdx=isDay?base:(base+5)%7;
  for(var i=0;i<8;i++){var s=start+i*duration/8,e=start+(i+1)*duration/8,ix=(startIdx+i*(isDay?1:5))%7;chSlots.push({start:s,end:e,label:cycle[ix]+' · '+(isDay?'Day':'Night')+' '+(i+1)});}
  var lord=lordStart[wd],hd=duration/12,seq=isDay?lord:(lord+12)%7;
  for(var h=0;h<12;h++){var hs=start+h*hd,he=start+(h+1)*hd;horaSlots.push({start:hs,end:he,label:planets[(seq+h)%7]+' Hora · '+(isDay?'Day':'Night')+' '+(h+1)});}
 }
 addPeriod(sunrise,sunset,true);addPeriod(sunset,nextSunrise,false);
 var selected=table('Chaughadiya',chSlots)+table('Hora',horaSlots);bodyNode.innerHTML='<div class="ja-panchang-day-range"><span>Panchang day</span><strong>'+fmt(sunrise,ctx.tz)+' – '+fmt(nextSunrise,ctx.tz)+'</strong><small>Sunrise to immediately before the next sunrise · local chart time</small></div><div class="ja-panchang-dual-grid">'+selected+'</div>';
}
function renderInauspiciousWeek(){
 var w=bounds(),rahus=[8,2,7,5,6,4,3],guliks=[6,5,4,3,2,1,0],yamas=[4,3,2,1,0,6,5];
 weekLabel.textContent='';
 var nowLocal=ctx.instant+ctx.tz*3600000,rows='',weekDate=new Date(w.start+ctx.tz*3600000),firstMid=Date.UTC(weekDate.getUTCFullYear(),weekDate.getUTCMonth(),weekDate.getUTCDate());
 for(var day=0;day<7;day++){
  var localMid=firstMid+day*DAY,weekday=new Date(localMid).getUTCDay(),rise=sunEventForLocalDay(localMid,ctx.lat,ctx.lon,true),set=sunEventForLocalDay(localMid,ctx.lat,ctx.lon,false),valid=Number.isFinite(rise)&&Number.isFinite(set)&&rise>0&&set>rise,today=nowLocal>=localMid&&nowLocal<localMid+DAY,cols='';
  if(valid){
   var eighth=(set-rise)/8,entries=[rahus[weekday]-1,guliks[weekday],yamas[weekday]];
   cols=entries.map(function(slot){var st=rise+slot*eighth,en=st+eighth,active=ctx.instant>=st&&ctx.instant<en;return '<td><div class="ja-panchang-event'+(active?' is-active':'')+'"><div class="ja-panchang-duration">'+fmt(st,ctx.tz)+' – '+fmt(en,ctx.tz)+'</div>'+(active?'<em class="ja-panchang-now">Current</em>':'')+'</div></td>';}).join('');
  }else cols='<td colspan="3"><span class="ja-panchang-empty">Sunrise / sunset unavailable</span></td>';
  var dd=new Date(localMid);rows+='<tr class="'+(today?'is-today':'')+'"><th><span>'+DAYS[weekday]+'</span><small>'+pad(dd.getUTCDate())+'/'+pad(dd.getUTCMonth()+1)+'/'+dd.getUTCFullYear()+'</small></th>'+cols+'</tr>';
 }
 bodyNode.innerHTML='<div class="ja-panchang-table-wrap"><table class="ja-panchang-week-table ja-panchang-inauspicious-table"><thead><tr><th>Day</th><th>Rahu Kaal</th><th>Gulika Kaal</th><th>Yamghanta (Yamaganda)</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function transitHouseAt(ms){
 var local=new Date(ms+ctx.tz*3600000),chart=computeChart({y:local.getUTCFullYear(),m:local.getUTCMonth()+1,d:local.getUTCDate(),hh:local.getUTCHours(),mm:local.getUTCMinutes(),ss:local.getUTCSeconds(),tz:ctx.tz,lat:ctx.lat,lon:ctx.lon});
 var jup=chart.planets.Jupiter&&chart.planets.Jupiter.lon;
 if(!Number.isFinite(jup)||!Number.isFinite(chart.asc))return null;
 return ((Math.floor(jup/30)-Math.floor(chart.asc/30)+12)%12)+1;
}
function transitHouseIntervals(start,end,wanted){
 var step=10*60000,items=[],a=start,ha=transitHouseAt(a);
 for(var b=Math.min(a+step,end);;b=Math.min(b+step,end)){
  var hb=transitHouseAt(b);
  if(hb!==ha){
   var lo=a,hi=b;
   while(hi-lo>1000){var mid=Math.floor((lo+hi)/2);if(transitHouseAt(mid)===ha)lo=mid;else hi=mid;}
   if(wanted.indexOf(ha)>=0)items.push({house:ha,start:items._open||a,end:hi});
   items._open=null;
   if(wanted.indexOf(hb)>=0)items._open=hi;
   ha=hb;
  }
  if(b===end)break;a=b;
 }
 if(wanted.indexOf(ha)>=0)items.push({house:ha,start:items._open||a,end:end});
 return items;
}
function renderAuspiciousWeek(){
 var w=bounds(),wanted=[1,5,7,9],rows='';
 weekLabel.textContent='';
 var nowLocal=ctx.instant+ctx.tz*3600000,firstLocal=new Date(w.start+ctx.tz*3600000),firstMid=Date.UTC(firstLocal.getUTCFullYear(),firstLocal.getUTCMonth(),firstLocal.getUTCDate());
 for(var day=0;day<7;day++){
  var localMid=firstMid+day*DAY,weekday=new Date(localMid).getUTCDay(),rise=sunEventForLocalDay(localMid,ctx.lat,ctx.lon,true),set=sunEventForLocalDay(localMid,ctx.lat,ctx.lon,false),nextRise=sunEventForLocalDay(localMid+DAY,ctx.lat,ctx.lon,true),today=nowLocal>=localMid&&nowLocal<localMid+DAY,dayCell='',nightCell='',jupiterCell='';
  if(Number.isFinite(rise)&&Number.isFinite(set)&&Number.isFinite(nextRise)&&rise<set&&set<nextRise){
   var dayDur=set-rise,nightDur=nextRise-set,dayStart=rise+7*dayDur/15,dayEnd=rise+8*dayDur/15,nightStart=set+7*nightDur/15,nightEnd=set+8*nightDur/15;
   function periodCell(start,end){var active=ctx.instant>=start&&ctx.instant<end;return '<div class="ja-panchang-event'+(active?' is-active':'')+'"><div class="ja-panchang-duration">'+fmt(start,ctx.tz)+' – '+fmt(end,ctx.tz)+'</div>'+(active?'<em class="ja-panchang-now">Current</em>':'')+'</div>';}
   dayCell=periodCell(dayStart,dayEnd);nightCell=periodCell(nightStart,nightEnd);
   var utcDayStart=localMid-ctx.tz*3600000,intervals=transitHouseIntervals(utcDayStart,utcDayStart+DAY,wanted);
   jupiterCell=intervals.map(function(x){var active=ctx.instant>=x.start&&ctx.instant<x.end;return '<div class="ja-panchang-event'+(active?' is-active':'')+'"><strong> '+({1:'Lagna (1st)',5:'5th',7:'7th',9:'9th'}[x.house])+' House</strong><div class="ja-panchang-duration">'+fmt(x.start,ctx.tz)+' – '+fmt(x.end,ctx.tz)+'</div>'+(active?'<em class="ja-panchang-now">Current</em>':'')+'</div>';}).join('')||'<span class="ja-panchang-empty">No selected-house transit</span>';
  }else{
   var unavailable='<span class="ja-panchang-empty">Sunrise / sunset unavailable</span>';
   dayCell=nightCell=jupiterCell=unavailable;
  }
  var dd=new Date(localMid);
  rows+='<tr class="'+(today?'is-today':'')+'"><th><span>'+DAYS[weekday]+'</span><small>'+pad(dd.getUTCDate())+'/'+pad(dd.getUTCMonth()+1)+'/'+dd.getUTCFullYear()+'</small></th><td>'+dayCell+'</td><td>'+nightCell+'</td><td>'+jupiterCell+'</td></tr>';
 }
 bodyNode.innerHTML='<div class="ja-panchang-table-wrap"><table class="ja-panchang-week-table ja-panchang-auspicious-table"><thead><tr><th>Day</th><th>Day Abhijit Muhurta</th><th>Night Abhijit Muhurta</th><th>Jupiter Transit (House Periods)</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="ja-panchang-note">Night Abhijit is shown as the 8th equal Muhurta of the night (sunset to next sunrise). Jupiter house periods are calculated from the sidereal transit chart ascendant at the selected location; intervals are split at house changes.</p>';
}
var LAGNA_LORDS=['Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Mars','Jupiter','Saturn','Saturn','Jupiter'];
var LAGNA_TYPES=['Movable','Fixed','Dual','Movable','Fixed','Dual','Movable','Fixed','Dual','Movable','Fixed','Dual'];
function ascSignAt(ms){
 var d=new Date(ms+ctx.tz*3600000),hours=d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600;
 var jd=julianDay(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),hours-ctx.tz);
 var asc=rev(ascendant(jd,ctx.lat,ctx.lon)-lahiri(jd));
 return {sign:Math.floor(asc/30),asc:asc,jd:jd};
}
function renderSunriseLagnaDay(){
 var localMid=localDayStart(ctx.instant,ctx.tz),probe=sunEventForLocalDay(localMid,ctx.lat,ctx.lon,true);if(ctx.instant<probe)localMid-=DAY;localMid+=dayOffset*DAY;
 var sunrise=sunEventForLocalDay(localMid,ctx.lat,ctx.lon,true),nextSunrise=sunEventForLocalDay(localMid+DAY,ctx.lat,ctx.lon,true);
 if(!Number.isFinite(sunrise)||!Number.isFinite(nextSunrise)||sunrise>=nextSunrise){weekLabel.textContent='Sunrise data unavailable';bodyNode.innerHTML='<div class="ja-panchang-current-summary"><strong>Unable to calculate the rising Lagna table.</strong><small>Check the selected location and date.</small></div>';return;}
 var currentSign=ascSignAt(sunrise).sign,segmentStart=sunrise,rows=[],step=5*60000;
 for(var t=sunrise+step;t<=nextSunrise;t+=step){var checkTime=Math.min(t,nextSunrise),nextSign=ascSignAt(checkTime).sign;if(nextSign!==currentSign){var lo=segmentStart,hi=checkTime;while(hi-lo>1000){var mid=Math.floor((lo+hi)/2);if(ascSignAt(mid).sign===currentSign)lo=mid;else hi=mid;}rows.push({sign:currentSign,start:segmentStart,end:hi});segmentStart=hi;currentSign=nextSign;}if(checkTime===nextSunrise)break;}
 if(segmentStart<nextSunrise)rows.push({sign:currentSign,start:segmentStart,end:nextSunrise});weekLabel.textContent='';
 var bodyRows='',offsets={Sun:[7],Moon:[7],Mars:[4,7,8],Mercury:[7],Jupiter:[5,7,9],Venus:[7],Saturn:[3,7,10],Rahu:[5,7,9],Ketu:[5,7,9]},names=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu'];
 rows.forEach(function(row){var mid=Math.floor((row.start+row.end)/2),d=new Date(mid+ctx.tz*3600000),hours=d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600,jd=julianDay(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),hours-ctx.tz),lord=LAGNA_LORDS[row.sign],positions=siderealAt(jd).planets,lordLon=positions[lord]&&positions[lord].lon,lordSign=Number.isFinite(lordLon)?Math.floor(lordLon/30):-1,house=lordSign>=0?((lordSign-row.sign+12)%12)+1:null,houseText=house?(house===1?'1st':house===2?'2nd':house===3?'3rd':house+'th')+' house':'—',conjunctions=[],aspectedBy=[],inLagna=[],aspecting=[];
  names.forEach(function(p){var pl=positions[p],sign=Number.isFinite(pl&&pl.lon)?Math.floor(pl.lon/30):-1;if(sign<0)return;if(sign===row.sign)inLagna.push(p);var asp=offsets[p]||[7],houseFrom=((row.sign-sign+12)%12)+1;if(asp.indexOf(houseFrom)>=0)aspecting.push(p);if(p===lord||lordSign<0)return;if(sign===lordSign)conjunctions.push(p);var lordHouse=((lordSign-sign+12)%12)+1;if(asp.indexOf(lordHouse)>=0)aspectedBy.push(p);});
  var active=ctx.instant>=row.start&&ctx.instant<row.end;bodyRows+='<tr class="'+(active?'is-today':'')+'"><td><strong>'+SIGNS[row.sign][0]+'</strong><small>'+SIGNS[row.sign][1]+'</small></td><td class="ja-panchang-duration">'+fmtClock(row.start,ctx.tz)+' – '+fmtClock(row.end,ctx.tz)+(active?' <em class="ja-panchang-now">Now</em>':'')+'</td><td>'+LAGNA_TYPES[row.sign]+'</td><td>'+lord+'</td><td>'+houseText+'</td><td>'+ (conjunctions.length?conjunctions.join(', '):'—') +'</td><td>'+ (aspectedBy.length?aspectedBy.join(', '):'—') +'</td><td>'+ (inLagna.length?inLagna.join(', '):'—') +'</td><td>'+ (aspecting.length?aspecting.join(', '):'—') +'</td></tr>';
 });
 bodyNode.innerHTML='<div class="ja-panchang-table-wrap ja-panchang-lagna-wrap"><table class="ja-panchang-week-table ja-panchang-lagna-table"><thead><tr><th>Sign</th><th>Duration</th><th>Category</th><th>Lagna Lord</th><th>Lord Placement</th><th>Conjunction with Lord</th><th>Aspected by</th><th>Planets in Lagna</th><th>Planets Aspecting Lagna</th></tr></thead><tbody>'+bodyRows+'</tbody></table></div>';
}
function fmtClock(ms,tz){var d=new Date(ms+tz*3600000);return pad(d.getUTCHours())+':'+pad(d.getUTCMinutes());}
function renderOther(k){
 if(k==='inauspicious'){renderInauspiciousWeek();return;}
 if(k==='abhijit'){renderAuspiciousWeek();return;}
}
function panelTabs(items){return '<div class="ja-panchang-panel-tabs">'+items.map(function(x){var label=x.charAt(0).toUpperCase()+x.slice(1);return '<button type="button" data-panel="'+x+'" class="'+(activePanel===x?'is-active':'')+'">'+label+'</button>';}).join('')+'</div>';}
var renderCache=Object.create(null),renderCacheOrder=[];
function render(){
 var cacheKey=ctx?JSON.stringify([kind,ctx.instant,ctx.lat,ctx.lon,ctx.tz,offset,dayOffset]):'';
 if(cacheKey&&Object.prototype.hasOwnProperty.call(renderCache,cacheKey)){var cached=renderCache[cacheKey];bodyNode.innerHTML=cached.html;weekLabel.textContent=cached.label;return;}
 if(kind==='sun')renderSunriseLagnaDay();else if(kind==='tithi'||kind==='nak')renderWeek(kind);else if(kind==='yogaGroup')renderLunarWeek();else if(kind==='chaughadiyaGroup')renderChaughadiyaHora('chaughadiya');else renderOther(kind);
 if(cacheKey){renderCache[cacheKey]={html:bodyNode.innerHTML,label:weekLabel.textContent};renderCacheOrder.push(cacheKey);if(renderCacheOrder.length>24){delete renderCache[renderCacheOrder.shift()];}}
}
function close(){modal.hidden=true;document.body.classList.remove('ja-panchang-modal-open');windowMinimized=false;modal.querySelector('.ja-panchang-dialog').classList.remove('is-minimized','is-maximized');}
async function open(k){
 var authUser=window.jaAuthUser||(window.firebaseAuth&&window.firebaseAuth.currentUser)||null;
 if(!authUser&&window.jaAuthReady&&typeof window.jaAuthReady.then==='function'){
  try{authUser=await window.jaAuthReady;}catch(_){authUser=null;}
 }
 if(!authUser)return;
 try{await loadPanchangReference();}catch(err){console.error('Panchang reference data could not be loaded:',err);return;}
 ctx=context();kind=k;offset=0;dayOffset=0;modal.setAttribute('data-ja-panchang-kind',k);modal.querySelector('.ja-panchang-dialog').classList.remove('is-minimized','is-maximized');
 var titles={sun:'Sunrise / Sunset — Daily Lagna Details',tithi:'Tithi — Weekly Details',nak:'Nakshatra — Weekly Details',yogaGroup:'Yoga & Karana — Weekly Details',chaughadiyaGroup:'Chaughadiya & Hora — Panchang Day',inauspicious:'Inauspicious Periods',abhijit:'Abhijit Muhurta'};
 titleNode.textContent=titles[k]||'Panchang Details';modal.querySelector('.ja-panchang-dialog').dataset.kind=k;modal.querySelector('.ja-panchang-dialog').classList.remove('is-minimized','is-maximized');windowMinimized=false;activePanel=k==='chaughadiyaGroup'?'chaughadiya':k==='yogaGroup'?'yoga':activePanel;subtitleNode.textContent=(k==='chaughadiyaGroup'||k==='sun')?'Sunrise to next sunrise · Local time at the selected chart location':'Sunday to Saturday · Local time at the selected chart location';
 var nav=modal.querySelector('.ja-panchang-week-nav');nav.classList.toggle('is-day-nav',k==='chaughadiyaGroup'||k==='sun');nav.querySelector('[data-week="-1"]').innerHTML=(k==='chaughadiyaGroup'||k==='sun')?'← <span>Previous Day</span>':'← <span>Previous Week</span>';nav.querySelector('[data-week="1"]').innerHTML=(k==='chaughadiyaGroup'||k==='sun')?'<span>Next Day</span> →':'<span>Next Week</span> →';
 render();modal.hidden=false;document.body.classList.add('ja-panchang-modal-open');modal.querySelector('.ja-panchang-dialog').focus();
}
function init(){
 modal=document.createElement('div');modal.id='jaPanchangDetailsModal';modal.className='ja-panchang-modal';modal.hidden=true;
 modal.innerHTML='<div class="ja-panchang-backdrop" data-close="1"></div><section class="ja-panchang-dialog" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="jaPanchangTitle"><header class="ja-panchang-titlebar" data-ja-panchang-drag><div class="ja-panchang-window-controls"><button type="button" class="ja-panchang-dot close" data-close="1" aria-label="Close"></button><button type="button" class="ja-panchang-dot minimize" data-minimize aria-label="Minimize"></button><button type="button" class="ja-panchang-dot maximize" data-maximize aria-label="Maximize"></button></div><div class="ja-panchang-window-title">Jupiter Astrology · Panchang</div><div class="ja-panchang-title-tools"><button type="button" class="jtt-theme-toggle ja-panchang-theme-toggle" data-theme-toggle title="Switch appearance" aria-label="Switch appearance" aria-pressed="false"></button></div></header><div class="ja-panchang-heading"><div class="ja-panchang-heading-row"><div><h2 id="jaPanchangTitle"></h2><p id="jaPanchangSubtitle"></p></div><div class="ja-panchang-week-nav"><button type="button" data-week="-1">← <span>Previous</span></button><span id="jaPanchangWeekLabel" hidden></span><button type="button" data-week="1"><span>Next</span> →</button></div></div></div><div class="ja-panchang-dialog-body" id="jaPanchangDialogBody"></div></section>';
 document.body.appendChild(modal);applyTheme(themeMode);titleNode=modal.querySelector('#jaPanchangTitle');subtitleNode=modal.querySelector('#jaPanchangSubtitle');bodyNode=modal.querySelector('#jaPanchangDialogBody');weekLabel=modal.querySelector('#jaPanchangWeekLabel');
 modal.addEventListener('click',function(e){var c=e.target.closest('[data-close]'),n=e.target.closest('[data-week]'),d=modal.querySelector('.ja-panchang-dialog');if(c)close();else if(e.target.closest('[data-minimize]')){windowMinimized=!windowMinimized;d.classList.remove('is-maximized');d.classList.toggle('is-minimized',windowMinimized);}else if(e.target.closest('[data-maximize]')){windowMinimized=false;d.classList.remove('is-minimized');d.classList.toggle('is-maximized');}else if(e.target.closest('[data-theme-toggle]'))setTheme(themeMode==='apple'?'website':'apple');else if(n){if(kind==='chaughadiyaGroup'||kind==='sun')dayOffset+=Number(n.dataset.week);else offset+=Number(n.dataset.week);render();}});
 var dragHandle=modal.querySelector('[data-ja-panchang-drag]'),dragState=null;
 dragHandle.addEventListener('pointerdown',function(e){if(e.target.closest('button')||modal.querySelector('.ja-panchang-dialog').classList.contains('is-maximized'))return;var box=modal.querySelector('.ja-panchang-dialog').getBoundingClientRect();dragState={x:e.clientX,y:e.clientY,left:box.left,top:box.top};dragHandle.setPointerCapture(e.pointerId);});
 dragHandle.addEventListener('pointermove',function(e){if(!dragState)return;var d=modal.querySelector('.ja-panchang-dialog');d.style.position='fixed';d.style.margin='0';d.style.left=Math.max(8,Math.min(window.innerWidth-d.offsetWidth-8,dragState.left+e.clientX-dragState.x))+'px';d.style.top=Math.max(8,Math.min(window.innerHeight-d.offsetHeight-8,dragState.top+e.clientY-dragState.y))+'px';});
 function stopPanchangDrag(){dragState=null;}
 dragHandle.addEventListener('pointerup',stopPanchangDrag);dragHandle.addEventListener('pointercancel',stopPanchangDrag);
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden)close();});
 var cards=document.querySelectorAll('#panchangCardBlock .panchang-item'),kinds=['date','sun','tithi','nak','yogaGroup','chaughadiyaGroup','inauspicious','abhijit'];
 Array.prototype.forEach.call(cards,function(card,i){if(i===0)return;var k=kinds[i];card.classList.add('ja-panchang-clickable');card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-haspopup','dialog');card.addEventListener('click',function(){open(k);});card.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open(k);}});});

}
document.addEventListener('ja-panchang-open',function(e){var k=e&&e.detail&&e.detail.kind;if(k)open(k);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();