<script>
  import { trees, addTrees } from '$lib/stores/trees.js';
  import { speciesList, sciNamesList, streetsList, speciesMap, openTree } from '$lib/stores/ui.js';
  import { currentUser } from '$lib/stores/auth.js';
  import { insertTrees, fetchAllTrees, SB_HDRS } from '$lib/api/supabase.js';
  import { get } from 'svelte/store';
  import SpeciesInput from '$lib/components/SpeciesInput.svelte';
  let { onClose, onPlaceMode, placed } = $props();

  const _OB = ["Broken branch(s)","Buried root collar","Cavity-branch","Cavity-stem","Cavity-suspected","Co-dominant stems","Co-dominant stems (11)","Co-dominant stems (2)","Co-dominant stems (4)","Crack-branch","Crack-stem","Dead branches <=2","Dead branches >2","Dead/dying stem","Dieback (moderate)","Dieback (severe)","Environmental conditions","Fungi/conks","Girdling material","Girdling roots present","Girdling roots present (moderate)","Girdling roots present (severe)","Girdling roots suspected","Good form","Good vigor","Growing against object","Hanger","Included bark","Lion tailing","Low live crown ratio","Low vigor","Overextended branch","Pavement/curbing damage","Poor branch structure","Rib","Road clearance","Seam","Sidewalk lifting-major","Sidewalk lifting-minor","Suppressed","Sweep","Topping/heading cuts","Uneven crown","Wound-branch","Wound-root flare","Wound-stem"];

  let species = $state('');
  let sciName = $state('');
  let condition = $state('');
  let ageClass = $state('');
  let dbh = $state('');
  let dateVal = $state(new Date().toISOString().slice(0, 10));
  let lat = $state('');
  let lng = $state('');
  let street = $state('');
  let notes = $state('');
  let checkedObs = $state(new Set());
  let errMsg = $state('');
  let saving = $state(false);
  let dbhWarn = $state('');
  let streetStatus = $state('');
  let streetStatusColor = $state('var(--parch-dim)');

  // Called from parent after place-on-map click
  export function setCoords(la, ln) {
    lat = la.toFixed(6);
    lng = ln.toFixed(6);
  }

  // Auto-fill is handled by SpeciesInput onselect callbacks

  function checkDbh(val) {
    const v = parseFloat(val);
    if (isNaN(v) || v <= 0) { dbhWarn = ''; return; }
    if (v < 0.5) dbhWarn = 'Unusually small — did you mean ' + (v * 10).toFixed(1) + '"?';
    else if (v > 80) dbhWarn = 'Unusually large for a street tree — double-check this value.';
    else if (v > 50) dbhWarn = 'Very large DBH — confirm this is correct.';
    else dbhWarn = '';
  }

  export async function lookupStreet() {
    const la = parseFloat(lat), lo = parseFloat(lng);
    if (isNaN(la) || isNaN(lo)) { streetStatus = 'Enter coordinates first'; return; }
    streetStatus = 'Detecting…';
    streetStatusColor = 'var(--parch-dim)';
    try {
      const pad = 0.003;
      const bbox = `${(la-pad).toFixed(4)},${(lo-pad).toFixed(4)},${(la+pad).toFixed(4)},${(lo+pad).toFixed(4)}`;
      const query = `[out:json][timeout:12];way["highway"]["name"](${bbox});out geom;`;
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', body: 'data=' + encodeURIComponent(query)
      });
      if (!resp.ok) throw new Error('Overpass error');
      const data = await resp.json();
      const cosLat = Math.cos(la * Math.PI / 180);
      let bestName = null, bestDist = Infinity;
      for (const el of data.elements) {
        if (el.type !== 'way' || !el.tags?.name || !el.geometry) continue;
        const pts = el.geometry;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const px = (lo - a.lon) * cosLat * 111320, py = (la - a.lat) * 111320;
          const dx = (b.lon - a.lon) * cosLat * 111320, dy = (b.lat - a.lat) * 111320;
          const lenSq = dx * dx + dy * dy;
          const t2 = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
          const d = Math.sqrt((px - t2 * dx) ** 2 + (py - t2 * dy) ** 2);
          if (d < bestDist) { bestDist = d; bestName = el.tags.name; }
        }
      }
      if (bestName && bestDist < 80) {
        street = bestName;
        streetStatus = `✓ ${Math.round(bestDist)}m away`;
        streetStatusColor = 'var(--canopy)';
      } else {
        streetStatus = bestName ? `nearest: ${bestName} (${Math.round(bestDist)}m — too far)` : 'no road found nearby';
        streetStatusColor = 'var(--parch-dim)';
      }
    } catch {
      streetStatus = 'lookup failed';
      streetStatusColor = 'var(--parch-dim)';
    }
  }

  function toggleObs(obs) {
    checkedObs = new Set(checkedObs);
    checkedObs.has(obs) ? checkedObs.delete(obs) : checkedObs.add(obs);
  }

  function buildManualDisplayId() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const mmddyy = `${mm}${dd}${yy}`;
    // Count trees already manually added today: pid format is MMDDYY-N (exactly one dash, no letters after dash)
    const pattern = new RegExp(`^${mmddyy}-\\d+$`);
    const countToday = get(trees).filter(t => t.pid && pattern.test(t.pid)).length;
    return `${mmddyy}-${countToday + 1}`;
  }

  async function save() {
    errMsg = '';
    if (!species) { errMsg = 'Please select a species.'; return; }
    if (!condition) { errMsg = 'Please select a condition.'; return; }
    if (!ageClass) { errMsg = 'Please select an age class.'; return; }
    if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) { errMsg = 'Please enter valid coordinates.'; return; }

    saving = true;
    try {
      const SB_URL = import.meta.env.VITE_SUPABASE_URL;
      const maxIdResp = await fetch(`${SB_URL}/rest/v1/trees?select=tree_id&order=tree_id.desc&limit=1`, { headers: SB_HDRS });
      if (!maxIdResp.ok) throw new Error('Could not fetch max tree ID.');
      const maxIdRows = await maxIdResp.json();
      const maxId = maxIdRows.length ? (parseInt(maxIdRows[0].tree_id) || 0) : 0;
      const nextId = maxId + 1;

      const displayId = buildManualDisplayId();
      const obs = [...checkedObs];
      const sbRow = {
        tree_id: nextId,
        common_name: species,
        scientific_name: sciName || null,
        age_class: ageClass,
        condition: condition,
        dbh1_in: parseFloat(dbh) || null,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        last_updated: dateVal || new Date().toISOString().slice(0, 10),
        tree_notes: notes || null,
        street_strata: street || null,
        observation_1: obs[0] || null,
        observation_2: obs[1] || null,
        observation_3: obs[2] || null,
        observation_4: obs[3] || null,
        observation_5: obs[4] || null,
        observation_6: obs[5] || null,
        survey_display_ids: [displayId],
        primary_survey_id: displayId,
      };

      const rows = await insertTrees([sbRow]);
      addTrees(rows);
      const newId = String(rows[0]?.tree_id || nextId);
      onClose?.();
      openTree(newId);
    } catch (e) {
      errMsg = 'Failed to save tree: ' + e.message;
    } finally {
      saving = false;
    }
  }
