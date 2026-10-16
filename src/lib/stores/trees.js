// src/lib/stores/trees.js
// Central reactive store for all tree data.
// Components import from here — never talk to Supabase directly.

import { writable, derived, get } from 'svelte/store';
import { fetchAllTreesMap, updateTree as sbUpdateTree, deleteTreeRow } from '$lib/api/supabase.js';
import { currentUser } from '$lib/stores/auth.js';
import { rowToTree, rowToTreeMap } from '$lib/utils/treeMap.js';
import { cacheTreesLocally, loadCachedTrees, enqueueWrite } from '$lib/utils/offlineQueue.js';

// ── Raw tree list ──────────────────────────────────────────────────────────────
export const trees = writable([]);
export const treesById = writable({});
export const loading = writable(true);
export const loadError = writable(null);
export const syncTime = writable(null); // HH:MM string when trees last loaded

// ── Condition counts ───────────────────────────────────────────────────────────
export const conditionCounts = derived(trees, ($trees) => {
  const counts = { Good: 0, Fair: 0, Poor: 0, Dead: 0, total: $trees.length };
  for (const t of $trees) if (t.c in counts) counts[t.c]++;
  return counts;
});

// ── Map Supabase row → internal tree object ────────────────────────────────────
export { rowToTree as sbRowToTree } from '$lib/utils/treeMap.js';

// ── Load all trees from Supabase ───────────────────────────────────────────────
export async function loadTrees() {
  loading.set(true);
  loadError.set(null);
  try {
    const rows = await fetchAllTreesMap();
    const mapped = rows.map(rowToTreeMap);
    const byId = {};
    mapped.forEach(t => { byId[t.id] = t; });
    trees.set(mapped);
    treesById.set(byId);
    const now = new Date();
    syncTime.set(`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`);
    cacheTreesLocally(mapped).catch(() => {});
  } catch (e) {
    try {
      const cached = await loadCachedTrees();
      if (cached) {
        const byId = {};
        cached.trees.forEach(t => { byId[t.id] = t; });
        trees.set(cached.trees);
        treesById.set(byId);
        const d = new Date(cached.cachedAt);
        const timeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        syncTime.set('cached ' + timeStr);
        loadError.set(`Offline — showing cached data from ${timeStr}.`);
      } else {
        loadError.set(e.message);
        console.error('Failed to load trees:', e);
      }
    } catch {
      loadError.set(e.message);
      console.error('Failed to load trees:', e);
    }
  } finally {
    loading.set(false);
  }
}

// ── Update a single tree (optimistic) ─────────────────────────────────────────
export async function updateTree(treeId, fields) {
  const user = get(currentUser);
  const email = user?.email || '';
  const sbFields = email ? { ...fields, last_modified_by: email } : fields;
  const storeFields = email ? { ...fields, lmb: email } : fields;

  // Optimistic update — change locally immediately
  trees.update($trees =>
    $trees.map(t => t.id === String(treeId) ? { ...t, ...storeFields } : t)
  );
  treesById.update($byId => {
    if ($byId[treeId]) $byId[treeId] = { ...$byId[treeId], ...storeFields };
    return $byId;
  });
  // Persist to Supabase, or queue if offline
  if (!navigator.onLine) {
    await enqueueWrite(treeId, sbFields);
    return { queued: true };
  }
  try {
    await sbUpdateTree(treeId, sbFields);
    return { queued: false };
  } catch (e) {
    await enqueueWrite(treeId, sbFields);
    return { queued: true };
  }
}

// ── Patch a single tree (used after lazy detail fetch) ────────────────────────
export function patchTree(id, fields) {
  const sid = String(id);
  const patch = { ...fields, _partial: false };
  trees.update($trees => $trees.map(t => t.id === sid ? { ...t, ...patch } : t));
  treesById.update($byId => {
    if ($byId[sid]) $byId[sid] = { ...$byId[sid], ...patch };
    return $byId;
  });
}

// ── Hard-delete a tree permanently from the database ──────────────────────────
export async function hardDeleteTree(treeId) {
  await deleteTreeRow(treeId);
  const id = String(treeId);
  trees.update($trees => $trees.filter(t => t.id !== id));
  treesById.update($byId => {
    const next = { ...$byId };
    delete next[id];
    return next;
  });
}

// ── Add trees (from bulk add) ──────────────────────────────────────────────────
export function addTrees(newRows) {
  const mapped = newRows.map(rowToTree);
  trees.update($trees => [...$trees, ...mapped]);
  treesById.update($byId => {
    mapped.forEach(t => { $byId[t.id] = t; });
    return $byId;
  });
}
