<script>
  let { caption, children } = $props();
</script>

<figure class="hd-fig">
  <div class="hd-fig-body">
    {@render children?.()}
  </div>
  {#if caption}
    <figcaption class="hd-fig-cap">{caption}</figcaption>
  {/if}
</figure>

<style>
  .hd-fig {
    margin: 14px 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .hd-fig-body {
    background: rgba(201, 151, 58, 0.05);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    line-height: 0;
  }
  .hd-fig-body :global(svg) {
    width: 100%;
    height: auto;
    display: block;
  }
  .hd-fig-cap {
    font-size: 0.72rem;
    color: var(--parch-dim);
    font-style: italic;
    line-height: 1.4;
    margin-top: 2px;
    padding: 0 2px;
    text-align: center;
    display: block;
  }
</style>
