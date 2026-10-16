// CSV and report exports for tree inventory data
import { fetchAllTrees, sbGet } from '$lib/api/supabase.js';
import { calcITree, isEabRisk } from '$lib/utils/itree.js';

export async function downloadInventoryXLSX() {
  const XLSX = await import('xlsx');
  const all  = await fetchAllTrees();

  const COLS = [
    { key: 'Survey ID',         get: r => r.primary_survey_id   ?? '', wch: 14 },
    { key: 'Historical IDs',    get: r => {
        const ids = r.survey_display_ids || [];
        const hist = ids.slice(0, -1);
        return hist.length ? hist.join(', ') : '';
      }, wch: 28 },
    { key: 'Common Name',       get: r => r.common_name         ?? '', wch: 22 },
    { key: 'Scientific Name',   get: r => r.scientific_name     ?? '', wch: 24 },
    { key: 'Age Class',         get: r => r.age_class           ?? '', wch: 14 },
    { key: 'Condition Class',   get: r => r.condition           ?? '', wch: 14 },
    { key: 'Quantity',          get: r => r.quantity            ?? '', wch: 8  },
    { key: 'Stems',             get: r => r.stems               ?? '', wch: 7  },
    { key: 'Tree Notes',        get: r => r.tree_notes          ?? '', wch: 28 },
    { key: 'Street',            get: r => r.street_strata       ?? '', wch: 22 },
    { key: 'Dbh 1',             get: r => r.dbh1_in             ?? '', wch: 7  },
    { key: 'Dbh 2',             get: r => r.dbh2_in             ?? '', wch: 7  },
    { key: 'Dbh 3',             get: r => r.dbh3_in             ?? '', wch: 7  },
    { key: 'Dbh 4',             get: r => r.dbh4_in             ?? '', wch: 7  },
    { key: 'Dbh 5',             get: r => r.dbh5_in             ?? '', wch: 7  },
    { key: 'Dbh Height',        get: r => r.dbh_height_ft       ?? '', wch: 10 },
    { key: 'Observation 1',     get: r => r.observation_1       ?? '', wch: 22 },
    { key: 'Observation 2',     get: r => r.observation_2       ?? '', wch: 22 },
    { key: 'Observation 3',     get: r => r.observation_3       ?? '', wch: 22 },
    { key: 'Observation 4',     get: r => r.observation_4       ?? '', wch: 22 },
    { key: 'Observation 5',     get: r => r.observation_5       ?? '', wch: 22 },
    { key: 'Observation 6',     get: r => r.observation_6       ?? '', wch: 22 },
    { key: 'Last Updated',      get: r => r.last_updated        ?? '', wch: 12 },
    { key: 'Termite Nests',     get: r => r.btm_nests           ?? '', wch: 13 },
    { key: 'Distance to Water', get: r => r.distance_to_water   ?? '', wch: 18 },
    { key: 'Survey Source',     get: r => r.upload_information  ?? '', wch: 28 },
  ];

  const dataRows = all.map(row => {
    const out = {};
    COLS.forEach(c => { out[c.key] = c.get(row); });
    return out;
  });

  const activeCols = COLS.filter(c => dataRows.some(r => r[c.key] !== '' && r[c.key] != null));
  const filteredRows = dataRows.map(r =>
    Object.fromEntries(activeCols.map(c => [c.key, r[c.key]]))
  );

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filteredRows);
  ws['!cols'] = activeCols.map(c => ({ wch: c.wch }));
  XLSX.utils.book_append_sheet(wb, ws, 'Tree Inventory');
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Waterville_TreeInventory_${today}.xlsx`);
}

export async function downloadInventoryCSV() {
  const all = await fetchAllTrees();
  const header = [
    'Survey ID','Historical IDs','Common Name','Scientific Name','Age Class','Condition Class',
    'Quantity','Stems','Tree Notes','Longitude','Latitude',
    'Dbh 1','Dbh 2','Dbh 3','Dbh 4','Dbh 5','Dbh Height',
    'Observation 1','Observation 2','Observation 3',
    'Observation 4','Observation 5','Observation 6','Last Updated',
    'Termite Nests','Distance to Water','Survey Source'
  ];
  const esc = v => v == null ? '' : '"' + String(v).replace(/"/g, '""') + '"';
  const lines = [header.join(',')].concat(all.map(row => {
    const ids = row.survey_display_ids || [];
    const histIds = ids.slice(0, -1).join(', ');
    return [
      esc(row.primary_survey_id), esc(histIds), esc(row.common_name), esc(row.scientific_name),
      esc(row.age_class), esc(row.condition), esc(row.quantity), esc(row.stems),
      esc(row.tree_notes), esc(row.longitude), esc(row.latitude),
      esc(row.dbh1_in), esc(row.dbh2_in), esc(row.dbh3_in), esc(row.dbh4_in), esc(row.dbh5_in), esc(row.dbh_height_ft),
      esc(row.observation_1), esc(row.observation_2), esc(row.observation_3),
      esc(row.observation_4), esc(row.observation_5), esc(row.observation_6),
      esc(row.last_updated),
      esc(row.btm_nests), esc(row.distance_to_water), esc(row.upload_information)
    ].join(',');
  }));
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Tree_Inventory_Spring_2026.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const REPORT_BASE_CSS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter','Segoe UI',system-ui,sans-serif;font-size:10pt;color:#1c1c1e;background:#f5f5f7;print-color-adjust:exact;-webkit-print-color-adjust:exact}
@page{size:letter;margin:14mm}
@media print{body{background:#fff}.page-wrapper{box-shadow:none;max-width:none;margin:0;border-radius:0;background:#fff}}
.page-wrapper{max-width:820px;margin:0 auto;background:#fff;box-shadow:0 2px 24px rgba(0,0,0,.1);border-radius:4px;overflow:hidden}
.cover-eyebrow{font-size:7.5pt;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:14px}
.cover-title{font-family:'Playfair Display',Georgia,serif;font-size:26pt;font-weight:700;color:#fff;line-height:1.18;margin-bottom:8px}
.cover-sub{font-size:10pt;color:rgba(255,255,255,.65);margin-bottom:32px}
.cover-divider{width:48px;height:3px;border-radius:2px;margin-bottom:28px}
.cover-stats{display:flex;gap:0;flex-wrap:wrap;border:1px solid rgba(255,255,255,.12);border-radius:10px;overflow:hidden}
.cover-stat{flex:1;min-width:110px;padding:14px 18px;border-right:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.18)}
.cover-stat:last-child{border-right:none}
.cover-stat-label{font-size:6.5pt;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:4px}
.cover-stat-val{font-size:15pt;font-weight:700;color:#fff;line-height:1}
.body-content{padding:36px 48px 44px}
.sec-hdr{display:flex;align-items:center;gap:10px;margin:28px 0 14px}
.sec-hdr-text{font-size:8pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8e8e93;white-space:nowrap}
.sec-hdr-line{flex:1;height:1px;background:#e5e5ea}
.report-footer{margin-top:32px;padding-top:14px;border-top:1px solid #e5e5ea;display:flex;justify-content:space-between;align-items:center;font-size:7pt;color:#aeaeb2}`;

