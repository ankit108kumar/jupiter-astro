import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=process.argv[2] || process.env.MOON_CORRECTION_JSON;
if(!source) throw new Error('Pass the correction JSON path: node src/build-sample.mjs /path/to/Planetary\\ Transit\\ correction\\ v4.json');
const data=JSON.parse(fs.readFileSync(source,'utf8'));
const events=data?.data?.Moon?.Sign;
if(!Array.isArray(events)||events.length<300) throw new Error('Expected data.Moon.Sign with at least 300 records');
const RAD=Math.PI/180, rev=x=>((x%360)+360)%360, sind=x=>Math.sin(x*RAD), cosd=x=>Math.cos(x*RAD), atan2d=(y,x)=>Math.atan2(y,x)/RAD;
const jdFromMs=ms=>2440587.5+ms/86400000;
function kepler(M,e){let E=M+e/RAD*sind(M)*(1+e*cosd(M));for(let k=0;k<30;k++){const d=(E-e/RAD*sind(E)-M)/(1-e*cosd(E));E-=d;if(Math.abs(d)<1e-7)break;}return E;}
function sunPos(d){const w=282.9404+4.70935e-5*d,e=.016709-1.151e-9*d,M=rev(356.047+0.9856002585*d),E=kepler(M,e),x=cosd(E)-e,y=Math.sqrt(1-e*e)*sind(E),v=atan2d(y,x),r=Math.hypot(x,y),lon=rev(v+w);return {M,w,x:r*cosd(lon),y:r*sind(lon)};}
function moonLon(d,s){const N=125.1228-.0529538083*d,i=5.1454,w=318.0634+.1643573223*d,e=.0549,M=rev(115.3654+13.0649929509*d),E=kepler(M,e),xv=60.2666*(cosd(E)-e),yv=60.2666*Math.sqrt(1-e*e)*sind(E),v=atan2d(yv,xv),r=Math.hypot(xv,yv),xh=r*(cosd(N)*cosd(v+w)-sind(N)*sind(v+w)*cosd(i)),yh=r*(sind(N)*cosd(v+w)+cosd(N)*sind(v+w)*cosd(i));let lon=atan2d(yh,xh),Ms=s.M,Ls=Ms+s.w,Lm=M+w+N,D=Lm-Ls,F=Lm-N;lon+=-1.274*sind(M-2*D)+.658*sind(2*D)-.186*sind(Ms)-.059*sind(2*M-2*D)-.057*sind(M-2*D+Ms)+.053*sind(M+2*D)+.046*sind(2*D-Ms)+.041*sind(M-Ms)-.035*sind(D)-.031*sind(M+Ms)-.015*sind(2*F-2*D)+.011*sind(M-4*D);return rev(lon);}
function sid(ms){const jd=jdFromMs(ms),d=jd-2451543.5,s=sunPos(d),T=(jd-2451545)/36525,A=23.857092+(5028.796195*T+1.1054348*T*T)/3600;return rev(moonLon(d,s)-A);}
const diff=x=>{const y=rev(x);return y>180?y-360:y;};
function root(ms,signNo){const boundary=(signNo-1)*30;let lo=ms-12*3600000,hi=ms+12*3600000,fl=diff(sid(lo)-boundary),fh=diff(sid(hi)-boundary);if(!(fl<=0&&fh>=0))throw new Error('Existing-engine crossing not bracketed: '+new Date(ms).toISOString());for(let i=0;i<55;i++){const m=(lo+hi)/2;if(diff(sid(m)-boundary)<0)lo=m;else hi=m;}return (lo+hi)/2;}
const parseIST=s=>Date.parse(s.replace('T',' ')+'+05:30');
const N=300, selected=[];
for(let i=0;i<N;i++){const idx=Math.round(i*(events.length-1)/(N-1)),e=events[idx],sn=Number((e.sign.match(/\((\d+)\)/)||[])[1]);if(!sn)throw new Error('Unrecognized sign '+e.sign);const jsonMs=parseIST(e.entered_at),engineMs=root(jsonMs,sn);selected.push({index:idx+1,sign:e.sign,json_entered_at_local:e.entered_at,existing_engine_entered_at_local:new Date(engineMs+19800000).toISOString().replace('T',' ').slice(0,19)});}
const quote=s=>'"'+String(s).replaceAll('"','""')+'"';
const csv=['index,sign,json_entered_at_local,existing_engine_entered_at_local',...selected.map(r=>[r.index,quote(r.sign),quote(r.json_entered_at_local),quote(r.existing_engine_entered_at_local)].join(String.fromCharCode(10));
const out=path.join(root,'data','moon-sign-sample-300.csv');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,csv);
console.log(JSON.stringify({source:source,total_moon_sign_events:events.length,sample_size:selected.length,output:out},null,2));
