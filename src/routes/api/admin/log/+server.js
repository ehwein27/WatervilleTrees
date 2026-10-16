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

export async function POST({ request }) {
  const { action, performed_by, details } = await request.json().catch(() => ({}));
  if (!action) return json({ error: 'action required.' }, { status: 400 });
  try {
    await fetch(`${SB_URL}/rest/v1/activity_log`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ action, performed_by: performed_by || null, details: details || null }),
    });
  } catch {}
  return json({ ok: true });
}
