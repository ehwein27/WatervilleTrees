<script>
  import {
    filterPanelOpen, selectedConds, selectedAges, selectedSpecies,
    selectedStreets, searchQuery, resetFilters, filteredTrees,
    speciesList, streetsList, selectedUploadInfo, eabOnly, openTree,
  } from '$lib/stores/ui.js';
  import { trees } from '$lib/stores/trees.js';

  const CONDITIONS = ['Good', 'Fair', 'Poor', 'Dead'];
  const AGES       = ['Young', 'Semi-mature', 'Mature', 'Over-mature'];
  /* keep in sync with --cond-* in app.css */
  const COND_COLOR = { Good: '#1a8c2a', Fair: '#d4860a', Poor: '#cc3300', Dead: '#6b1a1a' };

  let speciesSearch = $state('');
  let streetSearch  = $state('');
  let condOpen    = $state(true);
  let ageOpen     = $state(true);
  let speciesOpen = $state(false);
  let streetOpen  = $state(false);
  let searchFocused = $state(false);

  function toggle(store, val) {
    store.update(arr => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  let visibleSpecies = $derived(
    $speciesList.filter(s => !speciesSearch || s.toLowerCase().includes(speciesSearch.toLowerCase()))
  );
  let visibleStreets = $derived(
    $streetsList.filter(s => !streetSearch || s.toLowerCase().includes(streetSearch.toLowerCase()))
  );
  let activeCount = $derived(
    $selectedConds.length + $selectedAges.length + $selectedSpecies.length +
    $selectedStreets.length + ($searchQuery.trim() ? 1 : 0) + ($eabOnly ? 1 : 0)
  );

  // Dropdown: species names and individual trees matching the query by ID
  let dropdownSuggestions = $derived(() => {
    const q = $searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return { species: [], idTrees: [] };
    const matchingSpecies = $speciesList
      .filter(s => s.toLowerCase().includes(q))
      .slice(0, 8);
    const idTrees = $trees
      .filter(t => t.iids && t.iids.some(id => id.toLowerCase().includes(q)))
      .slice(0, 6);
    return { species: matchingSpecies, idTrees };
  });

  let showDropdown = $derived(
    searchFocused && $searchQuery.trim().length >= 2 &&
    (dropdownSuggestions.species.length > 0 || dropdownSuggestions.idTrees.length > 0)
  );

  function selectSpecies(sp) {
    selectedSpecies.update(arr => arr.includes(sp) ? arr : [...arr, sp]);
    searchQuery.set('');
  }

  function selectTree(t) {
    openTree(t.id);
    filterPanelOpen.set(false);
    searchQuery.set('');
  }
</script>

<div class="fp" class:open={$filterPanelOpen}>
  <div class="fp-hdr">
    <span class="fp-title">Filters{#if activeCount > 0}&nbsp;<span class="fp-badge">{activeCount}</span>{/if}</span>
    <button class="fp-close" onclick={() => filterPanelOpen.set(false)}>✕</button>
  </div>

  <div class="fp-body">
    <!-- Search -->
    <div class="fp-search-wrap" style="position:relative">
      <input class="fp-search" type="text" placeholder="Search by ID, species…"
        value={$searchQuery}
        oninput={(e) => searchQuery.set(e.target.value)}
        onfocus={() => searchFocused = true}
        onblur={() => setTimeout(() => { searchFocused = false; }, 150)} />
      {#if showDropdown}
        <div class="fp-dropdown">
          {#if dropdownSuggestions.species.length > 0}
            <div class="fp-dd-section">Species</div>
            {#each dropdownSuggestions.species as sp}
              <button class="fp-dd-item" onmousedown={() => selectSpecies(sp)}>
                <span class="fp-dd-icon">🌿</span>{sp}
              </button>
            {/each}
          {/if}
          {#if dropdownSuggestions.idTrees.length > 0}
            <div class="fp-dd-section">Trees by ID</div>
            {#each dropdownSuggestions.idTrees as t}
              <button class="fp-dd-item" onmousedown={() => selectTree(t)}>
                <span class="fp-dd-id">{t.pid || t.iids[0]}</span>
                <span class="fp-dd-name">{t.n || '—'}{t.st ? ' · ' + t.st : ''}</span>
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <!-- EAB Risk -->
    <div class="fp-sec">
      <label class="fp-item" style="padding:9px 12px">
        <input type="checkbox" bind:checked={$eabOnly} />
        <span class="fp-dot" style="background:var(--red)"></span>
        <span class="fp-lbl">EAB Risk only</span>
        {#if $eabOnly}<span class="fp-badge">on</span>{/if}
      </label>
    </div>

    <!-- Condition -->
    <div class="fp-sec">
      <button class="fp-sec-hdr" onclick={() => condOpen = !condOpen}>
        <span>Condition</span>
        <span class="fp-sec-right">
          {#if $selectedConds.length}<span class="fp-badge">{$selectedConds.length}</span>{/if}
          <span class="fp-chevron" class:rotated={condOpen}>›</span>
        </span>
      </button>
      {#if condOpen}
        <div class="fp-items">
          {#each CONDITIONS as c}
            <label class="fp-item">
              <input type="checkbox" checked={$selectedConds.includes(c)} onchange={() => toggle(selectedConds, c)} />
              <span class="fp-dot" style="background:{COND_COLOR[c]}"></span>
              <span class="fp-lbl">{c}</span>
            </label>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Age Class -->
    <div class="fp-sec">
      <button class="fp-sec-hdr" onclick={() => ageOpen = !ageOpen}>
        <span>Age Class</span>
        <span class="fp-sec-right">
          {#if $selectedAges.length}<span class="fp-badge">{$selectedAges.length}</span>{/if}
          <span class="fp-chevron" class:rotated={ageOpen}>›</span>
        </span>
      </button>
      {#if ageOpen}
        <div class="fp-items">
          {#each AGES as a}
            <label class="fp-item">
              <input type="checkbox" checked={$selectedAges.includes(a)} onchange={() => toggle(selectedAges, a)} />
              <span class="fp-lbl">{a}</span>
            </label>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Species -->
    <div class="fp-sec">
      <button class="fp-sec-hdr" onclick={() => speciesOpen = !speciesOpen}>
        <span>Species</span>
        <span class="fp-sec-right">
          {#if $selectedSpecies.length}<span class="fp-badge">{$selectedSpecies.length}</span>{/if}
          <span class="fp-chevron" class:rotated={speciesOpen}>›</span>
        </span>
      </button>
      {#if speciesOpen}
        <div class="fp-subsearch">
          <input class="fp-search fp-search-sm" type="text" placeholder="Search species…" bind:value={speciesSearch} />
        </div>
        <div class="fp-items fp-scroll">
          {#each visibleSpecies as s}
            <label class="fp-item">
              <input type="checkbox" checked={$selectedSpecies.includes(s)} onchange={() => toggle(selectedSpecies, s)} />
              <span class="fp-lbl">{s}</span>
            </label>
          {:else}
            <span class="fp-empty">No matches</span>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Street -->
    <div class="fp-sec">
      <button class="fp-sec-hdr" onclick={() => streetOpen = !streetOpen}>
        <span>Street</span>
        <span class="fp-sec-right">
          {#if $selectedStreets.length}<span class="fp-badge">{$selectedStreets.length}</span>{/if}
          <span class="fp-chevron" class:rotated={streetOpen}>›</span>
        </span>
      </button>
      {#if streetOpen}
        <div class="fp-subsearch">
          <input class="fp-search fp-search-sm" type="text" placeholder="Search streets…" bind:value={streetSearch} />
        </div>
        <div class="fp-items fp-scroll">
          {#each visibleStreets as s}
            <label class="fp-item">
              <input type="checkbox" checked={$selectedStreets.includes(s)} onchange={() => toggle(selectedStreets, s)} />
              <span class="fp-lbl">{s}</span>
            </label>
          {:else}
            <span class="fp-empty">No matches</span>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Upload info (read-only) -->
    {#if $selectedUploadInfo}
      <div class="fp-sec">
        <div class="fp-sec-hdr" style="cursor:default">
          <span>Inventory</span>
        </div>
        <div class="fp-items">
          <div class="fp-upload-row">
            <span class="fp-lbl" style="font-style:italic">{$selectedUploadInfo}</span>
            <button class="fp-upload-clear" onclick={() => selectedUploadInfo.set('')}>✕</button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div class="fp-footer">
    <button class="fp-reset" onclick={resetFilters}>↺ Reset</button>
    <span class="fp-count">{$filteredTrees.length} shown</span>
  </div>
</div>

<style>
  .fp {
    position: fixed;
    top: var(--header-h, 49px); right: 0; bottom: 0;
    width: 240px;
    background: var(--panel);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform .28s cubic-bezier(.4,0,.2,1);
    z-index: 20;
    pointer-events: none;
  }
  .fp.open {
    transform: translateX(0);
    pointer-events: auto;
  }

  /* Header */
  .fp-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .fp-title {
    font-size: .62rem;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--gold);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .fp-close {
    background: transparent;
    border: none;
    color: var(--parch-dim);
    cursor: pointer;
    font-size: .75rem;
    padding: 2px 4px;
    line-height: 1;
    transition: color .13s;
  }
  .fp-close:hover { color: var(--parch); }

  /* Scrollable body */
  .fp-body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .fp-body::-webkit-scrollbar { width: 4px; }
  .fp-body::-webkit-scrollbar-track { background: transparent; }
  .fp-body::-webkit-scrollbar-thumb { background: rgba(201,151,58,.2); border-radius: 2px; }

  /* Search */
  .fp-search-wrap {
    padding: 10px 12px 6px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .fp-search {
    width: 100%;
    background: var(--panel2);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 5px 8px;
    font-family: 'DM Mono', monospace;
    font-size: .62rem;
    color: var(--parch);
    outline: none;
    transition: border-color .13s;
  }
  .fp-search::placeholder { color: var(--parch-dim); }
  .fp-search:focus { border-color: var(--gold); }
  .fp-search-sm { font-size: .65rem; padding: 4px 7px; }

  /* Sections */
  .fp-sec {
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .fp-sec-hdr {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: transparent;
    border: none;
    color: var(--parch);
    font-family: 'DM Mono', monospace;
    font-size: .6rem;
    font-weight: 500;
    padding: 9px 12px;
    cursor: pointer;
    text-align: left;
    transition: background .1s;
    letter-spacing: .04em;
  }
  .fp-sec-hdr:hover { background: rgba(201,151,58,.06); }
  .fp-sec-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .fp-chevron {
    color: var(--parch-dim);
    font-size: .7rem;
    transition: transform .18s;
    display: inline-block;
  }
  .fp-chevron.rotated { transform: rotate(90deg); }

  /* Badge */
  .fp-badge {
    background: var(--gold);
    color: var(--bark);
    border-radius: 8px;
    font-size: .65rem;
    font-weight: 700;
    padding: 1px 5px;
    letter-spacing: 0;
    font-family: 'DM Mono', monospace;
  }

  /* Item list */
  .fp-subsearch { padding: 4px 12px 4px; }
  .fp-items { padding: 4px 12px 8px; display: flex; flex-direction: column; gap: 1px; }
  .fp-scroll { max-height: 200px; overflow-y: auto; }
  .fp-scroll::-webkit-scrollbar { width: 3px; }
  .fp-scroll::-webkit-scrollbar-thumb { background: rgba(201,151,58,.2); border-radius: 2px; }

  .fp-item {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 3px 4px;
    border-radius: 3px;
    cursor: pointer;
    transition: background .1s;
  }
  .fp-item:hover { background: rgba(201,151,58,.08); }
  .fp-item input[type=checkbox] {
    accent-color: var(--gold);
    width: 12px;
    height: 12px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .fp-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .fp-lbl {
    font-size: .6rem;
    color: var(--parch);
    line-height: 1.3;
    cursor: pointer;
  }
  .fp-empty {
    font-size: .65rem;
    color: var(--parch-dim);
    font-style: italic;
    padding: 4px 0;
  }

  /* Upload info clear */
  .fp-upload-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 2px 0;
  }
  .fp-upload-clear {
    background: none;
    border: none;
    color: var(--parch-dim);
    cursor: pointer;
    font-size: .6rem;
    padding: 0 2px;
    flex-shrink: 0;
    transition: color .1s;
  }
  .fp-upload-clear:hover { color: var(--parch); }

  /* Footer */
  .fp-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .fp-reset {
    background: transparent;
    border: 1px solid rgba(201,151,58,.35);
    border-radius: 3px;
    padding: 4px 12px;
    font-family: 'DM Mono', monospace;
    font-size: .6rem;
    color: var(--gold);
    cursor: pointer;
    transition: background .13s;
  }
  .fp-reset:hover { background: var(--gold-hi); }
  .fp-count {
    font-size: .65rem;
    color: var(--parch-dim);
    white-space: nowrap;
  }

  /* Search dropdown */
  .fp-dropdown {
    position: absolute;
    top: calc(100% + 2px);
    left: 12px; right: 12px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 4px;
    box-shadow: 0 4px 16px rgba(0,0,0,.18);
    z-index: 50;
    overflow: hidden;
  }
  .fp-dd-section {
    font-size: .48rem;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--gold);
    padding: 5px 10px 3px;
    background: var(--panel2);
    font-weight: 600;
  }
  .fp-dd-item {
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: 100%;
    padding: 5px 10px;
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background .1s;
    font-family: 'DM Mono', monospace;
    font-size: .6rem;
    color: var(--parch);
  }
  .fp-dd-item:hover { background: rgba(201,151,58,.1); }
  .fp-dd-icon { font-size: .7rem; flex-shrink: 0; }
  .fp-dd-id {
    color: var(--gold);
    font-weight: 600;
    flex-shrink: 0;
  }
  .fp-dd-name {
    color: var(--parch-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
