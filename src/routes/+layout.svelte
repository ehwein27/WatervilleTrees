<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { restoreSession } from '$lib/stores/auth.js';
  import { currentUser } from '$lib/stores/auth.js';
  import { loadTrees, trees, loading } from '$lib/stores/trees.js';
  import { page } from '$app/stores';

  let { children } = $props();

  onMount(() => {
    restoreSession();
    loadTrees();

    // If trees failed to load initially (empty RLS result, network hiccup, etc.),
    // re-trigger when the user signs in so they don't see a blank map after logging in.
    let prevUser = get(currentUser);
    const unsub = currentUser.subscribe(user => {
      const wasNull = prevUser === null;
      prevUser = user;
      if (user && wasNull) {
        // User just signed in — re-load if trees are still empty and not mid-flight
        if (!get(loading) && get(trees).length === 0) loadTrees();
      }
    });
    return unsub;
  });

  let isReport = $derived($page.route.id?.startsWith('/reports/') ?? false);
</script>

{#if isReport}
  {@render children()}
{:else}
  <div style="display:flex;flex-direction:column;height:100vh;overflow:hidden">
    {@render children()}
  </div>
{/if}
