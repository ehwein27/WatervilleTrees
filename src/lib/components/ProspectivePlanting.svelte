<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { currentPage, ppMapClickActive, ppMapClickResult } from '$lib/stores/ui.js';
  import { showConfirm } from '$lib/stores/toast.js';
  import { plantingList, saveReport } from '$lib/stores/prospective.js';
  import { downloadProspectiveHTML, downloadProspectiveXLSX } from '$lib/utils/export.js';

  const PRIORITIES = ['High', 'Medium', 'Low'];

  const PRI_BG    = { High: 'rgba(192,57,43,.13)', Medium: 'rgba(211,84,0,.1)',   Low: 'rgba(30,132,73,.1)'  };
  const PRI_COLOR = { High: '#c0392b',             Medium: '#d35400',             Low: '#1e8449'             };
  const PRI_BDR   = { High: 'rgba(192,57,43,.32)', Medium: 'rgba(211,84,0,.28)', Low: 'rgba(30,132,73,.28)' };

  let listActive = $state(false);
  let rows       = $state([]);
  let reportName = $state('');
  let generating = $state(false);
  let genMsg     = $state('');
  let genIsError = $state(false);

  function newRow() {
    return {
      id:       'pp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      n:        '',
      addr:     '',
      lat:      null,
      lng:      null,
      date:     '',
      priority: 'Medium',
      notes:    '',
    };
  }

  onMount(() => {
    // Restore persisted rows from store
    const saved = get(plantingList);
    if (saved.length > 0) {
      rows = saved.map(e => ({ ...e }));
      listActive = true;
    }

    // Apply map-pick result when returning from map-click mode
    const result = get(ppMapClickResult);
    if (result) {
      ppMapClickResult.set(null);
      listActive = true;
      rows = rows.map(r =>
        r.id === result.rowId
          ? { ...r, addr: result.addr, lat: result.lat, lng: result.lng }
          : r
      );
      plantingList.set(rows);
    }
  });

  // Auto-persist rows to store whenever they change
  $effect(() => {
    if (listActive) plantingList.set(rows.map(r => ({ ...r })));
  });

  function createList() {
    rows = [newRow()];
    listActive = true;
    reportName = '';
    genMsg = '';
  }

  function addRow() {
    rows = [...rows, newRow()];
  }

  function removeRow(id) {
    const next = rows.filter(r => r.id !== id);
    rows = next.length > 0 ? next : [newRow()];
  }

  function setField(id, field, value) {
    rows = rows.map(r => r.id === id ? { ...r, [field]: value } : r);
  }

  function clearLocation(id) {
    rows = rows.map(r => r.id === id ? { ...r, addr: '', lat: null, lng: null } : r);
  }

  function pickOnMap(row) {
    // Persist rows first so we can restore them on return
    plantingList.set(rows.map(r => ({ ...r })));
    ppMapClickActive.set({ rowId: row.id, species: row.n });
    currentPage.set('map');
  }

  async function generateReport() {
    const valid = rows.filter(r => r.n.trim());
    if (!valid.length) return;
    generating = true; genMsg = ''; genIsError = false;
    try {
      const name = reportName.trim() ||
        'Prospective Planting Plan — ' +
        new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      downloadProspectiveHTML(valid, name);
      await downloadProspectiveXLSX(valid, name);
      saveReport(name, valid);
      genMsg = 'Report downloaded and saved to Inventory Archive.';
    } catch (e) {
      genIsError = true;
      genMsg = 'Error: ' + e.message;
    } finally {
      generating = false;
    }
  }

  async function discardList() {
    if (!(await showConfirm('Clear this planting list? All rows will be deleted.'))) return;
    rows = [];
    listActive = false;
    plantingList.set([]);
    genMsg = '';
  }

  let validCount = $derived(rows.filter(r => r.n.trim()).length);
</script>

