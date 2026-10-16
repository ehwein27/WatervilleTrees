#!/usr/bin/env node
// scripts/backfill-upload-info.js
// One-time script: sets upload_information = "Bartlett September 2025" on every
// tree row that currently has upload_information as null.
//
// Usage:
//   node scripts/backfill-upload-info.js

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
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
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  env[key] = val;
}

const SB_URL = env.VITE_SUPABASE_URL;
const SB_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const HEADERS = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const UPLOAD_LABEL = 'Bartlett September 2025';
const PAGE = 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sbFetch(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: HEADERS, ...opts });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Paginate in case there are >1000 null rows
  let allIds = [];
  let offset = 0;
  while (true) {
    console.log(`Fetching rows with null upload_information (offset ${offset})…`);
    const rows = await sbFetch(
      `trees?select=tree_id&upload_information=is.null&order=tree_id.asc&limit=${PAGE}&offset=${offset}`
    );
    if (!Array.isArray(rows) || rows.length === 0) break;
    allIds = allIds.concat(rows.map(r => r.tree_id));
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`Found ${allIds.length} trees to backfill.`);
  if (allIds.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  // Update in batches of 500 (PostgREST URL length safety)
  const BATCH = 500;
  let updated = 0;
  for (let i = 0; i < allIds.length; i += BATCH) {
    const batch = allIds.slice(i, i + BATCH);
    const inClause = batch.join(',');
    await sbFetch(
      `trees?tree_id=in.(${inClause})`,
      { method: 'PATCH', body: JSON.stringify({ upload_information: UPLOAD_LABEL }) }
    );
    updated += batch.length;
    console.log(`  Updated ${updated}/${allIds.length}…`);
  }

  console.log(`\nDone. Set upload_information = "${UPLOAD_LABEL}" on ${allIds.length} trees.`);
}

main().catch(err => { console.error(err); process.exit(1); });
