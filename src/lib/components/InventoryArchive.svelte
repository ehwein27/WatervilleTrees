<script>
  import { onMount } from 'svelte';
  import { sbGet, sbSet } from '$lib/api/supabase.js';
  import { currentPage, selectedUploadInfo, resetFilters, bulkAddPrefill } from '$lib/stores/ui.js';
  import { downloadInventoryXLSX, downloadProspectiveHTML, downloadProspectiveXLSX, generateProspectiveXLSXBytes } from '$lib/utils/export.js';
  import { trees, hardDeleteTree } from '$lib/stores/trees.js';
  import { savedReports, deleteReport } from '$lib/stores/prospective.js';
  import { showToast, showConfirm } from '$lib/stores/toast.js';

  const BA_UPLOADS_KEY = 'bulk_add_uploads';

  const BUILTIN = [
    {
      id:        'sep-2025',
      label:     'September 2025 Inventory',
      date:      '2025-09-01',
      source:    'Bartlett Associates field survey',
      treeCount: 506,
      dataFile:  '/data/september2025.csv',
      xlsxName:  'Waterville_TreeInventory_September2025.xlsx',
      note:      null,
    },
    {
      id:        'feb-2022',
      label:     'February 2022 Inventory',
      date:      '2022-02-01',
      source:    'Bartlett Associates field survey',
      treeCount: 602,
      dataFile:  '/data/february2022.json',
      xlsxName:  'Waterville_TreeInventory_February2022.xlsx',
      note:      'Source document is a PDF. Survey data (602 records) was imported as condition history into the live inventory via the Bartlett survey import process.',
    },
    {
      id:        'dec-2022',
      label:     'December 2022 Inventory',
      date:      '2022-12-01',
      source:    'Bartlett Associates field survey',
      treeCount: 289,
      dataFile:  '/data/december2022.json',
      xlsxName:  'Waterville_TreeInventory_December2022.xlsx',
      note:      'Source document is a PDF. Survey data (289 records) was imported as condition history into the live inventory via the Bartlett survey import process.',
    },
  ];

  let savedUploads = $state([]);
  let loading = $state(true);
  let xlsxDownloading = $state('');
  let downloadingCurrent = $state(false);

  async function downloadCurrent() {
    downloadingCurrent = true;
    try { await downloadInventoryXLSX(); }
    catch (e) { showToast('Download failed: ' + e.message, 'error'); }
    finally { downloadingCurrent = false; }
  }

  onMount(async () => {
    try {
      const val = await sbGet(BA_UPLOADS_KEY);
      savedUploads = Array.isArray(val) ? val : JSON.parse(val);
    } catch {
      savedUploads = [];
    } finally {
      loading = false;
    }
  });

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function fmtUploadDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function downloadSurveyXlsx(inv) {
    if (xlsxDownloading) return;
    xlsxDownloading = inv.id;
    try {
      const [XLSX, resp] = await Promise.all([
        import('xlsx'),
        fetch(inv.dataFile),
      ]);
      if (!resp.ok) throw new Error('Failed to fetch survey data');

      const wb = XLSX.utils.book_new();

      if (inv.dataFile.endsWith('.csv')) {
        const text = await resp.text();
        const parsed = XLSX.read(text, { type: 'string' });
        const ws = parsed.Sheets[parsed.SheetNames[0]];
        XLSX.utils.book_append_sheet(wb, ws, 'Survey Data');
      } else {
        const records = await resp.json();
        const COLS = [
          { key: 'Inventory ID',      get: r => r._inventory_id        ?? '', wch: 12 },
          { key: 'Tree ID',           get: r => r._survey_id            ?? '', wch: 9  },
          { key: 'Common Name',       get: r => r.common_name       || '', wch: 22 },
          { key: 'Scientific Name',   get: r => r.scientific_name   || '', wch: 24 },
          { key: 'Condition',         get: r => r.condition         || '', wch: 10 },
          { key: 'DBH (in)',          get: r => r.dbh               ?? '', wch: 9  },
          { key: 'DBH 2 (in)',        get: r => r.dbh2              ?? '', wch: 9  },
          { key: 'DBH 3 (in)',        get: r => r.dbh3              ?? '', wch: 9  },
          { key: 'Termite Nests',     get: r => r.btm_nests         ?? '', wch: 14 },
          { key: 'Distance to Water', get: r => r.distance_to_water || '', wch: 18 },
          { key: 'Latitude',          get: r => r.lat                   , wch: 12 },
          { key: 'Longitude',         get: r => r.lng                   , wch: 12 },
        ];
        const dataRows = records.map(r => {
          const out = {};
          COLS.forEach(c => { out[c.key] = c.get(r); });
          return out;
        });
        const activeCols = COLS.filter(c => dataRows.some(r => r[c.key] !== '' && r[c.key] != null));
        const filteredRows = dataRows.map(r =>
          Object.fromEntries(activeCols.map(c => [c.key, r[c.key]]))
        );
        const ws = XLSX.utils.json_to_sheet(filteredRows);
        ws['!cols'] = activeCols.map(c => ({ wch: c.wch }));
        XLSX.utils.book_append_sheet(wb, ws, 'Survey Data');
      }

      XLSX.writeFile(wb, inv.xlsxName);
    } catch (e) {
      showToast('Download failed: ' + e.message, 'error');
    } finally {
      xlsxDownloading = '';
    }
  }

  async function deleteUpload(u) {
    const treeCount = u.treeIds?.length ?? 0;
    const msg = treeCount > 0
      ? `Delete "${u.name}" and permanently remove the ${treeCount} tree${treeCount === 1 ? '' : 's'} it added? This cannot be undone.`
      : `Delete "${u.name}"? This cannot be undone.`;
    if (!(await showConfirm(msg))) return;

    if (treeCount > 0) {
      for (const id of u.treeIds) {
        try { await hardDeleteTree(id); } catch {}
      }
    }

    savedUploads = savedUploads.filter(x => x !== u);
    await sbSet(BA_UPLOADS_KEY, JSON.stringify(savedUploads));
  }

  function downloadUpload(u) {
    const bin = atob(u.b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const mime = u.name.endsWith('.csv') ? 'text/csv'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = u.name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // ── Prospective reports ───────────────────────────────────────────────────────

  let ppDownloading = $state('');

  async function downloadProspectiveReport(report, type) {
    if (ppDownloading) return;
    ppDownloading = report.id + '_' + type;
    try {
      if (type === 'html') {
        downloadProspectiveHTML(report.entries, report.name);
      } else {
        await downloadProspectiveXLSX(report.entries, report.name);
      }
    } catch (e) {
      showToast('Download failed: ' + e.message, 'error');
    } finally {
      ppDownloading = '';
    }
  }

  let convertingId = $state('');

  async function convertToBulkAdd(report) {
    if (convertingId) return;
    convertingId = report.id;
    try {
      const bytes = await generateProspectiveXLSXBytes(report.entries);
      const safe  = report.name.replace(/[^a-z0-9_\-]/gi, '_');
      bulkAddPrefill.set({ bytes, name: safe + '_BulkAdd.xlsx' });
      currentPage.set('bulk-add');
    } catch (e) {
      showToast('Failed to prepare bulk add: ' + e.message, 'error');
    } finally {
      convertingId = '';
    }
  }

  async function confirmDeleteReport(id) {
    if (!(await showConfirm('Delete this saved report? This cannot be undone.'))) return;
    deleteReport(id);
  }

  function fmtReportDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<div class="ia-view">
  <div class="ia-wrap">

    <div style="display:flex;justify-content:flex-end">
      <button class="ia-back" onclick={() => currentPage.set('map')}>← Back to Map</button>
    </div>

    <div class="ia-hero">
      <h1>Inventory Archive</h1>
      <p>A record of all tree surveys and bulk-uploaded datasets associated with the Waterville inventory.</p>
    </div>

    <!-- ── Current inventory ────────────────────────────────────────────── -->
    <div class="ia-section">
      <div class="ia-section-hdr">Current Inventory</div>
      <div class="ia-card ia-card-current">
        <div class="ia-card-main">
          <div class="ia-card-left">
            <div class="ia-card-label">Live Tree Inventory</div>
            <div class="ia-card-meta">
              <span class="ia-meta-date">As of today</span>
              <span class="ia-meta-sep">·</span>
              <span class="ia-meta-count">{$trees.length} trees</span>
            </div>
          </div>
          <div class="ia-card-actions">
            <button class="ia-dl-btn ia-dl-btn-primary" onclick={downloadCurrent} disabled={downloadingCurrent}>
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {downloadingCurrent ? 'Downloading…' : 'Download Spreadsheet'}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Built-in inventories ─────────────────────────────────────────── -->
    <div class="ia-section">
      <div class="ia-section-hdr">Named Surveys</div>

      {#each BUILTIN as inv}
        <div class="ia-card">
          <div class="ia-card-main">
            <div class="ia-card-left">
              <div class="ia-card-label">{inv.label}</div>
              <div class="ia-card-meta">
                <span class="ia-meta-date">{fmtDate(inv.date)}</span>
                <span class="ia-meta-sep">·</span>
                <span class="ia-meta-source">{inv.source}</span>
                {#if inv.treeCount}
                  <span class="ia-meta-sep">·</span>
                  <span class="ia-meta-count">{inv.treeCount} records</span>
                {/if}
              </div>
              {#if inv.note}
                <div class="ia-card-note">{inv.note}</div>
              {/if}
            </div>
            <div class="ia-card-actions">
                <button
                  class="ia-dl-btn"
                  onclick={() => downloadSurveyXlsx(inv)}
                  disabled={!!xlsxDownloading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {xlsxDownloading === inv.id ? 'Downloading…' : 'Download Spreadsheet'}
                </button>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- ── Bulk-uploaded inventories ────────────────────────────────────── -->
    <div class="ia-section">
      <div class="ia-section-hdr">Bulk-Uploaded Datasets</div>

      {#if loading}
        <div class="ia-empty">Loading…</div>
      {:else if savedUploads.length === 0}
        <div class="ia-empty">No uploads yet. Use <strong>Tasks → Bulk Add Trees</strong> to upload a spreadsheet.</div>
      {:else}
        {#each savedUploads as u}
          <div class="ia-card">
            <div class="ia-card-main">
              <div class="ia-card-left">
                <div class="ia-card-label">{u.name}</div>
                <div class="ia-card-meta">
                  <span class="ia-meta-date">{fmtUploadDate(u.date)}</span>
                  <span class="ia-meta-sep">·</span>
                  <span class="ia-meta-count">{u.treeCount} tree{u.treeCount === 1 ? '' : 's'} added</span>
                </div>
              </div>
              <div class="ia-card-actions">
                <button class="ia-dl-btn" onclick={() => downloadUpload(u)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download Spreadsheet
                </button>
                <button class="ia-del-btn" onclick={() => deleteUpload(u)} title="Delete this upload record">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- ── Prospective Tree Planting Reports ──────────────────────────────── -->
    <div class="ia-section ia-section-prospective">
      <div class="ia-section-hdr ia-section-hdr-prospective">Prospective Tree Planting</div>
      <p class="ia-section-note">
        Reports generated from the <strong>Tasks → Prospective Planting</strong> tool. Each report contains
        the species list, priorities, and notes. Use <em>Convert to Bulk Add</em> to pipe the trees
        directly into the Bulk Add upload flow once planting locations are known.
      </p>

      {#if $savedReports.length === 0}
        <div class="ia-empty">No prospective planting reports saved yet. Use <strong>Tasks → Prospective Planting</strong> to create one.</div>
      {:else}
        {#each $savedReports as report}
          <div class="ia-card ia-card-prospective">
            <div class="ia-card-main">
              <div class="ia-card-left">
                <div class="ia-card-label">{report.name}</div>
                <div class="ia-card-meta">
                  <span class="ia-meta-date">{fmtReportDate(report.date)}</span>
                  <span class="ia-meta-sep">·</span>
                  <span class="ia-meta-count">{report.entries.length} tree{report.entries.length === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div class="ia-card-actions ia-pp-actions">
                <button
                  class="ia-dl-btn"
                  onclick={() => downloadProspectiveReport(report, 'html')}
                  disabled={!!ppDownloading}
                  title="Download HTML report">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {ppDownloading === report.id + '_html' ? 'Downloading…' : 'HTML'}
                </button>
                <button
                  class="ia-dl-btn"
                  onclick={() => downloadProspectiveReport(report, 'xlsx')}
                  disabled={!!ppDownloading}
                  title="Download XLSX spreadsheet">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {ppDownloading === report.id + '_xlsx' ? 'Downloading…' : 'XLSX'}
                </button>
                <button
                  class="ia-dl-btn ia-convert-btn"
                  onclick={() => convertToBulkAdd(report)}
                  disabled={!!convertingId || report.entries.length === 0}
                  title="Open Bulk Add with these trees pre-filled">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {convertingId === report.id ? 'Preparing…' : 'Convert to Bulk Add'}
                </button>
                <button
                  class="ia-del-btn"
                  onclick={() => confirmDeleteReport(report.id)}
                  title="Delete this report">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>

  </div>
</div>

<style>
  .ia-view {
    flex: 1;
    background: var(--bg);
    overflow-y: auto;
  }
  .ia-wrap {
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
    padding: 40px 28px 60px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  /* Hero */
  .ia-hero { display: flex; flex-direction: column; gap: 8px; }
  .ia-hero h1 { font-family: 'Playfair Display', serif; font-size: 2rem; color: #0f2e14; margin: 0; }
  .ia-hero p { font-size: .82rem; color: #3a3a3a; line-height: 1.7; max-width: 580px; margin: 0; }
  .ia-back {
    display: inline-flex; align-items: center; gap: 5px;
    background: transparent; border: 1px solid rgba(120,80,20,.25);
    border-radius: 4px; padding: 5px 12px;
    font-family: 'Outfit', sans-serif; font-size: .74rem;
    color: #5c3d08; cursor: pointer; width: fit-content;
    transition: border-color .13s, background .13s;
  }
  .ia-back:hover { border-color: #5c3d08; background: rgba(92,61,8,.06); }

  /* Section */
  .ia-section { display: flex; flex-direction: column; gap: 10px; }
  .ia-section-hdr {
    font-size: .64rem;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: #5c3d08;
    font-weight: 600;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(120,80,20,.18);
  }

  /* Card */
  .ia-card {
    background: #f5ede0;
    border: 1px solid rgba(120,80,20,.18);
    border-radius: 8px;
    padding: 16px 18px;
  }
  .ia-card-main {
    display: flex;
    align-items: flex-start;
    gap: 16px;
  }
  .ia-card-left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .ia-card-label {
    font-size: .9rem;
    font-weight: 600;
    color: #0f2e14;
    line-height: 1.3;
  }
  .ia-card-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    font-size: .72rem;
    color: #5c3d08;
  }
  .ia-meta-sep { opacity: .4; }
  .ia-meta-date { font-weight: 500; }
  .ia-meta-source { font-style: italic; }
  .ia-meta-count { color: #1a5216; font-weight: 500; }
  .ia-card-note {
    font-size: .70rem;
    color: #7a6040;
    line-height: 1.55;
    background: rgba(120,80,20,.07);
    border-radius: 4px;
    padding: 7px 10px;
    margin-top: 2px;
  }
  .ia-card-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  /* Buttons */
  .ia-dl-btn {
    display: inline-flex; align-items: center; gap: 5px;
    background: transparent;
    border: 1px solid rgba(120,80,20,.3);
    border-radius: 4px; padding: 6px 14px;
    font-family: 'Outfit', sans-serif; font-size: .72rem;
    color: #5c3d08; cursor: pointer;
    white-space: nowrap;
    transition: border-color .13s, background .13s;
  }
  .ia-dl-btn:hover { border-color: #5c3d08; background: rgba(92,61,8,.06); }

  .ia-empty {
    font-size: .76rem; color: #555; font-style: italic;
    padding: 12px 0;
  }
  .ia-empty strong { color: #0f0f0f; font-style: normal; }

  /* Prospective section */
  .ia-section-prospective { margin-top: 8px; }
  .ia-section-hdr-prospective {
    color: #1a5216;
    border-color: rgba(26,82,22,.22);
  }
  .ia-section-note {
    font-size: .70rem;
    color: #3a3a3a;
    line-height: 1.6;
    margin: 0;
    max-width: 640px;
  }
  .ia-section-note strong { color: #0f2e14; }
  .ia-card-prospective {
    background: #edf5ec;
    border-color: rgba(26,82,22,.18);
  }
  .ia-card-prospective .ia-card-main {
    flex-wrap: wrap;
    gap: 10px;
  }
  .ia-pp-actions { flex-wrap: wrap; gap: 6px; align-items: center; }
  .ia-convert-btn {
    color: #1a5216 !important;
    border-color: rgba(26,82,22,.35) !important;
    font-weight: 600;
  }
  .ia-convert-btn:hover {
    border-color: #1a5216 !important;
    background: rgba(26,82,22,.08) !important;
  }
  .ia-del-btn {
    display: inline-flex; align-items: center; justify-content: center;
    background: transparent;
    border: 1px solid rgba(158,32,32,.22);
    border-radius: 4px; padding: 6px 8px;
    color: #9e2020; cursor: pointer;
    transition: border-color .13s, background .13s;
    flex-shrink: 0;
  }
  .ia-del-btn:hover { border-color: rgba(158,32,32,.55); background: rgba(158,32,32,.06); }
</style>
