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
    if (!dataPromise) {
      dataPromise = Promise.all([
        fetch(DATA_URLS.fundamental, { cache: "force-cache" }).then(r => { if (!r.ok) throw new Error("Fundamental rules unavailable"); return r.json(); }),
        fetch(DATA_URLS.varshphal, { cache: "force-cache" }).then(r => { if (!r.ok) throw new Error("Varshphal rules unavailable"); return r.json(); })
      ]).then(([fundamental, varshphal]) => ({ fundamental, varshphal }))
        .catch(error => { dataPromise = null; throw error; });
    }
    return dataPromise;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function addDetails(parent, title, value, open) {
    if (value == null || String(value).trim() === "") return;
    const details = el("details", "ja-lk-analysis-category");
    if (open) details.open = true;
    const summary = el("summary", "", title);
    details.appendChild(summary);
    details.appendChild(el("div", "ja-lk-analysis-copy", value));
    parent.appendChild(details);
  }

  function addCard(parent, title, house, items) {
    const card = el("article", "ja-lk-analysis-card");
    const head = el("header", "ja-lk-analysis-card-head");
    head.appendChild(el("h4", "", title));
    head.appendChild(el("span", "ja-lk-analysis-house", "House " + house));
    card.appendChild(head);
    let count = 0;
    items.forEach(item => {
      if (item.value == null || !String(item.value).trim()) return;
      addDetails(card, item.label, item.value, count === 0);
      count++;
    });
    if (count) parent.appendChild(card);
    return count;
  }

  function mount(root, context) {
    if (!root || !context) return;
    const divider = el("div", "ja-lk-analysis-divider");
    divider.setAttribute("role", "separator");
    divider.setAttribute("aria-hidden", "true");
    const section = el("section", "ja-lk-analysis-section");
    section.setAttribute("aria-label", "Lal Kitab Analysis");

    const heading = el("button", "ja-lk-analysis-toggle");
    heading.type = "button";
    heading.setAttribute("aria-expanded", "false");
    const headingText = el("span", "ja-lk-analysis-heading-text", "Lal Kitab Analysis");
    const countText = el("span", "ja-lk-analysis-heading-count", "Select a planet");
    const chevron = el("span", "ja-lk-analysis-chevron", "+");
    heading.append(headingText, countText, chevron);

    const body = el("div", "ja-lk-analysis-body");
    body.hidden = true;
    const toolbar = el("div", "ja-lk-analysis-toolbar");
    const planetNav = el("div", "ja-lk-analysis-planets");
    planetNav.setAttribute("role", "group");
    planetNav.setAttribute("aria-label", "Select planet");
    const scope = el("div", "ja-lk-analysis-scope");
    scope.setAttribute("role", "group");
    scope.setAttribute("aria-label", "Analysis scope");
    const content = el("div", "ja-lk-analysis-results");
    const status = el("p", "ja-lk-analysis-status", "Choose a planet to view the available source-based rules.");
    let selectedPlanet = "Sun";
    let selectedScope = "both";
    let loaded = null;

    const scopeOptions = [["both","Both"],["natal","Natal"],["varshphal","Varshphal"]];
    scopeOptions.forEach(([value,label]) => {
      const button = el("button", "", label);
      button.type = "button";
      button.dataset.scope = value;
      button.setAttribute("aria-pressed", String(value === selectedScope));
      button.addEventListener("click", () => {
        selectedScope = value;
        scope.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.scope === value)));
        renderResults();
      });
      scope.appendChild(button);
    });

    PLANETS.forEach(planet => {
      const button = el("button", "ja-lk-analysis-planet", planet);
      button.type = "button";
      button.dataset.planet = planet;
      button.setAttribute("aria-pressed", String(planet === selectedPlanet));
      button.addEventListener("click", () => {
        selectedPlanet = planet;
        planetNav.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.planet === planet)));
        renderResults();
      });
      planetNav.appendChild(button);
    });

    toolbar.append(planetNav, scope);
    body.append(toolbar, status, content);
    section.append(heading, body);
    root.append(divider, section);

    heading.addEventListener("click", () => {
      const expanded = heading.getAttribute("aria-expanded") !== "true";
      heading.setAttribute("aria-expanded", String(expanded));
      body.hidden = !expanded;
      chevron.textContent = expanded ? "−" : "+";
      if (expanded && !loaded) {
        status.textContent = "Loading source rules…";
        loadData().then(data => {
          loaded = data;
          renderResults();
        }).catch(error => {
          status.textContent = "Analysis rules could not be loaded. " + error.message;
        });
      }
    });

    function renderResults() {
      if (!loaded) return;
      content.replaceChildren();
      const planet = selectedPlanet;
      const natalHouse = Number(context.natalPlanetHouses && context.natalPlanetHouses[planet]);
      const varshHouse = Number(context.varshPlanetHouses && context.varshPlanetHouses[planet]);
      const fundamental = loaded.fundamental || {};
      const placement = fundamental.planetary_placement && fundamental.planetary_placement[planet];
      let visibleCount = 0;

      if (selectedScope === "both" || selectedScope === "natal") {
        const natalCard = el("article", "ja-lk-analysis-card");
        const head = el("header", "ja-lk-analysis-card-head");
        head.append(el("h4", "", "Natal Chart"), el("span", "ja-lk-analysis-house", Number.isFinite(natalHouse) ? "House " + natalHouse : "House unavailable"));
        natalCard.appendChild(head);
        let n = 0;
        if (placement && Number.isFinite(natalHouse)) {
          const good = (placement.normally_good_houses || []).includes(natalHouse);
          const bad = (placement.normally_bad_houses || []).includes(natalHouse);
          if (good || bad) {
            const label = good ? "Normally good placement" : "Normally bad placement";
            const note = good ? "This house is listed as normally good for " + planet + " in the supplied fundamental placement rule." : "This house is listed as normally bad for " + planet + " in the supplied fundamental placement rule.";
            addDetails(natalCard, label, note, true); n++;
          }
        }
        const reverse = fundamental.aspects && fundamental.aspects.reverse_aspects;
        const rules = reverse && Array.isArray(reverse.rules) ? reverse.rules.filter(rule => rule.planet === planet && Number(rule.placement_house) === natalHouse) : [];
        rules.forEach(rule => {
          const applicable = (rule.aspects || []).filter(a => {
            const occupants = Object.keys(context.natalPlanetHouses || {}).filter(p => Number(context.natalPlanetHouses[p]) === Number(a.receiving_house));
            return occupants.length > 0;
          });
          if (!applicable.length) return;
          addDetails(natalCard, "Special reverse aspect", applicable.map(a => {
            const occupants = Object.keys(context.natalPlanetHouses || {}).filter(p => Number(context.natalPlanetHouses[p]) === Number(a.receiving_house));
            return "Receiving House " + a.receiving_house + " (" + occupants.join(", ") + "): " + a.effect;
          }).join("\n"), n === 0);
          n++;
        });
        if (n === 0) addDetails(natalCard, "Source coverage", "No applicable natal classification or special reverse-aspect rule is recorded for this placement in the loaded reference data.", true);
        content.appendChild(natalCard);
        visibleCount += n;
      }

      if (selectedScope === "both" || selectedScope === "varshphal") {
        const rows = (loaded.varshphal && loaded.varshphal.houses && loaded.varshphal.houses[String(varshHouse)]) || [];
        const entry = rows.find(row => row.planet === planet);
        if (entry) {
          const items = [
            {label:"Good result",value:entry.good_result},
            {label:"If bad",value:entry.if_bad},
            {label:"Special rules",value:entry.special_rules},
            {label:"Offline class notes",value:entry.offline_class_notes},
            {label:"Recommendation",value:entry.recommendation},
            {label:"Symptom",value:entry.symptom},
            {label:"Impact",value:entry.impact}
          ];
          const card = el("article", "ja-lk-analysis-card");
          const head = el("header", "ja-lk-analysis-card-head");
          head.append(el("h4", "", "Varshphal · Year " + context.activeYear), el("span", "ja-lk-analysis-house", Number.isFinite(varshHouse) ? "House " + varshHouse : "House unavailable"));
          card.appendChild(head);
          items.forEach((item,index) => { if (item.value && String(item.value).trim()) { addDetails(card,item.label,item.value,index===0); visibleCount++; } });
          if (card.querySelector("details")) content.appendChild(card);
        } else {
          const card=el("article","ja-lk-analysis-card");
          card.append(el("h4","","Varshphal · Year "+context.activeYear),el("p","ja-lk-analysis-status","No entry for this planet and house is present in the loaded Varshphal reference."));
          content.appendChild(card);
        }
      }
      status.textContent = planet + " · " + (selectedScope === "both" ? "Natal + Varshphal" : selectedScope === "natal" ? "Natal" : "Varshphal") + " · " + visibleCount + " source section(s)";
      countText.textContent = "9 planets · " + planet;
    }

    if (context && context.activeYear != null) countText.textContent = "9 planets · Year " + context.activeYear;
  }

  window.JALalKitabAnalysis = { mount };
})();