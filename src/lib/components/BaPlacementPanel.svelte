<script>
  import { get } from 'svelte/store';
  import { baPlacementData, mapInstance, currentPage } from '$lib/stores/ui.js';

  const CONDITIONS  = ['Good', 'Fair', 'Poor', 'Dead'];
  const AGE_CLASSES = ['Young', 'Semi-mature', 'Mature', 'Over-mature'];

  let editAddr  = $state('');
  let editN     = $state('');
  let editS     = $state('');
  let editC     = $state('');
  let editA     = $state('');
  let editD     = $state('');
  let placedLat = $state(null);
  let placedLng = $state(null);

  let marker = null;

  let pd    = $derived($baPlacementData);
  let cur   = $derived(pd ? pd.geoResults[pd.idx] : null);
  let total = $derived(pd?.geoResults.length ?? 0);

  // Update edit fields when current tree changes
  $effect(() => {
    if (!cur) return;
    editAddr = cur.row.addr || '';
    editN    = cur.row.n   || '';
    editS    = cur.row.s   || '';
    editC    = cur.row.c   || '';
    editA    = cur.row.a   || '';
    editD    = cur.row.d != null ? String(cur.row.d) : '';
  });

  // Map: place marker + register click-to-place handler; re-runs when cur or map changes
  $effect(() => {
    const m = $mapInstance;
    const c = cur; // reactive dep — re-runs when idx changes
    if (!m) return;

    // Sync placedLat/Lng with the geocoded position for this tree
    if (marker) { m.removeLayer(marker); marker = null; }
    placedLat = c?.lat ?? null;
    placedLng = c?.lng ?? null;

    if (c?.lat != null) {
      marker = L.marker([c.lat, c.lng], { draggable: true }).addTo(m);
      marker.on('dragend', e => {
        const ll = e.target.getLatLng();
        placedLat = ll.lat;
        placedLng = ll.lng;
      });
      m.panTo([c.lat, c.lng], { animate: true });
    }

    function onClick(e) {
      const { lat, lng } = e.latlng;
      placedLat = lat;
      placedLng = lng;
      if (marker) { m.removeLayer(marker); marker = null; }
      marker = L.marker([lat, lng], { draggable: true }).addTo(m);
      marker.on('dragend', e2 => {
        const ll = e2.target.getLatLng();
        placedLat = ll.lat;
        placedLng = ll.lng;
      });
    }
    m.on('click', onClick);
    const mapEl = document.getElementById('map');
    if (mapEl) mapEl.style.cursor = 'crosshair';

    return () => {
      m.off('click', onClick);
      if (marker) { m.removeLayer(marker); marker = null; }
      const mapEl = document.getElementById('map');
      if (mapEl) mapEl.style.cursor = '';
    };
  });

  function buildUpdatedResults(snap) {
    const updated = [...snap.geoResults];
    updated[snap.idx] = {
      ...updated[snap.idx],
      lat: placedLat,
      lng: placedLng,
      flagged: placedLat === null,
      row: {
        ...updated[snap.idx].row,
        addr: editAddr,
        n:    editN,
        s:    editS,
        c:    editC,
        a:    editA,
        d:    parseFloat(editD) || null,
      },
    };
    return updated;
  }

  function confirmAndNext() {
    const snap = get(baPlacementData);
    if (!snap) return;
    const updated = buildUpdatedResults(snap);
    const nextIdx = snap.idx + 1;
    if (nextIdx >= snap.geoResults.length) {
      baPlacementData.set({ ...snap, geoResults: updated, done: true });
      currentPage.set('bulk-add');
    } else {
      baPlacementData.set({ ...snap, geoResults: updated, idx: nextIdx });
    }
  }

  function skipTree() {
    const snap = get(baPlacementData);
    if (!snap) return;
    const nextIdx = snap.idx + 1;
    if (nextIdx >= snap.geoResults.length) {
      baPlacementData.update(pd => ({ ...pd, done: true }));
      currentPage.set('bulk-add');
    } else {
      baPlacementData.update(pd => ({ ...pd, idx: nextIdx }));
    }
  }

  function goBack() {
    const snap = get(baPlacementData);
    if (!snap || snap.idx === 0) return;
    const updated = buildUpdatedResults(snap);
    baPlacementData.set({ ...snap, geoResults: updated, idx: snap.idx - 1 });
  }

  function finishAndReview() {
    const snap = get(baPlacementData);
    if (!snap) return;
    const updated = buildUpdatedResults(snap);
    baPlacementData.set({ ...snap, geoResults: updated, done: true });
    currentPage.set('bulk-add');
  }

  function cancelPlacement() {
    baPlacementData.set(null);
    currentPage.set('bulk-add');
  }
</script>

