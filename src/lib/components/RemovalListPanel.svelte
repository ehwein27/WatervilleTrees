<script>
  import { onMount, onDestroy } from 'svelte';
  import { fetchRLists, fetchRListIndex, saveRListIndex, saveRListItems, deleteRListData, migrateRListsIfNeeded } from '$lib/api/supabase.js';
  import { trees, treesById } from '$lib/stores/trees.js';
  import { currentUser } from '$lib/stores/auth.js';
  import { rlViewListId, rlists as rlistsStore, rlistsLoaded } from '$lib/stores/ui.js';
  import { showConfirm } from '$lib/stores/toast.js';

  let { onClose = () => {}, onClickMode = () => {} } = $props();

  let lists = $state([]);
  let loading = $state(true);
  let newName = $state('');
  let detailList = $state(null);

  async function loadLists() {
    await migrateRListsIfNeeded();
    lists = await fetchRLists();
    rlistsStore.set([...lists]);
    rlistsLoaded.set(true);
    loading = false;
  }

  async function createList() {
    const name = newName.trim();
    if (!name) return;
    const id = Date.now().toString(36);
    lists = [...lists, { id, name, trees: [] }];
    newName = '';
    const index = lists.map(l => ({ id: l.id, name: l.name }));
    await Promise.all([saveRListIndex(index), saveRListItems(id, [])]);
    rlistsStore.set([...lists]);
  }

  async function deleteList(id) {
    if (!(await showConfirm('Delete this removal list?'))) return;
    lists = lists.filter(l => l.id !== id);
    if (detailList?.id === id) detailList = null;
    const index = lists.map(l => ({ id: l.id, name: l.name }));
    await Promise.all([saveRListIndex(index), deleteRListData(id)]);
    rlistsStore.set([...lists]);
  }

  function viewDetail(list) {
    detailList = list;
    rlViewListId.set(list.id);
  }

  function backToLists() {
    detailList = null;
    rlViewListId.set(null);
  }

  async function removeTreeFromList(treeId) {
    if (!detailList) return;
    const newTrees = detailList.trees.filter(id => id !== treeId);
    detailList = { ...detailList, trees: newTrees };
    lists = lists.map(l => l.id === detailList.id ? detailList : l);
    await saveRListItems(detailList.id, newTrees);
    rlistsStore.set([...lists]);
  }

  function enterClickMode(list) {
    onClickMode(list);
  }

  function downloadCSV(list) {
    const byId = {};
    $trees.forEach(t => byId[t.id] = t);
    const header = ['Tree ID','Common Name','Scientific Name','Condition','Age Class','DBH','Latitude','Longitude','i-Tree Value'];
    const esc = v => v == null ? '' : '"' + String(v).replace(/"/g,'""') + '"';
    const lines = [header.join(',')].concat(list.trees.map(id => {
      const t = byId[id];
      if (!t) return '';
      return [esc(t.id),esc(t.n),esc(t.s),esc(t.c),esc(t.a),esc(t.d),esc(t.lt),esc(t.ln),esc(t.vt)].join(',');
    }).filter(Boolean));
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = list.name.replace(/[^a-z0-9]/gi,'_') + '_removal_list.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function getTree(id) {
    const byId = {};
    $trees.forEach(t => byId[t.id] = t);
    return byId[id];
  }

  onMount(loadLists);
  onDestroy(() => rlViewListId.set(null));
</script>

<div class="rl-panel">
  <div class="rl-hdr">
    <div class="rl-title">Removal Lists</div>
    <button class="rl-close" onclick={onClose}>✕</button>
  </div>

  <div class="rl-body">
    {#if loading}
      <div class="rl-empty">Loading…</div>
    {:else if detailList}
      <button class="rl-back" onclick={backToLists}>← Back to lists</button>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-family:'Playfair Display',serif;font-size:.85rem;color:var(--canopy)">{detailList.name}</div>
        <div style="display:flex;gap:4px">
          <button class="rl-btn" onclick={() => downloadCSV(detailList)}>Download</button>
          <button class="rl-btn" onclick={() => enterClickMode(detailList)}>+ Add Trees</button>
        </div>
      </div>
      <div class="rl-detail-count">{detailList.trees.length} tree{detailList.trees.length !== 1 ? 's' : ''}</div>
      {#if detailList.trees.length}
        <div class="rl-tree-list">
          {#each detailList.trees as treeId}
            {@const t = getTree(treeId)}
            {#if t}
              <div class="rl-tree-row">
                <div class="rl-tree-info">
                  <div class="rl-tree-name">{t.n}</div>
                  <div class="rl-tree-meta">{t.pid || ('#' + t.id)} · {t.c || '—'} · {t.d ? t.d + '"' : '—'}</div>
                </div>
                <button class="rl-tree-rm" onclick={() => removeTreeFromList(treeId)}>✕</button>
              </div>
            {/if}
          {/each}
        </div>
      {:else}
        <div class="rl-empty">No trees in this list yet. Click "Add Trees" to select trees from the map.</div>
      {/if}
    {:else}
      <div class="rl-create">
        <input class="rl-inp" type="text" placeholder="New list name…" bind:value={newName}
          onkeydown={(e) => e.key === 'Enter' && createList()} />
        <button class="rl-create-btn" onclick={createList} disabled={!newName.trim()}>Create</button>
      </div>

      {#if lists.length}
        <div class="rl-list-stack">
          {#each lists as list}
            <div class="rl-list-row">
              <div class="rl-list-info">
                <div class="rl-list-name">{list.name}</div>
                <div class="rl-list-count">{list.trees.length} tree{list.trees.length !== 1 ? 's' : ''}</div>
              </div>
              <div class="rl-list-btns">
                <button class="rl-btn" onclick={() => enterClickMode(list)}>+ Click Trees</button>
                <button class="rl-btn" onclick={() => viewDetail(list)}>View</button>
                <button class="rl-btn" onclick={() => downloadCSV(list)}>CSV</button>
                <button class="rl-btn danger" onclick={() => deleteList(list.id)}>Del</button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="rl-empty">No removal lists yet. Create one above.</div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .rl-panel{position:fixed;top:70px;right:16px;width:420px;max-height:calc(100vh - 90px);background:var(--panel);border:1px solid var(--border);border-radius:8px;z-index:9995;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.5);overflow:hidden}
  .rl-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 10px;border-bottom:1px solid var(--border);flex-shrink:0}
  .rl-title{font-family:'Playfair Display',serif;font-size:.95rem;color:var(--canopy)}
  .rl-close{background:transparent;border:none;color:var(--parch-dim);font-size:1rem;cursor:pointer}
  .rl-close:hover{color:var(--parch)}
  .rl-body{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
  .rl-body::-webkit-scrollbar{width:3px}
  .rl-body::-webkit-scrollbar-thumb{background:rgba(201,151,58,.3);border-radius:2px}
  .rl-create{display:flex;gap:6px}
  .rl-inp{flex:1;background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:6px 8px;font-family:'DM Mono',monospace;font-size:.62rem;color:var(--parch)}
  .rl-inp:focus{outline:none;border-color:var(--gold)}
  .rl-create-btn{background:var(--gold);border:none;border-radius:3px;padding:4px 12px;font-family:'DM Mono',monospace;font-size:.6rem;color:var(--bark);cursor:pointer;font-weight:500}
  .rl-create-btn:disabled{opacity:.5;cursor:not-allowed}
  .rl-list-stack{display:flex;flex-direction:column;gap:6px}
  .rl-list-row{display:flex;align-items:center;gap:8px;background:var(--panel2);border:1px solid var(--border);border-radius:5px;padding:8px 10px}
  .rl-list-info{flex:1;min-width:0}
  .rl-list-name{font-size:.66rem;color:var(--parch);font-weight:500}
  .rl-list-count{font-size:.54rem;color:var(--parch-dim)}
  .rl-list-btns{display:flex;gap:3px;flex-shrink:0}
  .rl-btn{background:transparent;border:1px solid var(--border);border-radius:3px;padding:2px 8px;font-family:'DM Mono',monospace;font-size:.52rem;color:var(--parch-dim);cursor:pointer;transition:all .13s;white-space:nowrap}
  .rl-btn:hover{border-color:var(--gold);color:var(--parch)}
  .rl-btn.danger{border-color:rgba(184,53,53,.3);color:rgba(184,53,53,.7)}
  .rl-btn.danger:hover{border-color:var(--red);color:var(--red)}
  .rl-empty{font-size:.6rem;color:var(--parch-dim);font-style:italic;text-align:center;padding:12px 0}
  .rl-back{display:flex;align-items:center;gap:4px;background:transparent;border:none;color:var(--parch-dim);font-family:'DM Mono',monospace;font-size:.58rem;cursor:pointer;padding:0;transition:color .13s}
  .rl-back:hover{color:var(--parch)}
  .rl-detail-count{font-size:.56rem;color:var(--parch-dim)}
  .rl-tree-list{display:flex;flex-direction:column;gap:4px}
  .rl-tree-row{display:flex;align-items:center;gap:8px;background:var(--panel2);border-radius:4px;padding:6px 10px;border:1px solid rgba(201,151,58,.1)}
  .rl-tree-info{flex:1;min-width:0}
  .rl-tree-name{font-size:.62rem;color:var(--parch)}
  .rl-tree-meta{font-size:.52rem;color:var(--parch-dim)}
  .rl-tree-rm{background:transparent;border:none;color:rgba(184,53,53,.5);cursor:pointer;font-size:.7rem}
  .rl-tree-rm:hover{color:var(--red)}
</style>
