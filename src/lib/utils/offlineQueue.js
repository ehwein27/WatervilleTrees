import { updateTree as sbUpdateTree } from '$lib/api/supabase.js';

const DB_NAME = 'wt-offline';
const DB_VERSION = 1;

// Single shared connection promise — opened once, reused across all operations
let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tree-cache')) {
        db.createObjectStore('tree-cache', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('write-queue')) {
        db.createObjectStore('write-queue', { autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => { _dbPromise = null; reject(e.target.error); };
  });
  return _dbPromise;
}

export async function cacheTreesLocally(trees) {
  const db = await openDB();
  // Check existing cache timestamp — skip write if data hasn't changed
  const existing = await new Promise((resolve) => {
    const req = db.transaction('tree-cache', 'readonly').objectStore('tree-cache').get('all');
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => resolve(null);
  });
  const newHash = trees.length + ':' + (trees[0]?.id ?? '') + ':' + (trees[trees.length - 1]?.id ?? '');
  const oldHash = existing
    ? existing.trees.length + ':' + (existing.trees[0]?.id ?? '') + ':' + (existing.trees[existing.trees.length - 1]?.id ?? '')
    : null;
  if (newHash === oldHash) return; // identical — skip the write

  return new Promise((resolve, reject) => {
    const tx = db.transaction('tree-cache', 'readwrite');
    tx.objectStore('tree-cache').put({ id: 'all', trees, cachedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function loadCachedTrees() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tree-cache', 'readonly');
    const req = tx.objectStore('tree-cache').get('all');
    req.onsuccess = (e) => {
      const rec = e.target.result;
      resolve(rec ? { trees: rec.trees, cachedAt: rec.cachedAt } : null);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function enqueueWrite(treeId, patch) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('write-queue', 'readwrite');
    tx.objectStore('write-queue').add({ treeId, patch, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function getPendingWrites() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('write-queue', 'readonly');
    const req = tx.objectStore('write-queue').openCursor();
    const results = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        results.push({ key: cursor.primaryKey, ...cursor.value });
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function dequeueWrite(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('write-queue', 'readwrite');
    tx.objectStore('write-queue').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function pendingWriteCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('write-queue', 'readonly');
    const req = tx.objectStore('write-queue').count();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function syncPendingWrites(onProgress) {
  const pending = await getPendingWrites();
  const total = pending.length;
  let synced = 0;
  let failed = 0;
  // Fire all writes in parallel — each targets a different tree
  await Promise.all(pending.map(async write => {
    try {
      await sbUpdateTree(write.treeId, write.patch);
      await dequeueWrite(write.key);
      synced++;
      onProgress?.(synced, total);
    } catch {
      failed++;
    }
  }));
  return { synced, failed };
}
