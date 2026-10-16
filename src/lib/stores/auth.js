// src/lib/stores/auth.js
// Authentication state — who is logged in, sign in/out logic

import { writable } from 'svelte/store';
import { sbGet, sbSet, checkAllowedEmail, upsertUserRole, findUserByEmail,
         storeEmailLookup, sbDelete, fetchUserRole } from '$lib/api/supabase.js';

export const currentUser = writable(null); // { username, role } | null
export const authMode = writable('in');    // 'in' | 'up'
export const authError = writable('');
export const authOpen = writable(false);

// These emails are seeded to admin on first account creation only.
// They are NOT an active authorization boundary at login — role is read
// from the user_roles table on every sign-in.
const ADMIN_EMAILS = new Set(['publicpolicy@colby.edu', 'ehwein27@colby.edu']);

// ── Password hashing ───────────────────────────────────────────────────────────

const PBKDF2_ITERS = 100_000;

function genSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(x => x.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2Hash(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: PBKDF2_ITERS },
    key, 256
  );
  return Array.from(new Uint8Array(bits)).map(x => x.toString(16).padStart(2, '0')).join('');
}

// Kept only for verifying legacy accounts that pre-date PBKDF2 migration
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password) {
  const salt = genSalt();
  const h = await pbkdf2Hash(password, salt);
  return { h, salt, kdf: 'pbkdf2' };
}

async function verifyPassword(password, stored) {
  if (stored.kdf === 'pbkdf2' && stored.salt) {
    const h = await pbkdf2Hash(password, stored.salt);
    return h === stored.h;
  }
  // Legacy: unsalted SHA-256 — passes through until account is upgraded
  const h = await sha(password);
  return h === (stored.h || stored.hash);
}

// ── Sign in ────────────────────────────────────────────────────────────────────
export async function signIn(identifier, password) {
  authError.set('');
  try {
    let username, d;

    if (identifier.includes('@')) {
      const match = await findUserByEmail(identifier.trim());
      if (!match) { authError.set('No account found for that email.'); return false; }
      username = match.username;
      d = match.data;
    } else {
      username = identifier.trim();
      const stored = await sbGet('u:' + username);
      d = JSON.parse(stored);
    }

    const ok = await verifyPassword(password, d);
    if (!ok) { authError.set('Incorrect password.'); return false; }

    // In parallel: fetch authoritative role from user_roles table + transparently
    // upgrade hash from legacy SHA-256 to PBKDF2 on first login after migration
    const [roleFromTable] = await Promise.all([
      fetchUserRole(username).catch(() => null),
      !d.kdf
        ? hashPassword(password).then(({ h, salt, kdf }) =>
            sbSet('u:' + username, JSON.stringify({ ...d, h, salt, kdf })).catch(() => {})
          )
        : Promise.resolve(),
    ]);

    let role = roleFromTable ?? d.role ?? 'user';

    // Seed admin role if email matches and user_roles doesn't have it yet
    if (ADMIN_EMAILS.has(d.email) && role !== 'admin') {
      role = 'admin';
      await sbSet('u:' + username, JSON.stringify({ ...d, role: 'admin' }));
      await upsertUserRole(username, 'admin').catch(() => {});
    }

    currentUser.set({ username, role, email: d.email || '' });
    authOpen.set(false);
    return true;
  } catch {
    authError.set('User not found.');
    return false;
  }
}

// ── Sign up ────────────────────────────────────────────────────────────────────
export async function signUp(username, password, email) {
  authError.set('');
  if (!username || !password) { authError.set('Username and password required.'); return false; }
  if (username.length < 2) { authError.set('Username must be ≥ 2 characters.'); return false; }
  if (!email || !/.+@.+\..+/.test(email)) { authError.set('Valid email address required.'); return false; }

  // Check email allowlist
  let allowed = false;
  try {
    allowed = await checkAllowedEmail(email);
  } catch {
    authError.set('Could not verify email. Please try again.');
    return false;
  }
  if (!allowed) {
    authError.set('Access restricted. Contact publicpolicy@colby.edu to request access or if you think this is a mistake.');
    return false;
  }

  const key = 'u:' + username;
  try {
    await sbGet(key);
    authError.set('Username already taken.');
    return false;
  } catch {
    // Key not found = username available
    const { h, salt, kdf } = await hashPassword(password);
    const role = ADMIN_EMAILS.has(email) ? 'admin' : 'user';
    await sbSet(key, JSON.stringify({ user: username, h, salt, kdf, role, email }));
    await Promise.all([
      upsertUserRole(username, role).catch(() => {}),
      storeEmailLookup(email, username).catch(() => {}),
    ]);
    currentUser.set({ username, role, email });
    authOpen.set(false);
    return true;
  }
}

// ── Sign out ───────────────────────────────────────────────────────────────────
export function signOut() {
  currentUser.set(null);
}

// ── Forgot password ────────────────────────────────────────────────────────────
export async function forgotPassword(email) {
  if (!email || !/.+@.+\..+/.test(email)) {
    return { ok: false, error: 'Valid email address required.' };
  }
  try {
    const r = await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!r.ok) throw new Error();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Failed to send request. Please try again.' };
  }
}

// ── Update email ───────────────────────────────────────────────────────────────
export async function updateEmail(username, newEmail) {
  if (!/.+@.+\..+/.test(newEmail)) return { ok: false, error: 'Valid email address required.' };
  try {
    const raw = await sbGet('u:' + username);
    const d = JSON.parse(raw);
    const oldEmail = d.email;
    await sbSet('u:' + username, JSON.stringify({ ...d, email: newEmail }));
    // Rotate the reverse-lookup key
    await Promise.all([
      oldEmail ? sbDelete('ue:' + oldEmail.toLowerCase()).catch(() => {}) : Promise.resolve(),
      storeEmailLookup(newEmail, username).catch(() => {}),
    ]);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Something went wrong.' };
  }
}

// ── Update password ────────────────────────────────────────────────────────────
export async function updatePassword(username, currentPassword, newPassword) {
  if (newPassword.length < 6) return { ok: false, error: 'New password must be at least 6 characters.' };
  try {
    const raw = await sbGet('u:' + username);
    const d = JSON.parse(raw);
    const ok = await verifyPassword(currentPassword, d);
    if (!ok) return { ok: false, error: 'Current password is incorrect.' };
    const { h, salt, kdf } = await hashPassword(newPassword);
    await sbSet('u:' + username, JSON.stringify({ ...d, h, salt, kdf }));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Something went wrong.' };
  }
}

// ── Restore from sessionStorage ────────────────────────────────────────────────
export function restoreSession() {
  try {
    const saved = sessionStorage.getItem('wt_user');
    if (saved) currentUser.set(JSON.parse(saved));
  } catch {}
  currentUser.subscribe(u => {
    if (u) sessionStorage.setItem('wt_user', JSON.stringify(u));
    else sessionStorage.removeItem('wt_user');
  });
}
