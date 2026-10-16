<script>
  import { currentPage } from '$lib/stores/ui.js';
  import { trees } from '$lib/stores/trees.js';
  import { isEabRisk, priorityScore, priorityLevel } from '$lib/utils/itree.js';
  import { downloadExecSummary } from '$lib/utils/export.js';
  import { showToast } from '$lib/stores/toast.js';

  let downloadingExec = $state(false);

  async function handleExecSummary() {
    downloadingExec = true;
    try { await downloadExecSummary($trees); }
    catch(e) { showToast('Download failed: ' + e.message, 'error'); }
    finally { downloadingExec = false; }
  }

  const fmt  = n => '$' + Math.round(n).toLocaleString();
  const fmtK = n => n >= 1000 ? '$' + (n/1000).toFixed(1) + 'k' : fmt(n);

  const COND_COLORS = { Good: '#5ec254', Fair: '#e8c34a', Poor: '#e07a30', Dead: '#d04444' };
  const COND_ORDER  = ['Good', 'Fair', 'Poor', 'Dead'];
  const AGE_ORDER   = ['Young', 'Semi-mature', 'Mature', 'Over-mature'];
  const AGE_COLORS  = ['#7ec8e3', '#8fc67f', '#c9973a', '#b5886a'];
  const SP_VAL_COLORS  = ['#1a5216','#2d7a28','#3d8a4e','#4a9c59','#5ba266','#6aab72','#7abc7e','#8acb8a'];
  const LOC_VAL_COLORS = ['#1e4d7a','#1a5c8a','#215f8e','#2b6995','#236b8c','#1d5f80','#27728f','#1f5a7a'];

  const DBH_BINS = ['< 6"', '6–12"', '12–18"', '18–24"', '24–36"', '> 36"'];
  const PRIORITY_LEVELS = [
    { key: 'Critical', color: '#d04444' },
    { key: 'High',     color: '#d06828' },
    { key: 'Moderate', color: '#d4ae30' },
    { key: 'Low',      color: '#5ec254' },
  ];

  const ASSET_BY_OPTIONS = ['Condition', 'Age Class', 'Species', 'Location'];
  let assetBy = $state('Condition');

  let stats = $derived((() => {
    const all = $trees;
    let totalVal = 0, vc = 0, va = 0, vs = 0, ve = 0;
    const condCounts = { Good: 0, Fair: 0, Poor: 0, Dead: 0 };
    const ageCounts  = { Young: 0, 'Semi-mature': 0, Mature: 0, 'Over-mature': 0 };
    const spCounts   = {};
    const condVal    = { Good: 0, Fair: 0, Poor: 0, Dead: 0 };
    const ageVal     = { Young: 0, 'Semi-mature': 0, Mature: 0, 'Over-mature': 0 };
    const spVal      = {};
    const locVal     = {};
    let eabCount = 0;
    const eabSpCounts = {};

    // New accumulators
    const dbhBinMap      = Object.fromEntries(DBH_BINS.map(k => [k, 0]));
    const priorityCounts = { Critical: 0, High: 0, Moderate: 0, Low: 0 };

    all.forEach(t => {
      // ── existing accumulations (unchanged) ──
      if (t.vt) { totalVal += t.vt; vc += t.vc||0; va += t.va||0; vs += t.vs||0; ve += t.ve||0; }
      if (t.c && condCounts[t.c] !== undefined) condCounts[t.c]++;
      if (t.a && ageCounts[t.a] !== undefined)  ageCounts[t.a]++;
      if (t.n) spCounts[t.n] = (spCounts[t.n]||0) + 1;
      if (t.vt && t.c) condVal[t.c] = (condVal[t.c]||0) + t.vt;
      if (t.vt && t.a && ageVal[t.a] !== undefined) ageVal[t.a] = (ageVal[t.a]||0) + t.vt;
      if (t.vt && t.n) spVal[t.n] = (spVal[t.n]||0) + t.vt;
      if (t.vt && t.st) locVal[t.st] = (locVal[t.st]||0) + t.vt;
      if (isEabRisk(t)) { eabCount++; eabSpCounts[t.n] = (eabSpCounts[t.n]||0) + 1; }

      // ── DBH bins (Section 2) ──
      if (t.d) {
        const d = parseFloat(t.d);
        if (d > 0) {
          if      (d < 6)  dbhBinMap['< 6"']++;
          else if (d < 12) dbhBinMap['6–12"']++;
          else if (d < 18) dbhBinMap['12–18"']++;
          else if (d < 24) dbhBinMap['18–24"']++;
          else if (d < 36) dbhBinMap['24–36"']++;
          else             dbhBinMap['> 36"']++;
        }
      }

      // ── Priority counts (Section 3, non-Dead only) ──
      if (t.c !== 'Dead') {
        const { displayScore } = priorityScore(t);
        const { label } = priorityLevel(displayScore);
        if (priorityCounts[label] !== undefined) priorityCounts[label]++;
      }
    });

    // ── existing derived values (unchanged) ──
    const spCount      = Object.keys(spCounts).length;
    const topSpecies   = Object.entries(spCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);
    const spMax        = topSpecies[0]?.[1] || 1;
    const ageMax       = Math.max(...AGE_ORDER.map(k => ageCounts[k] || 0));
    const condTotal    = COND_ORDER.reduce((s,k) => s + condCounts[k], 0);
    const topSpByVal   = Object.entries(spVal).sort((a,b) => b[1]-a[1]).slice(0, 8);
    const topLocByVal  = Object.entries(locVal).sort((a,b) => b[1]-a[1]).slice(0, 10);

    // ── new derived values ──
    // Section 1: Canopy Health Score
    const healthyPct = condTotal
      ? Math.round((condCounts.Good + condCounts.Fair) / condTotal * 100)
      : 0;

    // Section 2: DBH bins
    const dbhBins = DBH_BINS.map(k => ({ label: k, count: dbhBinMap[k] }));
    const dbhMax  = Math.max(...dbhBins.map(b => b.count), 1);

    // Section 5: Infestation (only trees with inf field populated — post-full-fetch)
    const infTrees = all.filter(t => t.inf && t.inf.trim());
    const infestationSampleSize = infTrees.length;
    const infTokens = {};
    infTrees.forEach(t => {
      t.inf.split(/[,;/]/).forEach(tok => {
        const k = tok.trim().toLowerCase();
        if (k) infTokens[k] = (infTokens[k]||0) + 1;
      });
    });
    const infestationTags = Object.entries(infTokens).sort((a,b) => b[1]-a[1]).slice(0, 8);

    // Section 6: Carbon equivalency
    const co2Tons   = vc > 0 ? Math.round(vc / 190) : 0;
    const carsEquiv = vc > 0 ? Math.round(vc / 190 / 4.6) : 0;
    const stormGal  = vs > 0 ? Math.round(vs / 0.0015) : 0;

    return {
      total: all.length, totalVal, vc, va, vs, ve,
      condCounts, condTotal, ageCounts, ageMax,
      spCount, topSpecies, spMax,
      eabCount, eabSpCounts,
      condVal, ageVal, topSpByVal, topLocByVal,
      // new
      healthyPct,
      dbhBins, dbhMax,
      priorityCounts,
      infestationTags, infestationSampleSize,
      co2Tons, carsEquiv, stormGal,
    };
  })());

  // Dynamic asset-value bars (unchanged)
  let assetBarRows = $derived((() => {
    if (assetBy === 'Condition') {
      const max = Math.max(...COND_ORDER.map(k => stats.condVal[k]||0), 1);
      return COND_ORDER.map(k => ({ label: k, value: stats.condVal[k]||0, color: COND_COLORS[k], max }));
    } else if (assetBy === 'Age Class') {
      const max = Math.max(...AGE_ORDER.map(k => stats.ageVal[k]||0), 1);
      return AGE_ORDER.map((k, i) => ({ label: k, value: stats.ageVal[k]||0, color: AGE_COLORS[i], max }));
    } else if (assetBy === 'Species') {
      const max = stats.topSpByVal[0]?.[1] || 1;
      return stats.topSpByVal.map(([name, v], i) => ({ label: name, value: v, color: SP_VAL_COLORS[i % SP_VAL_COLORS.length], max }));
    } else {
      const max = stats.topLocByVal[0]?.[1] || 1;
      return stats.topLocByVal.map(([loc, v], i) => ({ label: loc, value: v, color: LOC_VAL_COLORS[i % LOC_VAL_COLORS.length], max }));
    }
  })());

  // SVG donut arc helpers (unchanged)
  function polarXY(angleDeg, radius, cx, cy) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }
  function arcPath(startDeg, endDeg, radius, cx, cy) {
    const s = polarXY(startDeg, radius, cx, cy);
    const e = polarXY(endDeg, radius, cx, cy);
    const large = (endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }
  let donutArcs = $derived((() => {
    const arcs = [];
    let start = 0;
    const gap = 2;
    COND_ORDER.forEach(k => {
      const pct = stats.condTotal ? stats.condCounts[k] / stats.condTotal : 0;
      const sweep = pct * 360;
      if (sweep >= 0.5) {
        arcs.push({ d: arcPath(start, start + sweep - gap, 34, 55, 55), color: COND_COLORS[k] });
      }
      start += sweep;
    });
    return arcs;
  })());
</script>

<div class="cum-overlay">
  <div class="cum-wrap">

    <!-- Top bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <button class="cum-back" onclick={() => currentPage.set('map')}>← Back to Map</button>
      <button class="cum-action-btn" onclick={handleExecSummary} disabled={downloadingExec}>
        <span class="ic"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> {downloadingExec ? 'Generating…' : 'Executive Summary'}
      </button>
    </div>

    <div class="cum-hero">
      <h1>Cumulative Data</h1>
      <p>Waterville Urban Tree Inventory — Live Summary</p>
    </div>

    <!-- ── INVENTORY ──────────────────────────────────────────────────── -->
    <div class="cum-section">
      <div class="cum-section-hdr">Inventory</div>

      <!-- Count KPIs — Section 1: Healthy Canopy added as third card -->
      <div class="cum-grid three">
        <div class="cum-card">
          <div class="cum-card-title">Total Trees</div>
          <div class="cum-big">{stats.total.toLocaleString()}</div>
          <div class="cum-big-unit">trees inventoried</div>
        </div>
        <div class="cum-card">
          <div class="cum-card-title">Species Diversity</div>
          <div class="cum-big">{stats.spCount}</div>
          <div class="cum-big-unit">unique species</div>
        </div>
        <!-- Section 1: Canopy Health Score -->
        <div class="cum-card">
          <div class="cum-card-title">Healthy Canopy</div>
          <div class="cum-big" style="color:{stats.healthyPct >= 70 ? '#1a5216' : stats.healthyPct >= 50 ? '#c9973a' : '#b83535'}">{stats.healthyPct}%</div>
          <div class="cum-big-unit">Good + Fair condition</div>
        </div>
      </div>

      <!-- Condition + Age (unchanged) -->
      <div class="cum-grid two">
        <div class="cum-card">
          <div class="cum-card-title">Trees by Condition</div>
          <div class="cum-donut-wrap">
            <svg width="110" height="110" viewBox="0 0 110 110">
              {#each donutArcs as arc}
                <path d={arc.d} fill="none" stroke={arc.color} stroke-width="14" stroke-linecap="round"/>
              {/each}
              <text x="55" y="59" text-anchor="middle" font-family="Playfair Display,serif" font-size="15" fill="#0f2e14">{stats.total}</text>
              <text x="55" y="71" text-anchor="middle" font-family="Outfit,sans-serif" font-size="6" fill="#5c3d08" letter-spacing="1">TREES</text>
            </svg>
            <div class="cum-legend">
              {#each COND_ORDER as k}
                {@const count = stats.condCounts[k]}
                {@const pct = stats.condTotal ? Math.round(count / stats.condTotal * 100) : 0}
                <div class="cum-legend-item">
                  <div class="cum-legend-dot" style="background:{COND_COLORS[k]}"></div>
                  <span class="cum-legend-label">{k}</span>
                  <span class="cum-legend-val">{count} ({pct}%)</span>
                </div>
              {/each}
            </div>
          </div>
        </div>
        <div class="cum-card">
          <div class="cum-card-title">Trees by Age Class</div>
          <div class="cum-bar-chart">
            {#each AGE_ORDER as k, i}
              {@const n = stats.ageCounts[k] || 0}
              {@const pct = stats.ageMax ? (n / stats.ageMax * 100) : 0}
              <div class="cum-bar-row">
                <div class="cum-bar-name">{k}</div>
                <div class="cum-bar-track">
                  <div class="cum-bar-fill" style="width:{pct}%;background:{AGE_COLORS[i]}">
                    <span class="cum-bar-fill-val">{n}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Section 2: DBH Size Distribution -->
      <div class="cum-card">
        <div class="cum-card-title">DBH Size Distribution</div>
        <div class="cum-bar-chart">
          {#each stats.dbhBins as bin}
            {@const pct = stats.dbhMax ? (bin.count / stats.dbhMax * 100) : 0}
            <div class="cum-bar-row">
              <div class="cum-bar-name">{bin.label}</div>
              <div class="cum-bar-track">
                <div class="cum-bar-fill" style="width:{pct}%;background:#5a9e5a">
                  {#if bin.count > 0}<span class="cum-bar-fill-val">{bin.count}</span>{/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
        <div class="cum-note">DBH (diameter at breast height) measures trunk size as a proxy for canopy volume. A healthy urban forest has trees across all size classes.</div>
      </div>

      <!-- Top species (unchanged) -->
      <div class="cum-card">
        <div class="cum-card-title">Top 8 Species by Count</div>
        <div class="cum-species-list">
          {#each stats.topSpecies as [name, n]}
            {@const pct = (n / stats.spMax * 100)}
            <div class="cum-species-row">
              <div class="cum-species-name">{name}</div>
              <div class="cum-species-bar"><div class="cum-species-bar-fill" style="width:{pct}%"></div></div>
              <div class="cum-species-n">{n}</div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- ── ECONOMIC VALUE ─────────────────────────────────────────────── -->
    <div class="cum-section">
      <div class="cum-section-hdr">Economic Value</div>

      <!-- What This Forest Does — carbon/stormwater equivalencies derived from i-Tree economic values -->
      <div class="cum-card">
        <div class="cum-card-title">What This Forest Does</div>
        <div class="cum-equiv-row">
          <div class="cum-equiv-cell">
            <div class="cum-equiv-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
              </svg>
            </div>
            <div class="cum-equiv-num">{stats.co2Tons.toLocaleString()}</div>
            <div class="cum-equiv-lbl">metric tons CO₂ sequestered</div>
          </div>
          <div class="cum-equiv-cell">
            <div class="cum-equiv-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 17H5a2 2 0 0 1-2-2V9a2 2 0 0 1 .08-.6l1.38-3.13A2 2 0 0 1 6.38 4h11.24a2 2 0 0 1 1.92 1.27L20.92 8.4A2 2 0 0 1 21 9v6a2 2 0 0 1-2 2z"/>
                <circle cx="7" cy="17" r="2"/>
                <circle cx="17" cy="17" r="2"/>
              </svg>
            </div>
            <div class="cum-equiv-num">{stats.carsEquiv.toLocaleString()}</div>
            <div class="cum-equiv-lbl">cars off the road for a year</div>
          </div>
          <div class="cum-equiv-cell">
            <div class="cum-equiv-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/>
                <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>
              </svg>
            </div>
            <div class="cum-equiv-num">{stats.stormGal.toLocaleString()}</div>
            <div class="cum-equiv-lbl">gallons of stormwater intercepted/year</div>
          </div>
        </div>
        <div class="cum-note">Carbon equivalency uses EPA 2023 Social Cost of Carbon ($190/metric ton). Stormwater at $1.50/1,000 gal.</div>
      </div>

      <div class="cum-grid two" style="align-items:start">
        <!-- i-Tree breakdown (unchanged) -->
        <div class="cum-card">
          <div class="cum-card-title">i-Tree Value Breakdown</div>
          <div class="cum-itree-total-row">
            <span class="cum-itree-total-lbl">Total Asset Value</span>
            <span class="cum-itree-total-amt">{fmt(stats.totalVal)}</span>
          </div>
          <div class="cum-itree-grid">
            <div class="cum-itree-cell">
              <div class="cum-itree-amt">{fmtK(stats.vc)}</div>
              <div class="cum-itree-lbl">Carbon</div>
              <div class="cum-itree-desc">Carbon storage &amp; sequestration</div>
            </div>
            <div class="cum-itree-cell">
              <div class="cum-itree-amt">{fmtK(stats.va)}</div>
              <div class="cum-itree-lbl">Air Quality</div>
              <div class="cum-itree-desc">Pollutant removal from air</div>
            </div>
            <div class="cum-itree-cell">
              <div class="cum-itree-amt">{fmtK(stats.vs)}</div>
              <div class="cum-itree-lbl">Stormwater</div>
              <div class="cum-itree-desc">Rainfall interception value</div>
            </div>
            <div class="cum-itree-cell">
              <div class="cum-itree-amt">{fmtK(stats.ve)}</div>
              <div class="cum-itree-lbl">Energy</div>
              <div class="cum-itree-desc">Heating &amp; cooling savings</div>
            </div>
          </div>
        </div>

        <!-- Asset value by dropdown (unchanged) -->
        <div class="cum-card">
          <div class="cum-card-title-row">
            <span>Asset Value by</span>
            <div class="cum-asset-by-wrap">
              <select class="cum-asset-by-sel" bind:value={assetBy}>
                {#each ASSET_BY_OPTIONS as opt}
                  <option>{opt}</option>
                {/each}
              </select>
              <svg class="cum-asset-by-chevron" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div class="cum-bar-chart">
            {#each assetBarRows as row}
              {@const pct = row.max ? (row.value / row.max * 100) : 0}
              <div class="cum-bar-row">
                <div class="cum-bar-name cum-bar-name--asset">{row.label}</div>
                <div class="cum-bar-track">
                  {#if pct > 0}
                    <div class="cum-bar-fill" style="width:{pct}%;background:{row.color}"></div>
                  {/if}
                </div>
                <span class="cum-bar-ext-val">{pct > 0 ? fmtK(row.value) : '—'}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- ── RISK ASSESSMENT ────────────────────────────────────────────── -->
    <div class="cum-section">
      <div class="cum-section-hdr">Risk Assessment</div>

      <!-- Section 3: Tree Priority Breakdown -->
      <div class="cum-card">
        <div class="cum-card-title">Tree Priority Breakdown</div>
        <div class="cum-itree-grid">
          {#each PRIORITY_LEVELS as lvl}
            <div class="cum-itree-cell">
              <div class="cum-itree-amt" style="color:{lvl.color}">{stats.priorityCounts[lvl.key]}</div>
              <div class="cum-itree-lbl">{lvl.key}</div>
            </div>
          {/each}
        </div>
        <div class="cum-disclaimer">Priority scores are condition-based only. Structural observations are loaded per-tree and not available in the inventory summary.</div>
      </div>

      <!-- Section 5: Infestation & Disease -->
      <div class="cum-card">
        <div class="cum-card-title">Infestation &amp; Disease Notes</div>
        {#if stats.infestationSampleSize === 0}
          <div class="cum-inf-empty">No infestation data loaded yet — open individual trees to populate this field.</div>
        {:else}
          <div class="cum-eab-species">
            {#each stats.infestationTags as [tag, n]}
              <div class="cum-eab-sp-tag">{tag}<span class="cum-eab-sp-ct">{n}</span></div>
            {/each}
          </div>
          <div class="cum-note">Based on {stats.infestationSampleSize} tree record{stats.infestationSampleSize !== 1 ? 's' : ''} with infestation data entered.</div>
        {/if}
      </div>

      <!-- EAB Risk (unchanged) -->
      <div class="cum-card">
        <div class="cum-card-title">Emerald Ash Borer Risk</div>
        <div class="cum-eab-banner">
          <div style="font-size:1.6rem;flex-shrink:0;color:#b83535">⚠</div>
          <div>
            <div class="cum-eab-count">{stats.eabCount} at-risk tree{stats.eabCount !== 1 ? 's' : ''}</div>
            <div class="cum-eab-desc">Ash-species trees auto-detected in the inventory</div>
          </div>
        </div>
        {#if Object.keys(stats.eabSpCounts).length}
          <div class="cum-eab-species">
            {#each Object.entries(stats.eabSpCounts) as [sp, n]}
              <div class="cum-eab-sp-tag">{sp}<span class="cum-eab-sp-ct">{n}</span></div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

  </div>
</div>

<style>
  /* ── existing styles (unchanged) ── */
  .cum-overlay{flex:1;min-height:0;background:var(--bg);overflow-y:auto}
  .cum-wrap{width:100%;max-width:1100px;margin:0 auto;padding:32px 28px 60px;display:flex;flex-direction:column;gap:40px}
  .cum-section{display:flex;flex-direction:column;gap:16px}
  .cum-section-hdr{font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:#5c3d08;opacity:.55;display:flex;align-items:center;gap:10px}
  .cum-section-hdr::after{content:'';flex:1;height:1px;background:rgba(120,80,20,.2)}
  .cum-action-btn{background:transparent;border:1px solid rgba(120,80,20,.25);border-radius:4px;padding:5px 13px;font-family:'Outfit',sans-serif;font-size:.74rem;color:#5c3d08;cursor:pointer;transition:all .13s;display:inline-flex;align-items:center;gap:5px;flex-shrink:0}
  .cum-action-btn:hover{background:rgba(92,61,8,.1);border-color:#5c3d08}
  .cum-action-btn:disabled{opacity:.5;cursor:default}
  .cum-action-btn .ic{display:inline-flex;align-items:center}
  .cum-back{background:transparent;border:1px solid rgba(120,80,20,.25);border-radius:4px;padding:5px 13px;font-family:'Outfit',sans-serif;font-size:.74rem;color:#5c3d08;cursor:pointer;transition:all .13s}
  .cum-back:hover{background:rgba(92,61,8,.1);border-color:#5c3d08}
  .cum-hero{text-align:center;padding:28px 0 8px}
  .cum-hero h1{font-family:'Playfair Display',serif;font-size:2.2rem;color:#0f2e14;margin-bottom:6px}
  .cum-hero p{font-size:.76rem;letter-spacing:.1em;text-transform:uppercase;color:#3a3a3a}
  .cum-grid{display:grid;gap:16px}
  .cum-grid.two{grid-template-columns:1fr 1fr}
  .cum-grid.three{grid-template-columns:1fr 1fr 1fr}
  .cum-grid.four{grid-template-columns:1fr 1fr 1fr 1fr}
  @media(max-width:800px){:is(.cum-grid.two,.cum-grid.three,.cum-grid.four){grid-template-columns:1fr 1fr}}
  @media(max-width:520px){:is(.cum-grid.two,.cum-grid.three,.cum-grid.four){grid-template-columns:1fr}}
  .cum-card{background:#f5ede0;border:1px solid rgba(120,80,20,.18);border-radius:7px;padding:18px 20px;display:flex;flex-direction:column;gap:10px}
  .cum-card-title{font-size:.65rem;letter-spacing:.13em;text-transform:uppercase;color:#5c3d08;border-bottom:1px solid rgba(120,80,20,.18);padding-bottom:8px}
  .cum-card-title-row{display:flex;align-items:center;gap:6px;border-bottom:1px solid rgba(120,80,20,.18);padding-bottom:8px;font-size:.65rem;letter-spacing:.13em;text-transform:uppercase;color:#5c3d08;flex-wrap:wrap}
  .cum-asset-by-wrap{position:relative;display:inline-flex;align-items:center}
  .cum-asset-by-sel{appearance:none;-webkit-appearance:none;background:rgba(120,80,20,.08);border:1px solid rgba(120,80,20,.3);border-radius:4px;padding:2px 22px 2px 8px;font-family:'Outfit',sans-serif;font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:#5c3d08;cursor:pointer;outline:none;transition:border-color .13s,background .13s}
  .cum-asset-by-sel:hover{background:rgba(120,80,20,.14);border-color:rgba(120,80,20,.5)}
  .cum-asset-by-sel:focus{border-color:#5c3d08}
  .cum-asset-by-chevron{position:absolute;right:6px;pointer-events:none;color:#5c3d08;opacity:.7}
  .cum-big{font-family:'Playfair Display',serif;font-size:2.6rem;color:#1a5216;line-height:1}
  .cum-big-unit{font-size:.74rem;color:#3a3a3a;margin-top:3px}
  .cum-stat-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:.76rem}
  .cum-stat-label{color:#3a3a3a}
  .cum-donut-wrap{display:flex;align-items:center;gap:18px}
  .cum-legend{display:flex;flex-direction:column;gap:6px;flex:1}
  .cum-legend-item{display:flex;align-items:center;gap:7px;font-size:.70rem}
  .cum-legend-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  .cum-legend-label{color:#3a3a3a;flex:1}
  .cum-legend-val{color:#0f0f0f}
  .cum-bar-chart{display:flex;flex-direction:column;gap:7px;margin-top:4px}
  .cum-bar-row{display:flex;align-items:center;gap:9px;font-size:.70rem}
  .cum-bar-name{color:#3a3a3a;width:90px;flex-shrink:0;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cum-bar-name--asset{width:120px}
  .cum-bar-track{flex:1;height:14px;background:rgba(120,80,20,.11);border-radius:2px;overflow:hidden;position:relative;display:flex;align-items:center}
  .cum-bar-fill{height:100%;border-radius:2px;transition:width .3s ease}
  .cum-bar-fill-val{font-size:.62rem;color:rgba(255,255,255,.85);white-space:nowrap;padding-left:5px}
  .cum-bar-zero{font-size:.62rem;color:rgba(120,80,20,.35);padding-left:6px}
  .cum-bar-ext-val{font-size:.62rem;color:#3a3a3a;white-space:nowrap;flex-shrink:0;min-width:44px;text-align:left}
  .cum-itree-total-row{display:flex;justify-content:space-between;align-items:baseline;background:#ece3d4;border-radius:5px;padding:8px 12px;margin-bottom:2px}
  .cum-itree-total-lbl{font-size:.64rem;letter-spacing:.08em;text-transform:uppercase;color:#5c3d08}
  .cum-itree-total-amt{font-family:'Playfair Display',serif;font-size:1.4rem;color:#1a5216;font-weight:500}
  .cum-itree-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}
  .cum-itree-cell{background:#ece3d4;border-radius:4px;padding:10px 12px}
  .cum-itree-amt{font-family:'Playfair Display',serif;font-size:1.45rem;color:#1a5216}
  .cum-itree-lbl{font-size:.62rem;letter-spacing:.09em;text-transform:uppercase;color:#5c3d08;margin-top:1px}
  .cum-itree-desc{font-size:.64rem;color:#3a3a3a;margin-top:3px;line-height:1.4}
  .cum-eab-banner{background:rgba(184,53,53,.08);border:1px solid rgba(184,53,53,.3);border-radius:6px;padding:12px 15px;display:flex;align-items:center;gap:12px}
  .cum-eab-count{font-family:'Playfair Display',serif;font-size:1.75rem;color:#b83535}
  .cum-eab-desc{font-size:.74rem;color:#3a3a3a;line-height:1.5}
  .cum-eab-species{display:flex;flex-wrap:wrap;gap:5px}
  .cum-eab-sp-tag{background:rgba(184,53,53,.1);border:1px solid rgba(184,53,53,.25);border-radius:3px;padding:2px 8px;font-size:.67rem;color:#b83535}
  .cum-eab-sp-ct{color:#b83535;margin-left:3px}
  .cum-species-list{display:flex;flex-direction:column;gap:5px;margin-top:4px}
  .cum-species-row{display:flex;align-items:center;gap:7px;font-size:.70rem}
  .cum-species-name{color:#3a3a3a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cum-species-bar{width:70px;height:6px;background:rgba(120,80,20,.11);border-radius:2px;overflow:hidden;flex-shrink:0}
  .cum-species-bar-fill{height:100%;background:#1a5216;border-radius:2px}
  .cum-species-n{color:#0f0f0f;width:24px;text-align:right;flex-shrink:0}

  /* ── new styles ── */

  /* Section 6: Carbon equivalency callouts */
  .cum-equiv-row{display:flex;gap:12px;flex-wrap:wrap}
  .cum-equiv-cell{flex:1;min-width:140px;background:#ece3d4;border-radius:6px;padding:14px 16px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px}
  .cum-equiv-icon{display:flex;align-items:center;justify-content:center;color:#1a5216;opacity:.85}
  .cum-equiv-num{font-family:'Playfair Display',serif;font-size:1.6rem;color:#1a5216;line-height:1.1;margin-top:2px}
  .cum-equiv-lbl{font-size:.64rem;color:#5c3d08;line-height:1.35;margin-top:2px}

  /* Shared note / disclaimer style */
  .cum-note{font-size:.64rem;color:#7a6040;font-style:italic;line-height:1.45;margin-top:2px}
  .cum-disclaimer{font-size:.64rem;color:#7a6040;font-style:italic;line-height:1.45;border-top:1px solid rgba(120,80,20,.12);padding-top:8px;margin-top:2px}

  /* Section 4: Value at Risk — red headline */
  .cum-risk-total-row{display:flex;justify-content:space-between;align-items:baseline;background:rgba(184,53,53,.07);border:1px solid rgba(184,53,53,.2);border-radius:5px;padding:8px 12px;margin-bottom:2px}
  .cum-risk-total-lbl{font-size:.64rem;letter-spacing:.08em;text-transform:uppercase;color:#8a2e2e}
  .cum-risk-total-amt{font-family:'Playfair Display',serif;font-size:1.4rem;color:#b83535;font-weight:500}

  /* Section 5: Infestation empty state */
  .cum-inf-empty{font-size:.74rem;color:#888;font-style:italic;padding:4px 0}
</style>
