/* Jupiter Astrology — weekly Panchang detail popups */
(function(){
'use strict';
var DAY=86400000, DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var TN=['Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima'];
var CAT=['Nanda','Bhadra','Jaya','Rikta','Purna'], LORD={Nanda:'Venus',Bhadra:'Mercury',Jaya:'Mars',Rikta:'Saturn',Purna:'Jupiter'};
var TDEITY=['Agni','Brahma','Gauri','Ganesha','Naga','Kartikeya','Surya','Shiva','Durga','Yama','Vishnu','Vayu','Kamadeva','Shiva','Chandra / Pitru'];
var NDEITY=['Ashwini Kumaras','Yama','Agni','Brahma','Soma','Rudra','Aditi','Brihaspati','Nagas','Pitris','Bhaga','Aryaman','Savitar','Tvashtar','Vayu','Indra-Agni','Mitra','Indra','Nirriti','Apah','Vishvadevas','Vishnu','Ashta Vasus','Varuna','Aja Ekapada','Ahirbudhnya','Pushan'];
var NMETA=[
['Horse head','Deva','Shami','Horse'],['Yoni','Manushya','Amla','Female reproductive organ'],['Flame / blade','Rakshasa','Fig','Fire / knife'],['Ox cart','Manushya','Jamun','Cart'],['Deer head','Deva','Khair','Deer'],['Teardrop','Manushya','Arjuna','Human head'],['Bow','Deva','Bamboo','Bow / quiver'],['Udder / lotus','Deva','Peepal','Cow udder'],['Serpent','Rakshasa','Nagkesar','Serpent'],['Royal throne','Rakshasa','Banyan','Throne'],['Hammock','Manushya','Palash','Hammock'],['Bed','Manushya','Payari','Bed'],['Hand / palm','Deva','Jasmine','Hand'],['Pearl / bright jewel','Rakshasa','Bilva','Pearl'],['Coral / young shoot','Deva','Arjuna','Coral'],['Triumphal arch','Rakshasa','Nagkesar','Archway'],['Lotus','Deva','Bakula','Lotus'],['Earring','Rakshasa','Santoshi','Earring'],['Roots tied together','Rakshasa','Sal','Root bundle'],['Elephant tusk / fan','Manushya','Ashoka','Elephant tusk'],['Elephant tusk / small bed','Manushya','Jackfruit','Elephant tusk'],['Ear','Deva','Akshaya Vata','Ear'],['Drum','Rakshasa','Shami','Drum'],['Empty circle','Rakshasa','Kadamba','Empty circle'],['Two front legs of a cot','Manushya','Mango','Twin-faced man'],['Back legs of a cot','Manushya','Neem','Twin-faced man'],['Fish','Deva','Mahua','Fish']];
var modal,titleNode,subtitleNode,bodyNode,weekLabel,kind='tithi',activePanel='yoga',offset=0,dayOffset=0,ctx;
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
function name(k,i){if(k==='nak')return NAK[i][0];var n=i%15;return (i<15?'Shukla ':'Krishna ')+(n===14?(i<15?'Purnima':'Amavasya'):TN[n]);}
function meta(k,i){
 if(k==='nak'){var m=NMETA[i]||[],n=NAK[i]||['—','—'];return [['Nakshatra Lord',n[1]],['Nakshatra Deity',NDEITY[i]],['Symbol',m[0]],['Quality / Gana',m[1]],['Associated Tree',m[2]],['Associated Object',m[3]]];}
 var c=CAT[(i%15)%5],deity=(i%15)===14?(i<15?'Chandra':'Pitru'):TDEITY[i%15];
 return [['Tithi Category',c],['Tithi Lord',LORD[c]],['Tithi Deity',deity]];
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
 weekLabel.textContent=dayFmt(w.start,ctx.tz)+' – '+dayFmt(w.end-DAY,ctx.tz);
 var nowLocal=ctx.instant+ctx.tz*3600000,rows='';
 for(var day=0;day<7;day++){
  var ds=w.start+day*DAY,de=ds+DAY,events='',today=nowLocal>=ds&&nowLocal<de;
  for(var j=0;j<cuts.length-1;j++){
   var a=cuts[j],b=cuts[j+1];if(b.at<=ds||a.at>=de)continue;
   var s=a.at,e=b.at,active=today&&ctx.instant>=s&&ctx.instant<e,fields=meta(k,a.index),details='';
   fields.forEach(function(x){details+='<span class="ja-panchang-meta"><b>'+esc(x[0])+':</b> '+esc(x[1])+'</span>';});
   events+='<div class="ja-panchang-event'+(active?' is-active':'')+'"><div class="ja-panchang-event-head"><strong>'+esc(name(k,a.index))+'</strong>'+(active?'<em>Current</em>':'')+'</div><div class="ja-panchang-duration">'+fmt(s,ctx.tz)+' – '+fmt(e,ctx.tz)+'</div><div class="ja-panchang-meta-grid">'+details+'</div></div>';
  }
  var dd=new Date(ds+ctx.tz*3600000);
  rows+='<tr class="'+(today?'is-today':'')+'"><th><span>'+DAYS[dd.getUTCDay()]+'</span><small>'+pad(dd.getUTCDate())+'/'+pad(dd.getUTCMonth()+1)+'/'+dd.getUTCFullYear()+'</small></th><td>'+(events||'—')+'</td></tr>';
 }
 bodyNode.innerHTML='<div class="ja-panchang-table-wrap"><table class="ja-panchang-week-table"><thead><tr><th>Day</th><th>'+(k==='tithi'?'Tithi and duration':'Nakshatra and duration')+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function yogaKaranaIndex(ms,which){
 var p=longitudes(ms),sum=rev(p.sun+p.moon),diff=rev(p.moon-p.sun);
 return which==='yoga'?Math.floor(sum/(40/3))%27:Math.min(59,Math.floor(diff/6));
}
var YOGA_NAMES=['Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarma','Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra','Siddhi','Vyatipata','Variyana','Parigha','Shiva','Siddha','Sadhya','Shubha','Shukla','Brahma','Indra','Vaidhriti'];
var KARANA_NAMES=['Kimstughna','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti','Shakuni','Chatushpada','Naga'];
function eventName(which,i){return which==='yoga'?YOGA_NAMES[i]:KARANA_NAMES[i];}
function renderLunarWeek(which){
 var w=bounds(),start=w.start-2*DAY,end=w.end+2*DAY,step=2*3600000,changes=[],a=start,ia=yogaKaranaIndex(a,which);
 for(var b=Math.min(a+step,end);;b=Math.min(b+step,end)){
  var ib=yogaKaranaIndex(b,which);
  if(ib!==ia){var lo=a,hi=b;while(hi-lo>1000){var mid=Math.floor((lo+hi)/2);if(yogaKaranaIndex(mid,which)===ia)lo=mid;else hi=mid;}changes.push({at:hi,index:ib});ia=ib;}
  if(b===end)break;a=b;
 }
 var cuts=[{at:start,index:yogaKaranaIndex(start,which)}].concat(changes,[{at:end,index:yogaKaranaIndex(end,which)}]);
 weekLabel.textContent=dayFmt(w.start,ctx.tz)+' – '+dayFmt(w.end-DAY,ctx.tz);
 var now=ctx.instant,nowLocal=now+ctx.tz*3600000,rows='';
 for(var day=0;day<7;day++){
  var ds=w.start+day*DAY,de=ds+DAY,today=nowLocal>=ds&&nowLocal<de,events='';
  for(var j=0;j<cuts.length-1;j++){
   var a=cuts[j],b=cuts[j+1];if(b.at<=ds||a.at>=de)continue;
   var active=today&&now>=a.at&&now<b.at;
   events+='<div class="ja-panchang-event'+(active?' is-active':'')+'"><div class="ja-panchang-event-head"><strong>'+esc(eventName(which,a.index))+'</strong>'+(active?'<em>Current</em>':'')+'</div><div class="ja-panchang-duration">'+fmt(a.at,ctx.tz)+' – '+fmt(b.at,ctx.tz)+'</div></div>';
  }
  var dd=new Date(ds+ctx.tz*3600000);
  rows+='<tr class="'+(today?'is-today':'')+'"><th><span>'+DAYS[dd.getUTCDay()]+'</span><small>'+pad(dd.getUTCDate())+'/'+pad(dd.getUTCMonth()+1)+'/'+dd.getUTCFullYear()+'</small></th><td>'+(events||'—')+'</td></tr>';
 }
 var heading=which==='yoga'?'Yoga':'Karana';
 bodyNode.innerHTML='<div class="ja-panchang-section"><h3>'+heading+'</h3><div class="ja-panchang-table-wrap"><table class="ja-panchang-week-table"><thead><tr><th>Day</th><th>'+heading+' and duration</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}
function localDayStart(ms,tz){var d=new Date(ms+tz*3600000);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-tz*3600000;}
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
  weekLabel.textContent='Sunrise data unavailable';
  bodyNode.innerHTML='<div class="ja-panchang-current-summary"><strong>Unable to calculate this Panchang day.</strong><small>Check the selected location and date.</small></div>';return;
 }
 var localDate=new Date(sunrise+ctx.tz*3600000),wd=localDate.getUTCDay();
 weekLabel.textContent=DAYS[wd]+' · '+dayFmt(sunrise,ctx.tz).split(', ')[1];
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
 var selected=which==='chaughadiya'?table('Chaughadiya',chSlots):table('Hora',horaSlots);bodyNode.innerHTML=panelTabs(['chaughadiya','hora'])+'<div class="ja-panchang-day-range"><span>Panchang day</span><strong>'+fmt(sunrise,ctx.tz)+' – '+fmt(nextSunrise,ctx.tz)+'</strong><small>Sunrise to immediately before the next sunrise · local chart time</small></div>'+selected;
}
function renderOther(k){
 var w=bounds();weekLabel.textContent=dayFmt(w.start,ctx.tz)+' – '+dayFmt(w.end-DAY,ctx.tz);
 var ids={inauspicious:['pRahuKaal','pGulikKaal'],abhijit:['pAbhijit','pAbhijitDuration']};
 var vals=(ids[k]||[]).map(function(id){return (document.getElementById(id)||{}).textContent||'—';}).join(' · ');
 var labels={inauspicious:'Inauspicious Periods',abhijit:'Abhijit Muhurta'};
 bodyNode.innerHTML='<div class="ja-panchang-current-summary"><span>'+esc(labels[k])+'</span><strong>'+esc(vals)+'</strong></div>';
}
function panelTabs(items){return '<div class="ja-panchang-panel-tabs">'+items.map(function(x){var label=x.charAt(0).toUpperCase()+x.slice(1);return '<button type="button" data-panel="'+x+'" class="'+(activePanel===x?'is-active':'')+'">'+label+'</button>';}).join('')+'</div>';}
function render(){if(kind==='tithi'||kind==='nak')renderWeek(kind);else if(kind==='yogaGroup')renderLunarWeek(activePanel);else if(kind==='chaughadiyaGroup')renderChaughadiyaHora(activePanel);else renderOther(kind);}
function close(){modal.hidden=true;document.body.classList.remove('ja-panchang-modal-open');}
function open(k){
 if(!(window.firebaseAuth&&window.firebaseAuth.currentUser)&&!window.jaAuthUser){var b=document.getElementById('accountOpenBtn');if(b)b.click();return;}
 ctx=context();kind=k;offset=0;dayOffset=0;
 var titles={tithi:'Tithi — Weekly Details',nak:'Nakshatra — Weekly Details',yogaGroup:'Yoga & Karana — Weekly Details',chaughadiyaGroup:'Chaughadiya & Hora — Panchang Day',inauspicious:'Inauspicious Periods',abhijit:'Abhijit Muhurta'};
 titleNode.textContent=titles[k]||'Panchang Details';activePanel=k==='chaughadiyaGroup'?'chaughadiya':k==='yogaGroup'?'yoga':activePanel;subtitleNode.textContent=k==='chaughadiyaGroup'?'Sunrise to next sunrise · Local time at the selected chart location':'Sunday to Saturday · Local time at the selected chart location';
 var nav=modal.querySelector('.ja-panchang-week-nav');nav.classList.toggle('is-day-nav',k==='chaughadiyaGroup');nav.querySelector('[data-week="-1"]').innerHTML=k==='chaughadiyaGroup'?'← <span>Previous Day</span>':'← <span>Previous Week</span>';nav.querySelector('[data-week="1"]').innerHTML=k==='chaughadiyaGroup'?'<span>Next Day</span> →':'<span>Next Week</span> →';
 render();modal.hidden=false;document.body.classList.add('ja-panchang-modal-open');modal.querySelector('.ja-panchang-close').focus();
}
function init(){
 modal=document.createElement('div');modal.id='jaPanchangDetailsModal';modal.className='ja-panchang-modal';modal.hidden=true;
 modal.innerHTML='<div class="ja-panchang-backdrop" data-close="1"></div><section class="ja-panchang-dialog" role="dialog" aria-modal="true" aria-labelledby="jaPanchangTitle"><header class="ja-panchang-dialog-header"><div class="ja-panchang-heading"><span class="ja-panchang-kicker">JUPITER ASTROLOGY · PANCHANG</span><h2 id="jaPanchangTitle"></h2><p id="jaPanchangSubtitle"></p></div><button type="button" class="ja-panchang-close" aria-label="Close popup">×</button></header><div class="ja-panchang-week-nav"><button type="button" data-week="-1">← <span>Previous Week</span></button><strong id="jaPanchangWeekLabel"></strong><button type="button" data-week="1"><span>Next Week</span> →</button></div><div class="ja-panchang-dialog-body" id="jaPanchangDialogBody"></div><footer class="ja-panchang-dialog-footer"><span>Local chart time · 24-hour clock</span><button type="button" data-close="1">Close</button></footer></section>';
 document.body.appendChild(modal);titleNode=modal.querySelector('#jaPanchangTitle');subtitleNode=modal.querySelector('#jaPanchangSubtitle');bodyNode=modal.querySelector('#jaPanchangDialogBody');weekLabel=modal.querySelector('#jaPanchangWeekLabel');
 modal.addEventListener('click',function(e){var c=e.target.closest('[data-close]'),n=e.target.closest('[data-week]');if(c)close();else if(n){if(kind==='chaughadiyaGroup')dayOffset+=Number(n.dataset.week);else offset+=Number(n.dataset.week);render();}else{var p=e.target.closest('[data-panel]');if(p){activePanel=p.dataset.panel;render();}}});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden)close();});
 var cards=document.querySelectorAll('#panchangCardBlock .panchang-item'),kinds=['date','sun','tithi','nak','yogaGroup','chaughadiyaGroup','inauspicious','abhijit'];
 Array.prototype.forEach.call(cards,function(card,i){if(i<2)return;var k=kinds[i];card.classList.add('ja-panchang-clickable');card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-haspopup','dialog');card.addEventListener('click',function(){open(k);});card.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open(k);}});});
 function sync(){var locked=!(window.firebaseAuth&&window.firebaseAuth.currentUser)&&!window.jaAuthUser;Array.prototype.forEach.call(cards,function(card,i){if(i>=2)card.classList.toggle('ja-panchang-locked',locked);});}
 window.addEventListener('ja-auth-state-changed',sync);if(window.jaAuthReady)window.jaAuthReady.then(sync);sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();