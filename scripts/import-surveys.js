#!/usr/bin/env node
// scripts/import-surveys.js
// Imports two Bartlett survey datasets into Supabase.
// Matches survey trees against existing inventory, updates duplicates,
// inserts new trees (with Nominatim geocoding), and flags ambiguous cases.
//
// Usage:
//   node scripts/import-surveys.js february2022.json december2022.json
//
// Expected survey JSON format (array of objects):
// [
//   {
//     "lat": 44.5493,
//     "lng": -69.6244,
//     "common_name": "Norway Maple",
//     "scientific_name": "Acer platanoides",   // optional
//     "dbh": 12.5,                              // stored as dbh1_in
//     "age_class": "Mature",                    // optional
//     "condition": "Fair",
//     "btm_nests": 0,                           // optional
//     "distance_to_water": "25-250'",           // optional
//     "observations": ["Dead branches <=2"]     // optional, up to 6
//   }
// ]

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env ─────────────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
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
const SB_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const SB_HDRS = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/import-surveys.js february2022.json december2022.json');
  process.exit(1);
}

// ── Survey metadata ───────────────────────────────────────────────────────────
// Derives "February 2022" from "february2022.json"
function labelFromFilename(filename) {
  const base = basename(filename, '.json').toLowerCase();
  const MONTHS = ['january','february','march','april','may','june',
                  'july','august','september','october','november','december'];
  for (const m of MONTHS) {
    if (base.startsWith(m)) {
      const yearMatch = base.slice(m.length).match(/\d{4}/);
      if (yearMatch) return `${m.charAt(0).toUpperCase() + m.slice(1)} ${yearMatch[0]}`;
    }
  }
  // Fallback: capitalise whatever is there
  return base.charAt(0).toUpperCase() + base.slice(1);
}

const MONTH_NUM = {
  january:'01', february:'02', march:'03', april:'04',
  may:'05', june:'06', july:'07', august:'08',
  september:'09', october:'10', november:'11', december:'12',
};

// "February 2022" → "2022-02-01"
function surveyDateStr(label) {
  const [month, year] = label.split(' ');
  return `${year}-${MONTH_NUM[month.toLowerCase()] ?? '01'}-01`;
}

// "February 2022" → "022022"  (MMYYYY, matching the display ID prefix convention)
function labelToMmddyy(label) {
  const [month, year] = label.split(' ');
  const mm = MONTH_NUM[month.toLowerCase()] ?? '01';
  return `${mm}${year}`;
}

// Unix timestamp in milliseconds for survey date (matches how the app stores ts)
function surveyTs(label) {
  return new Date(surveyDateStr(label) + 'T12:00:00Z').getTime();
}

const surveys = [
  { file: resolve(args[0]), label: labelFromFilename(args[0]) },
  { file: resolve(args[1]), label: labelFromFilename(args[1]) },
];

console.log(`Survey A: "${surveys[0].label}" (${surveys[0].file})`);
console.log(`Survey B: "${surveys[1].label}" (${surveys[1].file})`);