export async function downloadExecSummary(treesArr) {
  const fmt = n => '$' + Math.round(n).toLocaleString();
  const fmtK = n => n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : fmt(n);
  const esc = v => v == null ? '' : String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const genDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const COND_RANK = { Dead: 4, Poor: 3, Fair: 2, Good: 1 };

  const total = treesArr.length;
  const condCounts = { Good: 0, Fair: 0, Poor: 0, Dead: 0 };
  const spCounts = {};
  const streetRisk = {};
  let totalVal = 0, vc = 0, va = 0, vs = 0, ve = 0;

  let eabFlagSet = new Set();
  try {
    const flags = await sbGet('eab_flags');
    const arr = Array.isArray(flags) ? flags : JSON.parse(flags);
    eabFlagSet = new Set(arr);
  } catch {}

  treesArr.forEach(t => {
    if (condCounts[t.c] !== undefined) condCounts[t.c]++;
    if (t.n) spCounts[t.n] = (spCounts[t.n] || 0) + 1;
    if (t.vt) { totalVal += t.vt; vc += t.vc || 0; va += t.va || 0; vs += t.vs || 0; ve += t.ve || 0; }
    if (t.st) {
      if (!streetRisk[t.st]) streetRisk[t.st] = { critical: 0, high: 0, total: 0 };
      streetRisk[t.st].total++;
      if (t.c === 'Dead') streetRisk[t.st].critical++;
      else if (t.c === 'Poor') streetRisk[t.st].high++;
    }
  });

  const criticalCount = condCounts.Dead;
  const highCount = condCounts.Poor;
  const modCount = condCounts.Fair;
  const lowCount = condCounts.Good;
  const eabTotal = treesArr.filter(t => isEabRisk(t) || eabFlagSet.has(Number(t.id))).length;
  const streetCount = [...new Set(treesArr.map(t => t.st).filter(Boolean))].length;
  const spCount = Object.keys(spCounts).length;
  const condMax = Math.max(...Object.values(condCounts));
  const condColors = { Good: '#4ca344', Fair: '#d4ae30', Poor: '#d06828', Dead: '#a03535' };

  const topStreets = Object.entries(streetRisk)
    .map(([st, v]) => ({ st, score: v.critical * 2 + v.high, ...v }))
    .sort((a, b) => b.score - a.score).slice(0, 5);

  const topSp = Object.entries(spCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const spMax = topSp[0]?.[1] || 1;

  const condHtml = ['Good', 'Fair', 'Poor', 'Dead'].map(c => {
    const n = condCounts[c], pct = total ? Math.round(n / total * 100) : 0;
    const w = condMax ? Math.round(n / condMax * 100) : 0;
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
      <div style="width:46px;font-size:8.5pt;font-weight:500;color:#3a3a3c;text-align:right;flex-shrink:0">${c}</div>
      <div style="flex:1;height:14px;background:#f2f2f7;border-radius:3px;overflow:hidden;position:relative"><div style="height:100%;border-radius:3px;min-width:3px;width:${w}%;background:${condColors[c]}"><span style="position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:6.5pt;font-weight:600;color:rgba(255,255,255,.9)">${pct}%</span></div></div>
      <div style="width:28px;font-size:8.5pt;font-weight:600;color:#1c1c1e;flex-shrink:0">${n}</div>
    </div>`;
  }).join('');

  const riskChips = [
    { label: 'Critical', color: '#c0392b', bg: '#fdf0ef', border: '#e8b4b0', val: criticalCount },
    { label: 'High', color: '#d35400', bg: '#fef3ec', border: '#f0c5a0', val: highCount },
    { label: 'Moderate', color: '#b7950b', bg: '#fefae6', border: '#f0e09a', val: modCount },
    { label: 'Low', color: '#1e8449', bg: '#eafaf1', border: '#a9dfbf', val: lowCount },
  ].map(r => `<div style="border-radius:8px;padding:12px 14px;border:1px solid ${r.border};background:${r.bg}">
    <div style="font-size:6pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${r.color};margin-bottom:4px">${r.label}</div>
    <div style="font-size:18pt;font-weight:700;color:${r.color};line-height:1">${r.val}</div>
    <div style="font-size:6.5pt;color:${r.color};opacity:.65;margin-top:2px">${Math.round(r.val / total * 100)}% of inventory</div>
  </div>`).join('');

  const streetHtml = topStreets.map(s => {
    const hasCrit = s.critical > 0;
    const badgeColor = hasCrit ? '#c0392b' : '#d35400';
    const badgeBg = hasCrit ? '#fdf0ef' : '#fef3ec';
    const label = hasCrit ? `${s.critical} critical` : `${s.high} high`;
    return `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid #f0f0f0;font-size:8pt">
      <div style="flex:1;color:#3a3a3c">${esc(s.st)}</div>
      <div style="border-radius:4px;padding:1px 7px;font-size:7pt;font-weight:600;color:${badgeColor};background:${badgeBg}">${label}</div>
      <div style="font-size:7.5pt;color:#aeaeb2;width:44px;text-align:right">${s.total} trees</div>
    </div>`;
  }).join('');

  const spHtml = topSp.map(([name, n]) => {
    const w = Math.round(n / spMax * 100);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
      <div style="width:110px;font-size:7.5pt;color:#3a3a3c;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</div>
      <div style="flex:1;height:8px;background:#f2f2f7;border-radius:2px;overflow:hidden"><div style="height:100%;background:#4ca344;border-radius:2px;width:${w}%"></div></div>
      <div style="width:24px;font-size:7.5pt;font-weight:600;color:#1c1c1e;flex-shrink:0;text-align:right">${n}</div>
    </div>`;
  }).join('');

  const eabHtml = eabTotal > 0 ? `
    <div class="sec-hdr"><div class="sec-hdr-text">EAB risk</div><div class="sec-hdr-line"></div></div>
    <div style="background:#fdf0ef;border:1px solid #e8b4b0;border-radius:8px;padding:14px 18px;display:flex;gap:16px;align-items:center">
      <div style="font-size:22pt;font-weight:700;color:#c0392b;flex-shrink:0">${eabTotal}</div>
      <div>
        <div style="font-size:9pt;font-weight:600;color:#c0392b;margin-bottom:3px">trees at EAB risk</div>
        <div style="font-size:8pt;color:#8e8e93">${treesArr.filter(t => isEabRisk(t)).length} ash-species auto-flagged · ${eabTotal - treesArr.filter(t => isEabRisk(t)).length} manually flagged.</div>
      </div>
    </div>` : '';

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Waterville Tree Inventory — Executive Summary</title>
<style>${REPORT_BASE_CSS}
.cover{background:linear-gradient(150deg,#0d2b14 0%,#1a4422 55%,#2d6e3a 100%);padding:44px 48px 36px}
.cover-divider{background:linear-gradient(90deg,#7cc97f,#4ca344)}
</style></head><body><div class="page-wrapper">
<div class="cover">
  <div class="cover-eyebrow">Waterville Urban Tree Inventory</div>
  <div class="cover-title">Executive Summary</div>
  <div class="cover-sub">Generated ${genDate}</div>
  <div class="cover-divider"></div>
  <div class="cover-stats">
    <div class="cover-stat"><div class="cover-stat-label">Total Trees</div><div class="cover-stat-val">${total}</div></div>
    <div class="cover-stat"><div class="cover-stat-label">Streets</div><div class="cover-stat-val">${streetCount}</div></div>
    <div class="cover-stat"><div class="cover-stat-label">Critical Risk</div><div class="cover-stat-val" style="color:#ff7f7f">${criticalCount}</div></div>
    <div class="cover-stat"><div class="cover-stat-label">Annual Eco Value</div><div class="cover-stat-val" style="color:#7cc97f">${fmtK(totalVal)}</div></div>
  </div>
</div>
<div class="body-content">
  <div class="sec-hdr"><div class="sec-hdr-text">Inventory snapshot</div><div class="sec-hdr-line"></div></div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:4px">
    <div style="border:1px solid #e5e5ea;border-radius:10px;padding:16px 14px;background:#fafafa;position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:3px;background:#1a4422"></div><div style="font-size:6.5pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#8e8e93;margin-bottom:6px">Total trees</div><div style="font-size:18pt;font-weight:700;color:#1c1c1e;line-height:1">${total}</div><div style="font-size:7.5pt;color:#aeaeb2;margin-top:4px">across ${streetCount} streets</div></div>
    <div style="border:1px solid #e5e5ea;border-radius:10px;padding:16px 14px;background:#fafafa;position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:3px;background:#c0392b"></div><div style="font-size:6.5pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#8e8e93;margin-bottom:6px">Critical + high risk</div><div style="font-size:18pt;font-weight:700;color:#c0392b;line-height:1">${criticalCount + highCount}</div><div style="font-size:7.5pt;color:#aeaeb2;margin-top:4px">${Math.round((criticalCount + highCount) / total * 100)}% of inventory</div></div>
    <div style="border:1px solid #e5e5ea;border-radius:10px;padding:16px 14px;background:#fafafa;position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:3px;background:#4ca344"></div><div style="font-size:6.5pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#8e8e93;margin-bottom:6px">Annual eco value</div><div style="font-size:18pt;font-weight:700;color:#1a4422;line-height:1">${fmtK(totalVal)}</div><div style="font-size:7.5pt;color:#aeaeb2;margin-top:4px">i-Tree estimate</div></div>
  </div>
  <div class="sec-hdr"><div class="sec-hdr-text">Condition &amp; risk</div><div class="sec-hdr-line"></div></div>
  <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:24px;margin-bottom:4px">
    <div>
      <p style="font-size:7.5pt;font-weight:600;color:#8e8e93;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Condition breakdown</p>
      ${condHtml}
      <p style="font-size:7.5pt;font-weight:600;color:#8e8e93;text-transform:uppercase;letter-spacing:.08em;margin:18px 0 10px">Annual ecosystem value</p>
      <div style="display:flex;justify-content:space-between;font-size:8pt;padding:5px 0;border-bottom:1px solid #f0f0f0"><div style="color:#636366">CO<sub>2</sub> sequestration</div><div style="font-weight:600;color:#1c1c1e">${fmt(vc)}</div></div>
      <div style="display:flex;justify-content:space-between;font-size:8pt;padding:5px 0;border-bottom:1px solid #f0f0f0"><div style="color:#636366">Air quality</div><div style="font-weight:600;color:#1c1c1e">${fmt(va)}</div></div>
      <div style="display:flex;justify-content:space-between;font-size:8pt;padding:5px 0;border-bottom:1px solid #f0f0f0"><div style="color:#636366">Stormwater</div><div style="font-weight:600;color:#1c1c1e">${fmt(vs)}</div></div>
      <div style="display:flex;justify-content:space-between;font-size:8pt;padding:5px 0;border-bottom:1px solid #f0f0f0"><div style="color:#636366">Energy savings</div><div style="font-weight:600;color:#1c1c1e">${fmt(ve)}</div></div>
      <div style="display:flex;justify-content:space-between;font-size:8pt;padding:5px 0;border-top:2px solid #e5e5ea;margin-top:2px"><div style="font-weight:600;color:#1c1c1e">Total</div><div style="font-weight:600;color:#1a4422">${fmt(totalVal)}</div></div>
    </div>
    <div>
      <p style="font-size:7.5pt;font-weight:600;color:#8e8e93;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Risk level</p>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px">${riskChips}</div>
      <p style="font-size:7.5pt;font-weight:600;color:#8e8e93;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Top streets by risk</p>
      ${streetHtml}
      <p style="font-size:7.5pt;font-weight:600;color:#8e8e93;text-transform:uppercase;letter-spacing:.08em;margin:18px 0 10px">Top species (${spCount} total)</p>
      ${spHtml}
    </div>
  </div>
  ${eabHtml}
  <div class="report-footer" style="margin-top:32px">
    <span>Waterville Urban Tree Inventory · Field data by <span style="color:#6b8f5e;font-weight:600">Bartlett Tree Experts</span></span>
    <span>Generated ${genDate} · Print from browser for best results</span>
  </div>
</div>
</div></body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `waterville_tree_executive_summary_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── Prospective Planting exports ──────────────────────────────────────────────

const PRIORITY_STYLES = {
  High:   { color: '#c0392b', bg: '#fdf0ef', border: '#e8b4b0' },
  Medium: { color: '#d35400', bg: '#fef3ec', border: '#f0c5a0' },
  Low:    { color: '#1e8449', bg: '#eafaf1', border: '#a9dfbf' },
};

function buildProspectiveHTML(entries, reportName) {
  const esc = v => v == null ? '' : String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const genDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const title = (reportName && reportName.trim()) ? reportName.trim() : 'Prospective Tree Planting Plan';
  const total = entries.length;

  const priCounts = { High: 0, Medium: 0, Low: 0 };
  entries.forEach(e => { if (priCounts[e.priority] !== undefined) priCounts[e.priority]++; });

  const statsHtml = [
    { label: 'Total Planned', val: total,              color: '#fff' },
    { label: 'High Priority',  val: priCounts.High,    color: '#ff9f9f' },
    { label: 'Medium Priority',val: priCounts.Medium,  color: '#ffc07f' },
    { label: 'Low Priority',   val: priCounts.Low,     color: '#9fdfbf' },
  ].map(s =>
    `<div class="cover-stat"><div class="cover-stat-label">${s.label}</div><div class="cover-stat-val" style="color:${s.color}">${s.val}</div></div>`
  ).join('');

  const tableRows = entries.map((e, i) => {
    const ps = PRIORITY_STYLES[e.priority] || { color: '#555', bg: '#f5f5f7', border: '#e5e5ea' };
    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:8.5pt;color:#1c1c1e;font-weight:500">${esc(e.n) || '<em style="color:#aaa">—</em>'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:8.5pt;color:#3a3a3c">${esc(e.date) || '—'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0">
        <span style="display:inline-block;border-radius:4px;padding:2px 8px;font-size:7pt;font-weight:700;letter-spacing:.06em;color:${ps.color};background:${ps.bg};border:1px solid ${ps.border}">${esc(e.priority) || '—'}</span>
      </td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:8pt;color:#636366;max-width:260px">${esc(e.notes) || '—'}</td>
    </tr>`;
  }).join('');

  const bodyContent = total === 0
    ? '<p style="font-size:8.5pt;color:#8e8e93;font-style:italic">No trees in this planting plan.</p>'
    : `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e5ea;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#f2f2f7">
            <th style="padding:9px 12px;text-align:left;font-size:7pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8e8e93;border-bottom:1px solid #e5e5ea">Species</th>
            <th style="padding:9px 12px;text-align:left;font-size:7pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8e8e93;border-bottom:1px solid #e5e5ea">Est. Planting Date</th>
            <th style="padding:9px 12px;text-align:left;font-size:7pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8e8e93;border-bottom:1px solid #e5e5ea">Priority</th>
            <th style="padding:9px 12px;text-align:left;font-size:7pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8e8e93;border-bottom:1px solid #e5e5ea">Notes</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<style>${REPORT_BASE_CSS}
.cover{background:linear-gradient(150deg,#0d2b14 0%,#1a4422 55%,#2d6e3a 100%);padding:44px 48px 36px}
.cover-divider{background:linear-gradient(90deg,#7cc97f,#4ca344)}
</style></head><body><div class="page-wrapper">
<div class="cover">
  <div class="cover-eyebrow">Waterville Urban Tree Inventory</div>
  <div class="cover-title">${esc(title)}</div>
  <div class="cover-sub">Generated ${genDate}</div>
  <div class="cover-divider"></div>
  <div class="cover-stats">${statsHtml}</div>
</div>
<div class="body-content">
  <div class="sec-hdr"><div class="sec-hdr-text">Planned trees</div><div class="sec-hdr-line"></div></div>
  ${bodyContent}
  <div class="report-footer" style="margin-top:32px">
    <span>Waterville Urban Tree Inventory · Field data by <span style="color:#6b8f5e;font-weight:600">Bartlett Tree Experts</span></span>
    <span>Generated ${genDate} · Print from browser for best results</span>
  </div>
</div>
</div></body></html>`;
}

export function downloadProspectiveHTML(entries, reportName) {
  const html = buildProspectiveHTML(entries, reportName);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  const safe = (reportName || 'Prospective_Planting').replace(/[^a-z0-9_\-]/gi, '_');
  a.download = `${safe}_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Returns a Uint8Array of the XLSX file.
// Column layout matches the bulk-add template exactly (Street Address first),
// plus informational-only columns (Date, Priority, Notes) that the bulk-add
// parser ignores.
export async function generateProspectiveXLSXBytes(entries) {
  const XLSX = await import('xlsx');
  const wb   = XLSX.utils.book_new();
  const data = [
    ['Street Address', 'Common Name', 'Scientific Name', 'Condition', 'Age Class', 'DBH (inches)', 'Est. Planting Date', 'Priority', 'Notes'],
    ...entries.map(e => [
      e.addr     || '',
      e.n        || '',
      '',
      '',
      '',
      '',
      e.date     || '',
      e.priority || '',
      e.notes    || '',
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 18 }, { wch: 10 }, { wch: 36 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Prospective Planting');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }); // Uint8Array
}

export async function downloadProspectiveXLSX(entries, reportName) {
  const bytes = await generateProspectiveXLSXBytes(entries);
  const blob  = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href = url;
  const safe = (reportName || 'Prospective_Planting').replace(/[^a-z0-9_\-]/gi, '_');
  a.download = `${safe}_BulkAdd_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
