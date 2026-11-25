import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=process.argv[2]||process.env.MOON_CORRECTION_JSON;
if(!source) throw new Error('Set MOON_CORRECTION_JSON to the correction JSON path.');
const data=JSON.parse(fs.readFileSync(source,'utf8'));
const events=data?.data?.Moon?.Sign;
if(!Array.isArray(events)||events.length<300) throw new Error('Expected data.Moon.Sign with at least 300 events.');
const RAD=Math.PI/180,rev=x=>((x%360)+360)%360,sind=x=>Math.sin(x*RAD),cosd=x=>Math.cos(x*RAD),atan2d=(y,x)=>Math.atan2(y,x)/RAD;
const jd=ms=>2440587.5+ms/86400000;
function kepler(M,e){let E=M+e/RAD*sind(M)*(1+e*cosd(M));for(let k=0;k<30;k++){const d=(E-e/RAD*sind(E)-M)/(1-e*cosd(E));E-=d;if(Math.abs(d)<1e-7)break;}return E;}
function sun(d){const w=282.9404+4.70935e-5*d,e=.016709-1.151e-9*d,M=rev(356.047+.9856002585*d),E=kepler(M,e),x=cosd(E)-e,y=Math.sqrt(1-e*e)*sind(E),v=atan2d(y,x),r=Math.hypot(x,y);return {M,w,lon:rev(v+w)};}
function moon(d,s){const N=125.1228-.0529538083*d,i=5.1454,w=318.0634+.1643573223*d,e=.0549,M=rev(115.3654+13.0649929509*d),E=kepler(M,e),xv=60.2666*(cosd(E)-e),yv=60.2666*Math.sqrt(1-e*e)*sind(E),v=atan2d(yv,xv),r=Math.hypot(xv,yv),xh=r*(cosd(N)*cosd(v+w)-sind(N)*sind(v+w)*cosd(i)),yh=r*(sind(N)*cosd(v+w)+cosd(N)*sind(v+w)*cosd(i));let Lm=M+w+N,Ls=s.M+s.w,D=Lm-Ls,F=Lm-N,lon=atan2d(yh,xh);lon+=-1.274*sind(M-2*D)+.658*sind(2*D)-.186*sind(s.M)-.059*sind(2*M-2*D)-.057*sind(M-2*D+s.M)+.053*sind(M+2*D)+.046*sind(2*D-s.M)+.041*sind(M-s.M)-.035*sind(D)-.031*sind(M+s.M)-.015*sind(2*F-2*D)+.011*sind(M-4*D);return rev(lon);}
const sid=ms=>{const J=jd(ms),T=(J-2451545)/36525;return rev(moon(J-2451543.5,sun(J-2451543.5))-23.857092-(5028.796195*T+1.1054348*T*T)/3600);};
const wrap=x=>{const y=rev(x);return y>180?y-360:y;};
function findRoot(ms,n){const b=(n-1)*30;let lo=ms-12*3600000,hi=ms+12*3600000,fl=wrap(sid(lo)-b),fh=wrap(sid(hi)-b);if(!(fl<=0&&fh>=0))throw new Error('Could not bracket existing-engine ingress '+new Date(ms).toISOString());for(let i=0;i<55;i++){const m=(lo+hi)/2;if(wrap(sid(m)-b)<0)lo=m;else hi=m;}return (lo+hi)/2;}
const parseIST=s=>Date.parse(s.replace('T',' ')+'+05:30'),quote=s=>'"'+String(s).replaceAll('"','""')+'"';
const lines=['index,sign,json_entered_at_local,existing_engine_entered_at_local'];
for(let i=0;i<300;i++){const idx=Math.round(i*(events.length-1)/299),e=events[idx],n=Number(e.sign.slice(e.sign.indexOf('(')+1,e.sign.indexOf(')')));if(!n)throw new Error('Unrecognized sign: '+e.sign);const ms=parseIST(e.entered_at),engine=findRoot(ms,n),engineIst=new Date(engine+19800000).toISOString().replace('T',' ').slice(0,19);lines.push([idx+1,quote(e.sign),quote(e.entered_at),quote(engineIst)].join(','));}
const output=path.join(rootDir,'data','moon-sign-sample-300.csv');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,lines.join(String.fromCharCode(10)));
console.log(JSON.stringify({source,total_events:events.length,sample_size:300,output},null,2));
