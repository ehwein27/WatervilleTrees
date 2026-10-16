<script>
  import { onMount } from 'svelte';
  import { trees } from '$lib/stores/trees.js';
  import { sbGet, sbSet, fetchRLists } from '$lib/api/supabase.js';
  import { priorityScore, priorityLevel, isEabRisk } from '$lib/utils/itree.js';
  import { streetsList } from '$lib/stores/ui.js';
  let { onClose = () => {} } = $props();
  let tab            = $state('new'); // 'new' | 'saved'
  let scope          = $state('immediate');
  let reportName     = $state('Tree Health & Priority Report — ' + new Date().toLocaleDateString());
  let selectedStreet = $state('');
  let selectedListId = $state('');
  let searchQ        = $state('');
  let customIds      = $state(new Set());
  let expandedTreeId = $state(null);
  let generating     = $state(false);
  let savedReports   = $state([]);
  let availableLists = $state([]);

  let livingTrees = $derived($trees.filter(t => t.c !== 'Dead'));
  let deadTrees   = $derived(
    $trees.filter(t => t.c === 'Dead')
      .sort((a, b) => (parseFloat(b.d) || 0) - (parseFloat(a.d) || 0))
  );

  let scoredLiving = $derived(
    livingTrees.map(t => ({ ...t, _ps: priorityScore(t) }))
      .sort((a, b) => a._ps.displayScore - b._ps.displayScore)
  );

  let scopeTrees = $derived((() => {
    switch (scope) {
      case 'immediate':
        return scoredLiving.filter(t => t._ps.displayScore <= 65);
      case 'eab':
        return scoredLiving.filter(t => isEabRisk(t));
      case 'street':
        return selectedStreet ? scoredLiving.filter(t => t.st === selectedStreet) : [];
      case 'list': {
        const lst = availableLists.find(l => l.id === selectedListId);
        if (!lst) return [];
        return scoredLiving.filter(t =>
          lst.trees.includes(t.id) || lst.trees.includes(Number(t.id))
        );
      }
      case 'custom':
        return scoredLiving.filter(t => customIds.has(t.id));
      case 'full':
      default:
        return scoredLiving;
    }
  })());

  let scopeDead = $derived((() => {
    if (scope === 'eab' || scope === 'custom') return [];
    if (scope === 'street')
      return selectedStreet ? deadTrees.filter(t => t.st === selectedStreet) : [];
    if (scope === 'list') {
      const lst = availableLists.find(l => l.id === selectedListId);
      if (!lst) return [];
      return deadTrees.filter(t =>
        lst.trees.includes(t.id) || lst.trees.includes(Number(t.id))
      );
    }
    return deadTrees; // 'immediate' and 'full'
  })());

  let stats = $derived((() => {
    const critical = scopeTrees.filter(t => t._ps.displayScore <= 40).length;
    const high     = scopeTrees.filter(t => t._ps.displayScore > 40 && t._ps.displayScore <= 65).length;
    const moderate = scopeTrees.filter(t => t._ps.displayScore > 65 && t._ps.displayScore <= 82).length;
    const low      = scopeTrees.filter(t => t._ps.displayScore > 82).length;
    const eabCount = scopeTrees.filter(t => isEabRisk(t)).length
                   + scopeDead.filter(t => isEabRisk(t)).length;
    const totalVal = [...scopeTrees, ...scopeDead].reduce((s, t) => s + (t.vt || 0), 0);
    return { critical, high, moderate, low, eabCount, totalVal, deadCount: scopeDead.length };
  })());

  let filteredPicker = $derived((() => {
    const q = searchQ.toLowerCase();
    return $trees.filter(t =>
      !q || t.n.toLowerCase().includes(q) || (t.s || '').toLowerCase().includes(q) ||
      t.id.includes(q) || (t.st || '').toLowerCase().includes(q)
    ).slice(0, 200);
  })());

  let canGenerate = $derived(
    !generating &&
    (scopeTrees.length > 0 || scopeDead.length > 0) &&
    (scope !== 'street' || selectedStreet) &&
    (scope !== 'list' || selectedListId) &&
    (scope !== 'custom' || customIds.size > 0)
  );

  function toggleCustom(id) {
    customIds = new Set(customIds);
    customIds.has(id) ? customIds.delete(id) : customIds.add(id);
  }

  function toggleExpand(id) {
    expandedTreeId = expandedTreeId === id ? null : id;
  }

  async function loadSaved() {
    try { savedReports = JSON.parse(await sbGet('priority_reports')); } catch { savedReports = []; }
  }
  async function loadLists() {
    availableLists = await fetchRLists();
  }
  async function saveSavedReports() {
    await sbSet('priority_reports', JSON.stringify(savedReports));
  }
  async function deleteReport(id) {
    savedReports = savedReports.filter(r => r.id !== id);
    await saveSavedReports();
  }


  onMount(() => Promise.all([loadSaved(), loadLists()]));

  function getScopeLabel(sc, street, listId) {
    switch (sc) {
      case 'immediate': return 'Scope: Immediate Action — Critical & High Priority';
      case 'eab':       return 'Scope: EAB Monitoring — Ash Species';
      case 'street':    return `Scope: By Street — ${street || 'All'}`;
      case 'list':      return 'Scope: From Removal List';
      case 'custom':    return 'Scope: Custom Selection';
      case 'full':      return 'Scope: Full Inventory';
      default:          return '';
    }
  }

  function buildHtml(title, lTrees, dTrees, label) {
    const critical = lTrees.filter(t => t._ps.displayScore <= 40).length;
    const high     = lTrees.filter(t => t._ps.displayScore > 40 && t._ps.displayScore <= 65).length;
    const eabAll   = [...lTrees, ...dTrees].filter(t => isEabRisk(t));
    const date     = new Date().toLocaleDateString();

    const livingRows = lTrees.map(t => {
      const { displayScore, factors } = t._ps;
      const { label: tier, color } = priorityLevel(displayScore);
      const top2 = factors.slice(0, 2).map(f => f.txt).join(', ')
        + (factors.length > 2 ? ` +${factors.length - 2} more` : '');
      const rowBg = displayScore <= 40 ? 'background:rgba(176,53,53,0.06);' : '';
      const eabBadge = isEabRisk(t) ? ' <span class="eab-badge">EAB</span>' : '';
      return `<tr style="${rowBg}">
        <td><span class="tier-badge" style="background:${color}20;color:${color};border:1px solid ${color}60">${tier}</span> <strong>${displayScore}</strong></td>
        <td>${t.n || '—'}${eabBadge}</td>
        <td>${t.d ? t.d + '"' : '—'}</td>
        <td>${t.c || '—'}</td>
        <td>${t.st || '—'}</td>
        <td class="factors-cell">${top2 || '—'}</td>
      </tr>`;
    }).join('');

    const deadRows = dTrees.map((t, i) => `<tr>
      <td>${i + 1}</td>
      <td>${t.n || '—'}${isEabRisk(t) ? ' <span class="eab-badge">EAB</span>' : ''}</td>
      <td>${t.d ? t.d + '"' : '—'}</td>
      <td>${t.st || '—'}</td>
      <td class="factors-cell">${(t.o || []).slice(0, 2).join(', ') || '—'}</td>
    </tr>`).join('');

    const eabSection = eabAll.length > 0 ? `
<div class="section-hd">EAB Risk — Ash Species (${eabAll.length} trees)</div>
<p class="note">The following ash trees are flagged for Emerald Ash Borer (EAB) risk. EAB causes near-certain mortality in untreated ash trees. These trees are included in the tables above and are repeated here for reference.</p>
<table>
  <thead><tr><th>Species</th><th>DBH</th><th>Condition</th><th>Street</th><th>Priority Score</th></tr></thead>
  <tbody>${eabAll.map(t => {
    const isDead = t.c === 'Dead';
    const scoreStr = isDead ? '<em>Dead</em>'
      : (t._ps ? `${t._ps.displayScore} — ${priorityLevel(t._ps.displayScore).label}` : '—');
    return `<tr>
      <td>${t.n || '—'}</td>
      <td>${t.d ? t.d + '"' : '—'}</td>
      <td>${t.c || '—'}</td>
      <td>${t.st || '—'}</td>
      <td>${scoreStr}</td>
    </tr>`;
  }).join('')}</tbody>
</table>` : '';

    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  body{font-family:'Outfit',sans-serif;background:#faf6ee;color:#1a1507;margin:0;padding:0}
  .cover{text-align:center;padding:48px 24px 32px}
  .cover-label{font-size:.5rem;letter-spacing:.14em;text-transform:uppercase;color:#5c3d08;margin-bottom:10px}
  .cover h1{font-family:'Playfair Display',serif;font-size:2rem;color:#0f2e14;margin:0 0 8px}
  .cover-sub{font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;color:#7a6030;margin-top:4px}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;max-width:720px;margin:28px auto;padding:0 24px}
  .kpi{background:#f0e8d0;border:1px solid rgba(120,80,20,.18);border-radius:6px;padding:16px;text-align:center}
  .kpi-n{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700}
  .kpi-l{font-size:.46rem;letter-spacing:.1em;text-transform:uppercase;color:#5c3d08;margin-top:3px}
  .summary-prose{max-width:720px;margin:0 auto 24px;padding:0 24px;font-size:.62rem;color:#3a2a0a;line-height:1.6}
  .methodology-box{max-width:720px;margin:0 auto 28px;padding:14px 20px;background:#f5f0e4;border:1px solid rgba(120,80,20,.22);border-radius:5px}
  .methodology-box strong{font-size:.54rem;letter-spacing:.1em;text-transform:uppercase;color:#5c3d08;display:block;margin-bottom:6px}
  .methodology-box p{font-size:.58rem;color:#3a2a0a;line-height:1.6;margin:0}
  .section-hd{font-family:'Playfair Display',serif;font-size:1.1rem;color:#0f2e14;max-width:900px;margin:32px auto 8px;padding:0 24px 6px;border-bottom:1px solid rgba(120,80,20,.2)}
  table{width:100%;max-width:900px;margin:8px auto 24px;border-collapse:collapse;font-size:.58rem}
  th{background:#e8dcc4;text-align:left;padding:6px 8px;font-size:.46rem;letter-spacing:.09em;text-transform:uppercase;color:#5c3d08;border-bottom:2px solid rgba(120,80,20,.3)}
  td{padding:5px 8px;border-bottom:1px solid rgba(120,80,20,.1);vertical-align:middle}
  .tier-badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:.5rem;font-weight:500}
  .eab-badge{display:inline-block;padding:0 4px;border-radius:2px;font-size:.46rem;font-weight:500;background:rgba(201,151,58,.2);color:#8a5c00;border:1px solid rgba(201,151,58,.4);margin-left:4px}
  .factors-cell{color:#7a6030;font-size:.5rem}
  .dead-note{font-style:italic;font-size:.56rem;color:#5c3d08;max-width:900px;margin:0 auto 8px;padding:0 24px}
  .note{font-size:.58rem;color:#3a2a0a;line-height:1.6;max-width:900px;margin:0 auto 12px;padding:0 24px}
  @media print{
    body{background:#fff}
    .cover,.kpi-grid,.summary-prose,.methodology-box{page-break-inside:avoid}
    table{page-break-inside:auto}
    tr{page-break-inside:avoid;page-break-after:auto}
    thead{display:table-header-group}
    .no-print{display:none}
    a{text-decoration:none;color:inherit}
  }
</style></head><body>
<div class="cover">
  <div class="cover-label">City of Waterville — Urban Tree Inventory</div>
  <h1>${title}</h1>
  <div class="cover-sub">Generated ${date} · ${lTrees.length} trees assessed</div>
  <div class="cover-sub">${label}</div>
</div>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-n" style="color:#d04444">${critical}</div><div class="kpi-l">Critical</div></div>
  <div class="kpi"><div class="kpi-n" style="color:#d06828">${high}</div><div class="kpi-l">High</div></div>
  <div class="kpi"><div class="kpi-n" style="color:#6b1a1a">${dTrees.length}</div><div class="kpi-l">Dead</div></div>
  <div class="kpi"><div class="kpi-n" style="color:#c9973a">${eabAll.length}</div><div class="kpi-l">EAB Flags</div></div>
</div>
<div class="summary-prose">${critical + high} tree${critical + high !== 1 ? 's' : ''} require immediate attention (Critical or High priority). ${dTrees.length} dead tree${dTrees.length !== 1 ? 's are' : ' is'} scheduled for removal review.</div>
<div class="methodology-box">
  <strong>About the Priority Score</strong>
  <p>Priority Scores are calculated from each tree's condition rating and recorded structural observations, including defects such as stem cavities, co-dominant stems, included bark, and similar indicators. Scores range from 0–100; lower scores indicate more urgent attention. This is a planning and triage tool — it is not a formal ISA TRAQ risk assessment.</p>
</div>
<div class="section-hd">Living Trees — Prioritized by Urgency (${lTrees.length} trees)</div>
<table>
  <thead><tr><th>Priority</th><th>Species</th><th>DBH</th><th>Condition</th><th>Street</th><th>Key Factors</th></tr></thead>
  <tbody>${livingRows}</tbody>
</table>
${dTrees.length > 0 ? `
<div class="section-hd">Dead Trees (${dTrees.length} trees)</div>
<p class="dead-note">Dead trees are listed separately. Priority scoring does not apply.</p>
<table>
  <thead><tr><th>#</th><th>Species</th><th>DBH</th><th>Street</th><th>Notes</th></tr></thead>
  <tbody>${deadRows}</tbody>
</table>` : ''}
${eabSection}
</body></html>`;
  }

  function generateReport() {
    generating = true;
    const title = reportName.trim() || 'Tree Health & Priority Report';
    const label = getScopeLabel(scope, selectedStreet, selectedListId);
    const html = buildHtml(title, scopeTrees, scopeDead, label);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title.replace(/[^a-z0-9]/gi, '_') + '.html';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);

    const record = {
      id: Date.now().toString(36),
      name: title,
      date: new Date().toISOString(),
      scope,
      listId: selectedListId || undefined,
      treeCount: scopeTrees.length + scopeDead.length,
      criticalCount: stats.critical,
      deadCount: stats.deadCount,
    };
    savedReports = [record, ...savedReports];
    saveSavedReports();
    generating = false;
  }

  function downloadSaved(r) {
    const allLiving = $trees.filter(t => t.c !== 'Dead')
      .map(t => ({ ...t, _ps: priorityScore(t) }))
      .sort((a, b) => a._ps.displayScore - b._ps.displayScore);
    const allDead = $trees.filter(t => t.c === 'Dead')
      .sort((a, b) => (parseFloat(b.d) || 0) - (parseFloat(a.d) || 0));

    let st, sd;
    if (r.scope === 'immediate') {
      st = allLiving.filter(t => t._ps.displayScore <= 65);
      sd = allDead;
    } else if (r.scope === 'eab') {
      st = allLiving.filter(t => isEabRisk(t));
      sd = [];
    } else if (r.scope === 'list' && r.listId) {
      const lst = availableLists.find(l => l.id === r.listId);
      if (lst) {
        st = allLiving.filter(t => lst.trees.includes(t.id) || lst.trees.includes(Number(t.id)));
        sd = allDead.filter(t => lst.trees.includes(t.id) || lst.trees.includes(Number(t.id)));
      } else { st = allLiving; sd = allDead; }
    } else {
      st = allLiving;
      sd = allDead;
    }

    const scopeLabels = {
      immediate: 'Scope: Immediate Action — Critical & High Priority',
      eab: 'Scope: EAB Monitoring — Ash Species',
      full: 'Scope: Full Inventory',
      list: 'Scope: From Removal List',
      custom: 'Scope: Custom Selection',
      street: 'Scope: By Street',
    };
    const html = buildHtml(r.name, st, sd, scopeLabels[r.scope] || '');
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = r.name.replace(/[^a-z0-9]/gi, '_') + '.html';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }
</script>

<div class="modal-overlay" onclick={onClose}>
  <div class="modal-box" onclick={(e) => e.stopPropagation()}>
    <div class="modal-hdr">
      <div class="modal-title">Tree Health &amp; Priority Report</div>
      <div style="display:flex;align-items:center;gap:8px">
        <button class="modal-close" onclick={onClose}>✕</button>
      </div>
    </div>

    <div class="rpt-tabbar">
      <button class="rpt-tab" class:on={tab === 'new'} onclick={() => tab = 'new'}>New Report</button>
      <button class="rpt-tab" class:on={tab === 'saved'} onclick={() => tab = 'saved'}>
        Saved Reports{savedReports.length ? ` (${savedReports.length})` : ''}
      </button>
    </div>

    {#if tab === 'saved'}
      <div class="modal-body">
        {#if savedReports.length}
          {#each savedReports as r}
            <div class="saved-row">
              <div class="saved-info">
                <div class="saved-name">{r.name}</div>
                <div class="saved-meta">{new Date(r.date).toLocaleDateString()} · {r.treeCount} trees · {r.criticalCount} critical · {r.deadCount} dead</div>
              </div>
              <button class="rl-btn" onclick={() => downloadSaved(r)} title="Download">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button class="rl-btn danger" onclick={() => deleteReport(r.id)} title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          {/each}
        {:else}
          <div class="saved-empty">No saved reports yet. Generate a report to save it here.</div>
        {/if}
      </div>
    {:else}
    <div class="modal-body">

      <div class="field">
        <div class="field-lbl">Report Name</div>
        <input class="field-inp" type="text" bind:value={reportName} />
      </div>

      <div class="field">
        <div class="field-lbl">Scope</div>
        <div class="rpt-scope-grid">
          <button class="rpt-scope-btn" class:on={scope === 'immediate'} onclick={() => scope = 'immediate'}>
            <span class="rpt-scope-icon ic">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </span>
            Immediate Action
          </button>
          <button class="rpt-scope-btn" class:on={scope === 'eab'} onclick={() => scope = 'eab'}>
            <span class="rpt-scope-icon ic">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
            </span>
            EAB Monitoring
          </button>
          <button class="rpt-scope-btn" class:on={scope === 'street'} onclick={() => scope = 'street'}>
            <span class="rpt-scope-icon ic">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            By Street
          </button>
          <button class="rpt-scope-btn" class:on={scope === 'full'} onclick={() => scope = 'full'}>
            <span class="rpt-scope-icon ic">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/></svg>
            </span>
            Full Inventory
          </button>
          <button class="rpt-scope-btn" class:on={scope === 'list'} onclick={() => scope = 'list'}>
            <span class="rpt-scope-icon ic">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="12" y1="11" x2="16" y2="11"/><line x1="12" y1="16" x2="16" y2="16"/><line x1="8" y1="11" x2="8.01" y2="11"/><line x1="8" y1="16" x2="8.01" y2="16"/></svg>
            </span>
            From Removal List
          </button>
          <button class="rpt-scope-btn" class:on={scope === 'custom'} onclick={() => scope = 'custom'}>
            <span class="rpt-scope-icon ic">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </span>
            Custom Selection
          </button>
        </div>
      </div>

      {#if scope === 'street'}
        <div class="field" style="margin-top:6px">
          <div class="field-lbl">Choose Street</div>
          <select class="field-inp" bind:value={selectedStreet} style="font-size:.62rem">
            <option value="">— select a street —</option>
            {#each $streetsList as st}
              <option value={st}>{st}</option>
            {/each}
          </select>
        </div>
      {/if}

      {#if scope === 'list'}
        <div class="field" style="margin-top:6px">
          <div class="field-lbl">Choose List</div>
          <select class="field-inp" bind:value={selectedListId} style="font-size:.62rem">
            <option value="">— select a removal list —</option>
            {#each availableLists as lst}
              <option value={lst.id}>{lst.name} ({lst.trees.length} trees)</option>
            {/each}
          </select>
        </div>
      {/if}

      {#if scope === 'custom'}
        <div class="field" style="margin-top:6px">
          <input class="field-inp" type="text" placeholder="Search by name, species, ID…" bind:value={searchQ} />
          <div class="picker-count">{customIds.size} trees selected</div>
          <div class="tree-picker">
            {#each filteredPicker as t}
              {@const cc = {Good:'cg',Fair:'cf',Poor:'cp',Dead:'cd'}[t.c] || ''}
              <label class="rpt-tree-item">
                <input type="checkbox" checked={customIds.has(t.id)} onchange={() => toggleCustom(t.id)} />
                <span class="rpt-tree-item-name">#{t.id} {t.n}</span>
                <span class="rpt-tree-item-meta {cc}">{t.c}</span>
              </label>
            {:else}
              <div style="font-size:.56rem;color:var(--parch-dim);padding:6px 8px">No trees match.</div>
            {/each}
          </div>
        </div>
      {/if}

      {#if scopeTrees.length > 0 || scopeDead.length > 0}
        <div class="summary-pills-row">
          <span class="pill" style="color:#d04444;border-color:#d04444">Critical: {stats.critical}</span>
          <span class="pill" style="color:#d06828;border-color:#d06828">High: {stats.high}</span>
          <span class="pill" style="color:#d4ae30;border-color:#d4ae30">Moderate: {stats.moderate}</span>
          <span class="pill" style="color:#5ec254;border-color:#5ec254">Low: {stats.low}</span>
          {#if stats.deadCount > 0}
            <span class="pill" style="color:#a03030;border-color:#6b1a1a">Dead: {stats.deadCount}</span>
          {/if}
          {#if stats.eabCount > 0}
            <span class="pill" style="color:var(--gold);border-color:var(--gold)">EAB Flags: {stats.eabCount}</span>
          {/if}
        </div>

        <div class="field">
          <div class="field-lbl">Preview — {scopeTrees.length} tree{scopeTrees.length !== 1 ? 's' : ''}</div>
          <div class="preview-list">
            {#each scopeTrees.slice(0, 8) as t}
              {@const { displayScore, factors } = t._ps}
              {@const { label, color } = priorityLevel(displayScore)}
              <div class="preview-row" onclick={() => toggleExpand(t.id)}>
                <span class="preview-tier" style="background:{color}22;color:{color};border:1px solid {color}55">{label}</span>
                <span class="preview-name">{t.n || '—'}{isEabRisk(t) ? ' ·EAB' : ''}</span>
                <span class="preview-street">{t.st || '—'}</span>
                <span class="preview-score" style="color:{color}">{displayScore}</span>
                <span class="preview-chevron" class:open={expandedTreeId === t.id}>›</span>
              </div>
              {#if expandedTreeId === t.id}
                <div class="factor-breakdown">
                  {#each factors as f}
                    <div class="factor-row">
                      <span>{f.txt}</span>
                      <span class="factor-pts">−{f.pts} pts</span>
                    </div>
                  {/each}
                  <div class="factor-total">
                    Priority Score: {displayScore} / 100 &nbsp;→&nbsp; <strong style="color:{color}">{label}</strong>
                  </div>
                </div>
              {/if}
            {/each}
            {#if scopeTrees.length > 8}
              <div class="preview-more">…and {scopeTrees.length - 8} more in the exported report</div>
            {/if}
          </div>
        </div>
      {/if}

      {#if scopeDead.length > 0}
        <div class="field">
          <div class="field-lbl dead-lbl">{scopeDead.length} dead tree{scopeDead.length !== 1 ? 's' : ''}</div>
          <div class="dead-preview">
            {#each scopeDead.slice(0, 4) as t}
              <div class="dead-row">
                <span class="dead-species">{t.n || '—'}</span>
                <span class="dead-street">{t.st || '—'}</span>
                {#if t.d}<span class="dead-dbh">{t.d}"</span>{/if}
              </div>
            {/each}
            {#if scopeDead.length > 4}
              <div class="preview-more">…and {scopeDead.length - 4} more</div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn-cancel" onclick={onClose}>Cancel</button>
      <button class="btn-generate" onclick={generateReport} disabled={!canGenerate}>
        {generating ? 'Generating…' : 'Generate Report'}
      </button>
    </div>
    {/if}
  </div>
</div>

<style>
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9996;display:flex;align-items:center;justify-content:center;padding:20px}
  .modal-box{background:var(--panel);border:1px solid rgba(201,151,58,.3);border-radius:8px;width:100%;max-width:560px;max-height:90vh;display:flex;flex-direction:column}
  .modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid var(--border);flex-shrink:0}
  .modal-title{font-family:'Playfair Display',serif;font-size:1rem;color:var(--canopy)}
  .modal-close{background:transparent;border:none;color:var(--parch-dim);font-size:1rem;cursor:pointer}
  .modal-close:hover{color:var(--parch)}
  .modal-body{padding:16px 18px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1}
  .modal-body::-webkit-scrollbar{width:3px}
  .modal-body::-webkit-scrollbar-thumb{background:rgba(201,151,58,.3);border-radius:2px}
  .modal-footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--border);flex-shrink:0}
  .field{display:flex;flex-direction:column;gap:4px}
  .field-lbl{font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}
  .field-inp{background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:6px 8px;font-family:'Outfit',sans-serif;font-size:.65rem;color:var(--parch);width:100%}
  .field-inp:focus{outline:none;border-color:var(--gold)}
  .rpt-scope-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  .rpt-scope-btn{background:var(--panel2);border:1px solid var(--border);border-radius:5px;padding:10px 8px;font-family:'Outfit',sans-serif;font-size:.6rem;color:var(--parch-dim);cursor:pointer;text-align:center;transition:all .15s;line-height:1.4}
  .rpt-scope-btn:hover{border-color:var(--gold);color:var(--parch)}
  .rpt-scope-btn.on{background:rgba(201,151,58,.15);border-color:var(--gold);color:var(--parch)}
  .rpt-scope-icon{font-size:1.2rem;display:block;margin-bottom:4px}
  .picker-count{font-size:.56rem;color:var(--canopy);margin-top:2px}
  .tree-picker{max-height:200px;overflow-y:auto;background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:4px}
  .tree-picker::-webkit-scrollbar{width:3px}
  .tree-picker::-webkit-scrollbar-thumb{background:rgba(201,151,58,.3);border-radius:2px}
  :global(.rpt-tree-item){display:flex;align-items:center;gap:7px;padding:4px 8px;border-radius:3px;cursor:pointer;transition:background .1s;font-size:.56rem}
  :global(.rpt-tree-item:hover){background:rgba(201,151,58,.08)}
  :global(.rpt-tree-item input[type=checkbox]){accent-color:var(--gold);cursor:pointer;flex-shrink:0}
  :global(.rpt-tree-item-name){flex:1;color:var(--parch);font-size:.56rem}
  :global(.rpt-tree-item-meta){color:var(--parch-dim);font-size:.54rem;white-space:nowrap}
  .rpt-tabbar{display:flex;border-bottom:1px solid var(--border);background:var(--panel2);flex-shrink:0}
  .rpt-tab{background:transparent;border:none;border-bottom:2px solid transparent;padding:9px 16px;font-family:'Outfit',sans-serif;font-size:.6rem;color:var(--parch-dim);cursor:pointer;transition:all .13s;white-space:nowrap}
  .rpt-tab.on{color:var(--gold);border-bottom-color:var(--gold)}
  .rpt-tab:hover{color:var(--parch)}
.saved-empty{font-size:.6rem;color:var(--parch-dim);text-align:center;padding:24px 0}
  .saved-section{display:flex;flex-direction:column;gap:5px}
  .saved-row{display:flex;align-items:center;gap:8px;background:var(--panel2);border-radius:4px;padding:6px 10px;border:1px solid rgba(201,151,58,.1)}
  .saved-info{flex:1;min-width:0}
  .saved-name{font-size:.62rem;color:var(--parch)}
  .saved-meta{font-size:.5rem;color:var(--parch-dim)}
  .rl-btn{background:transparent;border:1px solid var(--border);border-radius:3px;padding:2px 8px;font-family:'Outfit',sans-serif;font-size:.52rem;color:var(--parch-dim);cursor:pointer;transition:all .13s}
  .rl-btn.danger{border-color:rgba(184,53,53,.3);color:rgba(184,53,53,.7)}
  .rl-btn.danger:hover{border-color:var(--red);color:var(--red)}
  .btn-cancel{background:transparent;border:1px solid var(--border);border-radius:3px;padding:5px 14px;font-family:'Outfit',sans-serif;font-size:.6rem;color:var(--parch-dim);cursor:pointer}
  .btn-cancel:hover{border-color:var(--gold);color:var(--parch)}
  .btn-generate{background:var(--gold);border:none;border-radius:3px;padding:5px 14px;font-family:'Outfit',sans-serif;font-size:.6rem;color:var(--bark);cursor:pointer;font-weight:500}
  .btn-generate:hover{opacity:.85}
  .btn-generate:disabled{opacity:.5;cursor:not-allowed}
  /* summary pills */
  .summary-pills-row{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
  .pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;font-size:.58rem;border:1px solid currentColor;margin:2px;font-family:'Outfit',sans-serif}
  /* preview list */
  .preview-list{background:var(--panel2);border:1px solid var(--border);border-radius:4px;overflow:hidden}
  .preview-row{display:flex;align-items:center;gap:7px;padding:5px 10px;cursor:pointer;transition:background .1s;font-size:.6rem}
  .preview-row:hover{background:rgba(201,151,58,.07)}
  .preview-tier{padding:1px 5px;border-radius:3px;font-size:.52rem;font-weight:500;white-space:nowrap;flex-shrink:0}
  .preview-name{flex:1;color:var(--parch);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .preview-street{color:var(--parch-dim);font-size:.56rem;white-space:nowrap;flex-shrink:0}
  .preview-score{font-weight:500;font-size:.65rem;flex-shrink:0;width:28px;text-align:right}
  .preview-chevron{color:var(--parch-dim);font-size:.9rem;transition:transform .15s;flex-shrink:0;transform:rotate(0deg)}
  .preview-chevron.open{transform:rotate(90deg)}
  .preview-more{font-size:.54rem;color:var(--parch-dim);padding:5px 10px;border-top:1px solid var(--border)}
  /* factor breakdown */
  .factor-breakdown{background:rgba(201,151,58,.05);border-left:2px solid var(--border);padding:8px 12px;font-size:.72rem;font-family:'Outfit',sans-serif}
  .factor-row{display:flex;justify-content:space-between;padding:2px 0;font-size:.62rem;color:var(--parch-dim)}
  .factor-pts{color:rgba(201,151,58,.7);text-align:right;white-space:nowrap;margin-left:12px}
  .factor-total{border-top:1px solid var(--border);margin-top:6px;padding-top:6px;font-size:.64rem;color:var(--parch)}
  /* dead preview */
  .dead-lbl{color:rgba(160,48,48,.9)}
  .dead-preview{background:var(--panel2);border:1px solid rgba(107,26,26,.3);border-radius:4px;overflow:hidden}
  .dead-row{display:flex;align-items:center;gap:8px;padding:4px 10px;font-size:.6rem;border-bottom:1px solid var(--border)}
  .dead-row:last-child{border-bottom:none}
  .dead-species{flex:1;color:var(--parch)}
  .dead-street{color:var(--parch-dim);font-size:.56rem}
  .dead-dbh{color:var(--parch-dim);font-size:.56rem;white-space:nowrap}
</style>
