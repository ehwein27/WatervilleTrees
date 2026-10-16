<script>
  import { onMount, onDestroy } from 'svelte';
  import { filteredTrees, openTree, closeSidebar, selectedTree, mapInstance, placeModeActive, ppMapClickActive, rlClickHandler, rlViewListId, bulkClickHandler, mapMode, rlists } from '$lib/stores/ui.js';
  import { condColor } from '$lib/utils/format.js';
import { get } from 'svelte/store';

  let mapEl;
  let map;
  let markerLayer;
  let rlViewLayer;
  let selLayer;
  let bulkLayer;
  let canvasRenderer; // shared canvas renderer — all tree markers share one canvas element
  // Maps treeId → bulk ring marker, for remove-on-deselect
  let bulkRings = {};
  // Tile layers (created once in onMount)
  let tileSatellite, tileTransport, tilePlaces, tileLight;
  let boundaryLayer;
  // Full tree list — kept in sync with store so moveend can re-cull without store read
  let allTrees = [];
  // Debounce handle for marker rendering
  let renderTimer;
  // Tracks the padded bounds of the last render — used to skip redundant redraws on pan
  let renderedBounds = null;

  const WATERVILLE_BOUNDARY = [
    [44.5775,-69.6718],[44.5785,-69.6640],[44.5782,-69.6540],[44.5775,-69.6440],
    [44.5768,-69.6335],[44.5745,-69.6270],[44.5710,-69.6248],[44.5672,-69.6235],
    [44.5635,-69.6228],[44.5595,-69.6220],[44.5555,-69.6225],[44.5515,-69.6235],
    [44.5480,-69.6245],[44.5440,-69.6250],[44.5390,-69.6285],[44.5340,-69.6320],
    [44.5295,-69.6380],[44.5270,-69.6440],[44.5255,-69.6505],[44.5250,-69.6570],
    [44.5258,-69.6620],[44.5268,-69.6670],[44.5282,-69.6720],[44.5320,-69.6745],
    [44.5370,-69.6748],[44.5420,-69.6742],[44.5470,-69.6738],[44.5520,-69.6735],
    [44.5570,-69.6732],[44.5620,-69.6728],[44.5680,-69.6725],[44.5730,-69.6720],
    [44.5775,-69.6718],
  ];

  // Single map-level click handler — replaces per-marker listeners for lower overhead
  function handleMapClick(e) {
    if (get(placeModeActive)) return;
    if (get(ppMapClickActive)) return;
    const clickPt = map.latLngToLayerPoint(e.latlng);
    const bounds = renderedBounds || map.getBounds().pad(0.5);
    const HIT_PX = 8;
    let closest = null;
    let minDist = HIT_PX + 1;
    for (const t of allTrees) {
      if (!t.lt || !t.ln) continue;
      if (!bounds.contains([t.lt, t.ln])) continue;
      const pt = map.latLngToLayerPoint([t.lt, t.ln]);
      const d = Math.hypot(clickPt.x - pt.x, clickPt.y - pt.y);
      if (d < minDist) { minDist = d; closest = t; }
    }
    if (!closest) return;
    const rlHandler = get(rlClickHandler);
    if (rlHandler) { rlHandler(closest.id); return; }
    const bkHandler = get(bulkClickHandler);
    if (bkHandler) { bkHandler(closest); return; }
    openTree(closest.id);
  }

  // Render only markers in the current viewport, with a generous buffer so pans don't
  // constantly trigger redraws. Pass force=true to bypass the bounds-skip check.
  function doRender(force = false) {
    if (!map || !markerLayer) return;
    const viewBounds = map.getBounds();
    // Skip re-render if the current view is still fully inside last rendered area
    if (!force && renderedBounds && renderedBounds.contains(viewBounds)) return;
    // Render with a large buffer so nearby pans don't need a fresh redraw
    const renderBounds = viewBounds.pad(0.5);
    renderedBounds = renderBounds;
    markerLayer.clearLayers();
    allTrees.forEach(t => {
      if (!t.lt || !t.ln) return;
      if (!renderBounds.contains([t.lt, t.ln])) return;
      markerLayer.addLayer(L.circleMarker([t.lt, t.ln], {
        renderer: canvasRenderer,
        radius: 5,
        fillColor: condColor(t.c),
        fillOpacity: 1,
        color: '#100d04',
        weight: 1,
        interactive: false,
      }));
    });
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => doRender(), 120);
  }

  function renderMarkers(trees) {
    allTrees = trees;
    renderedBounds = null; // force full re-render when tree set changes
    scheduleRender();
  }

  // After zoom completes, the scale has changed so rendered bounds are stale — re-render immediately
  function onZoomEnd() { renderedBounds = null; doRender(true); }
  // After pan, skip if still inside buffer; otherwise debounce a redraw
  function onMapMove() { scheduleRender(); }

  // Called by the bulk click handler with tree object
  export function bulkToggleRing(t, isSelected) {
    if (!bulkLayer) return;
    if (isSelected) {
      if (bulkRings[t.id]) return; // already has ring
      const ring = L.circleMarker([t.lt, t.ln], {
        radius: 13, fillColor: 'transparent', fillOpacity: 0,
        color: '#f0e8d0', weight: 2.5, opacity: 1,
      });
      bulkLayer.addLayer(ring);
      bulkRings[t.id] = ring;
    } else {
      if (bulkRings[t.id]) { bulkLayer.removeLayer(bulkRings[t.id]); delete bulkRings[t.id]; }
    }
  }

  export function clearBulkRings() {
    bulkLayer?.clearLayers();
    bulkRings = {};
  }

  function setSelMarker(t) {
    if (!selLayer) return;
    selLayer.clearLayers();
    if (!t?.lt || !t?.ln) return;
    const inner = L.circleMarker([t.lt, t.ln], {
      radius: 16, fillColor: 'transparent', fillOpacity: 0,
      color: 'rgba(255,255,255,0.35)', weight: 1.5,
    });
    const ring = L.circleMarker([t.lt, t.ln], {
      radius: 12, fillColor: 'transparent', fillOpacity: 0,
      color: '#fff', weight: 2.5,
    });
    inner.on('click', (e) => { window.L.DomEvent.stopPropagation(e); closeSidebar(); });
    ring.on('click', (e) => { window.L.DomEvent.stopPropagation(e); closeSidebar(); });
    selLayer.addLayer(inner);
    selLayer.addLayer(ring);
  }

  async function refreshRLViewLayer(listId) {
    if (!rlViewLayer) return;
    rlViewLayer.clearLayers();
    if (!listId) return;
    try {
      const lists = get(rlists);
      const list = lists.find(l => l.id === listId);
      if (!list) return;
      // Get all trees by id for fast lookup
      const allTrees = get(filteredTrees);
      const byId = {};
      allTrees.forEach(t => { byId[t.id] = t; byId[String(t.id)] = t; });
      list.trees.forEach(tid => {
        const t = byId[tid] || byId[String(tid)];
        if (!t) return;
        const glow = L.circleMarker([t.lt, t.ln], {
          radius: 13, fillColor: 'rgba(184,53,53,0.12)', fillOpacity: 1,
          color: '#b83535', weight: 1.5, opacity: 0.5, interactive: false,
        });
        const ring = L.circleMarker([t.lt, t.ln], {
          radius: 9, fillColor: 'rgba(184,53,53,0.25)', fillOpacity: 1,
          color: '#b83535', weight: 2.5, opacity: 1,
        });
        ring.bindTooltip(
          `<span style="font-family:'Outfit',sans-serif;font-size:11px">#${t.id} ${t.n} — on list</span>`,
          { direction: 'top', opacity: 1 }
        );
        ring.on('click', () => openTree(t.id));
        rlViewLayer.addLayer(glow);
        rlViewLayer.addLayer(ring);
      });
    } catch {}
  }

  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  // Shared tile options — defer fetches until pan/zoom settles, pre-cache surrounding tiles
  const TILE_OPTS = {
    updateWhenZooming: false,
    keepBuffer: 2,
    ...(isMobile ? { updateWhenIdle: true } : {}),
  };

  function addOverlayLayers() {
    if (isMobile) return;
    if (!map.hasLayer(tileTransport)) tileTransport.addTo(map);
    if (!map.hasLayer(tilePlaces)) tilePlaces.addTo(map);
  }

  function applyMapMode(mode) {
    if (!map) return;
    mapMode.set(mode);
    try { localStorage.setItem('mapMode', mode); } catch {}

    if (mode === 'light') {
      // Add light layer first so it loads behind satellite
      if (!map.hasLayer(tileLight)) tileLight.addTo(map);
      // Remove overlay labels immediately (they're for satellite only)
      if (map.hasLayer(tileTransport)) map.removeLayer(tileTransport);
      if (map.hasLayer(tilePlaces)) map.removeLayer(tilePlaces);
      // Brief delay before dropping satellite so light tiles start loading first (crossfade effect)
      setTimeout(() => {
        if (map.hasLayer(tileSatellite)) map.removeLayer(tileSatellite);
      }, 300);
    } else {
      // Add satellite first
      if (!map.hasLayer(tileSatellite)) tileSatellite.addTo(map);
      // Wait for first satellite tile before adding label overlays — prevents dark canvas + labels
      tileSatellite.once('tileload', addOverlayLayers);
      // Remove light layer after satellite starts rendering
      setTimeout(() => {
        if (map.hasLayer(tileLight)) map.removeLayer(tileLight);
      }, 300);
    }

    if (boundaryLayer) {
      const isSat = mode !== 'light';
      boundaryLayer.setStyle({
        color:       isSat ? '#ffffff' : '#3a5c1a',
        opacity:     isSat ? 0.85 : 0.9,
        fillColor:   isSat ? '#ffffff' : '#3a5c1a',
        fillOpacity: isSat ? 0.03 : 0.04,
      });
    }
  }

  export function toggleMode() {
    applyMapMode(get(mapMode) === 'satellite' ? 'light' : 'satellite');
  }

  onMount(async () => {
    const L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');
    window.L = L.default;

    canvasRenderer = L.default.canvas({ padding: 0.5 });

    const BOUNDS = L.default.latLngBounds([44.44, -69.78], [44.66, -69.50]);

    map = L.default.map(mapEl, {
      minZoom: 11,
      maxZoom: 19,
      maxBounds: BOUNDS,
      maxBoundsViscosity: 0.75,
      preferCanvas: true,
    }).setView([44.5514, -69.6351], isMobile ? 13 : 15);

    tileSatellite = L.default.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri, Maxar, Earthstar Geographics',
      maxZoom: 19, maxNativeZoom: 18,
      ...TILE_OPTS,
    });
    tileTransport = L.default.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, maxNativeZoom: 19, opacity: 0.85, attribution: '',
      ...TILE_OPTS,
    });
    tilePlaces = L.default.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, maxNativeZoom: 19, opacity: 0.9, attribution: '',
      ...TILE_OPTS,
    });
    tileLight = L.default.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=f723634e-67bb-4666-8e92-5a5921712816', {
      attribution: '© Stadia Maps © OpenMapTiles © OpenStreetMap contributors',
      maxZoom: 20, maxNativeZoom: 20,
      ...TILE_OPTS,
    });

    let savedMode = 'satellite';
    try { savedMode = localStorage.getItem('mapMode') || 'satellite'; } catch {}

    // City boundary polygon — colour applied by applyMapMode below
    boundaryLayer = L.default.polygon(WATERVILLE_BOUNDARY, {
      weight: 2.5, dashArray: '7 5', interactive: false,
    }).addTo(map);

    mapMode.set(savedMode);
    applyMapMode(savedMode);

    rlViewLayer = L.default.layerGroup().addTo(map);
    bulkLayer = L.default.layerGroup().addTo(map);
    markerLayer = L.default.layerGroup().addTo(map);
    selLayer = L.default.layerGroup().addTo(map);
    mapInstance.set(map);

    map.on('moveend', onMapMove);
    map.on('zoomend', onZoomEnd);
    map.on('click', handleMapClick);

    const unsubTrees = filteredTrees.subscribe(trees => renderMarkers(trees));
    const unsubRL = rlViewListId.subscribe(id => refreshRLViewLayer(id));
    const unsubSel = selectedTree.subscribe(t => setSelMarker(t));

    return () => { unsubTrees(); unsubRL(); unsubSel(); map.off('moveend', onMapMove); map.off('zoomend', onZoomEnd); map.off('click', handleMapClick); mapInstance.set(null); };
  });

  onDestroy(() => { clearTimeout(renderTimer); map?.remove(); mapInstance.set(null); });
</script>

<div style="position:relative;flex:1;min-height:0">
  <div bind:this={mapEl} id="map" style="position:absolute;inset:0;z-index:1;"></div>
</div>
