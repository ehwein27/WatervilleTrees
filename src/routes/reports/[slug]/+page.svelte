<script>
  import { onMount } from 'svelte';
  import { PUBLIC_STADIA_API_KEY } from '$env/static/public';

  let { data } = $props();

  let sortCol = $state(data.defaultSort);
  let sortDir = $state(data.defaultSortDir);

  function sort(col) {
    if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortCol = col; sortDir = 'asc'; }
  }

  const COND_COLOR = { Good: '#1a8c2a', Fair: '#d4860a', Poor: '#cc3300', Dead: '#6b1a1a' };

  const sortedTrees = $derived.by(() => {
    const t = [...data.trees];
    t.sort((a, b) => {
      let av, bv;
      if      (sortCol === 'id')        { av = +a.id;            bv = +b.id; }
      else if (sortCol === 'name')      { av = a.n;              bv = b.n; }
      else if (sortCol === 'species')   { av = a.s;              bv = b.s; }
      else if (sortCol === 'condition') { av = a.c;              bv = b.c; }
      else if (sortCol === 'age')       { av = a.a;              bv = b.a; }
      else if (sortCol === 'dbh')       { av = a.d;              bv = b.d; }
      else if (sortCol === 'value')     { av = a.vt ?? -1;       bv = b.vt ?? -1; }
      else if (sortCol === 'location')  { av = a.st;             bv = b.st; }
      else if (sortCol === 'updated')   { av = a.u;              bv = b.u; }
      else { av = a.n; bv = b.n; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return t;
  });

  const has = (col) => data.cols.includes(col);
  const fmt = (n) => n == null ? '—' : '$' + n.toLocaleString();
  const arrow = (col) => sortCol !== col ? '' : sortDir === 'asc' ? ' ↑' : ' ↓';

  function fmtDate(s) {
    if (!s) return '—';
    // YYYY-MM-DD (with or without time)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const day = s.slice(8, 10);
      const d   = new Date(s.slice(0, 10) + 'T12:00:00');
      if (isNaN(d)) return s;
      // Day "01" is a placeholder meaning only month+year is known
      if (day === '01')
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    // YYYY-MM → month + year only
    if (/^\d{4}-\d{2}$/.test(s)) {
      const [y, m] = s.split('-');
      const d = new Date(+y, +m - 1, 1);
      return isNaN(d) ? s : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    }
    // YYYY → year only
    if (/^\d{4}$/.test(s)) return s;
    return s;
  }

  const genDate = new Date(data.generatedAt).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  const kpis = (() => {
    const out = [{ n: data.stats.total, label: 'Trees' }];
    if (!data.isCemetery) {
      for (const c of ['Good','Fair','Poor','Dead']) {
        const cnt = data.stats.byCondition[c];
        if (cnt) out.push({ n: cnt, label: c, color: COND_COLOR[c] });
      }
    }
    if (data.stats.totalValue > 0)
      out.push({ n: fmt(data.stats.totalValue), label: 'Annual value', small: true });
    return out;
  })();

  // ── Paginated chunks (10 trees each) ─────────────────────────────────────────
  const PAGE_SIZE = 10;

  const pages = $derived.by(() => {
    const out = [];
    for (let i = 0; i < sortedTrees.length; i += PAGE_SIZE)
      out.push(sortedTrees.slice(i, i + PAGE_SIZE));
    return out;
  });

  // ── Leaflet: lazy-load once, then initialize maps via use: action ─────────────
  let L = null;
  let pendingMaps = [];

  onMount(async () => {
    const mod = await import('leaflet');
    L = mod.default;
    // Drain any maps that mounted before L was ready
    for (const fn of pendingMaps) fn();
    pendingMaps = [];
    return () => {};
  });

  function leafletChunkMap(node, treePage) {
    let map = null;
    let currentPage = treePage;

    function buildMap() {
      if (map) { map.remove(); map = null; }

      map = L.map(node, {
        zoomControl:        false,
        attributionControl: false,
        dragging:           false,
        scrollWheelZoom:    false,
        doubleClickZoom:    false,
        boxZoom:            false,
        keyboard:           false,
        touchZoom:          false,
      });

      L.tileLayer(`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${PUBLIC_STADIA_API_KEY}`, {
        maxZoom: 20, maxNativeZoom: 20,
        attribution: '© Stadia Maps © OpenMapTiles © OpenStreetMap contributors',
      }).addTo(map);

      const geo = currentPage.filter(t => t.lt && t.ln);

      if (geo.length) {
        // Fit bounds synchronously so pixel positions are available immediately
        const bounds = L.latLngBounds(geo.map(t => [t.lt, t.ln]));
        map.fitBounds(bounds, { padding: [52, 52], animate: false });

        const DOT   = 10;   // dot diameter px
        const LBL_H = 16;   // label pill height px
        const GAP   = 5;    // gap between dot edge and nearest label edge

        // Get screen positions for all geo trees
        const pts = geo.map(t => map.latLngToContainerPoint([t.lt, t.ln]));

        // ── Greedy label placement (8 candidate directions per label) ──────────
        // Icon origin = dot centre (iconSize [0,0], iconAnchor [0,0]).
        // dx/dy are offsets from dot centre to label centre.
        const placedBoxes = [];   // [{cx,cy,hw,hh}] half-extents in screen coords
        const placements  = [];

        for (let i = 0; i < geo.length; i++) {
          const id    = String(geo[i].id);
          const LBL_W = id.length * 7 + 14;   // approximate pill width
          const pt    = pts[i];
          const r     = DOT / 2 + GAP;        // radius to label edge

          // 8 directions: above, right, below, left, then diagonals
          const cands = [
            [0,              -(r + LBL_H / 2)],
            [r + LBL_W / 2,  0              ],
            [0,               r + LBL_H / 2 ],
            [-(r + LBL_W/2), 0              ],
            [ r * 0.7 + LBL_W / 2, -(r * 0.7 + LBL_H / 2)],
            [-(r * 0.7 + LBL_W / 2), -(r * 0.7 + LBL_H / 2)],
            [ r * 0.7 + LBL_W / 2,   r * 0.7 + LBL_H / 2  ],
            [-(r * 0.7 + LBL_W / 2),  r * 0.7 + LBL_H / 2 ],
          ];

          function overlaps(cx, cy, hw, hh) {
            // vs placed labels
            for (const b of placedBoxes) {
              if (Math.abs(cx - b.cx) < hw + b.hw + 2 &&
                  Math.abs(cy - b.cy) < hh + b.hh + 2) return true;
            }
            // vs every dot (so label never sits on a dot)
            for (const p of pts) {
              const dr = DOT / 2 + 3;
              if (Math.abs(cx - p.x) < hw + dr &&
                  Math.abs(cy - p.y) < hh + dr) return true;
            }
            return false;
          }

          let chosen = cands[0];
          for (const [dx, dy] of cands) {
            if (!overlaps(pt.x + dx, pt.y + dy, LBL_W / 2, LBL_H / 2)) {
              chosen = [dx, dy];
              break;
            }
          }

          const [dx, dy] = chosen;
          placedBoxes.push({
            cx: pt.x + dx, cy: pt.y + dy,
            hw: LBL_W / 2, hh: LBL_H / 2,
          });
          placements.push({ dx, dy, LBL_W });
        }

        // ── Render markers ─────────────────────────────────────────────────────
        for (let i = 0; i < geo.length; i++) {
          const t   = geo[i];
          const id  = String(t.id);
          const col = COND_COLOR[t.c] || '#5a7a50';
          const { dx, dy, LBL_W } = placements[i];

          // Thin leader line from dot edge to label edge
          const mag   = Math.hypot(dx, dy) || 1;
          const nx    = dx / mag;
          const ny    = dy / mag;
          const lx1   = nx * (DOT / 2);              // dot edge
          const ly1   = ny * (DOT / 2);
          const lx2   = dx - nx * (LBL_H / 2);       // label edge
          const ly2   = dy - ny * (LBL_H / 2);
          const lineLen = Math.hypot(lx2 - lx1, ly2 - ly1);
          const angle   = Math.atan2(ly2 - ly1, lx2 - lx1) * 180 / Math.PI;

          const icon = L.divIcon({
            html: `<div style="position:absolute;width:0;height:0;overflow:visible;top:0;left:0;">
              <!-- dot -->
              <div style="
                position:absolute;
                left:${-DOT / 2}px;top:${-DOT / 2}px;
                width:${DOT}px;height:${DOT}px;
                border-radius:50%;
                background:${col};
                border:2px solid #fff;
                box-shadow:0 1px 3px rgba(0,0,0,.35);
                box-sizing:border-box;
              "></div>
              <!-- leader line -->
              ${lineLen > 1 ? `<div style="
                position:absolute;
                left:${lx1}px;top:${ly1}px;
                width:${lineLen}px;height:1px;
                background:rgba(30,20,5,.22);
                transform-origin:0 50%;
                transform:rotate(${angle}deg);
                pointer-events:none;
              "></div>` : ''}
              <!-- label pill -->
              <span style="
                position:absolute;
                left:${dx - LBL_W / 2}px;top:${dy - LBL_H / 2}px;
                width:${LBL_W}px;
                font-family:'Outfit',sans-serif;
                font-size:9px;font-weight:700;
                line-height:${LBL_H}px;
                text-align:center;
                color:#1a1507;
                background:rgba(255,255,255,0.95);
                border-radius:4px;
                box-shadow:0 1px 3px rgba(0,0,0,.2);
                border:1px solid rgba(0,0,0,.1);
                white-space:nowrap;
                pointer-events:none;
              ">${id}</span>
            </div>`,
            className: '',
            iconSize:   [0, 0],
            iconAnchor: [0, 0],
          });

          L.marker([t.lt, t.ln], { icon }).addTo(map);
        }
      } else {
        // Waterville, ME default view
        map.setView([44.5521, -69.6317], 14);
      }
    }

    let pendingRef = null;
    if (L) {
      buildMap();
    } else {
      pendingRef = buildMap;
      pendingMaps.push(pendingRef);
    }

    return {
      update(newPage) {
        currentPage = newPage;
        if (L) buildMap();
      },
      destroy() {
        if (map) { map.remove(); map = null; }
        if (pendingRef) {
          const idx = pendingMaps.indexOf(pendingRef);
          if (idx !== -1) pendingMaps.splice(idx, 1);
        }
      },
    };
  }
</script>

<svelte:head>
  <title>{data.title} — Waterville Tree Inventory</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div class="page">

  <!-- Cover -->
  <div class="cover" class:cemetery={data.isCemetery}>
    <!-- Dark header band -->
    <div class="cover-header">
      <div class="cover-header-inner">
        <div class="cover-org-row">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;opacity:.9"><path d="M12 2C12 2 6 8 6 14a6 6 0 0 0 12 0c0-6-6-12-6-12z" fill="rgba(255,255,255,.85)"/><path d="M12 22v-8" stroke="rgba(255,255,255,.7)" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span class="cover-org-name">City of Waterville, Maine</span>
          <span class="cover-org-sep">·</span>
          <span class="cover-org-sub">Urban Tree Inventory</span>
        </div>
        <h1>{data.title}</h1>
        {#if data.subtitle}<div class="cover-sub">{data.subtitle}</div>{/if}
      </div>
    </div>
    <!-- Light meta strip -->
    <div class="cover-meta-strip">
      <div class="cover-meta-item">
        <span class="cover-meta-label">Generated</span>
        <span class="cover-meta-val">{genDate}</span>
      </div>
      <div class="cover-meta-divider"></div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Trees in report</span>
        <span class="cover-meta-val">{data.stats.total}</span>
      </div>
      <div class="cover-meta-divider"></div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Source</span>
        <span class="cover-meta-val">Live · refreshes on load</span>
      </div>
    </div>
    <div class="cover-btn-row">
      <button class="dl-btn" onclick={() => window.print()} title="Print report">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Print / Save as PDF
      </button>
    </div>
  </div>

  <!-- KPI row -->
  <div class="kpi-grid">
    {#each kpis as k}
      <div class="kpi" style={k.color ? `--kpi-accent:${k.color}` : ''} class:kpi-cond={!!k.color}>
        <div class="kpi-n" style={k.color ? `color:${k.color}` : ''} class:kpi-sm={k.small}>{k.n}</div>
        <div class="kpi-l">{k.label}</div>
      </div>
    {/each}
  </div>

  <!-- ── Map → Table → Map → Table … (10 trees each) ── -->
  {#if sortedTrees.length === 0}
    <div class="empty">No trees match this filter.</div>
  {:else}
    {#each pages as page, pi}
      <div class="chunk">
        <!-- only shown when printing — identifies report across pages -->
        <div class="print-running-hdr">
          <span>{data.title}</span>
          <span>Trees {pi * PAGE_SIZE + 1}–{Math.min((pi + 1) * PAGE_SIZE, sortedTrees.length)} of {sortedTrees.length}</span>
        </div>

        <!-- Leaflet map header -->
        <div class="chunk-map-hdr">
          <span class="chunk-map-title">Trees {pi * PAGE_SIZE + 1}–{Math.min((pi + 1) * PAGE_SIZE, sortedTrees.length)}</span>
          <span class="chunk-legend">
            {#each Object.entries(COND_COLOR) as [cond, color]}
              {#if page.some(t => t.c === cond)}
                <span class="chunk-leg-item">
                  <span class="chunk-leg-dot" style="background:{color}"></span>{cond}
                </span>
              {/if}
            {/each}
          </span>
        </div>

        <!-- Leaflet map — use: action initializes it safely -->
        <div class="chunk-map-el" use:leafletChunkMap={page}>
          <div class="chunk-map-placeholder">Loading map…</div>
        </div>

        <!-- Table for this group -->
        <table class="chunk-tbl">
          <thead>
            <tr>
              {#if has('id')}        <th onclick={() => sort('id')}        class="sortable"># {arrow('id')}</th>{/if}
              {#if has('name')}      <th onclick={() => sort('name')}      class="sortable">Common Name{arrow('name')}</th>{/if}
              {#if has('species')}   <th onclick={() => sort('species')}   class="sortable">Scientific Name{arrow('species')}</th>{/if}
              {#if has('condition')} <th onclick={() => sort('condition')} class="sortable">Condition{arrow('condition')}</th>{/if}
              {#if has('age')}       <th onclick={() => sort('age')}       class="sortable">Age Class{arrow('age')}</th>{/if}
              {#if has('dbh')}       <th onclick={() => sort('dbh')}       class="sortable">DBH (in){arrow('dbh')}</th>{/if}
              {#if has('value')}     <th onclick={() => sort('value')}     class="sortable">Value/yr{arrow('value')}</th>{/if}
              {#if has('location')}  <th onclick={() => sort('location')}  class="sortable">Location{arrow('location')}</th>{/if}
              {#if has('updated')}   <th onclick={() => sort('updated')}   class="sortable">Last Updated{arrow('updated')}</th>{/if}
            </tr>
          </thead>
          <tbody>
            {#each page as t, i}
              <tr class:even={i % 2 === 1}>
                {#if has('id')}        <td class="td-dim">{t.id}</td>{/if}
                {#if has('name')}      <td class="td-name">{t.n || '—'}</td>{/if}
                {#if has('species')}   <td class="td-italic">{t.s || '—'}</td>{/if}
                {#if has('condition')}
                  <td><span class="cond-dot" style="background:{COND_COLOR[t.c] || '#888'}"></span>{t.c || '—'}</td>
                {/if}
                {#if has('age')}       <td>{t.a || '—'}</td>{/if}
                {#if has('dbh')}       <td class="td-num">{t.d ? t.d + '"' : '—'}</td>{/if}
                {#if has('value')}     <td class="td-num">{t.vt != null ? fmt(t.vt) : '—'}</td>{/if}
                {#if has('location')}  <td class="td-loc">{t.st || '—'}</td>{/if}
                {#if has('updated')}   <td class="td-dim td-nowrap">{fmtDate(t.u)}</td>{/if}
              </tr>
            {/each}
          </tbody>
        </table>

      </div>
    {/each}
  {/if}

  <div class="footer">
    Waterville Urban Tree Inventory &nbsp;·&nbsp; {data.stats.total} trees &nbsp;·&nbsp; {genDate}
  </div>
</div>

<style>
  :root {
    --cond-good: #1a8c2a;
    --cond-fair: #d4860a;
    --cond-poor: #cc3300;
    --cond-dead: #6b1a1a;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :global(html) { scroll-behavior: smooth; }
  :global(body) {
    font-family: 'Outfit', sans-serif !important;
    background: var(--bg) !important;
    color: var(--bark) !important;
    height: auto !important;
    min-height: 100vh !important;
    overflow: auto !important;
    display: block !important;
  }

  .page {
    max-width: 980px;
    margin: 0 auto;
    padding: 0 24px 80px;
  }

  /* ── Cover ──────────────────────────────────────────────────────── */
  .cover {
    margin-bottom: 36px;
    border-radius: 9px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(15,46,20,.18);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Dark green header band */
  .cover-header {
    background: #162d12;
    padding: 44px 40px 40px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .cemetery .cover-header { background: #1e0808; }
  .cover-header-inner { max-width: 760px; }

  .cover-org-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 24px;
  }
  .cover-org-name {
    font-size: .65rem;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: rgba(255,255,255,.7);
    font-weight: 500;
  }
  .cover-org-sep { color: rgba(255,255,255,.3); font-size: .65rem; }
  .cover-org-sub {
    font-size: .65rem;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: rgba(201,151,58,.9);
    font-weight: 500;
  }

  h1 {
    font-family: 'Playfair Display', serif;
    font-size: 2.6rem;
    font-weight: 700;
    color: #fff;
    line-height: 1.15;
    margin-bottom: 10px;
    letter-spacing: -.015em;
  }
  .cemetery h1 { color: #f5e0e0; }

  .cover-sub {
    font-family: 'Playfair Display', serif;
    font-size: .95rem;
    color: rgba(255,255,255,.55);
    font-style: italic;
  }

  /* Light meta strip below the dark header */
  .cover-meta-strip {
    display: flex;
    align-items: stretch;
    background: var(--panel3);
    border-top: 3px solid var(--gold);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .cemetery .cover-meta-strip { border-top-color: var(--cond-dead); }
  .cover-meta-item {
    display: flex;
    flex-direction: column;
    padding: 13px 22px;
    flex: 1;
  }
  .cover-meta-item + .cover-meta-item {
    border-left: 1px solid var(--border);
  }
  .cover-meta-label {
    font-size: .57rem;
    letter-spacing: .13em;
    text-transform: uppercase;
    color: var(--parch-dim);
    margin-bottom: 3px;
  }
  .cover-meta-val {
    font-size: .8rem;
    font-weight: 600;
    color: var(--bark);
  }
  .cover-meta-divider { display: none; }

  .cover-btn-row {
    background: var(--panel3);
    padding: 0 22px 18px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Print button ───────────────────────────────────────────────── */
  .dl-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: #162d12;
    border: none;
    border-radius: 5px;
    padding: 9px 20px;
    font-family: 'Outfit', sans-serif;
    font-size: .72rem;
    font-weight: 600;
    letter-spacing: .04em;
    color: #fff;
    cursor: pointer;
    transition: background .15s, transform .1s;
  }
  .dl-btn:hover { background: #0e1e0b; transform: translateY(-1px); }
  .dl-btn:active { transform: translateY(0); }
  .cemetery .dl-btn { background: #6b1a1a; }
  .cemetery .dl-btn:hover { background: #4a1010; }

  /* ── KPI grid ───────────────────────────────────────────────────── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
    max-width: 820px;
    margin: 0 auto 32px;
  }
  .kpi {
    background: var(--panel2);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 18px 12px 14px;
    text-align: center;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .kpi.kpi-cond {
    border-left: 3px solid var(--kpi-accent, var(--border));
  }
  .kpi-n {
    font-family: 'Playfair Display', serif;
    font-size: 2rem;
    color: var(--canopy);
    line-height: 1;
    margin-bottom: 4px;
  }
  .kpi-n.kpi-sm { font-size: 1.25rem; line-height: 1.3; }
  .kpi-l {
    font-size: .62rem;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--parch-dim);
    margin-top: 4px;
  }

  /* ── Chunk ──────────────────────────────────────────────────────── */
  .chunk {
    margin-bottom: 44px;
    border: 1px solid var(--border);
    border-radius: 9px;
    overflow: hidden;
  }

  .print-running-hdr { display: none; }

  .chunk-map-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    padding: 9px 16px;
    background: var(--panel3);
    border-bottom: 1px solid var(--border);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .chunk-map-title {
    font-size: .65rem;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--parch-dim);
    font-weight: 600;
  }
  .chunk-legend { display: flex; flex-wrap: wrap; gap: 12px; }
  .chunk-leg-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: .64rem;
    color: var(--parch-dim);
    text-transform: uppercase;
    letter-spacing: .06em;
  }
  .chunk-leg-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,.6);
    flex-shrink: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Leaflet map ────────────────────────────────────────────────── */
  .chunk-map-el {
    width: 100%;
    height: 380px;
    display: block;
    position: relative;
  }
  .chunk-map-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: .65rem;
    color: var(--parch-dim);
    pointer-events: none;
    z-index: 0;
  }

  /* ── Table ──────────────────────────────────────────────────────── */
  .chunk-tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: .72rem;
    border-top: 1px solid var(--border);
  }
  th {
    background: var(--panel3);
    text-align: left;
    padding: 8px 12px;
    font-size: .64rem;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--gold);
    font-weight: 600;
    border-bottom: 2px solid var(--border);
    white-space: nowrap;
    user-select: none;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  th.sortable { cursor: pointer; }
  th.sortable:hover { background: var(--panel2); }
  td {
    padding: 7px 12px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
    color: var(--parch);
    line-height: 1.35;
  }
  tr.even td {
    background: var(--panel2);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  tr:hover td { background: var(--gold-hi); }
  tr:last-child td { border-bottom: none; }

  .td-dim    { color: var(--parch-dim); white-space: nowrap; font-size: .67rem; }
  .td-name   { font-weight: 600; color: var(--parch); }
  .td-italic { font-style: italic; color: var(--parch-dim); }
  .td-num    { font-variant-numeric: tabular-nums; }
  .td-loc    { color: var(--parch); }
  .td-nowrap { white-space: nowrap; }

  .cond-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
    vertical-align: middle;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Empty / footer ─────────────────────────────────────────────── */
  .empty { text-align: center; padding: 56px 24px; color: var(--parch-dim); font-size: .78rem; }
  .footer {
    margin-top: 44px;
    font-size: .62rem;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--parch-dim);
    text-align: center;
    border-top: 1px solid var(--border);
    padding-top: 18px;
  }

  /* ── Responsive ─────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    h1 { font-size: 1.7rem; }
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .chunk-map-el { height: 260px; }
    .cover-meta-row { flex-direction: column; }
    .cover-meta-item + .cover-meta-item { border-left: none; border-top: 1px solid var(--border); }
  }

  /* ── Print ──────────────────────────────────────────────────────── */
  @page { margin: 0.7in 0.75in; }

  @media print {
    :global(body) { background: #f2ede2 !important; }
    .dl-btn { display: none !important; }
    .cover-btn-row { display: none !important; }
    .page   { max-width: 100%; padding: 0; }
    .cover  { border-radius: 0; box-shadow: none; margin-bottom: 28px; }
    .cover-header { padding: 36px 32px 32px; }

    .print-running-hdr {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 14px 4px;
      background: #ece8dc;
      border-bottom: 1px solid rgba(50,75,40,.16);
      font-size: .58rem;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: rgba(28,36,25,.45);
      font-family: 'Outfit', sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .kpi { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    th {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      background: #ece8dc !important;
    }
    tr.even td {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      background: #f5f1e9 !important;
    }
    tr      { break-inside: avoid; }
    thead   { display: table-header-group; }
    .chunk  { break-inside: avoid-page; margin-bottom: 32px; }
    .chunk-map-el { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .chunk-map-hdr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
