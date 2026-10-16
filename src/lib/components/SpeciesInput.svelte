<script>
  // Typeahead combobox for species/scientific name selection.
  // Allows free-text entry (for new species not in the list).
  // Bi-directional: selecting one name can trigger auto-fill of the other
  // via the onselect callback.

  let {
    value = $bindable(''),
    options = [],
    placeholder = 'Search…',
    onselect = () => {},
    inputClass = '',
  } = $props();

  let open = $state(false);
  let hi = $state(-1);  // highlighted index in dropdown

  let filtered = $derived(
    value.trim().length > 0
      ? options.filter(o => o.toLowerCase().includes(value.toLowerCase())).slice(0, 24)
      : options.slice(0, 24)
  );

  function pick(opt) {
    value = opt;
    open = false;
    hi = -1;
    onselect(opt);
  }

  function onInput() {
    open = true;
    hi = -1;
  }

  function onFocus() {
    open = true;
    hi = -1;
  }

  function onBlur() {
    // Delay close so mousedown on option fires first
    setTimeout(() => { open = false; hi = -1; }, 180);
  }

  function onKeydown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { open = true; return; }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      hi = Math.min(hi + 1, filtered.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      hi = Math.max(hi - 1, -1);
    } else if (e.key === 'Enter' && hi >= 0) {
      e.preventDefault();
      pick(filtered[hi]);
    } else if (e.key === 'Escape') {
      open = false;
    }
  }
</script>

<div class="sp-wrap">
  <input
    type="text"
    class="sp-input {inputClass}"
    bind:value
    {placeholder}
    autocomplete="off"
    spellcheck="false"
    oninput={onInput}
    onfocus={onFocus}
    onblur={onBlur}
    onkeydown={onKeydown}
  />
  {#if open && filtered.length > 0}
    <div class="sp-drop">
      {#each filtered as opt, i}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="sp-opt"
          class:hi={i === hi}
          onmousedown={(e) => { e.preventDefault(); pick(opt); }}
        >{opt}</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sp-wrap { position: relative; width: 100%; }
  .sp-input {
    width: 100%;
    box-sizing: border-box;
  }
  .sp-drop {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    right: 0;
    background: var(--panel, #1e1a10);
    border: 1px solid var(--gold, #c9973a);
    border-radius: 4px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 9000;
    box-shadow: 0 4px 16px rgba(0,0,0,.45);
  }
  .sp-drop::-webkit-scrollbar { width: 3px; }
  .sp-drop::-webkit-scrollbar-thumb { background: rgba(201,151,58,.3); border-radius: 2px; }
  .sp-opt {
    padding: 6px 10px;
    font-family: 'Outfit', sans-serif;
    font-size: .62rem;
    color: var(--parch, #f0e8d0);
    cursor: pointer;
    border-bottom: 1px solid rgba(201,151,58,.08);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sp-opt:last-child { border-bottom: none; }
  .sp-opt:hover, .sp-opt.hi {
    background: rgba(201,151,58,.15);
    color: var(--parch, #f0e8d0);
  }
</style>