<div class="pp-view">
  <div class="pp-wrap">

    {#if !listActive}
      <!-- ── Landing ──────────────────────────────────────────────────────── -->
      <div style="display:flex;justify-content:flex-end">
        <button class="pp-back" onclick={() => currentPage.set('map')}>← Back to Map</button>
      </div>

      <div class="pp-hero">
        <h1>Prospective Tree Planting</h1>
        <p>Plan which trees you want to plant before they're in the field. Once locations are confirmed, convert the list directly into a Bulk Add upload.</p>
      </div>

      <div class="pp-landing-card">
        <div class="pp-landing-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V12"/><path d="M12 12C12 12 7 9 7 5a5 5 0 0 1 10 0c0 4-5 7-5 7z"/><path d="M12 12c0 0-5 3-5 7"/><path d="M12 12c0 0 5 3 5 7"/><line x1="3" y1="22" x2="21" y2="22"/></svg>
        </div>
        <div class="pp-landing-body">
          <div class="pp-landing-title">Build a Planting List</div>
          <div class="pp-landing-desc">Add species, location, priority, and notes for each tree you're planning to plant. Locations can be typed as an address or clicked directly on the map.</div>
        </div>
        <button class="pp-create-btn" onclick={createList}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create New List
        </button>
      </div>

    {:else}
      <!-- ── Spreadsheet view ──────────────────────────────────────────────── -->

      <div style="display:flex;justify-content:flex-end;margin-bottom:4px">
        <button class="pp-back" onclick={() => currentPage.set('map')}>← Back to Map</button>
      </div>

      <div class="pp-top">
        <div class="pp-top-left">
          <h1>Prospective Tree Planting</h1>
        </div>
        <button class="pp-discard-btn" onclick={discardList} title="Clear list">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Clear List
        </button>
      </div>

      <!-- Spreadsheet table -->
      <div class="pp-card">
        <div class="pp-card-title">
          Planting List
          <span class="pp-count-badge">{rows.length}</span>
        </div>

        <div class="pp-table-wrap">
          <table class="pp-table">
            <thead>
              <tr>
                <th class="pp-th pp-th-num">#</th>
                <th class="pp-th pp-th-species">Species / Common Name</th>
                <th class="pp-th pp-th-loc">Location</th>
                <th class="pp-th pp-th-date">Est. Date</th>
                <th class="pp-th pp-th-pri">Priority</th>
                <th class="pp-th pp-th-notes">Notes</th>
                <th class="pp-th pp-th-del"></th>
              </tr>
            </thead>
            <tbody>
              {#each rows as row, i (row.id)}
                <tr class="pp-tr">
                  <td class="pp-td pp-td-num">{i + 1}</td>

                  <!-- Species -->
                  <td class="pp-td pp-td-species">
                    <input
                      class="pp-cell-input"
                      type="text"
                      placeholder="e.g. Red Maple"
                      value={row.n}
                      oninput={(e) => setField(row.id, 'n', e.target.value)}
                    />
                  </td>

                  <!-- Location -->
                  <td class="pp-td pp-td-loc">
                    {#if row.lat != null}
                      <!-- Picked from map -->
                      <div class="pp-loc-picked">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#1a5216;flex-shrink:0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span class="pp-loc-addr">{row.addr || `${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}`}</span>
                        <button class="pp-loc-clear" title="Clear location" onclick={() => clearLocation(row.id)}>×</button>
                      </div>
                    {:else}
                      <!-- Type or pick -->
                      <div class="pp-loc-row">
                        <input
                          class="pp-cell-input pp-loc-input"
                          type="text"
                          placeholder="Enter address…"
                          value={row.addr}
                          oninput={(e) => setField(row.id, 'addr', e.target.value)}
                        />
                        <button class="pp-map-pick-btn" title="Click a spot on the map" onclick={() => pickOnMap(row)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          Pick
                        </button>
                      </div>
                    {/if}
                  </td>

                  <!-- Date -->
                  <td class="pp-td pp-td-date">
                    <input
                      class="pp-cell-input pp-cell-date"
                      type="date"
                      value={row.date}
                      oninput={(e) => setField(row.id, 'date', e.target.value)}
                    />
                  </td>

                  <!-- Priority -->
                  <td class="pp-td pp-td-pri">
                    <select
                      class="pp-cell-select"
                      style="color:{PRI_COLOR[row.priority]};background:{PRI_BG[row.priority]};border-color:{PRI_BDR[row.priority]}"
                      value={row.priority}
                      onchange={(e) => setField(row.id, 'priority', e.target.value)}
                    >
                      {#each PRIORITIES as p}
                        <option value={p}>{p}</option>
                      {/each}
                    </select>
                  </td>

                  <!-- Notes -->
                  <td class="pp-td pp-td-notes">
                    <input
                      class="pp-cell-input"
                      type="text"
                      placeholder="Notes…"
                      value={row.notes}
                      oninput={(e) => setField(row.id, 'notes', e.target.value)}
                    />
                  </td>

                  <!-- Delete -->
                  <td class="pp-td pp-td-del">
                    <button class="pp-del-row-btn" title="Remove row" onclick={() => removeRow(row.id)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Add row -->
        <div class="pp-add-row-wrap">
          <button class="pp-add-row-btn" onclick={addRow}>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Row
          </button>
        </div>
      </div>

      <!-- Generate report -->
      <div class="pp-card">
        <div class="pp-card-title">Generate Report</div>
        <p class="pp-card-desc">
          Downloads a printable <strong>.html</strong> summary and a <strong>.xlsx</strong> spreadsheet formatted as a bulk-add upload — addresses included.
          The report is also saved to the <strong>Inventory Archive</strong> where you can later use <em>Convert to Bulk Add</em> to geocode and add the trees.
        </p>

        <div class="pp-report-name-row">
          <div class="pp-field">
            <label class="pp-label" for="pp-rname">Report Name <span class="pp-label-opt">(optional)</span></label>
            <input id="pp-rname" class="pp-input" type="text"
              placeholder="e.g. Spring 2026 Planting Plan"
              bind:value={reportName} />
          </div>
        </div>

        <div class="pp-report-actions">
          <button class="pp-gen-btn" onclick={generateReport}
            disabled={generating || validCount === 0}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            {generating ? 'Generating…' : 'Generate Report'}
          </button>
          {#if validCount === 0}
            <span class="pp-hint">Add at least one species name to generate.</span>
          {:else}
            <span class="pp-hint">{validCount} tree{validCount === 1 ? '' : 's'} will be included.</span>
          {/if}
        </div>

        {#if genMsg}
          <div class="pp-gen-msg" class:pp-gen-err={genIsError}>{genMsg}</div>
        {/if}
      </div>

    {/if}
  </div>
</div>

<style>
  /* ── Layout ──────────────────────────────────────────────────────────────── */
  .pp-view {
    position: absolute;
    inset: 0;
    background: var(--bg);
    overflow-y: auto;
    z-index: 2;
  }
  .pp-wrap {
    width: 100%;
    max-width: 960px;
    margin: 0 auto;
    padding: 40px 28px 60px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  /* ── Back / hero ─────────────────────────────────────────────────────────── */
  .pp-hero { display: flex; flex-direction: column; gap: 10px; }
  .pp-hero h1 { font-family: 'Playfair Display', serif; font-size: 1.8rem; color: #0f2e14; margin: 0; }
  .pp-hero p  { font-size: .68rem; color: #3a3a3a; line-height: 1.7; max-width: 560px; margin: 0; }

  .pp-back {
    display: inline-flex; align-items: center; gap: 5px;
    background: transparent; border: 1px solid rgba(120,80,20,.25);
    border-radius: 4px; padding: 5px 12px;
    font-family: 'Outfit', sans-serif; font-size: .74rem;
    color: #5c3d08; cursor: pointer; width: fit-content;
    transition: border-color .13s, background .13s;
  }
  .pp-back:hover { border-color: #5c3d08; background: rgba(92,61,8,.06); }

  /* ── Top bar (spreadsheet view) ─────────────────────────────────────────── */
  .pp-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .pp-top-left { display: flex; flex-direction: column; gap: 8px; }
  .pp-top-left h1 { font-family: 'Playfair Display', serif; font-size: 1.8rem; color: #0f2e14; margin: 0; }

  .pp-discard-btn {
    display: inline-flex; align-items: center; gap: 5px;
    background: transparent;
    border: 1px solid rgba(158,32,32,.25);
    border-radius: 4px; padding: 6px 13px;
    font-family: 'Outfit', sans-serif; font-size: .64rem;
    color: #9e2020; cursor: pointer; flex-shrink: 0; align-self: flex-start;
    margin-top: 6px;
    transition: border-color .13s, background .13s;
  }
  .pp-discard-btn:hover { border-color: rgba(158,32,32,.55); background: rgba(158,32,32,.05); }

  /* ── Landing card ─────────────────────────────────────────────────────────── */
  .pp-landing-card {
    background: #f5ede0;
    border: 1px solid rgba(120,80,20,.18);
    border-radius: 8px;
    padding: 28px 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }
  .pp-landing-icon {
    width: 56px; height: 56px;
    background: rgba(26,82,22,.1);
    border: 1px solid rgba(26,82,22,.2);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    color: #1a5216; flex-shrink: 0;
  }
  .pp-landing-body { flex: 1; min-width: 200px; }
  .pp-landing-title { font-size: .9rem; font-weight: 600; color: #0f2e14; margin-bottom: 5px; }
  .pp-landing-desc  { font-size: .67rem; color: #5c3d08; line-height: 1.65; }
  .pp-create-btn {
    display: inline-flex; align-items: center; gap: 7px;
    background: #1a5216; border: none; border-radius: 5px;
    padding: 10px 20px;
    font-family: 'Outfit', sans-serif; font-size: .68rem;
    color: #fff; cursor: pointer; flex-shrink: 0;
    transition: opacity .13s;
  }
  .pp-create-btn:hover { opacity: .85; }

  /* ── Card ────────────────────────────────────────────────────────────────── */
  .pp-card {
    background: #f5ede0;
    border: 1px solid rgba(120,80,20,.18);
    border-radius: 8px;
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .pp-card-title {
    font-size: .52rem;
    letter-spacing: .13em;
    text-transform: uppercase;
    color: #5c3d08;
    border-bottom: 1px solid rgba(120,80,20,.15);
    padding-bottom: 8px;
    font-weight: 600;
    display: flex; align-items: center; gap: 8px;
  }
  .pp-count-badge {
    display: inline-flex; align-items: center; justify-content: center;
    background: #1a5216; color: #fff;
    font-size: .5rem; font-weight: 700; border-radius: 9px;
    padding: 1px 6px; letter-spacing: .04em; text-transform: none;
  }
  .pp-card-desc {
    font-size: .64rem; color: #3a3a3a; line-height: 1.65; margin: 0;
  }
  .pp-card-desc strong { color: #0f0f0f; }
  .pp-card-desc em { font-style: italic; }

  /* ── Spreadsheet table ───────────────────────────────────────────────────── */
  .pp-table-wrap {
    overflow-x: auto;
    border: 1px solid rgba(120,80,20,.18);
    border-radius: 6px;
  }
  .pp-table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'Outfit', sans-serif;
    font-size: .62rem;
    min-width: 720px;
  }

  .pp-th {
    padding: 8px 10px;
    text-align: left;
    font-size: .5rem;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: #5c3d08;
    font-weight: 600;
    background: #ece3d4;
    border-bottom: 1px solid rgba(120,80,20,.2);
    white-space: nowrap;
  }
  .pp-th-num    { width: 36px; text-align: center; }
  .pp-th-species{ width: 200px; }
  .pp-th-loc    { width: 220px; }
  .pp-th-date   { width: 130px; }
  .pp-th-pri    { width: 96px; }
  .pp-th-notes  { }
  .pp-th-del    { width: 36px; }

  .pp-tr { background: var(--bg); }
  .pp-tr:nth-child(even) { background: #f7f0e6; }
  .pp-tr:hover { background: #f2e9d8; }

  .pp-td {
    padding: 6px 8px;
    border-bottom: 1px solid rgba(120,80,20,.1);
    vertical-align: middle;
  }
  .pp-td-num {
    text-align: center;
    font-size: .58rem;
    color: #9e7e50;
    font-weight: 500;
  }

  /* ── Cell inputs ─────────────────────────────────────────────────────────── */
  .pp-cell-input {
    width: 100%;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 3px;
    padding: 4px 6px;
    font-family: 'Outfit', sans-serif;
    font-size: .62rem;
    color: #0f0f0f;
    outline: none;
    transition: border-color .12s, background .12s;
  }
  .pp-cell-input:focus {
    border-color: rgba(26,82,22,.45);
    background: #fff;
  }
  .pp-cell-input::placeholder { color: #bfb09a; }

  .pp-cell-date {
    color: #3a3a3c;
    cursor: pointer;
  }

  .pp-cell-select {
    width: 100%;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 3px;
    padding: 4px 6px;
    font-family: 'Outfit', sans-serif;
    font-size: .58rem;
    font-weight: 600;
    cursor: pointer;
    outline: none;
    transition: border-color .12s;
  }
  .pp-cell-select:focus { border-color: rgba(26,82,22,.45); }

  /* ── Location cell ───────────────────────────────────────────────────────── */
  .pp-loc-row {
    display: flex; align-items: center; gap: 4px;
  }
  .pp-loc-input { flex: 1; min-width: 0; }

  .pp-map-pick-btn {
    display: inline-flex; align-items: center; gap: 4px;
    background: rgba(26,82,22,.1);
    border: 1px solid rgba(26,82,22,.3);
    border-radius: 3px; padding: 4px 8px;
    font-family: 'Outfit', sans-serif; font-size: .54rem;
    color: #1a5216; cursor: pointer; flex-shrink: 0; white-space: nowrap;
    transition: background .12s, border-color .12s;
  }
  .pp-map-pick-btn:hover { background: rgba(26,82,22,.18); border-color: rgba(26,82,22,.5); }

  .pp-loc-picked {
    display: flex; align-items: center; gap: 5px;
    background: rgba(26,82,22,.08);
    border: 1px solid rgba(26,82,22,.2);
    border-radius: 3px; padding: 4px 7px;
  }
  .pp-loc-addr {
    flex: 1; min-width: 0;
    font-size: .58rem; color: #0f2e14;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .pp-loc-clear {
    background: transparent; border: none;
    color: #5c8055; font-size: .7rem; line-height: 1;
    cursor: pointer; flex-shrink: 0; padding: 0 1px;
    transition: color .12s;
  }
  .pp-loc-clear:hover { color: #9e2020; }

  /* ── Delete row button ───────────────────────────────────────────────────── */
  .pp-del-row-btn {
    display: flex; align-items: center; justify-content: center;
    background: transparent;
    border: none;
    color: #bfb09a;
    cursor: pointer;
    padding: 3px;
    border-radius: 3px;
    width: 100%;
    transition: color .12s, background .12s;
  }
  .pp-del-row-btn:hover { color: #9e2020; background: rgba(158,32,32,.07); }

  /* ── Add row ─────────────────────────────────────────────────────────────── */
  .pp-add-row-wrap { display: flex; padding-top: 2px; }
  .pp-add-row-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent;
    border: 1px dashed rgba(120,80,20,.35);
    border-radius: 4px; padding: 7px 16px;
    font-family: 'Outfit', sans-serif; font-size: .62rem;
    color: #5c3d08; cursor: pointer;
    transition: border-color .13s, background .13s, color .13s;
  }
  .pp-add-row-btn:hover { border-color: #1a5216; color: #1a5216; background: rgba(26,82,22,.04); border-style: solid; }

  /* ── Report section ──────────────────────────────────────────────────────── */
  .pp-report-name-row { display: flex; }
  .pp-field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .pp-label {
    font-size: .55rem; letter-spacing: .09em; text-transform: uppercase;
    color: #5c3d08; font-weight: 600;
  }
  .pp-label-opt { font-weight: 400; text-transform: none; letter-spacing: 0; opacity: .55; }
  .pp-input {
    background: var(--bg); border: 1px solid rgba(120,80,20,.28); border-radius: 4px;
    padding: 7px 10px; font-family: 'Outfit', sans-serif; font-size: .64rem;
    color: #0f0f0f; outline: none; width: 100%; transition: border-color .13s;
    max-width: 420px;
  }
  .pp-input:focus { border-color: #1a5216; }

  .pp-report-actions {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  }
  .pp-gen-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: #1a5216; border: none; border-radius: 4px;
    padding: 8px 18px; font-family: 'Outfit', sans-serif; font-size: .62rem;
    color: #fff; cursor: pointer; flex-shrink: 0; transition: opacity .13s;
  }
  .pp-gen-btn:hover { opacity: .85; }
  .pp-gen-btn:disabled { opacity: .45; cursor: not-allowed; }
  .pp-hint { font-size: .6rem; color: #5c3d08; opacity: .65; }

  .pp-gen-msg {
    font-size: .64rem; color: #1a5216;
    background: rgba(26,82,22,.07); border: 1px solid rgba(26,82,22,.2);
    border-radius: 4px; padding: 8px 12px;
  }
  .pp-gen-err { color: #9e2020; background: rgba(158,32,32,.07); border-color: rgba(158,32,32,.2); }
</style>
