<script>
  import { onMount } from 'svelte';
  import { trees } from '$lib/stores/trees.js';
  import { sbGet, sbSet } from '$lib/api/supabase.js';
  import { isEabRisk } from '$lib/utils/itree.js';
  import { condColor } from '$lib/utils/format.js';

  let { sdrType = '', onClose = () => {} } = $props();

  const SDR_CONFIGS = {
    condition: {
      title: 'Report by Condition',
      label: 'Condition Class',
      type: 'select',
      options: () => ['Good','Fair','Poor','Dead'],
      filter: (trees, val) => trees.filter(t => t.c === val),
      description: (val, n) => `${n} trees with condition "${val}"`,
    },
    species: {
      title: 'Report by Species',
      label: 'Species',
      type: 'select',
      options: () => [...new Set($trees.map(t => t.n).filter(Boolean))].sort(),
      filter: (trees, val) => trees.filter(t => t.n === val),
      description: (val, n) => `${n} ${val} trees in the inventory`,
    },
    age: {
      title: 'Report by Age Class',
      label: 'Age Class',
      type: 'select',
      options: () => ['Young','Semi-mature','Mature','Over-mature'],
      filter: (trees, val) => trees.filter(t => t.a === val),
      description: (val, n) => `${n} trees classified as "${val}"`,
    },
    location: {
      title: 'Report by Location',
      label: 'Street',
      type: 'select',
      options: () => [...new Set($trees.map(t => t.st).filter(Boolean))].sort(),
      filter: (trees, val) => trees.filter(t => t.st === val),
      description: (val, n) => `${n} trees on ${val}`,
    },
    value: {
      title: 'Report by i-Tree Value',
      label: 'Minimum Annual Value ($/yr)',
      type: 'number',
      placeholder: 'e.g. 100',
      filter: (trees, val) => {
        const min = parseFloat(val) || 0;
        return trees.filter(t => (t.vt || 0) >= min);
      },
      description: (val, n) => `${n} trees with annual value ≥ $${val}`,
    },
  };

  let cfg = $derived(SDR_CONFIGS[sdrType] || null);
  let filterVal = $state('');
  let reportName = $state('');
  let generating = $state(false);
  let savedReports = $state([]);

  onMount(() => { loadSaved(); });

  async function loadSaved() {
    try {
      const val = await sbGet('sdr_reports');
      savedReports = Array.isArray(val) ? val : JSON.parse(val);
    } catch { savedReports = []; }
  }

  async function saveReport(name, treeCount) {
    const rec = {
      id: Date.now().toString(36),
      name,
      date: new Date().toISOString(),
      type: sdrType,
      filterVal,
      treeCount,
    };
    savedReports = [rec, ...savedReports];
    await sbSet('sdr_reports', JSON.stringify(savedReports));
  }

  async function deleteReport(id) {
    savedReports = savedReports.filter(r => r.id !== id);
    await sbSet('sdr_reports', JSON.stringify(savedReports));
  }

  const COND_RANK = { Dead: 4, Poor: 3, Fair: 2, Good: 1 };

  function downloadSaved(r) {
    const savedCfg = SDR_CONFIGS[r.type];
    if (!savedCfg) return;
    const matched = savedCfg.filter($trees, r.filterVal);
    const sorted = [...matched].sort((a, b) => (COND_RANK[b.c] || 0) - (COND_RANK[a.c] || 0));
    const condCounts = { Good: 0, Fair: 0, Poor: 0, Dead: 0 };
    let totalVal = 0;
    sorted.forEach(t => {
      if (condCounts[t.c] !== undefined) condCounts[t.c]++;
      totalVal += t.vt || 0;
    });
    const title = r.name;
    const fmtK = n => n >= 1000 ? '$' + (n/1000).toFixed(1) + 'k' : '$' + Math.round(n);
    const condColors = { Good: '#5ec254', Fair: '#e8c34a', Poor: '#e07a30', Dead: '#d04444' };
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      body{font-family:'Outfit',sans-serif;background:#faf6ee;color:#1a1507;margin:0;padding:0}
      .cover{text-align:center;padding:48px 24px 32px}
      .cover h1{font-family:'Playfair Display',serif;font-size:1.8rem;color:#0f2e14;margin:0 0 6px}
      .cover p{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:#5c3d08}
      .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;max-width:700px;margin:24px auto;padding:0 20px}
      .kpi{background:#f0e8d0;border:1px solid rgba(120,80,20,.18);border-radius:6px;padding:14px;text-align:center}
      .kpi-n{font-family:'Playfair Display',serif;font-size:1.6rem;color:#1a5216}
      .kpi-l{font-size:.5rem;letter-spacing:.1em;text-transform:uppercase;color:#5c3d08;margin-top:2px}
      table{width:100%;max-width:900px;margin:20px auto;border-collapse:collapse;font-size:.58rem}
      th{background:#e8dcc4;text-align:left;padding:6px 8px;font-size:.5rem;letter-spacing:.08em;text-transform:uppercase;color:#5c3d08;border-bottom:2px solid rgba(120,80,20,.3)}
      td{padding:5px 8px;border-bottom:1px solid rgba(120,80,20,.12)}
      tr:nth-child(even){background:rgba(240,232,208,.3)}
      .cond-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:middle}
    </style></head><body>
    <div class="cover"><h1>${title}</h1><p>Waterville Tree Inventory — Generated ${new Date().toLocaleDateString()}</p></div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-n">${sorted.length}</div><div class="kpi-l">Trees</div></div>
      <div class="kpi"><div class="kpi-n">${fmtK(totalVal)}</div><div class="kpi-l">Annual Value</div></div>
      <div class="kpi"><div class="kpi-n">${condCounts.Good}</div><div class="kpi-l">Good</div></div>
      <div class="kpi"><div class="kpi-n" style="color:#d04444">${condCounts.Poor + condCounts.Dead}</div><div class="kpi-l">Poor/Dead</div></div>
    </div>
    <table><thead><tr><th>#</th><th>ID</th><th>Species</th><th>Condition</th><th>DBH</th><th>Age</th><th>Street</th><th>Value</th></tr></thead><tbody>
    ${sorted.slice(0, 300).map((t, i) => {
      return `<tr>
        <td>${i+1}</td><td>${t.id}</td><td>${t.n}</td>
        <td><span class="cond-dot" style="background:${condColors[t.c]||'#888'}"></span>${t.c||'—'}</td>
        <td>${t.d ? t.d + '"' : '—'}</td><td>${t.a||'—'}</td><td>${t.st||'—'}</td>
        <td>${t.vt ? '$'+t.vt : '—'}</td>
      </tr>`;
    }).join('')}
    </tbody></table>
    ${sorted.length > 300 ? '<p style="text-align:center;font-size:.58rem;color:#5c3d08">Showing first 300 of '+sorted.length+' trees</p>' : ''}
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (title.replace(/[^a-z0-9]/gi, '_') || 'SDR_Report') + '.html';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  let preview = $derived((() => {
    if (!cfg || !filterVal) return null;
    const matched = cfg.filter($trees, filterVal);
    const totalVal = matched.reduce((s, t) => s + (t.vt || 0), 0);
    return { count: matched.length, totalVal, desc: cfg.description(filterVal, matched.length) };
  })());

  async function generateSDR() {
    if (!cfg || !filterVal || !preview) return;
    generating = true;

    const matched = cfg.filter($trees, filterVal);
    const sorted = [...matched].sort((a, b) => (COND_RANK[b.c] || 0) - (COND_RANK[a.c] || 0));

    const condCounts = { Good: 0, Fair: 0, Poor: 0, Dead: 0 };
    let totalVal = 0;
    sorted.forEach(t => {
      if (condCounts[t.c] !== undefined) condCounts[t.c]++;
      totalVal += t.vt || 0;
    });

    const title = reportName.trim() || `${cfg.title} — ${filterVal}`;
    await saveReport(title, matched.length);
    const fmtK = n => n >= 1000 ? '$' + (n/1000).toFixed(1) + 'k' : '$' + Math.round(n);
    const condColors = { Good: '#5ec254', Fair: '#e8c34a', Poor: '#e07a30', Dead: '#d04444' };

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      body{font-family:'Outfit',sans-serif;background:#faf6ee;color:#1a1507;margin:0;padding:0}
      .cover{text-align:center;padding:48px 24px 32px}
      .cover h1{font-family:'Playfair Display',serif;font-size:1.8rem;color:#0f2e14;margin:0 0 6px}
      .cover p{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:#5c3d08}
      .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;max-width:700px;margin:24px auto;padding:0 20px}
      .kpi{background:#f0e8d0;border:1px solid rgba(120,80,20,.18);border-radius:6px;padding:14px;text-align:center}
      .kpi-n{font-family:'Playfair Display',serif;font-size:1.6rem;color:#1a5216}
      .kpi-l{font-size:.5rem;letter-spacing:.1em;text-transform:uppercase;color:#5c3d08;margin-top:2px}
      table{width:100%;max-width:900px;margin:20px auto;border-collapse:collapse;font-size:.58rem}
      th{background:#e8dcc4;text-align:left;padding:6px 8px;font-size:.5rem;letter-spacing:.08em;text-transform:uppercase;color:#5c3d08;border-bottom:2px solid rgba(120,80,20,.3)}
      td{padding:5px 8px;border-bottom:1px solid rgba(120,80,20,.12)}
      tr:nth-child(even){background:rgba(240,232,208,.3)}
      .cond-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:middle}
    </style></head><body>
    <div class="cover"><h1>${title}</h1><p>Waterville Tree Inventory — Generated ${new Date().toLocaleDateString()}</p></div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-n">${sorted.length}</div><div class="kpi-l">Trees</div></div>
      <div class="kpi"><div class="kpi-n">${fmtK(totalVal)}</div><div class="kpi-l">Annual Value</div></div>
      <div class="kpi"><div class="kpi-n">${condCounts.Good}</div><div class="kpi-l">Good</div></div>
      <div class="kpi"><div class="kpi-n" style="color:#d04444">${condCounts.Poor + condCounts.Dead}</div><div class="kpi-l">Poor/Dead</div></div>
    </div>
    <table><thead><tr><th>#</th><th>ID</th><th>Species</th><th>Condition</th><th>DBH</th><th>Age</th><th>Street</th><th>Value</th></tr></thead><tbody>
    ${sorted.slice(0, 300).map((t, i) => {
      return `<tr>
        <td>${i+1}</td><td>${t.id}</td><td>${t.n}</td>
        <td><span class="cond-dot" style="background:${condColors[t.c]||'#888'}"></span>${t.c||'—'}</td>
        <td>${t.d ? t.d + '"' : '—'}</td><td>${t.a||'—'}</td><td>${t.st||'—'}</td>
        <td>${t.vt ? '$'+t.vt : '—'}</td>
      </tr>`;
    }).join('')}
    </tbody></table>
    ${sorted.length > 300 ? '<p style="text-align:center;font-size:.58rem;color:#5c3d08">Showing first 300 of '+sorted.length+' trees</p>' : ''}
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (title.replace(/[^a-z0-9]/gi, '_') || 'SDR_Report') + '.html';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);

    generating = false;
    onClose();
  }
</script>

{#if cfg}
<div class="modal-overlay" onclick={onClose}>
  <div class="modal-box" onclick={(e) => e.stopPropagation()}>
    <div class="modal-hdr">
      <div class="modal-title">{cfg.title}</div>
      <button class="modal-close" onclick={onClose}>✕</button>
    </div>
    <div class="modal-body">
      {#if savedReports.length > 0}
        <div class="saved-section">
          <div class="saved-hdr">Saved Reports</div>
          {#each savedReports as r}
            <div class="saved-row">
              <div class="saved-info">
                <div class="saved-name">{r.name}</div>
                <div class="saved-meta">{new Date(r.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} · {r.treeCount} trees · <em>{r.filterVal}</em></div>
              </div>
              <button class="saved-dl" onclick={() => downloadSaved(r)} title="Download">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button class="saved-del" onclick={() => deleteReport(r.id)}>✕</button>
            </div>
          {/each}
        </div>
      {/if}
      <div class="field">
        <div class="field-lbl">{cfg.label}</div>
        {#if cfg.type === 'select'}
          <select class="field-sel" bind:value={filterVal}>
            <option value="">— select —</option>
            {#each cfg.options() as opt}
              <option value={opt}>{opt}</option>
            {/each}
          </select>
        {:else}
          <input class="field-inp" type="number" placeholder={cfg.placeholder || ''} bind:value={filterVal} />
        {/if}
      </div>

      <div class="field">
        <div class="field-lbl">Report Name (optional)</div>
        <input class="field-inp" type="text" placeholder="e.g. Spring 2026 Assessment" bind:value={reportName} />
      </div>

      {#if preview}
        <div class="preview">
          <div class="preview-count">{preview.count} trees</div>
          <div class="preview-desc">{preview.desc}</div>
          <div class="preview-val">Combined annual value: ${Math.round(preview.totalVal).toLocaleString()}/yr</div>
        </div>
      {/if}
    </div>
    <div class="modal-footer">
      <button class="btn-cancel" onclick={onClose}>Cancel</button>
      <button class="btn-generate" onclick={generateSDR} disabled={!preview || !preview.count || generating}>
        {generating ? 'Generating…' : 'Generate Report'}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9996;display:flex;align-items:center;justify-content:center;padding:20px}
  .modal-box{background:var(--panel);border:1px solid rgba(201,151,58,.3);border-radius:8px;width:100%;max-width:480px;display:flex;flex-direction:column;gap:0}
  .modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid var(--border)}
  .modal-title{font-family:'Playfair Display',serif;font-size:1rem;color:var(--canopy)}
  .modal-close{background:transparent;border:none;color:var(--parch-dim);font-size:1rem;cursor:pointer}
  .modal-close:hover{color:var(--parch)}
  .modal-body{padding:16px 18px;display:flex;flex-direction:column;gap:14px}
  .modal-footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--border)}
  .field{display:flex;flex-direction:column;gap:4px}
  .field-lbl{font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}
  .field-sel,.field-inp{background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:6px 8px;font-family:'Outfit',sans-serif;font-size:.65rem;color:var(--parch);width:100%}
  .field-sel{cursor:pointer}
  .field-sel:focus,.field-inp:focus{outline:none;border-color:var(--gold)}
  .field-sel option{background:var(--panel)}
  .preview{background:var(--panel2);border:1px solid var(--border);border-radius:5px;padding:10px 12px}
  .preview-count{font-family:'Playfair Display',serif;font-size:1.2rem;color:var(--canopy)}
  .preview-desc{font-size:.58rem;color:var(--parch-dim);margin-top:2px}
  .preview-val{font-size:.58rem;color:var(--gold);margin-top:4px}
  .btn-cancel{background:transparent;border:1px solid var(--border);border-radius:3px;padding:5px 14px;font-family:'Outfit',sans-serif;font-size:.6rem;color:var(--parch-dim);cursor:pointer}
  .btn-cancel:hover{border-color:var(--gold);color:var(--parch)}
  .btn-generate{background:var(--gold);border:none;border-radius:3px;padding:5px 14px;font-family:'Outfit',sans-serif;font-size:.6rem;color:var(--bark);cursor:pointer;font-weight:500}
  .btn-generate:hover{opacity:.85}
  .btn-generate:disabled{opacity:.5;cursor:not-allowed}
  .saved-section{display:flex;flex-direction:column;gap:4px;padding-bottom:10px;border-bottom:1px solid var(--border)}
  .saved-hdr{font-size:.48rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:2px}
  .saved-row{display:flex;align-items:center;gap:8px;background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:6px 10px}
  .saved-info{flex:1;min-width:0}
  .saved-name{font-size:.6rem;color:var(--parch);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .saved-meta{font-size:.52rem;color:var(--parch-dim);margin-top:1px}
  .saved-dl{background:transparent;border:1px solid var(--border);border-radius:3px;color:var(--parch-dim);cursor:pointer;padding:3px 6px;flex-shrink:0;display:inline-flex;align-items:center}
  .saved-dl:hover{border-color:var(--gold);color:var(--parch)}
  .saved-del{background:transparent;border:none;color:rgba(184,53,53,.5);cursor:pointer;font-size:.7rem;padding:0 2px;flex-shrink:0}
  .saved-del:hover{color:var(--red)}
</style>
