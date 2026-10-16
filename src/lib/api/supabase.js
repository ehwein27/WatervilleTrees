// src/lib/api/supabase.js
// All Supabase communication lives here. Nothing else should talk to Supabase directly.

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SB_HDRS = {
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
};

const KV_TABLE = 'app_storage';

// ── Trees ──────────────────────────────────────────────────────────────────────

const MAP_COLS = [
  'tree_id','common_name','scientific_name','condition',
  'age_class','dbh1_in','latitude','longitude',
  'street_strata','upload_information',
  'survey_display_ids','primary_survey_id',
].join(',');

// Lightweight fetch used for the initial map load — omits rarely-needed detail columns
export async function fetchAllTreesMap() {
  const PAGE = 1000;
  let all = [], offset = 0;
  while (true) {
    const url = `${SB_URL}/rest/v1/trees?select=${MAP_COLS}&order=tree_id.asc&limit=${PAGE}&offset=${offset}`;
    const r = await fetch(url, { headers: SB_HDRS });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`Supabase error ${r.status}: ${errText}`);
    }
    const rows = await r.json();
    if (!Array.isArray(rows)) throw new Error('Unexpected response: ' + JSON.stringify(rows));
    if (!rows.length) break;
    all = all.concat(rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// Full single-row fetch used when opening a tree in the sidebar
export async function fetchTreeDetail(treeId) {
  const r = await fetch(`${SB_URL}/rest/v1/trees?tree_id=eq.${treeId}&select=*&limit=1`, { headers: SB_HDRS });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows?.[0] ?? null;
}

export async function fetchAllTrees() {
  const PAGE = 1000;
  let all = [], offset = 0;
  while (true) {
    const url = `${SB_URL}/rest/v1/trees?select=*&order=tree_id.asc&limit=${PAGE}&offset=${offset}`;
    const r = await fetch(url, { headers: SB_HDRS });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`Supabase error ${r.status}: ${errText}`);
    }
    const rows = await r.json();
    if (!Array.isArray(rows)) throw new Error('Unexpected response: ' + JSON.stringify(rows));
    if (!rows.length) break;
    all = all.concat(rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function insertTrees(rows) {
  const r = await fetch(`${SB_URL}/rest/v1/trees`, {
    method: 'POST',
    headers: { ...SB_HDRS, 'Prefer': 'return=representation' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
  return r.json();
}

export async function updateTree(treeId, fields) {
  const r = await fetch(`${SB_URL}/rest/v1/trees?tree_id=eq.${treeId}`, {
    method: 'PATCH',
    headers: { ...SB_HDRS, 'Prefer': 'return=representation' },
    body: JSON.stringify(fields),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
  return r.json();
}

export async function deleteTreeRow(treeId) {
  const r = await fetch(`${SB_URL}/rest/v1/trees?tree_id=eq.${treeId}`, {
    method: 'DELETE',
    headers: { ...SB_HDRS, 'Prefer': 'return=minimal' },
  });
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
}

// ── Key-Value Storage ──────────────────────────────────────────────────────────

export async function sbGet(key) {
  const r = await fetch(
    `${SB_URL}/rest/v1/${KV_TABLE}?key=eq.${encodeURIComponent(key)}&select=value`,
    { headers: SB_HDRS }
  );
  const d = await r.json();
  if (!d.length) throw new Error('Key not found: ' + key);
  return d[0].value;
}

export async function sbSet(key, value) {
  const r = await fetch(`${SB_URL}/rest/v1/${KV_TABLE}`, {
    method: 'POST',
    headers: { ...SB_HDRS, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, value }),
  });
  if (!r.ok) throw new Error('Save failed');
}

export async function sbDelete(key) {
  await fetch(
    `${SB_URL}/rest/v1/${KV_TABLE}?key=eq.${encodeURIComponent(key)}`,
    { method: 'DELETE', headers: SB_HDRS }
  );
}

export async function sbList(prefix) {
  const r = await fetch(
    `${SB_URL}/rest/v1/${KV_TABLE}?key=like.${encodeURIComponent(prefix + '%')}&select=key`,
    { headers: SB_HDRS }
  );
  const d = await r.json();
  return d.map(row => row.key);
}

// ── Photo Storage (tree-photos bucket) ────────────────────────────────────────

const STORAGE_BUCKET = 'tree-photos';

export async function uploadPhoto(file, treeId, username) {
  const blob = await compressToBlob(file, 1200, 0.82);
  const path = `tree_${treeId}/${Date.now()}_${username || 'anon'}.jpg`;
  const r = await fetch(
    `${SB_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`,
    { method: 'POST', headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }, body: blob }
  );
  if (!r.ok) { const t = await r.text(); throw new Error('Upload failed: ' + t); }
  return `${SB_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

export async function deletePhoto(url) {
  const marker = `/object/public/${STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length);
  await fetch(
    `${SB_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`,
    { method: 'DELETE', headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY } }
  );
}

export async function getImgs(treeId) {
  try {
    const val = await sbGet('imgs:' + treeId);
    return Array.isArray(val) ? val : JSON.parse(val);
  } catch { return []; }
}

export async function putImgs(treeId, arr) {
  await sbSet('imgs:' + treeId, arr);
}

function compressToBlob(file, maxPx, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl); // fix #4 — release the blob reference immediately
      let w = img.width, h = img.height;
      if (w > maxPx || h > maxPx) {
        const r = Math.min(maxPx / w, maxPx / h);
        w = Math.round(w * r); h = Math.round(h * r);
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compress failed')), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('Image load failed')); };
    img.src = objUrl;
  });
}

// ── Access control ─────────────────────────────────────────────────────────────

export async function checkAllowedEmail(email) {
  const r = await fetch(
    `${SB_URL}/rest/v1/allowed_emails?email=eq.${encodeURIComponent(email)}&select=email&limit=1`,
    { headers: SB_HDRS }
  );
  if (!r.ok) throw new Error('Failed to check email allowlist');
  const data = await r.json();
  return Array.isArray(data) && data.length > 0;
}

export async function upsertUserRole(userId, role, performedBy, fromRole) {
  const r = await fetch('/api/admin/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: userId, role, performedBy, fromRole }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error('Failed to upsert user role: ' + t); }
}

export async function fetchActivityLog(limit = 50) {
  const r = await fetch(
    `${SB_URL}/rest/v1/activity_log?select=id,action,performed_by,details,created_at&order=created_at.desc&limit=${limit}`,
    { headers: SB_HDRS }
  );
  if (!r.ok) throw new Error('Failed to fetch activity log');
  return r.json();
}

export async function fetchUserRole(username) {
  const r = await fetch(
    `${SB_URL}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(username)}&select=role&limit=1`,
    { headers: SB_HDRS }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  return (Array.isArray(rows) && rows.length) ? rows[0].role : null;
}

// ── Admin: allowed emails ──────────────────────────────────────────────────────

export async function fetchAllowedEmails() {
  const r = await fetch(
    `${SB_URL}/rest/v1/allowed_emails?select=id,email,created_at&order=created_at.asc`,
    { headers: SB_HDRS }
  );
  if (!r.ok) throw new Error('Failed to fetch allowed emails');
  return r.json();
}

export async function addAllowedEmail(email, performedBy) {
  const r = await fetch('/api/admin/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, performedBy }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
  return r.json();
}

export async function removeAllowedEmail(email, performedBy) {
  const r = await fetch('/api/admin/emails', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, performedBy }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
}

// Store email → username reverse-lookup key so sign-in avoids a full scan
export async function storeEmailLookup(email, username) {
  await sbSet('ue:' + email.toLowerCase(), username);
}

export async function findUserByEmail(email) {
  const lower = email.toLowerCase();
  // Fast path: direct reverse-lookup key (set on sign-up / email update)
  try {
    const username = await sbGet('ue:' + lower);
    if (username && typeof username === 'string') {
      const raw = await sbGet('u:' + username);
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return { username, data };
    }
  } catch {}
  // Fallback: full scan for legacy accounts that pre-date the reverse-lookup key
  const r = await fetch(
    `${SB_URL}/rest/v1/app_storage?key=like.${encodeURIComponent('u:%')}&select=key,value`,
    { headers: SB_HDRS }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    try {
      const d = JSON.parse(row.value);
      if (d.email?.toLowerCase() === lower) return { username: row.key.slice(2), data: d };
    } catch {}
  }
  return null;
}

// ── Admin: users ───────────────────────────────────────────────────────────────

export async function fetchAllUsers() {
  const [aRes, uRes] = await Promise.all([
    fetch(`${SB_URL}/rest/v1/app_storage?key=like.${encodeURIComponent('u:%')}&select=key,value`, { headers: SB_HDRS }),
    fetch(`${SB_URL}/rest/v1/user_roles?select=user_id,role,created_at&order=created_at.asc`, { headers: SB_HDRS }),
  ]);
  const [aRows, uRows] = await Promise.all([aRes.json(), uRes.json()]);

  const roleInfo = {};
  if (Array.isArray(uRows)) {
    uRows.forEach(r => { roleInfo[r.user_id] = { role: r.role, createdAt: r.created_at }; });
  }

  if (!Array.isArray(aRows)) return [];
  return aRows.map(row => {
    try {
      const d = JSON.parse(row.value);
      const username = row.key.slice(2);
      const ri = roleInfo[username] || {};
      return { username, email: d.email || '', role: ri.role || d.role || 'user', createdAt: ri.createdAt || '' };
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => a.username.localeCompare(b.username));
}

export async function deleteUserAccount(username) {
  // Fetch email first so we can clean up the reverse-lookup key
  let email;
  try {
    const val = await sbGet('u:' + username);
    const d = typeof val === 'string' ? JSON.parse(val) : val;
    email = d?.email;
  } catch {}
  await Promise.all([
    sbDelete('u:' + username),
    fetch(`${SB_URL}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(username)}`, {
      method: 'DELETE', headers: SB_HDRS,
    }),
    ...(email ? [sbDelete('ue:' + email.toLowerCase())] : []),
  ]);
}

export async function revokeEmailAccess(email, performedBy) {
  await removeAllowedEmail(email, performedBy);
  // Find and delete the user account with this email
  const r = await fetch(
    `${SB_URL}/rest/v1/app_storage?key=like.${encodeURIComponent('u:%')}&select=key,value`,
    { headers: SB_HDRS }
  );
  const rows = await r.json();
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    try {
      const d = JSON.parse(row.value);
      if (d.email === email) {
        await deleteUserAccount(row.key.slice(2));
        return;
      }
    } catch {}
  }
}

// ── Password reset requests ────────────────────────────────────────────────────

export async function fetchResetRequests() {
  // Single batch query instead of list-then-N-fetches
  const r = await fetch(
    `${SB_URL}/rest/v1/${KV_TABLE}?key=like.${encodeURIComponent('rr:%')}&select=key,value`,
    { headers: SB_HDRS }
  );
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows
    .map(row => { try { return typeof row.value === 'string' ? JSON.parse(row.value) : row.value; } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
}

export async function clearResetRequest(username) {
  await sbDelete('rr:' + username);
}

// ── Removal lists (per-list KV keys — eliminates full-blob race conditions) ────

export async function fetchRListIndex() {
  try {
    const val = await sbGet('rl:index');
    return Array.isArray(val) ? val : JSON.parse(val);
  } catch { return []; }
}

export async function saveRListIndex(index) {
  await sbSet('rl:index', index);
}

export async function fetchRListItems(listId) {
  try {
    const val = await sbGet('rl:items:' + listId);
    return Array.isArray(val) ? val : JSON.parse(val);
  } catch { return []; }
}

export async function saveRListItems(listId, treeIds) {
  await sbSet('rl:items:' + listId, treeIds);
}

export async function deleteRListData(listId) {
  await sbDelete('rl:items:' + listId);
}

// Fetches full list objects (index metadata + items per list, parallelized)
export async function fetchRLists() {
  const index = await fetchRListIndex();
  if (!index.length) return [];
  const items = await Promise.all(index.map(l => fetchRListItems(l.id)));
  return index.map((l, i) => ({ ...l, trees: items[i] }));
}

// One-time transparent migration from the old single 'rlists' blob to per-list keys.
// Safe to call on every load — exits immediately once rl:index exists.
export async function migrateRListsIfNeeded() {
  try { await sbGet('rl:index'); return; } catch {}
  let old = [];
  try {
    const raw = await sbGet('rlists');
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) old = parsed;
  } catch {}
  await saveRListIndex(old.map(l => ({ id: l.id, name: l.name })));
  if (old.length) await Promise.all(old.map(l => saveRListItems(l.id, l.trees || [])));
}

// ── Storage adapter (same interface as before) ─────────────────────────────────

export const storage = {
  get: (key) => sbGet(key).then(value => ({ key, value })),
  set: (key, value) => sbSet(key, value).then(() => ({ key, value })),
  delete: (key) => sbDelete(key).then(() => ({ key, deleted: true })),
  list: (prefix = '') => sbList(prefix).then(keys => ({ keys })),
};
