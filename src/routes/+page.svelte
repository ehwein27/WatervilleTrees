<script>
  import { onMount } from 'svelte';
  import Map from '$lib/components/Map.svelte';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import MainMenu from '$lib/components/MainMenu.svelte';
  import TreeEditForm from '$lib/components/TreeEditForm.svelte';
  import TreeNotes from '$lib/components/TreeNotes.svelte';
  import ConditionHistory from '$lib/components/ConditionHistory.svelte';
  import TreePhotos from '$lib/components/TreePhotos.svelte';
  import PrintTreeCard from '$lib/components/PrintTreeCard.svelte';
  import AddTreeModal from '$lib/components/AddTreeModal.svelte';
  import SidebarRemovalLists from '$lib/components/SidebarRemovalLists.svelte';
  import AboutView from '$lib/components/AboutView.svelte';
  import ReportsHub from '$lib/components/ReportsHub.svelte';
  import BulkCondBanner from '$lib/components/BulkCondBanner.svelte';
  import BaPlacementPanel from '$lib/components/BaPlacementPanel.svelte';
  import FilterPanel from '$lib/components/FilterPanel.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { loading, loadError, updateTree, hardDeleteTree, syncTime, patchTree } from '$lib/stores/trees.js';
  import { sbGet, sbSet, fetchTreeDetail } from '$lib/api/supabase.js';
  import { rowToTree } from '$lib/utils/treeMap.js';
  import { sidebarOpen, selectedTree, closeSidebar,
           resetFilters, filterPanelOpen,
           searchQuery, filteredTrees, menuOpen, editingTree,
           currentPage, openTree,
           selectedStreets,
           mapInstance, placeModeActive, rlClickHandler, rlViewListId, bulkClickHandler,
           mapMode, filteredConditionCounts, selectedUploadInfo,
           ppMapClickActive, ppMapClickResult,
           baPlacementData, rlists } from '$lib/stores/ui.js';
  import { currentUser, signOut, authOpen } from '$lib/stores/auth.js';
  import { theme, toggleTheme } from '$lib/stores/theme.js';
  import { syncPendingWrites, pendingWriteCount } from '$lib/utils/offlineQueue.js';
  import { showToast } from '$lib/stores/toast.js';
  import { condClass } from '$lib/utils/format.js';
  import { isEabRisk } from '$lib/utils/itree.js';

  import { get } from 'svelte/store';

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

  let reportsHub;
  let printCard;
  let addTreeRef;
  let mapRef;
  let activeModal = $state('');
  let eabFlagged = $state(false);
  let eabLoading = $state(false);
  let photoCount = $state(0);
  let treeEditMeta = $state(null); // { by: string, at: string } | null
  let copyLinkToast = $state(false);
  let copyLinkTimer;
  let removeErrorToast = $state(false);
  let removeErrorTimer;
  let sheetExpanded = $state(false);
  let deleteDialogTree = $state(null);
  let deleteDialogTriggerEl = null;
  let deleteDialogFirstBtn; // bound to first button in dialog for focus management
  let placeBanner = $state(false);
  let placePinMarker = null;
  let treePlaced = $state(false);

  // RL click-to-add mode
  let rlClickListId = $state(null);
  let rlClickListName = $state('');
  let rlClickCount = $state(0);
  let rlLastAction = $state(null);

  // ── Prospective planting map-pick mode ─────────────────────────────────────
  let ppPickHandler = null;
  let _ppGeocodeController = null; // aborts stale geocode if a new pick starts

  $effect(() => {
    const active = $ppMapClickActive;
    const m = get(mapInstance);
    if (active && m) {
      ppPickHandler = async (e) => {
        m.off('click', ppPickHandler);
        ppPickHandler = null;
        document.getElementById('map').style.cursor = '';
        const { lat, lng } = e.latlng;
        try {
          const addr = await ppReverseGeocode(lat, lng);
          ppMapClickResult.set({ rowId: active.rowId, addr, lat, lng });
          ppMapClickActive.set(null);
          currentPage.set('prospective-planting');
        } catch {
          // aborted by a newer pick — do nothing
        }
      };
      m.on('click', ppPickHandler);
      document.getElementById('map').style.cursor = 'crosshair';
    } else if (!active) {
      if (ppPickHandler) {
        get(mapInstance)?.off('click', ppPickHandler);
        ppPickHandler = null;
      }
      if (document.getElementById('map')) document.getElementById('map').style.cursor = '';
    }
  });

  async function ppReverseGeocode(lat, lng) {
    _ppGeocodeController?.abort();
    _ppGeocodeController = new AbortController();
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept': 'application/json', 'Accept-Language': 'en' }, signal: _ppGeocodeController.signal }
      );
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const a    = data.address || {};
      const num  = a.house_number || '';
      const road = a.road || a.pedestrian || a.path || '';
      return [num, road].filter(Boolean).join(' ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (e) {
      if (e.name === 'AbortError') throw e; // let caller handle abort silently
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }

  function cancelPPPick() {
    ppMapClickActive.set(null);
    currentPage.set('prospective-planting');
  }

  let _treeNonce = 0; // incremented on each tree selection; guards against stale responses

  async function loadEabFlag(treeId, nonce) {
    eabFlagged = false;
    try {
      const val = await sbGet('eab_flags');
      if (nonce !== _treeNonce) return; // a different tree was selected before this resolved
      const flags = Array.isArray(val) ? val : JSON.parse(val);
      eabFlagged = flags.includes(Number(treeId)) || flags.includes(treeId);
    } catch { if (nonce === _treeNonce) eabFlagged = false; }
  }

  async function toggleEabFlag(treeId) {
    eabLoading = true;
    try {
      let flags;
      try {
        const val = await sbGet('eab_flags');
        flags = Array.isArray(val) ? val : JSON.parse(val);
      } catch { flags = []; }
      const numId = Number(treeId);
      const idx = flags.indexOf(numId);
      if (idx === -1) { flags.push(numId); eabFlagged = true; }
      else { flags.splice(idx, 1); eabFlagged = false; }
      await sbSet('eab_flags', flags);
    } catch (e) { console.error('EAB flag toggle failed', e); }
    eabLoading = false;
  }
  $effect(() => {
    if ($currentPage !== 'map') filterPanelOpen.set(false);
    if ($currentPage === 'map') requestAnimationFrame(() => get(mapInstance)?.invalidateSize?.());
  });
  let bulkCondActive = $state(false);
  let bulkCondSelected = $state(new Set());

  let deepLinkHandled = false;
  $effect(() => {
    if (!$loading && !deepLinkHandled) {
      deepLinkHandled = true;
      const params = new URLSearchParams(window.location.search);
      const treeId = params.get('tree');
      if (treeId) openTree(treeId);
    }
  });

  $effect(() => {
    if ($selectedTree) {
      const id = $selectedTree.id;
      const nonce = ++_treeNonce;
      loadEabFlag(id, nonce);
      sbGet('tedit:' + id)
        .then(v => {
          if (nonce !== _treeNonce) return;
          treeEditMeta = typeof v === 'string' ? JSON.parse(v) : v;
        })
        .catch(() => {
          if (nonce !== _treeNonce) return;
          treeEditMeta = null;
        });
      if ($selectedTree._partial) {
        fetchTreeDetail(id).then(row => {
          if (nonce !== _treeNonce || !row) return;
          patchTree(id, rowToTree(row));
        }).catch(() => {});
      }
    } else {
      photoCount = 0;
      treeEditMeta = null;
    }
  });

  $effect(() => {
    if (deleteDialogTree) {
      deleteDialogFirstBtn?.focus();
    } else if (deleteDialogTriggerEl) {
      deleteDialogTriggerEl.focus();
      deleteDialogTriggerEl = null;
    }
  });

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      if (get(placeModeActive)) { exitPlaceMode(true); return; }
      if (get(ppMapClickActive)) { cancelPPPick(); return; }
      if (rlClickListId) { exitRLClickMode(); return; }
      if (bulkCondActive) { bulkCondActive = false; bulkCondSelected = new Set(); bulkClickHandler.set(null); mapRef?.clearBulkRings(); document.getElementById('map').style.cursor = ''; return; }
      if ($currentPage !== 'map') { currentPage.set('map'); return; }
      if (activeModal) { closeModal(); return; }
      if ($sidebarOpen) { closeSidebar(); return; }
      if ($menuOpen) { menuOpen.set(false); return; }
      if ($filterPanelOpen) { filterPanelOpen.set(false); return; }
    }
  }

  function openReportsHub() {
    currentPage.set('map');
    reportsHub?.show();
  }

  function handleHubAction(action) {
    if (action === MODAL.BULK_COND) {
      bulkCondActive = true;
      bulkCondSelected = new Set();
      document.getElementById('map').style.cursor = 'crosshair';
      bulkClickHandler.set((t) => {
        const next = new Set(bulkCondSelected);
        const isNowSelected = !next.has(t.id);
        if (isNowSelected) next.add(t.id); else next.delete(t.id);
        bulkCondSelected = next;
        // Tell map to toggle the ring
        mapRef?.bulkToggleRing(t, isNowSelected);
      });
    } else if (action === MODAL.BULK_ADD) {
      currentPage.set('bulk-add');
    } else if (action === MODAL.PROSPECTIVE) {
      currentPage.set('prospective-planting');
    } else {
      activeModal = action;
    }
  }

  function closeModal() { activeModal = ''; exitPlaceMode(false); }

  // ── Place-on-map mode ────────────────────────
  function enterPlaceMode() {
    activeModal = ''; // hide add modal
    placeBanner = true;
    placeModeActive.set(true);
    const m = get(mapInstance);
    if (m) {
      document.getElementById('map').style.cursor = 'crosshair';
      m.on('mousemove', onPlaceMouseMove);
      m.on('click', onPlaceMapClick);
    }
  }

  function exitPlaceMode(reopenModal) {
    if (!get(placeModeActive)) return;
    placeModeActive.set(false);
    placeBanner = false;
    const m = get(mapInstance);
    if (m) {
      document.getElementById('map').style.cursor = '';
      m.off('mousemove', onPlaceMouseMove);
      m.off('click', onPlaceMapClick);
    }
    if (placePinMarker) {
      get(mapInstance)?.removeLayer(placePinMarker);
      placePinMarker = null;
    }
    if (reopenModal) activeModal = MODAL.ADD_TREE;
  }

  function onPlaceMouseMove(e) {
    if (!get(placeModeActive)) return;
    const { lat, lng } = e.latlng;
    if (!placePinMarker) {
      placePinMarker = L.circleMarker([lat, lng], {
        radius: 8, fillColor: '#8fc67f', fillOpacity: 0.7,
        color: '#fff', weight: 2, interactive: false,
      }).addTo(get(mapInstance));
    } else {
      placePinMarker.setLatLng([lat, lng]);
    }
  }

  function onPlaceMapClick(e) {
    if (!get(placeModeActive)) return;
    const { lat, lng } = e.latlng;
    treePlaced = true;
    exitPlaceMode(true); // reopen modal
    // Set coords in add tree form after modal reopens
    setTimeout(() => {
      addTreeRef?.setCoords(lat, lng);
      addTreeRef?.lookupStreet?.();
    }, 50);
  }

  // ── Removal List click-to-add mode ─────────
  async function enterRLClickMode(list) {
    rlClickListId = list.id;
    rlClickListName = list.name;
    rlLastAction = null;
    activeModal = '';
    await updateRLClickCount();
    document.getElementById('map').style.cursor = 'crosshair';
    rlClickHandler.set(handleRLMarkerClick);
    rlViewListId.set(list.id);
    filterPanelOpen.set(true);
  }

  function exitRLClickMode() {
    rlClickListId = null;
    rlLastAction = null;
    rlClickHandler.set(null);
    rlViewListId.set(null);
    document.getElementById('map').style.cursor = '';
  }

  function updateRLClickCount() {
    const list = get(rlists).find(l => l.id === rlClickListId);
    rlClickCount = list ? list.trees.length : 0;
  }

  async function handleRLMarkerClick(treeId) {
    const listId = rlClickListId; // capture before any await — exitRLClickMode can null this mid-flight
    if (!listId) return;
    try {
      // Fetch authoritative state before mutating (multi-user safety)
      const raw = await sbGet('rlists');
      const lists = JSON.parse(raw);
      const list = lists.find(l => l.id === listId);
      if (!list) return;
      if (list.trees.includes(treeId) || list.trees.includes(Number(treeId))) return;
      list.trees.push(treeId);
      await sbSet('rlists', JSON.stringify(lists));
      rlists.set(lists); // keep shared store in sync
      rlLastAction = { listId, treeId };
      rlClickCount = list.trees.length;
      const m = get(mapInstance);
      const t = get(filteredTrees).find(tr => tr.id === treeId);
      if (t && m) {
        const pulse = L.circleMarker([t.lt, t.ln], {
          radius: 18, fillColor: 'transparent', fillOpacity: 0,
          color: '#f0e8d0', weight: 3, opacity: 1,
        }).addTo(m);
        setTimeout(() => m.removeLayer(pulse), 600);
      }
    } catch (err) { console.error('RL click add error', err); }
  }

  async function undoRLClickAdd() {
    const action = rlLastAction;
    if (!action) return;
    rlLastAction = null; // clear immediately so double-tap can't fire twice
    try {
      const raw = await sbGet('rlists');
      const lists = JSON.parse(raw);
      const list = lists.find(l => l.id === action.listId);
      if (list) {
        list.trees = list.trees.filter(id => id !== action.treeId && id !== Number(action.treeId));
        await sbSet('rlists', JSON.stringify(lists));
        rlists.set(lists); // keep shared store in sync
      }
    } catch {}
    updateRLClickCount();
  }

  let offlineShow = $state(false);
  let offlineDismissed = $state(false);
  let isOnline = $state(true);
  let pendingCount = $state(0);
  let syncing = $state(false);
  let syncResult = $state(null);

  onMount(() => {
    isOnline = navigator.onLine;
    function goOffline() { isOnline = false; if (!offlineDismissed) offlineShow = true; }
    async function goOnline() {
      isOnline = true;
      offlineShow = false;
      offlineDismissed = false;
      pendingCount = await pendingWriteCount();
      if (pendingCount === 0) return;
      syncing = true;
      syncResult = null;
      const result = await syncPendingWrites();
      syncing = false;
      syncResult = result;
      pendingCount = await pendingWriteCount();
      setTimeout(() => { syncResult = null; }, 4000);
    }
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    if (!navigator.onLine) goOffline();
    function openRemovalLists() { activeModal = MODAL.REMOVAL; }
    window.addEventListener('open-removal-lists', openRemovalLists);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('open-removal-lists', openRemovalLists);
    };
  });

  function copyTreeLink(treeId) {
    const url = `${window.location.origin}${window.location.pathname}?tree=${treeId}`;
    navigator.clipboard.writeText(url).then(() => {
      copyLinkToast = true;
      clearTimeout(copyLinkTimer);
      copyLinkTimer = setTimeout(() => { copyLinkToast = false; }, 2000);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      copyLinkToast = true;
      clearTimeout(copyLinkTimer);
      copyLinkTimer = setTimeout(() => { copyLinkToast = false; }, 2000);
    });
  }

  function handleCloseSidebar() {
    sheetExpanded = false;
    closeSidebar();
    copyLinkToast = false;
    clearTimeout(copyLinkTimer);
  }

  function expandSheet() { sheetExpanded = true; }
  function collapseSheet() { sheetExpanded = false; closeSidebar(); }

  async function markRemoved(t) {
    if (!$currentUser) return;
    if (t.c === 'Dead') {
      deleteDialogTree = null;
      removeErrorToast = true;
      clearTimeout(removeErrorTimer);
      removeErrorTimer = setTimeout(() => { removeErrorToast = false; }, 2500);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    await updateTree(t.id, { c: 'Dead', condition: 'Dead', last_updated: today });
    pendingCount = await pendingWriteCount();
    deleteDialogTree = null;
    closeSidebar();
  }

  async function permanentDelete(t) {
    if (!$currentUser) return;
    try {
      await hardDeleteTree(t.id);
      deleteDialogTree = null;
      closeSidebar();
    } catch (e) {
      deleteDialogTree = null;
      showToast('Delete failed: ' + e.message, 'error');
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="page-wrap">

{#if offlineShow || syncing || (syncResult && !syncing)}
<div id="status-banner" class="show"
  style={syncing
    ? 'background:rgba(56,130,220,.12);border-color:rgba(56,130,220,.4)'
    : (syncResult && !syncing)
      ? 'background:rgba(42,125,36,.1);border-color:rgba(42,125,36,.35)'
      : ''}>
  {#if offlineShow}
    <div class="offline-dot"></div>
    <span class="offline-msg">
      No connection — edits will sync when back online.
      {#if pendingCount > 0}
        <span class="offline-pending">({pendingCount} pending)</span>
      {/if}
    </span>
    <button class="offline-retry" onclick={() => { if (navigator.onLine) { offlineShow = false; } else { window.location.reload(); } }}>Retry</button>
    <button class="offline-dismiss" onclick={() => { offlineShow = false; offlineDismissed = true; }}>✕</button>
  {:else if syncing}
    <div class="offline-dot" style="background:#378add"></div>
    <span class="offline-msg" style="color:#185fa5">Syncing {pendingCount} pending edit{pendingCount === 1 ? '' : 's'}…</span>
  {:else if syncResult}
    <div class="offline-dot" style="background:#639922"></div>
    <span class="offline-msg" style="color:#2a7d24">
      {#if syncResult.failed === 0}
        All edits synced successfully.
      {:else}
        {syncResult.synced} synced, {syncResult.failed} failed — will retry next time.
      {/if}
    </span>
  {/if}
</div>
{/if}

{#if placeBanner}
<div class="place-banner">
  <span style="color:var(--canopy)"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
  <span style="color:var(--canopy);font-weight:500">Click the map to place the tree</span>
  <button class="place-cancel-btn" onclick={() => exitPlaceMode(true)}>
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel
  </button>
</div>
{/if}

{#if $ppMapClickActive}
<div class="pp-pick-banner">
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color:var(--canopy)"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
  <span style="color:var(--canopy);font-weight:500">Click the map to place
    {#if $ppMapClickActive.species}<strong>{$ppMapClickActive.species}</strong>{:else}tree{/if}
  </span>
  <button class="place-cancel-btn" onclick={cancelPPPick}>
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    Cancel
  </button>
</div>
{/if}

{#if rlClickListId}
<div class="rl-click-banner">
  <span>Adding to:</span>
  <span class="rl-click-banner-name">{rlClickListName}</span>
  <span class="rl-click-banner-count">{rlClickCount} tree{rlClickCount !== 1 ? 's' : ''}</span>
  {#if rlLastAction}
    <button class="rl-click-btn" onclick={undoRLClickAdd}>
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg> Undo
    </button>
  {/if}
  <button class="rl-click-btn" onclick={exitRLClickMode}>
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Done
  </button>
</div>
{/if}

<header>
  <div class="header-row">

    <!-- Brand / Menu trigger -->
    <div style="position:relative;display:flex;align-items:center">
      <button class="logo-btn" onclick={() => menuOpen.update(v => !v)} aria-label="Open menu">
        <!-- Leaf icon (desktop) -->
        <svg class="brand-leaf" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17 8C8 10 5.9 16.17 3.82 22c3-4 6-7 9-8-2.24 4-4.48 6.73-6.82 7 .56-7.04 7-12 11-13z"/></svg>
        <!-- Hamburger (mobile only) -->
        <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        <div class="brand-text">
          <span class="brand-name">Waterville Tree Inventory</span>
          <span class="brand-sub">City of Waterville, Maine</span>
        </div>
        <svg class="brand-caret" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <!-- Mobile center title -->
      <span class="site-title">
        <span class="title-short">Waterville Trees</span>
      </span>
      <MainMenu onTasks={openReportsHub} />
    </div>

    <!-- Stats + controls -->
    <div class="hdr-right">
      {#if $currentPage === 'map'}
        <div class="stats" style:visibility={$filteredConditionCounts.total === 0 ? 'hidden' : ''}>
          <div class="stat-primary">
            <span class="stat-n">{$filteredConditionCounts.total}</span>
            <span class="stat-l">trees</span>
          </div>
          <div class="stat-sep"></div>
          <div class="cond-row">
            <span class="cond-mini cg" title="Good">{$filteredConditionCounts.Good}</span>
            <span class="cond-mini cf" title="Fair">{$filteredConditionCounts.Fair}</span>
            <span class="cond-mini cp" title="Poor">{$filteredConditionCounts.Poor}</span>
            <span class="cond-mini cd" title="Dead">{$filteredConditionCounts.Dead}</span>
          </div>
          <div class="stat-sep"></div>
          <button class="map-mode-btn" onclick={() => mapRef?.toggleMode()} title={$mapMode === 'satellite' ? 'Switch to street map' : 'Switch to satellite view'}>
            <span class="map-mode-seg" class:active={$mapMode === 'light'}>Street</span>
            <span class="map-mode-seg" class:active={$mapMode === 'satellite'}>Satellite</span>
          </button>
          <button class="filter-toggle" class:active={$filterPanelOpen} onclick={() => filterPanelOpen.update(v => !v)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            Filters
          </button>
        </div>
        <!-- Mobile map controls -->
        <button class="hdr-icon-btn" onclick={() => mapRef?.toggleMode()} title={$mapMode === 'satellite' ? 'Switch to street map' : 'Switch to satellite'} aria-label={$mapMode === 'satellite' ? 'Switch to street map' : 'Switch to satellite'}>
          {#if $mapMode === 'satellite'}
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10a7.31 7.31 0 0 0 10 10Z"/><path d="m9 15 3-3"/><path d="M17 13a6 6 0 0 0-6-6"/><path d="M21 13A10 10 0 0 0 11 3"/></svg>
          {/if}
        </button>
        <button class="hdr-icon-btn" class:active={$filterPanelOpen} onclick={() => filterPanelOpen.update(v => !v)} title="Filters" aria-label="Filters">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
        </button>
      {/if}
      <button class="hdr-icon-btn" onclick={toggleTheme} title={$theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle theme">
        {#if $theme === 'dark'}
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        {/if}
      </button>
      {#if !$currentUser}
        <button class="hdr-icon-btn" onclick={() => authOpen.set(true)} title="Sign in" aria-label="Sign in">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </button>
      {/if}
    </div>

  </div>
</header>

<div class="body">
  {#if $sidebarOpen && !sheetExpanded}
    <div class="map-tap-dismiss" onclick={collapseSheet}></div>
  {/if}
  <FilterPanel />

  <button class="add-fab" class:locked={!$currentUser} title={$currentUser ? 'Add new tree' : 'Sign in to add trees'}
    style:display={$currentPage !== 'map' || (activeModal && activeModal !== MODAL.ADD_TREE) ? 'none' : 'flex'}
    onclick={() => { if (!$currentUser) { authOpen.set(true); return; } treePlaced = false; activeModal = MODAL.ADD_TREE; }}>+</button>

  {#if $loading}
    <div id="map-loading">Loading tree inventory…</div>
  {:else if $loadError}
    <div id="map-loading" style="color:var(--red)">Error: {$loadError}</div>
  {:else}
    <div style={$currentPage === 'inventory-archive' || $currentPage === 'cumulative' || $currentPage === 'about' || $currentPage === 'prospective-planting' || $currentPage === 'account-settings' || $currentPage === 'admin' ? 'display:none' : 'display:contents'}>
      <Map bind:this={mapRef} />
    </div>
    {#if $currentPage === 'cumulative'}
      {#await import('$lib/components/CumulativeData.svelte') then { default: CumulativeData }}
        <CumulativeData />
      {/await}
    {:else if $currentPage === 'about'}
      <AboutView />
    {:else if $currentPage === 'bulk-add'}
      {#await import('$lib/components/BulkAddModal.svelte') then { default: BulkAddModal }}
        <BulkAddModal />
      {/await}
    {:else if $currentPage === 'inventory-archive'}
      {#await import('$lib/components/InventoryArchive.svelte') then { default: InventoryArchive }}
        <InventoryArchive />
      {/await}
    {:else if $currentPage === 'prospective-planting'}
      {#await import('$lib/components/ProspectivePlanting.svelte') then { default: ProspectivePlanting }}
        <ProspectivePlanting />
      {/await}
    {:else if $currentPage === 'account-settings'}
      {#await import('$lib/components/AccountSettings.svelte') then { default: AccountSettings }}
        <AccountSettings />
      {/await}
    {:else if $currentPage === 'admin'}
      {#await import('$lib/components/AdminPanel.svelte') then { default: AdminPanel }}
        <AdminPanel />
      {/await}
    {/if}
  {/if}

  <div id="sb"
    class:closed={!$sidebarOpen}
    class:open-peek={$sidebarOpen && !sheetExpanded}
    class:open-full={$sidebarOpen && sheetExpanded}
    style:display={$currentPage !== 'map' ? 'none' : ''}
  >
    {#if $sidebarOpen && $selectedTree}
      <div class="sb-peek-strip" onclick={() => { if (!sheetExpanded) expandSheet(); }}>
        <div class="sb-peek-info">
          <div class="sb-name">{$selectedTree.n || 'Unknown Tree'}</div>
          <span class="cond-badge {condClass($selectedTree.c)}">{$selectedTree.c || '—'}</span>
          {#if !sheetExpanded}
            <span class="sb-tap-hint">Tap to expand</span>
          {/if}
        </div>
        <button
          class="sb-expand-btn"
          class:expanded={sheetExpanded}
          onclick={(e) => { e.stopPropagation(); sheetExpanded ? collapseSheet() : expandSheet(); }}
          title={sheetExpanded ? 'Collapse' : 'Expand'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
      </div>
    {/if}
    {#if $sidebarOpen && $selectedTree}
      {#if $editingTree}
        <TreeEditForm />
      {:else}
        {@const t = $selectedTree}
        <div id="sb-inner" class="sb-anim">
          <div class="sb-hdr">
            <button class="sb-back-mobile" onclick={handleCloseSidebar}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Map
            </button>
            <div>
              <div class="sb-name" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px">
                {t.n || 'Unknown Tree'}
                {#if isEabRisk(t) || eabFlagged}<span class="eab-badge" title="EAB risk"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>{/if}
              </div>
              <div class="sb-sub">{t.pid || ('#' + t.id)} · {t.s}</div>
              {#if t.iids && t.iids.length > 1}
                <div class="sb-also">Also: {t.iids.slice(0, -1).join(' · ')}</div>
              {/if}
              <div style="display:flex;gap:5px;margin-top:4px">
                {#if $currentUser}
                  <button class="list-btn primary" onclick={() => editingTree.set(true)} style="display:inline-flex;align-items:center;gap:4px;font-size:.65rem">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit
                  </button>
                {/if}
                <button class="list-btn" style="display:inline-flex;align-items:center;gap:4px;font-size:.65rem" title="Copy a shareable link to this tree" onclick={() => copyTreeLink(t.id)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  {copyLinkToast ? 'Copied!' : 'Copy Link'}
                </button>
                <button class="list-btn" style="display:inline-flex;align-items:center;gap:4px;font-size:.65rem" title="Print tree detail card" onclick={() => printCard?.show(t)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print
                </button>
                <button class="tree-del" class:locked={!$currentUser} onclick={(e) => { if ($currentUser) { deleteDialogTriggerEl = e.currentTarget; deleteDialogTree = t; } }} title={$currentUser ? 'Remove or delete this tree' : 'Sign in to remove trees'}>
                  {#if $currentUser}
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  {/if}
                </button>
              </div>
            </div>
            <button class="sb-close" onclick={handleCloseSidebar}>✕</button>
          </div>
          {#if removeErrorToast}
            <div class="remove-error-toast">This tree is already marked as removed.</div>
          {/if}
          <div class="sb-body">

            <div>
              <div class="sec-hdr">General</div>
              <div class="meta-grid">
                <div class="meta-cell">
                  <div class="meta-lbl">Condition</div>
                  {#if t.c}
                    <span class="cond-pill {condClass(t.c)}">{t.c}</span>
                  {:else}
                    <div class="meta-val">—</div>
                  {/if}
                </div>
                <div class="meta-cell">
                  <div class="meta-lbl">Age Class</div>
                  <div class="meta-val">{t.a || '—'}</div>
                </div>
                <div class="meta-cell">
                  <div class="meta-lbl">DBH</div>
                  <div class="meta-val">{t.d ? t.d + '"' : '—'}</div>
                </div>
                <div class="meta-cell">
                  <div class="meta-lbl">Photos</div>
                  <div class="meta-val">{photoCount}</div>
                </div>
                {#if t.bm != null}
                  <div class="meta-cell">
                    <div class="meta-lbl">Termite Nests</div>
                    <div class="meta-val">{t.bm}</div>
                  </div>
                {/if}
                {#if t.dw}
                  <div class="meta-cell">
                    <div class="meta-lbl">Dist. to Water</div>
                    <div class="meta-val">{t.dw}</div>
                  </div>
                {/if}
                {#if t.st}
                  <div class="meta-cell" style="grid-column:1/-1">
                    <div class="meta-lbl">Street</div>
                    <div class="meta-val" style="font-size:.66rem;cursor:pointer;color:var(--gold)" title="Filter to this street" onclick={() => { selectedStreets.update(arr => arr.includes(t.st) ? arr : [...arr, t.st]); filterPanelOpen.set(true); }}>{t.st} <span style="font-size:.65rem;opacity:.6">&#9656; filter</span></div>
                  </div>
                {/if}
                <div class="meta-cell">
                  <div class="meta-lbl">Last Updated</div>
                  <div class="meta-val">{t.u || '—'}</div>
                </div>
                {#if treeEditMeta}
                  <div class="meta-cell">
                    <div class="meta-lbl">Last Edited</div>
                    <div class="meta-val" style="font-size:.62rem">{treeEditMeta.at}</div>
                    <div style="font-size:.65rem;color:var(--gold);margin-top:1px">by {treeEditMeta.by}</div>
                  </div>
                {/if}
                {#if t.ui}
                  {@const uiParts = t.ui.split('*')}
                  <div class="meta-cell" style="grid-column:1/-1">
                    <div class="meta-lbl">Survey Source</div>
                    <div class="meta-val" style="font-size:.62rem;line-height:1.4">{uiParts[0].trim()}{#if uiParts.length > 1}<div style="font-size:.65rem;color:var(--parch-dim);margin-top:2px">* {uiParts[1].trim()}</div>{/if}</div>
                  </div>
                {/if}
              </div>
            </div>


            <div class="sb-tools">
              <SidebarRemovalLists treeId={t.id} />
              <div class="sb-tool-row" style="margin-top:6px">
                <span class="sb-tool-lbl">EAB Risk</span>
                <div class="sb-tool-ctrl">
                  {#if isEabRisk(t)}
                    <span style="font-size:.65rem;color:#e06060;font-style:italic">Auto-flagged · Ash species</span>
                  {:else if $currentUser}
                    <button class="eab-flag-btn" class:flagged={eabFlagged} disabled={eabLoading} onclick={() => toggleEabFlag(t.id)} style="display:inline-flex;align-items:center;gap:5px">
                      {#if eabFlagged}
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Flagged — click to unflag
                      {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Flag for EAB Risk
                      {/if}
                    </button>
                  {:else}
                    <button class="eab-flag-btn" onclick={() => authOpen.set(true)} style="display:inline-flex;align-items:center;gap:5px">
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Flag for EAB Risk
                    </button>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Planting & Stewardship section -->
            <div>
              <div class="sec-hdr" style="display:flex;align-items:center;justify-content:space-between">
                <span>Planting &amp; Stewardship</span>
                {#if $currentUser}
                  <button class="ps-edit-btn" onclick={() => editingTree.set(true)} title="Edit these fields">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>
                {:else}
                  <span class="ps-signin-hint" onclick={() => authOpen.set(true)}>Sign in to add ›</span>
                {/if}
              </div>
              <div class="meta-grid">
                <div class="meta-cell">
                  <div class="meta-lbl">Date Planted</div>
                  <div class="meta-val {!t.pd ? 'ps-empty' : ''}">{t.pd || '—'}</div>
                </div>
                <div class="meta-cell">
                  <div class="meta-lbl">Age When Planted</div>
                  <div class="meta-val {!t.ap ? 'ps-empty' : ''}">{t.ap || '—'}</div>
                </div>
                <div class="meta-cell" style="grid-column:1/-1">
                  <div class="meta-lbl">Tree Steward</div>
                  <div class="meta-val {!t.ts ? 'ps-empty' : ''}">{t.ts || '—'}</div>
                </div>
                <div class="meta-cell" style="grid-column:1/-1">
                  <div class="meta-lbl">Companion Plants</div>
                  <div class="meta-val {!t.cp ? 'ps-empty' : ''}">{t.cp || '—'}</div>
                </div>
                <div class="meta-cell" style="grid-column:1/-1">
                  <div class="meta-lbl">Infestation / Disease</div>
                  <div class="meta-val {t.inf ? '' : 'ps-empty'}" style={t.inf ? 'color:#c0392b' : ''}>{t.inf || '—'}</div>
                </div>
                <div class="meta-cell" style="grid-column:1/-1">
                  <div class="meta-lbl">Protection / Fencing</div>
                  <div class="meta-val {!t.pn ? 'ps-empty' : ''}">{t.pn || '—'}</div>
                </div>
              </div>
            </div>
            {#if t.vt}
              <div>
                <div class="sec-hdr">i-Tree Estimated Value</div>
                <div class="val-grid">
                  <div>
                    <span class="val-total">${t.vt.toLocaleString()}</span>
                    <span class="val-unit">/yr</span>
                  </div>
                  <div class="val-breakdown">
                    <div class="val-row"><span class="val-lbl">CO&#8322; Sequestration</span><span class="val-amt">${t.vc}</span></div>
                    <div class="val-row"><span class="val-lbl">Air Quality</span><span class="val-amt">${t.va}</span></div>
                    <div class="val-row"><span class="val-lbl">Stormwater</span><span class="val-amt">${t.vs}</span></div>
                    <div class="val-row"><span class="val-lbl">Energy Savings</span><span class="val-amt">${t.ve}</span></div>
                  </div>
                </div>
              </div>
            {/if}

            <ConditionHistory treeId={t.id} />

            <TreeNotes treeId={t.id} observations={t.o || []} />

            <TreePhotos treeId={t.id} {isOnline} onCountChange={(n) => { photoCount = n; }} />

          </div>
        </div>
      {/if}
    {/if}
  </div>

</div><!-- end .body -->
</div><!-- end .page-wrap -->

<AuthModal />
<Toast />

<ReportsHub bind:this={reportsHub} onAction={handleHubAction} />

{#if activeModal === MODAL.RISK}
  {#await import('$lib/components/RiskReportModal.svelte') then { default: RiskReportModal }}
    <RiskReportModal onClose={closeModal} />
  {/await}
{:else if activeModal === MODAL.COST}
  {#await import('$lib/components/CostReportModal.svelte') then { default: CostReportModal }}
    <CostReportModal onClose={closeModal} />
  {/await}
{:else if activeModal.startsWith('sdr:')}
  {#await import('$lib/components/SDRModal.svelte') then { default: SDRModal }}
    <SDRModal sdrType={activeModal.slice(4)} onClose={closeModal} />
  {/await}
{:else if activeModal === MODAL.REMOVAL}
  {#await import('$lib/components/RemovalListPanel.svelte') then { default: RemovalListPanel }}
    <RemovalListPanel onClose={closeModal} onClickMode={(list) => { enterRLClickMode(list); }} />
  {/await}
{:else if activeModal === MODAL.WORKORDER}
  {#await import('$lib/components/WorkOrderModal.svelte') then { default: WorkOrderModal }}
    <WorkOrderModal onClose={closeModal} />
  {/await}
{:else if activeModal === MODAL.EAB}
  {#await import('$lib/components/EABModal.svelte') then { default: EABModal }}
    <EABModal onClose={closeModal} />
  {/await}
{:else if activeModal === MODAL.DEAD}
  {#await import('$lib/components/DeadTreesModal.svelte') then { default: DeadTreesModal }}
    <DeadTreesModal onClose={closeModal} />
  {/await}
{:else if activeModal === MODAL.ADD_TREE}
  <AddTreeModal bind:this={addTreeRef} onClose={() => { closeModal(); treePlaced = false; }} onPlaceMode={enterPlaceMode} placed={treePlaced} />
{/if}

<PrintTreeCard bind:this={printCard} />

{#if $baPlacementData && !$baPlacementData.done && $currentPage === 'map'}
  <BaPlacementPanel />
{/if}

<BulkCondBanner active={bulkCondActive} selectedIds={bulkCondSelected}
  onExit={() => { bulkCondActive = false; bulkCondSelected = new Set(); bulkClickHandler.set(null); mapRef?.clearBulkRings(); document.getElementById('map').style.cursor = ''; }}
  onApplied={() => { bulkCondActive = false; bulkCondSelected = new Set(); bulkClickHandler.set(null); mapRef?.clearBulkRings(); document.getElementById('map').style.cursor = ''; }} />

{#if deleteDialogTree}
  <div class="del-overlay" onclick={() => deleteDialogTree = null} role="none">
    <div class="del-dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="del-title">
      <div class="del-title" id="del-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        {deleteDialogTree.pid || ('#' + deleteDialogTree.id)} — {deleteDialogTree.n}
      </div>
      <p class="del-sub">What would you like to do?</p>
      <div class="del-actions">
        <button class="del-btn del-soft" bind:this={deleteDialogFirstBtn} onclick={() => markRemoved(deleteDialogTree)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          Remove from Map
          <span class="del-hint">Marks as Dead — still in the database</span>
        </button>
        <button class="del-btn del-hard" onclick={() => permanentDelete(deleteDialogTree)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          Permanently Delete
          <span class="del-hint">Removes the record entirely — cannot be undone</span>
        </button>
        <button class="del-btn del-cancel" onclick={() => deleteDialogTree = null}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page-wrap {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  #map-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(27,21,7,.92);
    border: 1px solid rgba(201,151,58,.3);
    border-radius: 8px;
    padding: 24px 36px;
    font-size: .75rem;
    letter-spacing: .08em;
    z-index: 9999;
  }
  .place-banner {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bark);
    border: 1.5px solid var(--canopy);
    border-radius: 8px;
    padding: 10px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,.5);
    font-family: 'Outfit', sans-serif;
    font-size: .65rem;
    color: var(--parch);
    white-space: nowrap;
  }
  .place-cancel-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 3px 10px;
    font-family: 'Outfit', sans-serif;
    font-size: .65rem;
    color: var(--parch-dim);
    cursor: pointer;
    transition: all .13s;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .place-cancel-btn:hover {
    border-color: var(--gold);
    color: var(--parch);
  }
  .pp-pick-banner {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bark);
    border: 1.5px solid var(--canopy);
    border-radius: 8px;
    padding: 10px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,.5);
    font-family: 'Outfit', sans-serif;
    font-size: .65rem;
    color: var(--parch);
    white-space: nowrap;
  }
  .rl-click-banner {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bark);
    border: 1.5px solid var(--gold);
    border-radius: 8px;
    padding: 10px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,.5);
    font-family: 'Outfit', sans-serif;
    font-size: .65rem;
    color: var(--parch);
    white-space: nowrap;
  }
  .rl-click-banner-name {
    color: var(--gold);
    font-weight: 500;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rl-click-banner-count {
    color: var(--parch-dim);
    font-size: .65rem;
  }
  .rl-click-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 3px 9px;
    font-family: 'Outfit', sans-serif;
    font-size: .65rem;
    color: var(--parch-dim);
    cursor: pointer;
    transition: all .13s;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .rl-click-btn:hover {
    border-color: var(--gold);
    color: var(--parch);
  }

  /* Tap-to-expand hint (mobile peek strip only) */
  .sb-tap-hint {
    display: none;
  }
  @media (max-width: 768px) {
    .sb-tap-hint {
      display: inline;
      font-size: .65rem;
      color: var(--gold);
      opacity: .6;
      letter-spacing: .06em;
    }
  }

  /* Planting & Stewardship section */
  .ps-edit-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: 1px solid rgba(201,151,58,.3);
    border-radius: 3px;
    padding: 2px 8px;
    font-family: 'Outfit', sans-serif;
    font-size: .65rem;
    color: var(--gold);
    cursor: pointer;
    transition: all .13s;
  }
  .ps-edit-btn:hover { background: var(--gold-hi); border-color: var(--gold); }
  .ps-signin-hint {
    font-size: .65rem;
    color: var(--gold);
    opacity: .7;
    cursor: pointer;
    transition: opacity .13s;
  }
  .ps-signin-hint:hover { opacity: 1; }
  .ps-empty { opacity: .35; font-style: italic; }
</style>
