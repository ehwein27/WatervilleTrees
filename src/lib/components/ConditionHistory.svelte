<script>
  import { onMount } from 'svelte';
  import { sbGet, sbSet } from '$lib/api/supabase.js';
  import { currentUser } from '$lib/stores/auth.js';
  import { trees, treesById } from '$lib/stores/trees.js';
  import { updateTree as sbUpdateTree } from '$lib/api/supabase.js';
  import { calcITree } from '$lib/utils/itree.js';
  import { fmtDate } from '$lib/utils/format.js';

  let { treeId } = $props();

  const COND_COLORS = { Good: '#4ca344', Fair: '#d4ae30', Poor: '#d06828', Dead: '#a03535' };
  const CONDITIONS = ['Good', 'Fair', 'Poor', 'Dead'];

  let history = $state([]);
  let loading = $state(true);
  let selectedCond = $state('');
  let note = $state('');
  let saving = $state(false);

  async function loadHistory() {
    try {
      const raw = await sbGet(`condhistory:${treeId}`);
      history = JSON.parse(raw);
    } catch { history = []; }
    loading = false;
  }

  async function saveUpdate() {
    if (!selectedCond || !$currentUser) return;
    saving = true;
    const entry = { who: $currentUser.username, ts: Date.now(), cond: selectedCond, note: note.trim() || undefined };
    history = [entry, ...history];
    await sbSet(`condhistory:${treeId}`, JSON.stringify(history));

    // Also update the tree's condition
    try {
      const lastUpdated = new Date().toISOString().slice(0, 10);
      await sbUpdateTree(treeId, { condition: selectedCond, last_updated: lastUpdated });
      const iv = calcITree(null, selectedCond); // DBH unknown here, will use existing
      trees.update($trees =>
        $trees.map(tr => {
          if (tr.id !== treeId) return tr;
          const newIv = calcITree(tr.d, selectedCond);
          return { ...tr, c: selectedCond, u: lastUpdated,
            vt: newIv?.[0], vc: newIv?.[1], va: newIv?.[2], vs: newIv?.[3], ve: newIv?.[4] };
        })
      );
      treesById.update($byId => {
        if ($byId[treeId]) {
          const tr = $byId[treeId];
          const newIv = calcITree(tr.d, selectedCond);
          $byId[treeId] = { ...tr, c: selectedCond, u: lastUpdated,
            vt: newIv?.[0], vc: newIv?.[1], va: newIv?.[2], vs: newIv?.[3], ve: newIv?.[4] };
        }
        return $byId;
      });
    } catch (e) { console.warn('Condition patch failed:', e); }

    selectedCond = '';
    note = '';
    saving = false;
  }

  onMount(loadHistory);
</script>

<div>
  <div class="sec-hdr">Condition History</div>
  {#if loading}
    <div class="note-empty">Loading…</div>
  {:else}
    {#if history.length}
      <div class="ch-timeline">
        {#each history as h}
          <div class="ch-entry">
            <div class="ch-dot" style="background:{COND_COLORS[h.cond] || '#888'}"></div>
            <div class="ch-body">
              <div class="ch-cond" style="color:{COND_COLORS[h.cond] || 'var(--parch)'}">{h.cond}</div>
              <div class="ch-meta">{h.who} · {fmtDate(h.ts)}</div>
              {#if h.note}
                <div class="ch-note">{h.note}</div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="note-empty">No condition updates logged yet.</div>
    {/if}

    {#if $currentUser}
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px;background:var(--panel2);border:1px solid var(--border);border-radius:5px;padding:9px 10px">
        <div style="font-size:.52rem;letter-spacing:.08em;text-transform:uppercase;color:var(--gold)">Log a condition update</div>
        <div style="display:flex;gap:4px">
          {#each CONDITIONS as c}
            <button
              class="fb {c === 'Good' ? 'cg' : c === 'Fair' ? 'cf' : c === 'Poor' ? 'cp' : 'cd'}"
              class:on={selectedCond === c}
              onclick={() => selectedCond = c}
              style="flex:1;text-align:center"
            >{c}</button>
          {/each}
        </div>
        <textarea class="ntxt" placeholder="Optional note about this update…" rows="2"
          bind:value={note} style="min-height:44px"></textarea>
        <button class="nsave" onclick={saveUpdate} disabled={!selectedCond || saving}>
          {saving ? 'Saving…' : 'Save Update'}
        </button>
      </div>
    {:else}
      <div class="auth-nudge">Sign in to log condition updates</div>
    {/if}
  {/if}
</div>
