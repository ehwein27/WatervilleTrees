<script>
  import { selectedTree, editingTree, speciesList, sciNamesList, streetsList, speciesMap } from '$lib/stores/ui.js';
  import { trees, treesById, updateTree } from '$lib/stores/trees.js';
  import { sbSet } from '$lib/api/supabase.js';
  import { currentUser } from '$lib/stores/auth.js';
  import { calcITree } from '$lib/utils/itree.js';
  import SpeciesInput from '$lib/components/SpeciesInput.svelte';

  const OBSERVATIONS = [
    "Broken branch(s)","Buried root collar","Cavity-branch","Cavity-stem","Cavity-suspected",
    "Co-dominant stems","Co-dominant stems (11)","Co-dominant stems (2)","Co-dominant stems (4)",
    "Crack-branch","Crack-stem","Dead branches <=2","Dead branches >2","Dead/dying stem",
    "Dieback (moderate)","Dieback (severe)","Environmental conditions","Fungi/conks",
    "Girdling material","Girdling roots present","Girdling roots present (moderate)",
    "Girdling roots present (severe)","Girdling roots suspected","Good form","Good vigor",
    "Growing against object","Hanger","Included bark","Lion tailing","Low live crown ratio",
    "Low vigor","Overextended branch","Pavement/curbing damage","Poor branch structure","Rib",
    "Road clearance","Seam","Sidewalk lifting-major","Sidewalk lifting-minor","Suppressed",
    "Sweep","Topping/heading cuts","Uneven crown","Wound-branch","Wound-root flare","Wound-stem"
  ];

  const AGE_CLASSES = ['Young','Semi-mature','Mature','Over-mature'];
  const CONDITIONS = ['Good','Fair','Poor','Dead'];

  const DIST_TO_WATER_OPTIONS = ["<25'", "25-250'", ">250'"];

  let t = $selectedTree;
  let name = t.n;
  let sci = t.s;
  let condition = t.c;
  let ageClass = t.a;
  let dbh = t.d || '';
  let street = t.st || '';
  let obs = new Set(t.o || []);
  let btmNests = t.bm != null ? String(t.bm) : '';
  let distToWater = t.dw || '';
  let uploadInfo = t.ui || '';
  let plantingDate = t.pd || '';
  let ageAtPlanting = t.ap || '';
  let infestation = t.inf || '';
  let protectionNotes = t.pn || '';
  let companionPlants = t.cp || '';
  let treeSteward = t.ts || '';
  let saving = $state(false);
  let error = $state('');
  let dbhWarn = $state('');
  let toastVisible = $state(false);
  let toastQueued = $state(false);
  let toastTimer;
  let prevSnapshot = null;

  function checkDbh(val) {
    const d = parseFloat(val);
    if (!d) { dbhWarn = ''; return; }
    if (d > 60) dbhWarn = 'DBH over 60″ is unusual — double-check.';
    else if (d > 40) dbhWarn = 'DBH over 40″ is large — verify.';
    else dbhWarn = '';
  }

  function toggleObs(o) {
    obs = new Set(obs);
    obs.has(o) ? obs.delete(o) : obs.add(o);
  }

  function onSpeciesChange(val) {
    const map = $speciesMap;
    if (map.commonToSci[val]) sci = map.commonToSci[val];
  }

  function onSciChange(val) {
    const map = $speciesMap;
    if (map.sciToCommon[val]) name = map.sciToCommon[val];
  }

  function cancel() {
    editingTree.set(false);
  }

  function showToast() {
    toastVisible = true;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastVisible = false; prevSnapshot = null; }, 8000);
  }

  async function undo() {
    if (!prevSnapshot) return;
    const snap = prevSnapshot;
    const undoPatch = {
      common_name: snap.n,
      scientific_name: snap.s || null,
      condition: snap.c,
      age_class: snap.a,
      dbh1_in: snap.d || null,
      street_strata: snap.st || null,
      observation_1: snap.o?.[0] || null,
      observation_2: snap.o?.[1] || null,
      observation_3: snap.o?.[2] || null,
      observation_4: snap.o?.[3] || null,
      observation_5: snap.o?.[4] || null,
      observation_6: snap.o?.[5] || null,
      last_updated: snap.u || null,
      btm_nests: snap.bm ?? null,
      distance_to_water: snap.dw || null,
      upload_information: snap.ui || null,
      planting_date:       snap.pd  || null,
      age_at_planting:     snap.ap  || null,
      infestation_disease: snap.inf || null,
      protection_notes:    snap.pn  || null,
      companion_plants:    snap.cp  || null,
      tree_steward:        snap.ts  || null,
    };
    try {
      await updateTree(snap.id, undoPatch);
      trees.update($trees =>
        $trees.map(tr => tr.id === snap.id ? { ...tr, ...snap } : tr)
      );
      treesById.update($byId => {
        if ($byId[snap.id]) $byId[snap.id] = { ...$byId[snap.id], ...snap };
        return $byId;
      });
    } catch (e) { console.error('Undo failed', e); }
    toastVisible = false;
    prevSnapshot = null;
    clearTimeout(toastTimer);
  }

  async function save() {
    if (!name) { error = 'Species is required.'; return; }
    saving = true;
    error = '';

    const obsArr = [...obs];
    const d = parseFloat(dbh) || null;
    const parsedBtmNests = btmNests !== '' ? parseInt(btmNests, 10) : null;
    const patch = {
      common_name: name,
      scientific_name: sci || null,
      condition,
      age_class: ageClass,
      dbh1_in: d,
      street_strata: street || null,
      observation_1: obsArr[0] || null,
      observation_2: obsArr[1] || null,
      observation_3: obsArr[2] || null,
      observation_4: obsArr[3] || null,
      observation_5: obsArr[4] || null,
      observation_6: obsArr[5] || null,
      last_updated: new Date().toISOString().slice(0, 10),
      btm_nests: isNaN(parsedBtmNests) ? null : parsedBtmNests,
      distance_to_water: distToWater || null,
      upload_information: uploadInfo || null,
      planting_date:       plantingDate       || null,
      age_at_planting:     ageAtPlanting      || null,
      infestation_disease: infestation        || null,
      protection_notes:    protectionNotes    || null,
      companion_plants:    companionPlants    || null,
      tree_steward:        treeSteward        || null,
    };

    // Snapshot for undo
    prevSnapshot = { ...t };
    const result = await updateTree(t.id, patch);

    if (navigator.onLine) {
      try {
        await sbSet('tedit:' + t.id, JSON.stringify({ by: $currentUser?.username || 'unknown', at: patch.last_updated }));
      } catch {}
    }

    const iv = calcITree(d, condition);
    const localPatch = {
      n: name, s: sci, c: condition, a: ageClass, d, st: street,
      o: obsArr,
      u: patch.last_updated,
      vt: iv?.[0], vc: iv?.[1], va: iv?.[2], vs: iv?.[3], ve: iv?.[4],
      bm: patch.btm_nests,
      dw: patch.distance_to_water || '',
      ui: patch.upload_information || '',
      pd:  patch.planting_date       || '',
      ap:  patch.age_at_planting     || '',
      inf: patch.infestation_disease || '',
      pn:  patch.protection_notes    || '',
      cp:  patch.companion_plants    || '',
      ts:  patch.tree_steward        || '',
    };
    trees.update($trees =>
      $trees.map(tr => tr.id === t.id ? { ...tr, ...localPatch } : tr)
    );
    treesById.update($byId => {
      if ($byId[t.id]) $byId[t.id] = { ...$byId[t.id], ...localPatch };
      return $byId;
    });
    editingTree.set(false);

    if (result.queued) {
      toastQueued = true;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastQueued = false; }, 8000);
    } else {
      showToast();
    }

    saving = false;
  }
