// src/routes/reports/[slug]/+page.server.js
// Fetches live tree data from Supabase and filters by report type.

import { fetchAllTrees } from '$lib/api/supabase.js';
import { isEabRisk } from '$lib/utils/itree.js';
import { rowToTree } from '$lib/utils/treeMap.js';
import { error } from '@sveltejs/kit';

function toSlug(s) {
  return s.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function resolveSlug(slug) {
  // ── By Condition ────────────────────────────────────────────────────────────
  const COND = { 'condition-good': 'Good', 'condition-fair': 'Fair', 'condition-poor': 'Poor', 'condition-dead': 'Dead' };
  if (COND[slug]) {
    const val = COND[slug];
    return {
      title: `Condition: ${val}`,
      subtitle: `All trees rated ${val}`,
      filter: t => t.c === val,
      sortKey: 'n',
      cols: ['id', 'name', 'species', 'age', 'dbh', 'value', 'location', 'updated'],
    };
  }

  // ── By Age Class ─────────────────────────────────────────────────────────────
  const AGE = { 'age-young': 'Young', 'age-semi-mature': 'Semi-mature', 'age-mature': 'Mature', 'age-over-mature': 'Over-mature' };
  if (AGE[slug]) {
    const val = AGE[slug];
    return {
      title: `Age Class: ${val}`,
      subtitle: `All trees classified as ${val}`,
      filter: t => t.a === val,
      sortKey: 'n',
      cols: ['id', 'name', 'species', 'condition', 'dbh', 'value', 'location', 'updated'],
    };
  }

  // ── By i-Tree Value ──────────────────────────────────────────────────────────
  if (slug === 'value-high')   return { title: 'i-Tree Value: High',   subtitle: 'Trees providing over $150/yr in ecosystem services',   filter: t => t.vt != null && t.vt > 150,              sortKey: 'value', sortDir: 'desc', cols: ['id', 'name', 'species', 'condition', 'age', 'dbh', 'value', 'location'] };
  if (slug === 'value-medium') return { title: 'i-Tree Value: Medium', subtitle: 'Trees providing $75–$150/yr in ecosystem services',    filter: t => t.vt != null && t.vt >= 75 && t.vt <= 150, sortKey: 'value', sortDir: 'desc', cols: ['id', 'name', 'species', 'condition', 'age', 'dbh', 'value', 'location'] };
  if (slug === 'value-low')    return { title: 'i-Tree Value: Low',    subtitle: 'Trees providing under $75/yr in ecosystem services',   filter: t => t.vt != null && t.vt < 75,               sortKey: 'value', sortDir: 'desc', cols: ['id', 'name', 'species', 'condition', 'age', 'dbh', 'value', 'location'] };

  // ── EAB Risk ─────────────────────────────────────────────────────────────────
  if (slug === 'eab-risk') return {
    title: 'EAB Risk: Ash Trees',
    subtitle: 'All ash trees (Fraxinus spp.) vulnerable to Emerald Ash Borer',
    filter: t => isEabRisk(t),
    sortKey: 'n',
    cols: ['id', 'name', 'species', 'condition', 'age', 'dbh', 'location', 'updated'],
  };

  // ── Dead Tree Cemetery ────────────────────────────────────────────────────────
  if (slug === 'dead-trees') return {
    title: 'Dead Tree Cemetery',
    subtitle: 'All trees recorded with condition Dead',
    filter: t => t.c === 'Dead',
    sortKey: 'n',
    cols: ['id', 'name', 'species', 'age', 'dbh', 'location', 'updated'],
    isCemetery: true,
  };

  // ── By Species ────────────────────────────────────────────────────────────────
  if (slug.startsWith('species-')) {
    const speciesSlug = slug.slice(8);
    return {
      title: null,
      subtitle: null,
      slugMatch: speciesSlug,
      filter: t => toSlug(t.n) === speciesSlug,
      sortKey: 'id',
      cols: ['id', 'condition', 'age', 'dbh', 'value', 'location', 'updated'],
      isSpecies: true,
    };
  }

  // ── By Location ───────────────────────────────────────────────────────────────
  if (slug.startsWith('location-')) {
    const locSlug = slug.slice(9);
    return {
      title: null,
      subtitle: null,
      slugMatch: locSlug,
      filter: t => toSlug(t.st) === locSlug,
      sortKey: 'n',
      cols: ['id', 'name', 'species', 'condition', 'age', 'dbh', 'value', 'location', 'updated'],
      isLocation: true,
    };
  }

  return null;
}

export async function load({ params }) {
  const meta = resolveSlug(params.slug);
  if (!meta) throw error(404, 'Report not found');

  const rows = await fetchAllTrees();
  const all = rows.map(rowToTree);
  let filtered = all.filter(meta.filter);

  // Resolve dynamic titles for species / location reports
  let title = meta.title;
  let subtitle = meta.subtitle;
  if (meta.isSpecies) {
    title = filtered.length > 0 ? `Species: ${filtered[0].n}` : 'Species Report';
    subtitle = filtered.length > 0 ? (filtered[0].s || '') : 'No trees found for this species';
  }
  if (meta.isLocation) {
    title = filtered.length > 0 ? `Location: ${filtered[0].st}` : 'Location Report';
    subtitle = filtered.length > 0 ? `All trees inventoried on ${filtered[0].st}` : 'No trees found for this location';
  }

  // Summary stats — single pass
  const byCondition = { Good: 0, Fair: 0, Poor: 0, Dead: 0 };
  let totalValue = 0;
  for (const t of filtered) {
    if (t.c in byCondition) byCondition[t.c]++;
    totalValue += t.vt || 0;
  }
  const stats = { total: filtered.length, byCondition, totalValue };

  return {
    title,
    subtitle,
    slug: params.slug,
    trees: filtered,
    cols: meta.cols,
    isCemetery: meta.isCemetery || false,
    defaultSort: meta.sortKey || 'n',
    defaultSortDir: meta.sortDir || 'asc',
    stats,
    generatedAt: new Date().toISOString(),
  };
}
