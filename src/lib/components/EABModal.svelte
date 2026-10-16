<script>
  import { trees } from '$lib/stores/trees.js';
  import { sbGet, sbSet } from '$lib/api/supabase.js';
  import { isEabRisk } from '$lib/utils/itree.js';
  import { onMount } from 'svelte';

  let { onClose = () => {} } = $props();

  const EAB_SPECIES = new Set(['Ash','Ash-Green','Ash-White']);
  function isAutoEAB(t) { return EAB_SPECIES.has(t.n); }

  let eabFlags = $state([]);
  let flagSet = $derived(new Set(eabFlags));

  let autoTrees = $derived($trees.filter(t => isAutoEAB(t)));
  let manualTrees = $derived($trees.filter(t => !isAutoEAB(t) && flagSet.has(t.id)));
  let allFlagged = $derived((() => {
    const ids = new Set([...autoTrees.map(t => t.id), ...eabFlags]);
    return $trees.filter(t => ids.has(t.id));
  })());

  let speciesCounts = $derived((() => {
    const counts = {};
    autoTrees.forEach(t => { counts[t.n] = (counts[t.n] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })());

  async function loadFlags() {
    try { eabFlags = JSON.parse(await sbGet('eab_flags')); } catch { eabFlags = []; }
  }

  function downloadCSV() {
    const rows = [['Tree ID','Common Name','Scientific Name','Condition','Age Class','DBH (in)','Latitude','Longitude','Detection Method']];
    allFlagged.forEach(t => {
      const method = isAutoEAB(t) ? 'Auto (Ash species)' : 'Manual flag';
      rows.push([t.id, t.n, t.s, t.c, t.a, t.d, t.lt, t.ln, method]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'eab_risk_trees.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  const condClass = c => ({ Good: 'cg', Fair: 'cf', Poor: 'cp', Dead: 'cd' }[c] || '');

  onMount(loadFlags);
</script>

<div class="eab-overlay" onclick={onClose}>
  <div class="eab-box" onclick={(e) => e.stopPropagation()}>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div>
        <div class="eab-title">Emerald Ash Borer Risk</div>
        <div class="eab-desc" style="margin-top:4px">
          The emerald ash borer (<em>Agrilus planipennis</em>) is an invasive beetle that kills virtually all true ash trees
          (<em>Fraxinus</em> spp.). Trees below are flagged based on species and/or manual review. Dead ash trees remain vectors for spread.
        </div>
      </div>
      <button class="list-btn" onclick={onClose}>Close</button>
    </div>

    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div>
        <div class="eab-count">{autoTrees.length}</div>
        <div class="eab-stat-lbl">Auto-detected (Ash spp.)</div>
      </div>
      <div>
        <div class="eab-count">{manualTrees.length}</div>
        <div class="eab-stat-lbl">Manually flagged</div>
      </div>
      <div>
        <div class="eab-count">{allFlagged.length}</div>
        <div class="eab-stat-lbl">Total at risk</div>
      </div>
    </div>

    <div>
      <div class="task-section">At-Risk Species in Inventory</div>
      <div class="eab-sp-grid">
        {#each speciesCounts as [sp, n]}
          <div class="eab-sp-tag">{sp} <span style="color:var(--gold);margin-left:3px">{n}</span></div>
        {/each}
      </div>
    </div>

    <div>
      <div class="task-section" style="display:flex;align-items:center;justify-content:space-between">
        <span>Flagged Trees</span>
        <button class="list-btn primary" onclick={downloadCSV}>Download List</button>
      </div>
      <div class="eab-tree-list">
        {#if !allFlagged.length}
          <div class="lists-empty">No trees flagged.</div>
        {:else}
          {#each allFlagged as t}
            {@const isManual = flagSet.has(t.id) && !isAutoEAB(t)}
            <div class="eab-tree-row">
              <span class="eab-tree-name">{t.n}</span>
              <span class="eab-tree-sp">{t.s}</span>
              <span class="list-tree-meta {condClass(t.c)}">{t.c}</span>
              <span class="list-tree-meta">DBH {t.d}"</span>
              <span class="list-tree-meta">{t.pid || ('#' + t.id)}</span>
              {#if isManual}
                <span style="font-size:.5rem;color:var(--parch-dim);font-style:italic">manual</span>
              {:else}
                <span style="font-size:.5rem;color:#3a9e5f;font-style:italic">ash sp.</span>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .eab-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9995;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px 14px}
  .eab-box{background:var(--panel);border:1px solid rgba(184,53,53,.35);border-radius:8px;padding:24px 24px 20px;width:100%;max-width:580px;display:flex;flex-direction:column;gap:14px;margin:auto}
  .eab-title{font-family:'Playfair Display',serif;font-size:1.05rem;color:#e06060}
  .eab-desc{font-size:.6rem;color:var(--parch-dim);line-height:1.6}
  .eab-count{font-family:'Playfair Display',serif;font-size:1.6rem;color:#e06060}
  .eab-stat-lbl{font-size:.48rem;letter-spacing:.1em;text-transform:uppercase;color:var(--parch-dim)}
  .task-section{font-size:.5rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:6px}
  .eab-sp-grid{display:flex;flex-wrap:wrap;gap:5px}
  .eab-sp-tag{background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:3px 8px;font-size:.56rem;color:var(--parch)}
  .eab-tree-list{display:flex;flex-direction:column;gap:4px;max-height:260px;overflow-y:auto;margin-top:6px}
  .eab-tree-list::-webkit-scrollbar{width:3px}
  .eab-tree-list::-webkit-scrollbar-thumb{background:rgba(201,151,58,.3);border-radius:2px}
  .eab-tree-row{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--panel2);border-radius:4px;font-size:.6rem}
  .eab-tree-name{color:var(--parch);font-weight:500;flex-shrink:0}
  .eab-tree-sp{color:var(--parch-dim);font-style:italic;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .list-tree-meta{color:var(--parch-dim);font-size:.52rem;flex-shrink:0}
  .list-tree-meta.cg{color:#5ec254}
  .list-tree-meta.cf{color:#e8c34a}
  .list-tree-meta.cp{color:#e07a30}
  .list-tree-meta.cd{color:#d04444}
  .lists-empty{font-size:.6rem;color:var(--parch-dim);font-style:italic;padding:10px 0}
  .list-btn{background:transparent;border:1px solid var(--border);border-radius:3px;padding:4px 12px;font-family:'DM Mono',monospace;font-size:.56rem;color:var(--parch-dim);cursor:pointer;transition:all .13s;flex-shrink:0}
  .list-btn:hover{border-color:var(--gold);color:var(--parch)}
  .list-btn.primary{background:var(--gold);border-color:var(--gold);color:var(--bark)}
  .list-btn.primary:hover{opacity:.85}
</style>
