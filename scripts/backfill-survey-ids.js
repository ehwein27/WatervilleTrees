#!/usr/bin/env node
// scripts/backfill-survey-ids.js
//
// Backfills survey_display_ids and primary_survey_id for trees that came from
// the three historical survey datasets:
//   1. February 2022   (static/data/february2022.json)  → prefix 022022
//   2. December 2022   (static/data/december2022.json)  → prefix 122022
//   3. September 2025  (static/data/september2025.csv)  → prefix from Inventory ID col (17481)
//
// Matching is done by lat/lng proximity (same GEO_THRESH used in the app).
// For trees in multiple surveys the array is built chronologically; primary_survey_id
// is always set to the most recently matched entry.
//
// Run once after the schema migration:
//   node scripts/backfill-survey-ids.js
//
// Safe to re-run: duplicate IDs are never appended.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Load .env ──────────────────────────────────────────────────────────────────
const envPath = resolve(__dir, '../.env');
const envLines = readFileSync(envPath, 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
}

const SB_URL = env.VITE_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const SB_HDRS = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

// ── Supabase helpers ───────────────────────────────────────────────────────────
async function sbFetch(path, { method = 'GET', body, extraHeaders } = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: { ...SB_HDRS, ...extraHeaders },
    body,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status} [${method} ${path}]: ${text}`);
  return text ? JSON.parse(text) : null;
}

// ── Load all trees ─────────────────────────────────────────────────────────────
async function loadAllTrees() {
  const SELECT = 'tree_id,latitude,longitude,survey_display_ids,primary_survey_id';
  const PAGE = 1000;
  let all = [], offset = 0;
  while (true) {
    const rows = await sbFetch(
      `trees?select=${SELECT}&order=tree_id.asc&limit=${PAGE}&offset=${offset}`
    );
    if (!Array.isArray(rows) || !rows.length) break;
    all = all.concat(rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// ── Geo matching ──────────────────────────────────────────────────────────────
const GEO_THRESH = 0.00015; // slightly wider than app (0.00005) to handle GPS drift in older data

function findBestMatch(lat, lng, dbTrees) {
  let best = null, bestDist = Infinity;
  for (const t of dbTrees) {
    if (t.latitude == null || t.longitude == null) continue;
    const dlat = lat - t.latitude;
    const dlng = (lng - t.longitude) * Math.cos(lat * Math.PI / 180);
    const dist = Math.sqrt(dlat * dlat + dlng * dlng);
    if (dist <= GEO_THRESH && dist < bestDist) {
      best = t; bestDist = dist;
    }
  }
  return best;
}

// ── Append display ID (removes stale bare-prefix entries, avoids duplicates) ──
// Old stale entries were bare 6-digit MMYYYY strings (e.g. "022022", "122022").
// Strip those alongside any bare inventory-ID-only prefix before adding the new full ID.
function appendId(existing, newId) {
  const prefix = newId.split('-')[0];
  const cleaned = existing.filter(id => id !== prefix && !/^\d{6}(-\d+)?$/.test(id));
  if (cleaned.includes(newId)) return cleaned;
  return [...cleaned, newId];
}

// ── Parse CSV (simple, handles quoted fields) ─────────────────────────────────
function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const parseLine = line => {
    const result = []; let cur = ''; let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim());
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
}

// ── Process one survey dataset ────────────────────────────────────────────────
async function processSurvey(records, label, dbTrees, stats) {
  const patches = {}; // tree_id → { survey_display_ids, primary_survey_id }

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    process.stdout.write(`\r  [${label}] ${i + 1}/${records.length}  `);

    const lat = parseFloat(rec.lat ?? rec.latitude);
    const lng = parseFloat(rec.lng ?? rec.longitude);
    if (isNaN(lat) || isNaN(lng)) { stats.skipped++; continue; }

    const match = findBestMatch(lat, lng, dbTrees);
    if (!match) { stats.noMatch++; continue; }

    const displayId = rec.displayId;
    const currentIds = patches[match.tree_id]?.survey_display_ids
      ?? (match.survey_display_ids || []);
    const newIds = appendId(currentIds, displayId);

    patches[match.tree_id] = {
      survey_display_ids: newIds,
      primary_survey_id: displayId,
    };

    // Update in-memory so subsequent surveys can see the updated state
    match.survey_display_ids = newIds;
    match.primary_survey_id  = displayId;
    stats.matched++;
  }

  process.stdout.write('\n');

  // Flush patches to Supabase in batches of 20
  const entries = Object.entries(patches);
  let flushed = 0;
  for (const [treeId, fields] of entries) {
    await sbFetch(`trees?tree_id=eq.${treeId}`, {
      method: 'PATCH',
      extraHeaders: { Prefer: 'return=minimal' },
      body: JSON.stringify(fields),
    });
    flushed++;
    if (flushed % 20 === 0) process.stdout.write(`  Patched ${flushed}/${entries.length}\r`);
  }
  process.stdout.write(`  Patched ${entries.length}/${entries.length}\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nLoading all trees from Supabase…');
  const dbTrees = await loadAllTrees();
  console.log(`Loaded ${dbTrees.length} trees.\n`);

  // ── 1. February 2022 JSON ────────────────────────────────────────────────────
  const feb22Path = resolve(__dir, '../static/data/february2022.json');
  const feb22 = JSON.parse(readFileSync(feb22Path, 'utf8'));
  const feb22Records = feb22.map(r => ({
    lat: r.lat, lng: r.lng,
    displayId: `${r._inventory_id}-${r._survey_id}`,
  }));
  const stats22 = { matched: 0, skipped: 0, noMatch: 0 };
  console.log(`Processing ${feb22Records.length} February 2022 records…`);
  await processSurvey(feb22Records, 'Feb 2022', dbTrees, stats22);
  console.log(`  ✓ matched ${stats22.matched}, no-match ${stats22.noMatch}, skipped ${stats22.skipped}\n`);

  // ── 2. December 2022 JSON ────────────────────────────────────────────────────
  const dec22Path = resolve(__dir, '../static/data/december2022.json');
  const dec22 = JSON.parse(readFileSync(dec22Path, 'utf8'));
  const dec22Records = dec22.map(r => ({
    lat: r.lat, lng: r.lng,
    displayId: `${r._inventory_id}-${r._survey_id}`,
  }));
  const statsDec = { matched: 0, skipped: 0, noMatch: 0 };
  console.log(`Processing ${dec22Records.length} December 2022 records…`);
  await processSurvey(dec22Records, 'Dec 2022', dbTrees, statsDec);
  console.log(`  ✓ matched ${statsDec.matched}, no-match ${statsDec.noMatch}, skipped ${statsDec.skipped}\n`);

  // ── 3. September 2025 CSV ────────────────────────────────────────────────────
  const sep25Path = resolve(__dir, '../static/data/september2025.csv');
  const sep25Rows = parseCSV(readFileSync(sep25Path, 'utf8'));
  const sep25Records = [];
  for (let i = 0; i < sep25Rows.length; i++) {
    const row = sep25Rows[i];
    const lat = parseFloat(row['latitude'] ?? row['lat'] ?? '');
    const lng = parseFloat(row['longitude'] ?? row['lng'] ?? '');
    const invId  = (row['inventory id'] ?? '').trim();
    const treeId = (row['tree id'] ?? '').trim() || String(i + 1);
    if (isNaN(lat) || isNaN(lng)) continue;
    sep25Records.push({
      lat, lng,
      displayId: invId ? `${invId}-${treeId}` : `092025-1-${i + 1}`,
    });
  }
  const statsSep = { matched: 0, skipped: 0, noMatch: 0 };
  console.log(`Processing ${sep25Records.length} September 2025 records…`);
  await processSurvey(sep25Records, 'Sep 2025', dbTrees, statsSep);
  console.log(`  ✓ matched ${statsSep.matched}, no-match ${statsSep.noMatch}, skipped ${statsSep.skipped}\n`);

  console.log('── Backfill complete ────────────────────────────────────────────');
  console.log(`  Feb 2022 : ${stats22.matched} matched`);
  console.log(`  Dec 2022 : ${statsDec.matched} matched`);
  console.log(`  Sep 2025 : ${statsSep.matched} matched`);
  console.log('\nTrees with no matching Supabase record were skipped (no-match).');
  console.log('Re-run is safe — duplicate IDs are never appended.');
}

main().catch(err => { console.error(err); process.exit(1); });
