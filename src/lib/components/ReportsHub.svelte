<script>
  import { currentPage, menuOpen, speciesList, streetsList } from '$lib/stores/ui.js';
  import { currentUser, authOpen } from '$lib/stores/auth.js';

  const MODAL = {
    RISK:        'risk',
    COST:        'cost',
    REMOVAL:     'removal',
    WORKORDER:   'workorder',
    EAB:         'eab',
    DEAD:        'dead',
    ADD_TREE:    'add-tree',
    BULK_COND:   'bulk-cond',
    BULK_ADD:    'bulk-add',
    PROSPECTIVE: 'prospective-planting',
  };

  function toSlug(s) {
    return s.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  let { onAction = () => {} } = $props();

  let open = $state(false);
  let view = $state('main'); // 'main' | 'sdr'
  let activeCategory = $state(null); // key of the expanded category

  function toggleCategory(key) {
    activeCategory = activeCategory === key ? null : key;
  }

  export function show() { open = true; view = 'main'; }
  export function hide() { open = false; }

  function card(action) {
    open = false;
    onAction(action);
  }

  function guardAuth(action) {
    if (!$currentUser) { authOpen.set(true); return; }
    card(action);
  }
</script>

<div class="rh-panel" class:open>
  <div class="rh-hdr">
    <div class="rh-title">Reports &amp; Tasks</div>
    <div style="display:flex;align-items:center;gap:6px">
      <button class="rh-close" onclick={() => open = false}>✕</button>
    </div>
  </div>

    {#if view === 'main'}
      <div class="rh-body">
        <div class="rh-section-lbl">Reports</div>

        <button class="rh-card" onclick={() => card(MODAL.RISK)}>
          <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <div class="rh-info"><div class="rh-name">Tree Health &amp; Priority Report</div><div class="rh-desc">Priority scores, critical trees, dead trees, and EAB flags across your inventory</div></div>
          <span class="rh-arrow">›</span>
        </button>

        <button class="rh-card" onclick={() => card(MODAL.COST)}>
          <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg></div>
          <div class="rh-info"><div class="rh-name">Removal Cost Estimate</div><div class="rh-desc">Budget projections using your actual contractor rates by DBH size class</div></div>
          <span class="rh-arrow">›</span>
        </button>

        <button class="rh-card" onclick={() => view = 'sdr'}>
          <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg></div>
          <div class="rh-info"><div class="rh-name">Stand Dynamic Reports</div><div class="rh-desc">Browse live inventory reports organized by condition, species, age class, location, and i-Tree value</div></div>
          <span class="rh-arrow">›</span>
        </button>

        <div class="rh-section-lbl" style="margin-top:6px">Tasks</div>

        <button class="rh-card" onclick={() => card(MODAL.REMOVAL)}>
          <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></div>
          <div class="rh-info"><div class="rh-name">Removal Lists</div><div class="rh-desc">Create and manage tree removal lists, highlight selections on the map, and export to a list</div></div>
          <span class="rh-arrow">›</span>
        </button>

        <button class="rh-card" onclick={() => card(MODAL.BULK_COND)}>
          <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
          <div class="rh-info"><div class="rh-name">Bulk Condition Update</div><div class="rh-desc">Select multiple trees on the map and update their condition rating in one action</div></div>
          <span class="rh-arrow">›</span>
        </button>

        <button class="rh-card" onclick={() => card(MODAL.BULK_ADD)}>
          <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
          <div class="rh-info"><div class="rh-name">Bulk Add Trees</div><div class="rh-desc">Download the template, fill in addresses and details, then upload to add multiple trees at once</div></div>
          <span class="rh-arrow">›</span>
        </button>

        <button class="rh-card" onclick={() => card(MODAL.PROSPECTIVE)}>
          <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V12"/><path d="M12 12C12 12 7 9 7 5a5 5 0 0 1 10 0c0 4-5 7-5 7z"/><path d="M12 12c0 0-5 3-5 7"/><path d="M12 12c0 0 5 3 5 7"/><line x1="3" y1="22" x2="21" y2="22"/></svg></div>
          <div class="rh-info"><div class="rh-name">Prospective Planting</div><div class="rh-desc">Plan future tree plantings by species and priority, generate a report, and convert to a Bulk Add upload when ready</div></div>
          <span class="rh-arrow">›</span>
        </button>

        <div class="rh-section-lbl" style="margin-top:6px">Work Orders</div>

        <button class="rh-card" onclick={() => card(MODAL.WORKORDER)}>
          <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
          <div class="rh-info"><div class="rh-name">Work Order</div><div class="rh-desc">Build street-by-street work orders, assign tasks, and track completion</div></div>
          <span class="rh-arrow">›</span>
        </button>
      </div>

    {:else if view === 'sdr'}
      <div class="rh-body">
        <button class="rh-back" onclick={() => { view = 'main'; activeCategory = null; }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back
        </button>

        <div class="rh-section-lbl" style="margin-top:2px">Stand Dynamic Reports</div>

        <!-- By Condition -->
        <div class="sdr-cat" class:sdr-active={activeCategory === 'condition'}>
          <button class="rh-card sdr-card" onclick={() => toggleCategory('condition')}>
            <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
            <div class="rh-info"><div class="rh-name">By Condition</div><div class="rh-desc">Good, Fair, Poor, and Dead tree populations</div></div>
            <svg class="sdr-chevron" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {#if activeCategory === 'condition'}
            <div class="sdr-sub">
              <a class="sdr-sub-item" href="/reports/condition-good" target="_blank" rel="noopener">Good</a>
              <a class="sdr-sub-item" href="/reports/condition-fair" target="_blank" rel="noopener">Fair</a>
              <a class="sdr-sub-item" href="/reports/condition-poor" target="_blank" rel="noopener">Poor</a>
              <a class="sdr-sub-item" href="/reports/condition-dead" target="_blank" rel="noopener">Dead</a>
            </div>
          {/if}
        </div>

        <!-- By Age Class -->
        <div class="sdr-cat" class:sdr-active={activeCategory === 'age'}>
          <button class="rh-card sdr-card" onclick={() => toggleCategory('age')}>
            <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
            <div class="rh-info"><div class="rh-name">By Age Class</div><div class="rh-desc">Young, Semi-mature, Mature, and Over-mature stands</div></div>
            <svg class="sdr-chevron" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {#if activeCategory === 'age'}
            <div class="sdr-sub">
              <a class="sdr-sub-item" href="/reports/age-young"       target="_blank" rel="noopener">Young</a>
              <a class="sdr-sub-item" href="/reports/age-semi-mature" target="_blank" rel="noopener">Semi-mature</a>
              <a class="sdr-sub-item" href="/reports/age-mature"      target="_blank" rel="noopener">Mature</a>
              <a class="sdr-sub-item" href="/reports/age-over-mature" target="_blank" rel="noopener">Over-mature</a>
            </div>
          {/if}
        </div>

        <!-- By Species -->
        <div class="sdr-cat" class:sdr-active={activeCategory === 'species'}>
          <button class="rh-card sdr-card" onclick={() => toggleCategory('species')}>
            <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21"/><path d="M9.5 9.5C9.5 9.5 10 14 12 16c2 2 5.9 3.5 5.9 3.5"/><path d="M14.5 5.5S14 11 12 13C10 15 6.1 16.5 6.1 16.5"/><path d="M20.9 3.1C20.9 3.1 22 10 19 14c-3 4-9 6-9 6"/></svg></div>
            <div class="rh-info"><div class="rh-name">By Species</div><div class="rh-desc">Individual reports for each species in the inventory</div></div>
            <svg class="sdr-chevron" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {#if activeCategory === 'species'}
            <div class="sdr-sub sdr-sub-scroll">
              {#each $speciesList as sp}
                <a class="sdr-sub-item" href="/reports/species-{toSlug(sp)}" target="_blank" rel="noopener">{sp}</a>
              {/each}
            </div>
          {/if}
        </div>

        <!-- By Location -->
        <div class="sdr-cat" class:sdr-active={activeCategory === 'location'}>
          <button class="rh-card sdr-card" onclick={() => toggleCategory('location')}>
            <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
            <div class="rh-info"><div class="rh-name">By Location</div><div class="rh-desc">Street-by-street inventory breakdowns</div></div>
            <svg class="sdr-chevron" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {#if activeCategory === 'location'}
            <div class="sdr-sub sdr-sub-scroll">
              {#each $streetsList as st}
                <a class="sdr-sub-item" href="/reports/location-{toSlug(st)}" target="_blank" rel="noopener">{st}</a>
              {/each}
            </div>
          {/if}
        </div>

        <!-- By i-Tree Value -->
        <div class="sdr-cat" class:sdr-active={activeCategory === 'value'}>
          <button class="rh-card sdr-card" onclick={() => toggleCategory('value')}>
            <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
            <div class="rh-info"><div class="rh-name">By i-Tree Value</div><div class="rh-desc">High, Medium, and Low ecosystem service tiers</div></div>
            <svg class="sdr-chevron" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {#if activeCategory === 'value'}
            <div class="sdr-sub">
              <a class="sdr-sub-item" href="/reports/value-high"   target="_blank" rel="noopener">High <span class="sdr-sub-meta">&gt;$150/yr</span></a>
              <a class="sdr-sub-item" href="/reports/value-medium" target="_blank" rel="noopener">Medium <span class="sdr-sub-meta">$75–150/yr</span></a>
              <a class="sdr-sub-item" href="/reports/value-low"    target="_blank" rel="noopener">Low <span class="sdr-sub-meta">&lt;$75/yr</span></a>
            </div>
          {/if}
        </div>

        <!-- EAB Risk -->
        <div class="sdr-cat" class:sdr-active={activeCategory === 'eab'}>
          <button class="rh-card sdr-card" onclick={() => toggleCategory('eab')}>
            <div class="rh-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l1.5 1.5"/><path d="M14.5 3.5L16 2"/><path d="M9 7.5a4 4 0 0 0-1 7.5H8v4a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-4h-.05a4 4 0 0 0-1-7.45Z"/><path d="M4 13.5h4"/><path d="M16 13.5h4"/><path d="M4 9.5l3.5 2"/><path d="M16.5 11.5L20 9.5"/><path d="M4 17.5l3.5-2"/><path d="M16.5 15.5L20 17.5"/></svg></div>
            <div class="rh-info"><div class="rh-name">EAB Risk</div><div class="rh-desc">All ash trees vulnerable to Emerald Ash Borer</div></div>
            <svg class="sdr-chevron" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {#if activeCategory === 'eab'}
            <div class="sdr-sub">
              <a class="sdr-sub-item" href="/reports/eab-risk" target="_blank" rel="noopener">EAB Risk Report</a>
            </div>
          {/if}
        </div>

        <!-- Dead Tree Cemetery -->
        <div class="sdr-cat sdr-cat-cemetery" class:sdr-active={activeCategory === 'cemetery'}>
          <button class="rh-card sdr-card sdr-card-cemetery" onclick={() => toggleCategory('cemetery')}>
            <div class="rh-icon sdr-icon-cemetery"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="14" rx="2"/><path d="M12 6v6"/><path d="M9 9h6"/><path d="M3 22h18"/><path d="M6 16v6"/><path d="M18 16v6"/></svg></div>
            <div class="rh-info"><div class="rh-name">Dead Tree Cemetery</div><div class="rh-desc">Full record of all trees logged as Dead</div></div>
            <svg class="sdr-chevron" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {#if activeCategory === 'cemetery'}
            <div class="sdr-sub">
              <a class="sdr-sub-item sdr-sub-cemetery" href="/reports/dead-trees" target="_blank" rel="noopener">All Removed Trees</a>
            </div>
          {/if}
        </div>

      </div>
    {/if}
</div>

<style>
  .rh-panel{position:fixed;left:0;top:0;bottom:0;width:320px;background:var(--panel);border-right:1px solid var(--border);z-index:400;display:flex;flex-direction:column;overflow:hidden;transform:translateX(-100%);transition:transform .28s cubic-bezier(.4,0,.2,1);flex-shrink:0}
  .rh-panel.open{transform:translateX(0)}
  .rh-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;border-bottom:1px solid var(--border);flex-shrink:0}
  .rh-title{font-family:'Playfair Display',serif;font-size:1.12rem;color:var(--canopy)}
  .rh-close{background:transparent;border:none;color:var(--parch-dim);font-size:1rem;cursor:pointer;padding:0 3px;line-height:1;flex-shrink:0}
  .rh-close:hover{color:var(--parch)}
  .rh-body{flex:1;overflow-y:auto;padding:14px 14px 20px;display:flex;flex-direction:column;gap:10px}
  .rh-body::-webkit-scrollbar{width:3px}
  .rh-body::-webkit-scrollbar-thumb{background:rgba(201,151,58,.3);border-radius:2px}
  .rh-section-lbl{font-size:.64rem;letter-spacing:.11em;text-transform:uppercase;color:var(--gold);padding:6px 0 2px;margin:0}
  .rh-card{display:flex;align-items:center;gap:13px;width:100%;text-align:left;padding:13px 14px;background:var(--panel2);border:1px solid var(--border);border-radius:6px;cursor:pointer;transition:all .15s;font-family:'DM Mono',monospace;color:inherit}
  .rh-card:hover{border-color:var(--gold);background:var(--panel3)}
  .rh-card:hover .rh-arrow{color:var(--gold);transform:translateX(2px)}
  .rh-icon{width:38px;height:38px;border-radius:6px;background:rgba(201,151,58,.1);border:1px solid rgba(201,151,58,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--canopy)}
  .rh-info{flex:1;min-width:0}
  .rh-name{font-size:.86rem;color:var(--parch);font-weight:500;line-height:1.3;margin-bottom:2px}
  .rh-desc{font-size:.70rem;color:var(--parch-dim);line-height:1.5}
  .rh-arrow{color:var(--parch-dim);flex-shrink:0;font-size:.84rem;transition:transform .13s,color .13s}
  .rh-back{display:flex;align-items:center;gap:6px;background:transparent;border:none;color:var(--parch-dim);font-family:'DM Mono',monospace;font-size:.74rem;cursor:pointer;padding:0;margin-bottom:4px;transition:color .13s}
  .rh-back:hover{color:var(--parch)}
  .rh-section-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0 2px}
  .rh-lock-btn{display:flex;align-items:center;gap:5px;background:transparent;border:1px solid rgba(201,151,58,.35);border-radius:4px;color:var(--gold);font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.05em;padding:3px 7px;cursor:pointer;transition:all .15s;line-height:1}
  .rh-lock-btn:hover{background:rgba(201,151,58,.12);border-color:var(--gold)}

  /* Stand Dynamic Reports — card + submenu */
  .sdr-cat{display:flex;flex-direction:column}
  .sdr-card{cursor:pointer;border-radius:6px}
  .sdr-active .sdr-card{border-color:var(--gold);background:var(--panel3)}
  .sdr-active .sdr-card .rh-arrow,.sdr-active .sdr-card .rh-name{color:var(--gold)}
  .sdr-card-cemetery{border-color:rgba(155,60,60,.25)}
  .sdr-card-cemetery:hover{border-color:rgba(155,60,60,.55)!important}
  .sdr-cat-cemetery.sdr-active .sdr-card{border-color:rgba(155,60,60,.6);background:rgba(100,30,30,.08)}
  .sdr-icon-cemetery{background:rgba(155,60,60,.1)!important;border-color:rgba(155,60,60,.25)!important;color:#a07070!important}
  .sdr-chevron{flex-shrink:0;color:var(--parch-dim);transition:transform .2s;margin-left:2px}
  .sdr-active .sdr-chevron{transform:rotate(180deg);color:var(--gold)}
  .sdr-sub{display:flex;flex-direction:column;background:var(--panel2);border:1px solid var(--border);border-top:none;border-radius:0 0 6px 6px;margin-top:-4px;padding-top:4px;overflow:hidden}
  .sdr-sub-scroll{max-height:200px;overflow-y:auto}
  .sdr-sub-scroll::-webkit-scrollbar{width:3px}
  .sdr-sub-scroll::-webkit-scrollbar-thumb{background:rgba(201,151,58,.3);border-radius:2px}
  .sdr-sub-item{display:flex;align-items:center;justify-content:space-between;padding:8px 14px 8px 64px;font-family:'DM Mono',monospace;font-size:.68rem;color:var(--parch);text-decoration:none;transition:background .1s,color .1s;border-top:1px solid var(--border)}
  .sdr-sub-item:hover{background:rgba(201,151,58,.1);color:var(--gold)}
  .sdr-sub-item::after{content:'↗';font-size:.52rem;opacity:0;transition:opacity .13s;flex-shrink:0}
  .sdr-sub-item:hover::after{opacity:.45}
  .sdr-sub-meta{font-size:.58rem;color:var(--parch-dim)}
  .sdr-sub-cemetery{color:#a07070}
  .sdr-sub-cemetery:hover{background:rgba(155,60,60,.1)!important;color:#c07070!important}
</style>
