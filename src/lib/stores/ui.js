// src/lib/stores/ui.js
// All UI state — selected tree, sidebar, filters, current page, menu open/close

import { writable, derived, get } from 'svelte/store';
import { trees, treesById } from './trees.js';
import { isEabRisk } from '$lib/utils/itree.js';

// ── Navigation ─────────────────────────────────────────────────────────────────
export const currentPage = writable('map'); // 'map' | 'bulk-add' | 'reports' | 'inventory-archive' | etc.
export const menuOpen = writable(false);

// ── Sidebar ────────────────────────────────────────────────────────────────────
export const sidebarOpen = writable(false);
export const selectedTreeId = writable(null);
export const editingTree = writable(false);

export const selectedTree = derived(
  [selectedTreeId, treesById],
  ([$id, $byId]) => ($id && $byId[$id]) ? $byId[$id] : null
);

export function openTree(id) {
  editingTree.set(false);
  filterPanelOpen.set(false);
  sidebarOpen.set(true);
  selectedTreeId.set(String(id));
}

export function closeSidebar() {
  sidebarOpen.set(false);
  selectedTreeId.set(null);
  editingTree.set(false);
}

// ── Filter panel open/close ────────────────────────────────────────────────────
export const filterPanelOpen = writable(false);

// ── Filters (multi-select arrays; empty = "all") ──────────────────────────────
export const selectedConds   = writable([]); // [] = all; ['Good','Fair'] = only those
export const searchQuery     = writable('');
export const selectedStreets = writable([]);
export const selectedSpecies = writable([]);
export const selectedAges    = writable([]);
export const selectedUploadInfo = writable('');
export const eabOnly = writable(false);

// ── Filtered tree list ────────────────────────────────────────────────────────
export const filteredTrees = derived(
  [trees, selectedConds, searchQuery, selectedStreets, selectedSpecies, selectedAges, selectedUploadInfo, eabOnly],
  ([$trees, $conds, $q, $streets, $species, $ages, $uploadInfo, $eabOnly]) => {
    const q = $q?.trim().toLowerCase();
    return $trees.filter(t => {
      if (q) {
        const idMatch   = t.iids && t.iids.some(id => id.toLowerCase().includes(q));
        const nameMatch = t.n?.toLowerCase().includes(q) || t.s?.toLowerCase().includes(q);
        if (!idMatch && !nameMatch) return false;
      }
      if ($conds.length   && !$conds.includes(t.c))              return false;
      if ($ages.length    && !$ages.includes(t.a))               return false;
      if ($streets.length && !$streets.includes(t.st))           return false;
      if ($species.length && !$species.includes(t.n))            return false;
      if ($uploadInfo && t.ui?.split('*')[0].trim() !== $uploadInfo) return false;
      if ($eabOnly && !isEabRisk(t)) return false;
      return true;
    });
  }
);

// Condition counts for the header
export const filteredConditionCounts = derived(
  [filteredTrees, trees],
  ([$ft, $all]) => {
    const counts = { Good: 0, Fair: 0, Poor: 0, Dead: 0, total: $all.length };
    for (const t of $ft) if (t.c in counts) counts[t.c]++;
    return counts;
  }
);

export function resetFilters() {
  selectedConds.set([]);
  searchQuery.set('');
  selectedStreets.set([]);
  selectedSpecies.set([]);
  selectedAges.set([]);
  selectedUploadInfo.set('');
  eabOnly.set(false);
}

// ── Map instance (for place-on-map etc.) ─────────────────────────────────────
export const mapInstance = writable(null);
export const mapMode = writable('satellite'); // 'satellite' | 'light'
export const placeModeActive = writable(false);
export const rlClickHandler = writable(null); // function(treeId) or null
export const rlViewListId = writable(null);   // list ID currently being viewed (shows rings on map)
export const bulkClickHandler = writable(null); // function(treeId) or null for bulk condition mode

// ── Derived lists for dropdowns — single pass over trees ─────────────────────
const _treeMeta = derived(trees, ($trees) => {
  const commonSet = new Set(), sciSet = new Set(), streetSet = new Set();
  const commonToSci = {}, sciToCommon = {};
  for (const t of $trees) {
    const n = t.n?.trim(), s = t.s?.trim();
    if (n) commonSet.add(n);
    if (s) sciSet.add(s);
    if (t.st) streetSet.add(t.st);
    if (n && s) { commonToSci[n] = s; sciToCommon[s] = n; }
  }
  return {
    speciesList:  [...commonSet].sort(),
    sciNamesList: [...sciSet].sort(),
    streetsList:  [...streetSet].sort(),
    speciesMap:   { commonToSci, sciToCommon },
  };
});

export const speciesList  = derived(_treeMeta, m => m.speciesList);
export const sciNamesList = derived(_treeMeta, m => m.sciNamesList);
export const streetsList  = derived(_treeMeta, m => m.streetsList);

// ── Removal lists (shared across CumulativeData + RemovalListPanel) ──────────
export const rlists = writable([]);
export const rlistsLoaded = writable(false);

// ── Bulk-add prefill (set by Prospective Planting "Convert to Bulk Add") ──────
// Value: { bytes: Uint8Array, name: string } | null
export const bulkAddPrefill = writable(null);

// ── Bulk-add placement mode ───────────────────────────────────────────────────
// null = inactive
// { geoResults, idx, done, pendingFileName, pendingFileBytes } = active session
export const baPlacementData = writable(null);

// ── Prospective planting map-click mode ───────────────────────────────────────
// ppMapClickActive: { rowId: string, species: string } | null
export const ppMapClickActive = writable(null);
// ppMapClickResult: { rowId: string, addr: string, lat: number, lng: number } | null
export const ppMapClickResult = writable(null);

// ── Species name mapping (common ↔ scientific) ───────────────────────────────
export const speciesMap = derived(_treeMeta, m => m.speciesMap);
