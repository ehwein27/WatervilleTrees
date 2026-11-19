// Scheduled keep-alive: pings Supabase twice a day so the free-tier project
// isn't auto-paused for inactivity. Calls public.keepalive(), which updates a
// one-row heartbeat table (see the add_keepalive_heartbeat migration).
//
// Reuses the env vars the app already uses. Netlify scheduled functions only
// run on the published production deploy.

export default async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('keepalive: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set for functions');
    return new Response('missing env', { status: 500 });
  }

  const res = await fetch(`${url}/rest/v1/rpc/keepalive`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });

  const body = await res.text();
  if (!res.ok) {
    console.error('keepalive failed', res.status, body);
    return new Response('failed', { status: 500 });
  }
  console.log('keepalive ok', body);
  return new Response('ok');
};

export const config = { schedule: '0 6,18 * * *' };
