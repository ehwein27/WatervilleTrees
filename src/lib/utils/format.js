// src/lib/utils/format.js
// Shared formatting helpers used across components

export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  } catch { return iso; }
}

export function fmtCurrency(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US');
}

export function condClass(condition) {
  return { Good: 'cg', Fair: 'cf', Poor: 'cp', Dead: 'cd' }[condition] ?? '';
}

export function condColor(condition) {
  return {
    Good: '#2ddb4a',
    Fair: '#d4860a',
    Poor: '#cc3300',
    Dead: '#6b1a1a',
  }[condition] ?? '#888';
}

// Age class from DBH
export function ageClass(dbh) {
  const d = parseFloat(dbh) || 0;
  if (d < 6)  return 'Young (<6")';
  if (d < 12) return 'Semi-mature (6–12")';
  if (d < 20) return 'Mature (12–20")';
  if (d < 30) return 'Large (20–30")';
  return 'Veteran (30"+)';
}
