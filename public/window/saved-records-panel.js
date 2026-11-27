(() => {
  "use strict";
  if (window.__JA_SAVED_RECORDS_PANEL__) return;
  window.__JA_SAVED_RECORDS_PANEL__ = true;

  const ID = "ja-saved-records-panel";
  let panel = null, open = false, records = [], activeTags = new Set(), expanded = null, requestNo = 0;

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
      #${ID}{position:fixed;inset:0 auto 0 0;width:var(--ja-saved-width);max-width:100vw;z-index:2147482500;display:flex;flex-direction:column;color:var(--ink,#282536);background:linear-gradient(145deg,color-mix(in srgb,var(--surface,#fff) 94%,transparent),color-mix(in srgb,var(--paper,#f8fafc) 96%,transparent));border-right:1px solid var(--line-strong,#ddd8e8);box-shadow:18px 0 48px rgba(35,30,52,.12);backdrop-filter:blur(28px) saturate(160%);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #${ID} .sr-head{height:66px;flex:0 0 auto;display:flex;align-items:center;padding:0 18px;gap:12px;border-bottom:1px solid var(--line,#e7e3ed);background:color-mix(in srgb,var(--surface,#fff) 80%,transparent)}
      #${ID} .sr-headcopy{flex:1;min-width:0}#${ID} .sr-headcopy b{display:block;font-size:16px;font-weight:730}#${ID} .sr-headcopy small{display:block;color:var(--muted,#777386);font-size:10px;margin-top:3px}
      #${ID} .sr-close{width:13px;height:13px;min-width:13px;border:0;border-radius:50%;background:#ff6058;padding:0;cursor:pointer;box-shadow:inset 0 0 0 1px #0002}
      #${ID} .sr-body{min-height:0;flex:1;display:flex;flex-direction:column;gap:15px;padding:17px;overflow:hidden}
      #${ID} .sr-search{height:44px;width:100%;flex:0 0 auto;border:1px solid var(--line-strong,#d8dce5);border-radius:11px;padding:0 13px;background:color-mix(in srgb,var(--surface-alt,#f1f5f9) 75%,transparent);color:var(--ink,#282536);font:500 13px Inter,sans-serif;outline:none}
      #${ID} .sr-search:focus{border-color:var(--saffron,#d97706);box-shadow:0 0 0 3px color-mix(in srgb,var(--saffron,#d97706) 14%,transparent)}
      #${ID} .sr-label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#777386);font-weight:750;margin-bottom:8px}
      #${ID} .sr-tags{display:flex;flex-wrap:wrap;gap:7px;flex:0 0 auto;max-height:100px;overflow:auto}
      #${ID} .sr-tag{border:1px solid var(--line-strong,#ddd);border-radius:99px;padding:5px 10px;background:transparent;color:var(--muted,#777);font:600 10px Inter,sans-serif;cursor:pointer}
      #${ID} .sr-tag[aria-pressed="true"]{background:color-mix(in srgb,var(--saffron,#d97706) 14%,var(--surface,#fff));border-color:var(--saffron,#d97706);color:var(--ink,#282536)}
      #${ID} .sr-results{min-height:0;flex:1;overflow:auto;border-top:1px solid var(--line,#e7e3ed)}
      #${ID} .sr-listhead{display:flex;justify-content:space-between;padding:11px 2px;border-bottom:1px solid var(--line,#e7e3ed);font-size:11px}
      #${ID} .sr-count{color:var(--muted,#777)}
      #${ID} .sr-record{border-bottom:1px solid var(--line,#e7e3ed)}
      #${ID} .sr-record button{width:100%;display:flex;justify-content:space-between;gap:10px;text-align:left;padding:12px 3px;border:0;background:transparent;color:var(--ink,#282536);font:650 12px/1.4 Inter,sans-serif;cursor:pointer}
      #${ID} .sr-meta{display:block;margin-top:3px;color:var(--muted,#777);font:450 10px/1.4 Inter,sans-serif}
      #${ID} .sr-details{padding:0 5px 12px;color:var(--muted,#777);font-size:10.5px;line-height:1.55}
      #${ID} .sr-detail{display:grid;grid-template-columns:66px 1fr;gap:8px;padding:3px 0}
      #${ID} .sr-detail b{color:var(--ink,#282536)}
      #${ID} .sr-status{text-align:center;color:var(--muted,#777);padding:22px 8px;font-size:11px}
      #${ID} .sr-error{color:#b42318}
      #${ID} .sr-foot{padding:10px 17px;border-top:1px solid var(--line,#e7e3ed);color:var(--muted,#777);font-size:10px}
      body.ja-saved-open>header.brand,body.ja-saved-open>main.wrap,body.ja-saved-open>#panchangCardBlock{width:calc(100% - var(--ja-saved-width));max-width:none;margin-left:var(--ja-saved-width);margin-right:0;transition:width .22s ease,margin-left .22s ease}
      body.ja-saved-open>main.wrap{padding-left:clamp(12px,1.8vw,26px);padding-right:clamp(12px,1.8vw,26px)}
      @media(max-width:760px){:root{--ja-saved-width:100vw}#${ID}{width:100vw}body.ja-saved-open>header.brand,body.ja-saved-open>main.wrap,body.ja-saved-open>#panchangCardBlock{width:100%;margin-left:0;margin-right:0}body.ja-saved-open>header.brand{transform:translateX(100vw)}body.ja-saved-open>main.wrap{visibility:hidden}body.ja-saved-open>#panchangCardBlock{display:none}}
      @media(prefers-reduced-motion:reduce){#${ID},body.ja-saved-open>header.brand,body.ja-saved-open>main.wrap{transition:none!important}}
    `;
    document.head.appendChild(style);
    panel = document.createElement("aside");
    panel.id = ID; panel.hidden = true; panel.setAttribute("aria-hidden","true"); panel.setAttribute("aria-label","Saved records");
    panel.innerHTML = `
      <header class="sr-head"><div class="sr-headcopy"><b>Saved records</b><small>Your saved birth charts and notes</small></div><button class="sr-close" type="button" title="Close" aria-label="Close Saved records"></button></header>
      <div class="sr-body">
        <input class="sr-search" type="search" placeholder="Search name, place, tags or notes…" aria-label="Search saved records" autocomplete="off">
        <section><div class="sr-label">Filter by tags</div><div class="sr-tags"><span class="sr-status">Loading tags…</span></div></section>
        <section class="sr-results"><div class="sr-listhead"><b>Saved charts</b><span class="sr-count">— records</span></div><div class="sr-list"><div class="sr-status">Sign in to load saved records.</div></div></section>
      </div>
      <footer class="sr-foot">Google Sheets · authenticated access · Press F to open · Esc to hide</footer>`;
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
    const host=panel.querySelector(".sr-tags"), tags=[...new Set(records.flatMap(tagsOf))].sort((a,b)=>a.localeCompare(b));
    host.innerHTML=tags.length?tags.map(t=>`<button class="sr-tag" type="button" data-tag="${esc(t)}" aria-pressed="${activeTags.has(t)}">${esc(t)}</button>`).join(""):'<span class="sr-status">No tags in saved records.</span>';
  }
  function filtered(){
    const q=txt(panel.querySelector(".sr-search").value).toLocaleLowerCase();
    return records.filter(r=>{
      const rt=tagsOf(r); if(activeTags.size&&![...activeTags].every(t=>rt.includes(t)))return false;
      return !q||[r.name,r.dob,r.tob,r.pob,r.tags,r.desc,r.notes,r.keywords].map(txt).join(" ").toLocaleLowerCase().includes(q);
    });
  }
  function detail(label,value){return txt(value)?`<div class="sr-detail"><b>${esc(label)}</b><span>${esc(value)}</span></div>`:"";}
  function renderRecords(){
    if(!panel)return;
    const host=panel.querySelector(".sr-list"), list=filtered();
    panel.querySelector(".sr-count").textContent=list.length+" "+(list.length===1?"record":"records");
    if(!list.length){host.innerHTML='<div class="sr-status">No records match this search or tag filter.</div>';return;}
    host.innerHTML=list.map((r,i)=>{
      const id=txt(r.id)||"record-"+i, isOpen=expanded===id, meta=[r.dob,r.pob].map(txt).filter(Boolean).join(" · ");
      const details=[detail("DOB",r.dob),detail("TOB",r.tob),detail("POB",r.pob),detail("Notes",r.desc||r.notes),detail("Tags",tagsOf(r).join(", ")),detail("Coordinates",[r.lat,r.lon].map(txt).filter(Boolean).join(", "))].join("");
      return `<article class="sr-record"><button type="button" data-record="${esc(id)}" aria-expanded="${isOpen}"><span>${esc(r.name||"Unnamed record")}<span class="sr-meta">${esc(meta)}</span></span><span aria-hidden="true">${isOpen?"⌃":"⌄"}</span></button>${isOpen?`<div class="sr-details">${details||"No additional details available."}</div>`:""}</article>`;
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
    if(event.key==="Escape"&&open){event.preventDefault();event.stopPropagation();hide();return;}
    if(event.key.toLowerCase()==="f"&&!typing(event.target)){event.preventDefault();if(!open)show();}
  },true);
  window.addEventListener("ja-auth-state-changed",event=>{
    const user=event.detail&&Object.prototype.hasOwnProperty.call(event.detail,"user")?event.detail.user:(window.firebaseAuth&&window.firebaseAuth.currentUser);
    if(!user){requestNo++;records=[];activeTags.clear();expanded=null;hide();if(panel){renderTags();renderRecords();}}
  });
  window.JASavedRecordsPanel=Object.freeze({open:show,hide,close:closePanel,refresh:load,isOpen:()=>open});
})();