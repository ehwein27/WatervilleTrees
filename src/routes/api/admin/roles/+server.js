import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;

function hdrs() {
  return {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  };
}

async function writeLog(action, performed_by, details) {
  try {
    await fetch(`${SB_URL}/rest/v1/activity_log`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ action, performed_by: performed_by || null, details: details || null }),
    });
  } catch {}
}

export async function POST({ request }) {
  const { username, role, performedBy, fromRole } = await request.json().catch(() => ({}));
  if (!username || !['admin', 'user'].includes(role)) {
    return json({ error: 'username and valid role required.' }, { status: 400 });
  }
  const r = await fetch(`${SB_URL}/rest/v1/user_roles`, {
    method: 'POST',
    headers: { ...hdrs(), 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: username, role }),
  });
  if (!r.ok) { const t = await r.text(); return json({ error: t }, { status: r.status }); }
  // Only log when triggered by an admin action (performedBy present), not during sign-up
  if (performedBy) {
    await writeLog('role_changed', performedBy, { username, from_role: fromRole || null, to_role: role });
  }
  return json({ ok: true });
}
