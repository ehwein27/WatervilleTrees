<script>
  import { fetchRLists, saveRListItems } from '$lib/api/supabase.js';

  let { treeId } = $props();

  let lists = $state([]);
  let loading = $state(true);
  let addSel = $state('');

  $effect(() => {
    if (treeId) loadLists();
  });

  async function loadLists() {
    loading = true;
    lists = await fetchRLists();
    loading = false;
  }

  let onLists = $derived(lists.filter(l => l.trees?.includes(treeId) || l.trees?.includes(Number(treeId))));
  let offLists = $derived(lists.filter(l => !l.trees?.includes(treeId) && !l.trees?.includes(Number(treeId))));

  async function addToList() {
    if (!addSel) return;
    const targetId = addSel;
    lists = lists.map(l => {
      if (l.id === targetId) return { ...l, trees: [...(l.trees || []), treeId] };
      return l;
    });
    addSel = '';
    const updated = lists.find(l => l.id === targetId);
    if (updated) await saveRListItems(targetId, updated.trees);
  }

  async function removeFromList(listId) {
    lists = lists.map(l => {
      if (l.id === listId) return { ...l, trees: (l.trees || []).filter(id => id !== treeId && id !== Number(treeId)) };
      return l;
    });
    const updated = lists.find(l => l.id === listId);
    if (updated) await saveRListItems(listId, updated.trees);
  }
</script>

<div class="sb-tool-row">
  <span class="sb-tool-lbl">Removal Lists</span>
  <div class="sb-tool-ctrl">
    {#if loading}
      <span class="rl-empty">Loading…</span>
    {:else if !lists.length}
      <span class="rl-empty">No lists — create one in Tasks menu</span>
    {:else}
      {#if onLists.length}
        <div class="rl-tags">
          {#each onLists as l}
            <span class="rl-tag">{l.name} <button class="rl-tag-rm" onclick={() => removeFromList(l.id)} title="Remove from list">✕</button></span>
          {/each}
        </div>
      {/if}
      {#if offLists.length}
        <div class="rl-add-row" style={onLists.length ? 'margin-top:5px' : ''}>
          <select class="rl-select" value={addSel} onchange={(e) => { addSel = e.target.value; }}>
            <option value="">Add to list…</option>
            {#each offLists as l}
              <option value={l.id}>{l.name}</option>
            {/each}
          </select>
          <button class="list-btn primary" onclick={addToList} style="white-space:nowrap;display:inline-flex;align-items:center;gap:4px;font-size:.54rem">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .rl-empty{font-size:.58rem;color:var(--parch-dim);font-style:italic}
  .rl-tags{display:flex;flex-wrap:wrap;gap:4px}
  .rl-tag{background:rgba(201,151,58,.12);border:1px solid rgba(201,151,58,.3);border-radius:3px;padding:2px 7px;font-size:.54rem;color:var(--gold);display:inline-flex;align-items:center;gap:4px}
  .rl-tag-rm{background:none;border:none;color:var(--parch-dim);font-size:.5rem;cursor:pointer;padding:0;line-height:1}
  .rl-tag-rm:hover{color:var(--red)}
  .rl-add-row{display:flex;gap:5px;align-items:center}
  .rl-select{font-size:.56rem;padding:3px 6px;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--parch);font-family:'DM Mono',monospace}
  .rl-select option{background:var(--panel)}
</style>
