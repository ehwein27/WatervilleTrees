<script>
  let { open = false, onClose, title, fullscreen = false, children } = $props();
</script>

<!-- Backdrop: covers the map area only (between sidebar and drawer) -->
{#if !fullscreen}
<div
  class="hd-backdrop"
  class:hd-backdrop-visible={open}
  onclick={onClose}
  aria-hidden="true"
></div>
{/if}

<!-- Drawer: always in DOM so the close slide-out animation plays -->
<div class="hd-drawer" class:hd-open={open} class:hd-fullscreen={fullscreen} role="complementary" aria-label="Help">
  <div class="hd-hdr">
    <span class="hd-title">{title}</span>
    <button class="hd-close" onclick={onClose} aria-label="Close help">×</button>
  </div>
  <div class="hd-body">
    {@render children?.()}
  </div>
</div>

<style>
  .hd-backdrop {
    position: fixed;
    left: var(--sw);
    top: var(--header-h);
    right: 420px;
    bottom: 0;
    z-index: 350;
    background: rgba(15, 10, 2, 0.45);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.22s ease;
  }
  .hd-backdrop-visible {
    opacity: 1;
    pointer-events: auto;
  }

  .hd-drawer {
    position: fixed;
    right: 0;
    top: var(--header-h);
    bottom: 0;
    width: 420px;
    z-index: 9998;
    background: var(--panel2);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.22s ease;
    pointer-events: none;
  }
  .hd-fullscreen {
    left: 0;
    right: 0;
    width: 100vw;
    border-left: none;
  }
  .hd-fullscreen .hd-hdr,
  .hd-fullscreen .hd-body {
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
    width: 100%;
  }
  .hd-open {
    transform: translateX(0);
    pointer-events: auto;
  }

  /* Narrow screens: full width minus the sidebar */
  @media (max-width: 840px) {
    .hd-drawer {
      width: calc(100vw - var(--sw));
      right: 0;
    }
    .hd-backdrop {
      right: calc(100vw - var(--sw));
    }
  }

  .hd-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .hd-title {
    font-family: 'Playfair Display', serif;
    font-size: 1rem;
    color: var(--parch);
    line-height: 1.2;
  }
  .hd-close {
    background: transparent;
    border: none;
    color: var(--parch-dim);
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0 3px;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.13s;
  }
  .hd-close:hover { color: var(--parch); }

  .hd-body {
    flex: 1;
    overflow-y: auto;
    padding: 18px 16px 24px;

    /* Scrollbar styling */
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  /* ── Content typography (used by all help content components via :global) ── */

  :global(.hd-body p) {
    font-size: 0.82rem;
    color: var(--parch-dim);
    line-height: 1.65;
    margin-bottom: 12px;
  }

  :global(.hd-section-lbl) {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--gold);
    margin: 18px 0 8px;
  }
  :global(.hd-section-lbl:first-child) {
    margin-top: 0;
  }

  :global(.hd-steps) {
    list-style: none;
    counter-reset: hd-step;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 14px;
  }
  :global(.hd-steps li) {
    counter-increment: hd-step;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 0.82rem;
    color: var(--parch-dim);
    line-height: 1.6;
  }
  :global(.hd-steps li::before) {
    content: counter(hd-step);
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid var(--gold);
    color: var(--gold);
    font-size: 0.68rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }

  :global(.hd-note) {
    font-size: 0.78rem;
    color: var(--parch-dim);
    line-height: 1.6;
    border-left: 2px solid var(--border);
    padding-left: 10px;
    margin-bottom: 12px;
    font-style: italic;
  }
</style>
