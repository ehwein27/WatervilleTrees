<script>
  import { trees, treesById } from '$lib/stores/trees.js';
  import { updateTree as sbUpdateTree } from '$lib/api/supabase.js';
  import { calcITree } from '$lib/utils/itree.js';
  import { showConfirm, showToast } from '$lib/stores/toast.js';
  let { active = false, selectedIds = new Set(), onExit = () => {}, onApplied = () => {} } = $props();

  let applying = $state(false);

  async function applyCondition(newCond) {
    if (!selectedIds.size) return;
    if (!(await showConfirm(`Set ${selectedIds.size} tree${selectedIds.size > 1 ? 's' : ''} to "${newCond}"?`))) return;
    applying = true;

    const lastUpdated = new Date().toISOString().slice(0, 10);
    const ids = [...selectedIds];

    await Promise.all(ids.map(id =>
      sbUpdateTree(id, { condition: newCond, last_updated: lastUpdated })
        .catch(e => console.warn('Bulk patch failed for', id, e))
    ));

    trees.update($trees =>
      $trees.map(t => {
        if (!selectedIds.has(t.id)) return t;
        const iv = calcITree(t.d, newCond);
        return { ...t, c: newCond, u: lastUpdated,
          vt: iv?.[0], vc: iv?.[1], va: iv?.[2], vs: iv?.[3], ve: iv?.[4] };
      })
    );
    treesById.update($byId => {
      ids.forEach(id => {
        if ($byId[id]) {
          const t = $byId[id];
          const iv = calcITree(t.d, newCond);
          $byId[id] = { ...t, c: newCond, u: lastUpdated,
            vt: iv?.[0], vc: iv?.[1], va: iv?.[2], vs: iv?.[3], ve: iv?.[4] };
        }
      });
      return $byId;
    });

    showToast(`${ids.length} tree${ids.length === 1 ? '' : 's'} set to ${newCond}.`);
    applying = false;
    onApplied();
  }
</script>

{#if active}
<div class="bcb">
  <span class="bcb-label">Bulk update:</span>
  <span class="bcb-count">{selectedIds.size}</span>
  <span class="bcb-label">tree{selectedIds.size !== 1 ? 's' : ''} selected</span>
  <div class="bcb-sep"></div>
  <span class="bcb-label">Set condition:</span>
  <button class="bcb-btn cg" onclick={() => applyCondition('Good')} disabled={applying}>Good</button>
  <button class="bcb-btn cf" onclick={() => applyCondition('Fair')} disabled={applying}>Fair</button>
  <button class="bcb-btn cp" onclick={() => applyCondition('Poor')} disabled={applying}>Poor</button>
  <button class="bcb-btn cd" onclick={() => applyCondition('Dead')} disabled={applying}>Dead</button>
  <div class="bcb-sep"></div>
  <button class="bcb-cancel" onclick={onExit} title="Cancel">✕</button>
</div>
{/if}

<style>
  .bcb{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:8000;background:var(--panel);border:1px solid rgba(201,151,58,.55);border-radius:8px;padding:10px 16px;box-shadow:0 6px 28px rgba(0,0,0,.55);display:flex;align-items:center;gap:10px;font-family:'Outfit',sans-serif;white-space:nowrap;min-width:340px}
  .bcb-label{font-size:.6rem;color:var(--parch-dim)}
  .bcb-count{font-size:.72rem;font-family:'Playfair Display',serif;color:var(--canopy);min-width:28px;text-align:center}
  .bcb-sep{width:1px;height:20px;background:var(--border);flex-shrink:0}
  .bcb-btn{background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:3px 10px;font-family:'Outfit',sans-serif;font-size:.58rem;cursor:pointer;transition:all .13s;color:var(--parch-dim);white-space:nowrap}
  .bcb-btn:hover{border-color:var(--gold);color:var(--parch)}
  .bcb-btn:disabled{opacity:.5;cursor:not-allowed}
  .bcb-btn.cg{border-color:#4ca344;color:#4ca344}.bcb-btn.cg:hover{background:#4ca34422}
  .bcb-btn.cf{border-color:#d4ae30;color:#d4ae30}.bcb-btn.cf:hover{background:#d4ae3022}
  .bcb-btn.cp{border-color:#d06828;color:#d06828}.bcb-btn.cp:hover{background:#d0682822}
  .bcb-btn.cd{border-color:#a03535;color:#a03535}.bcb-btn.cd:hover{background:#a0353522}
  .bcb-cancel{background:transparent;border:none;color:var(--parch-dim);font-size:.9rem;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0}
  .bcb-cancel:hover{color:var(--parch)}
</style>
