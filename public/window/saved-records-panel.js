(() => {
  "use strict";
  if (window.__JA_SAVED_RECORDS_PANEL__) return;
  window.__JA_SAVED_RECORDS_PANEL__ = true;

  window.JA_SAVED_RECORD_TAGS = ["Career","Finance & Wealth","Relationship & Marriage","Kundli Matching","Child & Progeny","Property & Real Estate","Health Concerns","Legal Matters & Litigation","Muhurta (Auspicious Timing)","Other"];
  const ID = "ja-saved-records-panel";
  let panel = null, open = false, records = [], recentOpened = [], activeTags = new Set(), expanded = null, requestNo = 0;

  const esc = value => String(value ?? "").trim().replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
  const txt = value => String(value ?? "").trim();
  const tagsOf = record => (Array.isArray(record.tags) ? record.tags : txt(record.tags).split(/[;,|]/)).map(txt).filter(Boolean);
  const authenticated = () => !!((window.firebaseAuth && window.firebaseAuth.currentUser) || window.jaAuthUser);
  const typing = target => !!(target && target.closest && target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"],.ql-editor'));

  function install() {
    if (panel) return panel;
    const style = document.createElement("style");
    style.id = "ja-saved-records-style";
    style.textContent = `
      :root{--ja-saved-width:clamp(330px,31vw,420px)}
      #${ID},#${ID} *{box-sizing:border-box}
      #${ID}[hidden]{display:none!important}
      #${ID}{position:fixed;inset:0 auto 0 0;width:var(--ja-saved-width);max-width:100vw;z-index:2147482000;display:flex;flex-direction:column;color:var(--ink,#282536);background:linear-gradient(145deg,color-mix(in srgb,var(--surface,#fff) 94%,transparent),color-mix(in srgb,var(--paper,#f8fafc) 96%,transparent));border-right:1px solid var(--line-strong,#ddd8e8);box-shadow:18px 0 48px rgba(35,30,52,.12);backdrop-filter:blur(28px) saturate(160%);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #${ID} .sr-head{display:none}
      #${ID} .sr-headcopy{flex:1;min-width:0}#${ID} .sr-headcopy b{display:block;font-size:16px;font-weight:730}#${ID} .sr-headcopy small{display:block;color:var(--muted,#777386);font-size:10px;margin-top:3px}
      #${ID} .sr-close{position:absolute;top:28px;right:22px;z-index:5;width:13px;height:13px;min-width:13px;border:0;border-radius:50%;background:#ff6058;padding:0;cursor:pointer;box-shadow:inset 0 0 0 1px #0002}
      #${ID} .sr-search{padding-right:42px}
      #${ID} .sr-body{min-height:0;flex:1;display:flex;flex-direction:column;gap:10px;padding:14px 16px;overflow:hidden}
      #${ID} .sr-searchwrap{height:42px;position:relative;flex:0 0 auto}
      #${ID} .sr-search{height:42px;width:100%;border:1px solid var(--line-strong,#d8dce5);border-radius:11px;padding:0 13px 0 39px;background:color-mix(in srgb,var(--surface-alt,#f1f5f9) 75%,transparent);color:var(--ink,#282536);font:500 13px Inter,sans-serif;outline:none}
      #${ID} .sr-searchicon{position:absolute;left:13px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--muted,#8a8f98);pointer-events:none}
      #${ID} .sr-search:focus{border-color:var(--saffron,#d97706);box-shadow:0 0 0 3px color-mix(in srgb,var(--saffron,#d97706) 14%,transparent)}
      #${ID} .sr-label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#777386);font-weight:750;margin-bottom:8px}
      #${ID} .sr-tags{display:flex;flex-wrap:wrap;gap:5px;flex:0 0 auto;max-height:none;overflow:visible}
      #${ID} .sr-tag{border:1px solid var(--line-strong,#cbd5e1);border-radius:999px;padding:5px 8px;background:var(--paper,#f8fafc);color:var(--ink,#1e293b);font:550 10px/1.2 Inter,sans-serif;cursor:pointer;transition:background .16s,border-color .16s,box-shadow .16s}
      #${ID} .sr-tag::before{content:"+";display:inline-block;margin-right:4px;color:var(--ink,#1e293b);font-weight:650}
      #${ID} .sr-tag[aria-pressed="true"]{background:color-mix(in srgb,var(--saffron,#d97706) 17%,var(--surface,#fff));border-color:var(--saffron,#d97706);box-shadow:0 0 0 1px color-mix(in srgb,var(--saffron,#d97706) 15%,transparent)}
      #${ID} .sr-tag[aria-pressed="true"]::before{content:"✓";color:var(--saffron,#b45309)}
      #${ID} .sr-results{min-height:0;flex:1;overflow:auto;border-top:1px solid var(--line,#e7e3ed);scrollbar-width:thin;scrollbar-color:#b8bec7 transparent}
      #${ID} .sr-results::-webkit-scrollbar{width:7px}
      #${ID} .sr-results::-webkit-scrollbar-thumb{background:#b8bec7;border-radius:8px}
      #${ID} .sr-results::-webkit-scrollbar-track{background:transparent}
      #${ID} .sr-record{border-bottom:1px solid var(--line,#e7e3ed)}
      #${ID} .sr-record button{width:100%;display:block;text-align:left;padding:10px 3px;border:0;background:transparent;color:var(--ink,#282536);font:600 12px/1.4 Inter,sans-serif;cursor:pointer}
      #${ID} .sr-record-title{display:block}
      #${ID} .sr-record-tags{display:inline;margin-left:8px;color:var(--muted,#8993a4);font:400 10px/1.4 Inter,sans-serif}
      #${ID} .sr-meta{display:block;margin-top:3px;color:var(--ink,#475569);font:400 10px/1.4 Inter,sans-serif}
      #${ID} .sr-expand-mark{display:none!important}
      #${ID} .sr-details{padding:0 5px 12px;color:var(--ink,#282536);font:400 11px/1.55 Inter,sans-serif}
      #${ID} .sr-details .sr-detail{grid-template-columns:42px 1fr;gap:8px}
      #${ID} .sr-details .sr-detail b,#${ID} .sr-details .sr-detail span{font-weight:400}
      #${ID} .sr-tags{gap:4px}
      #${ID} .sr-tag{padding:4px 7px;font-size:10px}
      #${ID} .sr-results{scrollbar-color:#b8c0cc #f1f3f6;scrollbar-width:thin}
      #${ID} .sr-results::-webkit-scrollbar{width:7px}
      #${ID} .sr-results::-webkit-scrollbar-thumb{background:#b8c0cc;border-radius:8px}
      #${ID} .sr-results::-webkit-scrollbar-track{background:#f1f3f6}
      #${ID} .sr-detail{display:grid;grid-template-columns:66px 1fr;gap:8px;padding:3px 0;font-weight:400}
      #${ID} .sr-detail b{color:var(--ink,#282536);font-weight:500}
      #${ID} .sr-detail span{font-weight:400;overflow-wrap:anywhere}
      #${ID} .sr-status{text-align:center;color:var(--muted,#777);padding:22px 8px;font-size:11px}
      #${ID} .sr-error{color:#b42318}
      #${ID} .sr-foot{display:none}
      body.ja-saved-open>header.brand,body.ja-saved-open>main.wrap,body.ja-saved-open>#panchangCardBlock{width:calc(100% - var(--ja-saved-width));max-width:none;margin-left:var(--ja-saved-width);margin-right:0;transition:width .22s ease,margin-left .22s ease}
      body.ja-saved-open>main.wrap{padding-left:clamp(12px,1.8vw,26px);padding-right:clamp(12px,1.8vw,26px)}
      @media(max-width:760px){:root{--ja-saved-width:100vw}#${ID}{width:100vw}body.ja-saved-open>header.brand,body.ja-saved-open>main.wrap,body.ja-saved-open>#panchangCardBlock{width:100%;margin-left:0;margin-right:0}body.ja-saved-open>header.brand{transform:translateX(100vw)}body.ja-saved-open>main.wrap{visibility:hidden}body.ja-saved-open>#panchangCardBlock{display:none}}
      @media(prefers-reduced-motion:reduce){#${ID},body.ja-saved-open>header.brand,body.ja-saved-open>main.wrap{transition:none!important}}
    `;
    document.head.appendChild(style);
    panel = document.createElement("aside");
    panel.id = ID; panel.hidden = true; panel.setAttribute("aria-hidden","true"); panel.setAttribute("aria-label","Saved records");
    panel.innerHTML = `
      <button class="sr-close" type="button" title="Close" aria-label="Close Saved records"></button>
      <div class="sr-body">
        <div class="sr-searchwrap"><svg class="sr-searchicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg><input class="sr-search" type="search" placeholder="Search name, place, tags or notes…" aria-label="Search saved records" autocomplete="off"></div>
        <section><div class="sr-label">Filter by tags</div><div class="sr-tags"><span class="sr-status">Loading tags…</span></div></section>
        <section class="sr-results"><div class="sr-list"><div class="sr-status">Sign in to load saved records.</div></div></section>
      </div>
      `;
    document.body.appendChild(panel);
    panel.querySelector(".sr-close").addEventListener("click", closePanel);
    panel.querySelector(".sr-search").addEventListener("input", renderRecords);
    panel.querySelector(".sr-tags").addEventListener("click", event => {
      const btn=event.target.closest("[data-tag]"); if(!btn)return;
      const tag=btn.dataset.tag; activeTags.has(tag)?activeTags.delete(tag):activeTags.add(tag); renderTags(); renderRecords();
    });
    panel.querySelector(".sr-list").addEventListener("click", event => {
      const btn=event.target.closest("[data-record]"); if(!btn)return;
      expanded=expanded===btn.dataset.record?null:btn.dataset.record; renderRecords();
    });
    return panel;
  }
  function renderTags(){
    if(!panel)return;
    const host=panel.querySelector(".sr-tags"), tags=window.JA_SAVED_RECORD_TAGS;
    host.innerHTML=tags.map(t=>`<button class="sr-tag" type="button" data-tag="${esc(t)}" aria-pressed="${activeTags.has(t)}">${esc(t)}</button>`).join("");
  }
  function filtered(){
    const q=txt(panel.querySelector(".sr-search").value).toLocaleLowerCase();
    const source=(q||activeTags.size)?records:recentOpened;
    return source.filter(r=>{
      const rt=tagsOf(r); if(activeTags.size&&![...activeTags].some(t=>rt.includes(t)))return false;
      return !q||[r.name,r.dob,r.tob,r.pob,r.tags,r.desc,r.notes,r.keywords].map(txt).join(" ").toLocaleLowerCase().includes(q);
    });
  }
  function plainNote(value){
    const raw=String(value??"").trim(); if(!raw)return "";
    if(!/[<][a-z!/]/i.test(raw))return raw;
    try{
      const doc=new DOMParser().parseFromString(raw,"text/html");
      doc.querySelectorAll("br").forEach(node=>node.replaceWith("\n"));
      doc.querySelectorAll("p,div,li").forEach(node=>node.append("\n"));
      return (doc.body.textContent||"").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
    }catch(_){return raw.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();}
  }
  function detail(label,value){const clean=label==="Notes"?plainNote(value):txt(value);return clean?("<div class=\"sr-detail\"><b>"+esc(label)+"</b><span>"+esc(clean)+"</span></div>"):"";}
  function renderRecords(){
    if(!panel)return;
    const host=panel.querySelector(".sr-list"), list=filtered();
    if(!list.length){host.innerHTML=(txt(panel.querySelector(".sr-search").value)||activeTags.size)?'<div class="sr-status">No records match this search or tag filter.</div>':'<div class="sr-status">Recently opened charts will appear here.</div>';return;}
    host.innerHTML=list.map((r,i)=>{
      const id=txt(r.id)||"record-"+i, isOpen=expanded===id;
      const firstWords=tagsOf(r).map(tag=>txt(tag).split(/\\s+/)[0]).filter(Boolean);
      const dateTime=[r.dob,r.tob].map(txt).filter(Boolean).join(" · ");
      const meta=[dateTime,r.pob].filter(Boolean).join(" · ");
      const details=detail("Notes",r.desc||r.notes);
      return `<article class="sr-record"><button type="button" data-record="${esc(id)}" aria-expanded="${isOpen}"><span class="sr-record-title">${esc(r.name||"Unnamed record")}<span class="sr-record-tags">${esc(firstWords.join(" · "))}</span><span class="sr-meta">${esc(meta)}</span></span><span class="sr-expand-mark" aria-hidden="true"></span></button>${isOpen?`<div class="sr-details">${details||'<div class="sr-status">No notes available.</div>'}</div>`:""}</article>`;
    }).join("");
  }
  function normalizeProfile(row,index){
    const pick=(...keys)=>{for(const key of keys){const value=row&&row[key];if(value!==undefined&&value!==null&&String(value).trim())return String(value).trim();}return "";};
    return {
      id:pick("id","ID","profileId","Profile ID")||("profile-"+index),
      name:pick("name","Name","profileName","Profile Name"),
      dob:pick("dob","DOB","dateOfBirth","Date of Birth"),
      tob:pick("tob","TOB","timeOfBirth","Time of Birth"),
      pob:pick("pob","POB","placeOfBirth","Place of Birth"),
      lat:pick("lat","latitude","Latitude"),
      lon:pick("lon","lng","longitude","Longitude"),
      tz:pick("tz","timezone","timeZone","Timezone"),
      tags:pick("tags","Tags","tag","Tag"),
      desc:pick("desc","description","Description","notes","Notes","remark","Remarks"),
      keywords:pick("keywords","Keywords")
    };
  }
  async function load(){
    if(!panel)return;
    const user=(window.firebaseAuth&&window.firebaseAuth.currentUser)||window.jaAuthUser;
    if(!user)return;
    const seq=++requestNo;
    panel.querySelector(".sr-list").innerHTML='<div class="sr-status">Loading saved records…</div>';
    try{
      // Reuse JupiterAstro's existing saved-profiles provider and cache.
      // It reads ja_saved_profiles_cache first and the page's 15-minute
      // automatic sync refreshes that same cache in the background.
      if(typeof window.fetchSavedProfiles!=="function"){
        throw new Error("The existing saved-profiles cache is not available yet. Please reload the page.");
      }
      const profiles=await window.fetchSavedProfiles(false);
      if(seq!==requestNo)return;
      records=(Array.isArray(profiles)?profiles:[]).map(normalizeProfile).filter(r=>r.name);
      activeTags=new Set([...activeTags].filter(t=>records.some(r=>tagsOf(r).includes(t))));
      renderTags();renderRecords();
    }catch(error){
      if(seq!==requestNo)return;
      panel.querySelector(".sr-list").innerHTML='<div class="sr-status sr-error">'+esc(error.message||"Unable to load saved records.")+'</div>';
    }
  }
  function show(){
    if(!authenticated()){document.getElementById("accountOpenBtn")?.click();return;}
    install();panel.hidden=false;panel.setAttribute("aria-hidden","false");document.body.classList.add("ja-saved-open");open=true;load();
  }
  function hide(){if(!panel||!open)return;panel.hidden=true;panel.setAttribute("aria-hidden","true");document.body.classList.remove("ja-saved-open");open=false;}
  function closePanel(){if(!panel)return;panel.querySelector(".sr-search").value="";activeTags.clear();expanded=null;renderTags();renderRecords();hide();}
  document.addEventListener("keydown",event=>{
    if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key.toLowerCase()==="f"&&!typing(event.target)){event.preventDefault();if(!open)show();}
  },true);
  window.addEventListener("ja-auth-state-changed",event=>{
    const user=event.detail&&Object.prototype.hasOwnProperty.call(event.detail,"user")?event.detail.user:(window.firebaseAuth&&window.firebaseAuth.currentUser);
    if(!user){requestNo++;records=[];activeTags.clear();expanded=null;hide();if(panel){renderTags();renderRecords();}}
  });
  function trackOpened(record){const item=normalizeProfile(record||{},0);if(!item.name)return;if(!record.id)item.id="recent-"+[item.name,item.dob,item.tob,item.pob].join("|");const key=item.id;recentOpened=[item,...recentOpened.filter(r=>r.id!==key)].slice(0,12);if(panel&&open)renderRecords();}
  window.JASavedRecordsPanel=Object.freeze({open:show,hide,close:closePanel,refresh:load,isOpen:()=>open,trackOpened});
})();