</script>

<div class="add-overlay" onclick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
  <div class="add-box">
    <div class="add-title">Add New Tree</div>
    {#if errMsg}
      <div class="add-err">{errMsg}</div>
    {/if}
    <div class="add-grid">
      <div class="add-field">
        <label class="add-lbl">Species (Common Name)</label>
        <SpeciesInput
          bind:value={species}
          options={$speciesList}
          placeholder="Search common name…"
          inputClass="add-inp"
          onselect={(v) => { if ($speciesMap.commonToSci[v]) sciName = $speciesMap.commonToSci[v]; }}
        />
      </div>
      <div class="add-field">
        <label class="add-lbl">Scientific Name</label>
        <SpeciesInput
          bind:value={sciName}
          options={$sciNamesList}
          placeholder="Search scientific name…"
          inputClass="add-inp"
          onselect={(v) => { if ($speciesMap.sciToCommon[v]) species = $speciesMap.sciToCommon[v]; }}
        />
      </div>
      <div class="add-field">
        <label class="add-lbl">Condition</label>
        <select class="add-inp" value={condition} onchange={(e) => { condition = e.target.value; }}>
          <option value="">— select —</option>
          <option>Good</option><option>Fair</option><option>Poor</option><option>Dead</option>
        </select>
      </div>
      <div class="add-field">
        <label class="add-lbl">Age Class</label>
        <select class="add-inp" value={ageClass} onchange={(e) => { ageClass = e.target.value; }}>
          <option value="">— select —</option>
          <option>Young</option><option>Semi-mature</option><option>Mature</option><option>Over-mature</option>
        </select>
      </div>
      <div class="add-field">
        <label class="add-lbl">DBH (inches)</label>
        <input class="add-inp" type="number" min="0" step="0.1" placeholder="e.g. 12.5"
          value={dbh} oninput={(e) => { dbh = e.target.value; checkDbh(e.target.value); }} />
        {#if dbhWarn}
          <div class="dbh-warn show">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>{dbhWarn}</span>
          </div>
        {/if}
      </div>
      <div class="add-field">
        <label class="add-lbl">Date Updated</label>
        <input class="add-inp" type="date" value={dateVal} oninput={(e) => { dateVal = e.target.value; }} />
      </div>
      <div class="add-field">
        <label class="add-lbl">Latitude</label>
        <input class="add-inp" type="number" step="any" placeholder="e.g. 44.5521"
          value={lat} oninput={(e) => { lat = e.target.value; }} />
      </div>
      <div class="add-field">
        <label class="add-lbl">Longitude</label>
        <input class="add-inp" type="number" step="any" placeholder="e.g. -69.6317"
          value={lng} oninput={(e) => { lng = e.target.value; }} />
      </div>
      <div class="add-field full" style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <span style="font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:var(--parch-dim)">— or —</span>
        <div style="display:flex;align-items:center;gap:8px;width:100%">
          <button type="button" class="place-map-btn" onclick={() => onPlaceMode?.()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Click & Place on Map
          </button>
          {#if placed}
            <div class="place-badge">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Placed
            </div>
          {/if}
        </div>
      </div>
      <div class="add-field full">
        <label class="add-lbl">Street <span style="font-size:.52rem;color:var(--parch-dim);font-weight:400;margin-left:4px">{streetStatus}</span></label>
        <div style="display:flex;gap:6px;align-items:center">
          <select class="add-inp" style="flex:1" value={street} onchange={(e) => { street = e.target.value; }}>
            <option value="">— none / unknown —</option>
            {#each $streetsList as st}
              <option value={st}>{st}</option>
            {/each}
            {#if street && !$streetsList.includes(street)}
              <option value={street}>{street} (new)</option>
            {/if}
          </select>
          <button type="button" class="at-lookup-btn" onclick={lookupStreet}>Auto-detect</button>
        </div>
      </div>
      <div class="add-field full">
        <label class="add-lbl">Observations</label>
        <div class="add-obs-grid">
          {#each _OB as obs}
            <label class="obs-cb">
              <input type="checkbox" checked={checkedObs.has(obs)} onchange={() => toggleObs(obs)} value={obs} />
              {obs}
            </label>
          {/each}
        </div>
      </div>
      <div class="add-field full">
        <label class="add-lbl">Notes</label>
        <textarea class="add-inp" rows="2" placeholder="Optional notes…" style="resize:vertical"
          value={notes} oninput={(e) => { notes = e.target.value; }}></textarea>
      </div>
    </div>
    <div class="add-btns">
      <button class="add-cancel" onclick={() => onClose?.()}>Cancel</button>
      <button class="add-save" onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Add Tree'}</button>
    </div>
  </div>
</div>

<style>
  .add-overlay{position:fixed;inset:0;z-index:7000;background:rgba(15,10,2,.7);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto;backdrop-filter:blur(2px)}
  .add-box{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:24px 22px;width:100%;max-width:560px;display:flex;flex-direction:column;gap:16px;animation:addIn .18s ease-out}
  @keyframes addIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
  .add-title{font-family:'Playfair Display',serif;font-size:1.15rem;color:var(--parch);text-align:center}
  .add-err{background:rgba(208,68,68,.12);border:1px solid rgba(208,68,68,.35);border-radius:5px;padding:8px 12px;font-size:.58rem;color:#d04444}
  .add-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .add-field{display:flex;flex-direction:column;gap:3px}
  .add-field.full{grid-column:1/-1}
  .add-lbl{font-size:.5rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);font-weight:600}
  :global(.add-inp){background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:7px 9px;font-family:'Outfit',sans-serif;font-size:.6rem;color:var(--parch);outline:none;transition:border-color .15s;width:100%;box-sizing:border-box}
  :global(.add-inp:focus){border-color:var(--gold)}
  :global(select.add-inp){appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23c9973a' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;padding-right:24px;cursor:pointer}
  .add-obs-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;max-height:180px;overflow-y:auto;padding:6px 0}
  .obs-cb{font-size:.55rem;color:var(--parch-dim);display:flex;align-items:center;gap:4px;cursor:pointer}
  .obs-cb input{margin:0}
  .dbh-warn{display:none;align-items:center;gap:4px;font-size:.52rem;color:#d4ae30;margin-top:2px}
  .dbh-warn.show{display:flex}
  .at-lookup-btn{background:transparent;border:1px solid rgba(201,151,58,.4);border-radius:3px;padding:4px 9px;font-family:'Outfit',sans-serif;font-size:.58rem;color:var(--gold);cursor:pointer;white-space:nowrap;flex-shrink:0}
  .at-lookup-btn:hover{background:rgba(201,151,58,.1)}
  .add-btns{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
  .add-cancel{background:transparent;border:1px solid var(--border);border-radius:4px;padding:7px 16px;font-family:'Outfit',sans-serif;font-size:.58rem;color:var(--parch-dim);cursor:pointer}
  .add-cancel:hover{border-color:var(--gold)}
  .add-save{background:var(--canopy);border:none;border-radius:4px;padding:7px 20px;font-family:'Outfit',sans-serif;font-size:.58rem;color:#fff;cursor:pointer}
  .add-save:hover{background:#1a5216}
  .add-save:disabled{opacity:.5;cursor:default}
  .place-map-btn{flex:1;background:transparent;border:1px solid rgba(143,198,127,.45);border-radius:4px;padding:6px 10px;font-family:'Outfit',sans-serif;font-size:.6rem;color:var(--canopy);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s}
  .place-map-btn:hover{background:rgba(143,198,127,.08);border-color:rgba(143,198,127,.7)}
  .place-badge{font-size:.54rem;color:var(--canopy);background:rgba(143,198,127,.1);border:1px solid rgba(143,198,127,.3);border-radius:4px;padding:4px 8px;white-space:nowrap;display:flex;align-items:center;gap:4px}
  @media(max-width:520px){.add-grid{grid-template-columns:1fr}.add-obs-grid{grid-template-columns:1fr}}
</style>