</script>

<div id="sb-inner" class="sb-anim">
  <div class="sb-hdr">
    <div style="display:flex;align-items:center">
      <button class="sb-back-mobile" onclick={() => editingTree.set(false)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Cancel
      </button>
      <div>
        <div class="sb-name">Edit {t.pid || ('#' + t.id)}</div>
        <div class="sb-sub">{t.n}</div>
      </div>
    </div>
    <button class="sb-close" onclick={() => editingTree.set(false)}>✕</button>
  </div>
  <div class="sb-body">
    <div class="sb-edit-form">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="sb-edit-row">
          <div class="sb-edit-lbl">Common Name</div>
          <SpeciesInput
            bind:value={name}
            options={$speciesList}
            placeholder="Search common name…"
            inputClass="sb-edit-inp"
            onselect={(v) => onSpeciesChange(v)}
          />
        </div>
        <div class="sb-edit-row">
          <div class="sb-edit-lbl">Scientific Name</div>
          <SpeciesInput
            bind:value={sci}
            options={$sciNamesList}
            placeholder="Search scientific name…"
            inputClass="sb-edit-inp"
            onselect={(v) => onSciChange(v)}
          />
        </div>
        <div class="sb-edit-row">
          <div class="sb-edit-lbl">Condition</div>
          <select class="sb-edit-sel" bind:value={condition}>
            {#each CONDITIONS as c}
              <option>{c}</option>
            {/each}
          </select>
        </div>
        <div class="sb-edit-row">
          <div class="sb-edit-lbl">Age Class</div>
          <select class="sb-edit-sel" bind:value={ageClass}>
            {#each AGE_CLASSES as a}
              <option>{a}</option>
            {/each}
          </select>
        </div>
        <div class="sb-edit-row">
          <div class="sb-edit-lbl">DBH (inches)</div>
          <input type="number" class="sb-edit-inp" min="0" step="0.1"
            bind:value={dbh} oninput={(e) => checkDbh(e.target.value)} />
          {#if dbhWarn}
            <div class="dbh-warn">⚠ {dbhWarn}</div>
          {/if}
        </div>
        <div class="sb-edit-row">
          <div class="sb-edit-lbl">Street</div>
          <select class="sb-edit-sel" bind:value={street}>
            <option value="">— none —</option>
            {#each $streetsList as s}
              <option value={s}>{s}</option>
            {/each}
          </select>
        </div>
        <div class="sb-edit-row">
          <div class="sb-edit-lbl">Termite Nests</div>
          <input type="number" class="sb-edit-inp" min="0" step="1" bind:value={btmNests} placeholder="—" />
        </div>
        <div class="sb-edit-row">
          <div class="sb-edit-lbl">Dist. to Water</div>
          <select class="sb-edit-sel" bind:value={distToWater}>
            <option value="">—</option>
            {#each DIST_TO_WATER_OPTIONS as opt}
              <option value={opt}>{opt}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="sb-edit-row">
        <div class="sb-edit-lbl">Survey Source</div>
        <input type="text" class="sb-edit-inp" bind:value={uploadInfo} placeholder="—" />
      </div>
      <!-- ── New fields ─────────────────────────────────────────────── -->
      <div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
        <div style="font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:8px">Planting & Stewardship</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="sb-edit-row">
            <div class="sb-edit-lbl">Date of Planting</div>
            <input type="date" class="sb-edit-inp" bind:value={plantingDate} />
          </div>
          <div class="sb-edit-row">
            <div class="sb-edit-lbl">Age When Planted</div>
            <input type="text" class="sb-edit-inp" bind:value={ageAtPlanting} placeholder="e.g. 2 years" />
          </div>
          <div class="sb-edit-row">
            <div class="sb-edit-lbl">Tree Steward</div>
            <input type="text" class="sb-edit-inp" bind:value={treeSteward} placeholder="Name or org" />
          </div>
          <div class="sb-edit-row">
            <div class="sb-edit-lbl">Companion Plants</div>
            <input type="text" class="sb-edit-inp" bind:value={companionPlants} placeholder="e.g. hostas, ferns" />
          </div>
        </div>
        <div class="sb-edit-row" style="margin-top:6px">
          <div class="sb-edit-lbl">Infestation / Disease</div>
          <input type="text" class="sb-edit-inp" bind:value={infestation} placeholder="e.g. aphids, fire blight" />
        </div>
        <div class="sb-edit-row" style="margin-top:6px">
          <div class="sb-edit-lbl">Protection / Fencing Notes</div>
          <input type="text" class="sb-edit-inp" bind:value={protectionNotes} placeholder="e.g. tree guard installed 2024" />
        </div>
      </div>
      <div class="sb-edit-row">
        <div class="sb-edit-lbl">Observations</div>
        <div class="sb-edit-obs">
          {#each OBSERVATIONS as o}
            <label>
              <input type="checkbox" checked={obs.has(o)} onchange={() => toggleObs(o)} />
              {o}
            </label>
          {/each}
        </div>
      </div>
      <div style="display:flex;gap:7px;margin-top:4px">
        <button class="add-save" style="flex:1;font-size:.6rem;padding:6px"
          onclick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button class="add-cancel" style="font-size:.6rem;padding:6px 12px"
          onclick={cancel}>Cancel</button>
      </div>
      {#if error}
        <div style="font-size:.58rem;color:var(--red);margin-top:2px">{error}</div>
      {/if}
    </div>
  </div>
</div>

{#if toastVisible}
  <div class="edit-toast">
    <span>Changes saved.</span>
    <button class="edit-toast-undo" onclick={undo}>Undo</button>
  </div>
{/if}

{#if toastQueued}
  <div class="edit-toast" style="border-color:rgba(201,151,58,.5)">
    <span>Saved locally — will sync when back online.</span>
  </div>
{/if}

<style>
  .edit-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9000;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px 16px;font-family:'DM Mono',monospace;font-size:.6rem;color:var(--parch);display:flex;align-items:center;gap:12px;box-shadow:0 4px 20px rgba(0,0,0,.5);animation:toastIn .2s ease-out}
  .edit-toast-undo{background:transparent;border:1px solid var(--gold);border-radius:3px;padding:3px 10px;font-family:'DM Mono',monospace;font-size:.56rem;color:var(--gold);cursor:pointer;transition:all .13s}
  .edit-toast-undo:hover{background:rgba(201,151,58,.15)}
  @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
</style>
