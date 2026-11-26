/* Jupiter Astrology — weekly Panchang detail popups */
(function(){
'use strict';
var DAY=86400000, DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var TN=['Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima'];
var CAT=['Nanda','Bhadra','Jaya','Rikta','Purna'], LORD={Nanda:'Venus',Bhadra:'Mercury',Jaya:'Mars',Rikta:'Saturn',Purna:'Jupiter'};
var PANCHANG_REFERENCE=null,REFERENCE_PROMISE=null;
function loadPanchangReference(){if(PANCHANG_REFERENCE)return Promise.resolve(PANCHANG_REFERENCE);if(!REFERENCE_PROMISE)REFERENCE_PROMISE=fetch('/data/panchang-reference.json',{cache:'force-cache'}).then(function(r){if(!r.ok)throw new Error('Panchang reference data unavailable ('+r.status+')');return r.json();}).then(function(data){PANCHANG_REFERENCE=data;window.JA_PANCHANG_REFERENCE=data;return data;}).catch(function(err){REFERENCE_PROMISE=null;throw err;});return REFERENCE_PROMISE;}
var modal,launcher,titleNode,windowTitleNode,subtitleNode,bodyNode,weekLabel,kind='tithi',activePanel='yoga',offset=0,dayOffset=0,ctx,windowMinimized=false;
var THEME_KEY='ja-transit-timeline-theme-mode',themeMode=(function(){try{return localStorage.getItem(THEME_KEY)==='apple'?'apple':'website';}catch(e){return 'website';}})();
function themeIconMarkup(mode){return mode==='apple'?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.6"></circle><path d="M12 2v2.1M12 19.9V22M4.93 4.93l1.48 1.48m11.18 11.18 1.48 1.48M2 12h2.1m15.8 0H22M4.93 19.07l1.48-1.48M17.59 6.41l1.48-1.48"></path></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"></rect><path d="M3 8h18M7 6h.01M10 6h.01M7 12h10M7 15.5h7"></path></svg>';}
function applyTheme(mode){if(!modal)return;var d=modal.querySelector('.ja-panchang-dialog');d.setAttribute('data-jtt-theme',mode);d.setAttribute('data-ja-panchang-theme',mode);var b=modal.querySelector('[data-theme-toggle]');if(b){b.innerHTML=themeIconMarkup(mode);b.title=mode==='apple'?'Apple Light is active · Switch to website theme':'Following website theme · Switch to Apple Light';b.setAttribute('aria-label',mode==='apple'?'Switch to website theme':'Switch to Apple Light mode');b.setAttribute('aria-pressed',mode==='apple'?'true':'false');}}
function setTheme(mode){themeMode=mode==='apple'?'apple':'website';try{localStorage.setItem(THEME_KEY,themeMode);}catch(e){}applyTheme(themeMode);}
function timelineThemeIcon(mode){return mode==='apple'?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.6"></circle><path d="M12 2v2.1M12 19.9V22M4.93 4.93l1.48 1.48m11.18 11.18 1.48 1.48M2 12h2.1m15.8 0H22M4.93 19.07l1.48-1.48M17.59 6.41l1.48-1.48"></path></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"></rect><path d="M3 8h18M7 6h.01M10 6h.01M7 12h10M7 15.5h7"></path></svg>';}
function pad(n){return String(n).padStart(2,'0');}
function esc(s){return String(s==null?'—':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function localDateParts(ms,tz){var d=new Date(ms+tz*3600000);return {day:pad(d.getUTCDate()),month:d.getUTCMonth(),year:d.getUTCFullYear(),key:d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate()),clock:pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())};}
var MONTH_SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatPanchangInterval(startMs,endMs,tz,anchorMs){
 var start=localDateParts(startMs,tz),end=localDateParts(endMs,tz),anchor=Number.isFinite(anchorMs)?localDateParts(anchorMs,tz):null;
 var sameDate=start.key===end.key,showDates=!sameDate||(anchor&&(start.key!==anchor.key||end.key!==anchor.key));
 var showYear=start.year!==end.year;
 function endpoint(part){
  var dateText=part.day+'-'+MONTH_SHORT[part.month]+(showYear?'-'+part.year:'');
  var dateHtml=showDates?'<span class="ja-panchang-date'+(sameDate?' ja-panchang-date-muted':'')+'">'+dateText+'</span> ':'';
  var timeClass='ja-panchang-time'+(sameDate?'':' ja-panchang-time-muted');
  return dateHtml+'<span class="'+timeClass+'">'+part.clock+'</span>';
 }
 return endpoint(start)+' <span class="ja-panchang-range-separator">–</span> '+endpoint(end);
}
function fmt(ms,tz){var p=localDateParts(ms,tz);return p.day+'/'+pad(p.month+1)+'/'+p.year+' '+p.clock;}
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
 if(k==='nak'){var n=PANCHANG_REFERENCE.nakshatras[i];return [['Ruling Planet',n.lord],['Nakshatra Deity',n.deity]];}
 var n=i%15,ref=PANCHANG_REFERENCE.tithis[n],planet=PANCHANG_REFERENCE.planets.find(function(p){return p.planet===ref.lord;});
 var category=CAT[n%5];
 return [['Tithi Quality',category],['Tithi Lord',ref.lord],['Tithi Deity',ref.deity]];
}
function bounds(){
 var localMid=localDayStart(ctx.instant,ctx.tz),localDate=new Date(localMid),sundayMid=localMid-localDate.getUTCDay()*DAY;
 var firstSunrise=sunEventForLocalDay(sundayMid,ctx.lat,ctx.lon,true);
 if(!Number.isFinite(firstSunrise))return {start:NaN,end:NaN,days:[]};
 if(ctx.instant<firstSunrise)sundayMid-=7*DAY;
 sundayMid+=offset*7*DAY;
 var boundaries=[],days=[];
 for(var i=0;i<=7;i++){var dateToken=sundayMid+i*DAY,rise=sunEventForLocalDay(dateToken,ctx.lat,ctx.lon,true);if(!Number.isFinite(rise)||rise<=0)return {start:NaN,end:NaN,days:[]};boundaries.push({localMid:dateToken,start:rise,weekday:new Date(dateToken).getUTCDay()});}
 for(var j=0;j<7;j++){if(boundaries[j].start>=boundaries[j+1].start)return {start:NaN,end:NaN,days:[]};days.push({localMid:boundaries[j].localMid,start:boundaries[j].start,end:boundaries[j+1].start,weekday:boundaries[j].weekday});}
 return {start:days[0].start,end:days[6].end,days:days};
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
 var w=bounds();
 if(!w.days.length){bodyNode.innerHTML='<div class="ja-panchang-current-summary"><strong>Sunrise data unavailable.</strong><small>Check the selected location and date.</small></div>';return;}
 var changes=transitions(w.start-2*DAY,w.end+2*DAY,k),cuts=[{at:w.start-2*DAY,index:indices(w.start-2*DAY)[k]}].concat(changes,[{at:w.end+2*DAY,index:indices(w.end+2*DAY)[k]}]);
 weekLabel.textContent='';
 var nowLocal=ctx.instant+ctx.tz*3600000,rows='',sample=meta(k,0),label=k==='tithi'?'Tithi':'Nakshatra';
 var headings=sample.map(function(x){return '<th>'+esc(x[0])+'</th>';}).join('');
 if(!w.days.length){bodyNode.innerHTML='<div class="ja-panchang-current-summary"><strong>Sunrise data unavailable.</strong><small>Check the selected location and date.</small></div>';return;}
 for(var day=0;day<7;day++){var dayInfo=w.days[day],ds=dayInfo.start,de=dayInfo.end,today=ctx.instant>=ds&&ctx.instant<de,dd=new Date(ds+ctx.tz*3600000),dayLabel='<span>'+DAYS[dd.getUTCDay()]+'</span><small>'+pad(dd.getUTCDate())+'/'+pad(dd.getUTCMonth()+1)+'/'+dd.getUTCFullYear()+'</small>',dayRows=[];
  for(var j=0;j<cuts.length-1;j++){var a=cuts[j],b=cuts[j+1];if(b.at<=ds||a.at>=de)continue;var active=today&&ctx.instant>=a.at&&ctx.instant<b.at,fields=meta(k,a.index),cells=fields.map(function(x){var value=(x[0]==='Ruling Planet'||x[0]==='Tithi Lord')?planetMarkup(x[1]):esc(x[1]);return '<td>'+value+'</td>';}).join('');
   var nakCell=k==='nak'?'<span class="ja-nakshatra-hover" tabindex="0" data-nakshatra-name="'+esc(name(k,a.index))+'">'+esc(name(k,a.index))+'</span>': '<strong>'+esc(name(k,a.index))+'</strong>';dayRows.push('<tr class="'+(active?'is-today':'')+'"><th>'+dayLabel+'</th><td>'+nakCell+(active?' <em class="ja-panchang-now">Current</em>':'')+'</td><td class="ja-panchang-duration">'+formatPanchangInterval(a.at,b.at,ctx.tz,ds)+'</td>'+cells+'</tr>');
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
var YOGA_MEANINGS=[
 'Door bolt/supporting pillar','Love/affection','Long-lived',
 'Long life of spouse (good fortune)','Splendid, bright','Great danger',
 'One with good deeds','Firmness','Shiva’s weapon of destruction (pain)',
 'Danger','Growth','Fixed, constant','Great blow','Cheerful',
 'Diamond (strong)','Accomplishment','Great fall','Chief/best',
 'Obstacle/hindrance','Lord Shiva (purity)','Accomplished/ready',
 'Possible','Auspicious','White, bright',
 'Creator (good knowledge and purity)','Ruler of gods','A class of gods'
];
var KARANA_NAMES=['Kimstughna','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Shakuni','Chatushpada','Naga'];
function eventName(which,i){return which==='yoga'?YOGA_NAMES[i]:KARANA_NAMES[i];}
function planetMarkup(name){var palette=window.JA_PLANET_COLORS||{},color=palette[name];return color?'<span class="ja-panchang-planet-name" style="--ja-planet-color:'+color+'">'+esc(name)+'</span>':esc(name);}
function planetMarkupShort(name){var shortNames={Sun:'Su',Moon:'Mo',Mars:'Ma',Mercury:'Me',Jupiter:'Ju',Venus:'Ve',Saturn:'Sa',Rahu:'Ra',Ketu:'Ke'},palette=window.JA_PLANET_COLORS||{},color=palette[name],label=shortNames[name]||name;return color?'<span class="ja-panchang-planet-name" style="--ja-planet-color:'+color+'" title="'+esc(name)+'">'+esc(label)+'</span>':esc(label);}
function renderLunarWeek(){
 var w=bounds();
 if(!w.days.length){bodyNode.innerHTML='<div class="ja-panchang-current-summary"><strong>Sunrise data unavailable.</strong><small>Check the selected location and date.</small></div>';return;}
 var start=w.start-2*DAY,end=w.end+2*DAY,step=2*3600000,changes={yoga:[],karana:[]},current={yoga:yogaKaranaIndex(start,'yoga'),karana:yogaKaranaIndex(start,'karana')},a=start;
 for(var b=Math.min(a+step,end);;b=Math.min(b+step,end)){
  ['yoga','karana'].forEach(function(which){var ib=yogaKaranaIndex(b,which);if(ib!==current[which]){var lo=a,hi=b;while(hi-lo>1000){var mid=Math.floor((lo+hi)/2);if(yogaKaranaIndex(mid,which)===current[which])lo=mid;else hi=mid;}changes[which].push({at:hi,index:ib});current[which]=ib;}});
  if(b===end)break;a=b;
 }
 weekLabel.textContent='';
 function part(which){var cuts=[{at:start,index:yogaKaranaIndex(start,which)}].concat(changes[which],[{at:end,index:yogaKaranaIndex(end,which)}]),rows='',nowLocal=ctx.instant+ctx.tz*3600000;
  if(!w.days.length){bodyNode.innerHTML='<div class="ja-panchang-current-summary"><strong>Sunrise data unavailable.</strong><small>Check the selected location and date.</small></div>';return;}
   for(var day=0;day<7;day++){var dayInfo=w.days[day],ds=dayInfo.start,de=dayInfo.end,today=ctx.instant>=ds&&ctx.instant<de,events='';
   for(var j=0;j<cuts.length-1;j++){var x=cuts[j],y=cuts[j+1];if(y.at<=ds||x.at>=de)continue;var active=today&&ctx.instant>=x.at&&ctx.instant<y.at;events+='<div class="ja-panchang-event'+(active?' is-active':'')+'"><strong>'+esc(eventName(which,x.index))+'</strong>'+(which==='yoga'&&YOGA_MEANINGS[x.index]?' <small class="ja-panchang-yoga-meaning">('+esc(YOGA_MEANINGS[x.index])+')</small>':'')+'<span class="ja-panchang-duration">'+formatPanchangInterval(x.at,y.at,ctx.tz,ds)+'</span>'+(active?'<em class="ja-panchang-now">Current</em>':'')+'</div>';}
   var dd=new Date(ds+ctx.tz*3600000);rows+='<tr class="'+(today?'is-today':'')+'"><th><span>'+DAYS[dayInfo.weekday]+'</span><small>'+pad(dd.getUTCDate())+'/'+pad(dd.getUTCMonth()+1)+'/'+dd.getUTCFullYear()+'</small></th><td>'+(events||'—')+'</td></tr>';
  }
  var heading=which==='yoga'?'Yoga':'Karana';return '<section class="ja-panchang-section ja-panchang-half"><div class="ja-panchang-table-wrap"><table class="ja-panchang-week-table"><thead><tr><th>Day</th><th>'+heading+' · Duration</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
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
  var rows=slots.map(function(x){var active=ctx.instant>=x.start&&ctx.instant<x.end,label=x.primary||x.label,meta=x.meta||'',periodName=String(x.primary||x.label||''),periodClass=/^(Udveg|Kaal|Rog)$/.test(periodName)?' ja-panchang-period-inauspicious':(/^(Shubh|Amrit|Labh)$/.test(periodName)?' ja-panchang-period-auspicious':'');return '<tr class="'+(active?'is-today':'')+periodClass+'"><td><span class="ja-panchang-slot-main">'+label+'</span>'+(x.trait?'<small class="ja-panchang-slot-trait">('+esc(x.trait)+')</small>':'')+(meta?'<small class="ja-panchang-slot-meta">'+meta+'</small>':'')+(active?' <em class="ja-panchang-now">Now</em>':'')+'</td><td class="ja-panchang-duration">'+fmtClock(x.start,ctx.tz)+' – '+fmtClock(x.end,ctx.tz)+'</td></tr>';}).join('');
  return '<section class="ja-panchang-section ja-panchang-period-section"><div class="ja-panchang-table-wrap"><table class="ja-panchang-week-table ja-panchang-slots"><thead><tr><th>'+title+'</th><th>Duration</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
 }
 var cycle=['Udveg','Chal','Labh','Amrit','Kaal','Shubh','Rog'],dayStart=[0,3,6,2,5,1,4],lordStart={0:0,1:3,2:6,3:2,4:5,5:1,6:4},planets=['Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars'];
 var chSlots=[],horaSlots=[];
  var horaTraits={Sun:'Vigorous',Moon:'Gentle',Mars:'Aggressive',Mercury:'Quick',Jupiter:'Fruitful',Venus:'Beneficial',Saturn:'Sluggish'};
 function addPeriod(start,end,isDay){
  var duration=end-start,base=dayStart[wd],startIdx=isDay?base:(base+5)%7;
  for(var i=0;i<8;i++){var s=start+i*duration/8,e=start+(i+1)*duration/8,ix=(startIdx+i*(isDay?1:5))%7;chSlots.push({start:s,end:e,primary:cycle[ix],meta:(isDay?'DAY ':'NIGHT ')+(i+1)});}
  var lord=lordStart[wd],hd=duration/12,seq=isDay?lord:(lord+12)%7;
  for(var h=0;h<12;h++){var hs=start+h*hd,he=start+(h+1)*hd;var horaPlanet=planets[(seq+h)%7];horaSlots.push({start:hs,end:he,primary:planetMarkup(horaPlanet),trait:horaTraits[horaPlanet]||'',meta:(isDay?'DAY ':'NIGHT ')+(h+1)});}
 }
 addPeriod(sunrise,sunset,true);addPeriod(sunset,nextSunrise,false);
 var selected=table('Chaughadiya',chSlots)+table('Hora',horaSlots);
 var dayDate=new Date(sunrise+ctx.tz*3600000),dayKey=pad(dayDate.getUTCDate())+'/'+pad(dayDate.getUTCMonth()+1)+'/'+dayDate.getUTCFullYear();
 var rahuSlots=[8,2,7,5,6,4,3],gulikaSlots=[6,5,4,3,2,1,0],yamaSlots=[4,3,2,1,0,6,5],dayEighth=(sunset-sunrise)/8;
 var kaalItems=[
  {name:'Abhijit Muhurta',start:wd===3?null:sunrise+7*(sunset-sunrise)/15,end:wd===3?null:sunrise+8*(sunset-sunrise)/15,na:wd===3},
  {name:'Rahu Kaal',start:sunrise+(rahuSlots[wd]-1)*dayEighth,end:sunrise+rahuSlots[wd]*dayEighth},
  {name:'Gulika Kaal',start:sunrise+gulikaSlots[wd]*dayEighth,end:sunrise+(gulikaSlots[wd]+1)*dayEighth},
  {name:'Yamaghanta',start:sunrise+yamaSlots[wd]*dayEighth,end:sunrise+(yamaSlots[wd]+1)*dayEighth}
 ];
 var kaalPanel='<section class="ja-panchang-muhurta-panel" aria-label="Muhurta and Kaal timings" style="grid-column:1/-1;margin-top:2px;padding:9px 12px;border:1px solid rgba(110,105,130,.15);border-radius:10px;background:rgba(255,255,255,.78)">'+
  '<div style="display:flex;align-items:center;gap:6px 14px;flex-wrap:wrap">'+
  '<strong style="font-size:11px;font-weight:700;color:#454052;white-space:nowrap">Muhurta &amp; Kaal</strong>'+
  '<div style="display:flex;align-items:center;gap:6px 14px;flex:1;min-width:0;flex-wrap:wrap">'+
  kaalItems.map(function(item,i){var active=!item.na&&ctx.instant>=item.start&&ctx.instant<item.end;var time=item.na?'Not applicable':fmtClock(item.start,ctx.tz)+' – '+fmtClock(item.end,ctx.tz);var accent=i===0?'#9A762E':i===1?'#B75D61':i===2?'#A66C42':'#69758C';return '<span class="ja-panchang-muhurta-item" style="display:inline-flex;align-items:baseline;gap:5px;white-space:nowrap;font-size:10.5px;line-height:1.5;color:#4B4756"><strong style="font-weight:650;color:'+accent+'">'+item.name+'</strong><span style="font-weight:600;font-variant-numeric:tabular-nums">'+time+'</span>'+(active?'<em class="ja-panchang-now">Now</em>':'')+'</span>';}).join('')+
  '</div></div></section>';
 subtitleNode.textContent=dayKey+' · '+fmtClock(sunrise,ctx.tz)+' – '+fmtClock(nextSunrise,ctx.tz)+' local chart time';
 bodyNode.innerHTML='<div class="ja-panchang-dual-grid">'+selected+kaalPanel+'</div>';
}
function renderInauspiciousWeek(){
 var w=bounds(),rahus=[8,2,7,5,6,4,3],guliks=[6,5,4,3,2,1,0],yamas=[4,3,2,1,0,6,5],rows='';
 if(!w.days.length){bodyNode.innerHTML='<div class="ja-panchang-current-summary"><strong>Sunrise data unavailable.</strong><small>Check the selected location and date.</small></div>';return;}
 var weekDate=new Date(w.start+ctx.tz*3600000),lastDate=new Date(w.days[6].start+ctx.tz*3600000),range=pad(weekDate.getUTCDate())+'/'+pad(weekDate.getUTCMonth()+1)+'/'+weekDate.getUTCFullYear()+' – '+pad(lastDate.getUTCDate())+'/'+pad(lastDate.getUTCMonth()+1)+'/'+lastDate.getUTCFullYear(),location=(document.getElementById('pob')||{}).value||'Selected chart location',tzLabel='UTC'+(ctx.tz>=0?'+':'')+String(ctx.tz),heads=['☾ &nbsp; Rahu Kaal','◉ &nbsp; Gulika Kaal','☼ &nbsp; Yamaghanta'];
 for(var day=0;day<7;day++){
  var dayInfo=w.days[day],localMid=dayInfo.localMid,weekday=dayInfo.weekday,rise=dayInfo.start,set=sunEventForLocalDay(localMid,ctx.lat,ctx.lon,false),nextRise=dayInfo.end,valid=Number.isFinite(rise)&&Number.isFinite(set)&&rise>0&&set>rise&&set<nextRise,today=ctx.instant>=rise&&ctx.instant<nextRise,cols='';
  if(valid){var eighth=(set-rise)/8,entries=[rahus[weekday]-1,guliks[weekday],yamas[weekday]];
   cols=entries.map(function(slot,i){var st=rise+slot*eighth,en=st+eighth,active=ctx.instant>=st&&ctx.instant<en,pct=active?Math.max(0,Math.min(100,(ctx.instant-st)/(en-st)*100)):0;return '<td><div class="ja-panchang-event ja-inauspicious-period period-'+i+(active?' is-active':'')+'"><div class="ja-panchang-duration">'+formatPanchangInterval(st,en,ctx.tz,localMid)+'</div>'+(active?'<em class="ja-panchang-now">LIVE</em><div class="ja-inauspicious-progress"><span style="width:'+pct.toFixed(1)+'%"></span></div>':'')+'</div></td>';}).join('');
  }else cols='<td colspan="3"><span class="ja-panchang-empty">Sunrise / sunset unavailable</span></td>';
  var dd=new Date(localMid);rows+='<tr class="'+(today?'is-today':'')+'"><th><span>'+DAYS[weekday]+'</span>'+(today?'<em class="ja-inauspicious-today">TODAY</em>':'')+'<small>'+pad(dd.getUTCDate())+'/'+pad(dd.getUTCMonth()+1)+'/'+dd.getUTCFullYear()+'</small></th>'+cols+'</tr>';
 }
 subtitleNode.textContent=range+' · Sunday to Saturday · Local time at the selected chart location';bodyNode.innerHTML='<div class="ja-panchang-table-wrap ja-inauspicious-scroll"><table class="ja-panchang-week-table ja-panchang-inauspicious-table"><thead><tr><th>WEEKDAY</th>'+heads.map(function(h){return '<th>'+h+'</th>';}).join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div><footer class="ja-inauspicious-info"><strong>ⓘ &nbsp; Calculation Information</strong><span>Time zone: '+esc(tzLabel)+' · Sunrise–Sunset based · Location: '+esc(location)+'</span></footer>';
 weekLabel.textContent=range;
}
function transitHouseAt(ms){
 var local=new Date(ms+ctx.tz*3600000),chart=computeChart({y:local.getUTCFullYear(),m:local.getUTCMonth()+1,d:local.getUTCDate(),hh:local.getUTCHours(),mm:local.getUTCMinutes(),ss:local.getUTCSeconds(),tz:ctx.tz,lat:ctx.lat,lon:ctx.lon});
 var jup=chart.planets.Jupiter&&chart.planets.Jupiter.lon;
 if(!Number.isFinite(jup)||!Number.isFinite(chart.asc))return null;
 return ((Math.floor(jup/30)-Math.floor(chart.asc/30)+12)%12)+1;
}
function transitHouseIntervals(start,end,wanted){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];
 var step=10*60000,items=[],a=start,ha=transitHouseAt(start),houseStart=start;
 for(var b=Math.min(a+step,end);;b=Math.min(b+step,end)){
  var hb=transitHouseAt(b);
  if(hb!==ha){
   var lo=a,hi=b;
   while(hi-lo>1000){var mid=Math.floor((lo+hi)/2);if(transitHouseAt(mid)===ha)lo=mid;else hi=mid;}
   if(Number.isFinite(ha)&&wanted.indexOf(ha)>=0&&hi>houseStart)items.push({house:ha,start:houseStart,end:hi});
   houseStart=hi;
   ha=hb;
  }
  if(b===end)break;a=b;
 }
 if(Number.isFinite(ha)&&wanted.indexOf(ha)>=0&&end>houseStart)items.push({house:ha,start:houseStart,end:end});
 return items;
}
function renderAuspiciousWeek(){
 var w=bounds(),wanted=[1,5,7,9],rows='';
 weekLabel.textContent='';
 if(!w.days.length){bodyNode.innerHTML='<div class="ja-panchang-current-summary"><strong>Sunrise data unavailable.</strong><small>Check the selected location and date.</small></div>';return;}
 for(var day=0;day<7;day++){
  var dayInfo=w.days[day],localMid=dayInfo.localMid,weekday=dayInfo.weekday,rise=dayInfo.start,set=sunEventForLocalDay(localMid,ctx.lat,ctx.lon,false),nextRise=dayInfo.end,today=ctx.instant>=rise&&ctx.instant<nextRise,dayCell='',nightCell='',jupiterCell='';
  var validSunset=Number.isFinite(rise)&&Number.isFinite(set)&&Number.isFinite(nextRise)&&rise>0&&rise<set&&set<nextRise;
  if(weekday===3){dayCell=nightCell='<span class="ja-panchang-empty">Not applicable</span>';}
  else if(validSunset){
   var dayDur=set-rise,nightDur=nextRise-set,dayStart=rise+7*dayDur/15,dayEnd=rise+8*dayDur/15,nightStart=set+7*nightDur/15,nightEnd=set+8*nightDur/15;
   function periodCell(start,end){var active=ctx.instant>=start&&ctx.instant<end;return '<div class="ja-panchang-event'+(active?' is-active':'')+'"><div class="ja-panchang-duration">'+formatPanchangInterval(start,end,ctx.tz,localMid)+'</div>'+(active?'<em class="ja-panchang-now">Current</em>':'')+'</div>';}
   dayCell=periodCell(dayStart,dayEnd);nightCell=periodCell(nightStart,nightEnd);
  }else{
   var unavailable='<span class="ja-panchang-empty">Sunrise / sunset unavailable</span>';
   dayCell=nightCell=unavailable;
  }
  if(Number.isFinite(rise)&&Number.isFinite(nextRise)&&rise>0&&nextRise>rise){
   var intervals=transitHouseIntervals(rise,nextRise,wanted);
   jupiterCell=intervals.map(function(x){var active=ctx.instant>=x.start&&ctx.instant<x.end;return '<div class="ja-panchang-event ja-panchang-jupiter-period'+(active?' is-active':'')+'"><strong> '+({1:'Lagna (1st)',5:'5th',7:'7th',9:'9th'}[x.house])+' House</strong><div class="ja-panchang-duration">'+formatPanchangInterval(x.start,x.end,ctx.tz,localMid)+'</div>'+(active?'<em class="ja-panchang-now">Current</em>':'')+'</div>';}).join('')||'<span class="ja-panchang-empty">No selected-house transit</span>';
  }else jupiterCell='<span class="ja-panchang-empty">Sunrise boundary unavailable</span>';
  var dd=new Date(rise+ctx.tz*3600000);
  rows+='<tr class="'+(today?'is-today':'')+'"><th><span>'+DAYS[weekday]+'</span><small>'+pad(dd.getUTCDate())+'/'+pad(dd.getUTCMonth()+1)+'/'+dd.getUTCFullYear()+'</small></th><td>'+dayCell+'</td><td>'+nightCell+'</td><td data-export-only style="display:none">'+jupiterCell+'</td></tr>';
 }
 bodyNode.innerHTML='<div class="ja-panchang-table-wrap"><table class="ja-panchang-week-table ja-panchang-auspicious-table"><thead><tr><th>Day</th><th>Day Abhijit Muhurta</th><th>Night Abhijit Muhurta</th><th data-export-only style="display:none">Jupiter Transit (House Periods)</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="ja-panchang-note">Night Abhijit is shown as the 8th equal Muhurta of the night (sunset to next sunrise). Jupiter house periods are retained in copied and exported table data.</p>';
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
 if(segmentStart<nextSunrise)rows.push({sign:currentSign,start:segmentStart,end:nextSunrise});weekLabel.textContent='';var lagnaDate=new Date(sunrise+ctx.tz*3600000);subtitleNode.textContent=pad(lagnaDate.getUTCDate())+'/'+pad(lagnaDate.getUTCMonth()+1)+'/'+lagnaDate.getUTCFullYear()+' · '+fmtClock(sunrise,ctx.tz)+' – '+fmtClock(nextSunrise,ctx.tz)+' local chart time';
 var bodyRows='',offsets={Sun:[7],Moon:[7],Mars:[4,7,8],Mercury:[7],Jupiter:[5,7,9],Venus:[7],Saturn:[3,7,10],Rahu:[5,7,9],Ketu:[5,7,9]},names=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu'];
 rows.forEach(function(row){var mid=Math.floor((row.start+row.end)/2),d=new Date(mid+ctx.tz*3600000),hours=d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600,jd=julianDay(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),hours-ctx.tz),lord=LAGNA_LORDS[row.sign],positions=siderealAt(jd).planets,lordLon=positions[lord]&&positions[lord].lon,lordSign=Number.isFinite(lordLon)?Math.floor(lordLon/30):-1,house=lordSign>=0?((lordSign-row.sign+12)%12)+1:null,houseText=house?house+'H':'—',conjunctions=[],aspectedBy=[],inLagna=[],aspecting=[];
  names.forEach(function(p){var pl=positions[p],sign=Number.isFinite(pl&&pl.lon)?Math.floor(pl.lon/30):-1;if(sign<0)return;if(sign===row.sign)inLagna.push(p);var asp=offsets[p]||[7],houseFrom=((row.sign-sign+12)%12)+1;if(asp.indexOf(houseFrom)>=0)aspecting.push(p);if(p===lord||lordSign<0)return;if(sign===lordSign)conjunctions.push(p);var lordHouse=((lordSign-sign+12)%12)+1;if(asp.indexOf(lordHouse)>=0)aspectedBy.push(p);});
  var active=ctx.instant>=row.start&&ctx.instant<row.end;bodyRows+='<tr class="'+(active?'is-today':'')+'"><td><strong>'+SIGNS[row.sign][0]+'</strong></td><td class="ja-panchang-duration">'+fmtClock(row.start,ctx.tz)+' – '+fmtClock(row.end,ctx.tz)+(active?' <em class="ja-panchang-now">Now</em>':'')+'</td><td>'+LAGNA_TYPES[row.sign]+'</td><td>'+planetMarkup(lord)+'</td><td>'+houseText+'</td><td>'+ (conjunctions.length?conjunctions.map(planetMarkupShort).join(', '):'—') +'</td><td>'+ (aspectedBy.length?aspectedBy.map(planetMarkupShort).join(', '):'—') +'</td><td>'+ (inLagna.length?inLagna.map(planetMarkupShort).join(', '):'—') +'</td><td>'+ (aspecting.length?aspecting.map(planetMarkupShort).join(', '):'—') +'</td></tr>';
 });
 bodyNode.innerHTML='<div class="ja-panchang-table-wrap ja-panchang-lagna-wrap"><table class="ja-panchang-week-table ja-panchang-lagna-table"><thead><tr><th>Sign</th><th>Duration</th><th>Category</th><th>1L</th><th>1L in</th><th>1L Conjunct</th><th>Asp. 1L</th><th>1P</th><th>Asp. 1H</th></tr></thead><tbody>'+bodyRows+'</tbody></table></div>';
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
function panchangExportCellText(cell){
 if(!cell.hasAttribute('data-export-only'))return (cell.innerText||cell.textContent||'').replace(/\s+/g,' ').trim();
 var periods=Array.from(cell.querySelectorAll('.ja-panchang-jupiter-period'));
 if(periods.length)return periods.map(function(period){var heading=period.querySelector('strong'),duration=period.querySelector('.ja-panchang-duration'),current=period.querySelector('.ja-panchang-now');return [heading&&heading.textContent,duration&&duration.textContent,current&&current.textContent].filter(Boolean).join(' — ').replace(/\s+/g,' ').trim();}).join(' | ');
 return (cell.textContent||'').replace(/\s+/g,' ').trim();
}
function getPanchangExportMatrix(){var tables=bodyNode.querySelectorAll('table');if(!tables.length)throw new Error('No Panchang table is currently displayed.');var matrix=[];tables.forEach(function(table,ti){if(ti)matrix.push(['']);Array.from(table.rows).forEach(function(row){var cells=Array.from(row.cells).filter(function(cell){return cell.hasAttribute('data-export-only')||getComputedStyle(cell).display!=='none';});matrix.push(cells.map(panchangExportCellText));});});return matrix;}
 function panchangDelimited(matrix,delimiter){return matrix.map(function(row){return row.map(function(value){var v=String(value==null?'':value);return delimiter==='\\t'?v.replace(/\\t/g,' ').replace(/\\r?\\n/g,' '):'"'+v.replace(/"/g,'""')+'"';}).join(delimiter);}).join('\\r\\n');}
function copyPlainText(value){function fallback(){var ta=document.createElement('textarea');ta.value=value;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}ta.remove();}return navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(value).catch(fallback):Promise.resolve(fallback());}
function downloadPanchangFile(content,mime,ext){var blob=new Blob(['\\uFEFF',content],{type:mime+';charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='panchang-table.'+ext;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);}
function closeExportMenu(){var m=modal.querySelector('[data-export-menu]'),b=modal.querySelector('[data-copy-table]');if(m)m.hidden=true;if(b)b.setAttribute('aria-expanded','false');}
async function runPanchangExport(format){try{var matrix=getPanchangExportMatrix();if(format==='copy')await copyPlainText(panchangDelimited(matrix,'\\t'));else if(format==='csv')downloadPanchangFile(panchangDelimited(matrix,','),'text/csv','csv');else if(format==='tsv')downloadPanchangFile(panchangDelimited(matrix,'\\t'),'text/tab-separated-values','tsv');else if(format==='pdf'){if(typeof window.downloadPlanetaryTablePDF!=='function')throw new Error('The shared PDF exporter is unavailable.');var temp=document.createElement('div');temp.style.position='fixed';temp.style.left='-10000px';var table=document.createElement('table'),thead=document.createElement('thead'),tbody=document.createElement('tbody');matrix.forEach(function(row,i){var tr=document.createElement('tr');row.forEach(function(v){var cell=document.createElement(i===0?'th':'td');cell.textContent=v;tr.appendChild(cell);});(i===0?thead:tbody).appendChild(tr);});table.appendChild(thead);table.appendChild(tbody);temp.appendChild(table);document.body.appendChild(temp);try{await window.downloadPlanetaryTablePDF(temp);}finally{temp.remove();}}}catch(e){console.error('Panchang table export failed.',e);window.alert(e&&e.message?e.message:'Unable to export Panchang table.');}closeExportMenu();}
function toggleFullscreen(){if(!modal||modal.hidden)return;if(document.fullscreenElement===modal){if(document.exitFullscreen)document.exitFullscreen().catch(function(){});return;}if(typeof modal.requestFullscreen==='function')modal.requestFullscreen({navigationUI:'hide'}).catch(function(){window.alert('Full-screen mode is unavailable in this browser session.');});}
function syncFullscreenButton(){if(!modal)return;var b=modal.querySelector('[data-fullscreen-toggle]');if(!b)return;var active=document.fullscreenElement===modal;b.textContent=active?'⤢':'⛶';b.title=active?'Exit full screen':'Enter full screen';b.setAttribute('aria-label',b.title);}
function minimize(){if(!modal||modal.hidden)return;if(document.fullscreenElement===modal&&document.exitFullscreen)document.exitFullscreen().catch(function(){});windowMinimized=true;modal.hidden=true;document.body.classList.remove('ja-panchang-modal-open');var d=modal.querySelector('.ja-panchang-dialog');d.classList.remove('is-maximized');d.classList.add('is-minimized');if(launcher)launcher.classList.add('visible');}
function restore(){if(!modal)return;windowMinimized=false;modal.hidden=false;document.body.classList.add('ja-panchang-modal-open');var d=modal.querySelector('.ja-panchang-dialog');d.classList.remove('is-minimized');if(launcher)launcher.classList.remove('visible');d.focus();}
function close(){if(!modal)return;modal.hidden=true;document.body.classList.remove('ja-panchang-modal-open');windowMinimized=false;var d=modal.querySelector('.ja-panchang-dialog');d.classList.remove('is-minimized','is-maximized');d.style.left='';d.style.top='';d.style.position='';d.style.margin='';if(launcher)launcher.classList.remove('visible');}
async function open(k){
 var authUser=window.jaAuthUser||(window.firebaseAuth&&window.firebaseAuth.currentUser)||null;
 if(!authUser&&window.jaAuthReady&&typeof window.jaAuthReady.then==='function'){
  try{authUser=await window.jaAuthReady;}catch(_){authUser=null;}
 }
 if(!authUser)return;
 try{await loadPanchangReference();}catch(err){console.error('Panchang reference data could not be loaded:',err);return;}
 ctx=context();kind=k;offset=0;dayOffset=0;modal.setAttribute('data-ja-panchang-kind',k);modal.querySelector('.ja-panchang-dialog').classList.remove('is-minimized','is-maximized');
 var titles={sun:'Lagna Table',tithi:'Tithi — Weekly Details',nak:'Nakshatra — Weekly Details',yogaGroup:'Yoga & Karana — Weekly Details',chaughadiyaGroup:'Chaughadiya & Hora — Panchang Day',inauspicious:'Inauspicious Periods',abhijit:'Abhijit Muhurta'};
 var popupTitle=titles[k]||'Panchang Details';titleNode.textContent=popupTitle;windowTitleNode.textContent='Jupiter Astrology · Panchang';modal.querySelector('.ja-panchang-dialog').dataset.kind=k;modal.querySelector('.ja-panchang-dialog').classList.remove('is-minimized','is-maximized');windowMinimized=false;activePanel=k==='chaughadiyaGroup'?'chaughadiya':k==='yogaGroup'?'yoga':activePanel;subtitleNode.textContent=(k==='chaughadiyaGroup'||k==='sun')?'Sunrise to next sunrise · Local time at the selected chart location':'Sunday to Saturday · Local time at the selected chart location';if(k==='inauspicious')titleNode.textContent='Weekly Inauspicious Periods';
 var nav=modal.querySelector('.ja-panchang-week-nav');nav.classList.toggle('is-day-nav',k==='chaughadiyaGroup'||k==='sun');nav.querySelector('[data-week="-1"]').innerHTML=(k==='chaughadiyaGroup'||k==='sun')?'← <span>Previous Day</span>':'← <span>Previous Week</span>';nav.querySelector('[data-week="1"]').innerHTML=(k==='chaughadiyaGroup'||k==='sun')?'<span>Next Day</span> →':'<span>Next Week</span> →';
 render();modal.hidden=false;windowMinimized=false;modal.querySelector('.ja-panchang-dialog').classList.remove('is-minimized');document.body.classList.add('ja-panchang-modal-open');if(launcher)launcher.classList.remove('visible');modal.querySelector('.ja-panchang-dialog').focus();
}
function init(){
 modal=document.createElement('div');modal.id='jaPanchangDetailsModal';modal.className='ja-panchang-modal';modal.hidden=true;
 modal.innerHTML='<div class="ja-panchang-backdrop" data-close="1"></div><section class="ja-panchang-dialog" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="jaPanchangTitle"><header class="ja-panchang-titlebar" data-ja-panchang-drag><div class="ja-panchang-window-controls"><button type="button" class="ja-panchang-dot close" data-close="1" aria-label="Close"></button><button type="button" class="ja-panchang-dot minimize" data-minimize aria-label="Minimize"></button><button type="button" class="ja-panchang-dot maximize" data-maximize aria-label="Maximize"></button></div><div class="ja-panchang-window-title">Jupiter Astrology · Panchang</div><div class="ja-panchang-title-tools ja-panchang-actions"><div class="jtt-info-wrap ja-panchang-info-wrap"><button type="button" class="jtt-info-button ja-panchang-action" data-info-toggle aria-label="Panchang information" title="Panchang information" aria-expanded="false">i</button></div><div class="jtt-global-export-wrap ja-panchang-export-wrap"><button type="button" class="jtt-global-export-button ja-panchang-action" data-copy-table aria-label="Copy or export Panchang table" title="Copy or export Panchang table" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path></svg></button><div class="jtt-global-export-menu ja-panchang-export-menu" data-export-menu hidden><div class="jtt-global-export-heading">Panchang Table</div><button type="button" data-export-action="copy"><span>Copy table</span><kbd>TSV</kbd></button><button type="button" data-export-action="csv"><span>Download CSV</span><kbd>.csv</kbd></button><button type="button" data-export-action="tsv"><span>Download TSV</span><kbd>.tsv</kbd></button><button type="button" data-export-action="pdf"><span>Export PDF</span><kbd>.pdf</kbd></button></div></div><button type="button" class="jtt-tool-button ja-panchang-action" data-fullscreen-toggle aria-label="Enter full screen" title="Enter full screen">⛶</button><button type="button" class="jtt-theme-toggle ja-panchang-action" data-theme-toggle title="Switch appearance" aria-label="Switch appearance" aria-pressed="false"></button></div></header><div class="ja-panchang-heading"><div class="ja-panchang-heading-row"><div><h2 id="jaPanchangTitle"></h2><p id="jaPanchangSubtitle"></p></div><div class="ja-panchang-week-nav"><button type="button" data-week="-1">← <span>Previous</span></button><button type="button" data-now>Now</button><span id="jaPanchangWeekLabel" hidden></span><button type="button" data-week="1"><span>Next</span> →</button></div></div></div><div class="ja-panchang-dialog-body" id="jaPanchangDialogBody"></div></section>';
 document.body.appendChild(modal);launcher=document.createElement('div');launcher.id='ja-panchang-minimized-launcher';launcher.innerHTML='<button type="button" aria-label="Restore Panchang popup"><span>Panchang</span><span aria-hidden="true">↗</span></button>';launcher.querySelector('button').addEventListener('click',restore);document.body.appendChild(launcher);applyTheme(themeMode);titleNode=modal.querySelector('#jaPanchangTitle');windowTitleNode=modal.querySelector('.ja-panchang-window-title');subtitleNode=modal.querySelector('#jaPanchangSubtitle');bodyNode=modal.querySelector('#jaPanchangDialogBody');weekLabel=modal.querySelector('#jaPanchangWeekLabel');
 modal.addEventListener('click',function(e){var c=e.target.closest('[data-close]'),n=e.target.closest('[data-week]'),d=modal.querySelector('.ja-panchang-dialog');if(!e.target.closest('.ja-panchang-export-wrap'))closeExportMenu();if(c)close();else if(e.target.closest('[data-now]')){ctx.instant=Date.now();offset=0;dayOffset=0;render();}else if(e.target.closest('[data-minimize]')){minimize();}else if(e.target.closest('[data-maximize]')){if(windowMinimized)restore();d.classList.remove('is-minimized');d.classList.toggle('is-maximized');}else if(e.target.closest('[data-theme-toggle]'))setTheme(themeMode==='apple'?'website':'apple');else if(e.target.closest('[data-info-toggle]')){window.JAInfoToast.show('Panchang timings are displayed in the selected chart location local time.',{source:'panchang',priority:1,duration:2000});e.target.closest('[data-info-toggle]').setAttribute('aria-expanded','false');}else if(e.target.closest('[data-copy-table]')){var em=modal.querySelector('[data-export-menu]'),eb=e.target.closest('[data-copy-table]'),eo=em&&em.hidden;if(em)em.hidden=!eo;eb.setAttribute('aria-expanded',eo?'true':'false');}else if(e.target.closest('[data-fullscreen-toggle]'))toggleFullscreen();else if(e.target.closest('[data-export-action]'))runPanchangExport(e.target.closest('[data-export-action]').dataset.exportAction);else if(n){if(kind==='chaughadiyaGroup'||kind==='sun')dayOffset+=Number(n.dataset.week);else offset+=Number(n.dataset.week);render();}});
 var dragHandle=modal.querySelector('[data-ja-panchang-drag]'),dragState=null;
 dragHandle.addEventListener('pointerdown',function(e){if(e.target.closest('button')||modal.querySelector('.ja-panchang-dialog').classList.contains('is-maximized'))return;var box=modal.querySelector('.ja-panchang-dialog').getBoundingClientRect();dragState={x:e.clientX,y:e.clientY,left:box.left,top:box.top};dragHandle.setPointerCapture(e.pointerId);});
 dragHandle.addEventListener('pointermove',function(e){if(!dragState)return;var d=modal.querySelector('.ja-panchang-dialog');d.style.position='fixed';d.style.margin='0';d.style.left=Math.max(8,Math.min(window.innerWidth-d.offsetWidth-8,dragState.left+e.clientX-dragState.x))+'px';d.style.top=Math.max(8,Math.min(window.innerHeight-d.offsetHeight-8,dragState.top+e.clientY-dragState.y))+'px';});
 function stopPanchangDrag(){dragState=null;}
 dragHandle.addEventListener('pointerup',stopPanchangDrag);dragHandle.addEventListener('pointercancel',stopPanchangDrag);
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden){if(document.fullscreenElement===modal&&document.exitFullscreen){document.exitFullscreen().catch(function(){});e.preventDefault();e.stopImmediatePropagation();return;}minimize();e.preventDefault();e.stopImmediatePropagation();}});document.addEventListener('fullscreenchange',syncFullscreenButton);window.addEventListener('storage',function(e){if(e.key===THEME_KEY){themeMode=e.newValue==='apple'?'apple':'website';applyTheme(themeMode);}});
 // Card clicks are delegated by the page's lazy-loader. Do not attach a second
 // card handler here; doing so caused duplicate opens and timing conflicts.
}
document.addEventListener('ja-panchang-open',function(e){var k=e&&e.detail&&e.detail.kind;if(k)open(k);});
// This file is injected only after a user clicks a card. Initialise immediately:
// waiting for DOMContentLoaded can leave the first open event with null modal nodes.
init();
})();