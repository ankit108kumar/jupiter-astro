
/* ==========================================================
   JUPITER ASTRO — DETAILED VIMSHOTTARI DASHA OVERVIEW
   Reuses the existing D1/D9 chart calculation engine.
========================================================== */
(function () {
  "use strict";

  const ROW_HEIGHT = 46;
  const HEADER_HEIGHT = 42;
  const VISIBLE_ROWS = 11;
  const OVERSCAN = 3;

  const cacheByChart = new WeakMap();
  const activeInstances = new WeakMap();
  const liveInstances = new Set();
  const pendingMounts = new Map();

  // Fixed sign ownership used specifically for the D1 Lordships column.
  // Rahu and Ketu are shown as co-lords and are marked with an asterisk.
  const OWNED_SIGNS = {
    Sun: [4],
    Moon: [3],
    Mars: [0, 7],
    Mercury: [2, 5],
    Jupiter: [8, 11],
    Venus: [1, 6],
    Saturn: [9, 10],
    Rahu: [10],
    Ketu: [7]
  };
  const CO_LORDS = new Set(["Rahu", "Ketu"]);

  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  function dateLabel(ms) {
    const d = new Date(ms);
    return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
  }

  function durationLabel(startMs, endMs) {
    let a = new Date(startMs);
    let b = new Date(endMs);

    if (b < a) [a, b] = [b, a];

    let years = b.getFullYear() - a.getFullYear();
    let months = b.getMonth() - a.getMonth();
    let days = b.getDate() - a.getDate();

    if (days < 0) {
      days += new Date(b.getFullYear(), b.getMonth(), 0).getDate();
      months--;
    }

    if (months < 0) {
      months += 12;
      years--;
    }

    return `${years}y ${months}m ${days}d`;
  }

  function sequenceNumber(startLord, targetLord, vimOrder) {
    const start = vimOrder.indexOf(startLord);
    const target = vimOrder.indexOf(targetLord);

    if (start < 0 || target < 0) return "—";

    return String(
      ((target - start + vimOrder.length) % vimOrder.length) + 1
    );
  }

  /*
   * Reuse the existing application's chart engine.
   * getVargaItems(), houseLord() and houseFrom()
   * are supplied by the main application.
   */

  function degreesFromVargaItems(varga, planets) {
    const degrees = {};

    (varga.items || []).forEach(item => {
      if (item && item.p && Number.isFinite(item.deg)) {
        degrees[item.p] = item.deg;
      }
    });

    const missing = planets.filter(
      planet => !Number.isFinite(degrees[planet])
    );

    if (missing.length) {
      throw new Error(
        `Divisional degrees unavailable for: ${missing.join(", ")}`
      );
    }

    return degrees;
  }

  function lordshipText(
    planet,
    lagnaSign,
    positions,
    degrees,
    helpers
  ) {
    const ownedSigns = OWNED_SIGNS[planet] || [];
    const isCoLord = CO_LORDS.has(planet);

    return ownedSigns
      .slice()
      // Sort by house number for consistent ascending lordship display.
      .sort((a, b) =>
        helpers.houseFrom(a, lagnaSign) - helpers.houseFrom(b, lagnaSign)
      )
      .map(sign => {
        const house = helpers.houseFrom(sign, lagnaSign);
        return `${house}L${isCoLord ? "*" : ""}`;
      })
      .join(" & ") || "—";
  }

  function placementText(
    planet,
    positions,
    lagnaSign,
    helpers
  ) {
    const sign = positions[planet];

    if (!Number.isFinite(sign)) return "—";

    return `${helpers.houseFrom(sign, lagnaSign)}H`;
  }

  function makePlanetDetails(kData, helpers) {
    const d1 = helpers.getVargaItems(kData, 1);
    const d9 = helpers.getVargaItems(kData, 9);

    const d1Degrees = degreesFromVargaItems(
      d1,
      helpers.planets
    );

    
    const details = {
      d1Placement: {},
      d1Lordship: {},
      d9Placement: {}
    };

    helpers.planets.forEach(planet => {
      details.d1Placement[planet] = placementText(
        planet, d1.posN, d1.lagna, helpers
      );

      details.d1Lordship[planet] = lordshipText(
        planet, d1.lagna, d1.posN, d1Degrees, helpers
      );

      details.d9Placement[planet] = placementText(
        planet, d9.posN, d9.lagna, helpers
      );
    });

    return details;
  }

  function nextPaint() {
    return new Promise(resolve =>
      requestAnimationFrame(resolve)
    );
  }

  async function buildTimeline(kData, helpers, statusEl) {
    const auth = window.firebaseAuth;
    const user = auth && auth.currentUser;
    if (!user || typeof user.getIdToken !== "function") {
      throw new Error("Please sign in to view the Detailed Dasha Overview.");
    }

    if (statusEl) statusEl.textContent = "Verifying your login and preparing the timeline…";

    // Keep the existing chart engine for D1/D9 details. The protected API
    // verifies the Firebase ID token and builds the complete Dasha timeline.
    const details = makePlanetDetails(kData, helpers);
    const idToken = await user.getIdToken();

    const response = await fetch("/api/dasha-overview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + idToken
      },
      cache: "no-store",
      body: JSON.stringify({
        mdList: (kData.md.list || []).map(md => ({
          lord: md.lord,
          start: md.start,
          years: md.years
        })),
        yearDays: 365.25,
        details
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.authorized !== true || !Array.isArray(payload.rows)) {
      throw new Error(payload.error || "Unable to authorize the Dasha overview.");
    }

    return payload.rows;
  }

  function cacheFor(kData, offsetDays) {
    let byOffset = cacheByChart.get(kData);

    if (!byOffset) {
      byOffset = new Map();
      cacheByChart.set(kData, byOffset);
    }

    const key = String(offsetDays || 0);

    if (!byOffset.has(key)) {
      byOffset.set(key, {
        rows: null,
        promise: null
      });
    }

    return byOffset.get(key);
  }

  function selectedRowIndex(rows, evalMs) {
    if (!rows.length) return 0;

    let low = 0;
    let high = rows.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const row = rows[mid];

      if (evalMs < row.start) {
        high = mid - 1;
      } else if (evalMs >= row.end) {
        low = mid + 1;
      } else {
        return mid;
      }
    }

    return Math.max(
      0,
      Math.min(rows.length - 1, low)
    );
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/[&<>"']/g, ch => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[ch]);
  }

  
function renderVirtual(instance, forceCentre) {
  const {
    rows,
    viewport,
    spacer,
    content,
    evalMs
  } = instance;

  const total = rows.length;

  // STEP 1: Set the COMPLETE timeline height first.
  // This is essential for calculating the correct scroll position.
  spacer.style.height = `${total * ROW_HEIGHT}px`;

  // STEP 2: Calculate the available scrolling area.
  const dataViewportHeight = Math.max(
    0,
    viewport.clientHeight - HEADER_HEIGHT
  );

  // STEP 3: Now calculate maximum scroll position.
  const maxScroll = Math.max(
    0,
    viewport.scrollHeight - viewport.clientHeight
  );

  // STEP 4: Position the running MD-AD-PD row.
  if (forceCentre && total > 0) {
    const selected = selectedRowIndex(
      rows,
      Number(evalMs)
    );

    // Five preceding rows; running row becomes sixth.
    const precedingRows = 5;

    const target =
      (selected - precedingRows) * ROW_HEIGHT;

    viewport.scrollTop = Math.max(
      0,
      Math.min(maxScroll, target)
    );
  }

  // STEP 5: Render only visible rows plus overscan.
  const scrollTop = viewport.scrollTop;

  const first = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN
  );

  const last = Math.min(
    total,
    Math.ceil(
      (scrollTop + viewport.clientHeight) / ROW_HEIGHT
    ) + OVERSCAN
  );

  content.style.transform =
    `translateY(${first * ROW_HEIGHT}px)`;

  let html = "";

  for (let i = first; i < last; i++) {
    const row = rows[i];

    const selected =
      Number(evalMs) >= row.start &&
      Number(evalMs) < row.end;

    html += `
      <div class="ddo-row${selected ? " is-selected" : ""}"
           role="row"
           aria-rowindex="${i + 2}"
           data-row-index="${i}">

        <div class="ddo-cell ddo-sequence" role="cell">
          <span class="ddo-planet-sequence">${escapeHtml(row.md)}-${escapeHtml(row.ad)}-${escapeHtml(row.pd)}</span>
          <span class="ddo-sequence-counts">(${escapeHtml(row.mdNo)}-${escapeHtml(row.adNo)}-${escapeHtml(row.pdNo)})</span>
        </div>

        <div class="ddo-cell ddo-period" role="cell">
          <span class="ddo-period-date">
            ${dateLabel(row.start)} to ${dateLabel(row.end)}
          </span>
        </div>

        <div class="ddo-cell ddo-detail" role="cell">
          ${escapeHtml(row.d1Placement)}
        </div>

        <div class="ddo-cell ddo-detail" role="cell"
             title="${escapeHtml(row.d1Lordship)}">
          ${escapeHtml(row.d1Lordship)}
        </div>

        <div class="ddo-cell ddo-detail" role="cell">
          ${escapeHtml(row.d9Placement)}
        </div>

      </div>`;
  }

  content.innerHTML = html;
}


  function buildShell(container) {
    const section = document.createElement("section");

    section.className = "ddo-section";

    section.innerHTML = `
      <header class="ddo-heading">
        <div>
          <h3>Detailed Dasha Overview</h3>
          <p>Complete Vimshottari timeline · MD – AD – PD</p>
        </div>
        <span class="ddo-count" data-ddo-count></span>
      </header>

      <div class="ddo-loading" data-ddo-loading>
        <span class="ddo-spinner" aria-hidden="true"></span>
        <strong>Preparing Detailed Dasha Overview</strong>
<span data-ddo-status>
  Calculating 120-year MD–AD–PD timeline…
</span>
      </div>

      <div class="ddo-table-wrap" data-ddo-table hidden>
        <div class="ddo-table-scroll"
             data-ddo-viewport
             tabindex="0"
             role="table"
             aria-label="Detailed Dasha Overview">

          <div class="ddo-table-minwidth">
            <div class="ddo-header" role="row">
              <div role="columnheader">Dasha Sequence</div>
              <div role="columnheader">Period</div>
              <div role="columnheader">D1 Placement</div>
              <div role="columnheader">D1 Lordships</div>
              <div role="columnheader">D9 Placement</div>
            </div>

            <div class="ddo-virtual" data-ddo-spacer>
              <div class="ddo-virtual-content"
                   data-ddo-content></div>
            </div>
          </div>
        </div>
      </div>

      <div class="ddo-error" data-ddo-error hidden></div>
    `;

    container.insertAdjacentElement("afterend", section);

    return {
      section,
      loading: section.querySelector("[data-ddo-loading]"),
      status: section.querySelector("[data-ddo-status]"),
      table: section.querySelector("[data-ddo-table]"),
      viewport: section.querySelector("[data-ddo-viewport]"),
      spacer: section.querySelector("[data-ddo-spacer]"),
      content: section.querySelector("[data-ddo-content]"),
      count: section.querySelector("[data-ddo-count]"),
      error: section.querySelector("[data-ddo-error]")
    };
  }

  function disposeInstance(instance) {
    if (!instance || instance.disposed) return;
    instance.disposed = true;
    if (instance.scrollHandler && instance.viewport) {
      instance.viewport.removeEventListener("scroll", instance.scrollHandler);
    }
    if (instance.rafId) cancelAnimationFrame(instance.rafId);
    if (instance.section) instance.section.remove();
    liveInstances.delete(instance);
    if (instance.options && instance.options.container &&
        activeInstances.get(instance.options.container) === instance) {
      activeInstances.delete(instance.options.container);
    }
  }

  async function mount(options) {
    const {
      container,
      kData,
      evalMs,
      helpers
    } = options || {};

    if (!container || !kData || !helpers) return;
    pendingMounts.set(container, options);

    // Wait for Firebase's initial session restoration before deciding access.
    if (window.jaAuthReady && typeof window.jaAuthReady.then === "function") {
      await window.jaAuthReady;
    }

    if (!(window.firebaseAuth && window.firebaseAuth.currentUser)) {
      const existing = activeInstances.get(container);
      disposeInstance(existing);
      return;
    }

    pendingMounts.delete(container);
    const previous = activeInstances.get(container);

    if (previous && previous.section.isConnected && previous.kData === kData && previous.helpers === helpers) {
      const evaluationChanged = previous.evalMs !== evalMs;
      previous.evalMs = evalMs;
      previous.options = options;
      if (previous.rows && evaluationChanged) renderVirtual(previous, true);
      return;
    }
    if (previous) disposeInstance(previous);

    const ui = buildShell(container);

    const instance = {
      ...ui,
      rows: null,
      evalMs,
      kData,
      helpers,
      disposed: false,
      rafId: 0,
      scrollHandler: null,
      viewport: ui.viewport,
      spacer: ui.spacer,
      content: ui.content
    };

    instance.options = options;
    activeInstances.set(container, instance);
    liveInstances.add(instance);

    const cache = cacheFor(
      kData,
      kData.offsetDays || 0
    );

    try {
      if (cache.rows) {
        instance.rows = cache.rows;
      } else {
        if (!cache.promise) {
          cache.promise = buildTimeline(
            kData,
            helpers,
            ui.status
          )
            .then(rows => {
              cache.rows = rows;
              return rows;
            })
            .catch(error => {
              cache.promise = null;
              throw error;
            });
        }

        instance.rows = await cache.promise;
      }

      if (instance.disposed || activeInstances.get(container) !== instance || !ui.section.isConnected) return;

// Do not expose the table until the complete dataset is ready.
if (!instance.rows || !instance.rows.length) {
  throw new Error("The Dasha timeline contains no periods.");
}

ui.count.textContent =
  `${instance.rows.length.toLocaleString()} periods`;

await nextPaint();
await nextPaint();

// Show the table and position at the running Dasha.
ui.table.hidden = false;

await nextPaint();

renderVirtual(instance, true);

// Hide processing only after the default view is ready.
ui.loading.hidden = true;

      instance.scrollHandler = () => {
        if (instance.disposed || instance.rafId) return;
        instance.rafId = requestAnimationFrame(() => {
          instance.rafId = 0;
          if (!instance.disposed && activeInstances.get(container) === instance) {
            renderVirtual(instance, false);
          }
        });
      };
      ui.viewport.addEventListener("scroll", instance.scrollHandler, { passive: true });

    } catch (error) {
      console.error(
        "Detailed Dasha Overview:",
        error
      );

      ui.loading.hidden = true;
      ui.error.hidden = false;

      ui.error.textContent =
        error && error.message
          ? error.message
          : "Unable to prepare the Dasha overview. Please reopen this tab and try again.";
    }
  }

  // Remove protected Dasha rows immediately on logout.
  window.addEventListener("ja-auth-state-changed", event => {
    const user = event.detail && event.detail.user;
    if (!user) {
      Array.from(liveInstances).forEach(instance => {
        if (instance.options && instance.options.container) pendingMounts.set(instance.options.container, instance.options);
        disposeInstance(instance);
      });
      return;
    }

    // If the user signs in while already viewing the Dasha tab, restore
    // the overview without requiring a tab switch.
    const queued = Array.from(pendingMounts.values());
    pendingMounts.clear();
    queued.forEach(options => mount(options));
  });

  window.DetailedDashaOverview = { mount };

})();
