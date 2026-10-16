<script>
  import { onMount, onDestroy } from 'svelte';
  import { trees } from '$lib/stores/trees.js';
  import { sbGet, sbSet, fetchRLists } from '$lib/api/supabase.js';
  let { onClose = () => {} } = $props();

  const TIERS = [
    { label: 'Small',       desc: 'DBH < 6"',    default: 250,  max: 6        },
    { label: 'Medium',      desc: 'DBH 6–12"',   default: 500,  max: 12       },
    { label: 'Large',       desc: 'DBH 12–24"',  default: 900,  max: 24       },
    { label: 'Very Large',  desc: 'DBH 24–36"',  default: 1500, max: 36       },
    { label: 'Exceptional', desc: 'DBH > 36"',   default: 2500, max: Infinity },
  ];

  const COND_COL = { Good: '#1a8c2a', Fair: '#d4860a', Poor: '#cc3300', Dead: '#6b1a1a' };
  const STATUS_CHOICES = ['Created','Submitted','In Progress','Complete'];
  const STATUS_COL = { 'Created': '#888', 'Submitted': '#c9973a', 'In Progress': '#4a9fd4', 'Complete': '#5ec254' };

  let tab          = $state('new');
  let rates        = $state(TIERS.map(t => t.default));
  let stumpCost    = $state(0);
  let haulCost     = $state(0);
  let scope        = $state('risk'); // 'risk' | 'list' | 'custom'
  let reportName   = $state('');
  let searchQ      = $state('');
  let customIds    = $state(new Set());
  let generating   = $state(false);
  let savedReports = $state([]);
  let availableLists  = $state([]);
  let selectedListId  = $state('');

  // Leaflet cost map
  let costMapEl      = $state(null);
  let _costMap       = null;
  let _costMapLayer  = null;

  async function loadSaved() {
    try { savedReports = JSON.parse(await sbGet('cost_reports')); } catch { savedReports = []; }
  }

  async function loadLists() {
    availableLists = await fetchRLists();
  }

  async function saveSavedReports() {
    await sbSet('cost_reports', JSON.stringify(savedReports));
  }

  function getTier(dbh) {
    const d = parseFloat(dbh) || 0;
    for (let i = 0; i < TIERS.length; i++) {
      if (d < TIERS[i].max) return i;
    }
    return TIERS.length - 1;
  }

  function getCostForTree(t) {
    return (rates[getTier(t.d)] || 0) + stumpCost + haulCost;
  }

  let scopeTrees = $derived((() => {
    if (scope === 'custom') return $trees.filter(t => customIds.has(t.id));
    if (scope === 'list') {
      const lst = availableLists.find(l => l.id === selectedListId);
      if (!lst) return [];
      return $trees.filter(t => lst.trees.includes(t.id) || lst.trees.includes(Number(t.id)));
    }
    return $trees.filter(t => t.c === 'Poor' || t.c === 'Dead');
  })());

  let filteredPicker = $derived((() => {
    const q = searchQ.toLowerCase();
    return $trees.filter(t =>
      !q || t.n.toLowerCase().includes(q) || (t.s || '').toLowerCase().includes(q) ||
      t.id.includes(q) || (t.st || '').toLowerCase().includes(q)
    ).slice(0, 200);
  })());

  function toggleCustom(id) {
    const next = new Set(customIds);
    next.has(id) ? next.delete(id) : next.add(id);
    customIds = next;
    costMapRefresh();
  }

  let totalCost = $derived(scopeTrees.reduce((s, t) => s + getCostForTree(t), 0));

  let tierBreakdown = $derived((() => {
    const counts = TIERS.map(() => ({ count: 0, cost: 0 }));
    scopeTrees.forEach(t => {
      const i = getTier(t.d);
      counts[i].count++;
      counts[i].cost += getCostForTree(t);
    });
    return counts;
  })());

  function setScope(s) {
    scope = s;
    if (s === 'custom') {
      requestAnimationFrame(() => {
        costMapInit();
        setTimeout(() => { if (_costMap) _costMap.invalidateSize(); }, 80);
        costMapRefresh();
      });
    }
  }

  // ── Leaflet cost map ──────────────────────────────────────────────────────────

  function costMapInit() {
    if (_costMap || !costMapEl) return;
    const L = window.L;
    if (!L) return;
    _costMap = L.map(costMapEl, {
      zoomControl: true, minZoom: 11, maxZoom: 19, preferCanvas: true,
    }).setView([44.5514, -69.6351], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(_costMap);
    _costMapLayer = L.layerGroup().addTo(_costMap);
  }

  function costMapRefresh() {
    if (!_costMap || !_costMapLayer) return;
    _costMapLayer.clearLayers();
    $trees.forEach(t => {
      const selected = customIds.has(t.id);
      const r = 7;
      const mk = window.L.circleMarker([t.lt, t.ln], {
        radius:      selected ? r + 2 : r,
        fillColor:   selected ? '#f0e8d0' : (COND_COL[t.c] || '#888'),
        fillOpacity: selected ? 1 : 0.75,
        color:       selected ? '#c9973a' : 'rgba(0,0,0,0.3)',
        weight:      selected ? 2.5 : 1,
      });
      mk.on('click', () => {
        const next = new Set(customIds);
        next.has(t.id) ? next.delete(t.id) : next.add(t.id);
        customIds = next;
        costMapRefresh();
      });
      mk.bindTooltip(
        `<span style="font-family:'Outfit',sans-serif;font-size:11px">#${t.id} ${t.n}${selected ? ' ✓' : ''}</span>`,
        { direction: 'top', offset: [0, -(r + 4)], opacity: 1 }
      );
      _costMapLayer.addLayer(mk);
    });
  }

  // ── Report generation ─────────────────────────────────────────────────────────

  function generateReport() {
    generating = true;
    const title = reportName.trim() || 'Removal Cost Estimate';
    const fmt = n => '$' + Math.round(n).toLocaleString();

    const report = {
      id:         Date.now().toString(36),
      name:       title,
      date:       new Date().toISOString(),
      status:     'Created',
      treeCount:  scopeTrees.length,
      totalCost,
      rates:      [...rates],
      stumpCost, haulCost,
    };

    const scored = [...scopeTrees]
      .map(t => ({ ...t, cost: getCostForTree(t) }))
      .sort((a, b) => b.cost - a.cost);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      body{font-family:'Outfit',sans-serif;background:#faf6ee;color:#1a1507;margin:0;padding:0}
      .cover{text-align:center;padding:48px 24px 24px}
      .cover h1{font-family:'Playfair Display',serif;font-size:1.8rem;color:#0f2e14;margin:0 0 6px}
      .cover p{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:#5c3d08}
      .summary{max-width:700px;margin:16px auto;padding:0 20px}
      .tier-table{width:100%;border-collapse:collapse;margin:12px 0;font-size:.6rem}
      .tier-table th{background:#e8dcc4;text-align:left;padding:6px 10px;font-size:.5rem;letter-spacing:.08em;text-transform:uppercase;color:#5c3d08}
      .tier-table td{padding:5px 10px;border-bottom:1px solid rgba(120,80,20,.12)}
      .total-row{font-weight:700;background:#f0e8d0;font-family:'Playfair Display',serif;font-size:.8rem}
      table.tree-table{width:100%;max-width:900px;margin:20px auto;border-collapse:collapse;font-size:.56rem}
      table.tree-table th{background:#e8dcc4;text-align:left;padding:6px 8px;font-size:.48rem;letter-spacing:.08em;text-transform:uppercase;color:#5c3d08}
      table.tree-table td{padding:4px 8px;border-bottom:1px solid rgba(120,80,20,.12)}
    </style></head><body>
    <div class="cover"><h1>${title}</h1><p>Generated ${new Date().toLocaleDateString()} · ${scopeTrees.length} trees</p></div>
    <div class="summary">
      <table class="tier-table"><thead><tr><th>Size Class</th><th>DBH Range</th><th>Rate</th><th>Trees</th><th>Subtotal</th></tr></thead><tbody>
      ${TIERS.map((tier, i) => `<tr><td>${tier.label}</td><td>${tier.desc}</td><td>${fmt(rates[i])}</td><td>${tierBreakdown[i].count}</td><td>${fmt(tierBreakdown[i].cost)}</td></tr>`).join('')}
      ${stumpCost ? `<tr><td colspan="4">Stump Grinding (per tree)</td><td>${fmt(stumpCost)}</td></tr>` : ''}
      ${haulCost  ? `<tr><td colspan="4">Debris Hauling (per tree)</td><td>${fmt(haulCost)}</td></tr>` : ''}
      <tr class="total-row"><td colspan="4">Total Estimated Cost</td><td>${fmt(totalCost)}</td></tr>
      </tbody></table>
    </div>
    <table class="tree-table"><thead><tr><th>#</th><th>ID</th><th>Species</th><th>DBH</th><th>Condition</th><th>Street</th><th>Size Class</th><th>Est. Cost</th></tr></thead><tbody>
    ${scored.slice(0, 200).map((t, i) => `<tr><td>${i+1}</td><td>${t.pid || t.id}</td><td>${t.n}</td><td>${t.d ? t.d+'"' : '—'}</td><td>${t.c||'—'}</td><td>${t.st||'—'}</td><td>${TIERS[getTier(t.d)].label}</td><td>${fmt(t.cost)}</td></tr>`).join('')}
    </tbody></table></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = title.replace(/[^a-z0-9]/gi, '_') + '.html';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);

    savedReports = [report, ...savedReports];
    saveSavedReports();
    generating = false;
  }

  async function deleteReport(id) {
    savedReports = savedReports.filter(r => r.id !== id);
    await saveSavedReports();
  }

  async function updateStatus(id, status) {
    savedReports = savedReports.map(r => r.id === id ? { ...r, status } : r);
    await saveSavedReports();
  }

  function downloadSaved(r) {
    const savedRates = r.rates || TIERS.map(t => t.default);
    const savedStump = r.stumpCost || 0;
    const savedHaul  = r.haulCost  || 0;
    const getRate = t => (savedRates[getTier(t.d)] || 0) + savedStump + savedHaul;
    const scopeTrees = $trees.filter(t => t.c === 'Poor' || t.c === 'Dead');
    const scored = scopeTrees.map(t => ({ ...t, cost: getRate(t) }))
      .sort((a, b) => b.cost - a.cost);
    const counts = TIERS.map(() => ({ count: 0, cost: 0 }));
    scored.forEach(t => { const i = getTier(t.d); counts[i].count++; counts[i].cost += getRate(t); });
    const total = scored.reduce((s, t) => s + t.cost, 0);
    const title = r.name;
    const fmt = n => '$' + Math.round(n).toLocaleString();
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      body{font-family:'Outfit',sans-serif;background:#faf6ee;color:#1a1507;margin:0;padding:0}
      .cover{text-align:center;padding:48px 24px 24px}
      .cover h1{font-family:'Playfair Display',serif;font-size:1.8rem;color:#0f2e14;margin:0 0 6px}
      .cover p{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:#5c3d08}
      .summary{max-width:700px;margin:16px auto;padding:0 20px}
      .tier-table{width:100%;border-collapse:collapse;margin:12px 0;font-size:.6rem}
      .tier-table th{background:#e8dcc4;text-align:left;padding:6px 10px;font-size:.5rem;letter-spacing:.08em;text-transform:uppercase;color:#5c3d08}
      .tier-table td{padding:5px 10px;border-bottom:1px solid rgba(120,80,20,.12)}
      .total-row{font-weight:700;background:#f0e8d0;font-family:'Playfair Display',serif;font-size:.8rem}
      table.tree-table{width:100%;max-width:900px;margin:20px auto;border-collapse:collapse;font-size:.56rem}
      table.tree-table th{background:#e8dcc4;text-align:left;padding:6px 8px;font-size:.48rem;letter-spacing:.08em;text-transform:uppercase;color:#5c3d08}
      table.tree-table td{padding:4px 8px;border-bottom:1px solid rgba(120,80,20,.12)}
    </style></head><body>
    <div class="cover"><h1>${title}</h1><p>Generated ${new Date().toLocaleDateString()} · ${scopeTrees.length} trees</p></div>
    <div class="summary">
      <table class="tier-table"><thead><tr><th>Size Class</th><th>DBH Range</th><th>Rate</th><th>Trees</th><th>Subtotal</th></tr></thead><tbody>
      ${TIERS.map((tier, i) => `<tr><td>${tier.label}</td><td>${tier.desc}</td><td>${fmt(savedRates[i])}</td><td>${counts[i].count}</td><td>${fmt(counts[i].cost)}</td></tr>`).join('')}
      ${savedStump ? `<tr><td colspan="4">Stump Grinding (per tree)</td><td>${fmt(savedStump)}</td></tr>` : ''}
      ${savedHaul  ? `<tr><td colspan="4">Debris Hauling (per tree)</td><td>${fmt(savedHaul)}</td></tr>` : ''}
      <tr class="total-row"><td colspan="4">Total Estimated Cost</td><td>${fmt(total)}</td></tr>
      </tbody></table>
    </div>
    <table class="tree-table"><thead><tr><th>#</th><th>ID</th><th>Species</th><th>DBH</th><th>Condition</th><th>Street</th><th>Size Class</th><th>Est. Cost</th></tr></thead><tbody>
    ${scored.slice(0, 200).map((t, i) => `<tr><td>${i+1}</td><td>${t.pid || t.id}</td><td>${t.n}</td><td>${t.d ? t.d+'"' : '—'}</td><td>${t.c||'—'}</td><td>${t.st||'—'}</td><td>${TIERS[getTier(t.d)].label}</td><td>${fmt(t.cost)}</td></tr>`).join('')}
    </tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = title.replace(/[^a-z0-9]/gi, '_') + '.html';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  onMount(async () => {
    await Promise.all([loadSaved(), loadLists()]);
  });

  onDestroy(() => {
    if (_costMap) { _costMap.remove(); _costMap = null; _costMapLayer = null; }
  });
</script>

<div class="modal-overlay" onclick={onClose}>
  <div class="modal-box" onclick={(e) => e.stopPropagation()}>

    <!-- Header -->
    <div class="modal-hdr">
      <div>
        <div class="modal-title">
          <span class="modal-title-icon ic"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg></span>
          Removal Cost Estimate Report
        </div>
        <div class="modal-subtitle">Uses your cost rates — not generic estimates</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button class="modal-close" onclick={onClose}>
          <span class="ic"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span> Close
        </button>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="rpt-tabbar">
      <button class="rpt-tab" class:on={tab === 'new'} onclick={() => tab = 'new'}>New Report</button>
      <button class="rpt-tab" class:on={tab === 'saved'} onclick={() => tab = 'saved'}>Saved Reports{savedReports.length ? ` (${savedReports.length})` : ''}</button>
    </div>

    <div class="modal-body">

      {#if tab === 'saved'}
        <!-- Saved Reports tab -->
        {#if savedReports.length}
          <div class="saved-list">
            {#each savedReports as r}
              <div class="saved-row">
                <div style="flex:1;min-width:0">
                  <div class="saved-name">{r.name}</div>
                  <div class="saved-meta">{r.treeCount} trees · ${Math.round(r.totalCost).toLocaleString()} · {new Date(r.date).toLocaleDateString()}</div>
                </div>
                <select
                  class="cost-status-sel"
                  style="color:{STATUS_COL[r.status||'Created']};border-color:{STATUS_COL[r.status||'Created']}44"
                  value={r.status || 'Created'}
                  onchange={(e) => updateStatus(r.id, e.target.value)}
                >
                  {#each STATUS_CHOICES as s}
                    <option value={s}>{s}</option>
                  {/each}
                </select>
                <button class="mini-btn" onclick={() => downloadSaved(r)} title="Download">
                  <span class="ic"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>
                </button>
                <button class="mini-btn danger" onclick={() => deleteReport(r.id)} title="Delete">
                  <span class="ic"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></span>
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="rpt-empty">No reports saved yet.</div>
        {/if}
      {:else}

      <!-- New Report form -->

        <!-- Report Name -->
        <div class="field" style="margin-bottom:12px">
          <div class="field-lbl">Report Name</div>
          <input class="field-inp" type="text" placeholder="e.g. FY2027 Removal Budget" maxlength="80" bind:value={reportName} />
        </div>

        <!-- Cost Rates -->
        <div class="field-lbl" style="margin-bottom:6px">Your Removal Cost Rates (by DBH size class)</div>
        <div class="field-desc">Enter your actual contractor rates or municipal cost estimates per tree. These will be applied to matching trees in the inventory.</div>
        <div class="tier-grid">
          {#each TIERS as tier, i}
            <div class="tier-row">
              <div class="tier-info">
                <span class="tier-label">{tier.label}</span>
                <span class="tier-desc-sm">{tier.desc}</span>
              </div>
              <div class="tier-input-wrap">$<input class="tier-inp" type="number" min="0" bind:value={rates[i]} /></div>
            </div>
          {/each}
        </div>
        <div class="field-tip">Tip: Leave a tier at $0 to exclude that size class from the total.</div>

        <!-- Add-Ons -->
        <div class="addon-box">
          <div class="field-lbl" style="margin-bottom:6px">Optional Add-Ons (flat rate per tree)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <div class="addon-lbl">Stump Grinding</div>
              <div class="addon-input-wrap">
                <span class="addon-dollar">$</span>
                <input class="field-inp" type="number" min="0" step="1" bind:value={stumpCost} style="width:100px" />
              </div>
            </div>
            <div>
              <div class="addon-lbl">Debris Hauling</div>
              <div class="addon-input-wrap">
                <span class="addon-dollar">$</span>
                <input class="field-inp" type="number" min="0" step="1" bind:value={haulCost} style="width:100px" />
              </div>
            </div>
          </div>
        </div>

        <!-- Scope Picker -->
        <div class="field-lbl" style="margin-bottom:6px">Scope</div>
        <div class="rpt-scope-grid">
          <button class="rpt-scope-btn" class:on={scope === 'risk'} onclick={() => setScope('risk')}>
            <span class="rpt-scope-icon ic"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
            High Risk Only
          </button>
          <button class="rpt-scope-btn" class:on={scope === 'list'} onclick={() => setScope('list')}>
            <span class="rpt-scope-icon ic"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="12" y1="11" x2="16" y2="11"/><line x1="12" y1="16" x2="16" y2="16"/><line x1="8" y1="11" x2="8.01" y2="11"/><line x1="8" y1="16" x2="8.01" y2="16"/></svg></span>
            Removal List
          </button>
          <button class="rpt-scope-btn" class:on={scope === 'custom'} onclick={() => setScope('custom')}>
            <span class="rpt-scope-icon ic"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>
            Custom
          </button>
        </div>

        <!-- Sub-panel: removal list -->
        {#if scope === 'list'}
          <div class="subpanel">
            <div class="field-lbl" style="margin-bottom:4px">Choose List</div>
            <select class="field-inp" bind:value={selectedListId} style="font-size:.62rem">
              <option value="">— select a removal list —</option>
              {#each availableLists as lst}
                <option value={lst.id}>{lst.name} ({lst.trees.length} trees)</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- Sub-panel: custom selection -->
        {#if scope === 'custom'}
          <div class="subpanel">
            <div class="custom-picker-box">
              <!-- Header -->
              <div class="custom-picker-hdr">
                <div style="display:flex;align-items:center;gap:8px">
                  <input class="custom-search" type="text" placeholder="Search by name, species, ID…" bind:value={searchQ} />
                  <span class="custom-sel-count">{customIds.size} tree{customIds.size === 1 ? '' : 's'} selected</span>
                </div>
              </div>
              <!-- Split body -->
              <div class="custom-split">
                <!-- Tree list -->
                <div class="custom-tree-list">
                  {#each filteredPicker as t}
                    {@const cc = {Good:'cg',Fair:'cf',Poor:'cp',Dead:'cd'}[t.c] || ''}
                    <label class="rpt-tree-item">
                      <input type="checkbox" checked={customIds.has(t.id)} onchange={() => toggleCustom(t.id)} />
                      <span class="rpt-tree-item-name">#{t.id} {t.n}</span>
                      <span class="rpt-tree-item-meta {cc}">{t.c}</span>
                    </label>
                  {:else}
                    <div style="font-size:.56rem;color:var(--parch-dim);padding:6px 8px">No trees match.</div>
                  {/each}
                </div>
                <!-- Map -->
                <div class="custom-map-wrap">
                  <div class="custom-map" bind:this={costMapEl}></div>
                  <div class="custom-map-hint">Click a tree on the map to select it</div>
                </div>
              </div>
            </div>
          </div>
        {/if}

      {/if}<!-- /new tab -->

    </div><!-- /modal-body -->

    <div class="modal-footer">
      <button class="btn-cancel" onclick={onClose}>Cancel</button>
      {#if tab === 'new'}
        <button class="btn-generate" onclick={generateReport} disabled={generating || !scopeTrees.length}>
          {generating ? 'Generating…' : 'Generate Report'}
        </button>
      {/if}
    </div>

  </div>
</div>

<style>
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9996;display:flex;align-items:center;justify-content:center;padding:20px}
  .modal-box{background:var(--panel);border:1px solid rgba(201,151,58,.3);border-radius:8px;width:100%;max-width:680px;max-height:90vh;display:flex;flex-direction:column}
  .modal-hdr{display:flex;align-items:flex-start;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid var(--border);flex-shrink:0}
  .modal-title{display:flex;align-items:center;gap:7px;font-family:'Playfair Display',serif;font-size:1rem;color:var(--canopy)}
  .modal-title-icon{color:var(--canopy);flex-shrink:0}
  .modal-subtitle{font-size:.52rem;letter-spacing:.09em;text-transform:uppercase;color:var(--gold);margin-top:3px;padding-left:23px}
  .modal-close{background:transparent;border:1px solid var(--border);border-radius:3px;padding:4px 8px;font-family:'Outfit',sans-serif;font-size:.58rem;color:var(--parch-dim);cursor:pointer;display:flex;align-items:center;gap:4px}
  .modal-close:hover{border-color:var(--gold);color:var(--parch)}
  .rpt-tabbar{display:flex;align-items:stretch;border-bottom:1px solid var(--border);background:var(--panel2);flex-shrink:0}
  .rpt-tab{background:transparent;border:none;border-bottom:2px solid transparent;padding:10px 18px;font-family:'Outfit',sans-serif;font-size:.62rem;color:var(--parch-dim);cursor:pointer;transition:all .13s;white-space:nowrap}
  .rpt-tab.on{color:var(--gold);border-bottom-color:var(--gold)}
  .rpt-tab:hover{color:var(--parch)}
  .cost-status-sel{background:transparent;border:1px solid;border-radius:3px;padding:2px 6px;font-family:'Outfit',sans-serif;font-size:.5rem;cursor:pointer;transition:all .13s;flex-shrink:0}
  .cost-status-sel:focus{outline:none}
  .cost-status-sel option{background:var(--panel);color:var(--parch)}
  .modal-body{padding:16px 18px;display:flex;flex-direction:column;gap:16px;overflow-y:auto;flex:1}
  .modal-body::-webkit-scrollbar{width:3px}
  .modal-body::-webkit-scrollbar-thumb{background:rgba(201,151,58,.3);border-radius:2px}
  .modal-footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--border);flex-shrink:0}

  .section-title{font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid var(--border)}

  .field{display:flex;flex-direction:column;gap:4px}
  .field-lbl{font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}
  .field-desc{font-size:.55rem;color:var(--parch-dim);margin-bottom:10px;line-height:1.6}
  .field-tip{font-size:.52rem;color:var(--parch-dim);font-style:italic;margin-top:5px;margin-bottom:12px}
  .field-inp{background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:6px 8px;font-family:'Outfit',sans-serif;font-size:.65rem;color:var(--parch);width:100%;box-sizing:border-box}
  .field-inp:focus{outline:none;border-color:var(--gold)}

  .tier-grid{display:flex;flex-direction:column;gap:6px}
  .tier-row{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--panel2);border-radius:4px;padding:5px 8px}
  .tier-info{display:flex;gap:6px;align-items:baseline}
  .tier-label{font-size:.6rem;color:var(--parch);font-weight:500}
  .tier-desc-sm{font-size:.5rem;color:var(--parch-dim)}
  .tier-input-wrap{display:flex;align-items:center;gap:2px;font-size:.6rem;color:var(--parch)}
  .tier-inp{width:70px;background:var(--panel);border:1px solid var(--border);border-radius:3px;padding:3px 6px;font-family:'Outfit',sans-serif;font-size:.6rem;color:var(--parch);text-align:right}
  .tier-inp:focus{outline:none;border-color:var(--gold)}

  .addon-box{background:var(--panel2);border:1px solid var(--border);border-radius:5px;padding:10px 12px;margin-bottom:14px}
  .addon-lbl{font-size:.55rem;color:var(--parch-dim);margin-bottom:3px}
  .addon-input-wrap{display:flex;align-items:center;gap:5px}
  .addon-dollar{font-size:.7rem;color:var(--gold)}

  /* Scope picker */
  .rpt-scope-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:6px}
  .rpt-scope-btn{background:var(--panel2);border:1px solid var(--border);border-radius:5px;padding:10px 8px;font-family:'Outfit',sans-serif;font-size:.6rem;color:var(--parch-dim);cursor:pointer;text-align:center;transition:all .15s;line-height:1.4}
  .rpt-scope-btn:hover{border-color:var(--gold);color:var(--parch)}
  .rpt-scope-btn.on{background:rgba(201,151,58,.15);border-color:var(--gold);color:var(--parch)}
  .rpt-scope-icon{font-size:1.2rem;display:block;margin-bottom:4px}

  .subpanel{margin-top:8px}

  /* Custom selection split panel */
  .custom-picker-box{border:1px solid var(--border);border-radius:6px;overflow:hidden}
  .custom-picker-hdr{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--panel2);border-bottom:1px solid var(--border);flex-shrink:0}
  .custom-search{background:var(--panel);border:1px solid var(--border);border-radius:3px;padding:4px 7px;font-family:'Outfit',sans-serif;font-size:.58rem;color:var(--parch);width:180px}
  .custom-search:focus{outline:none;border-color:var(--gold)}
  .custom-sel-count{font-size:.56rem;color:var(--parch-dim)}
  .custom-split{display:flex;height:320px}
  .custom-tree-list{width:220px;flex-shrink:0;overflow-y:auto;border-right:1px solid var(--border);padding:6px 0}
  .custom-tree-list::-webkit-scrollbar{width:3px}
  .custom-tree-list::-webkit-scrollbar-thumb{background:rgba(201,151,58,.3);border-radius:2px}
  .custom-map-wrap{flex:1;position:relative}
  .custom-map{width:100%;height:100%}
  .custom-map-hint{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(16,13,4,.88);border:1px solid rgba(201,151,58,.4);border-radius:6px;padding:4px 10px;font-family:'Outfit',sans-serif;font-size:.52rem;color:var(--parch-dim);white-space:nowrap;pointer-events:none}

  /* Tree picker items */
  :global(.rpt-tree-item){display:flex;align-items:center;gap:7px;padding:4px 8px;border-radius:3px;cursor:pointer;transition:background .1s;font-size:.56rem}
  :global(.rpt-tree-item:hover){background:rgba(201,151,58,.08)}
  :global(.rpt-tree-item input[type=checkbox]){accent-color:var(--gold);cursor:pointer;flex-shrink:0}
  :global(.rpt-tree-item-name){flex:1;color:var(--parch);font-size:.56rem}
  :global(.rpt-tree-item-meta){color:var(--parch-dim);font-size:.54rem;white-space:nowrap}

  /* Saved reports */
  .saved-list{display:flex;flex-direction:column;gap:5px}
  .saved-row{display:flex;align-items:center;gap:8px;background:var(--panel2);border-radius:4px;padding:6px 10px;border:1px solid rgba(201,151,58,.1)}
  .saved-name{font-size:.62rem;color:var(--parch)}
  .saved-meta{font-size:.5rem;color:var(--parch-dim)}
  .rpt-empty{font-size:.58rem;color:var(--parch-dim);font-style:italic}

  .mini-btn{background:transparent;border:1px solid var(--border);border-radius:3px;padding:2px 6px;font-family:'Outfit',sans-serif;font-size:.52rem;color:var(--parch-dim);cursor:pointer;display:flex;align-items:center}
  .mini-btn.danger{border-color:rgba(184,53,53,.3);color:rgba(184,53,53,.7)}
  .mini-btn.danger:hover{border-color:var(--red);color:var(--red)}

  .btn-cancel{background:transparent;border:1px solid var(--border);border-radius:3px;padding:5px 14px;font-family:'Outfit',sans-serif;font-size:.6rem;color:var(--parch-dim);cursor:pointer}
  .btn-cancel:hover{border-color:var(--gold);color:var(--parch)}
  .btn-generate{background:var(--gold);border:none;border-radius:3px;padding:5px 14px;font-family:'Outfit',sans-serif;font-size:.6rem;color:var(--bark);cursor:pointer;font-weight:500}
  .btn-generate:hover{opacity:.85}
  .btn-generate:disabled{opacity:.5;cursor:not-allowed}
</style>
