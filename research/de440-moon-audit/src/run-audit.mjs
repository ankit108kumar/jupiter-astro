import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {loadSpiceQL} from '@usgs-astrogeology/spiceql';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bsp=path.join(root,'kernels','de440s.bsp'), lsk=path.join(root,'kernels','naif0012.tls');
const csvPath=path.join(root,'data','moon-sign-sample-300.csv'), out=path.join(root,'output');
for(const f of [bsp,lsk,csvPath]) if(!fs.existsSync(f)) throw new Error('Required input missing: '+f);
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function parseCsv(s){const lines=s.trim().split(/\r?\n/);const parse=line=>{let a=[],v='',q=false;for(let i=0;i<line.length;i++){let c=line[i];if(c==='"'&&q&&line[i+1]==='"'){v+='"';i++;}else if(c==='"')q=!q;else if(c===','&&!q){a.push(v);v='';}else v+=c;}a.push(v);return a;};const h=parse(lines.shift());return lines.map(l=>Object.fromEntries(parse(l).map((v,i)=>[h[i],v])));}
const rowsIn=parseCsv(fs.readFileSync(csvPath,'utf8'));if(rowsIn.length!==300)throw new Error('Expected exactly 300 sample records, got '+rowsIn.length);
const require=createRequire(import.meta.url), entry=require.resolve('@usgs-astrogeology/spiceql');
const raw=await import(pathToFileURL(path.join(path.dirname(entry),'naifspice.js')).href);
const spice=await loadSpiceQL(), ns=raw.loadNaifspice(spice);
for(const f of [lsk,bsp]){const p='/kernels/'+path.basename(f);spice.mountKernel(p,fs.readFileSync(f));ns.furnsh(p);}
const rev=x=>((x%360)+360)%360, wrap=x=>{const a=rev(x);return a>180?a-360:a;}, ar=x=>x*Math.PI/(180*3600);
const mm=(a,b)=>a.map(r=>b[0].map((_,j)=>r.reduce((s,x,k)=>s+x*b[k][j],0)));
const r1=a=>[[1,0,0],[0,Math.cos(a),Math.sin(a)],[0,-Math.sin(a),Math.cos(a)]];
const r2=a=>[[Math.cos(a),0,-Math.sin(a)],[0,1,0],[Math.sin(a),0,Math.cos(a)]];
const r3=a=>[[Math.cos(a),Math.sin(a),0],[-Math.sin(a),Math.cos(a),0],[0,0,1]];
const mv=(m,v)=>m.map(r=>r.reduce((s,x,i)=>s+x*v[i],0));
const dateEcliptic=(v,et)=>{const T=et/(86400*36525),zeta=ar(2.650545+2306.083227*T+.2988499*T*T+.01801828*T**3-.000005971*T**4-.0000003173*T**5),z=ar(-2.650545+2306.077181*T+1.0927348*T*T+.01826837*T**3-.000028596*T**4-.0000002904*T**5),th=ar(2004.191903*T-.4294934*T*T-.04182264*T**3-.000007089*T**4-.0000001274*T**5),p=mm(mm(r3(-z),r2(th)),r3(-zeta)),eq=mv(p,v),eps=ar(84381.406-46.836769*T-.0001831*T*T+.0020034*T**3-.000000576*T**4-.0000000434*T**5);return mv(r1(eps),eq);};
const lon=et=>{const q=ns.spkezr('MOON',et,'J2000','NONE','EARTH'),st=q.state??q,xyz=dateEcliptic(st.slice(0,3),et),rec=ns.reclat(xyz),trop=rev((rec.longitude??rec.lon)*180/Math.PI),T=et/(86400*36525),lahiri=23.857092+(5028.796195*T+1.1054348*T*T)/3600;return rev(trop-lahiri);};
const istEt=s=>{const ms=Date.parse(s.replace('T',' ')+'+05:30');if(!Number.isFinite(ms))throw new Error('Bad IST date '+s);return ns.str2et(new Date(ms).toISOString().replace('T',' ').replace('Z',' UTC'));};
const utc=et=>ns.et2utc(et,'ISOC',3,32);
const solve=(et,sign)=>{const b=(sign-1)*30;let lo=et-6*3600,hi=et+6*3600,fl=wrap(lon(lo)-b),fh=wrap(lon(hi)-b);if(!(fl<=0&&fh>=0)){lo=et-12*3600;hi=et+12*3600;fl=wrap(lon(lo)-b);fh=wrap(lon(hi)-b);}if(!(fl<=0&&fh>=0))throw new Error('Could not bracket '+sign+' near '+utc(et));for(let i=0;i<60;i++){const m=(lo+hi)/2;if(wrap(lon(m)-b)<0)lo=m;else hi=m;}return (lo+hi)/2;};
const toMs=s=>Date.parse(s+'Z'), outRows=[];
for(const r of rowsIn){const sign=Number((r.sign.match(/\((\d+)\)/)||[])[1]);if(!sign)throw new Error('Bad sign '+r.sign);const e=istEt(r.json_entered_at_local),de=solve(e,sign),u=utc(de),deMs=toMs(u),jsonMs=Date.parse(r.json_entered_at_local.replace('T',' ')+'+05:30'),oldMs=Date.parse(r.existing_engine_entered_at_local.replace(' ','T')+'+05:30');outRows.push({...r,de440_utc:u,de440_ist:new Date(deMs+19800000).toISOString().replace('T',' ').slice(0,23),deviation_vs_json_min:(deMs-jsonMs)/60000,deviation_vs_existing_min:(deMs-oldMs)/60000});}
const stats=a=>{const abs=a.map(Math.abs).sort((x,y)=>x-y),n=a.length,mean=a.reduce((x,y)=>x+y,0)/n;return {mean_signed_minutes:mean,mean_absolute_minutes:abs.reduce((x,y)=>x+y,0)/n,median_absolute_minutes:(abs[149]+abs[150])/2,rms_minutes:Math.sqrt(a.reduce((x,y)=>x+y*y,0)/n),p90_absolute_minutes:abs[Math.ceil(.9*n)-1],p95_absolute_minutes:abs[Math.ceil(.95*n)-1],within_30_seconds:a.filter(x=>Math.abs(x)<=.5).length,within_1_minute:a.filter(x=>Math.abs(x)<=1).length,within_2_minutes:a.filter(x=>Math.abs(x)<=2).length,within_5_minutes:a.filter(x=>Math.abs(x)<=5).length,max_positive_minutes:Math.max(...a),max_negative_minutes:Math.min(...a)};};
const d=outRows.map(x=>x.deviation_vs_json_min),e=outRows.map(x=>x.deviation_vs_existing_min);
const report={method:'JPL DE440s via NAIF CSPICE / USGS SpiceQL WASM',sample_size:outRows.length,timezone:'Asia/Kolkata (UTC+05:30)',position:'Geocentric Moon relative to Earth; geometric NONE',frame:'IAU 2006 mean ecliptic/equinox of date; nutation omitted',sidereal:'Date-dependent Lahiri polynomial matching inspected JupiterAstro model',kernel_sha256:{de440s:sha(bsp),lsk:sha(lsk)},de440_vs_json:stats(d),de440_vs_existing_engine:stats(e),rows:outRows};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'de440-moon-audit-report.json'),JSON.stringify(report,null,2));
const keys=Object.keys(outRows[0]),esc=x=>/[",\n]/.test(String(x))?'"'+String(x).replaceAll('"','""')+'"':String(x);
fs.writeFileSync(path.join(out,'de440-moon-audit-300.csv'),[keys.join(','),...outRows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\n'));
console.log(JSON.stringify({sample_size:300,de440_vs_json:report.de440_vs_json,de440_vs_existing_engine:report.de440_vs_existing_engine,report:path.join(out,'de440-moon-audit-report.json'),csv:path.join(out,'de440-moon-audit-300.csv')},null,2));