// ── Supabase REST helpers ─────────────────────────────────────────────────────
async function sbFetch(path, { method = 'GET', body, extraHeaders } = {}) {
  const url = `${SB_URL}/rest/v1/${path}`;
  const r = await fetch(url, {
    method,
    headers: { ...SB_HDRS, ...extraHeaders },
    body,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status} [${method} ${path}]: ${text}`);
  return text ? JSON.parse(text) : null;
}

// ── KV store helpers (matches app_storage schema) ─────────────────────────────
// Values are stored as JSON-stringified strings, matching ConditionHistory.svelte.
async function kvGet(key) {
  const rows = await sbFetch(
    `app_storage?key=eq.${encodeURIComponent(key)}&select=value`
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const v = rows[0].value;
  // Value may already be parsed (JSONB) or still a string
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

async function kvSet(key, value) {
  // Always serialise to a JSON string to match how the app writes it
  await sbFetch('app_storage', {
    method: 'POST',
    extraHeaders: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, value: JSON.stringify(value) }),
  });
}

// ── Get the next available tree_id ───────────────────────────────────────────
// tree_id is manually assigned (not a DB serial), matching the app's behavior.
async function fetchMaxTreeId() {
  const rows = await sbFetch('trees?select=tree_id&order=tree_id.desc&limit=1');
  return Array.isArray(rows) && rows.length ? (parseInt(rows[0].tree_id, 10) || 0) : 0;
}

// ── Load all existing trees from Supabase (paginated) ─────────────────────────
async function loadAllTrees() {
  const PAGE = 1000;
  const SELECT = [
    'tree_id','common_name','scientific_name','age_class','condition',
    'dbh1_in','dbh2_in','dbh3_in','dbh4_in','dbh5_in',
    'latitude','longitude','street_strata',
    'btm_nests','distance_to_water','upload_information',
    'survey_display_ids','primary_survey_id',
  ].join(',');

  let all = [], offset = 0;
  while (true) {
    const rows = await sbFetch(
      `trees?select=${SELECT}&order=tree_id.asc&limit=${PAGE}&offset=${offset}`
    );
    if (!Array.isArray(rows) || rows.length === 0) break;
    all = all.concat(rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// ── Display ID helpers ────────────────────────────────────────────────────────
function appendDisplayId(existing, newId) {
  if (!Array.isArray(existing)) existing = [];
  if (existing.includes(newId)) return existing;
  return [...existing, newId];
}

// ── Geo + species matching ────────────────────────────────────────────────────
const GEO_THRESH = 0.00005; // ~5 metres in degrees

function findNearby(survey, dbTrees) {
  return dbTrees.filter(t =>
    Math.abs((t.latitude  ?? 0) - survey.lat) <= GEO_THRESH &&
    Math.abs((t.longitude ?? 0) - survey.lng) <= GEO_THRESH
  );
}

// Score 0–6. Reaching CONFIDENT_THRESHOLD means a reliable match.
function matchScore(survey, dbRow) {
  let score = 0;
  // Species (most important — required for confidence)
  if (survey.common_name && dbRow.common_name &&
      survey.common_name.trim().toLowerCase() === dbRow.common_name.trim().toLowerCase()) {
    score += 3;
  }
  // DBH within ±2 inches
  if (survey.dbh != null && dbRow.dbh1_in != null &&
      Math.abs(survey.dbh - dbRow.dbh1_in) <= 2) {
    score += 2;
  }
  // Age class
  if (survey.age_class && dbRow.age_class &&
      survey.age_class.trim().toLowerCase() === dbRow.age_class.trim().toLowerCase()) {
    score += 1;
  }
  return score;
}

const CONFIDENT_THRESHOLD = 3; // at minimum, species must match

function geoDistSq(lat1, lng1, lat2, lng2) {
  const dlat = lat1 - lat2;
  const dlng = (lng1 - lng2) * Math.cos((lat1 * Math.PI) / 180);
  return dlat * dlat + dlng * dlng;
}

function classify(survey, candidates) {
  if (candidates.length === 0) return { type: 'new' };

  const scored = candidates.map(t => ({ t, score: matchScore(survey, t) }));
  const confident = scored.filter(s => s.score >= CONFIDENT_THRESHOLD);

  // No species match among nearby trees → treat as a new tree
  if (confident.length === 0) return { type: 'new' };

  if (confident.length === 1) return { type: 'duplicate', match: confident[0].t };

  // Tie: multiple confident matches — pick the geographically nearest one
  confident.sort((a, b) =>
    geoDistSq(survey.lat, survey.lng, a.t.latitude, a.t.longitude) -
    geoDistSq(survey.lat, survey.lng, b.t.latitude, b.t.longitude)
  );
  return { type: 'duplicate', match: confident[0].t };
}

// ── Condition history ─────────────────────────────────────────────────────────
async function maybeLogCondHistory(dbRow, surveyCond, surveyLabel) {
  const key = `condhistory:${dbRow.tree_id}`;
  const history = await kvGet(key); // null or array
  const hasHistory = Array.isArray(history) && history.length > 0;
  const currentCond = dbRow.condition;

  // Skip if conditions match and history already exists
  if (hasHistory && currentCond === surveyCond) return;

  const entryWho = `Bartlett ${surveyLabel}`;

  // Skip if we already wrote an entry from this same survey (idempotency on re-run)
  if (hasHistory && history.some(e => e.who === entryWho)) return;

  const entry = {
    who:  entryWho,
    ts:   surveyTs(surveyLabel),
    cond: surveyCond,
    note: `Condition at time of ${surveyLabel} survey`,
  };

  const updated = hasHistory ? [entry, ...history] : [entry];
  await kvSet(key, updated);
  console.log(`      ↳ Logged condition history for tree #${dbRow.tree_id} (was: ${currentCond ?? 'null'} → survey: ${surveyCond})`);
}

// ── Nominatim reverse geocode ─────────────────────────────────────────────────
let _lastNominatimMs = 0;

async function geocodeStreet(lat, lng) {
  const wait = 1100 - (Date.now() - _lastNominatimMs);
  if (wait > 0) await sleep(wait);
  _lastNominatimMs = Date.now();

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'waterville-tree-import/1.0 (contact: admin@watervillemaine.gov)' } }
    );
    if (!r.ok) return null;
    const data = await r.json();
    return (
      data?.address?.road        ||
      data?.address?.pedestrian  ||
      data?.address?.path        ||
      data?.address?.footway     ||
      null
    );
  } catch {
    return null;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Build a Supabase insert row from a survey entry ───────────────────────────
function buildInsertRow(survey, streetName, uploadLabel, dateStr, treeId, displayId) {
  const obs = Array.isArray(survey.observations) ? survey.observations : [];
  return {
    tree_id:             treeId,
    common_name:         survey.common_name       || null,
    scientific_name:     survey.scientific_name   || null,
    age_class:           survey.age_class         || null,
    condition:           survey.condition         || null,
    dbh1_in:             survey.dbh               ?? null,
    dbh2_in:             survey.dbh2              ?? null,
    dbh3_in:             survey.dbh3              ?? null,
    latitude:            survey.lat,
    longitude:           survey.lng,
    street_strata:       streetName               || null,
    btm_nests:           survey.btm_nests         ?? null,
    distance_to_water:   survey.distance_to_water || null,
    upload_information:  uploadLabel,
    last_updated:        dateStr,
    observation_1:       obs[0]                   || null,
    observation_2:       obs[1]                   || null,
    observation_3:       obs[2]                   || null,
    observation_4:       obs[3]                   || null,
    observation_5:       obs[4]                   || null,
    observation_6:       obs[5]                   || null,
    survey_display_ids:  displayId ? [displayId] : [],
    primary_survey_id:   displayId                || null,
  };
}

// ── Process one survey dataset ────────────────────────────────────────────────
async function processSurvey(surveyTrees, label, dbTrees, flagged, stats, nextId) {
  const uploadLabel  = `Bartlett ${label}`;
  const dateStr      = surveyDateStr(label);
  const surveyPrefix = labelToMmddyy(label); // e.g. "022022" for February 2022

  for (let i = 0; i < surveyTrees.length; i++) {
    const survey = surveyTrees[i];
    process.stdout.write(`\r  [${label}] ${i + 1}/${surveyTrees.length}  `);

    // Build display ID: use _inventory_id from the record if present, else fall back to MMYYYY prefix
    const invId    = survey._inventory_id != null ? String(survey._inventory_id) : surveyPrefix;
    const treePart = survey._survey_id    != null ? String(survey._survey_id)    : String(i + 1);
    const displayId = `${invId}-${treePart}`;

    const candidates = findNearby(survey, dbTrees);
    const result     = classify(survey, candidates);

    // ── New tree ──────────────────────────────────────────────────────────
    if (result.type === 'new') {
      process.stdout.write(`\r  [${label}] ${i + 1}/${surveyTrees.length} → new, geocoding…  `);
      const streetName = await geocodeStreet(survey.lat, survey.lng);
      const treeId     = nextId.value++;
      const row        = buildInsertRow(survey, streetName, uploadLabel, dateStr, treeId, displayId);

      try {
        const inserted = await sbFetch('trees', {
          method: 'POST',
          body: JSON.stringify(row),
        });
        const newRow = Array.isArray(inserted) ? inserted[0] : inserted;
        console.log(`\n    ✚ Inserted tree #${newRow?.tree_id} — ${survey.common_name ?? 'unknown'} on "${streetName ?? '?'}" [${displayId}]`);
        if (newRow) dbTrees.push(newRow); // make available for subsequent matches
        stats.inserted++;
      } catch (e) {
        console.error(`\n    ✖ Insert failed (survey[${i}]):`, e.message);
        stats.errors++;
      }

    // ── Confirmed duplicate ───────────────────────────────────────────────
    } else if (result.type === 'duplicate') {
      const db    = result.match;
      const patch = {};

      if (db.btm_nests == null && survey.btm_nests != null)
        patch.btm_nests = survey.btm_nests;

      if (!db.distance_to_water && survey.distance_to_water)
        patch.distance_to_water = survey.distance_to_water;

      if (!db.age_class && survey.age_class)
        patch.age_class = survey.age_class;

      // upload_information: always set to base + footnote
      patch.upload_information =
        `Bartlett September 2025 * Additional data from ${uploadLabel}`;

      // Append new display ID to existing array; set as primary (most recent)
      patch.survey_display_ids = appendDisplayId(db.survey_display_ids, displayId);
      patch.primary_survey_id  = displayId;

      try {
        await sbFetch(`trees?tree_id=eq.${db.tree_id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
        Object.assign(db, patch); // keep in-memory record current
        console.log(`\n    ✎ Updated tree #${db.tree_id} — ${db.common_name} [${displayId}]`);
        stats.updated++;
      } catch (e) {
        console.error(`\n    ✖ Update failed for tree #${db.tree_id}:`, e.message);
        stats.errors++;
        continue; // skip condition history if update failed
      }

      if (survey.condition) {
        await maybeLogCondHistory(db, survey.condition, label);
      }

    // ── Flagged (ambiguous) ───────────────────────────────────────────────
    } else {
      flagged.push({
        survey_label: label,
        survey_index: i,
        survey,
        candidates: result.candidates.map(c => ({
          tree_id:     c.t.tree_id,
          common_name: c.t.common_name,
          lat:         c.t.latitude,
          lng:         c.t.longitude,
          dbh1_in:     c.t.dbh1_in,
          age_class:   c.t.age_class,
          condition:   c.t.condition,
          score:       c.score,
        })),
      });
      stats.flagged++;
    }
  }

  process.stdout.write('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nLoading all trees from Supabase…');
  const dbTrees = await loadAllTrees();
  console.log(`Loaded ${dbTrees.length} existing trees.`);

  const maxId = await fetchMaxTreeId();
  // Use an object so processSurvey can mutate it across calls
  const nextId = { value: maxId + 1 };
  console.log(`Next tree_id will be ${nextId.value}\n`);

  const flagged = [];
  const stats   = { inserted: 0, updated: 0, flagged: 0, errors: 0 };

  for (const { file, label } of surveys) {
    let surveyData;
    try {
      surveyData = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      console.error(`Could not read ${file}: ${e.message}`);
      stats.errors++;
      continue;
    }
    if (!Array.isArray(surveyData)) {
      console.error(`${file} must contain a JSON array.`);
      stats.errors++;
      continue;
    }

    console.log(`Processing ${surveyData.length} trees from "${label}"…`);
    await processSurvey(surveyData, label, dbTrees, flagged, stats, nextId);
  }

  // Write flagged.json next to the script
  const flaggedPath = resolve(__dir, '../flagged.json');
  writeFileSync(flaggedPath, JSON.stringify(flagged, null, 2));

  console.log('\n── Import complete ──────────────────────────────────────────');
  console.log(`  Inserted : ${stats.inserted}`);
  console.log(`  Updated  : ${stats.updated}`);
  console.log(`  Flagged  : ${stats.flagged}  →  flagged.json`);
  console.log(`  Errors   : ${stats.errors}`);
  if (flagged.length > 0) {
    console.log(`\n  ⚠ ${flagged.length} trees need manual resolution — see flagged.json`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
