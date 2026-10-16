// src/lib/stores/prospective.js
// Prospective planting list and saved reports — persisted to localStorage

import { writable } from 'svelte/store';

const LS_LIST_KEY    = 'pp_list';
const LS_REPORTS_KEY = 'pp_reports';

function tryLoad(key, fallback) {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function makePersist(key) {
  return (val) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  };
}

// ── Stores ────────────────────────────────────────────────────────────────────

export const plantingList = writable(tryLoad(LS_LIST_KEY,    []));
export const savedReports = writable(tryLoad(LS_REPORTS_KEY, []));

plantingList.subscribe(makePersist(LS_LIST_KEY));
savedReports.subscribe(makePersist(LS_REPORTS_KEY));

// ── Planting list mutations ───────────────────────────────────────────────────

export function addEntry(entry) {
  plantingList.update(list => [
    ...list,
    {
      id: 'pp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      ...entry,
    },
  ]);
}

export function updateEntry(id, fields) {
  plantingList.update(list => list.map(e => e.id === id ? { ...e, ...fields } : e));
}

export function deleteEntry(id) {
  plantingList.update(list => list.filter(e => e.id !== id));
}

export function clearList() {
  plantingList.set([]);
}

// ── Saved report mutations ────────────────────────────────────────────────────

export function saveReport(name, entries) {
  const autoName = 'Prospective Planting Plan — ' +
    new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const report = {
    id:      'ppr_' + Date.now(),
    name:    (name && name.trim()) ? name.trim() : autoName,
    date:    new Date().toISOString(),
    entries: [...entries],
  };
  savedReports.update(reports => [report, ...reports]);
  return report;
}

export function deleteReport(id) {
  savedReports.update(reports => reports.filter(r => r.id !== id));
}
