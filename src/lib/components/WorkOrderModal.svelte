<script>
  import { onMount, onDestroy } from 'svelte';
  import { trees } from '$lib/stores/trees.js';
  import { sbGet, sbSet } from '$lib/api/supabase.js';
  import { isEabRisk } from '$lib/utils/itree.js';
  let { onClose = () => {} } = $props();

  const COND_COL = { Good: '#5ec254', Fair: '#e8c34a', Poor: '#e07a30', Dead: '#d04444' };
  const WORK_TYPES = ['Pruning','Removal','Stump Grinding','Cable & Brace','Root Management','Inspection','Planting','Other'];
  const STATUS_CHOICES = ['Created','Submitted','In Progress','Complete'];
  const STATUS_COL = { 'Created': '#888', 'Submitted': '#c9973a', 'In Progress': '#4a9fd4', 'Complete': '#5ec254' };

  let tab = $state('new'); // 'new' | 'saved'
  let view = $state('streets'); // 'streets' | 'detail'
  let currentStreet = $state('');
  let streetFilter = $state('');
  let woState = $state({}); // { [street]: { notes, costOverride, trees: { [id]: { selected, workType, notes, cost } } } }
  let savedOrders = $state([]);
  let orderName = $state('Work Order — ' + new Date().toLocaleDateString());

  // Map refs
  let woMapEl = $state(null);
  let _woMap = null;
  let _woMapLayer = null;

  const COND_RANK = { Dead: 4, Poor: 3, Fair: 2, Good: 1 };

  // Street data derived from trees
  let streets = $derived((() => {
    const map = {};
    $trees.forEach(t => {
      if (!t.st) return;
      if (!map[t.st]) map[t.st] = { name: t.st, trees: [], maxRisk: 0 };
      map[t.st].trees.push(t);
      const condSev = COND_RANK[t.c] || 0;
      if (condSev > map[t.st].maxRisk) map[t.st].maxRisk = condSev;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  })());

  let filteredStreets = $derived((() => {
    if (!streetFilter) return streets;
    const q = streetFilter.toLowerCase();
    return streets.filter(s => s.name.toLowerCase().includes(q));
  })());

  let detailTrees = $derived((() => {
    if (!currentStreet) return [];
    const s = streets.find(s => s.name === currentStreet);
    return s ? [...s.trees].sort((a, b) => (COND_RANK[b.c] || 0) - (COND_RANK[a.c] || 0)) : [];
  })());

  function getTreeState(street, id) {
    if (!woState[street]) woState[street] = { notes: '', costOverride: '', trees: {} };
    if (!woState[street].trees[id]) woState[street].trees[id] = { selected: false, workType: '', notes: '', cost: '' };
    return woState[street].trees[id];
  }

  function toggleTree(street, id) {
    const ts = getTreeState(street, id);
    ts.selected = !ts.selected;
    woState = { ...woState };
    woRefreshMapMarkers(street);
  }

  function streetSelectedCount(street) {
    const ss = woState[street];
    if (!ss) return 0;
    return Object.values(ss.trees).filter(t => t.selected).length;
  }

  function streetCost(street) {
    const ss = woState[street];
    if (!ss) return 0;
    if (ss.costOverride && parseFloat(ss.costOverride)) return parseFloat(ss.costOverride);
    return Object.values(ss.trees).filter(t => t.selected).reduce((s, t) => s + (parseFloat(t.cost) || 0), 0);
  }

  function totalSelected() {
    return Object.keys(woState).reduce((s, st) => s + streetSelectedCount(st), 0);
  }

  function totalCost() {
    return Object.keys(woState).reduce((s, st) => s + streetCost(st), 0);
  }

  function fmtCost(n) { return '$' + Math.round(n).toLocaleString(); }

  function showStreetDetail(name) {
    currentStreet = name;
    view = 'detail';
    // Refresh map markers after DOM updates
    setTimeout(() => {
      if (_woMap) {
        _woMap.invalidateSize();
        woRefreshMapMarkers(name);
      }
    }, 50);
  }

  function backToStreets() {
    view = 'streets';
    currentStreet = '';
    if (_woMapLayer) _woMapLayer.clearLayers();
  }

  async function loadSaved() {
    try { savedOrders = JSON.parse(await sbGet('wo_orders')); } catch { savedOrders = []; }
  }

  async function saveSavedOrders() {
    await sbSet('wo_orders', JSON.stringify(savedOrders));
  }

  function saveAndGenerate() {
    const selCount = totalSelected();
    if (!selCount) return;

    const title = orderName.trim() || 'Work Order';
    const streetCount = Object.keys(woState).filter(st => streetSelectedCount(st) > 0).length;

    const order = {
      id: Date.now().toString(36),
      name: title,
      created: new Date().toISOString(),
      status: 'Created',
      streetCount,
      treeCount: selCount,
      totalCost: totalCost(),
      state: JSON.parse(JSON.stringify(woState)),
    };
    savedOrders = [order, ...savedOrders];
    saveSavedOrders();
    generateReport(title, woState);
  }

  function generateReport(title, state) {
    const condColors = { Good: '#5ec254', Fair: '#e8c34a', Poor: '#e07a30', Dead: '#d04444' };
    const th = `style="background:#e8dcc4;text-align:left;padding:5px 8px;font-size:.46rem;letter-spacing:.08em;text-transform:uppercase;color:#5c3d08;border-bottom:2px solid rgba(120,80,20,.3)"`;
    const td = (extra='') => `style="padding:4px 8px;border-bottom:1px solid rgba(120,80,20,.12);${extra}"`;

    let streetHtml = '';
    let mapInitScripts = '';
    let geocodeItems = [];
    let grandTotal = 0, grandTrees = 0;
    let mapIdx = 0;

    for (const [stName, ss] of Object.entries(state)) {
      const selectedIds = Object.entries(ss.trees).filter(([, v]) => v.selected).map(([id]) => id);
      if (!selectedIds.length) continue;

      const stTrees = $trees.filter(t => selectedIds.includes(t.id));
      // Compute cost directly from the passed state (not woState) so saved-order
      // downloads show the correct figures regardless of current live state.
      const stCost = (() => {
        if (ss.costOverride && parseFloat(ss.costOverride)) return parseFloat(ss.costOverride);
        return Object.values(ss.trees).filter(t => t.selected)
          .reduce((sum, t) => sum + (parseFloat(t.cost) || 0), 0);
      })();
      grandTotal += stCost;
      grandTrees += selectedIds.length;
      const mapId = `womap_${mapIdx++}`;

      const markersJson = JSON.stringify(stTrees.map((t, i) => ({
        lat: t.lt, lng: t.ln,
        label: String(i + 1),
        color: condColors[t.c] || '#888',
        id: t.id,
        name: t.n,
      })));

      const treeRows = stTrees.map((t, i) => {
        const ts = ss.trees[t.id] || {};
        const coords = (t.lt && t.ln) ? `${t.lt.toFixed(5)}, ${t.ln.toFixed(5)}` : '—';
        const bg = i % 2 ? 'background:rgba(240,232,208,.3)' : '';
        const addrId = `addr_${mapId}_${i}`;
        geocodeItems.push({ id: addrId, lat: t.lt, lng: t.ln });
        return `<tr style="${bg}">
          <td ${td('font-weight:600;color:#5c3d08')}>${i+1}</td>
          <td ${td()}>${t.id}</td>
          <td ${td()}>${t.n}</td>
          <td ${td()}>
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${condColors[t.c]||'#888'};margin-right:4px;vertical-align:middle"></span>${t.c||'—'}
          </td>
          <td ${td('font-size:.5rem;color:#555')} id="${addrId}">${t.st || '—'}<br/><span class="geo-addr" style="font-size:.47rem;color:#1a6020;display:none"></span><span style="color:#999;font-size:.44rem">${coords}</span></td>
          <td ${td()}>${ts.workType||'—'}</td>
          <td ${td('font-style:italic;color:#444')}>${ts.notes || '—'}</td>
          <td ${td()}>${ts.cost ? '$'+ts.cost : '—'}</td>
        </tr>`;
      }).join('');

      streetHtml += `
        <div style="margin:32px auto;max-width:960px">
          <h2 style="font-family:'Playfair Display',serif;font-size:1.1rem;color:#0f2e14;margin:0 0 3px;border-bottom:2px solid rgba(120,80,20,.2);padding-bottom:6px">${stName}</h2>
          <p style="font-size:.55rem;color:#5c3d08;margin:4px 0 8px">${selectedIds.length} tree${selectedIds.length > 1 ? 's' : ''} · Est. ${fmtCost(stCost)}</p>
          ${ss.notes ? `<p style="font-size:.55rem;color:#444;margin:0 0 10px;padding:6px 10px;background:rgba(120,80,20,.06);border-radius:4px"><strong>Street notes:</strong> ${ss.notes}</p>` : ''}
          <div id="${mapId}" style="height:240px;width:100%;border-radius:6px;border:1px solid rgba(120,80,20,.2);margin-bottom:12px;overflow:hidden"></div>
          <table style="width:100%;border-collapse:collapse;font-size:.56rem">
            <thead><tr>
              <th ${th}>#</th>
              <th ${th}>ID</th>
              <th ${th}>Species</th>
              <th ${th}>Cond</th>
              <th ${th}>Address / GPS</th>
              <th ${th}>Work Type</th>
              <th ${th}>Notes</th>
              <th ${th}>Cost</th>
            </tr></thead>
            <tbody>${treeRows}</tbody>
          </table>
        </div>`;

      mapInitScripts += `
      (function() {
        var el = document.getElementById('${mapId}');
        if (!el || typeof L === 'undefined') return;
        var markers = ${markersJson};
        var valid = markers.filter(function(m){ return m.lat && m.lng; });
        if (!valid.length) { el.innerHTML='<p style="text-align:center;padding:20px;font-size:.6rem;color:#888">No GPS data</p>'; return; }
        var map = L.map(el, { zoomControl: false, scrollWheelZoom: false, attributionControl: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd', maxZoom: 19
        }).addTo(map);
        var bounds = [];
        valid.forEach(function(m) {
          var icon = L.divIcon({
            html: '<div style="background:'+m.color+';color:#fff;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;border:1px solid rgba(0,0,0,.2);font-family:monospace">'+m.label+'</div>',
            iconSize: [16,16], iconAnchor: [8,8], className: ''
          });
          L.marker([m.lat, m.lng], { icon: icon })
            .bindTooltip('<b>#'+m.id+'</b> '+m.name, { direction:'top', offset:[0,-14] })
            .addTo(map);
          bounds.push([m.lat, m.lng]);
        });
        map.fitBounds(L.latLngBounds(bounds).pad(0.1), { maxZoom: 18 });
        setTimeout(function(){ map.invalidateSize(); }, 100);
      })();`;
    }

    const sc = '<' + 'script';
    const scEnd = '</' + 'script>';
    const leafletJs = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    const leafletCss = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

    // Look up the nearest OSM address node for each tree using the Overpass API —
    // the same infrastructure used by AddTreeModal for street detection.
    // Overpass sets Access-Control-Allow-Origin: * so it works from blob: URLs too.
    const geocodeItemsJson = JSON.stringify(geocodeItems);
    const geocodeScript = `(function(){
  var items=${geocodeItemsJson};
  var idx=0;
  function next(){
    if(idx>=items.length)return;
    var item=items[idx++];
    if(!item.lat||!item.lng){next();return;}
    var pad=0.0015;
    var bbox=(item.lat-pad).toFixed(6)+','+(item.lng-pad).toFixed(6)+','
            +(item.lat+pad).toFixed(6)+','+(item.lng+pad).toFixed(6);
    var q='[out:json][timeout:10];node["addr:housenumber"]["addr:street"]('+bbox+');out;';
    fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(q)})
    .then(function(r){return r.json();})
    .then(function(d){
      var nodes=(d.elements||[]).filter(function(n){
        return n.tags&&n.tags['addr:housenumber']&&n.tags['addr:street'];
      });
      if(nodes.length){
        var cosLat=Math.cos(item.lat*Math.PI/180);
        var best=null,bestD=Infinity;
        nodes.forEach(function(n){
          var dx=(n.lon-item.lng)*cosLat*111320;
          var dy=(n.lat-item.lat)*111320;
          var d=Math.sqrt(dx*dx+dy*dy);
          if(d<bestD){bestD=d;best=n;}
        });
        if(best){
          var addr=best.tags['addr:housenumber']+' '+best.tags['addr:street'];
          var el=document.getElementById(item.id);
          if(el){var sp=el.querySelector('.geo-addr');if(sp){sp.textContent=addr;sp.style.display='block';}}
        }
      }
      setTimeout(next,200);
    })
    .catch(function(){setTimeout(next,200);});
  }
  next();
})();`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <link rel="stylesheet" href="${leafletCss}"/>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      body{font-family:'Outfit',sans-serif;background:#faf6ee;color:#1a1507;margin:0;padding:20px}
      .cover{text-align:center;padding:32px 24px 20px}
      .cover h1{font-family:'Playfair Display',serif;font-size:1.8rem;color:#0f2e14;margin:0 0 6px}
      .cover p{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:#5c3d08}
      .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:500px;margin:16px auto 8px}
      .kpi{background:#f0e8d0;border:1px solid rgba(120,80,20,.18);border-radius:6px;padding:14px;text-align:center}
      .kpi-n{font-family:'Playfair Display',serif;font-size:1.5rem;color:#1a5216}
      .kpi-l{font-size:.5rem;letter-spacing:.1em;text-transform:uppercase;color:#5c3d08;margin-top:2px}
      @media print { .leaflet-control { display:none } }
    </style>
    </head><body>
    <div class="cover"><h1>${title}</h1><p>Generated ${new Date().toLocaleDateString()}</p></div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-n">${grandTrees}</div><div class="kpi-l">Trees</div></div>
      <div class="kpi"><div class="kpi-n">${Object.keys(state).filter(st => Object.values(state[st].trees || {}).some(t => t.selected)).length}</div><div class="kpi-l">Streets</div></div>
      <div class="kpi"><div class="kpi-n">${fmtCost(grandTotal)}</div><div class="kpi-l">Est. Cost</div></div>
    </div>
    ${streetHtml}
    ${sc} src="${leafletJs}">${scEnd}
    ${sc}>${mapInitScripts}${scEnd}
    ${sc}>${geocodeScript}${scEnd}
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title.replace(/[^a-z0-9]/gi, '_') + '.html';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function downloadCSV() {
    const rows = [['Street','Tree ID','Common Name','Condition','Age','DBH','Work Type','Notes','Est Cost']];
    for (const [stName, ss] of Object.entries(woState)) {
      for (const [id, ts] of Object.entries(ss.trees)) {
        if (!ts.selected) continue;
        const t = $trees.find(tr => tr.id === id);
        if (!t) continue;
        rows.push([stName, id, t.n, t.c, t.a, t.d||'', ts.workType, ts.notes, ts.cost]);
      }
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'work_order_export.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function loadOrder(order) {
    woState = JSON.parse(JSON.stringify(order.state));
    orderName = order.name;
    tab = 'new';
    view = 'streets';
  }

  async function deleteOrder(id) {
    savedOrders = savedOrders.filter(o => o.id !== id);
    await saveSavedOrders();
  }

  async function updateStatus(id, status) {
    savedOrders = savedOrders.map(o => o.id === id ? { ...o, status } : o);
    await saveSavedOrders();
  }

  function downloadSavedOrder(order) {
    generateReport(order.name, order.state);
  }

  function woInitMap() {
    if (_woMap || !woMapEl) return;
    const L = window.L;
    if (!L) return;

    _woMap = L.map(woMapEl, {
      zoomControl: true,
      minZoom: 11,
      maxZoom: 19,
      preferCanvas: true,
    }).setView([44.5514, -69.6351], 16);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
      maxNativeZoom: 18,
    }).addTo(_woMap);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, maxNativeZoom: 19, opacity: 0.85, attribution: '',
    }).addTo(_woMap);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, maxNativeZoom: 19, opacity: 0.9, attribution: '',
    }).addTo(_woMap);

    _woMapLayer = L.layerGroup().addTo(_woMap);
  }

  function woRefreshMapMarkers(streetName) {
    if (!_woMap || !_woMapLayer) return;
    const L = window.L;
    _woMapLayer.clearLayers();
    if (!streetName) return;

    const streetTrees = $trees.filter(t => t.st === streetName);
    if (!streetTrees.length) return;

    const latlngs = streetTrees.filter(t => t.lt && t.ln).map(t => [t.lt, t.ln]);
    if (latlngs.length) _woMap.fitBounds(L.latLngBounds(latlngs).pad(0.3));

    streetTrees.forEach(t => {
      if (!t.lt || !t.ln) return;
      const ts = getTreeState(streetName, t.id);
      const selected = ts.selected;
      const r = 7;
      const mk = L.circleMarker([t.lt, t.ln], {
        radius:      selected ? r + 2 : r,
        fillColor:   selected ? '#f0e8d0' : (COND_COL[t.c] || '#888'),
        fillOpacity: selected ? 1 : 0.8,
        color:       selected ? '#c9973a' : 'rgba(0,0,0,0.35)',
        weight:      selected ? 2.5 : 1,
      });
      mk.on('click', () => {
        const ts2 = getTreeState(streetName, t.id);
        ts2.selected = !ts2.selected;
        woState = { ...woState };
        woRefreshMapMarkers(streetName);
        // Scroll row into view
        setTimeout(() => {
          const row = document.getElementById('wo-tree-row-' + t.id);
          if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 60);
      });
      mk.bindTooltip(
        `<span style="font-family:'Outfit',sans-serif;font-size:11px">#${t.id} ${t.n}${selected ? ' ✓' : ''}</span>`,
        { direction: 'top', offset: [0, -(r + 4)], opacity: 1 }
      );
      _woMapLayer.addLayer(mk);
    });
  }

  onMount(() => {
    loadSaved();
    // Defer map init until DOM is ready
    setTimeout(() => {
      woInitMap();
    }, 100);
  });

  onDestroy(() => {
    if (_woMap) {
      _woMap.remove();
      _woMap = null;
      _woMapLayer = null;
    }
  });
</script>

<div class="wo-fullscreen">
  <!-- Header -->
  <div class="wo-hdr">
    <div style="display:flex;align-items:center;gap:10px">
      {#if view === 'detail' && tab === 'new'}
        <button class="wo-back-btn" onclick={backToStreets}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Streets
        </button>
      {/if}
      <div style="display:flex;align-items:center;gap:7px">
        <span style="color:var(--canopy);flex-shrink:0;display:flex">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </span>
        <span class="wo-title">Work Order</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      {#if totalSelected() > 0}
        <div class="wo-sel-summary">{totalSelected()} trees · {fmtCost(totalCost())}</div>
      {/if}
      <button class="wo-hdr-btn" onclick={downloadCSV} disabled={!totalSelected()}>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Quick Export
      </button>
      <button class="wo-generate-btn" onclick={saveAndGenerate} disabled={!totalSelected()}>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Save &amp; Generate
      </button>
      <button class="wo-hdr-btn" onclick={onClose}>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Close
      </button>
    </div>
  </div>

  <!-- Tab bar -->
  <div class="wo-tabbar">
    <button class="wo-tab" class:on={tab === 'new'} onclick={() => tab = 'new'}>New Order</button>
    <button class="wo-tab" class:on={tab === 'saved'} onclick={() => tab = 'saved'}>Saved Orders</button>
    <div style="flex:1"></div>
  </div>

  <!-- Split body -->
  <div class="wo-split">
    <!-- Left panel (420px) -->
    <div class="wo-left">
      {#if tab === 'new' && view === 'streets'}
        <!-- Streets list -->
        <div class="wo-panel-inner">
          <div class="wo-filters">
            <input class="wo-inp" type="text" placeholder="Filter streets…" bind:value={streetFilter} />
          </div>
          <div class="wo-name-field">
            <input class="wo-inp" type="text" placeholder="Order name…" bind:value={orderName} />
          </div>
          <div class="wo-street-list">
            {#each filteredStreets as s}
              <button class="wo-street-row" onclick={() => showStreetDetail(s.name)}>
                <div class="wo-st-info">
                  <div class="wo-st-name">{s.name}</div>
                  <div class="wo-st-meta">{s.trees.length} trees</div>
                </div>
                {#if streetSelectedCount(s.name)}
                  <span class="wo-st-badge">{streetSelectedCount(s.name)} sel</span>
                {/if}
                <span class="wo-st-arrow">›</span>
              </button>
            {/each}
          </div>
          <div class="wo-summary">{totalSelected()} trees selected · {fmtCost(totalCost())} est.</div>
        </div>
      {:else if tab === 'new' && view === 'detail'}
        <!-- Street detail -->
        <div class="wo-detail-bar">
          <div>
            <div class="wo-detail-name">{currentStreet}</div>
            <div class="wo-detail-meta">{detailTrees.length} trees · {streetSelectedCount(currentStreet)} selected</div>
          </div>
        </div>
        <div class="wo-tree-list">
          {#each detailTrees as t}
            {@const sel = woState[currentStreet]?.trees[t.id]?.selected ?? false}
            <div id="wo-tree-row-{t.id}" class="wo-tree-row" class:selected={sel}>
              <div class="wo-tree-top">
                <label class="wo-tree-check">
                  <input type="checkbox" checked={sel} onchange={() => toggleTree(currentStreet, t.id)} />
                </label>
                <div class="wo-tree-info">
                  <span class="wo-tree-name">{t.n}</span>
                  <span class="wo-tree-id">#{t.id} · {t.c}</span>
                </div>
              </div>
              {#if sel}
                <div class="wo-tree-fields">
                  <select class="wo-field-sel"
                    value={woState[currentStreet]?.trees[t.id]?.workType ?? ''}
                    onchange={(e) => { getTreeState(currentStreet, t.id).workType = e.target.value; woState = {...woState}; }}>
                    <option value="">Work type…</option>
                    {#each WORK_TYPES as wt}
                      <option value={wt}>{wt}</option>
                    {/each}
                  </select>
                  <input class="wo-field-inp" type="text" placeholder="Notes…"
                    value={woState[currentStreet]?.trees[t.id]?.notes ?? ''}
                    oninput={(e) => { getTreeState(currentStreet, t.id).notes = e.target.value; woState = {...woState}; }} />
                  <input class="wo-field-inp cost" type="number" placeholder="Cost $"
                    value={woState[currentStreet]?.trees[t.id]?.cost ?? ''}
                    oninput={(e) => { getTreeState(currentStreet, t.id).cost = e.target.value; woState = {...woState}; }} />
                </div>
              {/if}
            </div>
          {/each}
        </div>
        <div class="wo-street-notes">
          <textarea class="wo-textarea" placeholder="Street-level notes…" value={woState[currentStreet]?.notes || ''} oninput={(e) => { if(!woState[currentStreet]) woState[currentStreet] = {notes:'',costOverride:'',trees:{}}; woState[currentStreet].notes = e.target.value; woState = {...woState}; }}></textarea>
          <input class="wo-inp" type="number" placeholder="Cost override $" value={woState[currentStreet]?.costOverride || ''} oninput={(e) => { if(!woState[currentStreet]) woState[currentStreet] = {notes:'',costOverride:'',trees:{}}; woState[currentStreet].costOverride = e.target.value; woState = {...woState}; }} />
        </div>
      {:else if tab === 'saved'}
        <!-- Saved orders -->
        <div class="wo-panel-inner">
          {#if savedOrders.length}
            {#each savedOrders as o}
              <div class="wo-saved-row">
                <div class="wo-saved-info">
                  <div class="wo-saved-name">{o.name}</div>
                  <div class="wo-saved-meta">{new Date(o.created).toLocaleDateString()} · {o.treeCount} trees · {fmtCost(o.totalCost)}</div>
                </div>
                <div class="wo-saved-actions">
                  <select
                    class="wo-status-sel"
                    style="color:{STATUS_COL[o.status||'Created']};border-color:{STATUS_COL[o.status||'Created']}44"
                    value={o.status || 'Created'}
                    onchange={(e) => updateStatus(o.id, e.target.value)}
                  >
                    {#each STATUS_CHOICES as s}
                      <option value={s}>{s}</option>
                    {/each}
                  </select>
                  <button class="wo-act-btn" onclick={() => downloadSavedOrder(o)} title="Download">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                  <button class="wo-act-btn" onclick={() => loadOrder(o)}>Load</button>
                  <button class="wo-act-btn danger" onclick={() => deleteOrder(o.id)} title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              </div>
            {/each}
          {:else}
            <div class="wo-empty">No saved work orders yet.</div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Right: map -->
    <div class="wo-map-wrap">
      <div bind:this={woMapEl} class="wo-map"></div>
      {#if view === 'detail' && tab === 'new'}
        <div class="wo-map-hint">Click a tree on the map to add it to the work order</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .wo-fullscreen{position:fixed;inset:0;z-index:9996;background:var(--bark);display:flex;flex-direction:column}
  .wo-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 18px;border-bottom:1px solid var(--border);background:var(--panel);flex-shrink:0}
  .wo-title{font-family:'Playfair Display',serif;font-size:1rem;color:var(--canopy)}
  .wo-back-btn{display:flex;align-items:center;gap:4px;background:transparent;border:none;color:var(--parch-dim);cursor:pointer;font-family:'Outfit',sans-serif;font-size:.6rem;padding:0}
  .wo-back-btn:hover{color:var(--parch)}
  .wo-sel-summary{font-size:.58rem;color:var(--parch-dim);padding:0 6px}
  .wo-hdr-btn{display:inline-flex;align-items:center;gap:5px;background:transparent;border:1px solid var(--border);border-radius:3px;padding:4px 10px;font-family:'Outfit',sans-serif;font-size:.58rem;color:var(--parch-dim);cursor:pointer;transition:all .13s}
  .wo-hdr-btn:hover{border-color:var(--gold);color:var(--parch)}
  .wo-hdr-btn:disabled{opacity:.4;cursor:not-allowed}
  .wo-generate-btn{display:inline-flex;align-items:center;gap:5px;background:var(--gold);border:none;border-radius:3px;padding:4px 12px;font-family:'Outfit',sans-serif;font-size:.58rem;color:var(--bark);cursor:pointer;font-weight:500;transition:opacity .13s}
  .wo-generate-btn:hover{opacity:.85}
  .wo-generate-btn:disabled{opacity:.4;cursor:not-allowed}
  .wo-tabbar{display:flex;align-items:stretch;border-bottom:1px solid var(--border);background:var(--panel2);flex-shrink:0}
  .wo-tab{background:transparent;border:none;border-bottom:2px solid transparent;padding:10px 18px;font-family:'Outfit',sans-serif;font-size:.62rem;color:var(--parch-dim);cursor:pointer;transition:all .13s;white-space:nowrap}
  .wo-tab.on{color:var(--gold);border-bottom-color:var(--gold)}
  .wo-tab:hover{color:var(--parch)}
  .wo-split{display:flex;flex:1;overflow:hidden}
  .wo-left{width:420px;flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid var(--border);overflow:hidden;background:var(--panel)}
  .wo-panel-inner{padding:12px 18px 16px;display:flex;flex-direction:column;gap:8px;flex:1;overflow-y:auto}
  .wo-panel-inner::-webkit-scrollbar{width:3px}
  .wo-panel-inner::-webkit-scrollbar-thumb{background:rgba(201,151,58,.3);border-radius:2px}
  .wo-filters{display:flex;gap:6px}
  .wo-inp,.wo-sel{background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-family:'Outfit',sans-serif;font-size:.6rem;color:var(--parch);flex:1}
  .wo-inp:focus,.wo-sel:focus{outline:none;border-color:var(--gold)}
  .wo-sel{cursor:pointer}
  .wo-sel option{background:var(--panel)}
  .wo-name-field{margin-top:0}
  .wo-street-list{display:flex;flex-direction:column;gap:4px;overflow-y:auto;flex:1}
  .wo-street-list::-webkit-scrollbar{width:3px}
  .wo-street-list::-webkit-scrollbar-thumb{background:rgba(201,151,58,.3);border-radius:2px}
  .wo-street-row{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:8px 10px;background:var(--panel2);border:1px solid var(--border);border-radius:5px;cursor:pointer;transition:all .13s;font-family:'Outfit',sans-serif}
  .wo-street-row:hover{border-color:var(--gold);background:var(--gold-hi)}
  .wo-st-info{flex:1;min-width:0}
  .wo-st-name{font-size:.62rem;color:var(--parch)}
  .wo-st-meta{font-size:.5rem;color:var(--parch-dim)}
  .wo-st-badge{font-size:.5rem;background:var(--gold);color:var(--bark);padding:1px 6px;border-radius:3px}
  .wo-st-arrow{color:var(--gold);font-size:1rem}
  .wo-summary{font-size:.56rem;color:var(--parch-dim);padding:6px 0;border-top:1px solid var(--border);flex-shrink:0}
  .wo-detail-bar{padding:12px 18px;border-bottom:1px solid var(--border);background:var(--panel2);flex-shrink:0}
  .wo-detail-name{font-family:'Playfair Display',serif;font-size:.9rem;color:var(--canopy)}
  .wo-detail-meta{font-size:.52rem;color:var(--parch-dim)}
  .wo-tree-list{display:flex;flex-direction:column;gap:4px;overflow-y:auto;flex:1;padding:10px 18px}
  .wo-tree-list::-webkit-scrollbar{width:3px}
  .wo-tree-list::-webkit-scrollbar-thumb{background:rgba(201,151,58,.3);border-radius:2px}
  .wo-tree-row{background:var(--panel2);border:1px solid var(--border);border-radius:5px;padding:6px 8px;transition:all .13s}
  .wo-tree-row.selected{border-color:var(--gold);background:var(--gold-hi)}
  .wo-tree-top{display:flex;align-items:center;gap:8px}
  .wo-tree-check input{accent-color:var(--gold)}
  .wo-tree-info{flex:1;min-width:0}
  .wo-tree-name{font-size:.6rem;color:var(--parch)}
  .wo-tree-id{font-size:.5rem;color:var(--parch-dim);margin-left:6px}
  .wo-risk-badge{font-size:.52rem;padding:1px 6px;border-radius:3px;font-weight:500}
  .wo-tree-fields{display:flex;gap:4px;margin-top:6px;padding-left:22px}
  .wo-field-sel,.wo-field-inp{background:var(--panel);border:1px solid var(--border);border-radius:3px;padding:3px 6px;font-family:'Outfit',sans-serif;font-size:.54rem;color:var(--parch)}
  .wo-field-sel{width:110px;cursor:pointer}
  .wo-field-inp{flex:1}
  .wo-field-inp.cost{width:60px;flex:none}
  .wo-field-sel:focus,.wo-field-inp:focus{outline:none;border-color:var(--gold)}
  .wo-street-notes{display:flex;flex-direction:column;gap:4px;padding:8px 18px 12px;border-top:1px solid var(--border);flex-shrink:0}
  .wo-textarea{background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-family:'Outfit',sans-serif;font-size:.56rem;color:var(--parch);resize:none;height:40px}
  .wo-textarea:focus{outline:none;border-color:var(--gold)}
  .wo-saved-row{display:flex;align-items:center;gap:8px;background:var(--panel2);border:1px solid rgba(201,151,58,.1);border-radius:5px;padding:8px 10px}
  .wo-saved-info{flex:1;min-width:0}
  .wo-saved-name{font-size:.62rem;color:var(--parch)}
  .wo-saved-meta{font-size:.5rem;color:var(--parch-dim)}
  .wo-saved-actions{display:flex;gap:4px}
  .wo-act-btn{background:transparent;border:1px solid var(--border);border-radius:3px;padding:2px 8px;font-family:'Outfit',sans-serif;font-size:.5rem;color:var(--parch-dim);cursor:pointer;transition:all .13s}
  .wo-act-btn:hover{border-color:var(--gold);color:var(--parch)}
  .wo-act-btn.danger{border-color:rgba(184,53,53,.3);color:rgba(184,53,53,.7)}
  .wo-act-btn.danger:hover{border-color:var(--red);color:var(--red)}
  .wo-status-sel{background:transparent;border:1px solid;border-radius:3px;padding:2px 6px;font-family:'Outfit',sans-serif;font-size:.5rem;cursor:pointer;transition:all .13s}
  .wo-status-sel:focus{outline:none}
  .wo-status-sel option{background:var(--panel);color:var(--parch)}
  .wo-empty{font-size:.6rem;color:var(--parch-dim);text-align:center;padding:20px}
  .wo-map-wrap{flex:1;position:relative;overflow:hidden}
  .wo-map{width:100%;height:100%}
  .wo-map-hint{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(16,13,4,.88);border:1px solid rgba(201,151,58,.4);border-radius:6px;padding:6px 14px;font-family:'Outfit',sans-serif;font-size:.56rem;color:var(--parch-dim);white-space:nowrap;pointer-events:none}
</style>
