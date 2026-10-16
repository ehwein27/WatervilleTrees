<script>
  import { menuOpen, currentPage, mapMode, filterPanelOpen } from '$lib/stores/ui.js';
  import { currentUser, signOut, authOpen } from '$lib/stores/auth.js';
  import { downloadInventoryCSV } from '$lib/utils/export.js';

  let { onTasks = () => {} } = $props();
  let exporting = $state(false);

  function close() { menuOpen.set(false); }

  function doSignIn() {
    close();
    authOpen.set(true);
  }

  function doSignOut() {
    close();
    signOut();
  }
</script>

<div id="main-menu" class:closed={!$menuOpen}>
  <div class="menu-body">
    <div class="menu-section">
      {#if $currentUser}
        <div class="menu-auth-row">
          <span class="menu-user-label">{$currentUser.username}</span>
          <button class="menu-signout-btn" onclick={doSignOut}>Sign Out</button>
        </div>
        <div class="menu-auth-row">
          <button class="menu-item" onclick={() => { currentPage.set('account-settings'); close(); }}>Account Settings</button>
        </div>
      {:else}
        <div class="menu-auth-row">
          <button class="menu-auth-btn" onclick={doSignIn}>Sign In</button>
        </div>
      {/if}
    </div>
    {#if $currentPage === 'map'}
      <div class="menu-section menu-map-controls">
        <button class="menu-item" onclick={() => { mapMode.update(m => m === 'satellite' ? 'light' : 'satellite'); close(); }}>
          {$mapMode === 'satellite' ? 'Switch to Street Map' : 'Switch to Satellite'}
        </button>
        <button class="menu-item" onclick={() => { filterPanelOpen.update(v => !v); close(); }}>
          Filters
        </button>
      </div>
    {/if}
    <div class="menu-section">
      <button class="menu-item" onclick={() => { currentPage.set('map'); close(); }}>Map</button>
      <button class="menu-item" onclick={() => { if (!$currentUser) { close(); authOpen.set(true); } else { close(); onTasks(); } }}>
        Reports &amp; Tasks
        {#if !$currentUser}
          <svg class="menu-lock" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        {/if}
      </button>
    </div>
    <div class="menu-section">
      <button class="menu-item" onclick={() => { currentPage.set('cumulative'); close(); }}>Cumulative Data</button>
      <button class="menu-item" onclick={() => { currentPage.set('inventory-archive'); close(); }}>Inventory Archive</button>
    </div>
    <div class="menu-section">
      <button class="menu-item" onclick={() => { currentPage.set('about'); close(); }}>About</button>
    </div>
    {#if $currentUser?.role === 'admin'}
      <div class="menu-section">
        <button class="menu-item menu-admin" onclick={() => { currentPage.set('admin'); close(); }}>
          Admin Panel
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .menu-admin { color: #c9973a; }
</style>
