<script>
  import { trees } from '$lib/stores/trees.js';

  let { onClose = () => {} } = $props();

  let deadTrees = $derived(
    $trees.filter(t => t.c === 'Dead')
      .sort((a, b) => (a.st || '').localeCompare(b.st || '') || a.id.localeCompare(b.id))
  );

  function downloadCSV() {
    const lines = ['"Tree ID","Common Name","Scientific Name","Age Class","DBH","Street","Latitude","Longitude"'];
    deadTrees.forEach(t => {
      lines.push([t.id, t.n, t.s, t.a, t.d || '', t.st || '', t.lt, t.ln]
        .map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(','));
    });
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Waterville_Dead_Tree_Cemetery_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }
</script>

<div class="dead-overlay" onclick={onClose}>
  <div class="dead-box" onclick={(e) => e.stopPropagation()}>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div>
        <div class="dead-title">Dead Tree Cemetery</div>
        <div class="dead-desc" style="margin-top:4px">
          Trees marked as removed are hidden from the main map but remain in the inventory. They can also be viewed on the map
          by selecting the <strong>Dead</strong> condition filter.
        </div>
      </div>
      <button class="list-btn" onclick={onClose}>Close</button>
    </div>

    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div>
        <div class="dead-count">{deadTrees.length}</div>
        <div class="dead-stat-lbl">Trees marked removed</div>
      </div>
    </div>

    <div>
      <div class="task-section" style="display:flex;align-items:center;justify-content:space-between">
        <span>Dead Tree Cemetery</span>
        <button class="list-btn primary" onclick={downloadCSV}>Download List</button>
      </div>
      <div class="dead-tree-list">
        {#if !deadTrees.length}
          <div style="font-size:.6rem;color:var(--parch-dim);font-style:italic;padding:10px 0">No trees marked as removed yet.</div>
        {:else}
          {#each deadTrees as t}
            <div class="dead-tree-row">
              <span style="flex:1">{t.pid || ('#' + t.id)} {t.n}</span>
              <span style="color:var(--parch-dim)">{t.st || '—'}</span>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .dead-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9995;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px 14px}
  .dead-box{background:var(--panel);border:1px solid rgba(184,53,53,.35);border-radius:8px;padding:24px 24px 20px;width:100%;max-width:580px;display:flex;flex-direction:column;gap:14px;margin:auto}
  .dead-title{font-family:'Playfair Display',serif;font-size:1.05rem;color:#e06060}
  .dead-desc{font-size:.6rem;color:var(--parch-dim);line-height:1.6}
  .dead-count{font-family:'Playfair Display',serif;font-size:1.6rem;color:#e06060}
  .dead-stat-lbl{font-size:.48rem;letter-spacing:.1em;text-transform:uppercase;color:var(--parch-dim)}
  .task-section{font-size:.5rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:6px}
  .dead-tree-list{display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto;margin-top:6px}
  .dead-tree-list::-webkit-scrollbar{width:3px}
  .dead-tree-list::-webkit-scrollbar-thumb{background:rgba(201,151,58,.3);border-radius:2px}
  .dead-tree-row{display:flex;align-items:center;gap:10px;padding:6px 10px;background:var(--panel2);border-radius:4px;font-size:.6rem;color:var(--parch)}
  .list-btn{background:transparent;border:1px solid var(--border);border-radius:3px;padding:4px 12px;font-family:'Outfit',sans-serif;font-size:.56rem;color:var(--parch-dim);cursor:pointer;transition:all .13s;flex-shrink:0}
  .list-btn:hover{border-color:var(--gold);color:var(--parch)}
  .list-btn.primary{background:var(--gold);border-color:var(--gold);color:var(--bark)}
  .list-btn.primary:hover{opacity:.85}
</style>
