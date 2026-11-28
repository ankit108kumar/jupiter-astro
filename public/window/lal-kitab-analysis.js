(function () {
  "use strict";
  if (window.JALalKitabAnalysis) return;
  const PLANETS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
  const DATA_URLS = {
    fundamental: "/data/lal-kitab-fundamental-rules.json",
    varshphal: "/data/lal-kitab-varshphal-planet-in-houses.json"
  };
  let dataPromise;
  function loadData() {
    if (!dataPromise) dataPromise = Promise.all([
      fetch(DATA_URLS.fundamental,{cache:"force-cache"}).then(r=>{if(!r.ok)throw new Error("Fundamental rules unavailable");return r.json();}),
      fetch(DATA_URLS.varshphal,{cache:"force-cache"}).then(r=>{if(!r.ok)throw new Error("Varshphal rules unavailable");return r.json();})
    ]).then(([fundamental,varshphal])=>({fundamental,varshphal})).catch(e=>{dataPromise=null;throw e;});
    return dataPromise;
  }
  function el(tag,cls,text) {
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(text!=null)n.textContent=String(text);
    return n;
  }
  function classify(placement,house) {
    if(!placement || !Number.isFinite(house)) return "neutral";
    const good=(placement.normally_good_houses||[]).includes(house);
    const bad=(placement.normally_bad_houses||[]).includes(house);
    return good===bad ? "neutral" : good ? "good" : "bad";
  }
  function addRow(parent,label,value) {
    if(value==null || !String(value).trim()) return;
    const row=el("div","ja-lk-analysis-row");
    row.append(el("div","ja-lk-analysis-category-title",label),el("div","ja-lk-analysis-copy",value));
    parent.appendChild(row);
  }
  function makeCard(title,house,items,emptyMessage) {
    const card=el("article","ja-lk-analysis-card");
    // Keep the Natal label for the combined view, but do not render a
    // separate Varshphal/year/house header row: the year is already in
    // the Lal Kitab Analysis section heading and the house is in the selector.
    if(title === "Natal") card.appendChild(el("h4","ja-lk-analysis-card-title","Natal"));
    let count=0;
    items.forEach(item=>{if(item.value!=null && String(item.value).trim()){addRow(card,item.label,item.value);count++;}});
    if(!count && emptyMessage) card.appendChild(el("p","ja-lk-analysis-status",emptyMessage));
    return card;
  }
  function mount(root,context) {
    if(!root || !context)return;
    const divider=el("div","ja-lk-analysis-divider");
    divider.setAttribute("role","separator");
    const section=el("section","ja-lk-analysis-section");
    section.setAttribute("aria-label","Lal Kitab Analysis");
    const heading=el("div","ja-lk-analysis-toggle");
    const headingText=el("span","ja-lk-analysis-heading-text","Lal Kitab Analysis");
    const yearText=el("span","ja-lk-analysis-heading-year","· Varshphal Year "+context.activeYear);
    heading.append(headingText,yearText);
    const body=el("div","ja-lk-analysis-body");
    const toolbar=el("div","ja-lk-analysis-toolbar");
    const planetNav=el("div","ja-lk-analysis-planets");
    planetNav.setAttribute("role","group");
    planetNav.setAttribute("aria-label","Select planet");
    const scope=el("div","ja-lk-analysis-scope");
    scope.setAttribute("role","group");
    scope.setAttribute("aria-label","Analysis scope");
    const content=el("div","ja-lk-analysis-results");
    const status=el("p","ja-lk-analysis-status","Loading source rules…");
    let selectedPlanet="Sun";
    let selectedScope="varshphal";
    let loaded=null;
    const scopeOptions=[["both","Both"],["natal","Natal"],["varshphal","Varshphal"]];
    scopeOptions.forEach(([value,label])=>{
      const b=el("button","",label);
      b.type="button";b.dataset.scope=value;
      b.setAttribute("aria-pressed",String(value===selectedScope));
      b.addEventListener("click",()=>{
        selectedScope=value;
        scope.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.scope===value)));
        updatePlanetButtons();renderResults();
      });
      scope.appendChild(b);
    });
    const planetButtons={};
    PLANETS.forEach(planet=>{
      const b=el("button","ja-lk-analysis-planet",planet);
      b.type="button";b.dataset.planet=planet;
      b.setAttribute("aria-pressed",String(planet===selectedPlanet));
      b.addEventListener("click",()=>{
        selectedPlanet=planet;
        planetNav.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.planet===planet)));
        renderResults();
      });
      planetButtons[planet]=b;planetNav.appendChild(b);
    });
    toolbar.append(planetNav,scope);
    body.append(toolbar,status,content);
    section.append(heading,body);
    root.append(divider,section);

    function updatePlanetButtons() {
      if(!loaded)return;
      const rules=loaded.fundamental.planetary_placement||{};
      PLANETS.forEach(planet=>{
        const b=planetButtons[planet];
        const nh=Number(context.natalPlanetHouses&&context.natalPlanetHouses[planet]);
        const vh=Number(context.varshPlanetHouses&&context.varshPlanetHouses[planet]);
        const nc=classify(rules[planet],nh),vc=classify(rules[planet],vh);
        b.className="ja-lk-analysis-planet";
        let label=planet+" ";
        if(selectedScope==="natal"){
          label+=Number.isFinite(nh)?nh+"H":"—";
          b.classList.add("ja-lk-analysis-"+nc);
          b.title="Natal placement: "+nc;
        } else if(selectedScope==="varshphal"){
          label+=Number.isFinite(vh)?vh+"H":"—";
          b.classList.add("ja-lk-analysis-"+vc);
          b.title="Varshphal placement: "+vc;
        } else {
          label+="N:"+(Number.isFinite(nh)?nh+"H":"—")+" / V:"+(Number.isFinite(vh)?vh+"H":"—");
          b.classList.add(nc===vc ? "ja-lk-analysis-"+nc : "ja-lk-analysis-mixed");
          b.title="Natal: "+nc+"; Varshphal: "+vc;
        }
        b.textContent=label;
        b.setAttribute("aria-pressed",String(planet===selectedPlanet));
      });
    }
    function natalCard(planet,house) {
      const placement=loaded.fundamental.planetary_placement&&loaded.fundamental.planetary_placement[planet];
      const cls=classify(placement,house);
      const items=[];
      if(cls!=="neutral") items.push({label:cls==="good"?"Normally good placement":"Normally bad placement",value:planet+" in House "+house+" is classified as normally "+cls+" in the supplied fundamental placement rules."});
      const reverse=loaded.fundamental.aspects&&loaded.fundamental.aspects.reverse_aspects;
      const rules=reverse&&Array.isArray(reverse.rules)?reverse.rules.filter(rule=>rule.planet===planet&&Number(rule.placement_house)===house):[];
      rules.forEach(rule=>{
        (rule.aspects||[]).forEach(a=>{
          const occupants=Object.keys(context.natalPlanetHouses||{}).filter(p=>Number(context.natalPlanetHouses[p])===Number(a.receiving_house));
          if(occupants.length)items.push({label:"Special reverse aspect · House "+a.receiving_house,value:occupants.join(", ")+": "+a.effect});
        });
      });
      return makeCard("Natal",house,items,"No applicable natal classification or reverse-aspect rule is recorded for this placement in the loaded reference data.");
    }
    function varshphalCard(planet,house) {
      const rows=(loaded.varshphal&&loaded.varshphal.houses&&loaded.varshphal.houses[String(house)])||[];
      const entry=rows.find(row=>row.planet===planet);
      if(!entry)return makeCard("Varshphal · Year "+context.activeYear,house,[],"No entry for this planet and house is present in the loaded Varshphal reference.");
      return makeCard("Varshphal · Year "+context.activeYear,house,[
        {label:"Good result",value:entry.good_result},
        {label:"If bad",value:entry.if_bad},
        {label:"Special rules",value:entry.special_rules},
        {label:"Offline class notes",value:entry.offline_class_notes},
        {label:"Recommendation",value:entry.recommendation},
        {label:"Symptom",value:entry.symptom},
        {label:"Impact",value:entry.impact}
      ],"No result fields are populated for this entry.");
    }
    function renderResults() {
      if(!loaded)return;
      content.replaceChildren();
      const planet=selectedPlanet;
      const nh=Number(context.natalPlanetHouses&&context.natalPlanetHouses[planet]);
      const vh=Number(context.varshPlanetHouses&&context.varshPlanetHouses[planet]);
      if(selectedScope==="both"){
        content.append(natalCard(planet,nh),varshphalCard(planet,vh));
      } else if(selectedScope==="natal") content.append(natalCard(planet,nh));
      else content.append(varshphalCard(planet,vh));
    }
    loadData().then(data=>{
      loaded=data;updatePlanetButtons();renderResults();status.remove();
    }).catch(error=>{status.textContent="Analysis rules could not be loaded. "+error.message;});
  }
  window.JALalKitabAnalysis={mount};
})();