<script>
  import { onMount } from 'svelte';
  import { sbGet, sbSet } from '$lib/api/supabase.js';
  import { currentUser } from '$lib/stores/auth.js';
  import { fmtDate } from '$lib/utils/format.js';

  let { treeId, observations = [] } = $props();

  let notes = $state([]);
  let newNote = $state('');
  let loading = $state(true);

  async function loadNotes() {
    try {
      const raw = await sbGet(`notes:${treeId}`);
      notes = JSON.parse(raw);
    } catch { notes = []; }
    loading = false;
  }

  async function saveNotes(arr) {
    await sbSet(`notes:${treeId}`, JSON.stringify(arr));
  }

  async function addNote() {
    const txt = newNote.trim();
    if (!txt || !$currentUser) return;
    notes = [{ who: $currentUser.username, txt, ts: Date.now() }, ...notes];
    newNote = '';
    await saveNotes(notes);
  }

  async function deleteNote(i) {
    if (!$currentUser || notes[i]?.who !== $currentUser.username) return;
    notes = notes.filter((_, idx) => idx !== i);
    await saveNotes(notes);
  }

  onMount(loadNotes);
</script>

<div>
  <div class="sec-hdr">Notes</div>
  {#if observations.length}
    <div style="margin-bottom:10px">
      <div style="font-size:.5rem;letter-spacing:.1em;text-transform:uppercase;color:var(--parch-dim);margin-bottom:5px">Bartlett Consulting Observations</div>
      <div class="obs-list">
        {#each observations as obs}
          <span class="obs-tag">{obs}</span>
        {/each}
      </div>
    </div>
  {/if}
  {#if loading}
    <div class="note-empty">Loading…</div>
  {:else}
    <div class="notes-stack">
      {#if notes.length}
        {#each notes as n, i}
          <div class="note">
            <div class="note-top">
              <span class="note-who">{n.who}</span>
              <span class="note-when">{fmtDate(n.ts)}</span>
            </div>
            <div class="note-body">{n.txt}</div>
            {#if $currentUser?.username === n.who}
              <button class="note-del" onclick={() => deleteNote(i)} title="Delete">✕</button>
            {/if}
          </div>
        {/each}
      {:else}
        <div class="note-empty">No field notes yet.</div>
      {/if}
    </div>
    {#if $currentUser}
      <div style="display:flex;flex-direction:column;gap:5px;margin-top:6px">
        <textarea class="ntxt" placeholder="Add a field note…" rows="3"
          bind:value={newNote}></textarea>
        <button class="nsave" onclick={addNote}>Save Note</button>
      </div>
    {:else}
      <div class="auth-nudge">Sign in to add notes</div>
    {/if}
  {/if}
</div>
