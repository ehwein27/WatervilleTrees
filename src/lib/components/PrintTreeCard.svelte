<script>
  import { isEabRisk } from '$lib/utils/itree.js';
  import { sbGet } from '$lib/api/supabase.js';

  const APP_BASE_URL = 'https://waterville-trees.netlify.app';

  let { tree = null, onClose } = $props();
  let open = $state(false);
  let notes = $state([]);
  let eabFlagged = $state(false);

  export function show(t) {
    tree = t;
    open = true;
    loadData(t);
  }

  async function loadData(t) {
    try {
      const val = await sbGet('notes:' + t.id);
      notes = Array.isArray(val) ? val : JSON.parse(val);
    } catch { notes = []; }
    try {
      const flags = await sbGet('eab_flags');
      const arr = Array.isArray(flags) ? flags : JSON.parse(flags);
      eabFlagged = arr.includes(Number(t.id)) || arr.includes(t.id) || isEabRisk(t);
    } catch {
      eabFlagged = isEabRisk(t);
    }
  }

  function close() { open = false; onClose?.(); }

  function esc(v) { return v == null ? '' : String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  let genDate = $derived(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
  let fmt = (n) => '$' + Math.round(n).toLocaleString();

  function qrImgUrl(text) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(text)}`;
  }

  let pageUrl = $derived(tree ? (APP_BASE_URL + '?tree=' + tree.id) : null);
</script>

{#if open && tree}
  {@const t = tree}
  <div class="ptc-overlay">
    <button class="ptc-close-btn" onclick={close}>✕ Close</button>
    <button class="ptc-print-btn" onclick={() => window.print()}>🖨 Print</button>
    <div class="ptc-wrap">
      <div class="ptc-hdr">
        <div>
          <div class="ptc-title">{t.n || 'Unknown'}</div>
          <div class="ptc-sub">{t.s} &nbsp;·&nbsp; Tree #{t.id}{t.st ? ' &nbsp;·&nbsp; ' + t.st : ''}</div>
        </div>
        {#if pageUrl}
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0">
            <img class="ptc-qr" src={qrImgUrl(pageUrl)} alt="QR" title="Scan to open this tree record" />
            <span style="font-size:.42rem;color:#8e8e93;letter-spacing:.06em;text-transform:uppercase">Scan to open</span>
          </div>
        {:else}
          <div class="ptc-id-box">
            <span class="ptc-id-lbl">Tree ID</span>
            <span class="ptc-id-val">#{t.id}</span>
          </div>
        {/if}
      </div>

      <div class="ptc-grid">
        <div class="ptc-cell"><div class="ptc-lbl">Condition</div><div class="ptc-val ptc-{(t.c||'').toLowerCase()}">{t.c || '—'}</div></div>
        <div class="ptc-cell"><div class="ptc-lbl">Age Class</div><div class="ptc-val">{t.a || '—'}</div></div>
        <div class="ptc-cell"><div class="ptc-lbl">DBH</div><div class="ptc-val">{t.d}"</div></div>
        <div class="ptc-cell"><div class="ptc-lbl">EAB Risk</div><div class="ptc-val" style="color:{eabFlagged ? '#c0392b' : '#555'}">{eabFlagged ? '⚠ Flagged' : 'None'}</div></div>
        <div class="ptc-cell"><div class="ptc-lbl">Last Updated</div><div class="ptc-val">{t.u || '—'}</div></div>
      </div>

      <div class="ptc-sec">Structural Observations</div>
      {#if t.o?.length}
        <div class="ptc-obs-list">
          {#each t.o as obs}
            <span class="ptc-obs-tag">{obs}</span>
          {/each}
        </div>
      {:else}
        <span class="ptc-empty">No observations recorded.</span>
      {/if}

      <div class="ptc-sec">i-Tree Ecosystem Value</div>
      {#if t.vt}
        <div class="ptc-itree-grid">
          <div class="ptc-cell"><div class="ptc-lbl">Total Annual Value</div><div class="ptc-val" style="color:#2a7d24;font-family:'Playfair Display',Georgia,serif;font-size:1rem">{fmt(t.vt)}/yr</div></div>
          <div class="ptc-cell"><div class="ptc-lbl">CO₂ Sequestration</div><div class="ptc-val">{fmt(t.vc)}/yr</div></div>
          <div class="ptc-cell"><div class="ptc-lbl">Air Quality</div><div class="ptc-val">{fmt(t.va)}/yr</div></div>
          <div class="ptc-cell"><div class="ptc-lbl">Stormwater</div><div class="ptc-val">{fmt(t.vs)}/yr</div></div>
        </div>
      {:else}
        <span class="ptc-empty">No i-Tree value estimate available.</span>
      {/if}

      <div class="ptc-sec">Field Notes</div>
      {#if notes.length}
        <div class="ptc-notes-list">
          {#each notes as n}
            <div class="ptc-note">
              <div class="ptc-note-meta">{n.who} · {new Date(n.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              <div class="ptc-note-body">{n.txt}</div>
            </div>
          {/each}
        </div>
      {:else}
        <span class="ptc-empty">No field notes.</span>
      {/if}

      <div class="ptc-footer">
        <span>Waterville Urban Tree Inventory 2026 · Bartlett Tree Experts</span>
        <span>Printed {genDate}</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .ptc-overlay{position:fixed;inset:0;z-index:8000;background:#fff;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:24px}
  .ptc-close-btn{position:fixed;top:16px;right:80px;background:#f5f5f7;border:1px solid #d0d0d5;border-radius:6px;padding:6px 14px;font-family:'DM Mono',monospace;font-size:.6rem;color:#1c1c1e;cursor:pointer;z-index:8001}
  .ptc-print-btn{position:fixed;top:16px;right:16px;background:#1c1c1e;border:none;border-radius:6px;padding:6px 14px;font-family:'DM Mono',monospace;font-size:.6rem;color:#fff;cursor:pointer;z-index:8001}
  .ptc-wrap{max-width:680px;width:100%;background:#fff;padding:32px 28px;display:flex;flex-direction:column;gap:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1c1e}
  .ptc-hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:16px;border-bottom:2px solid #1c1c1e}
  .ptc-title{font-family:'Playfair Display',Georgia,serif;font-size:1.6rem;font-weight:700;color:#1c1c1e;line-height:1.2}
  .ptc-sub{font-size:.65rem;color:#8e8e93;margin-top:4px}
  .ptc-id-box{width:72px;height:72px;background:#f5f5f7;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;flex-shrink:0;border:1px dashed #d0d0d5}
  .ptc-qr{width:72px;height:72px;border-radius:4px;border:1px solid #e5e5ea}
  .ptc-id-lbl{font-size:.42rem;color:#8e8e93;letter-spacing:.06em;text-transform:uppercase;text-align:center;line-height:1.4}
  .ptc-id-val{font-size:.9rem;font-weight:700;color:#1c1c1e;font-family:'Playfair Display',serif}
  .ptc-grid,.ptc-itree-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .ptc-cell{background:#f5f5f7;border-radius:5px;padding:8px 10px}
  .ptc-lbl{font-size:.48rem;letter-spacing:.08em;text-transform:uppercase;color:#8e8e93;margin-bottom:3px}
  .ptc-val{font-size:.72rem;color:#1c1c1e;font-weight:500}
  .ptc-good{color:#2a7d24} .ptc-fair{color:#8a6c00} .ptc-poor{color:#b04e10} .ptc-dead{color:#8b1a1a}
  .ptc-risk-badge{display:inline-block;padding:2px 8px;border-radius:3px;color:#fff;font-size:.55rem;font-weight:600;letter-spacing:.04em}
  .ptc-sec{font-size:.55rem;letter-spacing:.12em;text-transform:uppercase;color:#1c1c1e;font-weight:700;border-bottom:1px solid #e5e5ea;padding-bottom:6px;margin-top:6px}
  .ptc-obs-list{display:flex;flex-wrap:wrap;gap:4px}
  .ptc-obs-tag{background:#f5f5f7;border:1px solid #e5e5ea;border-radius:3px;padding:3px 8px;font-size:.55rem;color:#3a3a3c}
  .ptc-empty{font-size:.6rem;color:#8e8e93;font-style:italic}
  .ptc-notes-list{display:flex;flex-direction:column;gap:8px}
  .ptc-note{background:#f5f5f7;border-radius:5px;padding:8px 10px}
  .ptc-note-meta{font-size:.48rem;color:#8e8e93;margin-bottom:3px}
  .ptc-note-body{font-size:.6rem;color:#1c1c1e;line-height:1.5}
  .ptc-footer{display:flex;justify-content:space-between;font-size:.48rem;color:#8e8e93;border-top:1px solid #e5e5ea;padding-top:10px;margin-top:12px}

  @media print {
    .ptc-close-btn,.ptc-print-btn{display:none}
    .ptc-overlay{position:static;padding:0}
  }
</style>
