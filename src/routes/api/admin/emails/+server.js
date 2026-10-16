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
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to your Netlify environment variables.' }, { status: 500 });
  }
  const { email, performedBy } = await request.json().catch(() => ({}));
  if (!email || !/.+@.+\..+/.test(email)) {
    return json({ error: 'Valid email required.' }, { status: 400 });
  }
  const r = await fetch(`${SB_URL}/rest/v1/allowed_emails`, {
    method: 'POST',
    headers: { ...hdrs(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ email: email.toLowerCase().trim() }),
  });
  if (!r.ok) { const t = await r.text(); return json({ error: t }, { status: r.status }); }
  await writeLog('email_added', performedBy, { email: email.toLowerCase().trim() });
  return json(await r.json());
}

export async function DELETE({ request }) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to your Netlify environment variables.' }, { status: 500 });
  }
  const { email, performedBy } = await request.json().catch(() => ({}));
  if (!email) return json({ error: 'Email required.' }, { status: 400 });
  const r = await fetch(
    `${SB_URL}/rest/v1/allowed_emails?email=eq.${encodeURIComponent(email.toLowerCase().trim())}`,
    { method: 'DELETE', headers: { ...hdrs(), 'Prefer': 'return=minimal' } }
  );
  if (!r.ok) { const t = await r.text(); return json({ error: t }, { status: r.status }); }
  await writeLog('email_removed', performedBy, { email: email.toLowerCase().trim() });
  return json({ ok: true });
}