{#if pd && cur}
<div class="bap-panel">

  <div class="bap-hdr">
    <div class="bap-progress">
      <span class="bap-prog-n">{pd.idx + 1}</span>
      <span class="bap-prog-sep">/</span>
      <span class="bap-prog-tot">{total}</span>
    </div>
    <span class="bap-title">Place Tree on Map</span>
    <button class="bap-x" onclick={cancelPlacement} title="Cancel — return to upload">
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  <div class="bap-inst" class:bap-inst-placed={placedLat !== null} class:bap-inst-empty={placedLat === null}>
    {#if placedLat !== null}
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      Marker placed — drag to adjust or click map to move
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      No location found — click map to place this tree
    {/if}
  </div>

  <div class="bap-fields">
    <div class="bap-field">
      <label class="bap-lbl">Address</label>
      <input class="bap-input" bind:value={editAddr} placeholder="e.g. 123 Main St" />
    </div>
    <div class="bap-field">
      <label class="bap-lbl">Common Name</label>
      <input class="bap-input" bind:value={editN} placeholder="e.g. Sugar Maple" />
    </div>
    <div class="bap-field">
      <label class="bap-lbl">Scientific Name</label>
      <input class="bap-input" bind:value={editS} placeholder="e.g. Acer saccharum" />
    </div>
    <div class="bap-row">
      <div class="bap-field">
        <label class="bap-lbl">Condition</label>
        <select class="bap-select" bind:value={editC}>
          <option value="">—</option>
          {#each CONDITIONS as c}
            <option value={c}>{c}</option>
          {/each}
        </select>
      </div>
      <div class="bap-field">
        <label class="bap-lbl">Age Class</label>
        <select class="bap-select" bind:value={editA}>
          <option value="">—</option>
          {#each AGE_CLASSES as a}
            <option value={a}>{a}</option>
          {/each}
        </select>
      </div>
      <div class="bap-field bap-field-sm">
        <label class="bap-lbl">DBH (in)</label>
        <input class="bap-input" type="number" bind:value={editD} placeholder="0" min="0" step="0.1" />
      </div>
    </div>
  </div>

  <div class="bap-actions">
    <button class="bap-btn bap-back" onclick={goBack} disabled={pd.idx === 0}>← Back</button>
    <button class="bap-btn bap-skip" onclick={skipTree} title="Skip without saving edits">Skip</button>
    <div style="flex:1"></div>
    {#if pd.idx === total - 1}
      <button class="bap-btn bap-finish" onclick={finishAndReview}>Finish & Review →</button>
    {:else}
      <button class="bap-btn bap-confirm" onclick={confirmAndNext} disabled={placedLat === null}>Confirm & Next →</button>
    {/if}
  </div>

</div>
{/if}

<style>
  .bap-panel {
    position: fixed;
    bottom: 20px;
    left: 16px;
    width: 296px;
    max-width: calc(100vw - 32px);
    background: var(--bark);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px 12px;
    z-index: 9998;
    box-shadow: 0 8px 36px rgba(0,0,0,.7);
    font-family: 'DM Mono', monospace;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Header row */
  .bap-hdr {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bap-progress {
    display: flex;
    align-items: baseline;
    gap: 2px;
    background: rgba(255,255,255,.06);
    border-radius: 4px;
    padding: 2px 8px;
  }
  .bap-prog-n   { font-size: .78rem; color: var(--gold); font-weight: 600; }
  .bap-prog-sep { font-size: .7rem; color: var(--parch-dim); }
  .bap-prog-tot { font-size: .7rem; color: var(--parch-dim); }
  .bap-title {
    flex: 1;
    font-size: .72rem;
    letter-spacing: .06em;
    color: var(--parch);
    font-weight: 500;
    text-transform: uppercase;
  }
  .bap-x {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 3px;
    padding: 3px 6px;
    color: var(--parch-dim);
    cursor: pointer;
    transition: all .12s;
    display: flex;
    align-items: center;
  }
  .bap-x:hover { border-color: var(--border); color: var(--parch); }

  /* Instruction line */
  .bap-inst {
    font-size: .65rem;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 8px;
    border-radius: 5px;
  }
  .bap-inst-placed {
    color: var(--canopy);
    background: rgba(100,180,80,.1);
    border: 1px solid rgba(100,180,80,.2);
  }
  .bap-inst-empty {
    color: var(--gold);
    background: rgba(201,151,58,.08);
    border: 1px solid rgba(201,151,58,.2);
  }

  /* Fields */
  .bap-fields {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bap-row {
    display: flex;
    gap: 6px;
  }
  .bap-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
  }
  .bap-field-sm { flex: 0 0 68px; }
  .bap-lbl {
    font-size: .58rem;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--parch-dim);
  }
  .bap-input, .bap-select {
    background: var(--panel2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 5px 8px;
    font-family: 'DM Mono', monospace;
    font-size: .68rem;
    color: var(--parch);
    width: 100%;
    box-sizing: border-box;
    outline: none;
    transition: border-color .12s;
    -webkit-appearance: none;
  }
  .bap-input:focus, .bap-select:focus {
    border-color: var(--gold);
  }
  .bap-select {
    cursor: pointer;
  }
  input[type="number"].bap-input::-webkit-inner-spin-button,
  input[type="number"].bap-input::-webkit-outer-spin-button {
    opacity: 0.4;
  }

  /* Actions */
  .bap-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 2px;
  }
  .bap-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 5px 11px;
    font-family: 'DM Mono', monospace;
    font-size: .65rem;
    color: var(--parch-dim);
    cursor: pointer;
    transition: all .13s;
    white-space: nowrap;
  }
  .bap-btn:disabled {
    opacity: .35;
    cursor: default;
    pointer-events: none;
  }
  .bap-btn:hover:not(:disabled) {
    border-color: var(--gold);
    color: var(--parch);
  }
  .bap-confirm, .bap-finish {
    background: rgba(201,151,58,.12);
    border-color: rgba(201,151,58,.45);
    color: var(--gold);
    font-weight: 600;
  }
  .bap-confirm:hover:not(:disabled), .bap-finish:hover:not(:disabled) {
    background: rgba(201,151,58,.22);
    border-color: var(--gold);
    color: var(--gold-hi);
  }
  .bap-finish {
    background: rgba(100,180,80,.1);
    border-color: rgba(100,180,80,.35);
    color: var(--canopy);
  }
  .bap-finish:hover:not(:disabled) {
    background: rgba(100,180,80,.2);
    border-color: var(--canopy);
    color: var(--canopy);
  }

  @media (max-width: 480px) {
    .bap-panel {
      left: 8px;
      right: 8px;
      width: auto;
      max-width: none;
      bottom: 12px;
    }
  }
</style>
