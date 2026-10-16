<script>
  import { onMount } from 'svelte';

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

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
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
                font-family:'DM Mono',monospace;
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
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div class="page">

  <!-- Cover -->
  <div class="cover" class:cemetery={data.isCemetery}>
    <div class="org">Waterville Urban Tree Inventory</div>
    <h1>{data.title}</h1>
    {#if data.subtitle}<div class="cover-sub">{data.subtitle}</div>{/if}
    <div class="cover-meta">Generated {genDate} &nbsp;·&nbsp; {data.stats.total} trees &nbsp;·&nbsp; Live data, refreshes on load</div>
    <button class="dl-btn" onclick={() => window.print()} title="Print report">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Print Report
    </button>
  </div>

  <!-- KPI row -->
  <div class="kpi-grid">
    {#each kpis as k}
      <div class="kpi">
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

  /* ── Reset body from the dark app shell ────────────────────────── */
  :global(html) { scroll-behavior: smooth; }
  :global(body) {
    font-family: 'DM Mono', monospace !important;
    background: #fdf8f0 !important;
    color: #1a1507 !important;
    height: auto !important;
    min-height: 100vh !important;
    overflow: auto !important;
    display: block !important;
  }

  .page {
    max-width: 960px;
    margin: 0 auto;
    padding: 0 20px 72px;
  }

  /* ── Cover ──────────────────────────────────────────────────────── */
  .cover {
    text-align: center;
    padding: 52px 24px 36px;
    border-bottom: 2px solid rgba(120,80,20,.18);
    margin-bottom: 28px;
  }
  .org {
    font-size: .65rem;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: #c9973a;
    margin-bottom: 8px;
  }
  h1 {
    font-family: 'Playfair Display', serif;
    font-size: 2rem;
    font-weight: 700;
    color: #0f2e14;
    line-height: 1.2;
    margin-bottom: 8px;
  }
  .cemetery h1 { color: #3a0f0f; }
  .cover-sub {
    font-size: .72rem;
    color: #5c3d08;
    font-style: italic;
    margin-bottom: 12px;
  }
  .cover-meta {
    font-size: .65rem;
    letter-spacing: .07em;
    color: #a08050;
    text-transform: uppercase;
  }

  /* ── KPI grid ───────────────────────────────────────────────────── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 10px;
    max-width: 800px;
    margin: 0 auto 28px;
    padding: 0 4px;
  }
  .kpi {
    background: #f5efe0;
    border: 1px solid rgba(120,80,20,.18);
    border-radius: 7px;
    padding: 16px 10px;
    text-align: center;
  }
  .kpi-n { font-family: 'Playfair Display', serif; font-size: 1.6rem; color: #1a5216; line-height: 1; }
  .kpi-n.kpi-sm { font-size: 1.1rem; }
  .kpi-l { font-size: .65rem; letter-spacing: .1em; text-transform: uppercase; color: #5c3d08; margin-top: 5px; }

  /* ── Chunk: map header ──────────────────────────────────────────── */
  .chunk {
    margin-bottom: 40px;
    border: 1px solid rgba(120,80,20,.18);
    border-radius: 8px;
    overflow: hidden;
  }

  .chunk-map-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 14px;
    background: #ece4cc;
    border-bottom: 1px solid rgba(120,80,20,.15);
  }
  .chunk-map-title {
    font-size: .65rem;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: #5c3d08;
    font-weight: 500;
  }
  .chunk-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .chunk-leg-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: .65rem;
    color: #5c3d08;
    text-transform: uppercase;
    letter-spacing: .06em;
  }
  .chunk-leg-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,.5);
    flex-shrink: 0;
  }

  /* ── Leaflet map container ──────────────────────────────────────── */
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
    color: #a08050;
    pointer-events: none;
    z-index: 0;
  }

  /* ── Table ──────────────────────────────────────────────────────── */
  .chunk-tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: .6rem;
    border-top: 1px solid rgba(120,80,20,.18);
  }
  th {
    background: #ece4cc;
    text-align: left;
    padding: 7px 10px;
    font-size: .65rem;
    letter-spacing: .09em;
    text-transform: uppercase;
    color: #5c3d08;
    border-bottom: 2px solid rgba(120,80,20,.22);
    white-space: nowrap;
    user-select: none;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  th.sortable { cursor: pointer; }
  th.sortable:hover { background: #ddd0b4; }
  td {
    padding: 6px 10px;
    border-bottom: 1px solid rgba(120,80,20,.1);
    vertical-align: middle;
    color: #2a1e0a;
  }
  tr.even td { background: rgba(245,239,224,.6); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tr:hover td { background: rgba(201,151,58,.08); }
  tr:last-child td { border-bottom: none; }

  .td-dim    { color: #8a6a3a; white-space: nowrap; }
  .td-name   { font-weight: 500; color: #1c1c1e; }
  .td-italic { font-style: italic; color: #3a4a2a; }
  .td-num    { font-variant-numeric: tabular-nums; }
  .td-loc    { color: #3a4a2a; }
  .td-nowrap { white-space: nowrap; }

  .cond-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }

  /* ── Empty / footer ─────────────────────────────────────────────── */
  .empty { text-align: center; padding: 56px 24px; color: #8a6a3a; font-size: .76rem; }
  .footer {
    margin-top: 40px;
    font-size: .65rem;
    letter-spacing: .07em;
    text-transform: uppercase;
    color: #a08050;
    text-align: center;
    border-top: 1px solid rgba(120,80,20,.18);
    padding-top: 16px;
  }

  /* ── Download / print button ────────────────────────────────────── */
  .dl-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 18px;
    background: transparent;
    border: 1px solid rgba(120,80,20,.3);
    border-radius: 4px;
    padding: 6px 16px;
    font-family: 'DM Mono', monospace;
    font-size: .6rem;
    letter-spacing: .06em;
    color: #5c3d08;
    cursor: pointer;
    transition: background .13s, border-color .13s;
  }
  .dl-btn:hover { background: rgba(120,80,20,.07); border-color: #8a5a1a; }
  .cemetery .dl-btn { color: var(--cond-dead); border-color: rgba(107,26,26,.32); }
  .cemetery .dl-btn:hover { background: rgba(107,26,26,.07); border-color: #8a3030; }

  /* ── Responsive ─────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    h1 { font-size: 1.5rem; }
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .chunk-map-el { height: 260px; }
  }

  /* ── Print ──────────────────────────────────────────────────────── */
  @media print {
    :global(body) { background: #fff !important; }
    .dl-btn { display: none !important; }
    .page   { max-width: 100%; padding: 0; }
    .cover  { padding: 24px 0 20px; }
    .kpi    { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    th      { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #ece4cc !important; }
    tr.even td { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: rgba(240,232,208,.4) !important; }
    tr      { break-inside: avoid; }
    thead   { display: table-header-group; }
    .chunk  { break-inside: avoid-page; }
    .chunk-map-el { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
